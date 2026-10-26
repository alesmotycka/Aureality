# RFC-0001: The `.are` File Format, v0.1

Status: draft · Version 0.1.0 · Schema: [`schema.are.json`](schema.are.json) · Examples: [`../examples/`](../examples/)

An `.are` (Aureality Reality Entity) file says that something **is**. One file describes one entity, whether
it is a hydrogen atom, a coffee mug, a thought pinned to a shelf, or the observable universe. Files link to
each other, so an atom, a material, a mug, a desk, a room, a city and a galaxy form one graph.

The key words MUST, SHOULD and MAY are used as in RFC 2119.

## 1. Goals

1. **Any scale.** The same structure works from 10⁻³⁵ m to 10²⁷ m. Detail lives in linked files, not in one huge file.
2. **Keep it or share it.** By default a file is private to its owner. The owner can share it with chosen people, or publish it for everyone.
3. **Trust what you were shown.** Every file carries a hash of its contents, so a receiver can check that nothing was changed, even when parts were hidden.
4. **Objects have a life.** A file keeps a history: created, moved, repaired, sold.
5. **Easy to adopt.** Plain JSON, a small required core, and readers that keep what they don't understand.

## 2. File basics

- An `.are` file is a UTF-8 JSON document with six top-level layers: `header`, `spatial`, `graph`, `mind_sense`, `timeline`, `ledger`. All six MUST be present (an empty layer is `{}`).
- Media type: `application/vnd.aureality.are+json` (to be registered). Extension: `.are`.
- Heavy data (3D scans, voice recordings, point clouds) is **linked**, not embedded: `geometry_refs[].uri`, `human_notes[].audio_uri`. URIs MAY use `local://` (on the owner's device), `https://`, `ipfs://` or `ar://` (Arweave).
- Readers MUST keep fields they do not understand when they save a file again. Writers MAY add fields; names starting with `x_` are reserved for private extensions.
- Unpacked form: a tool MAY store a file as a folder (by convention `<name>.are.d/`) with one JSON file per layer: `header.json`, `spatial.json`, `graph.json`, `mind_sense.json`, `timeline.json`, `ledger.json`, plus an optional `assets/` folder for linked files (`"uri": "./assets/scan.splat"`). Packing the folder gives back the same file. The single-file form is the exchange format.

## 3. The six layers

### 3.1 `header`: identity

| Field | Required | Meaning |
| --- | --- | --- |
| `did` | yes | Global id, `did:are:<namespace>:<id>`. Namespaces: `local` (owner's private objects), `public` (shared templates), `person`, or any other. |
| `name` | yes | Human name. |
| `version` | yes | Format version, `0.1.x`. |
| `scale_exponent` | yes | Size order of magnitude in metres, 10ⁿ m. Atom −10, mug −1, chair 0, house 1, Earth 7, universe 26. Range −35 to 27. Apps use it to load only the zoom level on screen. |
| `privacy_mode` | yes | `LOCAL_PRIVATE`, `ENCRYPTED_SHARED` or `PUBLIC_ONCHAIN` (see 5). |
| `merkle_root` | yes | Hash over the sealed layers (see 4), or `""` before the first seal. |
| `created_at` | no | ISO 8601 time. |

### 3.2 `spatial`: where it is and what it is physically

- `coordinates`: `reference_frame` (the parent's did, or a named frame such as `root`, `WGS84`, `comoving`), `position` in metres from that frame's origin, `rotation_quaternion` `[x, y, z, w]`. Positions are always relative to the parent, which keeps numbers precise at every scale.
- `geo`: optional `lat`, `lon`, `alt_m` for things on Earth.
- `physical_properties`: `mass_kg`, `dimensions_m` `[w, d, h]`, `density_kg_m3`, `materials` (`part` + `did` + `share`), `composition` (for materials: what they are made of), `condition` (`grade`: new, like_new, good, worn, damaged, broken; `note`), `quantum_atomic_state` (free object for atomic data).
- `geometry_refs`: 3D representations by level of detail: `lod` (0 = most detailed), `format` (`USDZ`, `GLTF`, `GAUSSIAN_SPLAT`, `POINT_CLOUD`, `MESH_OBJ`, `ATOMIC_LATTICE`), `uri`, optional `sha256`.

### 3.3 `graph`: how it connects

- `parent_did`: where the entity lives (mug → desk → room → home → city → Earth). `null` for a root.
- `children_dids`: entities whose parent is this one (its parts and its contents).
- `relations`: typed links, each `{ "type", "target_did" }`:
  - `made_of`: a material or component template (mug → porcelain → silicon, oxygen)
  - `instance_of`: a product template (my phone → iPhone 16)
  - `part_of`, `near`, `replaces`, `same_as`

**Public templates.** Entities under `did:are:public:` are shared definitions anyone can link to: elements,
materials, common products. A private mug that says `made_of did:are:public:material:porcelain` gets
atomic-level depth without storing it. Templates SHOULD be `PUBLIC_ONCHAIN` and licensed `CC0-1.0`.
A starter library (10 elements, 12 materials) is in [`../templates/`](../templates/), listed in `templates/index.json`.
Ids follow `did:are:public:element:<symbol>` and `did:are:public:material:<slug>`.

### 3.4 `mind_sense`: what it means to people and to AI

- `ontology_tags`, `summary`, `identifiers` (ids in other registries: `wikidata`, `gs1`, `isbn`, …).
- `human_notes`: text or note objects `{ text, audio_uri, author, created_at }`. A voice note is a note with an `audio_uri`.
- `tasks`: `{ text, done, due }`, e.g. "Take three photos for the listing".
- `sort_plan`: what the owner plans to do with it: `KEEP`, `SELL`, `DONATE`, `REPAIR`, `RECYCLE`.
- `ai`: AI-written context `{ context, confidence 0..1, model }`. Apps SHOULD show AI text as AI text.
- `embeddings`: links to vector embeddings `{ model, uri }`.
- `sensory_aura`: `attention_priority` 0..1 and an `ambient_profile`, for apps that filter what you see or hear.

### 3.5 `timeline`: the object's life

A commit log, like git for a physical thing.

- `history`: list of commits `{ id, event, parent, root, timestamp, note? }`.
  - `event`: `created`, `moved`, `repaired`, `sold`, `donated`, `transferred`, `anchored`, or another word.
  - `parent`: id of the previous commit (`null` for the first).
  - `root`: the entity's `merkle_root` at that moment.
  - `id` = `sha256` of `"are-commit:"` + canonical JSON of the commit without `id`.
- `head_commit`: id of the last commit.

Changing any old commit breaks the chain, which a reader can detect.

### 3.6 `ledger`: ownership, value and sharing

- `owner` (did or label), `owner_pubkey`, `shared_with` (for `ENCRYPTED_SHARED`).
- `encryption_scheme`: `NONE`, `AES-256-GCM`, `ZK-SNARK-SEALED`. `PUBLIC_ONCHAIN` files MUST use `NONE`.
- `license`: SPDX id, e.g. `CC0-1.0`.
- `value`, `asking_price`, `sale_price`: `{ amount, currency (ISO 4217), basis? }`; `basis` is `estimate`, `receipt`, `appraisal` or `market`.
- `storage_cid`: where a public copy lives (`ipfs://…`, `ar://…`).
- `blockchain_anchor`: optional record that the root was written on a chain `{ chain, tx, root }`.

## 4. Hashing

All hashes are SHA-256, written `sha256:<64 lowercase hex>`.

1. **Canonical JSON** is [RFC 8785 (JCS)](https://www.rfc-editor.org/rfc/rfc8785): keys sorted, no whitespace, ECMAScript number format.
2. **Leaf hash** of a layer = `sha256("are-leaf:" + layer + ":" + JCS(layer))`, over the sealed layers in this order: `header`, `spatial`, `graph`, `mind_sense`, `ledger`.
   - The header leaf leaves out `merkle_root`. The ledger leaf leaves out `blockchain_anchor` (it records the root, so it can't be part of it).
   - The `timeline` is not a leaf: it is a log of roots.
3. **Merkle root**: pair the leaves left to right, `sha256("are-node:" + left + right)`; an odd node at the end moves up unchanged; repeat until one hash is left.

The reference SDK in [`sdk/js/are.js`](../sdk/js/are.js) is the normative implementation for v0.1. The Python SDK in
[`sdk/python/are_sdk.py`](../sdk/python/are_sdk.py) produces the same hashes; CI checks both against each other.

## 5. Privacy modes and sharing

| Mode | Who can read | Typical use |
| --- | --- | --- |
| `LOCAL_PRIVATE` (default) | Owner only. Stored on the owner's devices, encrypted at rest. | Your home, your things, your notes. |
| `ENCRYPTED_SHARED` | Owner + people in `shared_with`. | Family inventory, a buyer, an insurer. |
| `PUBLIC_ONCHAIN` | Everyone. Optionally anchored on a public chain, data on IPFS or Arweave. | Templates, open science, a public monument. |

**Encryption.** A private or shared file MAY encrypt its `spatial`, `graph`, `mind_sense` and `timeline` layers.
The header and ledger stay readable, so anyone can see what the file is and check it. An encrypted layer is a
hidden layer that also carries its ciphertext:

```json
"mind_sense": {
  "$redacted": "sha256:…leaf hash of the plaintext…",
  "$encrypted": { "alg": "AES-256-GCM", "iv": "<base64, 12 bytes>", "ciphertext": "<base64, includes the tag>",
                  "kdf": { "name": "PBKDF2-SHA256", "salt": "<base64, 16 bytes>", "iterations": 600000 } }
}
```

- Plaintext = canonical JSON of the layer. Additional authenticated data = `header.did + "|" + layer name`, so a layer can't be moved into another file.
- The key is either a random 256-bit key (no `kdf`) or derived from a passphrase with PBKDF2-SHA256 (`kdf` present).
- An encrypted `timeline` keeps `head_commit` in clear, with an empty `history` beside `$encrypted`.
- Because `$redacted` holds the leaf hash, the `merkle_root` verifies without the key, and the key holder can check that the decrypted layer is the original.
- How keys are shared between devices and people is outside v0.1.

**Selective disclosure.** To share part of a file, replace each hidden layer with `{ "$redacted": "<its leaf hash>" }`.
The `merkle_root` still verifies, so the receiver knows the visible layers are genuine and complete, without seeing
the rest. Example: [`armchair.shared.are`](../examples/armchair.shared.are) shows a buyer the price and history of
[`armchair.are`](../examples/armchair.are) but not its location or the owner's notes.

**Handing over.** When an object is sold or given away, the owner sets `ledger.owner` to the new owner and adds a
`transferred` commit. The history goes with the object, so the next owner knows what happened to it.

Blockchain anchoring is OPTIONAL. A file is complete and verifiable without any chain.

## 6. Conformance

A **valid** file passes `schema.are.json`. A **verified** file is valid, its `merkle_root` matches its content,
and its commit chain is intact. Check both with:

```
node sdk/js/cli.js verify examples/armchair.are
```

## 7. Open questions for v0.2

- Sharing keys between devices and people (`ENCRYPTED_SHARED`).
- A JSON-LD context so `.are` maps to RDF (draft exists from earlier work).
- Units other than metres for very small and very large scales.
- Registering the media type; governance of the `did:are:public:` namespace.
- Binary packing (CBOR) for large files.
- Product templates (`instance_of`), e.g. common furniture and phones.

## Licence

This specification is licensed under CC BY 4.0. The schema and examples are CC0 1.0. Code is Apache 2.0. See [`../LICENSING.md`](../LICENSING.md).
