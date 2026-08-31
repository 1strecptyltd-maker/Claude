# Cheese portfolio: NAS deployment

The site exports as plain static files. It can be hosted by Synology Web Station, QNAP Web Server, Nginx, Apache or the included Docker Compose setup.

## Option 1: upload the static folder

1. Run `npm ci` and then `npm run build` on a computer with Node.js 22.13 or newer.
2. Upload everything inside `dist/client/` to the web root on the NAS.
3. Point the NAS web service or reverse proxy at that folder.

The export uses directory-style routes such as `work/index.html`, so clean URLs work without a Node.js server.

## Option 2: Docker Compose

1. Copy the complete project folder to the NAS.
2. Copy `.env.example` to `.env` and set the final public URL and contact email.
3. Run:

   ```sh
   docker compose up -d --build
   ```

4. Open `http://NAS-IP:8080`.

The production container is Nginx serving only the exported static files. It restarts after a NAS reboot.

## Update the portfolio

- Edit shared content in `app/_data/site.ts`.
- Edit page-specific content in the matching folder under `app/`.
- Replace the preview files in `public/portfolio/` with approved client assets, or update the image paths in `app/_data/site.ts`.
- Rebuild the export or Docker image after changes.

## Port and domain

- Change `8080:80` in `compose.yaml` if port 8080 is already in use.
- For HTTPS and a custom domain, point the NAS reverse proxy to `http://127.0.0.1:8080`.
- Set `NEXT_PUBLIC_SITE_URL` to the final HTTPS address before building so social metadata uses the correct domain.

## Current TrueNAS SCALE deployment

- Public URL: `https://www.firstrec.work`
- Reverse-proxy target: `http://192.168.74.200:30040`
- Container port mapping: `30040:80`
- Compose file: `compose.truenas.yaml`
- NAS deployment directory: `/mnt/SSD POOL/codexdeploy/codexdeploy/cheese-portfolio`

Build and test locally with the production URL before uploading the static export:

```sh
NEXT_PUBLIC_SITE_URL=https://www.firstrec.work npm test
```

After replacing `dist/client/` on the NAS, apply the deployment from the NAS directory:

```sh
sudo /usr/bin/docker compose -f compose.truenas.yaml up -d
```

The TrueNAS-specific Compose file mounts the prebuilt static export read-only into Nginx. It deliberately reuses the former WordPress port so the existing Nginx Proxy Manager route does not need to change.
