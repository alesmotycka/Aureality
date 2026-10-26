# The Aureality app (prototype)

Sorting reality. Capture a space with your phone (photos or a short video), get a 3D model of it, and then move, sort, map and understand everything in it. Tap any object in a photo to get AI context: what it is, its size, rough value, and what to do with it.

## Try the prototype

The first prototype is one HTML file with no build step: [`web/index.html`](../web/index.html).

- **Hosted version (with AI):** https://claude.ai/artifact/6oPjDcsHoGCe7uEUbdbsoj. AI features run on the viewer's Claude account.
- **Locally or self-hosted:** run the server below. Opening `web/index.html` as a file also works, without AI.

### Self-host (any machine with Docker)

```sh
git clone https://github.com/alesmotycka/Aureality.git
cd Aureality
cp .env.example .env   # add your Claude API key and Cloudflare Tunnel token
docker compose up -d
```

Then open `http://<host>:8090`. Step-by-step, including public access through a Cloudflare Tunnel, is in [SELF-HOSTING.md](SELF-HOSTING.md).

Self-hosted, the AI features run through [`server/server.js`](../server/server.js), a small dependency-free Node server that calls the Claude API with the key in `.env`. It also serves the landing page (`landing/`) on aureality.eu. Without a key, the AI features hide themselves.

Run it without Docker: `ANTHROPIC_API_KEY=... node server/server.js` (Node 20+), then open http://localhost:8080.

### What it does

| Area | In the prototype |
| --- | --- |
| Capture | Take a photo, upload photos, or upload a video (8 frames are sampled from it) |
| 3D model | Each capture becomes a coloured point cloud next to the floor plan |
| Objects | Tap an object for AI identification, or drag a box around it. "Find all objects with AI" tags the whole frame |
| Manipulate | Drag objects between rooms (their room updates), rotate (`R`), duplicate, remove (`Del`) |
| Sort | Organize by category, room or plan (Keep / Sell / Donate / Repair). "Sort space" lines everything up in rows |
| Map | Top-down floor map with room areas in m² |
| Ask | Ask questions about the whole inventory ("what could I sell to raise €1,000?") |
| Save and share | Save the whole space as `.are` files, open them again, or send one object with all its properties and its price (see below) |

It opens with a sample apartment (70 m², 27 objects) so there is something to explore right away. Changes are saved in the browser's local storage.

### `.are` files

The app reads and writes Aureality's open object format, `.are` v0.1 (spec: `spec/RFC-0001-ARE-Format.md`).

- **Save space** downloads `<space>.are.zip`: one `.are` file for the home, one per room (`rooms/`) and one per object (`objects/`). Rooms point to the home and objects to their room through `graph.parent_did`; positions are in metres relative to the parent.
- **Share as .are** (in an object's panel) sends that one object: size, materials (linked to the public material templates), condition, plan, notes, AI context, value and asking price. On a phone it opens the share sheet.
- **Open .are or .zip** takes a saved space (replaces the current one, with Undo) or loose object files (added to the current space).
- Every saved file is sealed with its Merkle root, and each change since the last save adds a commit to the object's timeline (`created`, `moved`, `updated`). Opening a file checks the seal and says if a file was changed after sealing.
- Fields the app does not use are kept and written back, so files from other tools pass through without losing data. App-only extras (room name, photo crop) live under `mind_sense.x_aureality`.

### Known limits

- Depth comes from a quick heuristic, not a trained model, so tagged objects can float or sit slightly off. Real depth is the first thing on the roadmap.
- Several frames from one video are placed in a fan around one point. They are not aligned to each other yet.
- There are no accounts or sync. Data lives in one browser.

## Architecture direction

See [ROADMAP.md](ROADMAP.md).

## Tech

- [three.js](https://threejs.org/) 0.147 (UMD build from jsDelivr) for the 3D scene and OrbitControls
- Plain JavaScript, no framework, no build
- Claude (through the artifact `sample` capability) for object identification and inventory questions
