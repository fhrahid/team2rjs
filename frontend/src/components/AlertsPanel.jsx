// Active alerts with severity, room, and timestamp.
export default function AlertsPanel({ alerts }) {
  return (
    <section className="panel alerts-panel">
      <h2>Active Alerts {alerts.length > 0 && <span className="alert-count">{alerts.length}</span>}</h2>
      {alerts.length === 0 ? (
        <div className="no-alerts">✅ No active alerts. The office is behaving nicely.</div>
      ) : (
        <ul className="alert-list">
          {alerts.map((a) => (
            <li key={a.id} className={`alert-item severity-${a.severity}`}>
              <div className="alert-top">
                <span className={`badge badge-${a.severity}`}>{a.severity}</span>
                <span className="alert-room">{a.room}</span>
                <span className="alert-time">{new Date(a.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="alert-message">{a.message}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
