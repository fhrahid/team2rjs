import { Router } from 'express';
import { getActiveAlerts } from '../services/alertService.js';

const router = Router();

// GET /api/alerts – currently active alerts
router.get('/alerts', (req, res) => {
  res.json(getActiveAlerts());
});

export default router;
