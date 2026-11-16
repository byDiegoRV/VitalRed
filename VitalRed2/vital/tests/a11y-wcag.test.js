import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STYLES_PATH = path.resolve(__dirname, '../public/css/styles.css');

/**
 * Standard WCAG 2.1 relative luminance and contrast ratio algorithms.
 * W3C Recommendation: https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */
function hexToRgb(hex) {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const intVal = parseInt(clean, 16);
  return [(intVal >> 16) & 255, (intVal >> 8) & 255, intVal & 255];
}

function sRgbToLinear(channel8bit) {
  const s = channel8bit / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * sRgbToLinear(r) + 0.7152 * sRgbToLinear(g) + 0.0722 * sRgbToLinear(b);
}

export function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Extract CSS variables from a selector block in CSS text
 */
function extractCssVars(cssText, selectorPattern) {
  const match = cssText.match(selectorPattern);
  if (!match) return {};
  const block = match[1];
  const vars = {};
  const varRegex = /--([a-z0-9\-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = varRegex.exec(block)) !== null) {
    vars[`--${m[1]}`] = m[2].trim();
  }
  return vars;
}

describe('Accessibility & WCAG 2.1 AA Compliance (Tarea 13 / Tarea 17)', () => {
  const css = fs.readFileSync(STYLES_PATH, 'utf-8');
  const rootVars = extractCssVars(css, /:root\s*\{([^}]+)\}/);
  const darkVars = extractCssVars(css, /\[data-theme=dark\]\s*\{([^}]+)\}/);

  describe('Light Theme Color Tokens Contrast (WCAG AA >= 4.5:1)', () => {
    const cardBg = rootVars['--card'] || '#ffffff';
    const pageBg = rootVars['--bg'] || '#f6f7fb';

    test('Primary body text (--txt) on card background satisfies WCAG AA (>= 4.5:1)', () => {
      const ratio = contrastRatio(rootVars['--txt'], cardBg);
      assert.ok(ratio >= 4.5, `Expected ratio >= 4.5, got ${ratio.toFixed(2)}:1 for --txt on --card`);
    });

    test('Primary body text (--txt) on page background satisfies WCAG AA (>= 4.5:1)', () => {
      const ratio = contrastRatio(rootVars['--txt'], pageBg);
      assert.ok(ratio >= 4.5, `Expected ratio >= 4.5, got ${ratio.toFixed(2)}:1 for --txt on --bg`);
    });

    test('Muted label text (--mut) on card background satisfies WCAG AA (>= 4.5:1)', () => {
      const ratio = contrastRatio(rootVars['--mut'], cardBg);
      assert.ok(ratio >= 4.5, `Expected ratio >= 4.5, got ${ratio.toFixed(2)}:1 for --mut on --card`);
    });

    test('Alert/Error text (--red-text) on card background satisfies WCAG AA (>= 4.5:1)', () => {
      const ratio = contrastRatio(rootVars['--red-text'], cardBg);
      assert.ok(ratio >= 4.5, `Expected ratio >= 4.5, got ${ratio.toFixed(2)}:1 for --red-text on --card`);
    });

    test('Success text (--ok-text) on card background satisfies WCAG AA (>= 4.5:1)', () => {
      const ratio = contrastRatio(rootVars['--ok-text'], cardBg);
      assert.ok(ratio >= 4.5, `Expected ratio >= 4.5, got ${ratio.toFixed(2)}:1 for --ok-text on --card`);
    });

    test('Warning text (--warn-text) on card background satisfies WCAG AA (>= 4.5:1)', () => {
      const ratio = contrastRatio(rootVars['--warn-text'], cardBg);
      assert.ok(ratio >= 4.5, `Expected ratio >= 4.5, got ${ratio.toFixed(2)}:1 for --warn-text on --card`);
    });

    test('Interactive link text (--link / --blue-text) satisfies WCAG AA (>= 4.5:1)', () => {
      const ratio = contrastRatio(rootVars['--link'], cardBg);
      assert.ok(ratio >= 4.5, `Expected ratio >= 4.5, got ${ratio.toFixed(2)}:1 for --link on --card`);
    });

    test('Solid action button tokens with white text satisfy WCAG AA (>= 4.5:1)', () => {
      const solidTokens = [
        ['--red-solid', rootVars['--red-solid']],
        ['--red-solid2', rootVars['--red-solid2']],
        ['--ok-solid', rootVars['--ok-solid']],
        ['--warn-solid', rootVars['--warn-solid']],
        ['--blue-solid', rootVars['--blue-solid']]
      ];

      solidTokens.forEach(([name, color]) => {
        if (color && color.startsWith('#')) {
          const ratio = contrastRatio('#ffffff', color);
          assert.ok(
            ratio >= 4.5,
            `Expected ratio >= 4.5 for #ffffff on ${name} (${color}), got ${ratio.toFixed(2)}:1`
          );
        }
      });
    });
  });

  describe('Dark Theme Color Tokens Contrast (WCAG AA >= 4.5:1)', () => {
    const darkCard = darkVars['--card'] || '#141b2f';

    test('Dark theme body text (--txt) on dark card satisfies WCAG AA (>= 4.5:1)', () => {
      const ratio = contrastRatio(darkVars['--txt'], darkCard);
      assert.ok(ratio >= 4.5, `Expected ratio >= 4.5, got ${ratio.toFixed(2)}:1 for dark --txt`);
    });

    test('Dark theme muted text (--mut) on dark card satisfies WCAG AA (>= 4.5:1)', () => {
      const ratio = contrastRatio(darkVars['--mut'], darkCard);
      assert.ok(ratio >= 4.5, `Expected ratio >= 4.5, got ${ratio.toFixed(2)}:1 for dark --mut`);
    });

    test('Dark theme red text (--red-text) on dark card satisfies WCAG AA (>= 4.5:1)', () => {
      const ratio = contrastRatio(darkVars['--red-text'], darkCard);
      assert.ok(ratio >= 4.5, `Expected ratio >= 4.5, got ${ratio.toFixed(2)}:1 for dark --red-text`);
    });

    test('Dark theme ok text (--ok-text) on dark card satisfies WCAG AA (>= 4.5:1)', () => {
      const ratio = contrastRatio(darkVars['--ok-text'], darkCard);
      assert.ok(ratio >= 4.5, `Expected ratio >= 4.5, got ${ratio.toFixed(2)}:1 for dark --ok-text`);
    });

    test('Dark theme warning text (--warn-text) on dark card satisfies WCAG AA (>= 4.5:1)', () => {
      const ratio = contrastRatio(darkVars['--warn-text'], darkCard);
      assert.ok(ratio >= 4.5, `Expected ratio >= 4.5, got ${ratio.toFixed(2)}:1 for dark --warn-text`);
    });
  });

  describe('Touch Target Minimum Sizes (WCAG 2.5.5 / 2.5.8 >= 44x44px)', () => {
    test('.btn class defines minimum height >= 44px', () => {
      const btnMatch = css.match(/\.btn\s*\{[^}]*min-height\s*:\s*(\d+)px/);
      assert.ok(btnMatch, 'Could not find min-height for .btn');
      const minHeight = parseInt(btnMatch[1], 10);
      assert.ok(minHeight >= 44, `Expected .btn min-height >= 44px, got ${minHeight}px`);
    });

    test('Form inputs and selects define minimum height >= 44px', () => {
      const inputMatch = css.match(/input,select\s*\{[^}]*min-height\s*:\s*(\d+)px/);
      assert.ok(inputMatch, 'Could not find min-height for input,select');
      const minHeight = parseInt(inputMatch[1], 10);
      assert.ok(minHeight >= 44, `Expected input,select min-height >= 44px, got ${minHeight}px`);
    });

    test('Toggle buttons (.tbtn) define min-height and min-width >= 44px', () => {
      const minHMatch = css.match(/\.tbtn\s*\{[^}]*min-height\s*:\s*(\d+)px/);
      const minWMatch = css.match(/\.tbtn\s*\{[^}]*min-width\s*:\s*(\d+)px/);
      assert.ok(minHMatch, 'Could not find min-height for .tbtn');
      assert.ok(minWMatch, 'Could not find min-width for .tbtn');
      const minH = parseInt(minHMatch[1], 10);
      const minW = parseInt(minWMatch[1], 10);
      assert.ok(minH >= 44, `Expected .tbtn min-height >= 44px, got ${minH}px`);
      assert.ok(minW >= 44, `Expected .tbtn min-width >= 44px, got ${minW}px`);
    });
  });

  describe('Keyboard Focus Accessibility (WCAG 2.4.7 Focus Visible)', () => {
    test(':focus-visible indicator is explicitly configured in styles.css', () => {
      assert.ok(
        css.includes(':focus-visible'),
        'styles.css must contain explicit :focus-visible rules'
      );
      assert.ok(
        css.includes('outline'),
        ':focus-visible rule must set an outline for keyboard focus indication'
      );
    });
  });
});
