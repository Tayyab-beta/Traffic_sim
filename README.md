# 🚦 Traffic Flow Simulation System

**Live demo:** [traffic-simulator69.vercel.app](https://traffic-simulator69.vercel.app)

A graph-based traffic simulation engine — originally a native C++/SFML desktop application, now compiled to **WebAssembly** and running as a live, interactive browser dashboard built with **React**. No install required; just open the link.

---

## What this is

A road network is modeled as a directed graph (intersections = nodes, roads = edges). Vehicles route through it using **Dijkstra's algorithm** with dynamic, congestion-aware travel times (via the **BPR — Bureau of Public Roads — travel-time function**), and intersections use an **adaptive, queue-based traffic signal** instead of a fixed timer.

On top of the original coursework submission, this version adds:
- 🚑 **Ambulance signal preemption** — emergency vehicles force a green light and get priority, overriding normal queue logic
- 🌆 An isometric, city-style live dashboard — curved roads, real 3-light signals, buildings, day/night toggle
- 🎚️ Auto-traffic generation with an adjustable intensity slider
- 📊 Live metrics: average travel time, total delay, average congestion, throughput, and ambulance preemption count
- 🔁 Full reset, manual add/remove of vehicles, and From/To route selection

---

## Tech stack

| Layer | Tech |
|---|---|
| Simulation engine | C++17 (`TrafficGraph.h`) |
| Browser bridge | `wasm_bridge.cpp` + [nlohmann/json](https://github.com/nlohmann/json) |
| Compiler | [Emscripten](https://emscripten.org/) (`em++`) → WebAssembly |
| Frontend | React + [Vite](https://vitejs.dev/) |
| Rendering | Hand-built SVG (no external graphics library) |
| Hosting | [Vercel](https://vercel.com) (static — no backend server) |

This is a fully **client-side** app — the entire simulation runs inside your browser tab via WebAssembly. There is no server; `sim.wasm`/`sim.js` are just static files served alongside the React build.

---

## Running it locally

### 1. Build the WebAssembly module
Requires the [Emscripten SDK](https://github.com/emscripten-core/emsdk) installed and activated.

```bash
em++ wasm_bridge.cpp -O2 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s ENVIRONMENT=web \
  -s EXPORTED_FUNCTIONS="['_sim_init','_sim_step','_sim_add_vehicle','_sim_remove_vehicle','_sim_get_state','_sim_reset','_sim_set_signal_mode']" \
  -s EXPORTED_RUNTIME_METHODS="['ccall','cwrap','UTF8ToString']" \
  -s ALLOW_MEMORY_GROWTH=1 \
  -o sim.js
```

This produces `sim.js` and `sim.wasm`.

### 2. Place the build output
- `sim.js` → `src/wasm/sim.js`
- `sim.wasm` → `public/wasm/sim.wasm`

### 3. Run the frontend
```bash
npm install
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173`).

### 4. Production build
```bash
npm run build
npm run preview   # test the production build locally before deploying
```

---

## Project structure

```
traffic-sim-web/
├── TrafficGraph.h        # simulation engine (graph, Dijkstra, BPR, signals, preemption)
├── wasm_bridge.cpp        # extern "C" bridge exposing the engine to JS
├── json.hpp                # nlohmann/json (single header)
├── public/
│   └── wasm/sim.wasm        # compiled WebAssembly binary (static asset)
└── src/
    ├── wasm/sim.js            # compiled JS glue module
    ├── hooks/
    │   └── useSimulation.js     # loads the module, runs the tick loop, exposes state
    ├── components/
    │   ├── NetworkScene.jsx      # SVG rendering: roads, signals, buildings, vehicles
    │   └── Dashboard.jsx          # controls, metrics, layout
    └── App.jsx
```

---

## Known limitations / future work

- Network is a fixed 8-node layout (A–H) — not yet loaded from real map data
- No metrics-over-time chart yet (only current snapshot values)
- Single-session only — no server, so no shared/multi-user state or persistence
- Possible future direction: reinforcement-learning based signal tuning, real OpenStreetMap-based networks, or a full-stack version with a live server for multi-user viewing

---

## Course context

Built for **Data Structures & Algorithms** coursework, then extended for competition submission with a full web migration, engine bug fixes, and the ambulance preemption feature.
