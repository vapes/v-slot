"""
Crystal Falls symbols → public/games/crystal/symbols/<id>.png (transparent, 176 px).
Run: npm run crystal:art (draws symbols, background and buttons).
"""
import math
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).parent))
from art_lib import SS, rgba, shade, faceted, regular, mask_poly, mask_ellipse, radial, paste_masked, glow, sparkle, linear, finish

OUT = Path(__file__).resolve().parents[4] / 'public/games/crystal/symbols'
PX = 176
S = PX * SS
C = S / 2


def canvas():
    return Image.new('RGBA', (S, S), (0, 0, 0, 0))


def gem(outer, color, glow_color=None, **kw):
    img = canvas()
    faceted(img, outer, rgba(color), **kw)
    img = glow(img, mask_poly(img.size, outer), rgba(glow_color or color), 9 * SS, 0.9)
    sparkle(img, C - S * 0.16, C - S * 0.2, S * 0.07)
    return img


def heart_pts(cx, cy, r, n=48):
    pts = []
    for i in range(n):
        t = math.pi * 2 * i / n
        x = 16 * math.sin(t) ** 3
        y = -(13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t))
        pts.append((cx + x * r / 17, cy + y * r / 17))
    return pts[::4]


def star_pts(cx, cy, r, inner=0.48, n=5):
    return [(cx + (r if i % 2 == 0 else r * inner) * math.cos(math.radians(-90 + i * 180 / n)),
             cy + (r if i % 2 == 0 else r * inner) * math.sin(math.radians(-90 + i * 180 / n))) for i in range(2 * n)]


def drop_pts(cx, cy, r, n=28):
    pts = []
    for i in range(n):
        t = math.pi * 2 * i / n
        x = math.sin(t) * (1 - math.cos(t)) * 0.5 * 1.25
        y = -math.cos(t)
        pts.append((cx + x * r, cy + y * r))
    return pts[::2]


def crown():
    img = canvas()
    w, top, base = S * 0.38, C - S * 0.24, C + S * 0.2
    pts = [(C - w, base), (C - w * 1.05, top + S * 0.08), (C - w * 0.55, C - S * 0.02), (C - w * 0.3, top - S * 0.04),
           (C, C - S * 0.06), (C + w * 0.3, top - S * 0.04), (C + w * 0.55, C - S * 0.02), (C + w * 1.05, top + S * 0.08), (C + w, base)]
    m = mask_poly(img.size, pts)
    paste_masked(img, linear(img.size, rgba('FFF2A8'), rgba('C77A12')), m)
    d = ImageDraw.Draw(img)
    d.line(pts + [pts[0]], fill=rgba('5A2A00'), width=3 * SS, joint='curve')
    band = [(C - w, base - S * 0.1), (C + w, base - S * 0.1), (C + w, base), (C - w, base)]
    paste_masked(img, linear(img.size, rgba('FFE27A'), rgba('A85C08')), mask_poly(img.size, band))
    d.line(band + [band[0]], fill=rgba('5A2A00'), width=2 * SS)
    for x, col in ((-0.55, 'FF3D6E'), (0, '3DD8FF'), (0.55, '4DFF8A')):
        r = S * 0.045
        e = regular(8, C + x * w, base - S * 0.05, r)
        faceted(img, e, rgba(col), table_scale=0.45)
    for x in (-1.05, -0.3, 0.3, 1.05):
        y = top + (S * 0.08 if abs(x) > 1 else -S * 0.04)
        d.ellipse([C + x * w - S * 0.035, y - S * 0.035, C + x * w + S * 0.035, y + S * 0.035], fill=rgba('FFF6CF'), outline=rgba('5A2A00'), width=SS)
    img = glow(img, m, rgba('FFB020'), 10 * SS, 0.9)
    sparkle(img, C - w * 0.3, top - S * 0.04, S * 0.07)
    return img


def scatter():
    img = canvas()
    r = S * 0.4
    halo = mask_ellipse(img.size, [C - r * 1.1, C - r * 1.1, C + r * 1.1, C + r * 1.1])
    paste_masked(img, radial(img.size, (C, C), r * 1.1, rgba('FFFFFF', 150), rgba('8A5CFF', 0)), halo)
    outer = [(C, C - r), (C + r * 0.82, C - r * 0.25), (C + r * 0.55, C + r * 0.2), (C, C + r), (C - r * 0.55, C + r * 0.2), (C - r * 0.82, C - r * 0.25)]
    sub = canvas()
    faceted(sub, outer, rgba('BFEFFF'), table_scale=0.5, table_shift=(0, -0.08))
    # rainbow sheen
    sheen = linear(img.size, rgba('FF7AD9', 120), rgba('7AFFE1', 120), 20)
    m = mask_poly(img.size, outer)
    paste_masked(sub, sheen, m)
    img.alpha_composite(sub)
    img = glow(img, m, rgba('E6D4FF'), 12 * SS, 1.2)
    for x, y, s in ((-0.3, -0.45, 0.09), (0.42, 0.1, 0.06), (-0.1, 0.35, 0.05)):
        sparkle(img, C + x * r * 1.4, C + y * r * 1.4, S * s)
    return img


def orb():
    img = canvas()
    r = S * 0.36
    m = mask_ellipse(img.size, [C - r, C - r, C + r, C + r])
    paste_masked(img, radial(img.size, (C - r * 0.3, C - r * 0.35), r * 1.5, rgba('FFE9B0'), rgba('7A1FD1')), m)
    ring = Image.new('L', img.size, 0)
    ImageDraw.Draw(ring).ellipse([C - r, C - r, C + r, C + r], outline=255, width=5 * SS)
    paste_masked(img, linear(img.size, rgba('FFF2A8'), rgba('C77A12')), ring)
    hl = mask_ellipse(img.size, [C - r * 0.62, C - r * 0.8, C + r * 0.1, C - r * 0.35])
    paste_masked(img, Image.new('RGBA', img.size, (255, 255, 255, 140)), hl.filter(ImageFilter.GaussianBlur(4 * SS)))
    img = glow(img, m, rgba('FF9CF0'), 14 * SS, 1.3)
    return img


SYMBOLS = {
    'crown': crown,
    'heart': lambda: gem(heart_pts(C, C + S * 0.02, S * 0.4), 'E8173F', 'FF4D6D', table_scale=0.5),
    'star': lambda: gem(star_pts(C, C + S * 0.02, S * 0.42), 'FFC21A', 'FFB020', table_scale=0.45, table_shift=(0, 0)),
    'drop': lambda: gem(drop_pts(C, C + S * 0.04, S * 0.4), '19C8F0', '35E0FF', table_scale=0.5, table_shift=(0, 0.05)),
    'emerald': lambda: gem(regular(8, C, C, S * 0.34, S * 0.38, -67.5), '14B85A', '35FF8A'),
    'sapphire': lambda: gem(regular(4, C, C, S * 0.44, S * 0.44, -90), '2557E8', '4D7CFF'),
    'amethyst': lambda: gem(regular(3, C, C + S * 0.06, S * 0.44, S * 0.42, -90), 'A23BE8', 'C46BFF', table_shift=(0, 0.04)),
    'topaz': lambda: gem(regular(6, C, C, S * 0.4, S * 0.36, 0), 'F07A12', 'FF9A3D'),
    'opal': lambda: gem(regular(12, C, C, S * 0.36), 'E86BBE', 'FF9AE0'),
    'scatter': scatter,
    'mult': orb,
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for sid, fn in SYMBOLS.items():
        finish(fn(), (PX, PX)).save(OUT / f'{sid}.png', optimize=True)
        print('symbol', sid)


if __name__ == '__main__':
    main()
