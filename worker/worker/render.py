"""Renders design frames (HTML from the server) to PNGs with headless Chromium.

Safety: page scripts are blocked by a Content-Security-Policy, and every
network request is refused except Google Fonts and the hosts the server
listed (the shop's own media addresses).
"""

from __future__ import annotations

import os
from typing import Any
from urllib.parse import urlparse

FRAME_URL = "https://frame.render.local/"
FONT_HOSTS = {"fonts.googleapis.com", "fonts.gstatic.com"}
MAX_SIDE = 2400


def csp(allowed_hosts: list[str]) -> str:
    imgs = " ".join(f"https://{h}" for h in allowed_hosts)
    return (
        "default-src 'none'; script-src 'none'; "
        f"img-src data: {imgs}; "
        "style-src 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src https://fonts.gstatic.com data:"
    )


def _router(doc: str, allowed: set[str], allowed_hosts: list[str], blocked: list[str]):
    def route(r) -> None:
        url = r.request.url
        if url == FRAME_URL:
            r.fulfill(
                status=200,
                content_type="text/html; charset=utf-8",
                headers={"Content-Security-Policy": csp(allowed_hosts)},
                body=doc,
            )
            return
        parsed = urlparse(url)
        if parsed.scheme == "https" and parsed.hostname in allowed:
            r.continue_()
        else:
            blocked.append(url)
            r.abort()

    return route


def render_frames(docs: list[str], width: int, height: int, allowed_hosts: list[str]) -> tuple[list[bytes], list[str]]:
    """Returns (png bytes per frame, urls that were blocked)."""
    from playwright.sync_api import sync_playwright

    if not (0 < width <= MAX_SIDE and 0 < height <= MAX_SIDE):
        raise ValueError("Frame size out of range")
    allowed = set(allowed_hosts) | FONT_HOSTS
    blocked: list[str] = []
    pngs: list[bytes] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH") or None)
        try:
            context = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=1)
            for doc in docs:
                page = context.new_page()
                page.route("**/*", _router(doc, allowed, allowed_hosts, blocked))
                page.goto(FRAME_URL, wait_until="networkidle", timeout=45_000)
                # Fonts and photos fully loaded before the picture is taken.
                page.evaluate("document.fonts.ready.then(() => true)")
                page.evaluate(
                    "Promise.all([...document.images].map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; })))"
                )
                pngs.append(page.screenshot(type="png", clip={"x": 0, "y": 0, "width": width, "height": height}))
                page.close()
            context.close()
        finally:
            browser.close()
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
    pngs, blocked = render_frames(docs, int(payload["width"]), int(payload["height"]), list(payload.get("allowedHosts") or []))
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
