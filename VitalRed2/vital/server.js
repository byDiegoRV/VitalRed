import express from 'express';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const app = express();
const PORT = process.env.PORT || 3000;
const BOOT = Date.now().toString(36);

app.get('/boot.js', (req, res) => res.type('js').set('Cache-Control', 'no-store').send(`window.__BOOT="${BOOT}";`));
app.use(express.static(fileURLToPath(new URL('./public', import.meta.url))));

function getNetworkIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

app.listen(PORT, '0.0.0.0', () => {
  const ip = getNetworkIp();
  console.log('\n  VitalRed v3 activo y listo:');
  console.log(`  > Computadora (Local): http://localhost:${PORT}`);
  console.log(`  > Teléfonos / Tablets: http://${ip}:${PORT}\n`);
});
