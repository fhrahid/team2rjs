// Occupancy-driven simulator (PIR model).
//
// Devices no longer flip randomly every tick. Instead:
//   • Each room has simulated PEOPLE (a PIR sensor senses presence).
//   • When someone arrives, they gradually switch on the devices they need.
//   • When everyone leaves, they usually switch things off — but sometimes
//     forget (that's the waste we track and alert on).
//   • The AI auto-off: once PIR reports a room empty with devices ON, an alert
//     is raised FIRST (dashboard + Discord), then after the configured delay
//     (dashboard slider) the AI switches everything off and logs a waste event.
//
// Timescales are minutes, not seconds — the office no longer strobes.
import { store, ROOMS } from '../data/devices.js';
import { isOfficeHours, recalcAlerts } from './alertService.js';
import { settings } from './settings.js';
import { addWasteEvent } from './ragService.js';

const TICK_SECONDS = 5;

// Average durations (minutes) driving occupancy changes. Tune for demos with
// SIM_SPEED (e.g. SIM_SPEED=10 makes everything happen 10x faster).
const SPEED = Math.max(0.1, Number(process.env.SIM_SPEED ?? 1));
const AVG = {
  office: { emptyMin: 6, occupiedMin: 25 }, // 9–5: people come and go often
  after: { emptyMin: 150, occupiedMin: 35 }, // evenings: the occasional late worker
};

// Chance that departing people FORGET to switch devices off
const FORGET_PROBABILITY = 0.35;
// How many devices people want ON while in the room
const COMFORT = { office: 5, after: 3 };

/** Probability of an event happening this tick given an average duration. */
const pPerTick = (minutes) => Math.min(0.9, (TICK_SECONDS * SPEED) / (minutes * 60));

/** Seed a realistic starting state so the first dashboard load isn't empty. */
export function seedInitialState() {
  const office = isOfficeHours();
  for (const room of ROOMS) {
    const occupied = Math.random() < (office ? 0.75 : 0.15);
    store.setOccupancy(room.key, occupied);
    if (occupied) {
      const want = office ? COMFORT.office : COMFORT.after;
      const devices = store.getByRoomKey(room.key);
      shuffle(devices).slice(0, want).forEach((d) => store.setStatus(d.id, 'on'));
    }
  }
}

/** Start the simulation loop. onTick is called with { alerts, events }. */
export function startSimulator(onTick) {
  const tick = async () => {
    const office = isOfficeHours();
    const rates = office ? AVG.office : AVG.after;
    const events = [];

    for (const room of ROOMS) {
      const state = store.rooms[room.key];
      const devices = store.getByRoomKey(room.key);
      const onDevices = () => devices.filter((d) => d.status === 'on');

      if (!state.occupied) {
        // --- Empty room ---
        // Someone may arrive (PIR trips)
        if (Math.random() < pPerTick(rates.emptyMin)) {
          personArrives(room, state, office, events);
          continue;
        }
        // AI auto-off: alert already raised by alertService; act after the delay
        if (settings.aiEnabled && onDevices().length > 0 && state.emptySince) {
          const emptyForMs = Date.now() - new Date(state.emptySince).getTime();
          if (emptyForMs >= settings.autoOffDelaySeconds * 1000) {
            await aiSwitchOff(room, state, office, events);
          }
        }
      } else {
        // --- Occupied room ---
        // People gradually switch on what they need
        const want = office ? COMFORT.office : COMFORT.after;
        if (onDevices().length < want && Math.random() < 0.25) {
          const candidates = devices.filter((d) => d.status === 'off');
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          if (pick) {
            store.toggle(pick.id);
            events.push(`${room.name}: occupant turned ${pick.name} ON`);
          }
        }
        // Everyone may leave
        if (Math.random() < pPerTick(rates.occupiedMin)) {
          personLeaves(room, state, events);
        }
      }
    }

    // Integrate energy (used / wasted / after-hours) and refresh alerts
    store.integrateEnergy(TICK_SECONDS, office);
    const alerts = recalcAlerts();
    onTick({ alerts, events });
  };

  recalcAlerts(); // evaluate the seeded state immediately
  return setInterval(tick, TICK_SECONDS * 1000);
}

// ---------------------------------------------------------------------------

function personArrives(room, state, office, events) {
  store.setOccupancy(room.key, true);
  // Occupant returned: any running waste episode ends here (they're using it now)
  const session = store.closeWasteSession(room.key);
  if (session && session.wh > 0.01) {
    addWasteEvent(buildWasteEvent(room, session, office, 'occupant returned'));
  }
  events.push(`${room.name}: PIR detected someone entering`);
}

function personLeaves(room, state, events) {
  store.setOccupancy(room.key, false);
  const on = store.getByRoomKey(room.key).filter((d) => d.status === 'on');
  if (on.length === 0) {
    events.push(`${room.name}: everyone left (nothing was ON)`);
    return;
  }
  if (Math.random() > FORGET_PROBABILITY) {
    on.forEach((d) => store.setStatus(d.id, 'off'));
    events.push(`${room.name}: everyone left and switched everything OFF`);
  } else {
    // Forgetful exit: leave some (or all) devices running -> waste + alert
    const leftOn = Math.max(1, Math.floor(Math.random() * (on.length + 1)));
    shuffle(on).slice(leftOn).forEach((d) => store.setStatus(d.id, 'off'));
    events.push(`${room.name}: everyone left but FORGOT ${leftOn} device(s) ON`);
  }
}

async function aiSwitchOff(room, state, office, events) {
  const on = store.getByRoomKey(room.key).filter((d) => d.status === 'on');
  on.forEach((d) => store.setStatus(d.id, 'off'));
  const session = store.closeWasteSession(room.key);
  if (session) {
    await addWasteEvent(buildWasteEvent(room, session, office, 'AI auto-off'));
  }
  events.push(`${room.name}: AI switched OFF ${on.length} device(s) (room empty ${settings.autoOffDelaySeconds}s+)`);
}

function buildWasteEvent(room, session, office, endedBy) {
  const startedAt = new Date(session.startedAt);
  const minutes = Math.max(0.1, (Date.now() - startedAt.getTime()) / 60000);
  return {
    room: room.name,
    roomKey: room.key,
    startedAt: session.startedAt,
    endedAt: new Date().toISOString(),
    minutes: Number(minutes.toFixed(1)),
    wastedWh: Number(session.wh.toFixed(2)),
    deviceCount: session.deviceCount,
    period: office ? 'office-hours' : 'after-hours',
    endedBy,
  };
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}
