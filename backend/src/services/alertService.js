// Alert rules:
//  1. AFTER_HOURS – a room still has devices ON outside office hours (9 AM–5 PM)
//  2. ALL_ON_2H   – every device in a room has been ON continuously for > 2 hours
//  3. ROOM_EMPTY  – PIR says the room is empty but devices are still ON.
//                   This alert fires FIRST (dashboard + Discord), then the AI
//                   auto-off kicks in after the configured delay.
import { store, ROOMS } from '../data/devices.js';
import { settings } from './settings.js';

export const OFFICE_START_HOUR = 9; // 9 AM
export const OFFICE_END_HOUR = 17; // 5 PM
// Configurable so the 2h rule can be shortened for demos (e.g. ALL_ON_ALERT_MINUTES=1)
const ALL_ON_ALERT_MS =
  Number(process.env.ALL_ON_ALERT_MINUTES ?? 120) * 60 * 1000;

let alertCounter = 0;
// Stable alerts between recalculations: key -> alert (ids/timestamps don't churn)
const activeAlertsByKey = new Map();

export function isOfficeHours(date = new Date()) {
  const h = date.getHours();
  return h >= OFFICE_START_HOUR && h < OFFICE_END_HOUR;
}

/** Recompute the active alert list from current store state. */
export function recalcAlerts(now = new Date()) {
  const currentKeys = new Set();

  for (const room of ROOMS) {
    const devices = store.getByRoomKey(room.key);
    const onDevices = devices.filter((d) => d.status === 'on');
    const roomState = store.rooms[room.key];

    // Rule 1: devices left ON after office hours
    if (!isOfficeHours(now) && onDevices.length > 0) {
      const key = `AFTER_HOURS:${room.key}`;
      currentKeys.add(key);
      if (!activeAlertsByKey.has(key)) {
        const fans = onDevices.filter((d) => d.type === 'fan').length;
        const lights = onDevices.filter((d) => d.type === 'light').length;
        activeAlertsByKey.set(
          key,
          makeAlert('AFTER_HOURS', room.name, room.key, 'warning', now,
            `${room.name} still has ${describe(fans, 'fan')} and ${describe(lights, 'light')} running after office hours.`)
        );
      }
    }

    // Rule 2: all devices in a room ON for more than 2 hours
    const allOnSince = store.roomAllOnSince[room.key];
    if (allOnSince && now - new Date(allOnSince) > ALL_ON_ALERT_MS) {
      const key = `ALL_ON_2H:${room.key}`;
      currentKeys.add(key);
      if (!activeAlertsByKey.has(key)) {
        const hours = ((now - new Date(allOnSince)) / 3600000).toFixed(1);
        activeAlertsByKey.set(
          key,
          makeAlert('ALL_ON_2H', room.name, room.key, 'critical', now,
            `All ${devices.length} devices in ${room.name} have been ON continuously for ${hours}+ hours.`)
        );
      }
    }

    // Rule 3: PIR detects the room is empty but devices are ON
    if (!roomState.occupied && onDevices.length > 0) {
      const key = `ROOM_EMPTY:${room.key}`;
      currentKeys.add(key);
      if (!activeAlertsByKey.has(key)) {
        const action = settings.aiEnabled
          ? `AI will switch them off in ~${settings.autoOffDelaySeconds}s.`
          : 'AI auto-off is disabled — switch them off from the dashboard.';
        activeAlertsByKey.set(
          key,
          makeAlert('ROOM_EMPTY', room.name, room.key, 'warning', now,
            `PIR: ${room.name} is empty but ${describe(onDevices.length, 'device')} still ON (${store.roomPowerNow(room.key)}W). ${action}`)
        );
      }
    }
  }

  // Drop alerts whose condition has cleared
  for (const key of activeAlertsByKey.keys()) {
    if (!currentKeys.has(key)) activeAlertsByKey.delete(key);
  }

  return getActiveAlerts();
}

export function getActiveAlerts() {
  return [...activeAlertsByKey.values()].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );
}

function makeAlert(type, room, roomKey, severity, now, message) {
  alertCounter += 1;
  return {
    id: `alert-${String(alertCounter).padStart(3, '0')}`,
    type,
    room,
    roomKey,
    message,
    severity,
    timestamp: now.toISOString(),
  };
}

function describe(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
