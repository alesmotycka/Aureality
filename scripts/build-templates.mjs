// Rebuilds templates/: a starter library of public .are templates that private objects link to.
// Run: node scripts/build-templates.mjs
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { createEntity, relate, commit, stringify } from "../sdk/js/are.js";

const root = new URL("../templates/", import.meta.url);
rmSync(root, { recursive: true, force: true });
const T = "2026-10-26T09:00:00.000Z";
const U = 1.6605390666e-27; // kg per dalton
const index = [];

async function save(kind, slug, entity) {
  entity.ledger.license = "CC0-1.0";
  await commit(entity, "created", { timestamp: T });
  mkdirSync(new URL(kind + "/", root), { recursive: true });
  const file = `${kind}/${slug}.are`;
  writeFileSync(new URL(file, root), stringify(entity));
  index.push({ did: entity.header.did, name: entity.header.name, scale_exponent: entity.header.scale_exponent, file });
}

const pub = (did, name, scale_exponent) =>
  createEntity({ did, name, scale_exponent, privacy_mode: "PUBLIC_ONCHAIN", created_at: T });

// Elements: standard atomic weight (IUPAC, abridged).
const ELEMENTS = [
  ["H", "Hydrogen", 1, 1.008], ["C", "Carbon", 6, 12.011], ["N", "Nitrogen", 7, 14.007],
  ["O", "Oxygen", 8, 15.999], ["Na", "Sodium", 11, 22.99], ["Al", "Aluminium", 13, 26.982],
  ["Si", "Silicon", 14, 28.085], ["Ca", "Calcium", 20, 40.078], ["Fe", "Iron", 26, 55.845],
  ["Cu", "Copper", 29, 63.546],
];
for (const [sym, name, z, weight] of ELEMENTS) {
  const e = pub(`did:are:public:element:${sym}`, name, -10);
  e.spatial.physical_properties = { mass_kg: Number((weight * U).toPrecision(6)),
    quantum_atomic_state: { symbol: sym, atomic_number: z, standard_atomic_weight_u: weight } };
  e.mind_sense = { ontology_tags: ["element", "atom"], summary: `${name} (${sym}), atomic number ${z}.`, human_notes: [] };
  await save("element", sym, e);
}

// Materials: typical densities at room temperature; real samples vary.
const MATERIALS = [
  ["water", "Water", 997, ["H", "O"], "Liquid water, H2O."],
  ["porcelain", "Porcelain", 2400, ["Si", "O", "Al"], "Vitrified ceramic fired at about 1300 °C."],
  ["soda-lime-glass", "Soda-lime glass", 2500, ["Si", "O", "Na", "Ca"], "Common window and bottle glass."],
  ["steel", "Steel", 7850, ["Fe", "C"], "Iron alloyed with a little carbon."],
  ["aluminium", "Aluminium", 2700, ["Al"], "Light metal used for cans, frames and foil."],
  ["copper", "Copper", 8960, ["Cu"], "Metal used in wires and pipes."],
  ["beech-wood", "Beech wood", 720, ["C", "H", "O"], "Hard, pale wood common in European furniture."],
  ["oak-wood", "Oak wood", 750, ["C", "H", "O"], "Hard, durable wood for floors and furniture."],
  ["leather", "Leather", null, ["C", "H", "O", "N"], "Tanned animal hide, mostly collagen."],
  ["cotton", "Cotton", 1540, ["C", "H", "O"], "Plant fibre, almost pure cellulose (fibre density)."],
  ["paper", "Paper", null, ["C", "H", "O"], "Sheets of pressed cellulose fibre."],
  ["pet-plastic", "PET plastic", 1380, ["C", "H", "O"], "Polyethylene terephthalate, used for bottles (recycling code 1)."],
];
for (const [slug, name, density, made, summary] of MATERIALS) {
  const m = pub(`did:are:public:material:${slug}`, name, -6);
  m.spatial.physical_properties = density ? { density_kg_m3: density } : {};
  for (const sym of made) relate(m, "made_of", `did:are:public:element:${sym}`);
  m.mind_sense = { ontology_tags: ["material"], summary, human_notes: [] };
  await save("material", slug, m);
}

writeFileSync(new URL("index.json", root), JSON.stringify({ version: "0.1.0", license: "CC0-1.0", templates: index }, null, 2) + "\n");
console.log(`templates rebuilt: ${index.length}`);
