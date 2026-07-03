// RAG store for waste events.
//
// Every "energy wasted in an empty room" episode is written as a document:
//   • into ChromaDB (vector store) when a Chroma server is reachable
//     (start one with:  pip install chromadb && chroma run --path ./chroma-data)
//   • always into a local JSON log (backend/src/data/waste-log.json) as a
//     fallback, so the demo works with zero extra infrastructure.
//
// The bot's `!ask` command and GET /api/rag/query retrieve the most relevant
// events for a question; Groq then turns them into a conversational answer.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_FILE = path.join(__dirname, '../data/waste-log.json');
const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';
const COLLECTION = 'office_waste_events';
const EMBED_DIM = 128;

let events = loadLog();
let chromaCollection = null;
let chromaStatus = 'disabled';

// ---------------------------------------------------------------------------
// Lightweight local embedding (hashed bag-of-words, L2-normalised).
// Keeps the vector pipeline dependency-free — no external embedding API needed.
// ---------------------------------------------------------------------------
function embed(text) {
  const vec = new Array(EMBED_DIM).fill(0);
  for (const word of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    let h = 0;
    for (let i = 0; i < word.length; i++) h = (h * 31 + word.charCodeAt(i)) >>> 0;
    vec[h % EMBED_DIM] += 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

/** Try to connect to ChromaDB once at startup (non-fatal if unavailable). */
export async function initRag() {
  try {
    const { ChromaClient } = await import('chromadb');
    const client = new ChromaClient({ path: CHROMA_URL });
    await client.heartbeat();
    chromaCollection = await client.getOrCreateCollection({ name: COLLECTION });
    chromaStatus = 'connected';
    console.log(`🧠 RAG: connected to ChromaDB at ${CHROMA_URL}`);
    // Backfill previously logged events so Chroma has the full history
    for (const e of events) await upsertToChroma(e).catch(() => {});
  } catch (err) {
    chromaStatus = `unavailable (${err.message?.slice(0, 60) ?? 'no chromadb'})`;
    console.log(`🧠 RAG: ChromaDB not reachable — using local JSON store (${LOG_FILE})`);
  }
}

/** Record one waste episode. Called by the simulator. */
export async function addWasteEvent(event) {
  const id = `waste-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
  const doc = { id, ...event, document: describeEvent(event) };
  events.push(doc);
  if (events.length > 500) events = events.slice(-500);
  saveLog();
  await upsertToChroma(doc).catch(() => {});
  return doc;
}

/** Retrieve the most relevant waste events for a natural-language question. */
export async function queryEvents(question, n = 5) {
  if (chromaCollection) {
    try {
      const res = await chromaCollection.query({
        queryEmbeddings: [embed(question)],
        nResults: n,
      });
      const docs = res.documents?.[0] ?? [];
      const metas = res.metadatas?.[0] ?? [];
      if (docs.length) {
        return { source: 'chromadb', results: docs.map((d, i) => ({ document: d, ...metas[i] })) };
      }
    } catch { /* fall through to local */ }
  }
  // Fallback: cosine similarity over the local log using the same embedding
  const q = embed(question);
  const scored = events
    .map((e) => ({ e, score: cosine(q, embed(e.document)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
  return { source: 'local-json', results: scored.map(({ e }) => e) };
}

export function getRecentEvents(n = 10) {
  return events.slice(-n).reverse();
}

export function getRagStatus() {
  return { backend: chromaCollection ? 'chromadb' : 'local-json', chroma: chromaStatus, eventCount: events.length };
}

// ---------------------------------------------------------------------------

function describeEvent(e) {
  return (
    `${e.room} was empty for ${e.minutes} minutes during ${e.period} ` +
    `with ${e.deviceCount} device(s) left ON, wasting ${e.wastedWh} Wh of energy. ` +
    `Episode ended by ${e.endedBy} at ${e.endedAt}.`
  );
}

async function upsertToChroma(doc) {
  if (!chromaCollection) return;
  await chromaCollection.upsert({
    ids: [doc.id],
    embeddings: [embed(doc.document)],
    documents: [doc.document],
    metadatas: [{
      room: doc.room, roomKey: doc.roomKey, period: doc.period,
      wastedWh: doc.wastedWh, minutes: doc.minutes, endedBy: doc.endedBy,
      startedAt: doc.startedAt, endedAt: doc.endedAt,
    }],
  });
}

function cosine(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // both vectors are already L2-normalised
}

function loadLog() {
  try {
    return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveLog() {
  try {
    fs.writeFileSync(LOG_FILE, JSON.stringify(events, null, 1));
  } catch (err) {
    console.warn('Could not persist waste log:', err.message);
  }
}
