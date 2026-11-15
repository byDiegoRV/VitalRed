import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupBrowserEnvironment } from './helpers/browser-mock.js';

setupBrowserEnvironment();

const { DEFAULT_FIREBASE_CONFIG, DEFAULT_ROOM_ID, getFirebaseConfig, getSyncRoom, setSyncRoom } = await import('../public/js/firebase-config.js');
const { getSyncStatus, onSyncStatusChange, isApplyingRemote } = await import('../public/js/firebase-sync.js');
const { get, set } = await import('../public/js/store.js');

describe('Real-Time Multi-Device Firebase Sync (Issue #16)', () => {
  beforeEach(() => {
    setSyncRoom(DEFAULT_ROOM_ID);
  });

  describe('Firebase Config Contract & Room Management', () => {
    it('provides valid default Firebase config for VitalRed', () => {
      const cfg = getFirebaseConfig();
      assert.ok(cfg.projectId, 'projectId must be defined');
      assert.strictEqual(cfg.projectId, 'vitalred-demo-972995');
      assert.ok(cfg.apiKey, 'apiKey must be defined');
      assert.ok(cfg.appId, 'appId must be defined');
    });

    it('defaults to shared room "guardia-central"', () => {
      assert.strictEqual(DEFAULT_ROOM_ID, 'guardia-central');
      assert.strictEqual(getSyncRoom(), 'guardia-central');
    });

    it('allows updating and retrieving the active sync room', () => {
      setSyncRoom('sala-urgencias-hospital-general');
      assert.strictEqual(getSyncRoom(), 'sala-urgencias-hospital-general');
      setSyncRoom(DEFAULT_ROOM_ID);
      assert.strictEqual(getSyncRoom(), DEFAULT_ROOM_ID);
    });
  });

  describe('Sync Status & Graceful Local Fallback', () => {
    it('returns valid sync status model', () => {
      const status = getSyncStatus();
      assert.ok(['local', 'connecting', 'online', 'error'].includes(status.status));
      assert.ok(typeof status.room === 'string');
    });

    it('subscribes and receives sync status updates', () => {
      let received = null;
      const unsubscribe = onSyncStatusChange((s) => {
        received = s;
      });
      assert.ok(received, 'Listener should be called immediately with current status');
      assert.strictEqual(typeof received.room, 'string');
      unsubscribe();
    });

    it('tracks remote state application flag to prevent echo loops', () => {
      assert.strictEqual(typeof isApplyingRemote(), 'boolean');
    });
  });

  describe('Store Integration with Remote Patch Flag', () => {
    it('handles remote updates with opts.remote without throwing', () => {
      const initialState = get();
      assert.ok(Array.isArray(initialState.requests), 'requests must be array');

      set({ testRemoteFlag: 123 }, { remote: true });
      assert.strictEqual(get().testRemoteFlag, 123);
    });
  });
});
