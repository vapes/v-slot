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
import sys

GAME = Path(__file__).resolve().parent.parent
REPO = GAME.parent.parent.parent
SRC = GAME / 'art' / 'source.jpg'
OUT = REPO / 'public' / 'games' / GAME.name

sys.path.insert(0, str(REPO / 'scripts'))
from skin_tools import erase_box, inpaint  # noqa: E402  (shared with other games)

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
    'turbo': (1156, 2440, 128),  # blank blue button (baked INFO caption erased) → TURBO
    'minus': (600, 2104, 56),
    'plus': (940, 2104, 56),
}

# Baked texts to erase (x0, y0, x1, y1): balance, bet, win values + jackpot amount
TEXT_BOXES = [(100, 2066, 412, 2146), (680, 2066, 862, 2146), (1150, 2066, 1412, 2146), (388, 122, 1142, 236)]

# Baked labels (drawn translated at runtime): MEGA JACKPOT, BALANCE / BET / WIN,
# AUTO SPIN, INFO (button reused as TURBO), SPIN
# Glyph mask dilation in px (covers anti-aliasing and outlines)
GLYPH_GROW = 7
LABEL_BOXES = [(485, 36, 1053, 110, 'box'), (122, 1964, 395, 2023, 'gold'), (712, 1964, 827, 2023, 'gold'),
               (1219, 1964, 1337, 2023, 'gold'), (302, 2378, 461, 2500, 'white'), (1088, 2406, 1231, 2470, 'white'),
               (660, 2396, 875, 2483, 'white')]

REEL_FILL = (10, 28, 66)

# Baked buttons removed from the background after their sprites are cut:
# "i" (moved to the top-right column) and the speaker (replaced by the engine
# sound toggle at the top-right). (cx, cy, r) incl. drop shadow.
REMOVED_BUTTONS = [(126, 2440, 96), (1416, 2442, 96)]


def main():
    src = Image.open(SRC).convert('RGB')
    for sub in ('symbols', 'ui'):
        (OUT / sub).mkdir(parents=True, exist_ok=True)

    for sid, (c, r) in SYMBOLS.items():
        box = (XS[c] + INSET, YS[r] + INSET, XS[c + 1] - INSET, YS[r + 1] - INSET)
        src.crop(box).resize(SYMBOL_OUT, Image.LANCZOS).save(OUT / 'symbols' / f'{sid}.jpg', quality=90, optimize=True)

    arr = np.array(src)
    # labels first: value boxes sample the rows right under the labels
    for *b, mode in LABEL_BOXES:
        inpaint(arr, b, mode, GLYPH_GROW)
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

    for cx, cy, r in REMOVED_BUTTONS:
        inpaint(arr, (cx - r, cy - r, cx + r, cy + r), 'disc', iterations=1500)

    arr[YS[0]:YS[-1], XS[0]:XS[-1]] = REEL_FILL
    Image.fromarray(arr).save(OUT / 'bg.jpg', quality=88, optimize=True, progressive=True)
    print('done')


if __name__ == '__main__':
    main()
