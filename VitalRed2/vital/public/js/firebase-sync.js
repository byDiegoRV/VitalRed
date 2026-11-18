import { getFirebaseConfig, getSyncRoom } from './firebase-config.js';

let app = null;
let db = null;
let unsubscribe = null;
let isRemoteApplying = false;
let syncStatus = 'local'; // 'local' | 'connecting' | 'online' | 'error'
let lastSyncTime = null;
let errorMsg = null;
const statusListeners = new Set();
let pushTimer = null;
const CLIENT_ID = 'client_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();

export const getClientId = () => CLIENT_ID;

export const getSyncStatus = () => ({
  status: syncStatus,
  room: getSyncRoom(),
  lastSync: lastSyncTime,
  error: errorMsg
});

export const onSyncStatusChange = (fn) => {
  statusListeners.add(fn);
  fn(getSyncStatus());
  return () => statusListeners.delete(fn);
};

const notifyStatus = (status, err = null) => {
  syncStatus = status;
  errorMsg = err;
  if (status === 'online') lastSyncTime = new Date().toLocaleTimeString();
  const info = getSyncStatus();
  statusListeners.forEach((fn) => {
    try { fn(info); } catch (e) {}
  });
};

/**
 * Inicializa la conexión en tiempo real con Cloud Firestore.
 * Carga el SDK oficial modular v10 de Google vía CDN dinámico ESM.
 * Si no hay entorno de navegador o falla la conexión, entra en fallback local seguro.
 */
export const initFirebaseSync = async (onRemoteUpdate) => {
  if (typeof window === 'undefined') {
    notifyStatus('local');
    return { ok: false, mode: 'local' };
  }

  const config = getFirebaseConfig();
  if (!config || !config.apiKey || !config.projectId) {
    notifyStatus('local');
    return { ok: false, mode: 'local' };
  }

  notifyStatus('connecting');

  try {
    const { initializeApp, getApps, getApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getFirestore, doc, onSnapshot, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    app = getApps().length ? getApp() : initializeApp(config);
    db = getFirestore(app);

    const roomId = getSyncRoom();
    const roomDocRef = doc(db, 'vitalred_rooms', roomId);

    // Cancelar suscripción previa si existía
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    // Escucha en tiempo real de cambios generados por otros dispositivos
    unsubscribe = onSnapshot(
      roomDocRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          notifyStatus('online');
          return;
        }
        // Ignorar snapshots con escrituras locales pendientes en curso
        if (snapshot.metadata && snapshot.metadata.hasPendingWrites) {
          return;
        }
        const data = snapshot.data();
        if (data && data.payload) {
          // Si el payload fue emitido por esta misma pestaña/dispositivo, no re-aplicar
          if (data.payload.senderId === CLIENT_ID) {
            notifyStatus('online');
            return;
          }
          isRemoteApplying = true;
          try {
            applyRemoteState(data.payload, onRemoteUpdate);
            notifyStatus('online');
          } finally {
            setTimeout(() => { isRemoteApplying = false; }, 50);
          }
        } else {
          notifyStatus('online');
        }
      },
      (err) => {
        console.warn('[VitalRed Firebase Sync] Fallback local activo:', err.message);
        notifyStatus('local', err.message);
      }
    );

    return { ok: true, mode: 'online', room: roomId };
  } catch (err) {
    console.warn('[VitalRed Firebase Sync] Inicialización en modo local (sin nube):', err.message);
    notifyStatus('local', err.message);
    return { ok: false, mode: 'local', error: err.message };
  }
};

export const applyRemoteState = (payload, onRemoteUpdate) => {
  if (!payload || typeof payload !== 'object') return;
  if (onRemoteUpdate) {
    onRemoteUpdate(payload);
  }
};

/**
 * Envía el estado actualizado de la aplicación a Firestore para propagarlo a los demás dispositivos.
 */
export const syncPushState = async (state) => {
  if (isRemoteApplying || !db || syncStatus !== 'online') return;

  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    try {
      const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      const roomId = getSyncRoom();
      const roomDocRef = doc(db, 'vitalred_rooms', roomId);

      // Sanitizar el estado para Firestore (solo datos sincronizables de la guardia)
      const payload = {
        senderId: CLIENT_ID,
        users: state.users || [],
        requests: state.requests || [],
        activeReqId: state.activeReqId || null,
        req: state.req || null,
        trip: state.trip || null,
        tripQueue: state.tripQueue || [],
        tripHistory: state.tripHistory || [],
        fleet: state.fleet || {},
        inventory: state.inventory || [],
        appts: state.appts || [],
        reviews: state.reviews || [],
        donations: state.donations || [],
        lastDonation: state.lastDonation || null,
        campaign: state.campaign || null,
        reserved: state.reserved || [],
        updatedAt: new Date().toISOString(),
        updatedBy: state.session?.email || 'vitalred-client'
      };

      await setDoc(roomDocRef, { payload }, { merge: true });
      lastSyncTime = new Date().toLocaleTimeString();
      notifyStatus('online');
    } catch (err) {
      console.warn('[VitalRed Firebase Sync] Error al sincronizar con la nube:', err.message);
      notifyStatus('local', err.message);
    }
  }, 120);
};

export const isApplyingRemote = () => isRemoteApplying;

/**
 * Modal accesible de configuración y monitoreo de sincronización multidispositivo
 */
export const openSyncModal = (onReconnect) => {
  const sync = getSyncStatus();
  const cfg = getFirebaseConfig();
  const isOnline = sync.status === 'online';
  const isConn = sync.status === 'connecting';

  const m = document.createElement('div');
  m.className = 'modal';
  m.setAttribute('role', 'dialog');
  m.setAttribute('aria-modal', 'true');
  m.setAttribute('aria-labelledby', 'syncTitle');

  const escHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  m.innerHTML = `
    <div class="card notif-panel" style="max-width:480px">
      <div class="between">
        <div>
          <h2 id="syncTitle">Sincronización en la Nube</h2>
          <small class="mut">Firebase Cloud Firestore en tiempo real</small>
        </div>
        <button class="btn ghost sm" id="closeSyncModal" style="width:auto">✕</button>
      </div>

      <div class="stack" style="margin-top:16px">
        <div class="item" style="border-left:4px solid ${isOnline ? 'var(--ok-solid)' : isConn ? 'var(--warn-solid)' : 'var(--blue-solid)'};background:var(--soft)">
          <div>
            <b>${isOnline ? '🟢 Sincronizado en Vivo' : isConn ? '🟡 Conectando con Firebase...' : '💻 Modo Local (Offline-First)'}</b>
            <small class="mut" style="display:block;margin-top:2px">
              ${isOnline ? 'Todos los dispositivos conectados a esta sala comparten solicitudes, viajes e inventario en tiempo real.' : 'Operando con almacenamiento local. Tus datos se guardan de forma segura en tu navegador.'}
            </small>
          </div>
        </div>

        <div class="card" style="margin:0;padding:14px;background:var(--card)">
          <label class="field">
            <span>Sala de sincronización compartida</span>
            <input id="syncRoomField" type="text" value="${escHtml(sync.room)}" placeholder="guardia-central" style="margin-top:4px">
          </label>
          <small class="mut" style="display:block;margin-top:4px">Dispositivos en la misma sala (ej. tu teléfono y tu laptop) verán las alertas en simultáneo.</small>
          <div class="row" style="margin-top:12px">
            <button class="btn primary sm" id="btnApplyRoom" type="button" style="width:auto">Conectar Sala</button>
          </div>
        </div>

        <div style="font-size:12px;color:var(--mut);line-height:1.4">
          <div><b>Proyecto Firebase:</b> <code>${escHtml(cfg.projectId || 'vitalred-demo-972995')}</code></div>
          ${sync.lastSync ? `<div><b>Última actualización:</b> ${escHtml(sync.lastSync)}</div>` : ''}
          ${sync.error ? `<div style="color:var(--warn-text);margin-top:4px"><b>Diagnóstico:</b> ${escHtml(sync.error)}</div>` : ''}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(m);
  setTimeout(() => m.classList.add('in'), 10);

  const close = () => {
    m.classList.remove('in');
    setTimeout(() => m.remove(), 200);
  };

  m.querySelector('#closeSyncModal')?.addEventListener('click', close);
  m.addEventListener('click', (e) => { if (e.target === m) close(); });
  m.querySelector('#btnApplyRoom')?.addEventListener('click', () => {
    const r = m.querySelector('#syncRoomField')?.value.trim() || 'guardia-central';
    import('./firebase-config.js').then(({ setSyncRoom }) => {
      setSyncRoom(r);
      close();
      onReconnect?.(r);
    });
  });
};
