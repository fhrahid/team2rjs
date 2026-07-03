// Entry point: Express REST API + Socket.IO + device simulator.
// One process, one in-memory store — the single source of truth for the
// dashboard AND the Discord bot.
import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';

import deviceRoutes from './routes/deviceRoutes.js';
import usageRoutes from './routes/usageRoutes.js';
import alertRoutes from './routes/alertRoutes.js';
import wasteRoutes from './routes/wasteRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import { aiStatus } from './services/aiService.js';
import { initSocket, broadcastUpdate } from './socket/socketManager.js';
import { seedInitialState, startSimulator } from './services/simulator.js';
import { initRag } from './services/ragService.js';
import { store } from './data/devices.js';

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const app = express();
app.use(cors({ origin: [CLIENT_URL, /localhost/] }));
app.use(express.json());

// GET /api/health – backend status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    deviceCount: store.getAll().length,
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', deviceRoutes);
app.use('/api', usageRoutes);
app.use('/api', alertRoutes);
app.use('/api', wasteRoutes);
app.use('/api', settingsRoutes);
app.use('/api', aiRoutes);

const httpServer = http.createServer(app);
initSocket(httpServer, CLIENT_URL);

// Boot: connect RAG store, seed a realistic state, start the occupancy simulation.
await initRag();
seedInitialState();
startSimulator(({ events }) => {
  events.forEach((e) => console.log('  •', e));
  broadcastUpdate();
});

httpServer.listen(PORT, () => {
  console.log(`⚡ Office monitor backend running on http://localhost:${PORT}`);
  console.log(`   ${store.getAll().length} devices simulated`);
  const ai = aiStatus();
  console.log(ai.enabled ? `🧠 Groq LLM enabled (${ai.model})` : `🧠 Groq LLM NOT configured — ${ai.hint}`);
});
