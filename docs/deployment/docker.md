# Docker Deployment

Docker is an optional way to self-host CHIVE with a hardened Nginx config. It
does not change the app: the image serves the same static files (`index.html`,
`about.html`, `src/`, `vendor/`) and adds no remote or server-side application
service. The raw-static deployment described in
[Static hosting](static-hosting.md) remains fully supported and is not affected.

| Field | Value |
|---|---|
| Audience | Deployers using the optional Docker/Nginx hosting path. |
| Source of truth | Docker build/run commands, Nginx header behavior, and Docker-specific CSP notes. |
| Update when | Dockerfile, Compose config, Nginx headers, exposed port, or runtime asset requirements change. |

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
local-only Content-Security-Policy with documented `'unsafe-eval'` and
`'wasm-unsafe-eval'` exceptions for D3 CSV parsing and SQLite-WASM compilation.
The policy was manually verified after a Report-Only smoke test. For dependency
changes, temporarily switch the header in `docker/security-headers.conf` back
to `Content-Security-Policy-Report-Only`, retest in the browser console, then
return it to enforcing.

For the browser storage and trust model, see
[Privacy and security](../user/privacy-security.md).
