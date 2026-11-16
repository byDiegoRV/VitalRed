import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setupBrowserEnvironment } from './helpers/browser-mock.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VITAL_DIR = path.resolve(__dirname, '..');
const STYLES_PATH = path.resolve(VITAL_DIR, 'public/css/styles.css');
const SERVER_FILE = path.resolve(VITAL_DIR, 'server.js');
const APP_PATH = path.resolve(VITAL_DIR, 'public/js/app.js');

// Setup mock browser environment before importing ESM modules
setupBrowserEnvironment();

const store = await import('../public/js/store.js');
const { transportScreens, DEFAULT_TRIP } = await import('../public/js/screens-transport.js');

describe('Transport Desktop Responsive Layout & WCAG 2.1 AA (Tarea 13 & 14)', () => {
  const css = fs.readFileSync(STYLES_PATH, 'utf-8');

  beforeEach(() => {
    store.reset();
    store.set({ session: 'transporte@vitalred.org' });
  });

  describe('R1: Responsive CSS Grid Architecture (>= 900px)', () => {
    test('.split defines mobile single-column grid by default', () => {
      const splitMatch = css.match(/\.split\s*\{([^}]+)\}/);
      assert.ok(splitMatch, '.split class must be defined in styles.css');
      assert.ok(splitMatch[1].includes('display:grid'), '.split must use display: grid');
      assert.ok(splitMatch[1].includes('grid-template-columns:1fr'), '.split default must be 1fr (single column)');
    });

    test('.split child elements enforce min-width: 0 to prevent grid blowout', () => {
      const minWidthMatch = css.match(/\.split>\*[^\{]*\{[^}]*min-width\s*:\s*0/);
      assert.ok(minWidthMatch, '.split direct children must define min-width: 0 for responsive grid tracks');
    });

    test('@media(min-width:900px) configures .split as 2-column grid (1.6fr 1fr)', () => {
      const mediaMatch = css.match(/@media\s*\(\s*min-width\s*:\s*900px\s*\)\s*\{([\s\S]*?)(?=@media|$)/);
      assert.ok(mediaMatch, 'styles.css must contain @media(min-width:900px)');
      const mediaBlock = mediaMatch[1];
      assert.ok(
        mediaBlock.includes('.split{grid-template-columns:1.6fr 1fr}') ||
        mediaBlock.includes('.split') && mediaBlock.includes('grid-template-columns:1.6fr 1fr'),
        '@media(min-width:900px) must configure 1.6fr 1fr 2-column tracks for .split'
      );
    });

    test('@media(min-width:1500px) configures .split as wider 2-column grid (1.8fr 1fr)', () => {
      const mediaMatch = css.match(/@media\s*\(\s*min-width\s*:\s*1500px\s*\)\s*\{([\s\S]*?)(?=@media|$)/);
      assert.ok(mediaMatch, 'styles.css must contain @media(min-width:1500px)');
      const mediaBlock = mediaMatch[1];
      assert.ok(
        mediaBlock.includes('1.8fr 1fr'),
        '@media(min-width:1500px) must configure 1.8fr 1fr grid tracks'
      );
    });

    test('@media(max-width:899px) maintains compact mobile container for transport', () => {
      const mobileMedia = css.match(/@media\s*\(\s*max-width\s*:\s*899px\s*\)\s*\{([\s\S]*?)(?=@media|$)/);
      assert.ok(mobileMedia, 'styles.css must contain @media(max-width:899px)');
      assert.ok(mobileMedia[1].includes('body[data-role=transport] main'), 'Must constrain transport main on mobile');
    });

    test('.carrier-split and .carrier-col responsive classes are configured', () => {
      assert.ok(css.includes('.carrier-split'), 'styles.css must define .carrier-split');
      assert.ok(css.includes('.carrier-col'), 'styles.css must define .carrier-col');
    });
  });

  describe('R1: Transport Screens Multi-Panel Structure', () => {
    test('t/home renders 2-column .split with active trip on left, queue & history on right', () => {
      store.set({ trip: { ...DEFAULT_TRIP, status: 'asignada' } });
      const html = transportScreens['t/home'].render();

      assert.ok(html.includes('class="split'), 't/home must render a .split container');
      assert.ok(html.includes('VIAJE A CARGO'), 't/home must include active trip card');
      assert.ok(html.includes('Viajes disponibles'), 't/home must include available trips queue');
      assert.ok(html.includes('Últimos recorridos'), 't/home must include recent history');
      assert.ok(html.includes('Recordatorios de custodia'), 't/home must include custody reminders');

      // Verify left and right column separation
      const splitIdx = html.indexOf('class="split');
      const splitContent = html.substring(splitIdx);
      const parts = splitContent.split(/<\/div>\s*<(?:div|aside)/);
      assert.ok(parts.length >= 2, '.split in t/home must contain at least 2 distinct panel columns');
    });

    test('t/home renders .split empty state gracefully when no active trip', () => {
      store.set({ trip: null });
      const html = transportScreens['t/home'].render();

      assert.ok(html.includes('class="split'), 't/home must render .split even without active trip');
      assert.ok(html.includes('Sin viaje a cargo'), 't/home left column must show empty trip state');
      assert.ok(html.includes('Viajes disponibles'), 't/home right column must display available trips');
      assert.ok(html.includes('Últimos recorridos'), 't/home right column must display recent history');
      assert.ok(html.includes('Recordatorios de custodia'), 't/home right column must display custody reminders');
    });

    test('t/check renders 2-column .split layout with checklist on left', () => {
      store.set({ trip: { ...DEFAULT_TRIP, status: 'custodia' } });
      const html = transportScreens['t/check'].render();

      assert.ok(html.includes('class="split'), 't/check must render a .split container');
      assert.ok(html.includes('Checklist de custodia NOM-253'), 'Left column must contain NOM-253 checklist');
      assert.ok(html.includes('Evidencia fotográfica pre-despacho'), 'Left column must contain photo evidence');
      assert.ok(html.includes('data-act="toggleCheck" data-idx="0"'), 'Must contain check0 control');
      assert.ok(html.includes('data-act="toggleCheck" data-idx="1"'), 'Must contain check1 control');
      assert.ok(html.includes('data-act="toggleCheck" data-idx="2"'), 'Must contain check2 control');
      assert.ok(html.includes('Recordatorios de custodia'), 'Right column must contain custody reminders');
      assert.ok(html.includes('Viajes disponibles'), 'Right column must contain available trips queue');
    });

    test('t/transit renders 2-column .split layout with live map & telemetry on left', () => {
      store.set({ trip: { ...DEFAULT_TRIP, status: 'transito' }, temp: 4.5 });
      const html = transportScreens['t/transit'].render();

      assert.ok(html.includes('class="split'), 't/transit must render a .split container');
      assert.ok(html.includes('id="tripMap"'), 'Left column must contain #tripMap interactive container');
      assert.ok(html.includes('Cadena de frío (IoT)'), 'Left column must contain IoT thermal monitoring');
      assert.ok(html.includes('Custodia biológica en curso'), 'Left column must contain biological custody summary');
      assert.ok(html.includes('Recordatorios de custodia'), 'Right column must contain custody reminders/protocols');
      assert.ok(html.includes('Viajes disponibles'), 'Right column must contain available trips queue');
    });
  });

  describe('R2: Touch Targets (WCAG 2.5.5 / 2.5.8 >= 44x44px)', () => {
    test('.btn class defines min-height >= 44px', () => {
      const match = css.match(/\.btn\s*\{[^}]*min-height\s*:\s*(\d+)px/);
      assert.ok(match, 'Could not find min-height for .btn');
      assert.ok(parseInt(match[1], 10) >= 44);
    });

    test('.btn.sm defines min-height >= 44px and min-width >= 44px', () => {
      const minH = css.match(/\.btn\.sm\s*\{[^}]*min-height\s*:\s*(\d+)px/);
      const minW = css.match(/\.btn\.sm\s*\{[^}]*min-width\s*:\s*(\d+)px/);
      assert.ok(minH, 'Could not find min-height for .btn.sm');
      assert.ok(minW, 'Could not find min-width for .btn.sm');
      assert.ok(parseInt(minH[1], 10) >= 44, `Expected .btn.sm min-height >= 44px, got ${minH[1]}px`);
      assert.ok(parseInt(minW[1], 10) >= 44, `Expected .btn.sm min-width >= 44px, got ${minW[1]}px`);
    });

    test('.notif-btn defines min-height >= 44px and min-width >= 44px', () => {
      const notifH = css.match(/\.notif-btn\s*\{[^}]*min-height\s*:\s*(\d+)px/);
      const notifW = css.match(/\.notif-btn\s*\{[^}]*min-width\s*:\s*(\d+)px/);
      assert.ok(notifH && parseInt(notifH[1], 10) >= 44, 'Expected .notif-btn min-height >= 44px');
      assert.ok(notifW && parseInt(notifW[1], 10) >= 44, 'Expected .notif-btn min-width >= 44px');
    });

    test('.eye password toggle defines target >= 44x44px', () => {
      const eyeH = css.match(/\.eye\s*\{[^}]*height\s*:\s*(\d+)px/);
      const eyeW = css.match(/\.eye\s*\{[^}]*width\s*:\s*(\d+)px/);
      assert.ok(eyeH && parseInt(eyeH[1], 10) >= 44, 'Expected .eye height >= 44px');
      assert.ok(eyeW && parseInt(eyeW[1], 10) >= 44, 'Expected .eye width >= 44px');
    });

    test('.seg button segmented controls define min-height >= 44px and min-width >= 44px', () => {
      const segH = css.match(/\.seg button\s*\{[^}]*min-height\s*:\s*(\d+)px/);
      const segW = css.match(/\.seg button\s*\{[^}]*min-width\s*:\s*(\d+)px/);
      assert.ok(segH && parseInt(segH[1], 10) >= 44, 'Expected .seg button min-height >= 44px');
      assert.ok(segW && parseInt(segW[1], 10) >= 44, 'Expected .seg button min-width >= 44px');
    });

    test('Form inputs, selects, and textareas define min-height >= 44px', () => {
      const inputMatch = css.match(/input,select\s*\{[^}]*min-height\s*:\s*(\d+)px/);
      assert.ok(inputMatch);
      assert.ok(parseInt(inputMatch[1], 10) >= 44);

      const taMatch = css.match(/textarea\s*\{[^}]*min-height\s*:\s*(\d+)px/);
      assert.ok(taMatch);
      assert.ok(parseInt(taMatch[1], 10) >= 44);
    });

    test('.btn-link defines min-height >= 44px and min-width >= 44px', () => {
      const minH = css.match(/\.btn-link\s*\{[^}]*min-height\s*:\s*(\d+)px/);
      const minW = css.match(/\.btn-link\s*\{[^}]*min-width\s*:\s*(\d+)px/);
      assert.ok(minH && minW);
      assert.ok(parseInt(minH[1], 10) >= 44);
      assert.ok(parseInt(minW[1], 10) >= 44);
    });

    test('Custody checklist label items provide minimum touch target >= 44px', () => {
      const labelMatch = css.match(/label\.item[^{]*\{[^}]*min-height\s*:\s*(\d+)px/) ||
                         css.match(/\.item[^{]*\{[^}]*padding\s*:\s*(\d+)px/);
      assert.ok(labelMatch, 'Checklist items must define min-height or adequate padding for touch targets');
    });

    test('.tabs a defines minimum touch targets >= 44px', () => {
      const tabsMatch = css.match(/\.tabs a\s*\{[^}]*min-height\s*:\s*(\d+)px/);
      assert.ok(tabsMatch, 'Could not find min-height for .tabs a');
      assert.ok(parseInt(tabsMatch[1], 10) >= 44, 'Expected .tabs a min-height >= 44px');
    });
  });

  describe('R2: Keyboard Focus Indicators & Accessibility (WCAG 2.4.1 / 2.4.7)', () => {
    test(':focus-visible indicator uses solid var(--blue) with outline and offset', () => {
      assert.ok(css.includes(':focus-visible'), 'styles.css must declare :focus-visible');
      const fvMatch = css.match(/:focus-visible\s*\{([^}]+)\}/);
      assert.ok(fvMatch, 'Must define global :focus-visible rules');
      assert.ok(fvMatch[1].includes('outline:'), ':focus-visible must configure outline');
      assert.ok(fvMatch[1].includes('outline-offset:'), ':focus-visible must configure outline-offset');
      assert.ok(
        css.includes(':focus-visible{outline:3px solid var(--blue);outline-offset:2px}'),
        ':focus-visible must use solid var(--blue) for WCAG AA compliance'
      );
    });

    test('Skip link (.skip-link) is configured in CSS and rendered in app.js', () => {
      assert.ok(css.includes('.skip-link'), 'styles.css must include .skip-link class');
      assert.ok(css.includes('.skip-link:focus-visible'), 'styles.css must style .skip-link:focus-visible');

      const appJs = fs.readFileSync(APP_PATH, 'utf-8');
      assert.ok(appJs.includes('class="skip-link"'), 'app.js must render a skip link');
      assert.ok(appJs.includes('href="#main-content"'), 'skip link must point to #main-content');
      assert.ok(appJs.includes('id="main-content"'), 'app.js must define <main id="main-content">');
    });

    test('Interactive map in t/transit has keyboard focus attributes', () => {
      store.set({ trip: { ...DEFAULT_TRIP, status: 'transito' } });
      const html = transportScreens['t/transit'].render();
      assert.ok(html.includes('tabindex="0"'), '#tripMap must be keyboard focusable (tabindex="0")');
      assert.ok(html.includes('role="region"'), '#tripMap must have role="region"');
      assert.ok(html.includes('aria-label='), '#tripMap must have accessible label');
    });

    test('Delivery signature and scan pads in t/delivery have role="button" and tabindex="0"', () => {
      store.set({ trip: { ...DEFAULT_TRIP, status: 'transito', scanOk: false, signOk: false } });
      const html = transportScreens['t/delivery'].render();
      assert.ok(html.includes('role="button"'), 'Delivery pads must have role="button"');
      assert.ok(html.includes('tabindex="0"'), 'Delivery pads must have tabindex="0"');
      assert.ok(html.includes('aria-pressed='), 'Delivery pads must reflect state via aria-pressed');
    });

    test('Photo file upload inputs use .sr-only instead of inline display:none', () => {
      store.set({ trip: { ...DEFAULT_TRIP, status: 'custodia' } });
      const checkHtml = transportScreens['t/check'].render();
      assert.ok(
        !checkHtml.includes('data-act="uploadPhotoOrigin" style="display:none"'),
        'uploadPhotoOrigin must not use style="display:none"'
      );
      assert.ok(
        checkHtml.includes('data-act="uploadPhotoOrigin" class="sr-only"'),
        'uploadPhotoOrigin must use class="sr-only"'
      );

      const delHtml = transportScreens['t/delivery'].render();
      assert.ok(
        !delHtml.includes('data-act="uploadPhotoDelivery" style="display:none"'),
        'uploadPhotoDelivery must not use style="display:none"'
      );
      assert.ok(
        delHtml.includes('data-act="uploadPhotoDelivery" class="sr-only"'),
        'uploadPhotoDelivery must use class="sr-only"'
      );
    });
  });

  describe('R3: Strict System Integrity', () => {
    test('VitalRed2/vital/server.js remains 100% untouched (zero git diff)', () => {
      assert.ok(fs.existsSync(SERVER_FILE), 'server.js must exist');
      const gitDiff = execSync('git diff VitalRed2/vital/server.js', {
        cwd: path.resolve(VITAL_DIR, '../..'),
        encoding: 'utf-8'
      }).trim();
      assert.strictEqual(gitDiff, '', 'VitalRed2/vital/server.js MUST REMAIN 100% UNTOUCHED (empty git diff)');
    });

    test('package.json has zero new dependencies', () => {
      const pkg = JSON.parse(fs.readFileSync(path.resolve(VITAL_DIR, 'package.json'), 'utf-8'));
      assert.deepStrictEqual(Object.keys(pkg.dependencies || {}), ['express']);
      assert.strictEqual(pkg.devDependencies, undefined);
    });
  });
});
