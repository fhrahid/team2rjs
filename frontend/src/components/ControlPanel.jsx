// AI auto-off controls + PIR demo switches.
// The slider sets how long a room may stay empty (with devices ON) before the
// AI switches everything off. The alert always fires first.
import { useState, useEffect } from 'react';
import { api } from '../services/api';

const DELAY_PRESETS = [10, 30, 60, 120, 300, 600];

export default function ControlPanel({ settings, status }) {
  const [delay, setDelay] = useState(settings?.autoOffDelaySeconds ?? 60);
  const [saving, setSaving] = useState(false);

  // Keep local slider in sync when another client changes settings
  useEffect(() => {
    if (settings?.autoOffDelaySeconds !== undefined) setDelay(settings.autoOffDelaySeconds);
  }, [settings?.autoOffDelaySeconds]);

  const applyDelay = async (value) => {
    setSaving(true);
    await api.updateSettings({ autoOffDelaySeconds: value }).catch(() => {});
    setSaving(false);
  };

  const label = (s) => (s < 60 ? `${s}s` : `${s / 60} min`);

  return (
    <section className="panel control-panel">
      <h2>🤖 AI Auto-Off Control</h2>

      <div className="ai-toggle-row">
        <label className="switch">
          <input
            type="checkbox"
            checked={settings?.aiEnabled ?? true}
            onChange={(e) => api.updateSettings({ aiEnabled: e.target.checked })}
          />
          <span className="switch-slider" />
        </label>
        <span>
          AI auto-off is <strong>{settings?.aiEnabled ? 'ENABLED' : 'DISABLED'}</strong>
        </span>
      </div>

      <div className="delay-control">
        <div className="delay-label">
          Switch off devices when a room is empty for
          <strong> {label(delay)}</strong> {saving && <em>(saving…)</em>}
        </div>
        <input
          type="range"
          min="5" max="600" step="5"
          value={delay}
          disabled={!settings?.aiEnabled}
          onChange={(e) => setDelay(Number(e.target.value))}
          onMouseUp={() => applyDelay(delay)}
          onTouchEnd={() => applyDelay(delay)}
        />
        <div className="delay-presets">
          {DELAY_PRESETS.map((s) => (
            <button
              key={s}
              className={`preset ${delay === s ? 'active' : ''}`}
              disabled={!settings?.aiEnabled}
              onClick={() => { setDelay(s); applyDelay(s); }}
            >
              {label(s)}
            </button>
          ))}
        </div>
      </div>

      <div className="pir-demo">
        <div className="pir-demo-title">PIR sensor demo — simulate people:</div>
        {status?.rooms?.map((r) => (
          <div key={r.roomKey} className="pir-demo-row">
            <span>{r.room}</span>
            <button
              className={`pir-btn ${r.occupied ? 'leave' : 'enter'}`}
              onClick={() => api.setOccupancy(r.roomKey, !r.occupied)}
            >
              {r.occupied ? 'Everyone leaves' : 'Someone enters'}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
