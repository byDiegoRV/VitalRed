import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupBrowserEnvironment } from './helpers/browser-mock.js';

setupBrowserEnvironment();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { get, set, reset, currentUser, normEmail, lockedByOther } = await import('../public/js/store.js');
const {
  donorReqFor,
  dispatchUnit,
  takeTrip,
  patchReq,
  nextReqId,
  nextApptId,
  compatible,
  completeDonation,
  releaseDonor
} = await import('../public/js/domain.js');
const { guard, donorStage } = await import('../public/js/flow.js');
const { screens } = await import('../public/js/screens.js');
const { DEFAULT_TRIP } = await import('../public/js/screens-transport.js');

const FORBIDDEN_SIM_ACTS = [
  'data-act="simStage"',
  'data-act="demoAlert"',
  'data-act="newTrip"',
  'data-act="openSimModal"',
  'data-act="dummyPhotoOrigin"',
  'data-act="dummyPhotoDelivery"',
  'data-act="finishDonation"',
  'data-act="noResp"'
];

describe('Zero Simulations & Intensive Multi-Role Real Workflows', () => {
  beforeEach(() => {
    reset();
  });

  describe('1. Zero Simulation Controls Across All 4 Roles', () => {
    it('renders medical, donor, bank, and transport screens without any simulation or dummy buttons', () => {
      const users = get().users;
      const byRole = (role) => users.find((u) => u.role === role);

      const checkRoleScreens = (role, routeSpecs) => {
        const user = byRole(role);
        set({ session: user.email });
        for (const [routePath, query] of routeSpecs) {
          const html = screens[routePath].render({ q: query || {} });
          for (const forbidden of FORBIDDEN_SIM_ACTS) {
            assert.equal(
              html.includes(forbidden),
              false,
              `Screen ${routePath} (${role}) must NOT render forbidden simulation marker ${forbidden}`
            );
          }
        }
      };

      // Medical role
      patchReq({ status: 'buscando' }, 'ST-2048');
      checkRoleScreens('medical', [
        ['m/dashboard'],
        ['m/new'],
        ['m/radar'],
        ['m/reception'],
        ['m/detail', { id: 'ST-2048' }],
        ['m/profile']
      ]);
      patchReq({ status: 'esperando', donor: { name: 'Aleks López', email: 'donante@vitalred.org', blood: 'O+' } }, 'ST-2048');
      assert.equal(screens['m/radar'].render({ q: {} }).includes('simStage'), false);
      patchReq({ status: 'programada', appt: { id: 'VR-2026-8891', time: '09:00' } }, 'ST-2048');
      assert.equal(screens['m/radar'].render({ q: {} }).includes('simStage'), false);
      patchReq({ status: 'completada', delivery: 'preparando' }, 'ST-2048');
      assert.equal(screens['m/radar'].render({ q: {} }).includes('simStage'), false);

      // Donor role
      const donor = byRole('donor');
      set({ session: donor.email, myAppt: { id: 'VR-2026-8891', email: donor.email, name: donor.name, blood: donor.blood, time: '09:00', state: 'Programada' } });
      checkRoleScreens('donor', [
        ['d/home'],
        ['d/alert'],
        ['d/triage'],
        ['d/schedule'],
        ['d/qr'],
        ['d/done'],
        ['d/profile'],
        ['d/history']
      ]);

      // Transport role
      const tr = byRole('transport');
      set({ session: tr.email, trip: { ...DEFAULT_TRIP, status: 'asignada', assignedAt: Date.now() } });
      checkRoleScreens('transport', [
        ['t/home'],
        ['t/check'],
        ['t/transit'],
        ['t/delivery'],
        ['t/logbook'],
        ['t/history'],
        ['t/manual'],
        ['t/profile']
      ]);

      // Bank role
      checkRoleScreens('bank', [
        ['b/dash'],
        ['b/appts'],
        ['b/records'],
        ['b/fleet'],
        ['b/reports'],
        ['b/profile']
      ]);
    });

    it('uses clean institutional text in footer and keeps Reset option synced across sources', () => {
      const appSrc = fs.readFileSync(path.resolve(__dirname, '../public/js/app.js'), 'utf8');
      assert.equal(appSrc.includes('Prototipo simulado'), false, 'Footer must not display "Prototipo simulado"');
      assert.equal(appSrc.includes('Restablecer datos'), true, 'Footer must retain clean "Restablecer datos" trigger');

      const syncSrc = fs.readFileSync(path.resolve(__dirname, '../public/js/firebase-sync.js'), 'utf8');
      for (const field of ['users:', 'fleet:', 'tripHistory:', 'donations:', 'lastDonation:']) {
        assert.equal(syncSrc.includes(field), true, `firebase-sync.js payload must include ${field}`);
      }
    });
  });

  describe('2. Flujo E2E Real Vía A (Múltiples Solicitudes + Reconciliación Remota)', () => {
    it('executes full multi-role sequence without simulations, deadlocks, or stale activeReqId interference', () => {
      // Allows opening multiple tabs with different roles
      assert.equal(lockedByOther(), null, 'lockedByOther must not block multi-tab testing');

      // 1. Remote device registers a new B+ donor (Melany) -> synced into state via opts.remote
      const newDonor = {
        name: 'Melany Roldán Vivanco',
        email: 'melany@vitalred.org',
        password: 'Donor123!',
        role: 'donor',
        blood: 'B+',
        status: 'Apto para donar',
        donations: 0
      };
      set({ users: [...get().users, newDonor] }, { remote: true });
      assert.ok(
        get().users.some((u) => normEmail(u.email) === 'melany@vitalred.org'),
        'Remote user registration must merge into store'
      );

      // 2. Doctor logs in and launches Req #1 (A-, activeReqId) and Req #2 (B+, while keeping Req #1 selected or switching back)
      set({ session: 'medico@vitalred.org' });
      const req1 = {
        id: nextReqId(),
        blood: 'A-',
        units: 1,
        priority: 'ALTA',
        component: 'Concentrado de hematíes',
        hospital: 'Hospital General',
        patient: 'Paciente Uno',
        hc: 'HC-1001',
        bed: 'Urgencias 1',
        status: 'buscando',
        createdAt: new Date().toISOString(),
        live: true,
        log: [{ k: 'creada', at: Date.now() }]
      };
      const req2 = {
        id: nextReqId(),
        blood: 'B+',
        units: 2,
        priority: 'CRÍTICA',
        component: 'Plasma fresco congelado',
        hospital: 'Hospital San Rafael',
        patient: 'Paciente Dos',
        hc: 'HC-2002',
        bed: 'Quirófano 3',
        status: 'buscando',
        createdAt: new Date().toISOString(),
        live: true,
        log: [{ k: 'creada', at: Date.now() }]
      };
      // Doctor activeReqId intentionally stays on req1 (A-)
      set({ requests: [req2, req1, ...get().requests], activeReqId: req1.id, req: req1 });

      // 3. Melany (B+) logs in on another device: donorReqFor MUST resolve req2 (B+), NOT req1 (A-)
      set({ session: 'melany@vitalred.org' });
      const resolved = donorReqFor(currentUser());
      assert.equal(resolved?.id, req2.id, 'donorReqFor must match compatible B+ request req2 even when activeReqId is req1');
      assert.equal(screens['d/alert'].render({ q: {} }).includes('Hospital San Rafael'), true);

      // Melany accepts alert & moves through triage
      patchReq({ status: 'esperando', donor: { name: newDonor.name, email: newDonor.email, blood: 'B+' } }, req2.id);
      set({ inFlow: true, flowOwner: newDonor.email, triageAns: ['no', 'no', 'no', 'yes', 'yes'], triage: true });
      assert.equal(donorStage(get(), currentUser()), 'schedule');

      // Melany schedules appointment
      const apptId = nextApptId();
      const myAppt = { id: apptId, name: newDonor.name, email: newDonor.email, blood: 'B+', time: '14:30', state: 'Programada', reqId: req2.id };
      set({ myAppt, appts: [myAppt, ...get().appts] });
      patchReq({ status: 'programada', appt: { id: apptId, time: '14:30', state: 'Programada' } }, req2.id);
      assert.equal(guard('d/qr', get()), null, 'Booked donor must access d/qr freely');

      // 4. Banco authorizes extraction -> medical radar reflects 'En extracción'
      set({ session: 'banco@vitalred.org' });
      set({ appts: get().appts.map((a) => (a.id === apptId ? { ...a, state: 'Extracción' } : a)), selAppt: apptId });
      patchReq({ appt: { id: apptId, time: '14:30', state: 'Extracción' } }, req2.id);

      set({ session: 'medico@vitalred.org', activeReqId: req2.id, req: get().requests.find((x) => x.id === req2.id) });
      const radarDuringExtraction = screens['m/radar'].render({ q: {} });
      assert.equal(radarDuringExtraction.includes('En extracción'), true, 'Medical radar must reflect donor in extraction at Bank');

      // 5. Banco approves donation -> completeDonation + dispatchUnit
      set({ session: 'banco@vitalred.org' });
      const updatedAppts = get().appts.map((a) => (a.id === apptId ? { ...a, state: 'Completada' } : a));
      set({ appts: updatedAppts });
      completeDonation(myAppt);
      const dispatched = dispatchUnit({ ...DEFAULT_TRIP }, req2.id);
      assert.ok(dispatched, 'Unit must auto-dispatch to transport queue on bank approval');
      assert.equal(dispatched.reqId, req2.id);

      // Verify Bank b/appts UI hides "Autorizar Ingreso" when state is Completada
      const bankApptHtml = screens['b/appts'].render({ q: {} });
      assert.equal(bankApptHtml.includes('Cita Completada'), true);
      assert.equal(bankApptHtml.includes('Autorizar Ingreso'), false);

      // Verify Donor device reconciles myAppt via remote snapshot -> sees 'Donación completada' without guard redirect!
      set({ session: 'melany@vitalred.org', myAppt: { ...myAppt, state: 'Programada' } });
      set({ appts: updatedAppts }, { remote: true });
      assert.equal(get().myAppt.state, 'Completada', 'store.set must reconcile myAppt when remote appts completes');
      assert.equal(guard('d/qr', get()), null, 'Guard must allow donor staying on d/qr in done stage');
      assert.equal(screens['d/qr'].render({ q: {} }).includes('Donación completada'), true);

      // 6. Transportista logs in, takes trip, tests t/manual contingency guard before transit, completes custody & delivers
      set({ session: 'transporte@vitalred.org' });
      const taken = takeTrip(dispatched.id, currentUser());
      assert.ok(taken);
      assert.equal(taken.status, 'asignada');
      assert.equal(guard('t/manual', get()), null, 'Guard must allow opening t/manual right from t/check before transit');

      // Check Custody -> Transit -> Delivery
      set({ trip: { ...get().trip, status: 'transito', check0: true, check1: true, check2: true, photoOrigin: 'data:image/png;base64,AA==' } });
      patchReq({ delivery: 'en_ruta' }, req2.id);
      assert.equal(get().requests.find((x) => x.id === req2.id).delivery, 'en_ruta');

      // Finish delivery
      patchReq({ delivery: 'entregada', deliveredAt: new Date().toISOString() }, req2.id);
      set({ trip: null });

      // 7. Medical opens m/detail?id=req2.id even when activeReqId is STILL req1 -> must show req2 real donor & reception button!
      set({ session: 'medico@vitalred.org', activeReqId: req1.id, req: req1 });
      const detailHtml = screens['m/detail'].render({ q: { id: req2.id } });
      assert.equal(detailHtml.includes('Melany Roldán Vivanco'), true, 'm/detail must show the inspected request req2 donor, not activeReqId req1');
      assert.equal(detailHtml.includes(`data-act="openReception" data-id="${req2.id}"`), true, 'm/detail must link reception directly to req2.id');

      // Doctor confirms reception & closes req2
      patchReq({ status: 'cerrada', receivedAt: new Date().toISOString() }, req2.id);
      assert.equal(get().requests.find((x) => x.id === req2.id).status, 'cerrada');
    });
  });

  describe('3. Flujo E2E Real Vía B (Despacho Directo desde Banco b/dash y b/fleet)', () => {
    it('allows Bank to dispatch directly from stock or fleet assignment when request is searching', () => {
      set({ session: 'banco@vitalred.org' });
      const req = {
        id: nextReqId(),
        blood: 'O+',
        units: 2,
        priority: 'CRÍTICA',
        component: 'Concentrado eritrocitario',
        hospital: 'Hospital Ángeles',
        patient: 'Paciente Stock Directo',
        hc: 'HC-8811',
        bed: 'Shock 1',
        status: 'buscando',
        createdAt: new Date().toISOString(),
        live: true,
        log: [{ k: 'creada', at: Date.now() }]
      };
      set({ requests: [req, ...get().requests] });

      // Dashboard shows "Despachar unidad" button on active searching request
      const dashHtml = screens['b/dash'].render({ q: {} });
      assert.equal(dashHtml.includes(`data-act="dispatch" data-id="${req.id}"`), true);

      // Direct dispatch creates tripQueue entry and updates medical status
      const trip = dispatchUnit({ ...DEFAULT_TRIP, assignedUnit: 'AMB-017' }, req.id, { direct: true, unitId: 'AMB-017' });
      assert.ok(trip, 'Direct dispatch from bank must succeed');
      assert.equal(trip.assignedUnit, 'AMB-017');
      assert.equal(get().tripQueue.some((q) => q.reqId === req.id), true);

      const updatedReq = get().requests.find((r) => r.id === req.id);
      assert.equal(updatedReq.status, 'completada');
      assert.equal(updatedReq.delivery, 'despachada');

      // Preventing duplicate dispatch for same request
      const dup = dispatchUnit({ ...DEFAULT_TRIP }, req.id, { direct: true });
      assert.equal(dup, null, 'Already dispatched request should not create duplicate trip');

      // Transportista takes trip and inherits assigned unit AMB-017
      const taken = takeTrip(trip.id, { name: 'Luis Pérez', unit: 'AMB-014' });
      assert.ok(taken.assignedTo.includes('AMB-017'));
    });
  });

  describe('4. Casos Borde Críticos Multi-Dispositivo', () => {
    it('unblocks donor if medical cancels request while donor holds myAppt', () => {
      const donor = get().users.find((u) => u.role === 'donor');
      const myAppt = { id: 'VR-2026-7777', email: donor.email, name: donor.name, blood: donor.blood, time: '10:00', state: 'Programada' };
      set({ session: donor.email, myAppt, inFlow: true, flowOwner: donor.email, triage: true, appts: [myAppt] });
      assert.equal(donorStage(get(), donor), 'booked');

      // Remote update arrives without myAppt in appts (cancelled by medical)
      set({ appts: [] }, { remote: true });
      assert.equal(get().myAppt, null, 'Cancelled appointment must clear remote donor myAppt lock');
      assert.equal(donorStage(get(), donor), 'idle', 'Donor must return to idle stage and not stay stuck on d/qr');
    });

    it('clears donor + appt cleanly in releaseDonor even when donor is not activeReqId', () => {
      const req1 = { id: 'ST-3101', blood: 'O+', status: 'buscando', excluded: [] };
      const req2 = {
        id: 'ST-3102',
        blood: 'O+',
        status: 'programada',
        donor: { name: 'Aleks', email: 'donante@vitalred.org', blood: 'O+' },
        appt: { id: 'VR-2026-5555', time: '11:00' },
        excluded: []
      };
      set({
        requests: [req1, req2],
        activeReqId: 'ST-3101',
        req: req1,
        myAppt: { id: 'VR-2026-5555', email: 'donante@vitalred.org' },
        appts: [{ id: 'VR-2026-5555', email: 'donante@vitalred.org', state: 'Programada' }]
      });

      releaseDonor('donante@vitalred.org', { name: 'Aleks', reasons: ['bp'], notes: 'TA alta' });
      const updatedReq2 = get().requests.find((r) => r.id === 'ST-3102');
      assert.equal(updatedReq2.status, 'buscando');
      assert.equal(updatedReq2.donor, null);
      assert.equal(updatedReq2.appt, null);
      assert.equal(updatedReq2.excluded.includes('donante@vitalred.org'), true);
      assert.equal(get().requests.find((r) => r.id === 'ST-3101').status, 'buscando');
    });
  });
});
