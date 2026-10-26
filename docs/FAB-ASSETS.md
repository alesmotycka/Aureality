# Fab / Megascans assets in Aureality

Status: proposal (issue: "Use Epic/Fab library assets"). Owner: Engineering + Brand.

The company account has an Epic Games / Fab library of about 536 items: Quixel Megascans
surfaces and packs, 3D props and environments, materials, VFX, animations, and Unreal plugins.
This page says what we may do with them, how they get into the web app, and what the first
demo uses.

## 1. Licence, in plain words

Not legal advice. Check the licence badge on each item in Fab (My Library → **Licenses** filter)
before using it, because items in one library can carry different licences.

| Licence on the item | Can we use it in Aureality (web app, any engine)? | Notes |
|---|---|---|
| **Fab Standard License** (Personal or Professional) | Yes, also commercially | Use with any tool, not only Unreal. May modify it and ship it *incorporated in our product*. May share with collaborators via a private repo. |
| **Megascans claimed on Fab in 2024** (free that year) | Yes, same as Fab Standard | Only items added to the Fab library count. Megascans that were only downloaded through Bridge stay under the old Unreal-only licence. |
| **Epic Content / "UE-only" licence** (old Unreal Marketplace items) | No, not in the web app | Only inside Unreal Engine projects. |
| **CC BY** | Yes | Credit the author on the About/credits page. |
| **Reference-only tier** | No | No source files. |
| Unreal **code plugins** (Inventory System, Surface Forge, Attribute Manager…) | Not applicable | They are Unreal C++/Blueprint code and do not run in a browser. |

What we must **not** do, under every licence above:

- **No standalone redistribution.** Never offer a raw Fab texture or mesh for download, never
  put it in a public repo or on a public page as a file, and never embed it in an exported
  `.are` file. Exports reference it by id (section 4).
- **Not in git.** Asset files stay out of this repo (it may become public; the `.are` spec and code are open).
  Only small manifests with ids, names and licence go into git.
- **Keep it inside the app.** Serve assets only to the Aureality app from our own server (the NAS),
  not as an open file host. Browsers can always see what they download, so serve compressed,
  app-ready versions (KTX2 textures, optimised GLB), not the original source packs.
- **AI use: check before relying on it.** We were not able to read the full binding EULA from here
  (the public summary does not mention AI). Before we use Fab assets as a training set or as
  reference images sent to the vision model, read the full Fab EULA section on AI/ML. Showing them
  in the 3D view needs no AI clause.

Sources: [Fab licence summary](https://www.fab.com/cla),
[CG Channel on free Megascans in 2024](https://www.cgchannel.com/2024/10/epic-games-has-made-megascans-free-to-all-but-only-until-the-end-of-2024/),
[80.lv: Megascans no longer free after 2024](https://80.lv/articles/megascans-no-longer-free-after-2024/).

## 2. What the assets are good for

1. **Realistic surfaces in the 3D room.** Floors, walls, wood, fabric, leather, metal, glass
   from Megascans surfaces, applied to the box-shaped room and objects the prototype builds today.
   This is the biggest visual jump for the least work.
2. **Demo rooms.** A furnished sample apartment for the landing page and the first-run
   tour, so people see the magic moment before scanning their own home.
3. **Stand-in models.** When the app recognises "armchair", it can show a real chair model
   scaled to the measured box instead of a grey cube.
4. **Material look-up.** A `.are` object says `materials: [{ "name": "oak" }]`; the app picks
   the matching surface for the 3D view.

Not useful for the web app: VFX (Niagara), Unreal game systems and templates, most
outdoor/fantasy environments (Iceland, Lava Field, Dragon Cave…), unless for marketing renders
made in Unreal itself, which the Standard licence allows.

## 3. Pipeline

```
Fab library (company workstation)
   │  1. download only the picked items (Fab web or Fab in Epic launcher, format: FBX/GLB + textures)
   ▼
fab-source/<fab-id>/                      (source, never leaves our own machines)
   │  2. convert (script, Node + gltf-transform + KTX-Software)
   │     textures → KTX2 (Basis UASTC for normal maps, ETC1S for colour), max 2048 px, 1024 px mobile tier
   │     meshes   → GLB, meshopt-compressed, LOD0 + LOD1, metres, y-up
   │     Megascans packed ORM maps → glTF metallicRoughness + occlusion
   ▼
<data dir>/assets/<fab-id>/                (self-hosted server)
   material.json  textures/*.ktx2  model.glb  thumb.webp
   │  3. served by server/server.js at /assets/… only to the app (same origin, no directory listing,
   │     access code when public)
   ▼
web app (three.js): KTX2Loader + GLTFLoader + MeshoptDecoder, MeshStandardMaterial
```

No Unreal Engine is needed for Megascans surfaces and most 3D props: Fab gives the textures and
FBX/GLB directly. Unreal is only needed for items sold as `.uasset`-only (export via
File → Export → glTF), which we skip at first.

### Material record (`material.json`, stored on the NAS)

```json
{
  "id": "fab:megascans/oak-floor-xyz",
  "name": "Oak floor, oiled",
  "match": ["oak", "wood floor", "parquet", "wikidata:Q2091629"],
  "license": "Fab-Standard",
  "source": { "fab": "<fab listing url>", "claimed": "2024-12" },
  "pbr": {
    "baseColor": "textures/albedo.ktx2",
    "normal": "textures/normal.ktx2",
    "orm": "textures/orm.ktx2",
    "metalness": 0,
    "tileSize": [2, 2]
  }
}
```

`tileSize` is in metres, so a 2 × 2 m scan tiles at real scale on a floor measured in metres.

## 4. How it maps to `.are`

`.are` stays engine-neutral and open, and Fab files are never put inside it.

- `materials[].name` and `materials[].sameAs` (for example `wikidata:Q2091629` for oak) are
  what the app matches against `match` in `material.json`. The `.are` file needs nothing
  Fab-specific.
- The chosen look can be saved as `materials[].appearance` (proposed for `.are` 0.3) with a
  reference, not a copy: `{ "ref": "fab:megascans/oak-floor-xyz", "provider": "aureality" }`.
  A reader that does not have that asset falls back to `color`.
- Stand-in models go in `geometry` with an id, never a file a user can carry away:
  `{ "ref": "fab:<id>", "role": "stand-in", "lod": 1 }`. Only geometry the user captured
  themselves gets an `href`.
- A packed `.are` (0.3 ZIP) must never include Fab files. The exporter strips `fab:` refs to
  `color` + `dimensions`.

## 5. First demo (proposed)

Small, home-themed, about 300–500 MB of downloads in total:

| Use | What to pick from the library |
|---|---|
| Floor | 1 Megascans wood floor or parquet surface |
| Walls | 1 painted plaster / concrete surface |
| Sofa / armchair | 1 fabric + 1 leather surface |
| Table / shelf | 1 oak or beech wood surface |
| Accent | 1 brushed metal surface |
| Stand-in model | 1 chair or shelf prop from the 3D section with Fab Standard licence |

The "Browse Quixel Megascans" item in the library suggests the whole Megascans library was
claimed in 2024, so these surfaces should be available without buying anything. The visible packs
(Meadow, Iceland, Castle Ruins, Lava Field, Sandstone Desert…) are outdoor and are not needed now.

Done when: the prototype's sample room shows real wood floor and plaster walls, the armchair
uses fabric/leather from its `.are` materials, it runs smoothly on a mid-range phone, and the
total download for the room is under 15 MB.

## 6. Steps

1. CEO: confirm the picks (or let Engineering pick from the Megascans search) and approve the downloads.
2. Engineering: check the licence badge of each pick, write `tools/fab-convert` (Node script),
   convert on the workstation, copy to the self-hosted server.
3. Engineering: `/assets` route in `server.js` and material loading in the web app, behind a
   "realistic materials" switch with the flat colours as fallback.
4. Product: add `appearance` and `geometry.ref` to the `.are` 0.3 draft.
5. Brand: credits page entry ("Some materials © Quixel / Epic Games, used under the Fab licence").
