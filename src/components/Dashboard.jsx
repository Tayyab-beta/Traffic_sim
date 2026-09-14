// src/components/Dashboard.jsx
//
// Main single-simulation dashboard. Scene rendering lives in NetworkScene.jsx
// now, shared with ComparisonDashboard.jsx.

import { useState } from 'react';
import { useSimulation } from '../hooks/useSimulation';
import NetworkScene, { NODE_IDS } from './NetworkScene';

const MAX_VEHICLES = 30; // matches the cap in useSimulation.js's auto-spawn

export default function Dashboard() {
  const { state, ready, addVehicle, removeVehicle, reset, autoSpawn, setAutoSpawn, intensity, setIntensity } = useSimulation();
  const [from, setFrom] = useState('A');
  const [to, setTo] = useState('F');
  const [isNight, setIsNight] = useState(true);

  if (!ready || !state) {
    return <div style={{ padding: 20 }}>Loading simulation…</div>;
  }

  const atCap = state.vehicles.length >= MAX_VEHICLES;

  const handleAdd = (isAmbulance) => {
    if (from === to || atCap) return;
    addVehicle(from, to, isAmbulance);
  };

  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Traffic flow simulation</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 13 }}>
            From{' '}
            <select value={from} onChange={(e) => setFrom(e.target.value)}>
              {NODE_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 13 }}>
            To{' '}
            <select value={to} onChange={(e) => setTo(e.target.value)}>
              {NODE_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
          <button onClick={() => handleAdd(false)} disabled={atCap}>Add car</button>
          <button onClick={() => handleAdd(true)} disabled={atCap}>Add ambulance</button>
          <button onClick={() => {
              const last = state.vehicles[state.vehicles.length - 1];
              if (last) removeVehicle(last.id);
            }}>
            Remove last
          </button>
          <button onClick={reset} style={{ fontWeight: 600 }}>Reset</button>
          <button
            onClick={() => setAutoSpawn((a) => !a)}
            style={{ fontWeight: 600, background: autoSpawn ? '#639922' : undefined, color: autoSpawn ? 'white' : undefined }}
          >
            {autoSpawn ? '🟢 Auto traffic ON' : '⚪ Auto traffic OFF'}
          </button>
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, opacity: autoSpawn ? 1 : 0.4 }}>
            Intensity
            <input
              type="range" min={0} max={100} value={intensity}
              disabled={!autoSpawn}
              onChange={(e) => setIntensity(Number(e.target.value))}
            />
          </label>
          <button onClick={() => setIsNight((n) => !n)}>{isNight ? '☀️ Day' : '🌙 Night'}</button>
        </div>
      </div>

      <NetworkScene state={state} isNight={isNight} />
      <p style={{ fontSize: 11, color: '#888', margin: '4px 0 0' }}>Click and drag the scene to look around.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginTop: 12 }}>
        {[
          ['Avg travel time', `${state.avgTravelTime.toFixed(2)} min`],
          ['Total delay', state.totalDelay.toFixed(2)],
          ['Avg congestion', state.avgCongestion.toFixed(2)],
          ['Throughput', state.throughput.toFixed(2)],
          ['Preemptions', state.preemptions],
        ].map(([label, value]) => (
          <div key={label} style={{ background: '#f5f5f5', borderRadius: 8, padding: 10, textAlign: 'center' }}>
            <p style={{ fontSize: 11, color: '#777', margin: 0 }}>{label}</p>
            <p style={{ fontSize: 18, fontWeight: 600, margin: '2px 0 0' }}>{value}</p>
          </div>
        ))}
      </div>

      <div style={{ background: '#f5f5f5', borderRadius: 8, padding: 12, marginTop: 8 }}>
        <p style={{ marginTop: 0 }}>Vehicles ({state.vehicles.length}/{MAX_VEHICLES}){atCap ? ' — at capacity' : ''}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
          {state.vehicles.map((v) => (
            <div key={v.id} style={{ fontSize: 12 }}>
              {v.type === 1 ? '🚑 ' : ''}V{v.id}: {v.from} → {v.to} —{' '}
              {v.status === 0 ? 'moving' : v.status === 1 ? 'waiting' : 'arrived'}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
