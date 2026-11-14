"""
Slices ../art/source.png (971x1619 mockup) into game assets.

Outputs (public/games/dragon/):
  bg.jpg               - full background; value texts erased, reel window darkened
  symbols/<id>.jpg     - 13 reel symbols, 242x180 (2x of the 121x90 game cell)
  ui/<name>.png        - round buttons with feathered alpha (same pixel scale as bg)

Usage:  npm run dragon:slice
Requires Pillow + numpy.
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
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
    'coins': (92, 1465, 62, 62),
    'auto': (243, 1465, 62, 62),
    'spin': (487, 1480, 172, 150),
    'turbo': (728, 1465, 62, 62),
    'trophy': (878, 1465, 62, 62),
    'minus': (688, 1322, 30, 30),
    'plus': (912, 1322, 30, 30),
}

# Baked value texts to erase (x0, y0, x1, y1)
TEXT_BOXES = [(64, 1316, 256, 1358), (400, 1316, 546, 1358), (730, 1316, 876, 1358)]

# Baked labels (drawn translated at runtime): BALANCE / LAST WIN / BET, AUTO, TURBO
# Glyph mask dilation in px (covers anti-aliasing and outlines)
GLYPH_GROW = 3
LABEL_BOXES = [(107, 1290, 212, 1318, 'gold'), (420, 1290, 527, 1318, 'gold'), (779, 1290, 827, 1318, 'gold'),
               (210, 1490, 294, 1520, 'gold'), (688, 1490, 766, 1516, 'gold')]


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
    clean = Image.fromarray(arr.copy())

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
