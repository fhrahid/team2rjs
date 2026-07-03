// Dashboard root: fetches initial state via REST, then stays live via Socket.IO.
import { useEffect, useState } from 'react';
import { api } from './services/api';
import { socket } from './services/socket';
import SummaryCards from './components/SummaryCards';
import OfficeMap from './components/OfficeMap';
import DeviceStatusPanel from './components/DeviceStatusPanel';
import PowerMeter from './components/PowerMeter';
import RoomPowerBreakdown from './components/RoomPowerBreakdown';
import AlertsPanel from './components/AlertsPanel';
import LiveStatusIndicator from './components/LiveStatusIndicator';
import ControlPanel from './components/ControlPanel';
import EnergyAnalytics from './components/EnergyAnalytics';
import ChatBot from './components/ChatBot';

export default function App() {
  const [data, setData] = useState(null); // { devices, groupedDevices, status, usage, alerts }
  const [connected, setConnected] = useState(socket.connected);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 1) Initial snapshot over REST
    Promise.all([
      api.devices(), api.groupedDevices(), api.status(),
      api.usage(), api.alerts(), api.waste(), api.settings(),
    ])
      .then(([devices, groupedDevices, status, usage, alerts, waste, settings]) =>
        setData({ devices, groupedDevices, status, usage, alerts, waste, settings })
      )
      .catch((e) => setError(e.message));

    // 2) Live updates over Socket.IO — no page refresh needed
    socket.on('dashboard:update', (payload) => {
      setData(payload);
      setError(null);
    });
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    return () => {
      socket.off('dashboard:update');
      socket.off('connect');
      socket.off('disconnect');
    };
  }, []);

  if (error && !data) {
    return (
      <div className="app-loading">
        <h1>⚡ Boss Power Monitor</h1>
        <p className="load-error">Cannot reach the backend ({error}). Is it running on port 5000?</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="app-loading">
        <h1>⚡ Boss Power Monitor</h1>
        <p>Connecting to the office…</p>
      </div>
    );
  }

  const { groupedDevices, status, usage, alerts, devices, waste, settings } = data;
  // Max possible draw = every device ON (computed, never hardcoded)
  const maxPower = devices.reduce((sum, d) => sum + d.powerRating, 0);
  const roomMaxPower = maxPower / Object.keys(groupedDevices).length;

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>⚡ Boss Power Monitor</h1>
          <p className="app-tagline">Lights, Fans, Discord: The Boss's Big Idea</p>
        </div>
        <LiveStatusIndicator connected={connected} />
      </header>

      <SummaryCards status={status} usage={usage} alerts={alerts} />

      <div className="main-grid">
        <div className="main-col">
          <OfficeMap groupedDevices={groupedDevices} status={status} alerts={alerts} />
          <section className="panel">
            <h2>Power Consumption</h2>
            <PowerMeter usage={usage} maxPower={maxPower} />
            <RoomPowerBreakdown usage={usage} roomMaxPower={roomMaxPower} />
          </section>
          <EnergyAnalytics waste={waste} />
        </div>
        <div className="side-col">
          <AlertsPanel alerts={alerts} />
          <ControlPanel settings={settings} status={status} />
          <DeviceStatusPanel groupedDevices={groupedDevices} />
        </div>
      </div>

      <footer className="app-footer">
        PIR-simulated occupancy · one shared backend for dashboard &amp; Discord bot · live via Socket.IO
      </footer>

      <ChatBot />
    </div>
  );
}
