import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  canonicalize, createEntity, nest, relate, addNote, commit, transfer, disclose,
  merkleRoot, seal, validate, verify, parse,
} from "../sdk/js/are.js";

const T = "2026-10-26T09:00:00.000Z";
const mug = () => createEntity({ did: "did:are:local:mug-1", name: "Mug", scale_exponent: -1, created_at: T });
const examples = new URL("../examples/", import.meta.url);

test("canonical JSON sorts keys and drops undefined", () => {
  assert.equal(canonicalize({ b: 1, a: [true, null, "x"], c: undefined }), '{"a":[true,null,"x"],"b":1}');
  assert.equal(canonicalize(1.5e53), "1.5e+53");
  assert.throws(() => canonicalize(NaN));
});

test("merkle root is stable and ignores key order", async () => {
  const a = mug(), b = mug();
  b.spatial = { geometry_refs: [], physical_properties: {}, coordinates: a.spatial.coordinates };
  assert.equal(await merkleRoot(a), await merkleRoot(b));
  a.mind_sense.summary = "changed";
  assert.notEqual(await merkleRoot(a), await merkleRoot(b));
});

test("merkle root does not depend on itself, the timeline or the chain anchor", async () => {
  const e = await seal(mug());
  const root = e.header.merkle_root;
  e.ledger.blockchain_anchor = { chain: "base", tx: "0xabc" };
  await commit(e, "anchored", { timestamp: T });
  assert.equal(e.header.merkle_root, root);
});

test("validate rejects bad data", () => {
  const e = mug();
  e.header.did = "mug";
  e.header.privacy_mode = "SECRET";
  e.mind_sense.sort_plan = "BURN";
  const r = validate(e);
  assert.equal(r.valid, false);
  assert.equal(r.errors.length, 3);
  assert.throws(() => createEntity({ did: "x", name: "a", scale_exponent: 0 }));
});

test("public entities must not be encrypted", () => {
  const e = createEntity({ did: "did:are:public:x", name: "X", scale_exponent: 0, privacy_mode: "PUBLIC_ONCHAIN" });
  assert.equal(validate(e).valid, true);
  e.ledger.encryption_scheme = "AES-256-GCM";
  assert.equal(validate(e).valid, false);
});

test("nest and relate keep both sides in sync", () => {
  const desk = createEntity({ did: "did:are:local:desk", name: "Desk", scale_exponent: 0 });
  const m = mug();
  nest(desk, m); nest(desk, m);
  assert.deepEqual(desk.graph.children_dids, ["did:are:local:mug-1"]);
  assert.equal(m.graph.parent_did, "did:are:local:desk");
  assert.equal(m.spatial.coordinates.reference_frame, "did:are:local:desk");
  relate(m, "made_of", "did:are:public:material:porcelain");
  relate(m, "made_of", "did:are:public:material:porcelain");
  assert.equal(m.graph.relations.length, 1);
  assert.throws(() => relate(m, "likes", "did:are:local:x"));
});

test("history chain verifies and detects tampering", async () => {
  const e = mug();
  addNote(e, { text: "sell later", audio_uri: "local://voice/1.m4a", created_at: T });
  await commit(e, "created", { timestamp: T });
  e.spatial.coordinates.position = [1, 0, 0];
  await commit(e, "moved", { timestamp: "2026-10-27T09:00:00.000Z" });
  assert.equal(e.timeline.history.length, 2);
  assert.equal(e.timeline.history[1].parent, e.timeline.history[0].id);
  assert.equal((await verify(e)).ok, true);

  const edited = structuredClone(e);
  edited.timeline.history[0].event = "bought";
  assert.equal((await verify(edited)).ok, false);

  const changed = structuredClone(e);
  changed.mind_sense.summary = "sneaky edit";
  const r = await verify(changed);
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /merkle_root mismatch/);
});

test("transfer hands the object over with its history", async () => {
  const e = mug();
  e.mind_sense.sort_plan = "SELL";
  e.ledger.asking_price = { amount: 5, currency: "EUR" };
  await commit(e, "created", { timestamp: T });
  await transfer(e, { to: "did:are:person:buyer", price: { amount: 4, currency: "EUR" }, timestamp: T });
  assert.equal(e.ledger.owner, "did:are:person:buyer");
  assert.equal(e.ledger.asking_price, undefined);
  assert.equal(e.mind_sense.sort_plan, undefined);
  assert.deepEqual(e.timeline.history.map((c) => c.event), ["created", "transferred"]);
  assert.equal((await verify(e)).ok, true);
  await assert.rejects(() => transfer(e, {}), /owner/);
});

test("selective sharing hides layers but keeps the same root", async () => {
  const e = mug();
  addNote(e, { text: "private", created_at: T });
  await commit(e, "created", { timestamp: T });
  const shared = await disclose(e, ["ledger"]);
  assert.ok(shared.mind_sense.$redacted);
  assert.ok(shared.spatial.$redacted);
  assert.equal(JSON.stringify(shared).includes("private"), false);
  assert.equal(await merkleRoot(shared), e.header.merkle_root);
  assert.equal((await verify(shared)).ok, true);
  shared.ledger.storage_cid = "ipfs://forged";
  assert.equal((await verify(shared)).ok, false);
});

test("every example file verifies", async () => {
  const files = readdirSync(examples).filter((f) => f.endsWith(".are"));
  assert.ok(files.length >= 5);
  for (const f of files) {
    const r = await verify(parse(readFileSync(new URL(f, examples), "utf8")));
    assert.equal(r.ok, true, f + ": " + r.errors.join("; "));
  }
});

test("the shared armchair matches the full armchair", async () => {
  const full = parse(readFileSync(new URL("armchair.are", examples), "utf8"));
  const shared = parse(readFileSync(new URL("armchair.shared.are", examples), "utf8"));
  assert.equal(shared.header.merkle_root, full.header.merkle_root);
  assert.equal(await merkleRoot(shared), full.header.merkle_root);
});

test("every example is sealed and has a head commit", async () => {
  for (const f of readdirSync(examples).filter((x) => x.endsWith(".are"))) {
    const e = parse(readFileSync(new URL(f, examples), "utf8"));
    assert.match(e.header.merkle_root, /^sha256:[0-9a-f]{64}$/, f);
    assert.match(e.timeline.head_commit, /^sha256:/, f);
  }
});

test("encryption hides layers, keeps the root, and round-trips", async () => {
  const { encryptLayers, decryptLayers, generateKey } = await import("../sdk/js/are.js");
  const e = parse(readFileSync(new URL("armchair.are", examples), "utf8"));
  const key = generateKey();
  const enc = await encryptLayers(e, { key });
  assert.equal(JSON.stringify(enc).includes("Grandma"), false);
  assert.equal(enc.timeline.history.length, 0);
  assert.equal((await verify(enc)).ok, true);
  const dec = await decryptLayers(enc, { key });
  for (const l of ["spatial", "graph", "mind_sense", "timeline"]) assert.equal(canonicalize(dec[l]), canonicalize(e[l]));
  assert.equal((await verify(dec)).ok, true);
  await assert.rejects(() => decryptLayers(enc, { key: generateKey() }), /wrong key/);

  const withPass = await encryptLayers(e, { passphrase: "correct horse" }, ["mind_sense"]);
  assert.ok(withPass.spatial.coordinates, "only the chosen layer is encrypted");
  assert.equal((await decryptLayers(withPass, { passphrase: "correct horse" })).mind_sense.sort_plan, "SELL");

  // Swapping an encrypted layer between files is caught (the did is bound into the ciphertext).
  const other = await encryptLayers({ ...structuredClone(e), header: { ...e.header, did: "did:are:local:other" } }, { key });
  const swapped = structuredClone(enc);
  swapped.mind_sense = other.mind_sense;
  await assert.rejects(() => decryptLayers(swapped, { key }));
});

test("folder form packs back to the same file", async () => {
  const { pack, unpack } = await import("../sdk/js/folder.js");
  const { mkdtempSync, readdirSync: ls } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = join(mkdtempSync(join(tmpdir(), "are-")), "armchair.are.d");
  const e = parse(readFileSync(new URL("armchair.are", examples), "utf8"));
  unpack(e, dir);
  assert.deepEqual(ls(dir).sort(), ["graph.json", "header.json", "ledger.json", "mind_sense.json", "spatial.json", "timeline.json"]);
  assert.deepEqual(pack(dir), e);
});

test("template library verifies and every link inside it resolves", async () => {
  const lib = new URL("../templates/", import.meta.url);
  const index = JSON.parse(readFileSync(new URL("index.json", lib), "utf8"));
  const dids = new Set(index.templates.map((t) => t.did));
  assert.ok(index.templates.length >= 20);
  for (const t of index.templates) {
    const e = parse(readFileSync(new URL(t.file, lib), "utf8"));
    assert.equal(e.header.did, t.did);
    assert.equal(e.header.privacy_mode, "PUBLIC_ONCHAIN");
    assert.equal((await verify(e)).ok, true, t.file);
    for (const r of e.graph.relations) assert.ok(dids.has(r.target_did), `${t.file} links to missing ${r.target_did}`);
  }
  // Examples link to templates that exist.
  for (const f of ["coffee_mug.are", "armchair.are", "hydrogen_atom.are"]) {
    const e = parse(readFileSync(new URL(f, examples), "utf8"));
    for (const r of e.graph.relations) assert.ok(dids.has(r.target_did), `${f} links to missing ${r.target_did}`);
  }
});
