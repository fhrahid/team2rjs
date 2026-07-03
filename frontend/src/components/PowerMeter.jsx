// Total live power draw with a meter bar (max = every device ON).
export default function PowerMeter({ usage, maxPower }) {
  const total = usage?.totalPowerNow ?? 0;
  const pct = maxPower ? Math.min(100, (total / maxPower) * 100) : 0;

  return (
    <div className="power-meter">
      <div className="power-meter-header">
        <span className="power-meter-value">{total} W</span>
        <span className="power-meter-max">of {maxPower} W max</span>
      </div>
      <div className="meter-track">
        <div
          className={`meter-fill ${pct > 75 ? 'high' : pct > 40 ? 'mid' : 'low'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="power-meter-kwh">Estimated usage today: <strong>{usage?.estimatedTodayKwh ?? 0} kWh</strong></div>
    </div>
  );
}
