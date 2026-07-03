# 🎬 Demo Video Guide — "Lights, Fans, Discord: The Boss's Big Idea"

> **For teammates.** Everything you need to understand the project, set it up, and record the
> demo video (judges prefer **max 3 minutes**). Read Part 1 to understand what we built, follow
> Part 2 to prepare, then record using the scene-by-scene script in Part 3.

---

## Part 1 — What We Built (understand this before recording)

### The problem (say this in the intro)

People leave lights and fans running when they go home, and the electricity bill keeps
climbing. The boss wants to: see every device on a **live dashboard**, check **power usage**,
and ask a **Discord bot** about it — without opening a browser.

### Our solution in one sentence

A simulated smart office where **PIR motion sensors** detect if anyone is in a room, an **AI
automatically switches off forgotten devices** (after warning everyone first), every wasted
watt is **tracked and stored in a ChromaDB RAG**, and a **web dashboard + Discord bot** read
from **one shared backend** — one source of truth.

### The office (fixed by the problem statement)

| Room | Purpose | Devices |
|---|---|---|
| Drawing Room | waiting area (sofa) | 2 fans + 3 lights |
| Work Room 1 | employees (desks) | 2 fans + 3 lights |
| Work Room 2 | employees (desks) | 2 fans + 3 lights |

Fan ON = **60 W**, Light ON = **15 W**, OFF = 0 W. Office hours: **9 AM – 5 PM**.

### How the pieces connect (memorize for the architecture part)

```
[PIR Occupancy Simulation]  ← simulated people arrive/leave; forget devices 35% of the time
          ↓ mutates
[In-Memory Device Store]    ← THE single source of truth
          ↓
[Express API + Socket.IO]   ← backend, port 5000
     ↓            ↓
[React Dashboard]  [Discord Bot]   ← both read the SAME live data
     ↓                  ↓
 boss's browser     boss's Discord (+ Groq LLM makes replies friendly)

Side pipeline: every "empty room burning power" episode → waste event → ChromaDB RAG
               → queryable from dashboard analytics + Discord `!ask`
```

### The five headline features (the video must show all of these)

1. **Live floor-plan dashboard** — top-view office layout: lights glow, fans spin, people
   appear in occupied rooms (green PIR dot), alert rooms pulse red. Updates in real time
   over Socket.IO, zero page refreshes. Devices are clickable.
2. **PIR + AI auto-off** — when a room is empty but devices are ON: an alert fires FIRST
   (dashboard + Discord), then after a **user-configurable delay** (slider on the dashboard)
   the AI switches everything off.
3. **Waste analytics** — per room: energy **used vs wasted**, split **office-hours vs
   after-hours**, plus which room lingers longest after 5 PM, highest consumer, biggest waster.
4. **ChromaDB RAG** — every waste episode is stored as a document; `!ask` retrieves relevant
   events and Groq answers in natural language, grounded in real stored data.
5. **Discord bot** — `!status`, `!room`, `!usage`, `!alerts`, `!waste`, `!ask` — all answers
   come live from the backend (nothing hardcoded), humanized by the Groq LLM, and the bot
   **proactively posts alerts** to a channel the moment they trigger.

---

## Part 2 — Setup Before Recording (15 minutes)

### 2.1 Start everything (three terminals)

```bash
# Terminal 1 — backend
cd backend
npm install
npm start          # → http://localhost:5000

# Terminal 2 — frontend
cd frontend
npm install
npm run dev        # → http://localhost:5173

# Terminal 3 — Discord bot
cd bot
npm install
npm start
```

### 2.2 Bot prerequisites (do once)

1. https://discord.com/developers/applications → our app → **Bot** →
   **Privileged Gateway Intents** → enable **Message Content Intent** → Save.
2. `bot/.env` must contain: `DISCORD_TOKEN`, `DISCORD_ALERT_CHANNEL_ID` (right-click a
   channel → Copy Channel ID, with Developer Mode on), and `GROQ_API_KEY`
   (free at https://console.groq.com) so replies are AI-humanized on camera.
3. Bot invited to the server with *Send Messages* permission.
4. Test `!help` in Discord — it should list all commands.

### 2.3 Make the demo snappy (IMPORTANT — do this right before recording)

- On the dashboard, in **AI Auto-Off Control**, set the delay to **10s** (preset button).
  Default is 60s — too slow on camera.
- Optional: in `backend/.env` set `SIM_SPEED=10` and restart the backend so background
  occupancy changes happen every ~30–60s instead of every few minutes.
- Optional (only if recording during 9–5): the `AFTER_HOURS` alert won't fire naturally.
  That's fine — the `ROOM_EMPTY` → AI auto-off flow is the star. If you want an after-hours
  waste event on screen, record after 5 PM or temporarily change your PC clock.
- Have the dashboard (browser) and Discord side by side, or use two takes and edit.
- Run the money-shot sequence (Scene 3 below) once as a rehearsal BEFORE recording, so a
  couple of waste events already exist in the Energy Analytics panel and the RAG store —
  this makes `!waste` and `!ask` look great on camera.

### 2.4 Pre-flight checklist

- [ ] Backend terminal shows `15 devices simulated` and event lines appearing
- [ ] Dashboard shows **LIVE** (green pill, top right)
- [ ] All 3 rooms visible on the floor plan, some lights glowing / fans spinning
- [ ] Bot replies to `!status` in Discord
- [ ] AI delay set to 10s, at least 1–2 waste events already in Energy Analytics
- [ ] Screen recorder ready (record at 1080p, hide personal bookmarks/notifications)

---

## Part 3 — The Script (target: 2:45 – 3:00)

> Times are cumulative targets. Narration lines are suggestions — rephrase naturally,
> don't read robotically. **Bold** = what must be visible on screen at that moment.

### Scene 1 — Hook + problem (0:00 – 0:20)

**On screen:** the dashboard, full view, things moving.

> "People at our office keep leaving lights and fans on, and the bill keeps climbing.
> So we built a complete monitoring system: a simulated smart office with PIR motion
> sensors, a real-time dashboard, an AI that switches off forgotten devices, and a
> Discord bot — all sharing one backend, one source of truth."

### Scene 2 — Dashboard tour (0:20 – 0:55)

**On screen:** slowly point (cursor) at each area while talking.

> "This is the live floor plan of our 3-room office — 15 devices total, 2 fans and
> 3 lights per room. **Lights glow when ON, fans actually spin**, and the green PIR dot
> with the little person shows which rooms are occupied right now."

- Hover/point: **summary cards** — "Total live power in watts, devices on and off,
  active alerts, and today's estimated kilowatt-hours."
- Point: **Power Consumption panel** — "Per-room breakdown, and the highest-consuming room."
- Click 1–2 devices on the map — "Devices are clickable — the whole page updates instantly
  over Socket.IO, no refresh, ever."

### Scene 3 — 💥 THE MONEY SHOT: PIR → alert → AI auto-off (0:55 – 1:40)

**On screen:** dashboard left, Discord alert channel visible right (or picture-in-picture).

Do this exact sequence:

1. In **AI Auto-Off Control**: show the slider — "The AI switches off devices in empty rooms.
   The boss controls how patient it is — from 5 seconds to 10 minutes. We set it to 10 seconds
   for this demo."
2. Click **"Someone enters"** on Work Room 2 → person appears, PIR dot goes green.
3. Click 3–4 devices ON in Work Room 2 → lights glow, fans spin.
   > "Someone walks into Work Room 2 — the PIR sensor detects them — and they switch on
   > the fans and lights."
4. Click **"Everyone leaves"** →
   > "Now they leave... and forget everything on. Watch what happens."
5. **Point at the Alerts panel** — `ROOM_EMPTY` alert appears immediately, room pulses red —
   **and at Discord** — the bot posts the warning proactively.
   > "Instantly: the dashboard flags the room, AND the bot warns everyone on Discord —
   > BEFORE anything is switched off."
6. Wait ~10s → devices switch off on screen.
   > "Ten seconds later, nobody came back — so the AI switches everything off, and the
   > wasted energy is logged."

### Scene 4 — Waste analytics + RAG (1:40 – 2:10)

**On screen:** scroll to **Energy Analytics**.

> "Every wasted watt is tracked. Per room, we split energy **used vs wasted**, during
> **office hours vs after hours** — so we know which room burns the most, which room wastes
> the most, and which room stays on longest after 5 PM. Each waste episode is stored as a
> document in a **ChromaDB vector store** — a RAG we can actually ask questions."

Point at: the badges (highest usage / most wasted / longest after-hours), one stacked bar,
and the recent-events list with the ChromaDB/local-log badge.

### Scene 5 — Discord bot (2:10 – 2:40)

**On screen:** Discord, type these live (answers arrive in ~1–2s):

1. `!status` — > "The bot pulls the same live data — same backend, same numbers as the dashboard."
2. `!usage` or `!waste` — > "Live wattage, today's kilowatt-hours, and the waste report."
3. `!ask which room wasted the most energy?` —
   > "And this is the RAG: it retrieves the stored waste events and Groq's LLM answers in
   > plain language — grounded in real data, nothing hardcoded."

### Scene 6 — Architecture + outro (2:40 – 3:00)

**On screen:** the system diagram image (from `docs/`).

> "Under the hood: a simulated PIR device layer feeds one in-memory store — the single
> source of truth. An Express backend exposes it over REST and Socket.IO, and both the
> React dashboard and the Discord bot read from it. Waste events flow into ChromaDB for
> retrieval. One backend, two interfaces, zero disagreement. Thanks for watching!"

---

## Part 4 — Judging Criteria → What the Video Must Prove

| Criterion (weight) | Covered by |
|---|---|
| Working dashboard w/ real-time data (20%) | Scenes 2–3: live updates, no refresh |
| Working Discord bot w/ real data (10%) | Scene 5: numbers match dashboard |
| Dashboard visuals & UX (10%) | Scene 2: floor plan, glow/spin animations |
| Clear system diagram (15%) | Scene 6 + diagram in repo `docs/` |
| Sensible circuit schematic (15%) | mention + image in repo `docs/` (Wokwi/Tinkercad) |
| Quality of demo & simulation (15%) | Scene 3: PIR story, alert-first, AI auto-off |
| Codebase & commits (15%) | not in video — clean repo + README + regular commits |

**Still needed from the team (not in the video):**

- [ ] System diagram → export as `docs/system-diagram.png` (**do NOT use Mermaid** — brief forbids it)
- [ ] Circuit schematic in Wokwi or Tinkercad (ESP32 reading light/fan states via relays +
      optional current sensor, one room is enough) → `docs/circuit-schematic.png`
- [ ] Public GitHub repo with meaningful commit history
- [ ] Put the final video link in `README.md`

---

## Part 5 — Troubleshooting (if something breaks on camera day)

| Symptom | Fix |
|---|---|
| Dashboard says "Cannot reach the backend" | Start backend first; check port 5000 is free |
| Bot: `DISALLOWED_INTENTS` | Enable **Message Content Intent** in the Discord developer portal, save, restart bot |
| Bot silent on commands | Bot needs *Send Messages* + *Read Message History* in that channel; commands start with `!` |
| No proactive alert in Discord | `DISCORD_ALERT_CHANNEL_ID` missing/wrong in `bot/.env`; bot terminal should say "Listening to backend alert stream" |
| Bot replies feel robotic / chatbot says "AI not configured" | Put a real `GROQ_API_KEY` in **`backend/.env`** (not just bot/.env) and restart the backend — watch its console for `🧠 Groq ... ok` |
| Analytics panel empty | Run the Scene 3 sequence once — waste events only exist after someone forgets devices ON |
| "ChromaDB not reachable" in backend logs | Fine — it falls back to the local JSON log automatically. To show ChromaDB on camera: `pip install chromadb && chroma run --path ./chroma-data`, restart backend |
| Nothing happens in the background sim | Occupancy changes are minutes-scale by design; set `SIM_SPEED=10` in `backend/.env` + restart, or drive it manually with the PIR demo buttons |

---

## Appendix — Cheat Sheets

**Discord commands:** `!status` · `!room drawing|work1|work2` · `!usage` · `!alerts` ·
`!waste` · `!report` · `!ask <question>` · `!chat` / `!endchat` (talk to Wattson) ·
`!toggle <id>` · `!on/!off <room>` · `!occupy/!vacate <room>` · `!delay <sec>` · `!ai on|off` · `!help`

**Website chatbot:** floating 💬 button bottom-right — worth 5 seconds in Scene 4: ask
"Which room is wasting the most energy?" on camera. **Requires `GROQ_API_KEY` in `backend/.env`.**

**Key API endpoints (if judges ask):** `/api/health`, `/api/devices`, `/api/devices/grouped`,
`/api/status`, `/api/usage`, `/api/alerts`, `/api/waste`, `/api/rag/query?q=...`,
`/api/settings`, `/api/rooms/:key`, POST `/api/devices/:id/toggle`,
POST `/api/rooms/:key/occupancy`

**Numbers to quote confidently:** 3 rooms · 15 devices (6 fans × 60 W, 9 lights × 15 W) ·
495 W max draw · office hours 9–5 · alert types: `ROOM_EMPTY`, `AFTER_HOURS`, `ALL_ON_2H` ·
update tick 5s · people forget devices 35% of the time in the simulation.
