// SVG device primitives used inside the OfficeMap floor plan.
// Fans spin when ON, lights glow when ON. Click to toggle (demo feature).
import { api } from '../services/api';

/** Ceiling fan, top view: hub + 3 wooden blades. */
export function SvgFan({ device, x, y, size = 22 }) {
  const on = device.status === 'on';
  const s = size / 40; // artwork is drawn on a 40x40 grid
  return (
    <g
      transform={`translate(${x - size / 2}, ${y - size / 2}) scale(${s})`}
      className={`svg-device ${on ? '' : 'svg-off'}`}
      onClick={() => api.toggleDevice(device.id)}
    >
      <title>{`${device.room} · ${device.name} — ${on ? `ON (${device.currentPower}W)` : 'OFF'} · click to toggle`}</title>
      <circle cx="20" cy="20" r="19" fill="transparent" />
      <g className={`fan-blades-svg ${on ? 'spinning' : ''}`}>
        <path d="M20 20 C 12 8, 24 4, 26 12 C 27 16, 23 18, 20 20 Z" fill="#5b4636" />
        <path d="M20 20 C 32 24, 30 36, 22 33 C 18 31, 19 25, 20 20 Z" fill="#5b4636" />
        <path d="M20 20 C 12 28, 4 20, 11 15 C 14 13, 18 16, 20 20 Z" fill="#5b4636" />
        <circle cx="20" cy="20" r="3.4" fill="#3d2f24" />
      </g>
    </g>
  );
}

/** Ceiling light, top view: glowing disc. */
export function SvgLight({ device, x, y, r = 8 }) {
  const on = device.status === 'on';
  return (
    <g className="svg-device" onClick={() => api.toggleDevice(device.id)}>
      <title>{`${device.room} · ${device.name} — ${on ? `ON (${device.currentPower}W)` : 'OFF'} · click to toggle`}</title>
      {on && <circle cx={x} cy={y} r={r * 2.1} fill="rgba(255, 214, 79, 0.35)" />}
      <circle
        cx={x} cy={y} r={r}
        fill={on ? '#ffd64f' : '#c9c9c2'}
        stroke={on ? '#e8a812' : '#9a9a92'}
        strokeWidth="1.5"
        className={on ? 'light-on-svg' : ''}
      />
      {on && <circle cx={x} cy={y} r={r * 0.45} fill="#fff8d6" />}
    </g>
  );
}
