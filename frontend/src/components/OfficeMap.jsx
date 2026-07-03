// Top-view office floor plan (modelled on the layout in the problem statement):
// Drawing Room (sofa/waiting area) | Work Room 1 | Work Room 2 (desks),
// entry corridor along the bottom, doors, windows, plants and a water cooler.
// Lights glow, fans spin, occupied rooms show people (PIR), alert rooms pulse red.
import { SvgFan, SvgLight } from './DeviceIcon';

const Y = 60, H = 370; // rooms' vertical span
const ROOM_GEO = [
  { key: 'drawing', x: 30, w: 232, floor: '#ead9bd' },
  { key: 'work1', x: 272, w: 226, floor: '#dcdcd4' },
  { key: 'work2', x: 508, w: 222, floor: '#d9b98c' },
];

export default function OfficeMap({ groupedDevices, status, alerts }) {
  const alertRoomKeys = new Set(alerts.map((a) => a.roomKey));
  const byKey = {};
  for (const devices of Object.values(groupedDevices)) {
    if (devices[0]) byKey[devices[0].roomKey] = devices;
  }
  const roomStatus = (key) => status?.rooms?.find((r) => r.roomKey === key);

  return (
    <section className="panel office-map">
      <svg viewBox="0 0 760 560" className="office-svg" xmlns="http://www.w3.org/2000/svg">
        {/* Title */}
        <text x="380" y="24" textAnchor="middle" className="map-title">OFFICE LAYOUT (TOP VIEW)</text>
        <text x="380" y="42" textAnchor="middle" className="map-subtitle">All rooms have 2 Fans and 3 Lights — click a device to toggle it</text>

        {/* Outer walls */}
        <rect x="20" y="50" width="720" height="460" fill="#4a4038" rx="4" />
        {/* Corridor floor */}
        <rect x="30" y="440" width="700" height="60" fill="#e7d9bd" />

        {/* Rooms */}
        {ROOM_GEO.map((geo) => (
          <Room
            key={geo.key}
            geo={geo}
            devices={byKey[geo.key] ?? []}
            rs={roomStatus(geo.key)}
            hasAlert={alertRoomKeys.has(geo.key)}
          />
        ))}

        {/* Wall between rooms and corridor + door gaps and leaves */}
        <rect x="30" y="430" width="700" height="10" fill="#4a4038" />
        {ROOM_GEO.map(({ key, x, w }) => (
          <g key={`door-${key}`}>
            <rect x={x + w / 2 + 20} y="430" width="38" height="10" fill="#e7d9bd" />
            <path d={`M ${x + w / 2 + 58} 440 A 38 38 0 0 1 ${x + w / 2 + 20} 478`} fill="none" stroke="#7a6a55" strokeWidth="2" />
            <line x1={x + w / 2 + 58} y1="440" x2={x + w / 2 + 58} y2="478" stroke="#7a6a55" strokeWidth="3" />
          </g>
        ))}

        {/* Entry: gap in the bottom outer wall */}
        <rect x="355" y="500" width="50" height="10" fill="#f2ead9" />
        <text x="380" y="532" textAnchor="middle" className="entry-text">↑ ENTRY</text>

        {/* Windows on the top outer wall */}
        {ROOM_GEO.map(({ key, x, w }) => (
          <g key={`win-${key}`}>
            <rect x={x + w * 0.28 - 22} y="50" width="44" height="10" fill="#bfe3f2" stroke="#8fb8c9" strokeWidth="1" />
            <rect x={x + w * 0.72 - 22} y="50" width="44" height="10" fill="#bfe3f2" stroke="#8fb8c9" strokeWidth="1" />
          </g>
        ))}
        <rect x="20" y="200" width="10" height="60" fill="#bfe3f2" stroke="#8fb8c9" strokeWidth="1" />
        <rect x="730" y="200" width="10" height="60" fill="#bfe3f2" stroke="#8fb8c9" strokeWidth="1" />

        {/* Corridor decor: plants + water cooler */}
        <Plant x={52} y={470} />
        <Plant x={640} y={472} />
        <g>
          <rect x="688" y="452" width="22" height="34" rx="3" fill="#d8d8d8" stroke="#9a9a9a" />
          <circle cx="699" cy="460" r="7" fill="#7ec8f2" stroke="#4a9cc9" />
        </g>
      </svg>

      {/* Live per-room chips under the plan */}
      <div className="map-chips">
        {ROOM_GEO.map(({ key }) => {
          const rs = roomStatus(key);
          if (!rs) return null;
          return (
            <div key={key} className={`map-chip ${alertRoomKeys.has(key) ? 'chip-alert' : ''}`}>
              <strong>{rs.room}</strong>
              <span className={rs.occupied ? 'occ-yes' : 'occ-no'}>
                {rs.occupied ? '🧍 occupied' : '○ empty'}
              </span>
              <span>{rs.devicesOn}/5 ON · {rs.powerNow}W</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Room({ geo, devices, rs, hasAlert }) {
  const { key, x, w, floor } = geo;
  const fans = devices.filter((d) => d.type === 'fan');
  const lights = devices.filter((d) => d.type === 'light');
  const cx = x + w / 2;

  return (
    <g>
      <rect x={x} y={Y} width={w} height={H} fill={floor} />

      {/* Furniture */}
      {key === 'drawing' ? <DrawingFurniture x={x} w={w} /> : <WorkFurniture x={x} w={w} />}

      {/* Room name */}
      <text x={cx} y={Y + 148} textAnchor="middle" className="room-label">
        {rs?.room?.toUpperCase() ?? key.toUpperCase()}
      </text>

      {/* Lights: two top corners + one bottom centre */}
      {lights[0] && <SvgLight device={lights[0]} x={x + w * 0.22} y={Y + 58} />}
      {lights[1] && <SvgLight device={lights[1]} x={x + w * 0.78} y={Y + 58} />}
      {lights[2] && <SvgLight device={lights[2]} x={cx} y={Y + 330} />}

      {/* Fans */}
      {fans[0] && <SvgFan device={fans[0]} x={cx} y={Y + 62} size={30} />}
      {key === 'drawing'
        ? fans[1] && <SvgFan device={fans[1]} x={x + w * 0.34} y={Y + 272} size={30} />
        : fans[1] && <SvgFan device={fans[1]} x={cx} y={Y + 262} size={30} />}

      {/* PIR sensor + occupancy */}
      <g>
        <circle cx={x + w - 18} cy={Y + 16} r={5} fill={rs?.occupied ? '#34d399' : '#9aa2b1'} className={rs?.occupied ? 'pir-active' : ''} />
        <text x={x + w - 28} y={Y + 20} textAnchor="end" className="pir-label">PIR</text>
      </g>
      {rs?.occupied && <Person x={cx - (key === 'drawing' ? 40 : 0)} y={Y + 196} />}

      {/* Alert highlight */}
      {hasAlert && <rect x={x + 2} y={Y + 2} width={w - 4} height={H - 4} className="room-alert-svg" />}
    </g>
  );
}

function DrawingFurniture({ x, w }) {
  return (
    <g stroke="#8a7154" strokeWidth="1.2">
      {/* sofa along the left wall */}
      <rect x={x + 8} y={Y + 120} width={30} height={116} rx={7} fill="#cdb391" />
      <line x1={x + 8} y1={Y + 159} x2={x + 38} y2={Y + 159} />
      <line x1={x + 8} y1={Y + 198} x2={x + 38} y2={Y + 198} />
      {/* armchair */}
      <rect x={x + 14} y={Y + 268} width={28} height={30} rx={8} fill="#cdb391" />
      {/* rug + coffee table */}
      <rect x={x + 58} y={Y + 152} width={110} height={82} rx={10} fill="#dcc8a4" strokeDasharray="3 3" />
      <rect x={x + 88} y={Y + 176} width={52} height={32} rx={3} fill="#8a6a4e" />
      <Plant x={x + 26} y={Y + 24} />
      <Plant x={x + w - 34} y={Y + 316} />
    </g>
  );
}

function WorkFurniture({ x, w }) {
  const desk = (dx, dy, chairBelow) => (
    <g key={`${dx}-${dy}`}>
      <rect x={dx} y={dy} width={54} height={30} rx={3} fill="#c39764" stroke="#96703f" />
      <rect x={dx + 18} y={dy + 8} width={18} height={11} rx={1.5} fill="#3b3b3b" />
      <circle cx={dx + 27} cy={chairBelow ? dy + 42 : dy - 12} r={8} fill="#4d4d4d" />
    </g>
  );
  return (
    <g>
      {desk(x + w * 0.14, Y + 118, true)}
      {desk(x + w * 0.62, Y + 118, true)}
      {desk(x + w * 0.14, Y + 246, false)}
      {desk(x + w * 0.62, Y + 246, false)}
      <Plant x={x + 10} y={Y + 20} small />
    </g>
  );
}

function Person({ x, y }) {
  return (
    <g className="person">
      <circle cx={x} cy={y} r={6} fill="#2c6e49" />
      <ellipse cx={x} cy={y + 14} rx={9} ry={10} fill="#2c6e49" opacity="0.85" />
    </g>
  );
}

function Plant({ x, y, small = false }) {
  const r = small ? 8 : 12;
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#5f8f4e" />
      <circle cx={x - r * 0.5} cy={y - r * 0.4} r={r * 0.55} fill="#74a75f" />
      <circle cx={x + r * 0.5} cy={y - r * 0.3} r={r * 0.5} fill="#4c7a3d" />
    </g>
  );
}
