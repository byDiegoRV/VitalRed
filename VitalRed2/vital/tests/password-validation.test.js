import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PW_RULES, passwordIssues } from '../public/js/ui.js';

describe('Password Validation & PW_RULES Engine (Tarea 10 / Tarea 17)', () => {
  test('PW_RULES defines exactly 5 validation rules with correct labels and predicates', () => {
    assert.ok(Array.isArray(PW_RULES), 'PW_RULES must be an array');
    assert.strictEqual(PW_RULES.length, 5, 'PW_RULES must contain exactly 5 rules');

    const expectedLabels = [
      '8 o más caracteres',
      'Una letra mayúscula',
      'Una letra minúscula',
      'Un número',
      'Un carácter especial (!@#$%)'
    ];

    PW_RULES.forEach(([label, fn], idx) => {
      assert.strictEqual(label, expectedLabels[idx], `Rule #${idx + 1} label mismatch`);
      assert.strictEqual(typeof fn, 'function', `Rule #${idx + 1} validator must be a function`);
    });
  });

  describe('Primary Behavior: Compliant Passwords', () => {
    const validPasswords = [
      'VitalRed#2026',
      'SecurePass!1',
      'D0nante$Seguro',
      'Transp0rt@Hospital',
      'Med1co*General!',
      'Abcdefg1!',
      'XyZ987#@!abc'
    ];

    validPasswords.forEach((pw) => {
      test(`Validates strong password "${pw}" as having 0 issues`, () => {
        const issues = passwordIssues(pw);
        assert.deepStrictEqual(issues, [], `Expected 0 issues for "${pw}", got: ${JSON.stringify(issues)}`);
      });
    });
  });

  describe('Isolated Single-Rule Failures', () => {
    test('Fails on length < 8 characters only', () => {
      // 7 chars, has upper, lower, digit, special
      const pw = 'Ab1!xyz';
      assert.strictEqual(pw.length, 7);
      const issues = passwordIssues(pw);
      assert.deepStrictEqual(issues, ['8 o más caracteres']);
    });

    test('Boundary: Passes on exactly 8 characters with all criteria', () => {
      const pw = 'Ab1!xyzw';
      assert.strictEqual(pw.length, 8);
      const issues = passwordIssues(pw);
      assert.deepStrictEqual(issues, []);
    });

    test('Fails on missing uppercase letter only', () => {
      const pw = 'vitalred2026!';
      const issues = passwordIssues(pw);
      assert.deepStrictEqual(issues, ['Una letra mayúscula']);
    });

    test('Fails on missing lowercase letter only', () => {
      const pw = 'VITALRED2026!';
      const issues = passwordIssues(pw);
      assert.deepStrictEqual(issues, ['Una letra minúscula']);
    });

    test('Fails on missing numeric digit only', () => {
      const pw = 'VitalRedSpecial!';
      const issues = passwordIssues(pw);
      assert.deepStrictEqual(issues, ['Un número']);
    });

    test('Fails on missing special character only', () => {
      const pw = 'VitalRed2026';
      const issues = passwordIssues(pw);
      assert.deepStrictEqual(issues, ['Un carácter especial (!@#$%)']);
    });
  });

  describe('Multiple Rule Failures & Combinations', () => {
    test('Empty string fails all 5 rules', () => {
      const issues = passwordIssues('');
      assert.strictEqual(issues.length, 5);
      assert.deepStrictEqual(issues, [
        '8 o más caracteres',
        'Una letra mayúscula',
        'Una letra minúscula',
        'Un número',
        'Un carácter especial (!@#$%)'
      ]);
    });

    test('Only lowercase letters fails length, upper, digit, and special', () => {
      const issues = passwordIssues('pass');
      assert.deepStrictEqual(issues, [
        '8 o más caracteres',
        'Una letra mayúscula',
        'Un número',
        'Un carácter especial (!@#$%)'
      ]);
    });

    test('Numeric digits only >= 8 chars fails upper, lower, and special', () => {
      const issues = passwordIssues('12345678');
      assert.deepStrictEqual(issues, [
        'Una letra mayúscula',
        'Una letra minúscula',
        'Un carácter especial (!@#$%)'
      ]);
    });

    test('Uppercase + digits >= 8 chars fails lower and special', () => {
      const issues = passwordIssues('HOSPITAL2026');
      assert.deepStrictEqual(issues, [
        'Una letra minúscula',
        'Un carácter especial (!@#$%)'
      ]);
    });
  });

  describe('Edge Cases & Special Characters', () => {
    test('Accepts diverse ASCII special characters (!@#$%^&*()-_+=[]{}|;:,.<>?/~`)', () => {
      const symbols = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '_', '+', '=', '[', ']', '{', '}', '|', ':', ';', '<', '>', ',', '.', '?', '/', '~'];
      symbols.forEach((sym) => {
        const pw = `Abc1234${sym}`;
        const issues = passwordIssues(pw);
        assert.deepStrictEqual(issues, [], `Expected special symbol "${sym}" to satisfy special char rule`);
      });
    });

    test('Accepts space as special character (non-alphanumeric)', () => {
      const pw = 'Vital Red 2026';
      const issues = passwordIssues(pw);
      assert.deepStrictEqual(issues, []);
    });

    test('Accepts international/Unicode special characters and accents', () => {
      const pw = 'VitalRéd2026#';
      const issues = passwordIssues(pw);
      assert.deepStrictEqual(issues, []);
    });

    test('Handles long passwords (128+ characters)', () => {
      const longPw = 'SuperLongPassw0rd' + 'a'.repeat(120) + '!';
      assert.ok(longPw.length > 128);
      const issues = passwordIssues(longPw);
      assert.deepStrictEqual(issues, []);
    });
  });
});
