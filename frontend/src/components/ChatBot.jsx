// "Wattson" — floating AI chatbot where the boss can discuss usage, wastage
// and room stats. Powered by the backend's Groq LLM, grounded in live office
// data + the ChromaDB RAG waste history. Sessions can be ended explicitly.
import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

const SUGGESTIONS = [
  'Which room is wasting the most energy?',
  "What's the office status right now?",
  'Who stays on after office hours?',
  'How much power are we using today?',
];

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiInfo, setAiInfo] = useState(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    api.aiStatus().then(setAiInfo).catch(() => {});
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy, open]);

  const send = async (text) => {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: message }]);
    setBusy(true);
    try {
      const res = await api.aiChat(sessionId, message);
      setSessionId(res.sessionId);
      setMessages((m) => [...m, { role: 'bot', text: res.reply, ai: res.ai }]);
    } catch {
      setMessages((m) => [...m, { role: 'bot', text: '😵 Could not reach the backend.', ai: false }]);
    }
    setBusy(false);
  };

  const endChat = async () => {
    if (sessionId) await api.aiChatEnd(sessionId).catch(() => {});
    setSessionId(null);
    setMessages([]);
  };

  return (
    <>
      <button className="chat-fab" onClick={() => setOpen((o) => !o)} title="Chat with Wattson">
        {open ? '✕' : '💬'}
      </button>

      {open && (
        <div className="chat-panel">
          <div className="chat-head">
            <div>
              <strong>⚡ Wattson</strong>
              <div className="chat-sub">
                {aiInfo?.enabled ? `office energy AI · ${aiInfo.model}` : 'AI not configured — raw data mode'}
              </div>
            </div>
            <div className="chat-head-actions">
              {messages.length > 0 && (
                <button className="chat-end" onClick={endChat} title="End this chat session">
                  end chat
                </button>
              )}
              <button className="chat-min" onClick={() => setOpen(false)}>—</button>
            </div>
          </div>

          <div className="chat-body" ref={bodyRef}>
            {messages.length === 0 && (
              <div className="chat-welcome">
                <p>Hi boss! 👋 Ask me about power usage, energy waste, room stats or alerts.</p>
                <div className="chat-suggestions">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                {m.text}
                {m.role === 'bot' && m.ai === false && <span className="chat-noai"> (no AI)</span>}
              </div>
            ))}
            {busy && <div className="chat-msg bot typing">Wattson is thinking…</div>}
          </div>

          <form
            className="chat-input-row"
            onSubmit={(e) => { e.preventDefault(); send(); }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about usage, waste, rooms…"
              disabled={busy}
            />
            <button type="submit" disabled={busy || !input.trim()}>➤</button>
          </form>
        </div>
      )}
    </>
  );
}
