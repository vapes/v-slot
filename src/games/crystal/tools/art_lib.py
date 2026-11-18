"""
Drawing helpers for tools/draw-art.py (Pillow + numpy). Everything is drawn
at SS× supersampling and scaled down for smooth edges.
"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SS = 3


def rgba(hex_color, a=255):
    h = hex_color.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def mix(c1, c2, t):
    return tuple(int(round(a + (b - a) * t)) for a, b in zip(c1, c2))


def shade(c, k):
    """k > 1 lightens towards white, k < 1 darkens."""
    if k >= 1:
        return mix(c[:3], (255, 255, 255), min(k - 1, 1)) + c[3:]
    return tuple(int(v * k) for v in c[:3]) + c[3:]


def mask_poly(size, pts):
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).polygon([tuple(p) for p in pts], fill=255)
    return m


def mask_ellipse(size, box):
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).ellipse(box, fill=255)
    return m


def linear(size, c_top, c_bot, angle=90):
    """Linear gradient image; angle 90 = top → bottom."""
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    a = math.radians(angle)
    proj = xx * math.cos(a) + yy * math.sin(a)
    t = (proj - proj.min()) / max(proj.max() - proj.min(), 1)
    c1, c2 = np.array(c_top, float), np.array(c_bot, float)
    arr = c1[None, None] * (1 - t[..., None]) + c2[None, None] * t[..., None]
    return Image.fromarray(arr.astype(np.uint8), 'RGBA')


def radial(size, center, radius, c_in, c_out):
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    d = np.sqrt((xx - center[0]) ** 2 + (yy - center[1]) ** 2) / radius
    t = np.clip(d, 0, 1)[..., None]
    arr = np.array(c_in, float)[None, None] * (1 - t) + np.array(c_out, float)[None, None] * t
    return Image.fromarray(arr.astype(np.uint8), 'RGBA')


def paste_masked(img, fill, mask):
    """Composite `fill` (RGBA image) onto img through `mask` (L)."""
    a = np.asarray(fill.getchannel('A'), float) * np.asarray(mask, float) / 255
    layer = fill.copy()
    layer.putalpha(Image.fromarray(a.astype(np.uint8)))
    img.alpha_composite(layer)


def solid(size, color):
    return Image.new('RGBA', size, color)


def glow(img, mask, color, radius, strength=1.0):
    """Soft glow of `mask` in `color` under the current content."""
    g = mask.filter(ImageFilter.GaussianBlur(radius))
    a = np.clip(np.asarray(g, float) * strength, 0, 255).astype(np.uint8)
    layer = solid(img.size, color)
    layer.putalpha(Image.fromarray(a))
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.alpha_composite(layer)
    out.alpha_composite(img)
    return out


def regular(n, cx, cy, rx, ry=None, rot=-90):
    ry = rx if ry is None else ry
    return [(cx + rx * math.cos(math.radians(rot + i * 360 / n)), cy + ry * math.sin(math.radians(rot + i * 360 / n))) for i in range(n)]


def faceted(img, outer, color, table_scale=0.52, table_shift=(0, -0.04), light=-135, outline=None):
    """
    Cut gem: facets between the outer outline and a smaller "table" polygon,
    each shaded by its direction to the light (top-left), a bright table,
    a dark outline and two sparkles.
    """
    size = img.size
    cx = sum(p[0] for p in outer) / len(outer)
    cy = sum(p[1] for p in outer) / len(outer)
    span = max(p[1] for p in outer) - min(p[1] for p in outer)
    tx, ty = cx + table_shift[0] * span, cy + table_shift[1] * span
    inner = [(tx + (x - cx) * table_scale, ty + (y - cy) * table_scale) for x, y in outer]
    draw = ImageDraw.Draw(img)
    n = len(outer)
    for i in range(n):
        a, b = outer[i], outer[(i + 1) % n]
        mx, my = (a[0] + b[0]) / 2 - cx, (a[1] + b[1]) / 2 - cy
        ang = math.degrees(math.atan2(my, mx))
        k = 0.55 + 0.75 * (0.5 + 0.5 * math.cos(math.radians(ang - light)))
        k *= 0.92 if i % 2 else 1.05
        draw.polygon([a, b, inner[(i + 1) % n], inner[i]], fill=shade(color, k))
    tmask = mask_poly(size, inner)
    paste_masked(img, linear(size, shade(color, 1.55), shade(color, 1.05), 60), tmask)
    for i in range(n):  # facet edges
        draw.line([outer[i], inner[i]], fill=shade(color, 1.6)[:3] + (110,), width=max(1, SS))
    line = outline or shade(color, 0.35)
    draw.line(outer + [outer[0]], fill=line, width=3 * SS, joint='curve')
    draw.line(inner + [inner[0]], fill=shade(color, 1.7)[:3] + (160,), width=max(1, SS))


def sparkle(img, x, y, r, alpha=230):
    d = ImageDraw.Draw(img)
    for dx, dy in ((r, 0), (0, r)):
        d.polygon([(x - dx, y - dy), (x + dy * 0.18, y - dx * 0.18), (x + dx, y + dy), (x - dy * 0.18, y + dx * 0.18)],
                  fill=(255, 255, 255, alpha))
    d.ellipse([x - r * 0.22, y - r * 0.22, x + r * 0.22, y + r * 0.22], fill=(255, 255, 255, 255))


def finish(img, out_size):
    return img.resize(out_size, Image.LANCZOS)
