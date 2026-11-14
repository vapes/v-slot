// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderPaytable } from '../../src/engine/ui/paytableTemplate';
import { testConfig } from '../helpers';

const cfg = testConfig({ currency: { code: 'EUR', decimals: 2 } });

describe('renderPaytable', () => {
  it('fills placeholders with values for the current bet', () => {
    const html = renderPaytable('<head></head><p>{{rtp}} {{lines}} {{bet}} {{pay:A:3}} {{mult:B:3}} {{symbol:A}}</p>', cfg, 300, 'https://cdn/x/');
    expect(html).toContain('96.00% 3 3.00 EUR 10.00 EUR ×300 A');
    expect(html).toContain('<head><base href="https://cdn/x/">');
  });

  it('renders payline diagrams and asset URLs', () => {
    const html = renderPaytable('{{paylines}} {{asset:symbols/A.jpg}}', cfg, 30, '/');
    expect(html.match(/class="pl"/g)).toHaveLength(3);
    expect(html).toMatch(/http:\/\/[^"]*\/v-slot\/games\/test\/symbols\/A\.jpg/);
  });

  it('leaves unknown placeholders visible and escapes text', () => {
    const html = renderPaytable('{{nope}} {{t:<b>}}', cfg, 30, '/');
    expect(html).toContain('{{nope}}');
    expect(html).toContain('&lt;b&gt;');
  });
});
