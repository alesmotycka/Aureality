# Aureality roadmap

The core experience is **phone-first**: you map your surroundings with your phone, and tapping an object in a photo gives you AI context about it. Everything else (3D model, sorting, map, inventory) is built around that.

## Phase 0: web prototype (done)

`web/index.html`. It proves the flow end to end: capture, a rough 3D point cloud, tap for AI context, an inventory you can sort and rearrange, and a floor map.

## Phase 1: real capture on the phone

- **App shell:** a PWA first (it reuses the prototype and installs from the browser), with React Native + Expo as the step after if we need native AR.
- **Real depth and pose:** on iPhone with LiDAR, use ARKit scene depth and camera poses. Elsewhere, run a learned monocular depth model (Depth Anything V2 small via ONNX Runtime Web / transformers.js), or do it on the server.
- **Tap for AI context:** send the crop around the tap plus the full frame to Claude (vision), and get back structured data: name, category, box, size, value, care and resale tips. The prototype already uses this prompt shape.
- **AI on self-hosted installs:** done in `server/server.js` (Claude API with the owner's key, access code, per-visitor limit).
- **Segmentation:** use SAM / MobileSAM on the tap point to get an exact object mask instead of a bounding box.

## Phase 2: backend reconstruction

- Upload a walk-through video, then a job pipeline: frame selection, then camera poses (COLMAP / GLOMAP), then Gaussian splatting (gsplat / nerfstudio) or a mesh.
- Object detection over the whole scan (Grounding DINO or a vision LLM), projected into 3D and merged across frames.
- Stack: Python worker (GPU) + a queue, object storage for media, Postgres for the inventory.
- The viewer renders splats in the browser (e.g. `@mkkellogg/gaussian-splats-3d`) and keeps the prototype's sort/map/inspect UI.

## Phase 3: product

- Accounts, sync across devices, sharing a space with family or movers.
- Several spaces per user (apartment, cellar, office).
- Exports: inventory CSV, moving list, insurance list, resale listings.
- "What changed" between two scans of the same room.

## Open questions

- iOS-only (LiDAR) for the best scans at first, or cross-platform from day one?
- Hosted Claude API with our own key, or run AI on each user's Claude account?
- Which use case leads: moving, decluttering and resale, home insurance, or interior planning?
