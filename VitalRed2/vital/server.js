import express from 'express';
import { fileURLToPath } from 'node:url';
const app = express();
const PORT = process.env.PORT || 3000;
const BOOT = Date.now().toString(36); // cambia en cada arranque: invalida sesiones anteriores
app.get('/boot.js', (req, res) => res.type('js').set('Cache-Control', 'no-store').send(`window.__BOOT="${BOOT}";`));
app.use(express.static(fileURLToPath(new URL('./public', import.meta.url))));
app.listen(PORT, () => console.log(`VitalRed v3 → http://localhost:${PORT}`));
