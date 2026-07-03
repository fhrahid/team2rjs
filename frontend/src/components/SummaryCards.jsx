// Top row of at-a-glance metrics.
export default function SummaryCards({ status, usage, alerts }) {
  const totals = status?.totals ?? {};
  const cards = [
    { label: 'Live Power', value: `${usage?.totalPowerNow ?? 0} W`, icon: '⚡', accent: 'amber' },
    { label: 'Devices ON', value: totals.devicesOn ?? 0, icon: '🟢', accent: 'green' },
    { label: 'Devices OFF', value: totals.devicesOff ?? 0, icon: '⚪', accent: 'gray' },
    { label: 'Active Alerts', value: alerts.length, icon: '🚨', accent: alerts.length ? 'red' : 'gray' },
    { label: 'Est. Today', value: `${usage?.estimatedTodayKwh ?? 0} kWh`, icon: '📊', accent: 'blue' },
  ];

  return (
    <section className="summary-cards">
      {cards.map((c) => (
        <div key={c.label} className={`summary-card accent-${c.accent}`}>
          <span className="summary-icon">{c.icon}</span>
          <div>
            <div className="summary-value">{c.value}</div>
            <div className="summary-label">{c.label}</div>
          </div>
        </div>
      ))}
    </section>
  );
}
