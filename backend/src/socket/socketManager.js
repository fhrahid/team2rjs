// Socket.IO wiring: pushes live state to the dashboard (and the bot, which
// listens for alerts:update to post proactive Discord messages).
import { Server } from 'socket.io';
import { store } from '../data/devices.js';
import { getStatusSummary, getUsage, getWasteAnalytics } from '../services/usageService.js';
import { getActiveAlerts } from '../services/alertService.js';
import { settings } from '../services/settings.js';

let io = null;

export function initSocket(httpServer, clientUrl) {
  io = new Server(httpServer, {
    cors: { origin: clientUrl ? [clientUrl, /localhost/] : '*' },
  });

  io.on('connection', (socket) => {
    // Give every new client the full picture immediately
    socket.emit('dashboard:update', buildDashboardPayload());
  });

  return io;
}

export function buildDashboardPayload() {
  return {
    devices: store.getAll(),
    groupedDevices: store.getGrouped(),
    status: getStatusSummary(),
    usage: getUsage(),
    alerts: getActiveAlerts(),
    waste: getWasteAnalytics(),
    settings,
  };
}

/** Broadcast all live events after each simulation tick / manual toggle. */
export function broadcastUpdate() {
  if (!io) return;
  const payload = buildDashboardPayload();
  io.emit('devices:update', payload.devices);
  io.emit('usage:update', payload.usage);
  io.emit('alerts:update', payload.alerts);
  io.emit('dashboard:update', payload);
}
