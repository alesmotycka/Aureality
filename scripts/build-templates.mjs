// Rebuilds templates/: a starter library of public .are templates (elements, materials, products) that private objects link to.
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
  ["rubber", "Rubber", 920, ["C", "H"], "Natural rubber, used for tyres and seals."],
];
for (const [slug, name, density, made, summary] of MATERIALS) {
  const m = pub(`did:are:public:material:${slug}`, name, -6);
  m.spatial.physical_properties = density ? { density_kg_m3: density } : {};
  for (const sym of made) relate(m, "made_of", `did:are:public:element:${sym}`);
  m.mind_sense = { ontology_tags: ["material"], summary, human_notes: [] };
  await save("material", slug, m);
}

// Products: everyday things people sort when moving or decluttering. Values are typical, not exact:
// a scan or the owner's own numbers always win over the template.
const M = (slug) => `did:are:public:material:${slug}`;
const PRODUCTS = [
  ["coffee-mug", "Coffee mug", -1, ["kitchenware"], [0.09, 0.09, 0.1], 0.35, ["porcelain"], "A mug for hot drinks, about 300 ml."],
  ["drinking-glass", "Drinking glass", -1, ["kitchenware"], [0.08, 0.08, 0.12], 0.25, ["soda-lime-glass"], "A plain tumbler, about 250 ml."],
  ["glass-bottle", "Glass bottle", -1, ["container"], [0.07, 0.07, 0.3], 0.4, ["soda-lime-glass"], "A 0.7 l bottle. Glass recycling."],
  ["pet-bottle", "Plastic bottle", -1, ["container"], [0.07, 0.07, 0.25], 0.03, ["pet-plastic"], "A 1 l PET bottle. Plastic recycling."],
  ["paperback-book", "Paperback book", -1, ["book"], [0.13, 0.02, 0.2], 0.3, ["paper"], "A soft-cover book."],
  ["hardcover-book", "Hardcover book", -1, ["book"], [0.16, 0.03, 0.24], 0.6, ["paper", "cotton"], "A hard-cover book with a cloth spine."],
  ["t-shirt", "T-shirt", -1, ["clothing"], [0.5, 0.01, 0.7], 0.18, ["cotton"], "A cotton T-shirt."],
  ["smartphone", "Smartphone", -1, ["electronics"], [0.072, 0.008, 0.15], 0.19, ["aluminium", "soda-lime-glass", "copper"], "A phone. Contains a lithium battery: take it to e-waste collection."],
  ["laptop", "Laptop", -1, ["electronics"], [0.32, 0.22, 0.017], 1.5, ["aluminium", "copper", "pet-plastic"], "A laptop computer. Contains a lithium battery: take it to e-waste collection."],
  ["dining-chair", "Dining chair", 0, ["furniture", "seating"], [0.45, 0.5, 0.85], 5, ["beech-wood"], "A wooden chair for a table."],
  ["armchair", "Armchair", 0, ["furniture", "seating"], [0.85, 0.85, 0.9], 15, ["beech-wood", "leather"], "An upholstered chair with arms."],
  ["sofa", "Sofa", 0, ["furniture", "seating"], [2, 0.9, 0.85], 50, ["beech-wood", "cotton", "steel"], "A three-seat sofa."],
  ["bookshelf", "Bookshelf", 0, ["furniture", "storage"], [0.8, 0.3, 1.8], 30, ["oak-wood"], "Open shelves for books."],
  ["wardrobe", "Wardrobe", 0, ["furniture", "storage"], [1, 0.6, 2], 70, ["beech-wood", "steel"], "A cupboard for clothes."],
  ["bicycle", "Bicycle", 0, ["vehicle"], [1.75, 0.6, 1.05], 13, ["steel", "aluminium", "rubber"], "An adult city bike."],
];
for (const [slug, name, scale, tags, dims, mass, mats, summary] of PRODUCTS) {
  const p = pub(`did:are:public:product:${slug}`, name, scale);
  p.spatial.physical_properties = { typical: true, mass_kg: mass, dimensions_m: dims };
  for (const m of mats) relate(p, "made_of", M(m));
  p.mind_sense = { ontology_tags: ["product", ...tags], summary, human_notes: [] };
  await save("product", slug, p);
}

writeFileSync(new URL("index.json", root), JSON.stringify({ version: "0.1.0", license: "CC0-1.0", templates: index }, null, 2) + "\n");
console.log(`templates rebuilt: ${index.length}`);
