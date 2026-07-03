// Small "LIVE / OFFLINE" pill showing the Socket.IO connection state.
export default function LiveStatusIndicator({ connected }) {
  return (
    <span className={`live-indicator ${connected ? 'live' : 'offline'}`}>
      <span className="live-dot" />
      {connected ? 'LIVE' : 'OFFLINE'}
    </span>
  );
}
