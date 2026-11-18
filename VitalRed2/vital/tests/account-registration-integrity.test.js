import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupBrowserEnvironment } from './helpers/browser-mock.js';

setupBrowserEnvironment();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appSrc = fs.readFileSync(path.resolve(__dirname, '../public/js/app.js'), 'utf8');
const screensUiSrc = fs.readFileSync(path.resolve(__dirname, '../public/js/screens-ui.js'), 'utf8');

const {
  get,
  set,
  reset,
  currentUser,
  normEmail,
  updateUserProfile,
  resetUserPassword
} = await import('../public/js/store.js');
const { statusOf, nextReqId } = await import('../public/js/domain.js');
const { screens } = await import('../public/js/screens.js');
const { field, passwordIssues } = await import('../public/js/ui.js');

describe('Account Registration, Auth & Profile Integrity', () => {
  beforeEach(() => {
    reset();
    globalThis.window.__vitalred_on_local_change = null;
  });

  describe('1. Donor 4-Step Wizard Rendering, XSS Escaping & Validation Contracts', () => {
    it('renders all 4 donor registration steps safely and toggles fem section strictly on gender === f', () => {
      // Step 1: XSS payload in prefilled name/email must be escaped in value attribute
      set({ reg: { step: 1, data: { name: 'Ana "Test" <script>', email: 'ana@vitalred.org' } } }, { noSync: true });
      const s1 = screens.register.render({ q: {} });
      assert.equal(s1.includes('&quot;Test&quot;'), true);
      assert.equal(s1.includes('<script>'), false);
      assert.equal(s1.includes('Paso 1 de 4'), true);

      // Helper field() itself escapes attribute values
      const fldHtml = field('testf', 'Label', 'text', 'ph', 'val"><img src=x>');
      assert.equal(fldHtml.includes('&quot;&gt;&lt;img'), true);

      // Step 2: Personal data & blood group
      set({ reg: { step: 2, data: { name: 'Ana', email: 'ana@vitalred.org', blood: 'AB-' } } }, { noSync: true });
      const s2 = screens.register.render({ q: {} });
      assert.equal(s2.includes('Paso 2 de 4'), true);
      assert.equal(s2.includes('<option selected>AB-</option>'), true);

      // Step 3: Female donor sees pregnancy question; male donor does not
      set({ reg: { step: 3, data: { gender: 'f' } } }, { noSync: true });
      const s3Fem = screens.register.render({ q: {} });
      assert.equal(s3Fem.includes('Salud femenina'), true);
      assert.equal(s3Fem.includes('name="fem"'), true);

      set({ reg: { step: 3, data: { gender: 'm' } } }, { noSync: true });
      const s3Male = screens.register.render({ q: {} });
      assert.equal(s3Male.includes('Salud femenina'), false);
      assert.equal(s3Male.includes('name="fem"'), false);

      // Step 4: Escapes user input in confirmation summary
      set({
        reg: {
          step: 4,
          data: { name: '<b>Ana</b>', email: 'ana@vitalred.org', gender: 'f', age: 'adult', weight: 'ok', blood: 'O+' }
        }
      }, { noSync: true });
      const s4 = screens.register.render({ q: {} });
      assert.equal(s4.includes('&lt;b&gt;Ana&lt;/b&gt;'), true);
      assert.equal(s4.includes('<b>Ana</b>'), false);
    });

    it('enforces fem cleanup on gender switch, noSync on wizard progress, and route protection in app.js', () => {
      assert.equal(appSrc.includes("if (data.gender !== 'f') delete data.fem"), true);
      assert.equal(appSrc.includes("if (r.data.gender !== 'f') delete r.data.fem"), true);
      assert.equal(appSrc.includes("(d.gender === 'f' && d.fem === 'yes')"), true);
      assert.equal(appSrc.includes("fem: d.gender === 'f' ? d.fem : undefined"), true);
      assert.equal(appSrc.includes("curPath === 'login' || curPath === 'register'"), true, 'Remote sync must not clobber active login/register forms');
      assert.equal(appSrc.includes('set({ reg: r }, { noSync: true })'), true, 'Intermediate registration steps must not push to Firestore');
    });
  });

  describe('2. Newly Registered Deferred Donor Blocking & Recovery via d/medical', () => {
    it('blocks alerts and campaigns for newly registered Diferido temporalmente donors until updated to Apto', () => {
      const deferredDonor = {
        name: 'Carlos Joven',
        email: 'carlos.joven@vitalred.org',
        password: 'Donor#2026',
        role: 'donor',
        blood: 'O+',
        status: 'Diferido temporalmente',
        donations: 0,
        medical: { gender: 'm', age: 'minor', weight: 'ok', blood: 'O+', risk0: 'no', risk1: 'no', risk2: 'no' }
      };
      set({ users: [...get().users, deferredDonor], session: deferredDonor.email });

      // Launch active O+ Código Rojo and bank campaign
      const reqId = nextReqId();
      const req = {
        id: reqId,
        blood: 'O+',
        units: 2,
        priority: 'CRÍTICA',
        component: 'Concentrado de hematíes',
        hospital: 'Hospital General',
        patient: 'Paciente Urgencia',
        hc: 'HC-9910',
        bed: 'Urgencias 2',
        status: 'buscando',
        createdAt: new Date().toISOString(),
        live: true
      };
      set({ requests: [req, ...get().requests], activeReqId: reqId, req, campaign: { blood: ['O+'], at: new Date().toISOString(), notified: 12 } });

      assert.equal(statusOf(currentUser()), 'Diferido temporalmente');

      // d/home must NOT display accept CTA or campaign CTA while deferred
      const homeHtml = screens['d/home'].render({ q: {} });
      assert.equal(homeHtml.includes('Responder ahora'), false, 'Deferred donor must NOT see Código Rojo respond button');
      assert.equal(homeHtml.includes('Quiero donar'), false, 'Deferred donor must NOT see Campaign CTA');
      assert.equal(homeHtml.includes('diferida temporalmente'), true);

      // d/alert must explicitly block participation and direct to d/medical
      const alertHtml = screens['d/alert'].render({ q: {} });
      assert.equal(alertHtml.includes('No elegible temporalmente'), true);
      assert.equal(alertHtml.includes('¡Puedo donar / Aceptar!'), false);

      // d/history shows coherent deferral status instead of empty date string
      const histHtml = screens['d/history'].render({ q: {} });
      assert.equal(histHtml.includes('Pendiente evaluación'), true);
      assert.equal(histHtml.includes('Según tu cuestionario médico NOM-253 actual no eres apto'), true);

      // Donor updates medical profile to eligible (adult >= 50 kg, no risks)
      updateUserProfile(deferredDonor.email, {
        status: 'Apto para donar',
        medical: { ...deferredDonor.medical, age: 'adult' }
      });

      assert.equal(statusOf(currentUser()), 'Apto para donar');
      assert.equal(screens['d/home'].render({ q: {} }).includes('Responder ahora'), true, 'Eligible donor sees Código Rojo CTA again');
      assert.equal(screens['d/alert'].render({ q: {} }).includes('¡Puedo donar / Aceptar!'), true);
    });
  });

  describe('3. Institutional Registration, Folio Validation & Role-Specific Profiles', () => {
    it('enforces strict folio format MED/TRA/BAN-XXXX, email/cedula rules, and collision checks', () => {
      assert.equal(appSrc.includes('/^(MED|TRA|BAN)-[A-Z0-9]{2,10}$/.test(folioRaw)'), true);
      assert.equal(appSrc.includes('folioTaken(folioRaw)'), true);
      assert.equal(appSrc.includes('u.cedula && normEmail(u.cedula) === n'), true);
      assert.equal(appSrc.includes('u.folio && normEmail(u.folio) === n'), true);
      assert.equal(appSrc.includes('u.license && normEmail(u.license) === n'), true);
      assert.equal(screensUiSrc.includes('...HOSPITAL_LIST'), true, 'Edit profile modal must include full HOSPITAL_LIST');
    });

    it('renders registered institutional user own cedula, folio, license, unit and hospital instead of seed fallbacks', () => {
      const med = {
        name: 'Dr. Ricardo Solís',
        email: 'ricardo@hospital.org',
        password: 'Med#2026!',
        role: 'medical',
        hospital: 'Hospital San Rafael',
        folio: 'MED-4021',
        cedula: 'MED-4021',
        service: 'Urgencias / Guardia',
        shift: 'Matutino'
      };
      const tr = {
        name: 'Laura Vela',
        email: 'laura.vela@vitalred.org',
        password: 'Tra#2026!',
        role: 'transport',
        hospital: 'Base Norte',
        folio: 'TRA-8810',
        license: 'TRA-8810',
        unit: 'AMB-8810',
        operatorStatus: 'En servicio',
        shift: 'Matutino'
      };
      const bank = {
        name: 'QFB Mario Daza',
        email: 'mario.daza@vitalred.org',
        password: 'Ban#2026!',
        role: 'bank',
        hospital: 'Banco Estatal',
        folio: 'BAN-3099',
        position: 'Personal de Banco de Sangre',
        cargo: 'Personal de Banco de Sangre',
        shift: 'Matutino'
      };

      set({ users: [...get().users, med, tr, bank] });

      set({ session: med.email });
      const medProf = screens['m/profile'].render({ q: {} });
      assert.equal(medProf.includes('MED-4021'), true);
      assert.equal(medProf.includes('Hospital San Rafael'), true);
      assert.equal(medProf.includes('CED-7765421'), false);

      set({ session: tr.email });
      const trProf = screens['t/profile'].render({ q: {} });
      assert.equal(trProf.includes('TRA-8810'), true);
      assert.equal(trProf.includes('AMB-8810'), true);
      assert.equal(trProf.includes('Base Norte'), true);
      assert.equal(trProf.includes('LIC-458213'), false);
      assert.equal(trProf.includes('AMB-014'), false);

      set({ session: bank.email });
      const bankProf = screens['b/profile'].render({ q: {} });
      assert.equal(bankProf.includes('Banco Estatal'), true);
    });
  });

  describe('4. Session Normalization, Login Identifiers, Password Recovery & Cloud Sync', () => {
    it('resolves currentUser case-insensitively and propagates profile/password changes to sync hook', () => {
      let pushedCount = 0;
      globalThis.window.__vitalred_on_local_change = () => {
        pushedCount++;
      };

      const instMed = {
        name: 'Dra. Sofía Méndez',
        email: 'sofia.mendez@salud.gob',
        password: 'Init#2026!',
        role: 'medical',
        hospital: 'Hospital Ángeles',
        folio: 'MED-9012',
        cedula: 'CED-9988776'
      };
      set({ users: [...get().users, instMed], session: '  SOFIA.MENDEZ@SALUD.GOB ' });
      pushedCount = 0;

      const u = currentUser();
      assert.ok(u, 'currentUser must match case-insensitively with whitespace trimmed');
      assert.equal(u.email, 'sofia.mendez@salud.gob');

      // Profile edit updates store, persists to localStorage, and notifies cloud sync
      const updated = updateUserProfile('sofia.mendez@salud.gob', { phone: '55-9900-1122', hospital: 'Hospital Regional' });
      assert.equal(updated, true);
      assert.equal(pushedCount, 1);
      assert.equal(currentUser().hospital, 'Hospital Regional');

      // Login accepts email, cedula, folio, or license in app.js
      assert.equal(appSrc.includes('normEmail(u.cedula) === idInput'), true);
      assert.equal(appSrc.includes('normEmail(u.folio) === idInput'), true);
      assert.equal(appSrc.includes('normEmail(u.license) === idInput'), true);

      // Password recovery works with folio or cedula and notifies cloud sync
      const weak = resetUserPassword('CED-9988776', '123');
      assert.equal(weak.ok, false);
      assert.ok(passwordIssues('123').length > 0);

      const rec = resetUserPassword('MED-9012', 'StrongPass#2026');
      assert.equal(rec.ok, true);
      assert.equal(pushedCount, 2);
      assert.equal(currentUser().password, 'StrongPass#2026');
    });

    it('merges remotely registered accounts cleanly without erasing local accounts', () => {
      const initialCount = get().users.length;
      const remoteDonor = {
        name: 'Elena Remota',
        email: 'Elena.Remota@vitalred.org',
        password: 'Rem0te#Password',
        role: 'donor',
        blood: 'A-',
        status: 'Apto para donar',
        donations: 0
      };
      set({ users: [remoteDonor] }, { remote: true });

      const all = get().users;
      assert.equal(all.length, initialCount + 1);
      assert.ok(all.some((u) => normEmail(u.email) === 'donante@vitalred.org'));
      assert.ok(all.some((u) => normEmail(u.email) === 'elena.remota@vitalred.org'));
    });
  });
});
