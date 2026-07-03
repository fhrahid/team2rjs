// Thin REST client — used once on first load; live updates come via the socket.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function get(path) {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export const api = {
  health: () => get('/api/health'),
  devices: () => get('/api/devices'),
  groupedDevices: () => get('/api/devices/grouped'),
  status: () => get('/api/status'),
  usage: () => get('/api/usage'),
  alerts: () => get('/api/alerts'),
  waste: () => get('/api/waste'),
  settings: () => get('/api/settings'),
  room: (roomKey) => get(`/api/rooms/${roomKey}`),
  toggleDevice: (id) => post(`/api/devices/${id}/toggle`),
  setOccupancy: (roomKey, occupied) => post(`/api/rooms/${roomKey}/occupancy`, { occupied }),
  updateSettings: (patch) => post('/api/settings', patch),
  ragQuery: (q) => get(`/api/rag/query?q=${encodeURIComponent(q)}`),
  aiStatus: () => get('/api/ai/status'),
  aiChat: (sessionId, message) => post('/api/ai/chat', { sessionId, message }),
  aiChatEnd: (sessionId) => post('/api/ai/chat/end', { sessionId }),
};
