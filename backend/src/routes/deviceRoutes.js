import { Router } from 'express';
import { store, ROOMS } from '../data/devices.js';
import { getStatusSummary } from '../services/usageService.js';
import { recalcAlerts } from '../services/alertService.js';
import { broadcastUpdate } from '../socket/socketManager.js';

const router = Router();

// GET /api/devices – all devices
router.get('/devices', (req, res) => {
  res.json(store.getAll());
});

// GET /api/devices/grouped – devices grouped by room
router.get('/devices/grouped', (req, res) => {
  res.json(store.getGrouped());
});

// POST /api/devices/:id/toggle – manual toggle (handy for demos)
router.post('/devices/:id/toggle', (req, res) => {
  const device = store.toggle(req.params.id);
  if (!device) return res.status(404).json({ error: `Unknown device id '${req.params.id}'` });
  recalcAlerts();
  broadcastUpdate();
  res.json(device);
});

// GET /api/status – room-wise status summary
router.get('/status', (req, res) => {
  res.json(getStatusSummary());
});

// POST /api/rooms/:roomKey/devices – switch ALL devices in a room on/off
// body: { status: 'on' | 'off' }  (used by the bot's !on / !off commands)
router.post('/rooms/:roomKey/devices', (req, res) => {
  const { roomKey } = req.params;
  const room = ROOMS.find((r) => r.key === roomKey);
  if (!room) return res.status(404).json({ error: `Unknown room '${roomKey}'` });
  const status = req.body?.status;
  if (status !== 'on' && status !== 'off') {
    return res.status(400).json({ error: "body must be { status: 'on' | 'off' }" });
  }
  const changed = store
    .getByRoomKey(roomKey)
    .filter((d) => d.status !== status)
    .map((d) => store.setStatus(d.id, status));
  recalcAlerts();
  broadcastUpdate();
  res.json({ roomKey, room: room.name, status, changedCount: changed.length });
});

// POST /api/rooms/:roomKey/occupancy – simulate the PIR sensor for demos
// body: { occupied: true|false }
router.post('/rooms/:roomKey/occupancy', (req, res) => {
  const { roomKey } = req.params;
  const room = ROOMS.find((r) => r.key === roomKey);
  if (!room) return res.status(404).json({ error: `Unknown room '${roomKey}'` });
  const occupied = Boolean(req.body?.occupied);
  store.setOccupancy(roomKey, occupied);
  recalcAlerts();
  broadcastUpdate();
  res.json({ roomKey, room: room.name, occupied });
});

// GET /api/rooms/:roomKey – one room's status + devices (drawing | work1 | work2)
router.get('/rooms/:roomKey', (req, res) => {
  const { roomKey } = req.params;
  const room = ROOMS.find((r) => r.key === roomKey);
  if (!room) {
    return res.status(404).json({
      error: `Unknown room '${roomKey}'. Valid keys: ${ROOMS.map((r) => r.key).join(', ')}`,
    });
  }
  const summary = getStatusSummary().rooms.find((r) => r.roomKey === roomKey);
  res.json({ ...summary, devices: store.getByRoomKey(roomKey) });
});

export default router;
