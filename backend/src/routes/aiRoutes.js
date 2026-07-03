import { Router } from 'express';
import { chat, endSession, humanize, aiStatus } from '../services/aiService.js';

const router = Router();

// GET /api/ai/status – is the Groq LLM configured?
router.get('/ai/status', (req, res) => {
  res.json(aiStatus());
});

// POST /api/ai/humanize – { facts, fallback } -> { text, ai }
// Used by the Discord bot so the LLM key lives only in the backend.
router.post('/ai/humanize', async (req, res) => {
  const { facts, fallback } = req.body ?? {};
  if (!facts) return res.status(400).json({ error: 'Missing "facts" in body' });
  res.json(await humanize(String(facts), String(fallback ?? facts)));
});

// POST /api/ai/chat – { sessionId?, message } -> { sessionId, reply, ai }
// Multi-turn chat grounded in live office data + RAG waste history.
router.post('/ai/chat', async (req, res) => {
  const { sessionId, message } = req.body ?? {};
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'Missing "message" in body' });
  }
  res.json(await chat(sessionId, String(message).trim()));
});

// POST /api/ai/chat/end – { sessionId } -> { ended }
router.post('/ai/chat/end', (req, res) => {
  const { sessionId } = req.body ?? {};
  res.json({ ended: sessionId ? endSession(sessionId) : false });
});

export default router;
