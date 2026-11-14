import type { SlotConfig } from '../config/SlotConfig';
import { fetchText, paytableUrl } from '../content/cdn';
import { FALLBACK_LANG, i18n } from '../i18n/I18n';
import { renderPaytable } from './paytableTemplate';

/**
 * Paytable overlay: an HTML template from the content CDN
 * (paytables/<gameId>/<lang>.html) rendered into a sandboxed iframe that
 * covers the game canvas. The sandbox has no permissions, so CDN content
 * cannot run scripts or touch the game page.
 */
export class HtmlPaytable {
  private root: HTMLDivElement;
  private frame: HTMLIFrameElement;
  private open = false;
  private templates = new Map<string, Promise<{ html: string; url: string }>>();

  constructor(private cfg: SlotConfig, private canvas: HTMLCanvasElement) {
    this.root = document.createElement('div');
    Object.assign(this.root.style, {
      position: 'absolute', display: 'none', zIndex: '10', background: '#000', overflow: 'hidden',
    });

    this.frame = document.createElement('iframe');
    this.frame.setAttribute('sandbox', '');
    this.frame.setAttribute('title', 'Paytable');
    Object.assign(this.frame.style, { width: '100%', height: '100%', border: '0', display: 'block' });

    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '✕';
    close.setAttribute('aria-label', 'Close');
    Object.assign(close.style, {
      position: 'absolute', top: '12px', right: '12px', width: '40px', height: '40px', borderRadius: '50%',
      border: '2px solid rgba(255,214,90,.9)', background: 'rgba(10,10,20,.85)', color: '#FFD65A',
      font: 'bold 18px Arial, sans-serif', cursor: 'pointer', zIndex: '1',
    });
    close.addEventListener('click', () => this.hide());

    this.root.append(this.frame, close);
    document.body.appendChild(this.root);
    window.addEventListener('resize', () => this.place());
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** Open with payouts rendered for the given total bet (minor units). */
  async show(totalBet: number): Promise<void> {
    this.open = true;
    this.place();
    this.root.style.display = 'block';
    try {
      const { html, url } = await this.template(i18n.language);
      if (!this.open) return;
      this.frame.srcdoc = renderPaytable(html, this.cfg, totalBet, url.slice(0, url.lastIndexOf('/') + 1));
    } catch (err) {
      console.error('[HtmlPaytable]', err);
      this.frame.srcdoc = '<body style="background:#000;color:#fff;font:16px Arial;padding:80px 24px;text-align:center">'
        + 'Paytable is unavailable. Check your connection and try again.</body>';
    }
  }

  hide(): void {
    this.open = false;
    this.root.style.display = 'none';
  }

  toggle(totalBet: number): void {
    if (this.open) this.hide();
    else void this.show(totalBet);
  }

  /** Cached fetch: current language first, then English. */
  private template(lang: string): Promise<{ html: string; url: string }> {
    let p = this.templates.get(lang);
    if (!p) {
      const load = async (l: string) => {
        const url = paytableUrl(this.cfg.id, l);
        return { html: await fetchText(url), url };
      };
      p = load(lang).catch((err) => {
        if (lang === FALLBACK_LANG) throw err;
        console.warn(`[HtmlPaytable] no ${lang} paytable, using ${FALLBACK_LANG}`);
        return load(FALLBACK_LANG);
      });
      p.catch(() => this.templates.delete(lang));
      this.templates.set(lang, p);
    }
    return p;
  }

  /** Cover the (letterboxed) canvas exactly. */
  private place(): void {
    const r = this.canvas.getBoundingClientRect();
    Object.assign(this.root.style, {
      left: `${r.left + window.scrollX}px`, top: `${r.top + window.scrollY}px`,
      width: `${r.width}px`, height: `${r.height}px`,
    });
  }
}
