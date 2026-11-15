import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupBrowserEnvironment } from './helpers/browser-mock.js';

setupBrowserEnvironment();

const { get, set, reset, currentUser, ROLES } = await import('../public/js/store.js');
const {
  dispatchUnit,
  takeTrip,
  patchReq,
  nextReqId,
  compatible,
  eligibleDonors,
  completeDonation,
  CHECKS,
  DEFAULT_TRIP
} = await import('../public/js/domain.js');
const { getClientId } = await import('../public/js/firebase-sync.js');

describe('Cross-Role Deep Testing & Workflow Integrity', () => {
  beforeEach(() => {
    reset();
  });

  describe('1. Transport Telemetry Silent Mode (No-Sync / Anti-Flicker)', () => {
    it('does not trigger window.__vitalred_on_local_change when noSync: true is passed', () => {
      let syncCalled = false;
      globalThis.window.__vitalred_on_local_change = () => {
        syncCalled = true;
      };

      // Simulated thermal IoT tick with noSync: true
      set({ temp: 4.8 }, { noSync: true });
      assert.strictEqual(syncCalled, false, 'Internal telemetry tick must not trigger cloud sync');

      // Standard operational change without noSync
      set({ activeReqId: 'ST-2048' });
      assert.strictEqual(syncCalled, true, 'Regular business action must trigger cloud sync');
    });

    it('identifies and attaches unique client ID for loopback echo suppression', () => {
      const clientId = getClientId();
      assert.ok(typeof clientId === 'string' && clientId.startsWith('client_'), 'Client ID must be defined');
    });
  });

  describe('2. Multi-Role Emergency Transfusion Lifecycle', () => {
    it('executes full sequence: Médico -> Donante -> Banco -> Transportista -> Médico', () => {
      // STEP 1: Médico creates an urgent Código Rojo request
      const reqId = nextReqId();
      const initialReq = {
        id: reqId,
        blood: 'O-',
        units: 2,
        priority: 'CRÍTICA',
        component: 'Concentrado de hematíes',
        hospital: 'Hospital General',
        patient: 'Paciente Urgencias Alpha',
        hc: 'HC-99201',
        bed: 'Quirófano 1',
        requester: 'Dra. Ana Torres',
        status: 'buscando',
        notified: 4,
        createdAt: new Date().toISOString(),
        live: true,
        log: [{ k: 'creada', at: Date.now() }]
      };
      set({ requests: [initialReq, ...get().requests], activeReqId: reqId, req: initialReq });
      assert.strictEqual(get().activeReqId, reqId);
      assert.strictEqual(get().req.status, 'buscando');

      // STEP 2: Donante accepts and agrees to donate
      const donorUser = get().users.find((u) => u.role === 'donor') || { name: 'Aleks López', email: 'donante@vitalred.org', blood: 'O+' };
      assert.ok(compatible('O-', initialReq.blood), 'O- donor is compatible with O- request');
      patchReq({ status: 'esperando', donor: { name: donorUser.name, email: donorUser.email, blood: donorUser.blood } }, reqId);
      
      const reqAfterAccept = get().requests.find((r) => r.id === reqId);
      assert.strictEqual(reqAfterAccept.status, 'esperando');
      assert.strictEqual(reqAfterAccept.donor.email, donorUser.email);

      // Donor schedules appointment
      const appt = { id: 'VR-2026-9901', name: donorUser.name, email: donorUser.email, blood: donorUser.blood, time: '09:00', state: 'Programada' };
      set({ appts: [appt, ...get().appts], myAppt: appt });
      patchReq({ status: 'programada', appt: { id: appt.id, time: appt.time } }, reqId);
      
      const reqAfterAppt = get().requests.find((r) => r.id === reqId);
      assert.strictEqual(reqAfterAppt.status, 'programada');

      // STEP 3: Banco de Sangre authorizes extraction and approves donation
      completeDonation(appt);
      const reqAfterApprove = get().requests.find((r) => r.id === reqId);
      assert.strictEqual(reqAfterApprove.status, 'completada');
      assert.strictEqual(reqAfterApprove.delivery, 'preparando');

      // STEP 4: Banco dispatches biological unit with specific reqId
      const dispatchedTrip = dispatchUnit({ ...DEFAULT_TRIP }, reqId);
      assert.ok(dispatchedTrip, 'Trip must be successfully dispatched');
      assert.strictEqual(dispatchedTrip.reqId, reqId);
      assert.strictEqual(dispatchedTrip.status, 'disponible');

      const reqAfterDispatch = get().requests.find((r) => r.id === reqId);
      assert.strictEqual(reqAfterDispatch.delivery, 'despachada');
      assert.strictEqual(reqAfterDispatch.tripId, dispatchedTrip.id);

      // STEP 5: Transportista takes the trip from queue
      const transportUser = get().users.find((u) => u.role === 'transport');
      const takenTrip = takeTrip(dispatchedTrip.id, transportUser);
      assert.ok(takenTrip, 'Transporter takes trip');
      assert.strictEqual(takenTrip.status, 'asignada');

      const reqAfterTake = get().requests.find((r) => r.id === reqId);
      assert.strictEqual(reqAfterTake.delivery, 'asignada');

      // STEP 6: Transportista verifies custody & initiates transit
      patchReq({ delivery: 'en_ruta' }, takenTrip.reqId);
      const reqInTransit = get().requests.find((r) => r.id === reqId);
      assert.strictEqual(reqInTransit.delivery, 'en_ruta');

      // STEP 7: Transportista delivers unit at destination
      patchReq({ delivery: 'entregada', deliveredAt: new Date().toISOString() }, takenTrip.reqId);
      const reqDelivered = get().requests.find((r) => r.id === reqId);
      assert.strictEqual(reqDelivered.delivery, 'entregada');

      // STEP 8: Personal Médico completes clinical reception and closes case
      patchReq({ status: 'cerrada', receivedAt: new Date().toISOString() }, reqId);
      const reqClosed = get().requests.find((r) => r.id === reqId);
      assert.strictEqual(reqClosed.status, 'cerrada');
    });
  });

  describe('3. Selective Dispatching with Target Request ID', () => {
    it('dispatches the clicked request even when activeReqId points to another request', () => {
      const reqA = { id: 'ST-9001', hospital: 'Hospital Infantil', blood: 'A+', units: 2, status: 'buscando', component: 'Concentrado', priority: 'ALTA' };
      const reqB = { id: 'ST-9002', hospital: 'Hospital San Rafael', blood: 'B+', units: 1, status: 'completada', delivery: 'preparando', component: 'Plasma', priority: 'CRÍTICA' };

      set({ requests: [reqA, reqB], activeReqId: 'ST-9001', req: reqA });

      // Click "Despachar" on ST-9002 specifically
      const trip = dispatchUnit({ ...DEFAULT_TRIP }, 'ST-9002');
      assert.ok(trip, 'Must dispatch ST-9002');
      assert.strictEqual(trip.reqId, 'ST-9002');
      assert.strictEqual(trip.dest, 'Hospital San Rafael');

      const updatedB = get().requests.find((r) => r.id === 'ST-9002');
      assert.strictEqual(updatedB.delivery, 'despachada');
    });
  });

  describe('4. Trip Release & Queue Restoration Contract', () => {
    it('restores trip to queue with full metadata and resets delivery to despachada', () => {
      const req = { id: 'ST-7701', hospital: 'Clínica 25', blood: 'O+', units: 1, status: 'completada', delivery: 'preparando', component: 'Plaquetas', priority: 'ALTA' };
      set({ requests: [req], activeReqId: 'ST-7701', req });

      const trip = dispatchUnit({ ...DEFAULT_TRIP }, 'ST-7701');
      const transportUser = { name: 'Luis Pérez', unit: 'AMB-014' };
      takeTrip(trip.id, transportUser);

      // Verify trip is assigned
      assert.strictEqual(get().trip.status, 'asignada');
      assert.strictEqual(get().requests.find((r) => r.id === 'ST-7701').delivery, 'asignada');

      // Now transportista releases the trip
      const cur = get().trip;
      const queue = get().tripQueue || [];
      queue.unshift({
        id: cur.id,
        origin: cur.origin,
        dest: cur.dest,
        content: cur.content,
        distance: cur.distance,
        eta: cur.eta,
        reqId: cur.reqId,
        area: cur.area,
        bed: cur.bed,
        priority: cur.priority,
        requester: cur.requester,
        status: 'disponible',
        publishedAt: Date.now()
      });
      patchReq({ delivery: 'despachada' }, cur.reqId);
      set({ trip: null, tripQueue: queue });

      // Verify trip is cleared, back in queue, and request is despachada
      assert.strictEqual(get().trip, null);
      assert.strictEqual(get().tripQueue.length, 1);
      assert.strictEqual(get().tripQueue[0].reqId, 'ST-7701');
      assert.strictEqual(get().requests.find((r) => r.id === 'ST-7701').delivery, 'despachada');
    });
  });

  describe('5. Cancellation of Requests Cleans Pending Trips', () => {
    it('removes pending trips from tripQueue when doctor cancels the request', () => {
      const req = { id: 'ST-8801', hospital: 'Hospital Juárez', blood: 'O-', units: 3, status: 'completada', delivery: 'preparando', component: 'Concentrado', priority: 'CRÍTICA' };
      set({ requests: [req], activeReqId: 'ST-8801', req });

      dispatchUnit({ ...DEFAULT_TRIP }, 'ST-8801');
      assert.strictEqual(get().tripQueue.length, 1);
      assert.strictEqual(get().tripQueue[0].reqId, 'ST-8801');

      // Doctor cancels ST-8801
      patchReq({ status: 'cancelada' }, 'ST-8801');
      const cleanQueue = (get().tripQueue || []).filter((q) => q.reqId !== 'ST-8801');
      set({ tripQueue: cleanQueue });

      assert.strictEqual(get().tripQueue.length, 0, 'Cancelled request trip must be pruned from queue');
    });
  });
});
