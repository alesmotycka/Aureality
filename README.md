# Aureality
Mapping and sorting reality — The Aureality Ecosystem &amp; .are (Aureality Reality Entity) universal file format from atom to universe.

# 🌌 Aureality & The `.are` Universal Reality Protocol

> **An Operating System for Sorting Reality — From Atom to Universe.**

**Aureality** is a multi-layered ecosystem designed to map, organize, filter, and connect physical, digital, cognitive, and sensory reality. 

At the core of the ecosystem is **`.are` (Aureality Reality Entity)** — a universal, scale-invariant digital file format capable of storing complete multi-dimensional information about *any* object in existence, from a single subatomic particle ($10^{-15}\text{m}$) to an everyday physical item ($10^{0}\text{m}$) to the entire observable universe ($10^{26}\text{m}$).

---

## 🧬 The `.are` File Format Specification (v0.1)

Every `.are` file acts as a **Fractal, Hierarchical Graph Container** with lazy-loading pointers and multi-scale Level of Detail (LoD). It operates in two sovereign modes:
1. **Local-First Mode ("Keep it for yourself"):** Zero-knowledge, locally encrypted storage for your personal spaces, inventory, and thoughts.
2. **On-Chain Mode ("Share on a blockchain"):** Cryptographically anchored via Merkle roots, DIDs, and decentralized storage (IPFS/Arweave) for public verification, collaborative science, and digital-twin ownership.

### The 6 Universal Layers of an `.are` Container:
* **Layer 1: Universal Header & Identity (`header.json`)** — Global DID (`did:are:...`), Scale Index ($10^n$ meters), Privacy Flag (`LOCAL_PRIVATE` | `ENCRYPTED_SHARED` | `PUBLIC_ONCHAIN`), and Merkle Root hash.
* **Layer 2: Multi-Scale Spatial & Physical Layer (`spatial/`)** — Quantum/atomic composition, 3D geometry (meshes, Gaussian splats, point clouds), physics, and cosmic coordinates.
* **Layer 3: Relational & Nested Graph (`graph/`)** — Bottom-up composition links (what it is made of) and top-down context links (where it lives).
* **Layer 4: Semantic, Cognitive & Sensory Layer (`mind_sense/`)** — Ontology, human notes, memories, audio/visual "auras", and AI vector embeddings.
* **Layer 5: Temporal & State History (`timeline/`)** — 4D Git-like commit log tracking physical movement, state transitions, and evolution over time.
* **Layer 6: Sovereign Vault & Ledger Layer (`ledger/`)** — Local AES-256/ZK encryption keys and optional blockchain smart-contract provenance.

---

## 🌐 The 4 Pillars of the Aureality Ecosystem

1. **Aureality Space (Physical & Spatial):** Scan, index, and organize physical environments in 3D/AR using `.are` nodes.
2. **Aureality Mind (Cognitive & Digital):** A second-brain engine that turns chaotic thoughts and digital captures into structured `.are` entities.
3. **Aureality Sense (Sensory & Attention):** Real-time contextual filtering of audio, visual, and digital noise based on your surroundings.
4. **Aureality Flow (Action & Progression):** Gamified real-world quests that bridge digital planning with physical action.

---

## 🚀 Quick start

Requires Node.js 20 or newer. No dependencies to install.

```bash
node sdk/js/cli.js verify examples/armchair.are     # structure + merkle root + history chain
node sdk/js/cli.js hash examples/coffee_mug.are     # each layer's hash and the root
node sdk/js/cli.js share examples/armchair.are ledger timeline   # verifiable copy for a buyer
export ARE_KEY=$(node sdk/js/cli.js keygen)
node sdk/js/cli.js encrypt examples/armchair.are > private.are  # hides notes, place, history
node sdk/js/cli.js unpack examples/armchair.are armchair.are.d   # one JSON file per layer
python3 sdk/python/are_sdk.py examples/*.are templates/*/*.are   # same hashes in Python
npm test
```

```js
import { createEntity, nest, relate, addNote, commit, transfer, disclose } from "./sdk/js/are.js";

const mug = createEntity({ did: "did:are:local:mug-1", name: "Coffee mug", scale_exponent: -1 });
relate(mug, "made_of", "did:are:public:material:porcelain");   // atomic depth for free
addNote(mug, { text: "Sell at the flea market", audio_uri: "local://voice/mug.m4a" });
mug.mind_sense.sort_plan = "SELL";
await commit(mug, "created");                                    // seals the merkle root, starts the history
await transfer(mug, { to: "did:are:person:new-owner" });          // history travels with the object
```

**Reality Explorer:** run `python3 -m http.server` in this folder and open
<http://localhost:8000/viewer/>. Slide from an atom to the universe, follow links (mug → porcelain → oxygen), open your own `.are` file, and see a buyer's view.

## 📁 What's here

| Path | What |
|---|---|
| [`spec/RFC-0001-ARE-Format.md`](spec/RFC-0001-ARE-Format.md) | The v0.1 specification: six layers, hashing, privacy modes, sharing |
| [`spec/schema.are.json`](spec/schema.are.json) | JSON Schema (draft 2020-12) |
| [`examples/`](examples/) | Hydrogen atom, coffee mug, armchair (+ buyer's view), observable universe |
| [`templates/`](templates/) | Public templates your objects link to: 10 elements, 12 materials |
| [`sdk/js/`](sdk/js/) | Zero-dependency JavaScript SDK and `are` command-line tool (incl. encryption, folder form) |
| [`sdk/python/`](sdk/python/) | Python SDK, standard library only, same hashes as JavaScript |
| [`viewer/`](viewer/) | Reality Explorer with the scale slider |

## 🗺️ Repository Roadmap
- [x] Initial Concept & 6-Layer `.are` Architecture Specification
- [x] v0.1 JSON Schema Definition (`spec/schema.are.json`)
- [x] Reference `.are` Examples (atom, material, object, universe)
- [x] Open-Source `.are` SDK & CLI (JavaScript): create, seal, verify, history, transfer, selective sharing
- [x] Reality Explorer with the "Reality Scale Slider"
- [x] Packer/Unpacker for the folder form, Python SDK
- [x] Encryption envelope (AES-256-GCM, key or passphrase) for `LOCAL_PRIVATE` and `ENCRYPTED_SHARED`
- [x] Starter public template library (elements, materials) under `did:are:public:`
- [ ] Product templates and key sharing between people
- [ ] Local Vault & optional On-Chain Merkle Anchor Prototype
- [ ] Lawyer review of the patent promise, media type registration

### Coming to the Aureality app
- Voice notes pinned to the objects you tap
- Keep / Sell / Donate / Repair / Recycle plans on every object, and hand an object's `.are` file to its buyer
- Object history: moved, repaired, sold
- Decluttering quests ("clear one shelf") with a progress score
- Private / shared / public switch on every object

---

## 📜 License & Authorship
Created by **Aleš Motyčka** (@alesmotycka).  
Code is licensed under the **Apache License 2.0**, the specification under CC BY 4.0, and the schema and examples under CC0. See [LICENSING.md](LICENSING.md) and the [patent promise](PATENTS.md).
