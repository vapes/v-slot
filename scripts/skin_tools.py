"""
Shared helpers for the per-game skin slicers (src/games/<id>/tools/slice-skin.py).

Erasing baked text from a mockup:
  erase_box(arr, box)                  smooth fill of a rectangle from its surroundings (value texts on flat panels)
  inpaint(arr, box, mode, grow=3)      harmonic inpainting of glyph pixels only (captions on buttons/plates)
    mode: 'gold' | 'white' text colour, 'box' whole box, 'disc' ellipse inside the box (remove a round button)

Import from a slicer with:
    sys.path.insert(0, str(REPO / 'scripts')); from skin_tools import erase_box, inpaint
"""
import numpy as np
from PIL import Image, ImageFilter


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


def text_mask(patch, mode, grow=3):
    """Boolean mask of glyph pixels in an RGB patch (mode: gold | white | box)."""
    R, G, B = (patch[..., i].astype(int) for i in range(3))
    if mode == 'box':
        return np.ones(R.shape, bool)
    if mode == 'disc':
        h, w = R.shape
        yy, xx = np.mgrid[:h, :w]
        return (xx - w / 2 + 0.5) ** 2 / (w / 2) ** 2 + (yy - h / 2 + 0.5) ** 2 / (h / 2) ** 2 <= 1
    if mode == 'gold':
        m = (R > 140) & (G > 95) & (B < 130) & (R - B > 55)
    else:  # white text
        m = (R > 165) & (G > 165) & (B > 165)
    # dilate so anti-aliased edges and dark glyph outlines are included
    for _ in range(grow):
        m = m | np.roll(m, 1, 0) | np.roll(m, -1, 0) | np.roll(m, 1, 1) | np.roll(m, -1, 1)
    return m


def inpaint(arr, box, mode, grow=3, pad=6, iterations=400):
    """Harmonic inpainting: masked pixels relax to the average of their neighbours."""
    x0, y0, x1, y1 = box
    X0, Y0, X1, Y1 = x0 - pad, y0 - pad, x1 + pad, y1 + pad
    patch = arr[Y0:Y1, X0:X1].astype(float)
    mask = np.zeros(patch.shape[:2], bool)
    mask[pad:-pad, pad:-pad] = text_mask(arr[y0:y1, x0:x1], mode, grow)
    known = ~mask
    patch[mask] = patch[known].mean(axis=0)
    for _ in range(iterations):
        avg = (np.roll(patch, 1, 0) + np.roll(patch, -1, 0) + np.roll(patch, 1, 1) + np.roll(patch, -1, 1)) / 4
        patch[mask] = avg[mask]
    arr[Y0:Y1, X0:X1] = np.clip(patch, 0, 255).astype(np.uint8)
