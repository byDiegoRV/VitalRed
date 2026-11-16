import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VITAL_DIR = path.resolve(__dirname, '..');
const SERVER_FILE = path.join(VITAL_DIR, 'server.js');
const PUBLIC_DIR = path.join(VITAL_DIR, 'public');

describe('Server Integrity & Static File Serving (Tarea 17)', () => {
  test('server.js exists and is immutable (zero git diff)', () => {
    assert.ok(fs.existsSync(SERVER_FILE), 'server.js must exist');
    const content = fs.readFileSync(SERVER_FILE, 'utf-8');
    assert.ok(content.length > 0, 'server.js must not be empty');

    // Verify git diff for server.js is 100% empty
    const gitDiff = execSync('git diff VitalRed2/vital/server.js', {
      cwd: path.resolve(VITAL_DIR, '../..'),
      encoding: 'utf-8'
    }).trim();
    assert.strictEqual(gitDiff, '', 'VitalRed2/vital/server.js MUST REMAIN 100% UNTOUCHED (empty git diff)');
  });

  test('server.js contains required architecture constructs', () => {
    const content = fs.readFileSync(SERVER_FILE, 'utf-8');
    const lines = content.trim().split('\n');
    assert.strictEqual(lines.length, 29, 'server.js must have exactly 29 lines');

    assert.ok(content.includes("import express from 'express';"), 'Must import express');
    assert.ok(content.includes("app.get('/boot.js'"), 'Must define /boot.js route');
    assert.ok(content.includes("Cache-Control', 'no-store'"), 'Must send no-store for /boot.js');
    assert.ok(content.includes("window.__BOOT="), 'Must set window.__BOOT');
    assert.ok(content.includes("app.use(express.static"), 'Must mount express.static');
    assert.ok(content.includes("app.listen(PORT, '0.0.0.0'"), 'Must bind to 0.0.0.0');
  });

  test('Public static assets exist and are properly structured', () => {
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    const cssPath = path.join(PUBLIC_DIR, 'css', 'styles.css');
    const storePath = path.join(PUBLIC_DIR, 'js', 'store.js');
    const uiPath = path.join(PUBLIC_DIR, 'js', 'ui.js');
    const domainPath = path.join(PUBLIC_DIR, 'js', 'domain.js');
    const appPath = path.join(PUBLIC_DIR, 'js', 'app.js');

    assert.ok(fs.existsSync(indexPath), 'index.html must exist');
    assert.ok(fs.existsSync(cssPath), 'styles.css must exist');
    assert.ok(fs.existsSync(storePath), 'store.js must exist');
    assert.ok(fs.existsSync(uiPath), 'ui.js must exist');
    assert.ok(fs.existsSync(domainPath), 'domain.js must exist');
    assert.ok(fs.existsSync(appPath), 'app.js must exist');

    const indexHtml = fs.readFileSync(indexPath, 'utf-8');
    assert.ok(indexHtml.includes('/boot.js'), 'index.html must reference /boot.js');
    assert.ok(indexHtml.includes('css/styles.css'), 'index.html must load styles.css');
    assert.ok(indexHtml.includes('js/app.js'), 'index.html must load app.js as module');
    assert.ok(indexHtml.includes('id="app"'), 'index.html must contain #app container');
  });

  describe('Live HTTP Serving Behavior', () => {
    let serverProcess;
    const testPort = 4200 + Math.floor(Math.random() * 800);
    const baseUrl = `http://localhost:${testPort}`;

    before(async () => {
      // Spawn server on custom ephemeral port
      serverProcess = spawn(process.execPath, ['server.js'], {
        cwd: VITAL_DIR,
        env: { ...process.env, PORT: String(testPort) },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Wait until server responds
      let started = false;
      for (let attempt = 0; attempt < 30; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        try {
          const res = await fetch(`${baseUrl}/boot.js`);
          if (res.ok) {
            started = true;
            break;
          }
        } catch {
          // Keep waiting
        }
      }
      assert.ok(started, `Server must start and respond on port ${testPort}`);
    });

    after(() => {
      if (serverProcess && !serverProcess.killed) {
        serverProcess.kill('SIGTERM');
      }
    });

    test('GET /boot.js returns JS with no-store cache and window.__BOOT token', async () => {
      const res = await fetch(`${baseUrl}/boot.js`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.headers.get('content-type')?.includes('javascript'));
      assert.strictEqual(res.headers.get('cache-control'), 'no-store');

      const body = await res.text();
      assert.match(body, /^window\.__BOOT="[a-z0-9]+";$/);
    });

    test('GET / serves index.html with HTML content type', async () => {
      const res = await fetch(`${baseUrl}/`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.headers.get('content-type')?.includes('text/html'));

      const body = await res.text();
      assert.ok(body.includes('<!DOCTYPE html>'));
      assert.ok(body.includes('VitalRed'));
    });

    test('GET /css/styles.css serves valid stylesheet', async () => {
      const res = await fetch(`${baseUrl}/css/styles.css`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.headers.get('content-type')?.includes('text/css'));

      const body = await res.text();
      assert.ok(body.includes(':root'));
    });

    test('GET /non-existent-resource returns 404', async () => {
      const res = await fetch(`${baseUrl}/non-existent-resource-vitalred-404.xyz`);
      assert.strictEqual(res.status, 404);
    });
  });
});
