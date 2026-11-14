"""
Slices ../art/source.jpg (1536x2752 "777 Casino Classic" mockup) into game assets.

Outputs (public/games/classic/):
  bg.jpg               - background; baked values erased, reel window cleared
  symbols/<id>.jpg     - 6 opaque symbol tiles, 208x206 (2x the 104x103 game cell)
  ui/<name>.png        - round buttons with feathered alpha (source pixel scale)

Usage:  npm run classic:slice     (Pillow + numpy)
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

GAME = Path(__file__).resolve().parent.parent
REPO = GAME.parent.parent.parent
SRC = GAME / 'art' / 'source.jpg'
OUT = REPO / 'public' / 'games' / GAME.name

# Reel window grid measured on the source (5 reels x 3 rows)
XS = [28, 320, 618, 916, 1215, 1508]
YS = [924, 1218, 1512, 1806]

# symbol id -> (col, row) of a clean instance (row 1 cols 1-3 carry the win glow)
SYMBOLS = {
    'seven': (0, 0), 'cherry': (1, 0), 'bell': (2, 0),
    'melon': (3, 0), 'bar': (4, 0), 'star': (4, 1),
}
SYMBOL_OUT = (208, 206)
INSET = 6  # trim the gold separators

# name -> (cx, cy, r) in source pixels
BUTTONS = {
    'info_i': (126, 2440, 80),
    'auto': (380, 2442, 128),
    'spin': (770, 2440, 214),
    'info': (1156, 2440, 128),
    'minus': (600, 2104, 56),
    'plus': (940, 2104, 56),
}

# Baked texts to erase (x0, y0, x1, y1): balance, bet, win values + jackpot amount
TEXT_BOXES = [(100, 2066, 412, 2146), (680, 2066, 862, 2146), (1150, 2066, 1412, 2146), (388, 122, 1142, 236)]

REEL_FILL = (10, 28, 66)


def erase_box(arr, box):
    """Replace a box by vertical interpolation between its top and bottom edge rows."""
    x0, y0, x1, y1 = box
    top = arr[y0 - 1, x0:x1].astype(float)
    bot = arr[y1, x0:x1].astype(float)
    for i, y in enumerate(range(y0, y1)):
        t = (i + 1) / (y1 - y0 + 1)
        arr[y, x0:x1] = (top * (1 - t) + bot * t).astype(np.uint8)
    patch = Image.fromarray(arr[y0 - 2:y1 + 2, x0 - 2:x1 + 2]).filter(ImageFilter.GaussianBlur(2))
    arr[y0 - 2:y1 + 2, x0 - 2:x1 + 2] = np.asarray(patch)


def main():
    src = Image.open(SRC).convert('RGB')
    for sub in ('symbols', 'ui'):
        (OUT / sub).mkdir(parents=True, exist_ok=True)

    for sid, (c, r) in SYMBOLS.items():
        box = (XS[c] + INSET, YS[r] + INSET, XS[c + 1] - INSET, YS[r + 1] - INSET)
        src.crop(box).resize(SYMBOL_OUT, Image.LANCZOS).save(OUT / 'symbols' / f'{sid}.jpg', quality=90, optimize=True)

    arr = np.array(src)
    for b in TEXT_BOXES:
        erase_box(arr, b)
    clean = Image.fromarray(arr.copy())

    for name, (cx, cy, r) in BUTTONS.items():
        pad = 2
        crop = clean.crop((cx - r - pad, cy - r - pad, cx + r + pad, cy + r + pad)).convert('RGBA')
        mask = Image.new('L', crop.size, 0)
        ImageDraw.Draw(mask).ellipse((pad, pad, pad + 2 * r, pad + 2 * r), fill=255)
        crop.putalpha(mask.filter(ImageFilter.GaussianBlur(1.5)))
        crop.save(OUT / 'ui' / f'{name}.png', optimize=True)

    arr[YS[0]:YS[-1], XS[0]:XS[-1]] = REEL_FILL
    Image.fromarray(arr).save(OUT / 'bg.jpg', quality=88, optimize=True, progressive=True)
    print('done')


if __name__ == '__main__':
    main()
