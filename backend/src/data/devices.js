// Single source of truth: in-memory store for devices, room occupancy (PIR),
// and energy statistics (used vs wasted, office-hours vs after-hours).
//
// The office (fixed by the problem statement): 3 rooms, each with 2 fans + 3
// lights. 2 fans + 3 lights = 5 devices/room -> 15 devices total.

export const POWER_RATINGS = { fan: 60, light: 15 };

export const ROOMS = [
  { key: 'drawing', name: 'Drawing Room' },
  { key: 'work1', name: 'Work Room 1' },
  { key: 'work2', name: 'Work Room 2' },
];

export const roomNameFromKey = (key) =>
  ROOMS.find((r) => r.key === key)?.name ?? null;

/** Create the initial fleet of devices with predictable ids. */
export function createDevices() {
  const devices = [];
  for (const room of ROOMS) {
    for (let i = 1; i <= 2; i++) devices.push(makeDevice(room, 'fan', i));
    for (let i = 1; i <= 3; i++) devices.push(makeDevice(room, 'light', i));
  }
  return devices;
}

function makeDevice(room, type, index) {
  return {
    id: `${room.key}-${type}-${index}`,
    name: `${type === 'fan' ? 'Fan' : 'Light'} ${index}`,
    type,
    room: room.name,
    roomKey: room.key,
    status: 'off',
    powerRating: POWER_RATINGS[type],
    currentPower: 0,
    lastChanged: new Date().toISOString(),
  };
}

const freshEnergy = () => ({ officeWh: 0, afterHoursWh: 0 });

/** Per-room live state: PIR occupancy + energy statistics for today. */
function freshRoomState() {
  return {
    occupied: false,          // PIR: is someone in the room right now?
    occupiedSince: null,
    emptySince: new Date().toISOString(),
    used: freshEnergy(),      // all energy consumed by this room today (Wh)
    wasted: freshEnergy(),    // energy consumed while the room was EMPTY (Wh)
    afterHoursOnSeconds: 0,   // how long devices stayed ON after office hours today
    wasteSession: null,       // { startedAt, wh, deviceCount } while empty-with-devices-on
  };
}

// ---- The store ----

class DeviceStore {
  constructor() {
    this.devices = createDevices();
    this.rooms = Object.fromEntries(ROOMS.map((r) => [r.key, freshRoomState()]));
    // Tracks when every device in a room became simultaneously ON (2h alert rule)
    this.roomAllOnSince = {};
    this.energyWhToday = 0; // whole-office accumulated Wh today
    this.energyDay = new Date().getDate();
  }

  getAll() {
    return this.devices;
  }

  getById(id) {
    return this.devices.find((d) => d.id === id) ?? null;
  }

  getByRoomKey(roomKey) {
    return this.devices.filter((d) => d.roomKey === roomKey);
  }

  getGrouped() {
    const grouped = {};
    for (const room of ROOMS) grouped[room.name] = this.getByRoomKey(room.key);
    return grouped;
  }

  roomPowerNow(roomKey) {
    return this.getByRoomKey(roomKey).reduce((s, d) => s + d.currentPower, 0);
  }

  totalPowerNow() {
    return this.devices.reduce((sum, d) => sum + d.currentPower, 0);
  }

  /** Flip a device and keep derived fields consistent. Returns the device. */
  toggle(id, at = new Date()) {
    const device = this.getById(id);
    if (!device) return null;
    device.status = device.status === 'on' ? 'off' : 'on';
    device.currentPower = device.status === 'on' ? device.powerRating : 0;
    device.lastChanged = at.toISOString();
    this.#trackAllOn(device.roomKey, at);
    return device;
  }

  /** Force a device to a given state. */
  setStatus(id, status, at = new Date()) {
    const device = this.getById(id);
    if (!device || device.status === status) return device;
    return this.toggle(id, at);
  }

  /** PIR sensor update: someone entered / everyone left a room. */
  setOccupancy(roomKey, occupied, at = new Date()) {
    const room = this.rooms[roomKey];
    if (!room || room.occupied === occupied) return room;
    room.occupied = occupied;
    if (occupied) {
      room.occupiedSince = at.toISOString();
      room.emptySince = null;
    } else {
      room.emptySince = at.toISOString();
      room.occupiedSince = null;
    }
    return room;
  }

  /**
   * Called every simulation tick: integrate power draw into today's totals —
   * whole office, per-room used, per-room wasted (empty room with devices ON),
   * and per-room after-hours ON time.
   */
  integrateEnergy(seconds, isOfficeHours) {
    const today = new Date().getDate();
    if (today !== this.energyDay) {
      // New day: reset all daily counters
      this.energyDay = today;
      this.energyWhToday = 0;
      for (const key of Object.keys(this.rooms)) {
        const { occupied, occupiedSince, emptySince } = this.rooms[key];
        this.rooms[key] = { ...freshRoomState(), occupied, occupiedSince, emptySince };
      }
    }

    this.energyWhToday += (this.totalPowerNow() * seconds) / 3600;
    const bucket = isOfficeHours ? 'officeWh' : 'afterHoursWh';

    for (const roomKey of Object.keys(this.rooms)) {
      const state = this.rooms[roomKey];
      const power = this.roomPowerNow(roomKey);
      if (power <= 0) continue;

      const wh = (power * seconds) / 3600;
      state.used[bucket] += wh;
      if (!isOfficeHours) state.afterHoursOnSeconds += seconds;

      if (!state.occupied) {
        state.wasted[bucket] += wh;
        // Track this continuous "empty but burning power" episode
        if (!state.wasteSession) {
          state.wasteSession = {
            startedAt: state.emptySince ?? new Date().toISOString(),
            wh: 0,
            deviceCount: this.getByRoomKey(roomKey).filter((d) => d.status === 'on').length,
          };
        }
        state.wasteSession.wh += wh;
      }
    }
  }

  /** End a room's waste episode (occupant returned or AI switched off). */
  closeWasteSession(roomKey) {
    const state = this.rooms[roomKey];
    const session = state?.wasteSession;
    if (state) state.wasteSession = null;
    return session;
  }

  #trackAllOn(roomKey, at) {
    const roomDevices = this.getByRoomKey(roomKey);
    const allOn = roomDevices.every((d) => d.status === 'on');
    if (allOn && !this.roomAllOnSince[roomKey]) {
      this.roomAllOnSince[roomKey] = at.toISOString();
    } else if (!allOn) {
      delete this.roomAllOnSince[roomKey];
    }
  }
}

export const store = new DeviceStore();
