const KEY = 'vitalred-v3';
const seed = () => ({
  theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  session: null,
  users: [
    { name: 'Aleks López', email: 'donante@vitalred.org', password: 'Donante123', role: 'donor', blood: 'O+', status: 'Apto para donar', donations: 4 },
    { name: 'Dra. Ana Torres', email: 'medico@vitalred.org', password: 'Medico123', role: 'medical', hospital: 'Hospital General' },
    { name: 'Luis Pérez', email: 'transporte@vitalred.org', password: 'Transp123', role: 'transport', hospital: 'Banco Central', unit: 'AMB-014', license: 'LIC-458213' },
    { name: 'Mtra. Sofía Ruiz', email: 'banco@vitalred.org', password: 'Banco123', role: 'bank', hospital: 'Banco Central' },
  ],
  req: null, reg: null, triageAns: null, triage: null, temp: 4.2, signed: false,
  appts: [
    ['08:00','Carlos Mendoza R.','O-','FOL-9830','Extracción'],['08:30','Alejandra Gómez P.','O+','FOL-9821','Completada'],['09:15','Sofía Rodríguez S.','A-','FOL-9825','Completada'],
    ['10:00','Mariana Chávez F.','B+','FOL-9834','Pre-Triaje'],['11:15','Roberto Garibay H.','AB+','FOL-9840','Programada'],['12:00','Elena Villalobos G.','O+','FOL-9842','Programada'],['13:15','Diego Martínez N.','A+','FOL-9845','No asistió'],
  ].map(([time, name, blood, id, state]) => ({ time, name, blood, id, state })),
});
let state = JSON.parse(localStorage.getItem(KEY) || 'null') || seed();
export const get = () => state;
export const set = (patch) => { Object.assign(state, patch); localStorage.setItem(KEY, JSON.stringify(state)); };
export const reset = () => { localStorage.removeItem(KEY); state = seed(); };
export const currentUser = () => state.users.find((u) => u.email === state.session);
export const HOME = { donor: 'd/profile', medical: 'm/dashboard', bank: 'b/dash', transport: 't/home' };
export const ROLES = { donor: 'Donante Voluntario', medical: 'Personal Médico', transport: 'Transportista Sanitario', bank: 'Banco de Sangre' };
