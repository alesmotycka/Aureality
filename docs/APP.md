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

It opens with a sample apartment (70 m², 27 objects) so there is something to explore right away. Changes are saved in the browser's local storage.

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
