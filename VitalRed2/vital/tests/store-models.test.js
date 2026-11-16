import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupBrowserEnvironment } from './helpers/browser-mock.js';

setupBrowserEnvironment();

const store = await import('../public/js/store.js');
const {
  get,
  set,
  reset,
  currentUser,
  sessionEmail,
  normEmail,
  ROLES,
  HOME,
  getUnitExpirationInfo,
  addInventoryItem,
  updateInventoryItem,
  removeInventoryItem,
  getInventory
} = store;

describe('Central Reactive Store & User Data Models (Tarea 10 / Tarea 17)', () => {
  beforeEach(() => {
    reset();
  });

  describe('User Seed Models & Role Definitions', () => {
    test('Contains exactly 4 distinct system roles with proper labels', () => {
      assert.deepStrictEqual(ROLES, {
        donor: 'Donante Voluntario',
        medical: 'Personal Médico',
        transport: 'Transportista Sanitario',
        bank: 'Banco de Sangre'
      });
    });

    test('Defines home routes for all 4 roles', () => {
      assert.strictEqual(HOME.donor, 'd/profile');
      assert.strictEqual(HOME.medical, 'm/dashboard');
      assert.strictEqual(HOME.transport, 't/home');
      assert.strictEqual(HOME.bank, 'b/dash');
    });

    test('Seed users include one account per role with expected fields', () => {
      const state = get();
      assert.ok(Array.isArray(state.users), 'users must be an array');
      assert.strictEqual(state.users.length, 4, 'Must seed exactly 4 users');

      const donor = state.users.find((u) => u.role === 'donor');
      assert.ok(donor);
      assert.strictEqual(donor.email, 'donante@vitalred.org');
      assert.strictEqual(donor.blood, 'O+');
      assert.strictEqual(donor.status, 'Apto para donar');
      assert.strictEqual(typeof donor.donations, 'number');
      assert.ok(donor.medical);

      const medical = state.users.find((u) => u.role === 'medical');
      assert.ok(medical);
      assert.strictEqual(medical.email, 'medico@vitalred.org');
      assert.strictEqual(medical.hospital, 'Hospital General');

      const transport = state.users.find((u) => u.role === 'transport');
      assert.ok(transport);
      assert.strictEqual(transport.email, 'transporte@vitalred.org');
      assert.strictEqual(transport.unit, 'AMB-014');
      assert.strictEqual(transport.license, 'LIC-458213');

      const bank = state.users.find((u) => u.role === 'bank');
      assert.ok(bank);
      assert.strictEqual(bank.email, 'banco@vitalred.org');
      assert.strictEqual(bank.hospital, 'Banco Central');
    });
  });

  describe('Session Management & currentUser()', () => {
    test('Returns undefined when no user session is active', () => {
      globalThis.sessionStorage.removeItem('vitalred-session');
      assert.strictEqual(currentUser(), undefined);
      assert.strictEqual(sessionEmail(), null);
    });

    test('Identifies authenticated medical user from session', () => {
      set({ session: 'medico@vitalred.org' });
      const user = currentUser();
      assert.ok(user);
      assert.strictEqual(user.name, 'Dra. Ana Torres');
      assert.strictEqual(user.role, 'medical');
    });

    test('Identifies authenticated transport user from session', () => {
      set({ session: 'transporte@vitalred.org' });
      const user = currentUser();
      assert.ok(user);
      assert.strictEqual(user.name, 'Luis Pérez');
      assert.strictEqual(user.role, 'transport');
      assert.strictEqual(user.unit, 'AMB-014');
    });

    test('normEmail sanitizes whitespace and casing', () => {
      assert.strictEqual(normEmail('  Donante@VitalRed.ORG  '), 'donante@vitalred.org');
      assert.strictEqual(normEmail(''), '');
      assert.strictEqual(normEmail(null), '');
      assert.strictEqual(normEmail(undefined), '');
    });
  });

  describe('User Profile Updates & Persistence (Tarea 10 Contract)', () => {
    test('Updates user profile fields and persists state', () => {
      const state = get();
      const updatedUsers = state.users.map((u) => {
        if (u.email === 'transporte@vitalred.org') {
          return { ...u, name: 'Luis Pérez Modificado', unit: 'AMB-999', phone: '555-123-4567' };
        }
        return u;
      });

      set({ users: updatedUsers });

      const reloaded = get();
      const updatedTransport = reloaded.users.find((u) => u.email === 'transporte@vitalred.org');
      assert.strictEqual(updatedTransport.name, 'Luis Pérez Modificado');
      assert.strictEqual(updatedTransport.unit, 'AMB-999');
      assert.strictEqual(updatedTransport.phone, '555-123-4567');

      // Verify localStorage persistence
      const savedStr = globalThis.localStorage.getItem('vitalred-v3');
      assert.ok(savedStr);
      const parsed = JSON.parse(savedStr);
      const savedTransport = parsed.users.find((u) => u.email === 'transporte@vitalred.org');
      assert.strictEqual(savedTransport.name, 'Luis Pérez Modificado');
    });

    test('If updateUserProfile helper exists, verifies functional interface contract', () => {
      if (typeof store.updateUserProfile === 'function') {
        const ok = store.updateUserProfile('medico@vitalred.org', { phone: '555-987-6543' });
        assert.strictEqual(ok, true);
        const user = get().users.find((u) => u.email === 'medico@vitalred.org');
        assert.strictEqual(user.phone, '555-987-6543');

        const fail = store.updateUserProfile('nonexistent@vitalred.org', { phone: '123' });
        assert.strictEqual(fail, false);
      }
    });

    test('If resetUserPassword helper exists, verifies password update contract', () => {
      if (typeof store.resetUserPassword === 'function') {
        const res = store.resetUserPassword('donante@vitalred.org', 'NewStrongP@ss2026');
        assert.strictEqual(res.ok, true);
        const user = get().users.find((u) => u.email === 'donante@vitalred.org');
        assert.strictEqual(user.password, 'NewStrongP@ss2026');

        // Fails with invalid password
        const weakRes = store.resetUserPassword('donante@vitalred.org', 'weak');
        assert.strictEqual(weakRes.ok, false);
      }
    });
  });

  describe('Blood Inventory Models & Expiration Rules', () => {
    test('getUnitExpirationInfo identifies quarantine units as non-dispatchable', () => {
      const item = { status: 'cuarentena', expiresAt: '2026-12-31' };
      const info = getUnitExpirationInfo(item);
      assert.strictEqual(info.status, 'cuarentena');
      assert.strictEqual(info.dispatchable, false);
      assert.strictEqual(info.badgeCls, 'red');
    });

    test('getUnitExpirationInfo identifies expired units as non-dispatchable', () => {
      const item = { status: 'vigente', expiresAt: '2020-01-01' };
      const info = getUnitExpirationInfo(item);
      assert.strictEqual(info.status, 'caducado');
      assert.strictEqual(info.dispatchable, false);
      assert.strictEqual(info.badgeCls, 'red');
    });

    test('CRUD operations on inventory items', () => {
      const newItem = addInventoryItem({
        blood: 'AB-',
        component: 'Sangre total',
        volume: 450,
        location: 'Cámara Fría 2 (2° a 6°C) — Estante B-2',
        notes: 'Unidad de prueba automatizada'
      });

      assert.ok(newItem.id);
      assert.strictEqual(newItem.blood, 'AB-');

      // Update
      updateInventoryItem(newItem.id, { notes: 'Notas actualizadas' });
      const updated = get().inventory.find((i) => i.id === newItem.id);
      assert.strictEqual(updated.notes, 'Notas actualizadas');

      // Filter
      const abList = getInventory({ blood: 'AB-' });
      assert.ok(abList.some((i) => i.id === newItem.id));

      // Remove
      removeInventoryItem(newItem.id);
      const afterDelete = get().inventory.find((i) => i.id === newItem.id);
      assert.strictEqual(afterDelete, undefined);
    });
  });
});
