"""
Crystal Falls background + buttons → public/games/crystal/bg.jpg, ui/<name>.png.
Art is drawn at the skin's source scale (config.json → skin.sourceWidth = 1080,
2× the canvas); every position comes from config.json → skin.ui and the grid
geometry, so moving an anchor and re-running keeps art and code in step.
Run: npm run crystal:art
"""
import json
import math
import random
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, str(Path(__file__).parent))
from art_lib import rgba, linear, radial, mask_poly, mask_ellipse, paste_masked, glow, solid, sparkle, shade

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / 'public/games/crystal'
CFG = json.loads((Path(__file__).parents[1] / 'config.json').read_text())
K = CFG['skin']['sourceWidth'] / CFG['canvas']['width']
W, H = CFG['skin']['sourceWidth'], round(CFG['canvas']['height'] * K)
UI = CFG['skin']['ui']
FONT = '/usr/share/fonts/opentype/inter/Inter-Black.otf'
GOLD = ('FFF2A8', 'D08A1A')


def panel(img, box, radius, border=('B89CFF', 'FFD36A'), fill=(14, 6, 38, 215), width=4):
    m = Image.new('L', img.size, 0)
    ImageDraw.Draw(m).rounded_rectangle(box, radius, fill=255)
    img = glow(img, m, rgba('8A5CFF'), 18, 0.6)
    paste_masked(img, solid(img.size, fill), m)
    ring = Image.new('L', img.size, 0)
    ImageDraw.Draw(ring).rounded_rectangle(box, radius, outline=255, width=width)
    paste_masked(img, linear(img.size, rgba(border[0]), rgba(border[1]), 0), ring)
    return img


def background():
    rnd = random.Random(7)
    img = linear((W, H), rgba('241052'), rgba('0B0420'))
    img.alpha_composite(radial((W, H), (W / 2, H * 0.3), W * 0.9, rgba('5B2BA8', 150), rgba('000000', 0)))
    d = ImageDraw.Draw(img)
    for _ in range(260):  # stars
        x, y, r = rnd.uniform(0, W), rnd.uniform(0, H * 0.75), rnd.choice([1, 1, 1.5, 2, 3])
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, rnd.randint(70, 220)))
    for side in (-1, 1):  # crystal spires on both sides
        for i in range(7):
            base_x = W / 2 + side * rnd.uniform(W * 0.32, W * 0.62)
            h = rnd.uniform(H * 0.18, H * 0.42)
            w = rnd.uniform(50, 120)
            by = H * rnd.uniform(0.55, 0.72)
            pts = [(base_x - w, by), (base_x - w * 0.6, by - h * 0.8), (base_x, by - h), (base_x + w * 0.6, by - h * 0.8), (base_x + w, by)]
            col = rnd.choice(['5BC8FF', '9A6BFF', 'FF7AD9'])
            m = mask_poly(img.size, pts)
            img = glow(img, m, rgba(col), 30, 0.5)
            paste_masked(img, linear(img.size, rgba(col, 170), rgba('1A0B3D', 60)), m)
            ImageDraw.Draw(img).line([(base_x, by - h), (base_x, by)], fill=(255, 255, 255, 50), width=3)
    ground = linear((W, H), rgba('000000', 0), rgba('07021A', 255))
    img.alpha_composite(ground.crop((0, 0, W, H)))

    # reel panel around the grid
    x0, y0 = CFG['reelOffsetX'] * K, CFG['reelOffsetY'] * K
    cw, ch = (CFG['symbol']['width'] + CFG['symbol']['gap']) * K, (CFG['symbol']['height'] + CFG['symbol']['gap']) * K
    gw, gh = CFG['grid']['cols'] * cw, CFG['grid']['rows'] * ch
    img = panel(img, [x0 - 14, y0 - 14, x0 + gw + 6, y0 + gh + 6], 26, fill=(10, 4, 30, 205), width=5)

    # logo (brand name stays baked)
    logo = Image.new('RGBA', img.size, (0, 0, 0, 0))
    m = Image.new('L', img.size, 0)
    md = ImageDraw.Draw(m)
    for text, size, y in (('CRYSTAL', 118, 150), ('FALLS', 74, 252)):
        f = ImageFont.truetype(FONT, size)
        md.text((W / 2, y), text, font=f, anchor='mm', fill=255)
    outline = m.filter(ImageFilter.MaxFilter(13))
    paste_masked(logo, solid(img.size, rgba('2A0A55')), outline)
    paste_masked(logo, linear(img.size, rgba('FFFFFF'), rgba('7FD8FF'), 90), m)
    sheen = linear(img.size, rgba('FF9AE0', 0), rgba('FF9AE0', 200), 90)
    paste_masked(logo, sheen.crop((0, 0, W, H)), m.point(lambda v: v // 2))
    img = glow(img, outline, rgba('9A6BFF'), 22, 1.0)
    img.alpha_composite(logo)
    sparkle(img, W / 2 + 290, 95, 26)
    sparkle(img, W / 2 - 300, 230, 18)

    # HUD plates: win box, balance, bet
    wb = UI['winBox']
    img = panel(img, [wb['x'] - wb['w'] / 2, wb['y'] - wb['h'] / 2, wb['x'] + wb['w'] / 2, wb['y'] + wb['h'] / 2], 30)
    by = UI['balanceValue']['y']
    img = panel(img, [UI['balanceValue']['x'] - 200, by - 72, UI['balanceValue']['x'] + 200, by + 40], 24)
    img = panel(img, [UI['minus']['x'] - 52, by - 72, UI['plus']['x'] + 52, by + 40], 24)
    s = UI['spin']
    img.alpha_composite(radial(img.size, (s['x'], s['y']), s['r'] * 2.2, rgba('7A4DFF', 120), rgba('000000', 0)))
    return img.convert('RGB')


def disc(r, top, bottom, ring=GOLD, pad=26):
    size = int(2 * (r + pad))
    c = size / 2
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    m = mask_ellipse(img.size, [c - r, c - r, c + r, c + r])
    img = glow(img, m, rgba('000000'), 10, 0.8)
    paste_masked(img, linear(img.size, rgba(ring[0]), rgba(ring[1])), m)
    ri = r * 0.86
    paste_masked(img, radial(img.size, (c, c - ri * 0.4), ri * 1.6, rgba(top), rgba(bottom)), mask_ellipse(img.size, [c - ri, c - ri, c + ri, c + ri]))
    hl = mask_ellipse(img.size, [c - ri * 0.7, c - ri * 0.92, c + ri * 0.7, c - ri * 0.2]).filter(ImageFilter.GaussianBlur(6))
    paste_masked(img, solid(img.size, (255, 255, 255, 70)), hl)
    return img, c


def arrows(img, c, r, width, color=(255, 255, 255, 255)):
    """Two curved arrows (spin / auto icon)."""
    d = ImageDraw.Draw(img)
    for start in (200, 20):
        d.arc([c - r, c - r, c + r, c + r], start, start + 130, fill=color, width=width)
        a = math.radians(start + 130)
        tip = (c + r * math.cos(a), c + r * math.sin(a))
        ang = a + math.pi / 2
        hw = width * 1.25
        d.polygon([(tip[0] + math.cos(ang) * hw * 1.4, tip[1] + math.sin(ang) * hw * 1.4),
                   (tip[0] + math.cos(a) * hw, tip[1] + math.sin(a) * hw),
                   (tip[0] - math.cos(a) * hw, tip[1] - math.sin(a) * hw)], fill=color)


def buttons():
    ui = {}
    img, c = disc(UI['spin']['r'], '9C7BFF', '3A12A0')
    arrows(img, c, UI['spin']['r'] * 0.45, 22)
    ui['spin'] = img
    img, c = disc(UI['auto']['r'], '5B3BB8', '1E0A55', ring=('C8B6FF', '6A4CC8'))
    arrows(img, c, UI['auto']['r'] * 0.42, 12)
    ui['auto'] = img
    img, c = disc(UI['turbo']['r'], '5B3BB8', '1E0A55', ring=('C8B6FF', '6A4CC8'))
    r = UI['turbo']['r'] * 0.5
    ImageDraw.Draw(img).polygon([(c + r * 0.15, c - r), (c - r * 0.55, c + r * 0.12), (c - r * 0.02, c + r * 0.12),
                                 (c - r * 0.2, c + r), (c + r * 0.55, c - r * 0.15), (c + r * 0.02, c - r * 0.15)], fill=rgba('FFE27A'))
    ui['turbo'] = img
    for name, plus in (('minus', False), ('plus', True)):
        img, c = disc(UI[name]['r'], '7A5CE0', '2A1070', ring=('E8DCFF', '8A6CE0'), pad=14)
        L, t = UI[name]['r'] * 0.5, 7
        d = ImageDraw.Draw(img)
        d.rounded_rectangle([c - L, c - t, c + L, c + t], 3, fill='white')
        if plus:
            d.rounded_rectangle([c - t, c - L, c + t, c + L], 3, fill='white')
        ui[name] = img
    img, c = disc(UI['info']['r'], '7A5CE0', '2A1070', ring=('E8DCFF', '8A6CE0'), pad=14)
    d = ImageDraw.Draw(img)
    d.ellipse([c - 8, c - 34, c + 8, c - 18], fill='white')
    d.rounded_rectangle([c - 7, c - 8, c + 7, c + 32], 4, fill='white')
    ui['info'] = img
    img, c = disc(UI['buy']['r'], 'FF8AD8', 'A0127A')
    sparkle(img, c + UI['buy']['r'] * 0.45, c - UI['buy']['r'] * 0.5, 16)
    ui['buy'] = img
    (OUT / 'ui').mkdir(parents=True, exist_ok=True)
    for name, im in ui.items():
        im.save(OUT / 'ui' / f'{name}.png', optimize=True)
        print('ui', name)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    background().save(OUT / 'bg.jpg', quality=88)
    print('bg', W, H)
    buttons()
