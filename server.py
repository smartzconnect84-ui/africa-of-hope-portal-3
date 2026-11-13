"""Static SPA server for the built Vite client.

Serves the files produced by `npm run build` and falls back to `index.html` for
client-side routes, so deep links such as `/cookies` or `/term-dates` work when
opened directly or refreshed (previously they returned 404 on the static server).

Only the Python standard library is used, so the runtime image needs no extra
packages. Hashed build assets are cached immutably; HTML is always revalidated so
a new deployment is picked up immediately.
"""

import os
import posixpath
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", "3000"))
INDEX = os.path.join(ROOT, "index.html")

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".xml": "application/xml; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".pdf": "application/pdf",
    ".ics": "text/calendar; charset=utf-8",
}


class SpaHandler(SimpleHTTPRequestHandler):
    """Serve static files, with an index.html fallback for client routes."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):  # noqa: N802 (http.server naming)
        if not self._serve_spa():
            super().do_GET()

    def do_HEAD(self):  # noqa: N802 (http.server naming)
        if not self._serve_spa(head=True):
            super().do_HEAD()

    def _resolve(self, path: str):
        """Map a URL path to a file inside ROOT, or None if it escapes ROOT."""
        clean = posixpath.normpath(path).lstrip("/")
        full = os.path.abspath(os.path.join(ROOT, clean))
        if full != ROOT and not full.startswith(ROOT + os.sep):
            return None
        return full

    def _serve_spa(self, head: bool = False) -> bool:
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        if path in ("", "/"):
            return self._send(INDEX, head)
        candidate = self._resolve(path)
        if candidate and os.path.isfile(candidate):
            return self._send(candidate, head)
        # An extension-less path is a client route (e.g. /term-dates): hand it to
        # the SPA. Real missing assets keep their 404 so broken builds are visible.
        if not posixpath.splitext(path)[1]:
            return self._send(INDEX, head)
        return False

    def _send(self, full: str, head: bool = False) -> bool:
        try:
            with open(full, "rb") as handle:
                body = handle.read()
        except OSError:
            return False
        ext = os.path.splitext(full)[1].lower()
        self.send_response(200)
        self.send_header("Content-Type", CONTENT_TYPES.get(ext, "application/octet-stream"))
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        if ext == ".html":
            self.send_header("Cache-Control", "no-cache")
        elif "/assets/" in full.replace("\\", "/"):
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        else:
            self.send_header("Cache-Control", "public, max-age=3600")
        self.end_headers()
        if not head:
            self.wfile.write(body)
        return True

    def log_message(self, fmt, *args):  # keep container logs compact
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main() -> int:
    if not os.path.isfile(INDEX):
        sys.stderr.write("index.html not found next to server.py; run the client build first\n")
        return 1
    server = ThreadingHTTPServer(("0.0.0.0", PORT), SpaHandler)
    print(f"Serving {ROOT} on 0.0.0.0:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
