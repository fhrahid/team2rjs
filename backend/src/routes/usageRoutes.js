import { Router } from 'express';
import { getUsage } from '../services/usageService.js';

const router = Router();

// GET /api/usage – total power now, estimated kWh today, per-room breakdown
router.get('/usage', (req, res) => {
  res.json(getUsage());
});

export default router;
