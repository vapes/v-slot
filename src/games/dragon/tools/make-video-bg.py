"""
Animated background for Dragon Hoard (npm run dragon:video).

  art/bg-video.mp4  →  public/games/dragon/bg.mp4 (H.264) + bg.webm (VP9), no sound
  public/games/dragon/bg.jpg  →  public/games/dragon/overlay.webp

The video is only scenery (sky, castle, lava, gold). The parts of the old
background that belong to the game stay on top of it in overlay.webp: the
dragon perched on the frame (cut out by colour above the frame), the reel
frame, the BALANCE / WIN / BET plates and the fullscreen icon. Without the
video (autoplay refused, no codec) the game shows bg.jpg as before.

ui/spin.png is cut tighter (ring + wings, no mockup background around them)
so it sits on the video too; run this again after `npm run dragon:slice`.
"""
import subprocess
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

GAME = Path(__file__).resolve().parent.parent
OUT = GAME.parent.parent.parent / 'public' / 'games' / GAME.name
VIDEO = GAME / 'art' / 'bg-video.mp4'

DRAGON_BOTTOM = 400                  # the dragon is cut out above this line (source px)
FRAME = (10, 372, 958, 1262)         # reel frame incl. its ornaments
PLATES = [(20, 1280, 298, 1362), (318, 1280, 628, 1362), (650, 1280, 952, 1362)]
PLATE_R = 41
ICONS = [(912, 58, 42)]              # fullscreen icon (its hit zone is in DragonView)


def components(mask, keep):
    """Label 4-connected components of a bool mask; `keep(size, touches_edge)` decides which stay."""
    h, w = mask.shape
    lab = np.zeros(mask.shape, np.int32)
    out = np.zeros(mask.shape, bool)
    n = 0
    for y0, x0 in zip(*np.nonzero(mask)):
        if lab[y0, x0]:
            continue
        n += 1
        lab[y0, x0] = n
        q, pts, edge = deque([(y0, x0)]), [], False
        while q:
            y, x = q.popleft()
            pts.append((y, x))
            edge |= y == 0 or x == 0 or x == w - 1
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n
                    q.append((yy, xx))
        if keep(len(pts), edge):
            ys, xs = zip(*pts)
            out[list(ys), list(xs)] = True
    return out


def dragon_mask(bg):
    """Warm (red / orange / gold) pixels above the frame, cleaned up, holes filled."""
    hsv = np.asarray(bg.convert('HSV')).astype(int)[:DRAGON_BOTTOM]
    H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    warm = ((H <= 32) | (H >= 235)) & (S > 90) & (V > 60)
    m = Image.fromarray((warm * 255).astype(np.uint8))
    m = m.filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    body = components(np.asarray(m) > 127, lambda size, edge: size > 3000)
    holes = components(~body, lambda size, edge: not edge and size <= 4000)
    full = np.zeros((bg.height, bg.width), bool)
    full[:DRAGON_BOTTOM] = body | holes
    return full


def flood(mask, seeds):
    """Cells of `mask` reachable from `seeds` (4-connected)."""
    h, w = mask.shape
    out = np.zeros(mask.shape, bool)
    q = deque(p for p in seeds if mask[p])
    for p in q:
        out[p] = True
    while q:
        y, x = q.popleft()
        for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not out[yy, xx]:
                out[yy, xx] = True
                q.append((yy, xx))
    return out


def spin_cutout():
    """Keep the ring and the warm wings connected to it; drop the mockup background (idempotent)."""
    path = OUT / 'ui' / 'spin.png'
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    hsv = np.asarray(im.convert('RGB').convert('HSV')).astype(int)
    H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    warm = (H >= 8) & (H <= 48) & (S > 100) & (V > 90)
    warm[:int(h * 0.12)] = False  # the plate edge above the button
    m = Image.fromarray((warm * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(7))
    core = Image.new('L', (w, h), 0)
    cx, cy, r = w / 2, h * 0.47, h * 0.33
    ImageDraw.Draw(core).ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
    body = flood((np.asarray(m) > 127) | (np.asarray(core) > 127), [(int(cy), int(cx))])
    edge = [(y, x) for y in range(h) for x in (0, w - 1)] + [(y, x) for x in range(w) for y in (0, h - 1)]
    solid = ~flood(~body, edge)  # holes filled
    alpha = np.minimum(solid.astype(np.uint8) * 255, np.asarray(im.getchannel('A')))
    im.putalpha(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(1.5)))
    im.save(path, optimize=True)
    print('ui/spin.png cut out')


def overlay():
    bg = Image.open(OUT / 'bg.jpg').convert('RGB')
    shapes = Image.new('L', bg.size, 0)
    d = ImageDraw.Draw(shapes)
    d.rectangle(FRAME, fill=255)
    for box in PLATES:
        d.rounded_rectangle((box[0] - 3, box[1] - 3, box[2] + 3, box[3] + 3), PLATE_R, fill=255)
    for x, y, r in ICONS:
        d.ellipse((x - r, y - r, x + r, y + r), fill=255)
    alpha = np.maximum(np.asarray(shapes), dragon_mask(bg).astype(np.uint8) * 255)
    alpha = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(1.2))  # soft cut edges
    out = bg.convert('RGBA')
    out.putalpha(alpha)
    out.save(OUT / 'overlay.webp', quality=88, method=6)
    print('overlay.webp', (OUT / 'overlay.webp').stat().st_size // 1024, 'KB')


def video():
    common = ['ffmpeg', '-loglevel', 'error', '-y', '-i', str(VIDEO), '-an', '-vf', 'scale=720:1280']
    subprocess.run(common + ['-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-crf', '27',
                             '-preset', 'slow', '-movflags', '+faststart', str(OUT / 'bg.mp4')], check=True)
    subprocess.run(common + ['-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '38', '-row-mt', '1', str(OUT / 'bg.webm')], check=True)
    for f in ('bg.mp4', 'bg.webm'):
        print(f, (OUT / f).stat().st_size // 1024, 'KB')


if __name__ == '__main__':
    overlay()
    spin_cutout()
    video()
