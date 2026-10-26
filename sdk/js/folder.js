// Folder ("unpacked") form of an .are file, for Node.js. Spec section 2.
//   mug.are.d/
//     header.json  spatial.json  graph.json  mind_sense.json  timeline.json  ledger.json
//     assets/      (optional: scans, voice notes, referenced as "./assets/<file>")
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { LAYERS } from "./are.js";

/** Write each layer of `entity` to its own JSON file in `dir`. */
export function unpack(entity, dir) {
  mkdirSync(dir, { recursive: true });
  for (const layer of LAYERS) writeFileSync(join(dir, layer + ".json"), JSON.stringify(entity[layer] ?? {}, null, 2) + "\n");
  return dir;
}

/** Read a folder written by unpack() back into one entity. Unknown top-level files are ignored. */
export function pack(dir) {
  const entity = {};
  for (const layer of LAYERS) {
    const file = join(dir, layer + ".json");
    if (!existsSync(file)) throw new Error(`${dir} has no ${layer}.json`);
    entity[layer] = JSON.parse(readFileSync(file, "utf8"));
  }
  return entity;
}
