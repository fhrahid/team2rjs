import { Router } from 'express';
import { getWasteAnalytics } from '../services/usageService.js';
import { queryEvents, getRecentEvents, getRagStatus } from '../services/ragService.js';

const router = Router();

// GET /api/waste – per-room used vs wasted energy, office/after-hours split,
// after-hours lingering, top consumer / top waster + recent waste events
router.get('/waste', (req, res) => {
  res.json(getWasteAnalytics());
});

// GET /api/waste/events – recent raw waste events (from the RAG log)
router.get('/waste/events', (req, res) => {
  res.json(getRecentEvents(Number(req.query.n) || 20));
});

// GET /api/rag/query?q=... – retrieve relevant waste events for a question
// (used by the bot's !ask command; answers stay grounded in stored events)
router.get('/rag/query', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.status(400).json({ error: 'Missing ?q= question parameter' });
  const result = await queryEvents(q, Number(req.query.n) || 5);
  res.json({ question: q, ...result, rag: getRagStatus() });
});

export default router;
