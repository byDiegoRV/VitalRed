import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupBrowserEnvironment } from './helpers/browser-mock.js';

// Setup environment before importing domain.js
setupBrowserEnvironment();

const {
  compatible,
  COMPONENTS,
  SHELF_LIFE_DAYS,
  RECOMMENDED_VOLUMES,
  calculateExpirationDate,
  km
} = await import('../public/js/domain.js');

describe('Blood Compatibility Matrix & Transfusion Domain Logic (Tarea 17)', () => {
  const ALL_GROUPS = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

  // Authoritative ABO/Rh Red Blood Cell Compatibility Oracle
  const EXPECTED_MATRIX = {
    'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    'O+': ['O+', 'A+', 'B+', 'AB+'],
    'A-': ['A-', 'A+', 'AB-', 'AB+'],
    'A+': ['A+', 'AB+'],
    'B-': ['B-', 'B+', 'AB-', 'AB+'],
    'B+': ['B+', 'AB+'],
    'AB-': ['AB-', 'AB+'],
    'AB+': ['AB+']
  };

  describe('ABO/Rh Compatibility Matrix Verification (8x8 Grid)', () => {
    for (const donor of ALL_GROUPS) {
      for (const recipient of ALL_GROUPS) {
        const shouldBeCompatible = EXPECTED_MATRIX[donor].includes(recipient);
        test(`Compatibility: Donor ${donor} -> Recipient ${recipient} should be ${shouldBeCompatible}`, () => {
          assert.strictEqual(
            compatible(donor, recipient),
            shouldBeCompatible,
            `Failed compatibility for ${donor} -> ${recipient}`
          );
        });
      }
    }
  });

  describe('Emergency & Universal Rules', () => {
    test('O- is the Universal Donor: compatible with all 8 ABO/Rh blood groups', () => {
      ALL_GROUPS.forEach((recipient) => {
        assert.strictEqual(
          compatible('O-', recipient),
          true,
          `Emergency donor O- must be compatible with recipient ${recipient}`
        );
      });
    });

    test('AB+ is the Universal Recipient: compatible with all 8 ABO/Rh donors', () => {
      ALL_GROUPS.forEach((donor) => {
        assert.strictEqual(
          compatible(donor, 'AB+'),
          true,
          `Universal recipient AB+ must receive blood from donor ${donor}`
        );
      });
    });

    test('O- recipient can ONLY receive blood from O- donor', () => {
      const allowedDonors = ALL_GROUPS.filter((donor) => compatible(donor, 'O-'));
      assert.deepStrictEqual(allowedDonors, ['O-'], 'O- recipient must exclusively accept O- donor');
    });

    test('AB+ donor can ONLY donate to AB+ recipient', () => {
      const allowedRecipients = ALL_GROUPS.filter((rec) => compatible('AB+', rec));
      assert.deepStrictEqual(allowedRecipients, ['AB+'], 'AB+ donor can only donate to AB+');
    });
  });

  describe('Adversarial & Edge Cases for Blood Types', () => {
    const invalidTypes = ['X+', 'O', 'Rh-', '', null, undefined, 'A++', '123', 'O -'];

    invalidTypes.forEach((inv) => {
      test(`Returns false for invalid donor type "${inv}"`, () => {
        assert.strictEqual(compatible(inv, 'O+'), false);
      });

      test(`Returns false for invalid recipient type "${inv}"`, () => {
        assert.strictEqual(compatible('O-', inv), false);
      });
    });
  });

  describe('Blood Components, Expiration & Volumes', () => {
    test('COMPONENTS contains standard transfusion blood products', () => {
      assert.ok(Array.isArray(COMPONENTS));
      assert.ok(COMPONENTS.includes('Concentrado de hematíes'));
      assert.ok(COMPONENTS.includes('Sangre total'));
      assert.ok(COMPONENTS.includes('Plasma fresco congelado'));
      assert.ok(COMPONENTS.includes('Plaquetas por aféresis'));
    });

    test('SHELF_LIFE_DAYS aligns with hematology standards (NOM-253-SSA1)', () => {
      assert.strictEqual(SHELF_LIFE_DAYS['Concentrado de hematíes'], 42);
      assert.strictEqual(SHELF_LIFE_DAYS['Sangre total'], 35);
      assert.strictEqual(SHELF_LIFE_DAYS['Plaquetas por aféresis'], 5);
      assert.strictEqual(SHELF_LIFE_DAYS['Plasma fresco congelado'], 365);
    });

    test('calculateExpirationDate calculates precise ISO expiration date', () => {
      // Plaquetas: 5 days shelf life
      const plateDate = calculateExpirationDate('Plaquetas por aféresis', '2026-11-10');
      assert.strictEqual(plateDate, '2026-11-15');

      // Concentrado de hematíes: 42 days
      const rbcDate = calculateExpirationDate('Concentrado de hematíes', '2026-10-01');
      assert.strictEqual(rbcDate, '2026-11-12');

      // Sangre total: 35 days
      const wholeBlood = calculateExpirationDate('Sangre total', '2026-11-01');
      assert.strictEqual(wholeBlood, '2026-12-06');

      // Default fallback when unknown component (35 days)
      const unknownComp = calculateExpirationDate('ComponenteDesconocido', '2026-05-01');
      assert.strictEqual(unknownComp, '2026-06-05');
    });

    test('RECOMMENDED_VOLUMES defines valid positive volumes in mL', () => {
      assert.strictEqual(RECOMMENDED_VOLUMES['Concentrado de hematíes'], 300);
      assert.strictEqual(RECOMMENDED_VOLUMES['Sangre total'], 450);
      assert.strictEqual(RECOMMENDED_VOLUMES['Plaquetas por aféresis'], 250);
      assert.strictEqual(RECOMMENDED_VOLUMES['Plasma fresco congelado'], 250);
      assert.strictEqual(RECOMMENDED_VOLUMES['Crioprecipitado'], 150);
    });
  });

  describe('Geographic Distance Calculation (Haversine formula)', () => {
    test('km() calculates 0 distance between identical coordinates', () => {
      const coord = [19.4326, -99.1332];
      const dist = km(coord, coord);
      assert.strictEqual(dist, 0);
    });

    test('km() calculates accurate geodesic distance between known points', () => {
      // Distance between Mexico City center [19.4326, -99.1332] and Santa Fe [19.3598, -99.2589]
      const c1 = [19.4326, -99.1332];
      const c2 = [19.3598, -99.2589];
      const dist = km(c1, c2);
      assert.ok(dist > 10 && dist < 20, `Expected distance ~15km, got ${dist}`);
    });
  });
});
