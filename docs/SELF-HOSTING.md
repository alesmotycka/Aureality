# Self-hosting Aureality

Aureality runs on any machine with Docker: a home NAS, a small server or a laptop. At home it is reachable on your local network, and publicly on your own domain through a Cloudflare Tunnel. No router ports have to be opened.

## 1. Get the files

```sh
git clone https://github.com/alesmotycka/Aureality.git
cd Aureality
cp .env.example .env
```

On a NAS without git, download the ZIP from GitHub and upload `docker-compose.yml`, `.env.example` and the `web`, `landing` and `server` folders into one folder on the NAS.

## 2. Configure

Edit `.env` (keep it private, never commit it):

- `ANTHROPIC_API_KEY`: a Claude API key from https://console.anthropic.com. Without it the app works, but the AI features stay hidden.
- `AUREALITY_ACCESS_CODE`: a code people must type once per device before using AI, so strangers cannot spend your credit. Recommended once the site is public.
- `TUNNEL_TOKEN`: only for public access (step 4).

## 3. Start it (local only first)

```sh
docker compose up -d aureality
```

Open `http://<host>:8090`, where `<host>` is the machine's address on your network. You should see the sample apartment. The landing page is at `/landing/`.

On a NAS with a Docker app, create a compose project pointing at the folder from step 1 and deploy it. Leave out the `cloudflared` service until the tunnel exists.

Without Docker: `ANTHROPIC_API_KEY=... node server/server.js` (Node 20+), then open http://localhost:8080.

## 4. Public access with a Cloudflare Tunnel

1. Add your domain to a free Cloudflare account and switch its nameservers at your registrar to the ones Cloudflare shows.
2. In Cloudflare **Zero Trust > Networks > Tunnels**, create a tunnel (connector type Cloudflared, Docker) and copy its token into `TUNNEL_TOKEN` in `.env`.
3. In the tunnel's **Public hostnames**, point your app hostname (and the landing page hostname, if you use one) to `http://aureality:8080`.
4. Run `docker compose up -d` so the `cloudflared` service starts. The tunnel shows **Healthy** in Cloudflare.

## Updating

Pull or download the new `web`, `landing` and `server` folders and run `docker compose restart`. Changes to `web` and `landing` only need a page reload.

## Notes

- A low-power machine (for example 4 cores and 8 GB RAM) is plenty for the app and the AI proxy.
- AI requests are limited to 20 per minute per visitor (`AI_REQUESTS_PER_MINUTE` changes it). Photos are only sent to the Claude API when someone asks the AI about them.
