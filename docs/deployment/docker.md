# Docker Deployment

Docker is an optional way to self-host CHIVE with a hardened Nginx config. It
does not change the app: the image serves the same static files (`index.html`,
`about.html`, `src/`, `vendor/`) and there is still no backend. The raw-static
deployment described in [Static hosting](static-hosting.md) remains fully
supported and is not affected.

Run it with Docker Compose from the project root:

```powershell
docker compose up --build
```

Then open <http://localhost:8080/>.

Equivalent plain Docker commands:

```powershell
docker build -t chive .
docker run --rm -p 8080:80 chive
```

The image serves all runtime assets from a single origin and ships an enforcing
local-only Content-Security-Policy (with a documented `'unsafe-eval'` exception
that D3's CSV parser requires). The policy was manually verified after a
Report-Only smoke test. For dependency changes, temporarily switch the header in
`docker/security-headers.conf` back to `Content-Security-Policy-Report-Only`,
retest in the browser console, then return it to enforcing.

For the browser storage and trust model, see
[Privacy and security](../user/privacy-security.md).
