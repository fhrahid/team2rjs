// Power / usage / waste calculations, all derived from the single in-memory store.
import { store, ROOMS } from '../data/devices.js';
import { getRecentEvents, getRagStatus } from './ragService.js';

/** Room-wise status summary (fans ON, lights ON, totals). */
export function getStatusSummary() {
  const rooms = ROOMS.map((room) => {
    const devices = store.getByRoomKey(room.key);
    const on = devices.filter((d) => d.status === 'on');
    const state = store.rooms[room.key];
    return {
      roomKey: room.key,
      room: room.name,
      occupied: state.occupied,
      emptySince: state.emptySince,
      fansOn: on.filter((d) => d.type === 'fan').length,
      fansTotal: devices.filter((d) => d.type === 'fan').length,
      lightsOn: on.filter((d) => d.type === 'light').length,
      lightsTotal: devices.filter((d) => d.type === 'light').length,
      devicesOn: on.length,
      devicesOff: devices.length - on.length,
      powerNow: on.reduce((sum, d) => sum + d.currentPower, 0),
    };
  });

  const all = store.getAll();
  return {
    rooms,
    totals: {
      devices: all.length,
      devicesOn: all.filter((d) => d.status === 'on').length,
      devicesOff: all.filter((d) => d.status === 'off').length,
      fansOn: all.filter((d) => d.type === 'fan' && d.status === 'on').length,
      lightsOn: all.filter((d) => d.type === 'light' && d.status === 'on').length,
      totalPowerNow: store.totalPowerNow(),
    },
    timestamp: new Date().toISOString(),
  };
}

/** Live usage numbers for the dashboard / bot. */
export function getUsage() {
  const perRoomUsage = ROOMS.map((room) => {
    const devices = store.getByRoomKey(room.key);
    const powerNow = devices.reduce((sum, d) => sum + d.currentPower, 0);
    return { roomKey: room.key, room: room.name, powerNow };
  });

  const totalPowerNow = store.totalPowerNow();
  const highest = perRoomUsage.reduce((a, b) => (b.powerNow > a.powerNow ? b : a));

  return {
    totalPowerNow,
    estimatedTodayKwh: Number((store.energyWhToday / 1000).toFixed(3)),
    perRoomUsage,
    highestConsumingRoom: highest.powerNow > 0 ? highest.room : null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Waste analytics for the dashboard, bot and RAG:
 * per-room used vs wasted energy, split office-hours / after-hours,
 * plus "who lingers after 5 PM" and top consumer / top waster.
 */
export function getWasteAnalytics() {
  const rooms = ROOMS.map((room) => {
    const s = store.rooms[room.key];
    const usedWh = s.used.officeWh + s.used.afterHoursWh;
    const wastedWh = s.wasted.officeWh + s.wasted.afterHoursWh;
    return {
      roomKey: room.key,
      room: room.name,
      occupied: s.occupied,
      usedWh: round(usedWh),
      wastedWh: round(wastedWh),
      usedOfficeWh: round(s.used.officeWh),
      usedAfterHoursWh: round(s.used.afterHoursWh),
      wastedOfficeWh: round(s.wasted.officeWh),
      wastedAfterHoursWh: round(s.wasted.afterHoursWh),
      afterHoursOnMinutes: round(s.afterHoursOnSeconds / 60, 1),
      wastePercent: usedWh > 0 ? round((wastedWh / usedWh) * 100, 1) : 0,
    };
  });

  const top = (field) =>
    rooms.reduce((a, b) => (b[field] > a[field] ? b : a));

  return {
    rooms,
    highestUsageRoom: top('usedWh').usedWh > 0 ? top('usedWh').room : null,
    highestWasteRoom: top('wastedWh').wastedWh > 0 ? top('wastedWh').room : null,
    longestAfterHoursRoom:
      top('afterHoursOnMinutes').afterHoursOnMinutes > 0 ? top('afterHoursOnMinutes').room : null,
    recentEvents: getRecentEvents(8),
    rag: getRagStatus(),
    timestamp: new Date().toISOString(),
  };
}

const round = (v, dp = 2) => Number(v.toFixed(dp));
