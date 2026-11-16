// Configuración oficial de Firebase Cloud Firestore para VitalRed v3
// Proyecto creado: vitalred-demo-972995
export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyB-vYn8TZw4XU6WZ58LdACeyJ00swSoamQ',
  authDomain: 'vitalred-demo-972995.firebaseapp.com',
  projectId: 'vitalred-demo-972995',
  storageBucket: 'vitalred-demo-972995.firebasestorage.app',
  messagingSenderId: '144849434239',
  appId: '1:144849434239:web:563a7520c7e9941374314a'
};

export const DEFAULT_ROOM_ID = 'guardia-central';

const CFG_KEY = 'vitalred_firebase_config';
const ROOM_KEY = 'vitalred_sync_room';

export const getFirebaseConfig = () => {
  try {
    const custom = localStorage.getItem(CFG_KEY);
    if (custom) return JSON.parse(custom);
  } catch (e) {}
  return DEFAULT_FIREBASE_CONFIG;
};

export const setFirebaseConfig = (cfg) => {
  try {
    if (!cfg) localStorage.removeItem(CFG_KEY);
    else localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  } catch (e) {}
};

export const getSyncRoom = () => {
  try {
    return localStorage.getItem(ROOM_KEY) || DEFAULT_ROOM_ID;
  } catch (e) {
    return DEFAULT_ROOM_ID;
  }
};

export const setSyncRoom = (roomId) => {
  try {
    localStorage.setItem(ROOM_KEY, roomId || DEFAULT_ROOM_ID);
  } catch (e) {}
};
