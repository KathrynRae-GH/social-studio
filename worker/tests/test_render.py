import io
import os

import pytest

from worker.render import _router, blur_image, chromium_available, csp, render_frames

needs_chromium = pytest.mark.skipif(not chromium_available(), reason="Chromium not available here")

DOC = """<!doctype html><html><head><style>
html,body{margin:0;width:%dpx;height:%dpx;background:#de771f}
</style></head><body>
<img src="https://example.com/not-allowed.png">
<script>document.body.style.background = '#000000'</script>
</body></html>"""


@needs_chromium
def test_renders_each_frame_at_its_exact_size():
    from PIL import Image

    pngs, _ = render_frames([DOC % (1080, 1350), DOC % (1080, 1350)], 1080, 1350, [])
    assert len(pngs) == 2
    img = Image.open(io.BytesIO(pngs[0]))
    assert img.size == (1080, 1350)
    # The page's script never ran: the background is still the orange.
    assert img.convert("RGB").getpixel((540, 675)) == (222, 119, 31)


@needs_chromium
def test_outside_images_never_load():
    from PIL import Image

    doc = """<!doctype html><html><body style="margin:0;background:#ffffff">
<img src="https://example.com/not-allowed.png" style="width:200px;height:200px;background:#000">
</body></html>"""
    pngs, _ = render_frames([doc], 200, 200, ["cdn.shop.test"])
    # The policy stops the request; the image box is only its own background.
    assert Image.open(io.BytesIO(pngs[0])).convert("RGB").getpixel((100, 100)) == (0, 0, 0)


class FakeRoute:
    def __init__(self, url):
        self.request = type("R", (), {"url": url, "headers": {}})()
        self.outcome = None

    def fulfill(self, **_kw):
        self.outcome = "fulfilled"

    def continue_(self):
        self.outcome = "continued"

    def abort(self):
        self.outcome = "aborted"


def test_router_only_lets_through_the_frame_fonts_and_listed_hosts(monkeypatch):
    import worker.render as render

    monkeypatch.setattr(render, "_fetch_font", lambda url, ua: ("font/woff2", b"x") if "ok" in url else None)
    blocked = []
    route = _router("<p>hi</p>", {"cdn.shop.test", "fonts.gstatic.com"}, ["cdn.shop.test"], blocked)
    cases = {
        "https://frame.render.local/": "fulfilled",
        "https://cdn.shop.test/photo.jpg": "continued",
        "https://fonts.gstatic.com/ok.woff2": "fulfilled",  # fetched by the worker itself
        "https://fonts.gstatic.com/down.woff2": "aborted",  # font host failed: fallback font
        "http://cdn.shop.test/photo.jpg": "aborted",
        "https://evil.test/steal": "aborted",
    }
    for url, want in cases.items():
        r = FakeRoute(url)
        route(r)
        assert r.outcome == want, url
    assert blocked == ["http://cdn.shop.test/photo.jpg", "https://evil.test/steal"]


def test_csp_blocks_scripts_and_lists_media_hosts():
    policy = csp(["cdn.shop.test"])
    assert "script-src 'none'" in policy
    assert "img-src data: https://cdn.shop.test" in policy


def test_blur_hides_the_marked_box_only():
    from PIL import Image, ImageDraw

    img = Image.new("RGB", (400, 400), "white")
    draw = ImageDraw.Draw(img)
    for x in range(0, 400, 4):  # fine stripes, like small text
        draw.line([(x, 0), (x, 400)], fill="black")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    out = Image.open(io.BytesIO(blur_image(buf.getvalue(), [{"x": 0.0, "y": 0.0, "w": 0.5, "h": 0.5}])))

    def contrast(box):
        px = [out.convert("L").getpixel((x, y)) for x in range(box[0], box[2]) for y in range(box[1], box[1] + 2)]
        return max(px) - min(px)

    assert contrast((40, 40, 120)) < 40  # stripes gone inside the box
    assert contrast((300, 300, 380)) > 200  # untouched outside it
