import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cssPath = path.resolve(__dirname, '../public/css/styles.css');
const css = fs.readFileSync(cssPath, 'utf8');

describe('Mobile Multi-Role Responsive Navigation & Layout (Issue #14)', () => {
  describe('Universal Bottom Navigation Bar on Mobile (<= 899px)', () => {
    it('applies fixed bottom navigation bar to all authenticated roles', () => {
      // Must cover medical, bank, transport, donor via body[data-role]:not([data-role=guest])
      assert.ok(
        css.includes('body[data-role]:not([data-role=guest]) .tabs') ||
        (css.includes('body[data-role=medical] .tabs') && css.includes('body[data-role=bank] .tabs')),
        'CSS must define mobile bottom tabs for all authenticated roles'
      );
      assert.ok(css.includes('position:fixed;bottom:0') || css.includes('position: fixed; bottom: 0') || css.includes('position:fixed;\n    bottom:0'), 'Tabs must be fixed at bottom on mobile');
    });

    it('enforces safe area padding and z-index on mobile tabs', () => {
      assert.ok(css.includes('safe-area-inset-bottom'), 'Tabs must support mobile safe area inset');
      assert.ok(css.includes('z-index:100') || css.includes('z-index: 100') || css.includes('z-index:90'), 'Mobile tabs must have sufficient z-index');
    });

    it('enforces touch targets >= 44x44px and vertical orientation on mobile tab items', () => {
      assert.ok(css.includes('flex-direction:column') || css.includes('flex-direction: column'), 'Mobile tabs must stack icon and label vertically');
      assert.ok(css.includes('min-height:48px') || css.includes('min-height: 48px') || css.includes('min-height:44px'), 'Mobile tab links must satisfy WCAG touch height >= 44px');
    });

    it('ensures main content has safe bottom padding on mobile so content is not obscured', () => {
      assert.ok(
        css.includes('padding-bottom:calc(96px') || css.includes('padding-bottom: calc(96px') || css.includes('padding-bottom:calc(92px') || css.includes('padding-bottom:calc(88px'),
        'Main content must have generous bottom padding on mobile to clear the bottom bar'
      );
    });
  });

  describe('Mobile Floating Action Button (.fab) Positioning', () => {
    it('positions .fab above the bottom navigation bar on mobile without overlap', () => {
      assert.ok(
        css.includes('.fab{position:fixed;bottom:calc(76px') ||
        css.includes('.fab { position: fixed; bottom: calc(76px') ||
        css.includes('.fab{position:fixed;bottom:calc('),
        '.fab button must float above the bottom nav bar with safe area offset'
      );
    });
  });

  describe('Responsive Data Grids & Compact Cards (<= 600px)', () => {
    it('configures elastic KPI grids and radar cards on narrow screens', () => {
      assert.ok(css.includes('.grid.kpi{grid-template-columns:1fr 1fr'), 'KPI cards must use 2 columns on mobile');
      assert.ok(css.includes('.radar-card-tab{flex:0 0 220px') || css.includes('.radar-card-tab{flex:0 0 240px'), 'Radar cards must remain compact and scrollable on mobile');
    });
  });
});
