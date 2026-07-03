// Room-wise list of every device with live state, power, and last-changed time.
function timeAgo(iso) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`;
}

export default function DeviceStatusPanel({ groupedDevices }) {
  return (
    <section className="panel device-panel">
      <h2>Live Device Status</h2>
      {Object.entries(groupedDevices).map(([roomName, devices]) => (
        <div key={roomName} className="device-room-group">
          <h3>{roomName}</h3>
          <div className="device-rows">
            {devices.map((d) => (
              <div key={d.id} className={`device-row ${d.status}`}>
                <span className="device-emoji">{d.type === 'fan' ? '🌀' : '💡'}</span>
                <span className="device-name">{d.name}</span>
                <span className={`badge badge-${d.status}`}>{d.status.toUpperCase()}</span>
                <span className="device-power">{d.currentPower}W</span>
                <span className="device-changed" title={d.lastChanged}>{timeAgo(d.lastChanged)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
