#!/usr/bin/env node
// .are command-line tool. Usage: node sdk/js/cli.js <command> <file.are> [options]
import { readFileSync, writeFileSync } from "node:fs";
import { parse, stringify, validate, verify, seal, layerHashes, disclose, encryptLayers, decryptLayers, generateKey, SEALED_LAYERS } from "./are.js";
import { pack, unpack } from "./folder.js";

const [cmd, file, ...rest] = process.argv.slice(2);
const help = `are — tools for .are files (v0.1)

  are validate <file>          check structure against schema v0.1
  are verify <file>            check structure, merkle_root and history chain
  are hash <file>              print each layer hash and the merkle root
  are seal <file>              recompute merkle_root and save the file
  are share <file> <layers…>   print a copy that reveals only these layers
                               (${SEALED_LAYERS.filter((l) => l !== "header").join(", ")}, timeline)
  are unpack <file> <folder>   write each layer to its own JSON file
  are pack <folder> <file>     join a folder back into one .are file
  are keygen                   print a new random key (base64)
  are encrypt <file> [layers…] print an encrypted copy (key from ARE_KEY or ARE_PASSPHRASE)
  are decrypt <file>           print the decrypted file (same key)`;

if (cmd === "keygen") { console.log(generateKey()); process.exit(0); }
if (!cmd || !file || cmd === "help") { console.log(help); process.exit(cmd ? 0 : 1); }
if (cmd === "pack") {
  if (!rest[0]) { console.error(help); process.exit(1); }
  const packed = pack(file); writeFileSync(rest[0], stringify(packed)); console.log("packed " + rest[0]); process.exit(0);
}
const entity = parse(readFileSync(file, "utf8"));
const secret = () => {
  if (process.env.ARE_KEY) return { key: process.env.ARE_KEY };
  if (process.env.ARE_PASSPHRASE) return { passphrase: process.env.ARE_PASSPHRASE };
  console.error("Set ARE_KEY (from `are keygen`) or ARE_PASSPHRASE"); process.exit(1);
};
const fail = (errors) => { for (const e of errors) console.error("  ✗ " + e); process.exit(1); };

switch (cmd) {
  case "validate": { const r = validate(entity); if (!r.valid) fail(r.errors); console.log("✓ valid .are v0.1"); break; }
  case "verify": { const r = await verify(entity); if (!r.ok) fail(r.errors); console.log("✓ verified " + r.merkle_root); break; }
  case "hash": { const h = await layerHashes(entity); for (const [k, v] of Object.entries(h)) console.log(k.padEnd(11), v);
    console.log("root".padEnd(11), (await seal(structuredClone(entity))).header.merkle_root); break; }
  case "seal": { await seal(entity); writeFileSync(file, stringify(entity)); console.log("sealed " + entity.header.merkle_root); break; }
  case "share": { process.stdout.write(stringify(await disclose(entity, rest))); break; }
  case "unpack": { if (!rest[0]) fail(["give a folder"]); unpack(entity, rest[0]); console.log("unpacked to " + rest[0]); break; }
  case "encrypt": { process.stdout.write(stringify(await encryptLayers(entity, secret(), rest.length ? rest : undefined))); break; }
  case "decrypt": {
    try { process.stdout.write(stringify(await decryptLayers(entity, secret()))); } catch (e) { fail([e.message]); }
    break;
  }
  default: console.error(help); process.exit(1);
}
