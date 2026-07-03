// Per-room power bars + highest consuming room callout.
export default function RoomPowerBreakdown({ usage, roomMaxPower }) {
  const rooms = usage?.perRoomUsage ?? [];
  const highest = usage?.highestConsumingRoom;

  return (
    <div className="room-breakdown">
      {rooms.map((r) => {
        const pct = roomMaxPower ? Math.min(100, (r.powerNow / roomMaxPower) * 100) : 0;
        const isTop = r.room === highest;
        return (
          <div key={r.roomKey} className={`room-breakdown-row ${isTop ? 'top-room' : ''}`}>
            <span className="room-breakdown-name">
              {r.room} {isTop && <span className="top-badge">highest</span>}
            </span>
            <div className="meter-track small">
              <div className="meter-fill low" style={{ width: `${pct}%` }} />
            </div>
            <span className="room-breakdown-watts">{r.powerNow}W</span>
          </div>
        );
      })}
    </div>
  );
}
