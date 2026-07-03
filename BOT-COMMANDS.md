# 🤖 Discord Bot — Command Guide

Complete reference for the office monitor bot. Every answer comes **live from the backend**
(same data as the dashboard) — nothing is hardcoded. With a Groq key configured in
`backend/.env`, replies are rewritten by the LLM into friendly conversational messages
(numbers always kept exact).

---

## Setup (once)

1. **Backend running** — `cd backend && npm start` (the bot is useless without it).
2. **Bot token** — `bot/.env` → `DISCORD_TOKEN=...`
   (Discord Developer Portal → your app → Bot → Reset Token).
3. **Message Content Intent** — Developer Portal → Bot → *Privileged Gateway Intents* →
   enable **Message Content Intent** → Save. (Without this you get `DISALLOWED_INTENTS`.)
4. **Proactive alerts** — `bot/.env` → `DISCORD_ALERT_CHANNEL_ID=...`
   (enable Developer Mode in Discord → right-click a channel → *Copy Channel ID*).
5. **AI replies** — put `GROQ_API_KEY` in **`backend/.env`** (NOT bot/.env — the backend
   makes the LLM calls). Free key at https://console.groq.com. Restart the backend and check
   its console says `🧠 Groq LLM enabled`.
6. Start the bot — `cd bot && npm start`. Console should show
   `Logged in as ...`, `Backend AI enabled (...)` and `Listening to backend alert stream`.

---

## 📊 Monitoring Commands

### `!status`
Summary of all rooms + total live power.
> ⚡ Office status update:
> Drawing Room (🧍 occupied): 1 fan ON, 2 lights ON.
> Work Room 1 (empty): everything is OFF. Nice and quiet.
> Work Room 2 (🧍 occupied): 2 fans ON, 3 lights ON.
> Total live usage: 300W.

### `!room <drawing | work1 | work2>`
One room in detail: occupancy, fans/lights ON, power, full device list.
```
!room work1
```
> 🏠 **Work Room 1** — 🧍 occupied
> Fans ON: 2/2 · Lights ON: 1/3 · Current power: 135W
> • Fan 1 (fan): ON — 60W
> • Fan 2 (fan): ON — 60W
> • Light 1 (light): ON — 15W
> • Light 2 (light): OFF
> • Light 3 (light): OFF

### `!usage`
Total power now, estimated kWh today, per-room wattage, highest consuming room.

### `!alerts`
All active alerts with severity + timestamp, or a friendly all-clear:
> ✅ No active alerts right now. The office is behaving nicely.

### `!waste`
Today's waste report: per room used vs wasted Wh, waste %, after-hours ON minutes,
plus 🏆 highest usage / 🗑️ most wasted / 🌙 longest after-hours room.

### `!report`
Everything at once — status + usage + waste in a single formatted report.

---

## 💬 AI Chat Commands (Wattson)

### `!chat`
Starts a **conversation session** with Wattson, the office energy AI. After this, just type
normal messages (no `!`) in the same channel — the bot answers with full context: live device
states, usage, waste analytics, alerts, and the RAG waste history.
```
!chat
you:  which room should I be worried about?
bot:  Work Room 2 — it wasted 42.5 Wh today, 80% of everything it used...
you:  and after office hours?
bot:  ...
```
Sessions are per-user, per-channel, remember the conversation, and expire after 30 min idle.

### `!endchat` (or `!bye`)
Ends your chat session and clears its memory on the backend.

### `!ask <question>`
**One-shot RAG question** (no session needed). The backend retrieves the most relevant stored
waste events (ChromaDB or local log) and the LLM answers strictly from them.
```
!ask which room wasted the most energy after hours?
!ask how many times were devices forgotten in the drawing room?
```

---

## 🎛 Control Commands (great for demos)

| Command | Effect |
|---|---|
| `!toggle <deviceId>` | Flip one device. IDs: `drawing-fan-1..2`, `drawing-light-1..3`, `work1-...`, `work2-...` |
| `!on <room>` | Switch ALL devices in a room ON (e.g. `!on work2`) |
| `!off <room>` | Switch ALL devices in a room OFF |
| `!occupy <room>` | Simulate PIR: someone enters the room |
| `!vacate <room>` | Simulate PIR: room becomes empty — starts the alert → AI auto-off flow |
| `!delay <seconds>` | Set the AI auto-off delay (5–3600), e.g. `!delay 15` |
| `!ai on` / `!ai off` | Enable/disable the auto-off AI |
| `!help` | Show the command list |

### 🎬 30-second demo entirely from Discord

```
!delay 15          → AI will act 15s after a room empties
!occupy work2      → PIR: someone enters
!on work2          → they switch everything on (495W? check !usage)
!vacate work2      → they leave, forgetting everything
                   → bot posts the ROOM_EMPTY alert to the alert channel ⚠️
(wait 15 seconds)  → AI switches the room off, waste event logged
!waste             → Work Room 2 now shows wasted energy
!ask what just happened in work room 2?
```

---

## 🚨 Proactive Alerts (no command needed)

With `DISCORD_ALERT_CHANNEL_ID` set, the bot listens to the backend's live Socket.IO alert
stream and posts each NEW alert to that channel the moment it triggers:

- `ROOM_EMPTY` — PIR says nobody's there but devices are ON (AI countdown running)
- `AFTER_HOURS` — devices still ON outside 9 AM–5 PM
- `ALL_ON_2H` — a room fully ON for 2+ hours continuously

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `DISALLOWED_INTENTS` on startup | Enable **Message Content Intent** in the developer portal, save, restart |
| Bot online but ignores commands | Needs *Send Messages* + *Read Message History* in that channel; commands are lowercase and start with `!` |
| Replies are template-ish, not conversational | `GROQ_API_KEY` missing in **backend/.env** — backend console must say `🧠 Groq LLM enabled` |
| "Couldn't reach the office backend" | Start the backend first (`cd backend && npm start`, port 5000) |
| No proactive alert posts | Check `DISCORD_ALERT_CHANNEL_ID`; bot console must show "Listening to backend alert stream" |
| `!ask` says no events | Waste events only exist after someone leaves devices ON in an empty room — run the 30-second demo above first |
