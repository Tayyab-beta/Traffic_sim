// src/hooks/useSimulation.js
//
// Loads sim.js (from public/wasm/), starts the simulation, and runs one
// tick per animation frame. Exposes the latest state plus add/remove
// functions the UI can call.

import { useEffect, useRef, useState } from 'react';
import createModule from '../wasm/sim.js';

// One simulated "minute" per tick (see updatevehicle() in TrafficGraph.h).
// Calling this every animation frame (~60/sec) burns through a whole trip
// in a fraction of a second. TICK_MS controls how often we actually step
// the simulation -- raise it to slow the sim down, lower it to speed it up.
const TICK_MS = 1300; // slower again -- both cars and the ambulance scale with this
const MAX_VEHICLES = 30; // auto-spawn stops adding once this many are in play
const NODE_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']; // must match sim_init()'s network
const AMBULANCE_CHANCE = 0.12;
const MIN_SPAWN_MS = 900;  // fastest: a new vehicle roughly every ~1s
const MAX_SPAWN_MS = 5000; // slowest: a new vehicle roughly every 5s

function randomNode() {
  return NODE_IDS[Math.floor(Math.random() * NODE_IDS.length)];
}

export function useSimulation() {
  const moduleRef = useRef(null);
  const stateRef = useRef(null); // mirrors `state`, read inside the auto-spawn interval below
  const [state, setState] = useState(null);
  const [ready, setReady] = useState(false);
  const [autoSpawn, setAutoSpawn] = useState(false);
  // 0 (sparse) to 100 (dense) -- the "intensity" slider. Mapped to an
  // interval between MAX_SPAWN_MS (0) and MIN_SPAWN_MS (100).
  const [intensity, setIntensity] = useState(50);

  useEffect(() => {
    let intervalId;
    let cancelled = false;

    createModule({ locateFile: (f) => '/wasm/' + f }).then((Module) => {
      if (cancelled) return;
      moduleRef.current = Module;

      Module.ccall('sim_init', null, [], []);
      setReady(true);

      const tick = () => {
        Module.ccall('sim_step', null, [], []);
        const json = Module.ccall('sim_get_state', 'string', [], []);
        const parsed = JSON.parse(json);
        stateRef.current = parsed;
        setState(parsed);
      };

      tick(); // render the initial state immediately, don't wait TICK_MS
      intervalId = setInterval(tick, TICK_MS);
    });

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  // Auto-spawn: periodically adds a random vehicle on its own when enabled,
  // at a rate controlled by `intensity`, but stops once MAX_VEHICLES is
  // reached so the list stays finite instead of growing forever.
  useEffect(() => {
    if (!autoSpawn) return;
    const spawnMs = MAX_SPAWN_MS - (intensity / 100) * (MAX_SPAWN_MS - MIN_SPAWN_MS);
    const id = setInterval(() => {
      const Module = moduleRef.current;
      if (!Module) return;
      if (stateRef.current && stateRef.current.vehicles.length >= MAX_VEHICLES) return;
      const src = randomNode();
      let dst = randomNode();
      while (dst === src) dst = randomNode(); // never route to itself
      const isAmbulance = Math.random() < AMBULANCE_CHANCE;
      Module.ccall(
        'sim_add_vehicle',
        null,
        ['string', 'string', 'number'],
        [src, dst, isAmbulance ? 1 : 0]
      );
    }, spawnMs);
    return () => clearInterval(id);
  }, [autoSpawn, intensity]);

  const addVehicle = (src, dst, isAmbulance = false) => {
    moduleRef.current?.ccall(
      'sim_add_vehicle',
      null,
      ['string', 'string', 'number'],
      [src, dst, isAmbulance ? 1 : 0]
    );
  };

  const removeVehicle = (id) => {
    moduleRef.current?.ccall('sim_remove_vehicle', null, ['number'], [id]);
  };

  const reset = () => {
    const Module = moduleRef.current;
    if (!Module) return;
    Module.ccall('sim_reset', null, [], []);
    // refresh immediately so the UI doesn't wait for the next scheduled tick
    const json = Module.ccall('sim_get_state', 'string', [], []);
    setState(JSON.parse(json));
  };

  return { state, ready, addVehicle, removeVehicle, reset, autoSpawn, setAutoSpawn, intensity, setIntensity };
}
