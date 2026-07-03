// Energy analytics: used vs wasted per room, office-hours vs after-hours split,
// after-hours lingering, and the recent waste events from the RAG store.
const fmtWh = (wh) => (wh >= 1000 ? `${(wh / 1000).toFixed(2)} kWh` : `${wh.toFixed(1)} Wh`);

export default function EnergyAnalytics({ waste }) {
  if (!waste) return null;
  const { rooms, highestUsageRoom, highestWasteRoom, longestAfterHoursRoom, recentEvents, rag } = waste;
  const maxUsed = Math.max(1, ...rooms.map((r) => r.usedWh));

  return (
    <section className="panel analytics-panel">
      <h2>📈 Energy Analytics (today)</h2>

      <div className="analytics-badges">
        <Badge icon="🏆" label="Highest usage" value={highestUsageRoom} />
        <Badge icon="🗑️" label="Most wasted" value={highestWasteRoom} />
        <Badge icon="🌙" label="Longest after-hours" value={longestAfterHoursRoom} />
      </div>

      <div className="analytics-rooms">
        {rooms.map((r) => (
          <div key={r.roomKey} className="analytics-room">
            <div className="analytics-room-head">
              <strong>{r.room}</strong>
              <span className="analytics-nums">
                used {fmtWh(r.usedWh)} · <em className="wasted">wasted {fmtWh(r.wastedWh)} ({r.wastePercent}%)</em>
              </span>
            </div>
            <div className="stacked-bar">
              <div className="bar-used" style={{ width: `${((r.usedWh - r.wastedWh) / maxUsed) * 100}%` }} />
              <div className="bar-wasted" style={{ width: `${(r.wastedWh / maxUsed) * 100}%` }} />
            </div>
            <div className="analytics-split">
              <span>☀ office: {fmtWh(r.usedOfficeWh)} used / {fmtWh(r.wastedOfficeWh)} wasted</span>
              <span>🌙 after: {fmtWh(r.usedAfterHoursWh)} used / {fmtWh(r.wastedAfterHoursWh)} wasted · ON {r.afterHoursOnMinutes} min</span>
            </div>
          </div>
        ))}
      </div>

      <div className="waste-events">
        <h3>Recent waste events <span className="rag-badge" title={rag?.chroma}>{rag?.backend === 'chromadb' ? '🧠 ChromaDB' : '📄 local log'} · {rag?.eventCount ?? 0} stored</span></h3>
        {(!recentEvents || recentEvents.length === 0) ? (
          <div className="no-alerts">No waste recorded yet — nobody has forgotten anything ON.</div>
        ) : (
          <ul className="waste-event-list">
            {recentEvents.map((e) => (
              <li key={e.id}>
                <span className={`badge ${e.period === 'after-hours' ? 'badge-critical' : 'badge-warning'}`}>{e.period}</span>
                <span className="waste-text">
                  {e.room}: {e.deviceCount} device(s) ON for {e.minutes} min while empty — {fmtWh(e.wastedWh)} wasted ({e.endedBy})
                </span>
                <span className="waste-time">{new Date(e.endedAt).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Badge({ icon, label, value }) {
  return (
    <div className="analytics-badge">
      <span className="badge-icon">{icon}</span>
      <div>
        <div className="badge-label">{label}</div>
        <div className="badge-value">{value ?? '—'}</div>
      </div>
    </div>
  );
}
