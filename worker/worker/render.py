"""Renders design frames (HTML from the server) to PNGs with headless Chromium.

Safety: page scripts are blocked by a Content-Security-Policy, and every
network request is refused except Google Fonts and the hosts the server
listed (the shop's own media addresses).
"""

from __future__ import annotations

import os
import re
from typing import Any, Callable
from urllib.parse import urlparse

# Local development only: the stand-in for Boutiqly serves files over http,
# so the frame is served over http too (no mixed-content blocking).
ALLOW_HTTP = os.environ.get("RENDER_ALLOW_HTTP") == "1"
FRAME_URL = "http://frame.render.local/" if ALLOW_HTTP else "https://frame.render.local/"
FONT_HOSTS = {"fonts.googleapis.com", "fonts.gstatic.com"}
MAX_SIDE = 2400
WAIT_MS = 15_000


def csp(allowed_hosts: list[str]) -> str:
    schemes = ["https", "http"] if ALLOW_HTTP else ["https"]
    imgs = " ".join(f"{s}://{h}" for h in allowed_hosts for s in schemes)
    return (
        "default-src 'none'; script-src 'none'; "
        f"img-src data: {imgs}; "
        "style-src 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src https://fonts.gstatic.com https://fonts.render.local data:"
    )


# Google Fonts files fetched once per worker. The worker fetches them itself
# (with a time limit) so a slow font host can't stall a render: Chromium
# waits for fonts before every screenshot.
_font_cache: dict[str, tuple[str, bytes]] = {}


def _fetch_font(url: str, user_agent: str) -> tuple[str, bytes] | None:
    import urllib.request

    if url in _font_cache:
        return _font_cache[url]
    try:
        req = urllib.request.Request(url, headers={"User-Agent": user_agent})
        with urllib.request.urlopen(req, timeout=10) as res:  # noqa: S310 - Google Fonts only
            item = (res.headers.get("Content-Type", "application/octet-stream"), res.read(5 * 1024 * 1024))
    except Exception as exc:  # noqa: BLE001
        print(f"Font not loaded ({exc}); the fallback font is used", flush=True)
        return None
    if len(_font_cache) < 500:
        _font_cache[url] = item
    return item


UPLOADED_FONT_HOST = "fonts.render.local"
FONT_MIME = {"woff2": "font/woff2", "woff": "font/woff", "truetype": "font/ttf", "opentype": "font/otf"}
UUID = re.compile(r"^[0-9a-f-]{36}$", re.I)

# Loads one of the shop's uploaded fonts: (format, bytes) or None.
FontLoader = Callable[[str], "tuple[str, bytes] | None"]


def db_font_loader(conn, brand_id: str | None) -> FontLoader:
    def load(font_id: str):
        if not brand_id or not UUID.match(font_id):
            return None
        row = conn.execute(
            "SELECT format, data FROM brand_fonts WHERE id = %s AND brand_id = %s", (font_id, brand_id)
        ).fetchone()
        return (row[0], bytes(row[1])) if row else None

    return load


def _router(doc: str, allowed: set[str], allowed_hosts: list[str], blocked: list[str], load_font: FontLoader | None = None):
    def route(r) -> None:
        url = r.request.url
        parsed = urlparse(url)
        if parsed.scheme == "https" and parsed.netloc == UPLOADED_FONT_HOST:
            font_id = parsed.path.strip("/")
            try:
                got = load_font(font_id) if load_font else None
            except Exception as exc:  # noqa: BLE001
                print(f"Uploaded font {font_id} not loaded: {exc}", flush=True)
                got = None
            if got is None:
                blocked.append(url)
                r.abort()
            else:
                r.fulfill(status=200, content_type=FONT_MIME.get(got[0], "application/octet-stream"), body=got[1])
            return
        if parsed.scheme == "https" and parsed.netloc in FONT_HOSTS:
            got = _fetch_font(url, r.request.headers.get("user-agent", "Mozilla/5.0"))
            if got is None:
                r.abort()
            else:
                r.fulfill(status=200, content_type=got[0], body=got[1], headers={"Access-Control-Allow-Origin": "*"})
            return
        if url == FRAME_URL:
            r.fulfill(
                status=200,
                content_type="text/html; charset=utf-8",
                headers={"Content-Security-Policy": csp(allowed_hosts)},
                body=doc,
            )
            return
        scheme_ok = parsed.scheme == "https" or (ALLOW_HTTP and parsed.scheme == "http")
        if scheme_ok and parsed.netloc in allowed:
            r.continue_()
        else:
            blocked.append(url)
            r.abort()

    return route


def render_frames(
    docs: list[str], width: int, height: int, allowed_hosts: list[str], load_font: FontLoader | None = None
) -> tuple[list[bytes], list[str]]:
    """Returns (png bytes per frame, urls that were blocked)."""
    from playwright.sync_api import TimeoutError as PlaywrightTimeout
    from playwright.sync_api import sync_playwright

    if not (0 < width <= MAX_SIDE and 0 < height <= MAX_SIDE):
        raise ValueError("Frame size out of range")
    allowed = set(allowed_hosts) | FONT_HOSTS
    blocked: list[str] = []
    slow: list[str] = []
    pngs: list[bytes] = []
    with sync_playwright() as p:
        # Local development only: let the frame load files from localhost.
        args = ["--disable-features=BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessRespectPreflightResults,LocalNetworkAccessChecks"] if ALLOW_HTTP else []
        browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH") or None, args=args)
        try:
            context = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=1)
            for doc in docs:
                page = context.new_page()
                page.route("**/*", _router(doc, allowed, allowed_hosts, blocked, load_font))
                page.goto(FRAME_URL, wait_until="domcontentloaded", timeout=30_000)
                # Fonts and photos loaded before the picture is taken, with a
                # time limit each so a slow host can't hang the worker.
                try:
                    page.wait_for_load_state("load", timeout=WAIT_MS)
                except PlaywrightTimeout:
                    slow.append("page")
                done = page.evaluate(
                    f"""Promise.race([
                      Promise.all([
                        document.fonts.ready,
                        ...[...document.images].map(i => i.complete ? 1 : new Promise(r => {{ i.onload = i.onerror = r; }}))
                      ]).then(() => true),
                      new Promise(r => setTimeout(() => r(false), {WAIT_MS}))
                    ])"""
                )
                if not done:
                    slow.append("fonts or images")
                pngs.append(page.screenshot(type="png", clip={"x": 0, "y": 0, "width": width, "height": height}))
                page.close()
            context.close()
        finally:
            browser.close()
    if slow:
        print(f"Render finished with slow parts: {', '.join(sorted(set(slow)))}", flush=True)
    return pngs, blocked


def blur_image(data: bytes, boxes: list[dict[str, float]]) -> bytes:
    """Blurs each box (fractions of the image) heavily enough to be unreadable."""
    import io

    from PIL import Image, ImageFilter, ImageOps

    img = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
    w, h = img.size
    radius = max(12, int(min(w, h) * 0.04))
    for b in boxes:
        x0 = max(0, int((b["x"] - 0.02) * w))
        y0 = max(0, int((b["y"] - 0.02) * h))
        x1 = min(w, int((b["x"] + b["w"] + 0.02) * w))
        y1 = min(h, int((b["y"] + b["h"] + 0.02) * h))
        if x1 <= x0 or y1 <= y0:
            continue
        region = img.crop((x0, y0, x1, y1))
        # Pixelate, then blur: nothing readable survives.
        small = region.resize((max(1, (x1 - x0) // 24), max(1, (y1 - y0) // 24)))
        region = small.resize(region.size).filter(ImageFilter.GaussianBlur(radius))
        img.paste(region, (x0, y0))
    out = io.BytesIO()
    img.save(out, format="PNG", optimize=True)
    return out.getvalue()


def chromium_available() -> bool:
    """True when this machine can render (the Docker image can; a bare runtime may not)."""
    try:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH") or None).close()
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"Rendering not available here: {exc}", flush=True)
        return False


def store_outputs(conn, job_id: str, pngs: list[bytes]) -> None:
    for i, data in enumerate(pngs):
        conn.execute(
            """INSERT INTO render_outputs (job_id, frame, mime, data) VALUES (%s, %s, 'image/png', %s)
               ON CONFLICT (job_id, frame) DO UPDATE SET data = excluded.data""",
            (job_id, i, data),
        )


def render_job(conn, job_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    docs = payload.get("docs") or []
    if not docs or len(docs) > 10:
        raise ValueError("A render needs 1 to 10 frames")
    pngs, blocked = render_frames(
        docs,
        int(payload["width"]),
        int(payload["height"]),
        list(payload.get("allowedHosts") or []),
        db_font_loader(conn, payload.get("brandId")),
    )
    store_outputs(conn, job_id, pngs)
    return {"frames": len(pngs), "blocked": blocked[:20]}


def blur_job(conn, job_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    import urllib.request

    url = str(payload["url"])
    if not url.startswith("https://"):
        raise ValueError("Only https file addresses")
    with urllib.request.urlopen(url, timeout=60) as res:  # noqa: S310 - https only, the shop's own media
        data = res.read(60 * 1024 * 1024)
    store_outputs(conn, job_id, [blur_image(data, list(payload.get("boxes") or []))])
    return {"blurred": len(payload.get("boxes") or [])}
