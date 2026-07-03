// Discord bot for "Lights, Fans, Discord: The Boss's Big Idea".
//
// ARCHITECTURE: the bot never simulates or stores anything itself — every
// answer comes live from the shared backend API. AI (Groq) also lives in the
// BACKEND (/api/ai/*), so friendly LLM replies work with ONE key in
// backend/.env. A GROQ_API_KEY in bot/.env still works as a local fallback.
import 'dotenv/config';
import axios from 'axios';
// discord.js v13 is CommonJS (no named ESM exports) — default import works for v13 AND v14.
import discord from 'discord.js';
import { io } from 'socket.io-client';

const { Client } = discord;
const INTENTS = discord.GatewayIntentBits
  ? [discord.GatewayIntentBits.Guilds, discord.GatewayIntentBits.GuildMessages, discord.GatewayIntentBits.MessageContent]
  : [discord.Intents.FLAGS.GUILDS, discord.Intents.FLAGS.GUILD_MESSAGES, discord.Intents.FLAGS.MESSAGE_CONTENT];

const {
  DISCORD_TOKEN,
  BACKEND_API_URL = 'http://localhost:5000',
  DISCORD_ALERT_CHANNEL_ID,
  GROQ_API_KEY,
  GROQ_MODEL = 'llama-3.3-70b-versatile',
} = process.env;

if (!DISCORD_TOKEN) {
  console.error('Missing DISCORD_TOKEN in .env — copy .env.example to .env and fill it in.');
  process.exit(1);
}

const api = axios.create({ baseURL: BACKEND_API_URL, timeout: 20000 });
const ROOM_KEYS = ['drawing', 'work1', 'work2'];
const fmtWh = (wh) => (wh >= 1000 ? `${(wh / 1000).toFixed(2)} kWh` : `${wh} Wh`);

// ---------------------------------------------------------------------------
// AI helpers — backend first, local Groq as fallback
// ---------------------------------------------------------------------------
const localKeyValid = () =>
  GROQ_API_KEY && GROQ_API_KEY.length > 10 && !/your_groq/i.test(GROQ_API_KEY);

async function humanize(facts, fallback) {
  // 1) backend AI (preferred — single key in backend/.env)
  try {
    const { data } = await api.post('/api/ai/humanize', { facts, fallback });
    if (data.ai) return data.text;
  } catch (err) {
    console.warn('backend /api/ai/humanize unreachable:', err.message);
  }
  // 2) local Groq key in bot/.env (fallback)
  if (localKeyValid()) {
    try {
      const res = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: GROQ_MODEL, max_tokens: 300, temperature: 0.7,
          messages: [
            { role: 'system', content: 'You are a friendly office assistant bot on Discord reporting electricity status. Rewrite the facts as a short, warm, slightly playful message. Keep every number, room name and unit EXACTLY as given. Max 2 emojis, under 6 lines.' },
            { role: 'user', content: facts },
          ],
        },
        { headers: { Authorization: `Bearer ${GROQ_API_KEY}` }, timeout: 10000 }
      );
      const text = res.data.choices?.[0]?.message?.content?.trim();
      if (text) { console.log('🧠 local Groq humanize ok'); return text; }
    } catch (err) {
      console.warn('🧠 local Groq FAILED:', err.response?.status ?? err.message);
    }
  }
  // 3) template
  return fallback;
}

// ---------------------------------------------------------------------------
// Command handlers — all data straight from the backend
// ---------------------------------------------------------------------------
async function handleStatus() {
  const [{ data: status }, { data: usage }] = await Promise.all([api.get('/api/status'), api.get('/api/usage')]);
  const roomLines = status.rooms.map((r) => {
    const occ = r.occupied ? '🧍 occupied' : 'empty';
    if (r.devicesOn === 0) return `${r.room} (${occ}): everything is OFF. Nice and quiet.`;
    return `${r.room} (${occ}): ${r.fansOn} fan${r.fansOn === 1 ? '' : 's'} ON, ${r.lightsOn} light${r.lightsOn === 1 ? '' : 's'} ON.`;
  });
  const fallback = `⚡ Office status update:\n${roomLines.join('\n')}\nTotal live usage: ${usage.totalPowerNow}W.`;
  return humanize(
    `Office status right now:\n${roomLines.join('\n')}\nTotal live power: ${usage.totalPowerNow}W. Devices ON: ${status.totals.devicesOn}/${status.totals.devices}.`,
    fallback
  );
}

async function handleRoom(roomKey) {
  if (!ROOM_KEYS.includes(roomKey)) {
    return `I don't know that room 🤔 — try \`!room drawing\`, \`!room work1\` or \`!room work2\``;
  }
  const { data: room } = await api.get(`/api/rooms/${roomKey}`);
  const deviceLines = room.devices
    .map((d) => `• ${d.name} (${d.type}): ${d.status.toUpperCase()}${d.status === 'on' ? ` — ${d.currentPower}W` : ''}`)
    .join('\n');
  const fallback =
    `🏠 **${room.room}** — ${room.occupied ? '🧍 occupied' : 'empty'}\n` +
    `Fans ON: ${room.fansOn}/${room.fansTotal} · Lights ON: ${room.lightsOn}/${room.lightsTotal}\n` +
    `Current power: ${room.powerNow}W\n${deviceLines}`;
  return humanize(
    `Status of ${room.room} (${room.occupied ? 'occupied' : 'empty'}): ${room.fansOn}/${room.fansTotal} fans ON, ${room.lightsOn}/${room.lightsTotal} lights ON, drawing ${room.powerNow}W.\nDevices:\n${deviceLines}`,
    fallback
  );
}

async function handleUsage() {
  const { data: usage } = await api.get('/api/usage');
  const perRoom = usage.perRoomUsage.map((r) => `${r.room}: ${r.powerNow}W`).join(' · ');
  const fallback =
    `🔌 Total power right now: **${usage.totalPowerNow}W**\n` +
    `Today's estimated usage: **${usage.estimatedTodayKwh} kWh**\n${perRoom}\n` +
    (usage.highestConsumingRoom ? `Highest consuming room: **${usage.highestConsumingRoom}**` : 'Nothing is drawing power right now.');
  return humanize(
    `Total power right now: ${usage.totalPowerNow}W. Estimated usage today: ${usage.estimatedTodayKwh} kWh. Per room: ${perRoom}. Highest consuming room: ${usage.highestConsumingRoom ?? 'none (all off)'}.`,
    fallback
  );
}

async function handleAlerts() {
  const { data: alerts } = await api.get('/api/alerts');
  if (alerts.length === 0) {
    return humanize('There are zero active alerts. Everything in the office is fine.', '✅ No active alerts right now. The office is behaving nicely.');
  }
  const lines = alerts
    .map((a) => `⚠️ [${a.severity.toUpperCase()}] ${a.message} (${new Date(a.timestamp).toLocaleTimeString()})`)
    .join('\n');
  return humanize(`Active office alerts:\n${lines}`, `🚨 **Active alerts (${alerts.length}):**\n${lines}`);
}

async function handleWaste() {
  const { data: w } = await api.get('/api/waste');
  const lines = w.rooms.map(
    (r) => `${r.room}: used ${fmtWh(r.usedWh)}, wasted ${fmtWh(r.wastedWh)} (${r.wastePercent}%) · after-hours ON ${r.afterHoursOnMinutes} min`
  );
  const fallback =
    `♻️ **Energy waste today**\n${lines.join('\n')}\n` +
    `🏆 Highest usage: ${w.highestUsageRoom ?? '—'} · 🗑️ Most wasted: ${w.highestWasteRoom ?? '—'} · 🌙 Longest after-hours: ${w.longestAfterHoursRoom ?? '—'}`;
  return humanize(
    `Today's energy report per room:\n${lines.join('\n')}\nHighest usage: ${w.highestUsageRoom ?? 'none'}. Most wasteful: ${w.highestWasteRoom ?? 'none'}. Longest after office hours: ${w.longestAfterHoursRoom ?? 'none'}.`,
    fallback
  );
}

async function handleReport() {
  const [status, usage, waste] = (await Promise.all([api.get('/api/status'), api.get('/api/usage'), api.get('/api/waste')])).map((r) => r.data);
  const facts =
    `Full office report.\nRooms: ` +
    status.rooms.map((r) => `${r.room} ${r.occupied ? 'occupied' : 'empty'}, ${r.devicesOn}/5 ON, ${r.powerNow}W`).join('; ') +
    `.\nTotal power ${usage.totalPowerNow}W, today ${usage.estimatedTodayKwh} kWh.\n` +
    `Waste: ` + waste.rooms.map((r) => `${r.room} wasted ${r.wastedWh}Wh of ${r.usedWh}Wh`).join('; ') +
    `.\nMost wasteful: ${waste.highestWasteRoom ?? 'none'}. Longest after-hours: ${waste.longestAfterHoursRoom ?? 'none'}.`;
  return humanize(facts, `📋 **Office report**\n${facts}`);
}

// !ask — RAG over stored waste events
async function handleAsk(question) {
  if (!question) return 'Ask me something, e.g. `!ask which room wasted the most energy after hours?`';
  const { data } = await api.get('/api/rag/query', { params: { q: question, n: 5 } });
  const docs = (data.results ?? []).map((r) => `- ${r.document ?? ''}`).join('\n');
  if (!docs.trim()) return "🤷 No recorded waste events yet — nobody has forgotten anything ON.";
  return humanize(
    `Question from the boss: "${question}"\nAnswer using ONLY these retrieved waste-history records (source: ${data.source}):\n${docs}`,
    `📚 Closest matches (${data.source}):\n${docs.slice(0, 1500)}`
  );
}

// ---- control commands (demo power!) ----
async function handleToggle(id) {
  if (!id) return 'Usage: `!toggle <deviceId>` e.g. `!toggle work2-fan-1`';
  try {
    const { data: d } = await api.post(`/api/devices/${id}/toggle`);
    return `🔀 ${d.room} · ${d.name} is now **${d.status.toUpperCase()}**${d.status === 'on' ? ` (${d.currentPower}W)` : ''}.`;
  } catch (err) {
    return `❌ ${err.response?.data?.error ?? 'Unknown device id.'}`;
  }
}

async function handleRoomPower(roomKey, status) {
  if (!ROOM_KEYS.includes(roomKey)) return `Usage: \`!${status} drawing|work1|work2\``;
  const { data } = await api.post(`/api/rooms/${roomKey}/devices`, { status });
  return status === 'on'
    ? `💡 All devices in **${data.room}** switched ON (${data.changedCount} changed).`
    : `🌑 All devices in **${data.room}** switched OFF (${data.changedCount} changed).`;
}

async function handleOccupancy(roomKey, occupied) {
  if (!ROOM_KEYS.includes(roomKey)) return `Usage: \`!${occupied ? 'occupy' : 'vacate'} drawing|work1|work2\``;
  const { data } = await api.post(`/api/rooms/${roomKey}/occupancy`, { occupied });
  return occupied
    ? `🧍 PIR: someone just entered **${data.room}**.`
    : `🚪 PIR: **${data.room}** is now empty — if devices are ON, an alert fires and the AI countdown starts.`;
}

async function handleDelay(secondsArg) {
  const s = Number(secondsArg);
  if (!Number.isFinite(s)) return 'Usage: `!delay <seconds>` (5–3600), e.g. `!delay 30`';
  try {
    const { data } = await api.post('/api/settings', { autoOffDelaySeconds: s });
    return `⏱️ AI auto-off delay set to **${data.autoOffDelaySeconds}s**.`;
  } catch (err) {
    return `❌ ${err.response?.data?.error ?? 'Invalid value.'}`;
  }
}

async function handleAiSwitch(arg) {
  if (arg !== 'on' && arg !== 'off') return 'Usage: `!ai on` or `!ai off`';
  const { data } = await api.post('/api/settings', { aiEnabled: arg === 'on' });
  return data.aiEnabled ? '🤖 AI auto-off **ENABLED**.' : '🤖 AI auto-off **DISABLED** — forgotten devices will stay on!';
}

const HELP =
  '🤖 **Office Monitor commands**\n' +
  '__Monitoring__\n' +
  '`!status` — all rooms at a glance · `!room <drawing|work1|work2>` — one room in detail\n' +
  '`!usage` — live power + kWh today · `!waste` — used vs wasted per room\n' +
  '`!alerts` — active alerts · `!report` — full combined report\n' +
  '__AI chat__\n' +
  '`!chat` — start a conversation with Wattson (then just type normally)\n' +
  '`!endchat` — end your chat session\n' +
  '`!ask <question>` — one-shot question over the waste history (RAG)\n' +
  '__Control (demo)__\n' +
  '`!toggle <deviceId>` — flip one device (e.g. `!toggle work2-fan-1`)\n' +
  '`!on <room>` / `!off <room>` — all devices in a room\n' +
  '`!occupy <room>` / `!vacate <room>` — simulate the PIR sensor\n' +
  '`!delay <seconds>` — AI auto-off delay · `!ai on|off` — toggle the auto-off AI';

// ---------------------------------------------------------------------------
// Chat sessions (Discord ↔ backend Wattson AI)
// ---------------------------------------------------------------------------
const chatSessions = new Map(); // `${channelId}:${userId}` -> sessionId | null

async function chatTurn(key, message) {
  const sessionId = chatSessions.get(key) ?? null;
  const { data } = await api.post('/api/ai/chat', { sessionId, message });
  chatSessions.set(key, data.sessionId);
  return data.reply;
}

async function endChat(key) {
  const sessionId = chatSessions.get(key);
  chatSessions.delete(key);
  if (sessionId) await api.post('/api/ai/chat/end', { sessionId }).catch(() => {});
  return sessionId
    ? '👋 Chat session ended. Type `!chat` any time to talk again.'
    : "You weren't in a chat session. Type `!chat` to start one.";
}

// ---------------------------------------------------------------------------
// Discord wiring
// ---------------------------------------------------------------------------
const client = new Client({ intents: INTENTS });

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.trim();
  const sessionKey = `${message.channel.id}:${message.author.id}`;

  // Active chat session: plain messages go to Wattson
  if (!content.startsWith('!')) {
    if (chatSessions.has(sessionKey)) {
      try {
        await message.channel.sendTyping?.();
        await message.reply(await chatTurn(sessionKey, content));
      } catch (err) {
        console.error('chat failed:', err.message);
        await message.reply("😵 Couldn't reach the office backend.");
      }
    }
    return;
  }

  const [command, arg] = content.toLowerCase().split(/\s+/);
  const rest = content.split(/\s+/).slice(1).join(' ');

  try {
    let reply;
    if (command === '!status') reply = await handleStatus();
    else if (command === '!room') reply = arg ? await handleRoom(arg) : 'Which room? e.g. `!room work1`';
    else if (command === '!usage') reply = await handleUsage();
    else if (command === '!alerts') reply = await handleAlerts();
    else if (command === '!waste') reply = await handleWaste();
    else if (command === '!report') reply = await handleReport();
    else if (command === '!ask') reply = await handleAsk(rest);
    else if (command === '!toggle') reply = await handleToggle(arg);
    else if (command === '!on') reply = await handleRoomPower(arg, 'on');
    else if (command === '!off') reply = await handleRoomPower(arg, 'off');
    else if (command === '!occupy') reply = await handleOccupancy(arg, true);
    else if (command === '!vacate') reply = await handleOccupancy(arg, false);
    else if (command === '!delay') reply = await handleDelay(arg);
    else if (command === '!ai') reply = await handleAiSwitch(arg);
    else if (command === '!chat') {
      chatSessions.set(sessionKey, chatSessions.get(sessionKey) ?? null);
      reply = "💬 You're now chatting with **Wattson**, the office energy AI. Just type normally — ask about usage, waste, rooms, alerts. Type `!endchat` when you're done.";
    } else if (command === '!endchat' || command === '!bye') reply = await endChat(sessionKey);
    else if (command === '!help') reply = HELP;
    else return;

    await message.reply(reply);
  } catch (err) {
    console.error('Command failed:', err.message);
    await message.reply('😵 I couldn\'t reach the office backend. Is it running on port 5000?');
  }
});

// ---------------------------------------------------------------------------
// BONUS: proactive alert posting — new alerts stream in via Socket.IO and are
// posted to the configured channel the moment they trigger.
// ---------------------------------------------------------------------------
const postedAlertIds = new Set();

function watchAlerts() {
  if (!DISCORD_ALERT_CHANNEL_ID || /your_channel/i.test(DISCORD_ALERT_CHANNEL_ID)) {
    console.log('⚠️ DISCORD_ALERT_CHANNEL_ID not set — proactive alert posting disabled.');
    return;
  }
  const socket = io(BACKEND_API_URL, { transports: ['websocket', 'polling'] });
  socket.on('connect', () => console.log('📡 Listening to backend alert stream via Socket.IO'));
  socket.on('connect_error', (e) => console.warn('socket connect_error:', e.message));

  socket.on('alerts:update', async (alerts) => {
    const fresh = alerts.filter((a) => !postedAlertIds.has(a.id));
    if (fresh.length === 0) return;
    try {
      const channel = await client.channels.fetch(DISCORD_ALERT_CHANNEL_ID);
      for (const alert of fresh) {
        postedAlertIds.add(alert.id);
        const time = new Date(alert.timestamp).toLocaleTimeString();
        const fallback = `⚠️ **Heads up!** ${alert.message} (${alert.severity}, ${time})`;
        const text = await humanize(
          `New office alert just triggered: ${alert.message} Severity: ${alert.severity}. Time: ${time}. Write ONE short playful heads-up for the office channel.`,
          fallback
        );
        await channel.send(text);
        console.log(`🚨 posted alert ${alert.id} to Discord`);
      }
    } catch (err) {
      console.error('Failed to post proactive alert:', err.message);
    }
  });
}

let booted = false;
async function onReady() {
  if (booted) return;
  booted = true;
  console.log(`🤖 Logged in as ${client.user.tag} — backend: ${BACKEND_API_URL}`);
  try {
    const { data } = await api.get('/api/ai/status');
    console.log(data.enabled ? `🧠 Backend AI enabled (${data.model})` : `🧠 Backend AI NOT configured — ${data.hint}`);
  } catch {
    console.warn('⚠️ Backend unreachable — start it with: cd backend && npm start');
  }
  if (localKeyValid()) console.log('🧠 Local Groq key present (used as fallback)');
  watchAlerts();
}
// 'ready' (v13/v14) vs 'clientReady' (v14.16+/v15) — handle both.
client.once('ready', onReady);
client.once('clientReady', onReady);

client.login(DISCORD_TOKEN);
