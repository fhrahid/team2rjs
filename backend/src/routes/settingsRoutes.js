import { Router } from 'express';
import { settings, updateSettings } from '../services/settings.js';
import { recalcAlerts } from '../services/alertService.js';
import { broadcastUpdate } from '../socket/socketManager.js';

const router = Router();

// GET /api/settings – current AI auto-off configuration
router.get('/settings', (req, res) => {
  res.json(settings);
});

// POST /api/settings – update from the dashboard
// body: { aiEnabled?: boolean, autoOffDelaySeconds?: number (5–3600) }
router.post('/settings', (req, res) => {
  try {
    const updated = updateSettings(req.body ?? {});
    recalcAlerts();
    broadcastUpdate();
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
