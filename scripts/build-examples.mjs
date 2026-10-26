// Rebuilds examples/*.are with real hashes. Run: node scripts/build-examples.mjs
import { writeFileSync } from "node:fs";
import { createEntity, nest, relate, addNote, commit, disclose, stringify } from "../sdk/js/are.js";

const out = new URL("../examples/", import.meta.url);
const save = (name, e) => writeFileSync(new URL(name, out), stringify(e));
const T = "2026-10-26T09:00:00.000Z";

// Atomic scale: one isotope, linked to the element template in templates/.
const hydrogen = createEntity({ did: "did:are:public:element:H-1", name: "Hydrogen-1 atom (protium)",
  scale_exponent: -10, privacy_mode: "PUBLIC_ONCHAIN", created_at: T });
hydrogen.spatial.physical_properties = { mass_kg: 1.6735575e-27, dimensions_m: [1.06e-10, 1.06e-10, 1.06e-10],
  quantum_atomic_state: { atomic_number: 1, protons: 1, neutrons: 0, electrons: 1, electron_configuration: "1s1" } };
hydrogen.mind_sense = { ontology_tags: ["element", "atom", "hydrogen"], summary: "The most abundant element in the universe.",
  human_notes: [], identifiers: { wikidata: "Q556" } };
relate(hydrogen, "instance_of", "did:are:public:element:H");
hydrogen.ledger.license = "CC0-1.0";
await commit(hydrogen, "created", { timestamp: T });
save("hydrogen_atom.are", hydrogen);

// Human scale, private: an everyday object at home.
const desk = createEntity({ did: "did:are:local:desk-01", name: "Office desk", scale_exponent: 0, created_at: T });
const mug = createEntity({ did: "did:are:local:mug-9942a", name: "Favourite studio coffee mug", scale_exponent: -1, created_at: T });
nest(desk, mug);
mug.spatial.coordinates.position = [0.35, 0.74, 0.12];
mug.spatial.physical_properties = { mass_kg: 0.34, dimensions_m: [0.09, 0.09, 0.11], condition: { grade: "good" } };
mug.spatial.geometry_refs = [{ lod: 0, format: "GAUSSIAN_SPLAT", uri: "local://scans/mug-9942a.splat" }];
relate(mug, "made_of", "did:are:public:material:porcelain");
mug.mind_sense = { ontology_tags: ["kitchenware", "daily-driver"], summary: "White porcelain mug, 330 ml.",
  human_notes: [{ text: "Bought at a market in Prague.", created_at: T }], sort_plan: "KEEP",
  sensory_aura: { attention_priority: 0.2, ambient_profile: "deep_focus" } };
await commit(mug, "created", { timestamp: T });
save("coffee_mug.are", mug);

// Human scale, sorting a home: an armchair the owner plans to sell, with its life history.
const armchair = createEntity({ did: "did:are:local:armchair-7f3c", name: "Mid-century armchair", scale_exponent: 0,
  parent_did: "did:are:local:living-room", created_at: "2026-10-20T18:00:00.000Z" });
armchair.spatial.coordinates.position = [-3.9, 0, 1.3];
armchair.spatial.physical_properties = { mass_kg: 14, dimensions_m: [0.85, 0.85, 0.9],
  materials: [{ part: "seat", did: "did:are:public:material:leather" }, { part: "frame", did: "did:are:public:material:beech-wood" }],
  condition: { grade: "worn", note: "Seat leather cracked on the left armrest." } };
relate(armchair, "made_of", "did:are:public:material:leather");
relate(armchair, "made_of", "did:are:public:material:beech-wood");
armchair.mind_sense = { ontology_tags: ["furniture", "seating", "mid-century"], summary: "Leather armchair with a beech frame, 1960s style.",
  human_notes: [], sort_plan: "SELL", tasks: [{ text: "Take three photos for the listing", done: false }],
  ai: { context: "Mid-century leather armchairs in worn condition sell for about 250–400 EUR.", confidence: 0.6 } };
addNote(armchair, { text: "Grandma's chair. Sell only to someone who will use it.", audio_uri: "local://voice/armchair-7f3c-1.m4a",
  created_at: "2026-10-20T18:05:00.000Z" });
armchair.ledger.value = { amount: 350, currency: "EUR", basis: "estimate" };
armchair.ledger.asking_price = { amount: 320, currency: "EUR" };
await commit(armchair, "created", { timestamp: "2026-10-20T18:00:00.000Z" });
armchair.spatial.coordinates.position = [-3.9, 0, 2.1];
await commit(armchair, "moved", { timestamp: "2026-10-22T10:00:00.000Z", note: "Moved next to the window." });
await commit(armchair, "repaired", { timestamp: "2026-10-24T15:30:00.000Z", note: "Tightened the left leg." });
save("armchair.are", armchair);

// The same armchair as the owner would share it with a buyer: price and history only, no notes or location, still verifiable.
save("armchair.shared.are", await disclose(armchair, ["ledger", "timeline"]));

// Cosmic scale: the root container.
const universe = createEntity({ did: "did:are:public:cosmos:observable-universe", name: "The observable universe",
  scale_exponent: 26, privacy_mode: "PUBLIC_ONCHAIN", created_at: T });
universe.spatial.coordinates = { reference_frame: "comoving", position: [0, 0, 0], rotation_quaternion: [0, 0, 0, 1] };
universe.spatial.physical_properties = { mass_kg: 1.5e53, dimensions_m: [8.8e26, 8.8e26, 8.8e26] };
universe.graph.children_dids = ["did:are:public:cosmos:laniakea-supercluster"];
universe.mind_sense = { ontology_tags: ["cosmos", "root-container"], summary: "Root .are container for all matter, energy, space and time we can observe.",
  human_notes: [] };
universe.ledger.license = "CC0-1.0";
await commit(universe, "created", { timestamp: T });
save("observable_universe.are", universe);
console.log("examples rebuilt");
