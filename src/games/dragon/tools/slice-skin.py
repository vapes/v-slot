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

GAME = Path(__file__).resolve().parent.parent
REPO = GAME.parent.parent.parent
SRC = GAME / 'art' / 'source.png'
OUT = REPO / 'public' / 'games' / GAME.name

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


def erase_box(arr, box, margin=3):
    """Fill a box from its surroundings (Coons patch of the median edge strips), then soften."""
    x0, y0, x1, y1 = box[0] - margin, box[1] - margin, box[2] + margin, box[3] + margin
    k = 4  # strip thickness sampled outside the box
    top = np.median(arr[y0 - k:y0, x0:x1].astype(float), axis=0)
    bot = np.median(arr[y1:y1 + k, x0:x1].astype(float), axis=0)
    left = np.median(arr[y0:y1, x0 - k:x0].astype(float), axis=1)
    right = np.median(arr[y0:y1, x1:x1 + k].astype(float), axis=1)
    h, w = y1 - y0, x1 - x0
    t = ((np.arange(h) + 1) / (h + 1))[:, None, None]
    s = ((np.arange(w) + 1) / (w + 1))[None, :, None]
    vert = top[None] * (1 - t) + bot[None] * t
    horz = left[:, None] * (1 - s) + right[:, None] * s
    c00, c01, c10, c11 = top[0], top[-1], bot[0], bot[-1]
    corners = (c00 * (1 - s) * (1 - t) + c01 * s * (1 - t) + c10 * (1 - s) * t + c11 * s * t)
    arr[y0:y1, x0:x1] = np.clip(vert + horz - corners, 0, 255).astype(np.uint8)
    p = 3
    patch = Image.fromarray(arr[y0 - p:y1 + p, x0 - p:x1 + p]).filter(ImageFilter.GaussianBlur(2.5))
    arr[y0 - p:y1 + p, x0 - p:x1 + p] = np.asarray(patch)


def text_mask(patch, mode, grow=GLYPH_GROW):
    """Boolean mask of glyph pixels in an RGB patch (mode: gold | white | box)."""
    R, G, B = (patch[..., i].astype(int) for i in range(3))
    if mode == 'box':
        return np.ones(R.shape, bool)
    if mode == 'gold':
        m = (R > 140) & (G > 95) & (B < 130) & (R - B > 55)
    else:  # white text
        m = (R > 165) & (G > 165) & (B > 165)
    # dilate so anti-aliased edges and dark glyph outlines are included
    for _ in range(grow):
        m = m | np.roll(m, 1, 0) | np.roll(m, -1, 0) | np.roll(m, 1, 1) | np.roll(m, -1, 1)
    return m


def inpaint(arr, box, mode, pad=6, iterations=400):
    """Harmonic inpainting: masked pixels relax to the average of their neighbours."""
    x0, y0, x1, y1 = box
    X0, Y0, X1, Y1 = x0 - pad, y0 - pad, x1 + pad, y1 + pad
    patch = arr[Y0:Y1, X0:X1].astype(float)
    mask = np.zeros(patch.shape[:2], bool)
    mask[pad:-pad, pad:-pad] = text_mask(arr[y0:y1, x0:x1], mode)
    known = ~mask
    patch[mask] = patch[known].mean(axis=0)
    for _ in range(iterations):
        avg = (np.roll(patch, 1, 0) + np.roll(patch, -1, 0) + np.roll(patch, 1, 1) + np.roll(patch, -1, 1)) / 4
        patch[mask] = avg[mask]
    arr[Y0:Y1, X0:X1] = np.clip(patch, 0, 255).astype(np.uint8)


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
        inpaint(arr, b, mode)
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
