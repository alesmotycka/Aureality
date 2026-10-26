# site/

The public website served at https://aureality.online by Cloudflare Pages.

Plain static files, no build step. Cloudflare Pages settings:

- Production branch: `main`
- Build command: *(none)*
- Build output directory: `site`

Every push to `main` that changes this folder redeploys the site. Pull requests get a preview link.
Only public content belongs here: no secrets, server addresses or private details.
