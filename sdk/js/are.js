// .are reference SDK v0.1 — zero dependencies, runs in Node 20+ and modern browsers.
// Spec: spec/RFC-0001-ARE-Format.md
// Licensed under the Apache License 2.0.

export const ARE_VERSION = "0.1.0";
export const LAYERS = ["header", "spatial", "graph", "mind_sense", "timeline", "ledger"];
// Layers covered by header.merkle_root, in leaf order. The timeline is a log of roots, so it sits outside.
export const SEALED_LAYERS = ["header", "spatial", "graph", "mind_sense", "ledger"];
export const PRIVACY_MODES = ["LOCAL_PRIVATE", "ENCRYPTED_SHARED", "PUBLIC_ONCHAIN"];
export const ENCRYPTION_SCHEMES = ["NONE", "AES-256-GCM", "ZK-SNARK-SEALED"];
export const GEOMETRY_FORMATS = ["USDZ", "GLTF", "GAUSSIAN_SPLAT", "POINT_CLOUD", "MESH_OBJ", "ATOMIC_LATTICE"];
export const SORT_PLANS = ["KEEP", "SELL", "DONATE", "REPAIR", "RECYCLE"];
export const RELATION_TYPES = ["made_of", "instance_of", "part_of", "near", "replaces", "same_as"];
const DID_RE = /^did:are:[a-zA-Z0-9._:-]+$/;
const HASH_RE = /^sha256:[0-9a-f]{64}$/;

// ---------- canonical JSON (RFC 8785 / JCS) ----------
export function canonicalize(value) {
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Non-finite numbers are not allowed in .are");
    return JSON.stringify(value); // ECMAScript number formatting = JCS
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  if (typeof value === "object") {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(value[k])).join(",") + "}";
  }
  throw new Error("Unsupported value type: " + typeof value);
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
const tagged = async (text) => "sha256:" + (await sha256Hex(text));

// ---------- hashing ----------
function sealedView(entity, layer) {
  const value = entity[layer];
  if (value && typeof value === "object" && typeof value.$redacted === "string") return value;
  if (layer === "header") { const { merkle_root, ...rest } = value || {}; return rest; }
  if (layer === "ledger") { const { blockchain_anchor, ...rest } = value || {}; return rest; }
  return value ?? {};
}

/** Hash of one layer. A redacted layer ({"$redacted": "sha256:…"}) contributes its stored hash. */
export async function layerHash(entity, layer) {
  const view = sealedView(entity, layer);
  if (view && typeof view.$redacted === "string") return view.$redacted;
  return tagged("are-leaf:" + layer + ":" + canonicalize(view));
}

export async function layerHashes(entity) {
  const out = {};
  for (const layer of SEALED_LAYERS) out[layer] = await layerHash(entity, layer);
  return out;
}

/** Binary Merkle tree over the sealed layers; an odd node is carried up unchanged. */
export async function merkleRoot(entity) {
  let level = Object.values(await layerHashes(entity));
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(i + 1 < level.length ? await tagged("are-node:" + level[i] + level[i + 1]) : level[i]);
    }
    level = next;
  }
  return level[0];
}

/** Recompute and store header.merkle_root. Returns the entity. */
export async function seal(entity) {
  entity.header.merkle_root = await merkleRoot(entity);
  return entity;
}

// ---------- building entities ----------
export function createEntity({
  did, name, scale_exponent, privacy_mode = "LOCAL_PRIVATE", parent_did = null,
  created_at = new Date().toISOString(),
} = {}) {
  if (!DID_RE.test(did || "")) throw new Error("did must look like did:are:<namespace>:<id>");
  if (!name) throw new Error("name is required");
  if (typeof scale_exponent !== "number") throw new Error("scale_exponent (10^n metres) is required");
  if (!PRIVACY_MODES.includes(privacy_mode)) throw new Error("Unknown privacy_mode " + privacy_mode);
  return {
    header: { did, name, version: ARE_VERSION, scale_exponent, privacy_mode, merkle_root: "", created_at },
    spatial: {
      coordinates: { reference_frame: parent_did || "root", position: [0, 0, 0], rotation_quaternion: [0, 0, 0, 1] },
      physical_properties: {},
      geometry_refs: [],
    },
    graph: { parent_did, children_dids: [], relations: [] },
    mind_sense: { ontology_tags: [], summary: "", human_notes: [] },
    timeline: { head_commit: "", history: [] },
    ledger: {
      encryption_scheme: privacy_mode === "PUBLIC_ONCHAIN" ? "NONE" : "AES-256-GCM",
      storage_cid: null,
      blockchain_anchor: null,
    },
  };
}

/** Put child inside parent (where it lives / what it is made of). Updates both sides. */
export function nest(parent, child) {
  child.graph.parent_did = parent.header.did;
  child.spatial.coordinates = { ...(child.spatial.coordinates || {}), reference_frame: parent.header.did };
  if (!parent.graph.children_dids.includes(child.header.did)) parent.graph.children_dids.push(child.header.did);
}

/** Typed link to another entity, e.g. made_of → a public material template. */
export function relate(entity, type, target_did) {
  if (!RELATION_TYPES.includes(type)) throw new Error("Unknown relation type " + type);
  if (!DID_RE.test(target_did)) throw new Error("Bad target did " + target_did);
  const rel = entity.graph.relations || (entity.graph.relations = []);
  if (!rel.some((r) => r.type === type && r.target_did === target_did)) rel.push({ type, target_did });
}

/** Attach a note (text and/or voice recording) to the entity. */
export function addNote(entity, { text = "", audio_uri, author, created_at = new Date().toISOString() } = {}) {
  const note = { text, created_at };
  if (audio_uri) note.audio_uri = audio_uri;
  if (author) note.author = author;
  entity.mind_sense.human_notes.push(note);
  return note;
}

// ---------- 4D timeline ----------
/** Seal the entity and append a commit to its history (like git, but for an object's life). */
export async function commit(entity, event, { timestamp = new Date().toISOString(), note } = {}) {
  await seal(entity);
  const parent = entity.timeline.head_commit || null;
  const body = { event, parent, root: entity.header.merkle_root, timestamp };
  if (note) body.note = note;
  const id = await tagged("are-commit:" + canonicalize(body));
  entity.timeline.history.push({ id, ...body });
  entity.timeline.head_commit = id;
  return id;
}

/** Hand the entity to a new owner (e.g. when selling it). History travels with the object. */
export async function transfer(entity, { to, price, timestamp, note } = {}) {
  if (!to) throw new Error("transfer needs a new owner (to)");
  entity.ledger.owner = to;
  if (price) entity.ledger.sale_price = price;
  delete entity.ledger.asking_price;
  if (entity.mind_sense.sort_plan === "SELL") delete entity.mind_sense.sort_plan;
  return commit(entity, "transferred", { timestamp, note });
}

// ---------- sharing ----------
/**
 * Copy of the entity that reveals only `keep` layers. Hidden layers become {"$redacted": hash},
 * so the merkle_root still verifies and the receiver can trust what they were shown.
 * The header is always kept.
 */
export async function disclose(entity, keep = []) {
  const out = structuredClone(entity);
  for (const layer of SEALED_LAYERS) {
    if (layer === "header" || keep.includes(layer)) continue;
    out[layer] = { $redacted: await layerHash(entity, layer) };
  }
  if (!keep.includes("timeline")) out.timeline = { head_commit: entity.timeline.head_commit, history: [] };
  return out;
}

// ---------- checking ----------
/** Structural check against schema v0.1 (no network, no dependencies). */
export function validate(entity) {
  const errors = [];
  const need = (cond, msg) => { if (!cond) errors.push(msg); };
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  need(isObj(entity), "entity must be an object");
  if (!isObj(entity)) return { valid: false, errors };
  for (const l of LAYERS) need(isObj(entity[l]), `missing layer: ${l}`);
  const h = entity.header || {};
  need(DID_RE.test(h.did || ""), "header.did must match did:are:…");
  need(typeof h.name === "string" && h.name.length > 0, "header.name is required");
  need(typeof h.version === "string", "header.version is required");
  need(typeof h.scale_exponent === "number" && h.scale_exponent >= -35 && h.scale_exponent <= 27,
    "header.scale_exponent must be a number between -35 and 27");
  need(PRIVACY_MODES.includes(h.privacy_mode), "header.privacy_mode must be one of " + PRIVACY_MODES.join(", "));
  need(h.merkle_root === "" || HASH_RE.test(h.merkle_root || ""), "header.merkle_root must be sha256:<64 hex> or empty");
  const redacted = (l) => isObj(entity[l]) && typeof entity[l].$redacted === "string";
  if (!redacted("spatial") && isObj(entity.spatial)) {
    for (const g of entity.spatial.geometry_refs || [])
      need(GEOMETRY_FORMATS.includes(g.format), `geometry format ${g.format} is not one of ${GEOMETRY_FORMATS.join(", ")}`);
    const pos = entity.spatial.coordinates?.position;
    need(pos === undefined || (Array.isArray(pos) && pos.length === 3), "spatial.coordinates.position must have 3 numbers");
  }
  if (!redacted("graph") && isObj(entity.graph)) {
    const g = entity.graph;
    need(g.parent_did === null || g.parent_did === undefined || DID_RE.test(g.parent_did), "graph.parent_did must be a did or null");
    need(Array.isArray(g.children_dids || []), "graph.children_dids must be a list");
    for (const c of g.children_dids || []) need(DID_RE.test(c), `bad child did ${c}`);
    for (const r of g.relations || []) {
      need(RELATION_TYPES.includes(r.type), `relation type ${r.type} unknown`);
      need(DID_RE.test(r.target_did || ""), `bad relation target ${r.target_did}`);
    }
  }
  if (!redacted("mind_sense") && isObj(entity.mind_sense)) {
    const m = entity.mind_sense;
    need(m.sort_plan === undefined || SORT_PLANS.includes(m.sort_plan), "mind_sense.sort_plan must be one of " + SORT_PLANS.join(", "));
    for (const n of m.human_notes || []) need(typeof n === "string" || isObj(n), "human_notes items must be text or note objects");
    const p = m.sensory_aura?.attention_priority;
    need(p === undefined || (p >= 0 && p <= 1), "sensory_aura.attention_priority must be 0..1");
  }
  if (!redacted("ledger") && isObj(entity.ledger)) {
    need(ENCRYPTION_SCHEMES.includes(entity.ledger.encryption_scheme), "ledger.encryption_scheme must be one of " + ENCRYPTION_SCHEMES.join(", "));
    if (h.privacy_mode === "PUBLIC_ONCHAIN") need(entity.ledger.encryption_scheme === "NONE", "PUBLIC_ONCHAIN entities must not be encrypted");
  }
  need(Array.isArray(entity.timeline?.history), "timeline.history must be a list");
  return { valid: errors.length === 0, errors };
}

/** Full check: structure, merkle root, and the commit chain. */
export async function verify(entity) {
  const { errors } = validate(entity);
  if (errors.length) return { ok: false, errors };
  const root = await merkleRoot(entity);
  if (entity.header.merkle_root && entity.header.merkle_root !== root)
    errors.push(`merkle_root mismatch: file says ${entity.header.merkle_root}, content hashes to ${root}`);
  let prev = null;
  for (const c of entity.timeline.history) {
    const { id, ...body } = c;
    if (body.parent !== prev) errors.push(`commit ${id} does not follow ${prev}`);
    if ((await tagged("are-commit:" + canonicalize(body))) !== id) errors.push(`commit ${id} was altered`);
    prev = id;
  }
  if (entity.timeline.history.length && entity.timeline.head_commit !== prev) errors.push("head_commit is not the last commit");
  return { ok: errors.length === 0, errors, merkle_root: root };
}

// ---------- files ----------
export const stringify = (entity) => JSON.stringify(entity, null, 2) + "\n";
export const parse = (text) => JSON.parse(text);
