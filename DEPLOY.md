# Deploy the landing page on Cloudflare (gujjuwithjp.sarvmedia.com)

The page is plain static files (`site/`), so Cloudflare only has to serve them. No server code.

Use **one** of the two options.

## Option A: Worker from the command line (uses `wrangler.jsonc` in this folder)

Needs Node.js on your computer, and `sarvmedia.com` must be a domain in your Cloudflare account.

1. Unzip `webinar-site.zip`. You get a folder with `site/` and `wrangler.jsonc` in it. Open a terminal in that folder.
2. `npx wrangler login` (a browser window opens; allow access).
3. `npx wrangler deploy`
   This creates the Worker **gujju-webinar**, uploads `site/`, and attaches **gujjuwithjp.sarvmedia.com** to it
   (Cloudflare adds the DNS record and HTTPS certificate by itself; give it a few minutes).
4. Later updates: replace the files in `site/` and run `npx wrangler deploy` again.

## Option B: No command line (Cloudflare dashboard, drag and drop)

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Upload assets**.
2. Project name: `gujju-webinar` → drag the **`site` folder** in → **Deploy**.
   You get a test address like `gujju-webinar.pages.dev`.
3. In the project → **Custom domains → Set up a custom domain** → `gujjuwithjp.sarvmedia.com` → follow the prompts.
   - If `sarvmedia.com` is on Cloudflare, it adds the DNS record for you.
   - If not, add a **CNAME** record `gujjuwithjp` → `gujju-webinar.pages.dev` at your DNS provider.
4. Later updates: project → **Create deployment** → drag the new `site` folder in.

## After it's live

- Open **https://gujjuwithjp.sarvmedia.com/** on your phone: page loads, Jay's video plays, the form shows.
- Razorpay → **Account & Settings → Website and app details**: add `https://gujjuwithjp.sarvmedia.com`.
- Nothing changes in the Apps Script; the booking form already points at it.
