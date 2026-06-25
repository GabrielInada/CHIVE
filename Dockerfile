# CHIVE static image: serves the raw static runtime (index.html, about.html,
# src/, vendor/) through Nginx. No Node/Vite in the image; CHIVE runs unchanged
# from static files.
#
# Pinned by multi-arch manifest digest for reproducible, portable builds.
# Before bumping, re-verify the current stable/mainline tag, digest, and Nginx
# advisories on Docker Hub. A docs audit should flag stale pins separately; it
# should not change the runtime base image by itself.
FROM nginx:1.30.2-alpine@sha256:5f979dcfed4ce6461873f087e8c980d6e29b084b9e8776d9704a7e989b5f4898

# Server config and shared security-header snippet. COPY creates the snippets
# directory; the snippet must live outside conf.d/ so it is not auto-included.
COPY docker/default.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf

# Runtime assets only (matches the documented static-deploy set).
COPY index.html about.html /usr/share/nginx/html/
COPY src/ /usr/share/nginx/html/src/
COPY vendor/ /usr/share/nginx/html/vendor/

EXPOSE 80
