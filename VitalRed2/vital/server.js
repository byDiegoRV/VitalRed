import express from 'express';
import { fileURLToPath } from 'node:url';
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.static(fileURLToPath(new URL('./public', import.meta.url))));
app.listen(PORT, () => console.log(`VitalRed v3 → http://localhost:${PORT}`));
