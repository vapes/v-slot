import { Container, Sprite, Texture, VideoSource } from 'pixi.js';

export interface VideoBackdropOptions {
  /** Video URLs in preference order (e.g. H.264 .mp4, VP9 .webm): the browser plays the first it supports. */
  sources: string[];
  /** Still picture: shown until the video plays, and for good when it cannot autoplay. */
  still: Texture;
  /** Shown above the video only while it plays: the parts of the still picture the video scene lacks. */
  overlay?: Texture;
  /** Area to cover, game px (from 0, 0). */
  width: number;
  height: number;
}

const TYPES: Record<string, string> = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };

/**
 * Background that plays a looping video muted and inline, without any user
 * action. If the browser refuses (autoplay policy, low-power mode, no codec,
 * load error) the still picture simply stays. Every layer covers the area
 * (scaled to fill, centred, cropped). Visual only.
 */
export class VideoBackdrop {
  readonly container = new Container();
  private readonly still: Sprite;
  private readonly layers: Sprite[] = [];
  private el: HTMLVideoElement | null = null;
  private _tint = 0xFFFFFF;

  constructor(private opts: VideoBackdropOptions) {
    this.still = this.cover(new Sprite(opts.still));
    this.container.addChild(this.still);
  }

  /** Try to start the video; resolves true when it plays (the still picture is then hidden). */
  async start(): Promise<boolean> {
    if (typeof document === 'undefined' || !this.opts.sources.length) return false;
    const el = document.createElement('video');
    el.muted = el.defaultMuted = true; // muted + inline = allowed to autoplay
    el.setAttribute('muted', '');
    el.playsInline = true;
    el.setAttribute('playsinline', '');
    el.setAttribute('webkit-playsinline', '');
    el.loop = true;
    el.autoplay = true;
    el.preload = 'auto';
    for (const src of this.opts.sources) {
      const s = document.createElement('source');
      s.src = src;
      const type = TYPES[src.split('?')[0].split('.').pop()?.toLowerCase() ?? ''];
      if (type) s.type = type;
      el.appendChild(s);
    }
    try {
      await el.play();
    } catch {
      el.removeAttribute('src');
      return false; // autoplay refused or nothing playable: keep the still picture
    }
    this.el = el;
    const video = this.cover(new Sprite(new Texture({ source: new VideoSource({ resource: el, autoPlay: false }) })));
    this.layers.push(video);
    this.container.addChild(video);
    if (this.opts.overlay) {
      const over = this.cover(new Sprite(this.opts.overlay));
      this.layers.push(over);
      this.container.addChild(over);
    }
    this.still.visible = false;
    this.tint = this._tint;
    // the browser may pause it in a background tab; resume (still muted) when the page is back
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && el.paused) el.play().catch(() => undefined);
    });
    return true;
  }

  get playing(): boolean {
    return !!this.el && !this.el.paused;
  }

  /** Mood tint of every layer (e.g. a feature night). */
  set tint(value: number) {
    this._tint = value;
    this.still.tint = value;
    for (const l of this.layers) l.tint = value;
  }

  private cover(sprite: Sprite): Sprite {
    const { width: w, height: h } = this.opts;
    const fit = () => {
      const tw = sprite.texture.width || w;
      const th = sprite.texture.height || h;
      const k = Math.max(w / tw, h / th);
      sprite.scale.set(k);
      sprite.position.set((w - tw * k) / 2, (h - th * k) / 2);
    };
    fit();
    sprite.texture.source.on?.('resize', fit); // video size is known only once its metadata loads
    return sprite;
  }
}
