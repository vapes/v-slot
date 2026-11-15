"""
Slices ../art/source.png (971x1619 mockup) into game assets.

Outputs (public/games/dragon/):
  bg.jpg               - full background; value texts erased, reel window darkened
  symbols/<id>.jpg     - 13 reel symbols, 242x180 (2x of the 121x90 game cell)
  ui/<name>.png        - round buttons with feathered alpha (same pixel scale as bg);
                         info.png = the coins disc with its icon removed and a gold "i" drawn in

Usage:  npm run dragon:slice
Requires Pillow + numpy.
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import sys

GAME = Path(__file__).resolve().parent.parent
REPO = GAME.parent.parent.parent
SRC = GAME / 'art' / 'source.png'
OUT = REPO / 'public' / 'games' / GAME.name

sys.path.insert(0, str(REPO / 'scripts'))
from skin_tools import erase_box, inpaint  # noqa: E402  (shared with other games)

# Reel window grid lines measured on the source image
XS = [52, 269.5, 489.5, 709, 925]
YS = [430, 594.5, 759.5, 924.5, 1086.5, 1243]

# symbol id -> (col, row) of the cleanest instance in the mockup
SYMBOLS = {
    'Q': (0, 0), 'egg': (1, 0), 'K': (2, 0), '10': (3, 0),
    'chest': (0, 1), 'J': (1, 1), '9': (2, 1), 'dragon': (3, 1),
    'A': (0, 2), 'wild': (1, 2), 'gold': (3, 3),
    'goblet': (1, 4), 'crystal': (3, 4),
}
SYMBOL_OUT = (242, 180)
INSET = 3  # px trimmed from each side to drop the golden separators

# name -> (cx, cy, rx, ry) ellipse in source pixels
BUTTONS = {
    'info': (92, 1465, 62, 62),   # cut from the coins disc, icon replaced by "i"
    'auto': (243, 1465, 62, 62),
    'spin': (487, 1480, 172, 150),
    'turbo': (728, 1465, 62, 62),
    'buy': (878, 1465, 62, 62),    # cut from the trophy disc, icon replaced by a small egg (caption drawn live)
    'minus': (688, 1322, 30, 30),
    'plus': (912, 1322, 30, 30),
}

# Baked buttons removed from the game: erased from the background (cx, cy, r)
REMOVED_BUTTONS = [(878, 1465, 68)]  # trophy (the paytable opens from "i")
# Rock strip right of the button row (x0, y0, x1, y1): its fine detail re-textures the erased disc
ROCK_DONOR = (800, 1368, 960, 1398)
# Icon area inside the coins disc that becomes the "i" button (x0, y0, x1, y1)
INFO_ICON_BOX = (60, 1433, 124, 1497)
INFO_FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
# Trophy icon inside its disc (x0, y0, x1, y1) → replaced by the egg (buy feature button)
BUY_ICON_BOX = (836, 1422, 920, 1508)
BUY_EGG = (878, 1450, 27)  # cx, cy, radius of the egg icon (caption goes under it)

# Baked value texts to erase (x0, y0, x1, y1)
TEXT_BOXES = [(64, 1316, 256, 1358), (400, 1316, 546, 1358), (730, 1316, 876, 1358)]

# Baked labels (drawn translated at runtime): BALANCE / LAST WIN / BET, AUTO, TURBO
# Glyph mask dilation in px (covers anti-aliasing and outlines)
GLYPH_GROW = 3
LABEL_BOXES = [(107, 1290, 212, 1318, 'gold'), (420, 1290, 527, 1318, 'gold'), (779, 1290, 827, 1318, 'gold'),
               (210, 1490, 294, 1520, 'gold'), (688, 1490, 766, 1516, 'gold')]


def retexture(arr, src, disc):
    """Add the high-frequency detail of ROCK_DONOR (strips mirrored to fill) to a smooth inpainted disc."""
    cx, cy, r = disc
    size = 2 * r
    x0, y0, x1, y1 = ROCK_DONOR
    strip = np.asarray(src.crop(ROCK_DONOR)).astype(float)
    rows, flip = [], False
    while sum(len(s) for s in rows) < size:
        rows.append(strip[::-1] if flip else strip)
        flip = not flip
    tex = np.concatenate(rows)[:size]
    tex = np.asarray(Image.fromarray(tex.astype(np.uint8)).resize((size, size), Image.BICUBIC)).astype(float)
    blur = np.asarray(Image.fromarray(tex.astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(float)
    detail = tex - blur
    yy, xx = np.mgrid[:size, :size]
    d = np.sqrt((xx - r + 0.5) ** 2 + (yy - r + 0.5) ** 2) / r
    w = np.clip((1 - d) / 0.25, 0, 1)[..., None]  # feathered towards the rim
    region = arr[cy - r:cy + r, cx - r:cx + r].astype(float)
    arr[cy - r:cy + r, cx - r:cx + r] = np.clip(region + detail * w, 0, 255).astype(np.uint8)


def draw_egg_icon(arr, src):
    """Small round egg (the scatter art) with a soft gold rim — icon of the feature-buy button."""
    cx, cy, r = BUY_EGG
    c, row = SYMBOLS['egg']
    cell = (round(XS[c]) + INSET, round(YS[row]) + INSET, round(XS[c + 1]) - INSET, round(YS[row + 1]) - INSET)
    w, h = cell[2] - cell[0], cell[3] - cell[1]
    side = min(w, h)
    sq = src.crop((cell[0] + (w - side) // 2, cell[1] + (h - side) // 2,
                   cell[0] + (w + side) // 2, cell[1] + (h + side) // 2))
    egg = np.asarray(sq.resize((2 * r, 2 * r), Image.LANCZOS)).astype(float)
    yy, xx = np.mgrid[:2 * r, :2 * r]
    d = np.sqrt((xx - r + 0.5) ** 2 + (yy - r + 0.5) ** 2)
    alpha = np.clip(r - 1.5 - d, 0, 1)[..., None]
    rim = (np.clip(1.6 - np.abs(d - (r - 1.5)), 0, 1))[..., None]
    region = arr[cy - r:cy + r, cx - r:cx + r].astype(float)
    region = region * (1 - alpha) + egg * alpha
    region = region * (1 - rim) + np.array([255, 200, 80]) * rim
    arr[cy - r:cy + r, cx - r:cx + r] = np.clip(region, 0, 255).astype(np.uint8)


def draw_info_icon(arr, button):
    """Gold "i" (vertical gradient + dark outline, like the other icons) in the button centre."""
    cx, cy = button[0], button[1]
    size = 150
    mask = Image.new('L', (size, size), 0)
    font = ImageFont.truetype(INFO_FONT, 74)
    ImageDraw.Draw(mask).text((size / 2, size / 2), 'i', font=font, fill=255, anchor='mm')
    m = np.asarray(mask).astype(float) / 255
    outline = np.asarray(mask.filter(ImageFilter.MaxFilter(5))).astype(float) / 255
    t = np.linspace(0, 1, size)[:, None]
    top, bottom = np.array([255, 230, 130]), np.array([224, 140, 20])
    gold = top * (1 - t[..., None]) + bottom * t[..., None]
    x0, y0 = cx - size // 2, cy - size // 2
    region = arr[y0:y0 + size, x0:x0 + size].astype(float)
    region = region * (1 - outline[..., None] * 0.85) + np.array([40, 16, 4]) * outline[..., None] * 0.85
    region = region * (1 - m[..., None]) + np.broadcast_to(gold, region.shape) * m[..., None]
    arr[y0:y0 + size, x0:x0 + size] = np.clip(region, 0, 255).astype(np.uint8)


def main():
    src = Image.open(SRC).convert('RGB')
    (OUT / 'symbols').mkdir(parents=True, exist_ok=True)
    (OUT / 'ui').mkdir(parents=True, exist_ok=True)

    for sid, (c, r) in SYMBOLS.items():
        box = (round(XS[c]) + INSET, round(YS[r]) + INSET, round(XS[c + 1]) - INSET, round(YS[r + 1]) - INSET)
        src.crop(box).resize(SYMBOL_OUT, Image.LANCZOS).save(OUT / 'symbols' / f'{sid}.jpg', quality=90, optimize=True)

    # Erase baked value texts first so button crops (the spin wings overlap
    # the LAST WIN panel) don't carry them.
    arr = np.array(src)
    # labels first: value boxes sample the rows right under the labels
    for *b, mode in LABEL_BOXES:
        inpaint(arr, b, mode, GLYPH_GROW)
    for b in TEXT_BOXES:
        erase_box(arr, b)
    # button sprites are cut before the trophy disc is erased from the background
    clean_arr = arr.copy()
    inpaint(clean_arr, INFO_ICON_BOX, 'gold', 3)
    draw_info_icon(clean_arr, BUTTONS['info'])
    inpaint(clean_arr, BUY_ICON_BOX, 'gold', 4, iterations=1200)
    draw_egg_icon(clean_arr, src)
    for cx, cy, r in REMOVED_BUTTONS:
        inpaint(arr, (cx - r, cy - r, cx + r, cy + r), 'disc', 0, pad=8, iterations=3000)
        retexture(arr, src, (cx, cy, r))
    clean = Image.fromarray(clean_arr)

    for name, (cx, cy, rx, ry) in BUTTONS.items():
        pad = 2
        box = (cx - rx - pad, cy - ry - pad, cx + rx + pad, cy + ry + pad)
        crop = clean.crop(box).convert('RGBA')
        mask = Image.new('L', crop.size, 0)
        ImageDraw.Draw(mask).ellipse((pad, pad, pad + 2 * rx, pad + 2 * ry), fill=255)
        crop.putalpha(mask.filter(ImageFilter.GaussianBlur(1.2)))
        crop.save(OUT / 'ui' / f'{name}.png', optimize=True)

    # Darken reel window (symbols are drawn on top as opaque tiles)
    x0, x1, y0, y1 = round(XS[0]), round(XS[-1]), round(YS[0]), round(YS[-1])
    arr[y0:y1, x0:x1] = (arr[y0:y1, x0:x1] * 0.0 + np.array([22, 12, 30])).astype(np.uint8)
    Image.fromarray(arr).save(OUT / 'bg.jpg', quality=88, optimize=True, progressive=True)
    print('done')


if __name__ == '__main__':
    main()
