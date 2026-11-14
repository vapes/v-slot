/**
 * Minimal DOM-based JSX runtime.
 *
 * Usage in .tsx files:
 *   import { h } from './jsx';
 *   // TypeScript uses jsxFactory:"h" from tsconfig, esbuild reads it too.
 *
 * Supported:
 *   - HTML tag strings → HTMLElement
 *   - Function components (props) → HTMLElement
 *   - class, style (string), on* event handlers, boolean/string attrs
 *   - Children: string | number | HTMLElement | arrays (auto-flattened)
 */

export type LeafChild = Node | string | number | boolean | null | undefined;
export type Child = LeafChild | Child[];

type Props = Record<string, unknown> | null;
type ComponentFn<P extends Record<string, unknown> = Record<string, unknown>> =
  (props: P) => HTMLElement;

function flatten(children: Child[]): LeafChild[] {
  const out: LeafChild[] = [];
  for (const c of children) {
    if (Array.isArray(c)) out.push(...flatten(c));
    else out.push(c);
  }
  return out;
}

export function h(
  tag: string | ComponentFn,
  props: Props,
  ...rawChildren: Child[]
): HTMLElement {
  if (typeof tag === 'function') {
    // Function component — pass props only (children embedded inside component body)
    return tag(props ?? {} as Record<string, unknown>);
  }

  const el = document.createElement(tag);

  if (props) {
    for (const [key, val] of Object.entries(props)) {
      if (val === null || val === undefined || val === false) continue;

      if (key === 'class') {
        el.className = String(val);
      } else if (key === 'style' && typeof val === 'string') {
        el.setAttribute('style', val);
      } else if (key.startsWith('on') && key.length > 2 && typeof val === 'function') {
        // onClick → click, onPointerdown → pointerdown, etc.
        el.addEventListener(key.slice(2).toLowerCase(), val as EventListener);
      } else if (val === true) {
        el.setAttribute(key, '');
      } else {
        el.setAttribute(key, String(val));
      }
    }
  }

  for (const child of flatten(rawChildren)) {
    if (child == null || child === false || child === true) continue;
    if (typeof child === 'string' || typeof child === 'number') {
      el.appendChild(document.createTextNode(String(child)));
    } else if (child instanceof Node) {
      el.appendChild(child);
    }
  }

  return el;
}

// JSX type declarations — makes TypeScript happy with any attribute on any tag.
declare global {
  namespace JSX {
    type Element = HTMLElement;
    interface IntrinsicElements {
      [tag: string]: Record<string, unknown>;
    }
  }
}
