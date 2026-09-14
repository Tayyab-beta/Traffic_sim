// src/components/NetworkScene.jsx
//
// City-style rebuild: roads are curved (quadratic bezier, not straight
// lines), widths vary per road, buildings are placed alongside each road
// instead of scattered independently, and intersections show an actual
// 3-light signal housing (red/yellow/green) instead of a plain dot.
// Vehicles follow the same curve the road uses, so they visually stay on
// the road instead of cutting across empty space.

import { useState, useRef } from 'react';

export const NODE_POS = {
  A: { x: 32, y: 160 },
  B: { x: 166, y: 60 },
  C: { x: 166, y: 260 },
  D: { x: 435, y: 60 },
  E: { x: 435, y: 260 },
  F: { x: 570, y: 160 },
  G: { x: 704, y: 60 },
  H: { x: 704, y: 260 },
};
export const NODE_IDS = Object.keys(NODE_POS);

// Per-road curvature (how far the road bows away from a straight line) and
// width (wider = a main road, narrower = a side street), keyed by
// "from-to". Hand-picked for variety rather than tied to simulation data,
// purely a visual styling choice. Any edge not listed falls back to a
// deterministic hash-based value so new roads still get *some* variation.
const CURVE_MAP = {
  'A-B': 22, 'A-C': -20, 'B-D': -30, 'C-E': 26, 'C-D': 16,
  'E-D': 10, 'D-F': -22, 'E-F': 24, 'F-G': -20, 'F-H': 18, 'G-H': -24,
};
const WIDTH_MAP = {
  'A-B': 20, 'A-C': 20, 'B-D': 22, 'C-E': 22, 'D-F': 20, 'E-F': 20, // main roads
  'C-D': 10, 'E-D': 10, 'F-G': 12, 'F-H': 12, 'G-H': 10,             // side streets
};

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
function curveFor(key) {
  return key in CURVE_MAP ? CURVE_MAP[key] : ((Math.abs(hashStr(key)) % 7) - 3) * 8;
}
function widthFor(key) {
  return WIDTH_MAP[key] ?? 14;
}

// -- Curve math: every road is one quadratic bezier from `from` to `to`,
// bowed sideways by `curve` pixels at the midpoint.
function controlPoint(from, to, curve) {
  const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: mx + (-dy / len) * curve, y: my + (dx / len) * curve };
}
function bezierPoint(p0, pc, p2, t) {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * pc.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * pc.y + t * t * p2.y,
  };
}
function bezierTangent(p0, pc, p2, t) {
  const mt = 1 - t;
  return {
    x: 2 * mt * (pc.x - p0.x) + 2 * t * (p2.x - pc.x),
    y: 2 * mt * (pc.y - p0.y) + 2 * t * (p2.y - pc.y),
  };
}
function perpAt(tan) {
  const len = Math.hypot(tan.x, tan.y) || 1;
  return { x: -tan.y / len, y: tan.x / len };
}

function congestionColor(flow, capacity) {
  const ratio = capacity ? flow / capacity : 0;
  if (ratio < 0.3) return '#639922';
  if (ratio < 0.6) return '#BA7517';
  return '#E24B4A';
}

function isoCube(cx, cy, s, h) {
  const roofN = [cx, cy - s / 2 - h];
  const roofE = [cx + s, cy - h];
  const roofS = [cx, cy + s / 2 - h];
  const roofW = [cx - s, cy - h];
  const baseE = [cx + s, cy];
  const baseS = [cx, cy + s / 2];
  const baseW = [cx - s, cy];
  const pts = (arr) => arr.map((p) => p.join(',')).join(' ');
  return {
    top: pts([roofN, roofE, roofS, roofW]),
    right: pts([baseE, baseS, roofS, roofE]),
    left: pts([baseS, baseW, roofW, roofS]),
  };
}
const BUILDING_PALETTE = [
  ['#7F77DD', '#534AB7', '#3C3489'],
  ['#5DCAA5', '#1D9E75', '#0F6E56'],
  ['#F0997B', '#D85A30', '#993C1D'],
  ['#85B7EB', '#378ADD', '#185FA5'],
];
// Fills the open margins above the top road row and below the bottom row,
// so the scene doesn't leave large dead black areas top/bottom.
const FILLER_BUILDINGS = [
  { cx: 166, cy: 18, s: 20, h: 26 }, { cx: 435, cy: 18, s: 22, h: 34 }, { cx: 704, cy: 18, s: 18, h: 24 },
  { cx: 166, cy: 298, s: 18, h: 22 }, { cx: 435, cy: 298, s: 22, h: 30 }, { cx: 704, cy: 298, s: 20, h: 26 },
];

export default function NetworkScene({ state, isNight = true, height = 340, showBuildings = true, enablePan = true }) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const onMouseDown = (e) => {
    if (!enablePan) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    setDragging(true);
  };
  const onMouseMove = (e) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPan({ x: dragRef.current.panX + dx, y: dragRef.current.panY + dy });
  };
  const stopDrag = () => {
    dragRef.current = null;
    setDragging(false);
  };

  const sky = isNight ? '#0d0f14' : '#bcd9ef';
  const groundColor = isNight ? '#1b1e26' : '#dfe9d8';

  return (
    <div
      style={{ background: sky, borderRadius: 12, padding: 8, overflow: 'hidden', cursor: enablePan ? (dragging ? 'grabbing' : 'grab') : 'default' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
    >
      <svg viewBox="0 0 736 320" style={{ width: '100%', height, userSelect: 'none' }}>
        <g transform={`translate(${pan.x},${pan.y})`}>
          <rect x={-40} y={-40} width={816} height={400} fill={groundColor} rx={16} />

          {/* Buildings placed alongside each road (not scattered independently) */}
          {showBuildings && state.edges.map((e, i) => {
            const from = NODE_POS[e.from], to = NODE_POS[e.to];
            if (!from || !to) return null;
            const key = `${e.from}-${e.to}`;
            const cp = controlPoint(from, to, curveFor(key));
            const t = 0.45;
            const pt = bezierPoint(from, cp, to, t);
            const perp = perpAt(bezierTangent(from, cp, to, t));
            const side = i % 2 === 0 ? 1 : -1;
            const dist = widthFor(key) / 2 + 26;
            const bx = pt.x + perp.x * dist * side;
            const by = pt.y + perp.y * dist * side;
            const colors = BUILDING_PALETTE[i % BUILDING_PALETTE.length];
            const { top, right, left } = isoCube(bx, by, 13 + (i % 3) * 3, 16 + (i % 2) * 12);
            return (
              <g key={`bldg-${i}`}>
                <polygon points={left} fill={colors[2]} />
                <polygon points={right} fill={colors[1]} />
                <polygon points={top} fill={colors[0]} />
              </g>
            );
          })}

          {showBuildings && FILLER_BUILDINGS.map((b, i) => {
            const colors = BUILDING_PALETTE[i % BUILDING_PALETTE.length];
            const { top, right, left } = isoCube(b.cx, b.cy, b.s, b.h);
            return (
              <g key={`filler-${i}`}>
                <polygon points={left} fill={colors[2]} />
                <polygon points={right} fill={colors[1]} />
                <polygon points={top} fill={colors[0]} />
              </g>
            );
          })}

          {/* Roads: curved, variable width, black asphalt bed -- congestion
              shown via the center stripe color rather than the road itself */}
          {state.edges.map((e, i) => {
            const from = NODE_POS[e.from], to = NODE_POS[e.to];
            if (!from || !to) return null;
            const key = `${e.from}-${e.to}`;
            const cp = controlPoint(from, to, curveFor(key));
            const width = widthFor(key);
            const d = `M ${from.x},${from.y} Q ${cp.x},${cp.y} ${to.x},${to.y}`;
            return (
              <g key={i}>
                <path d={d} fill="none" stroke="#000000" strokeWidth={width} strokeLinecap="round" />
                <path d={d} fill="none" stroke={congestionColor(e.flow, e.capacity)} strokeWidth={2.5} strokeDasharray="10 9" opacity={0.95} />
              </g>
            );
          })}

          {/* Real 3-light signal housing near each intersection approach */}
          {state.edges.map((e, i) => {
            const from = NODE_POS[e.from], to = NODE_POS[e.to];
            if (!from || !to) return null;
            const key = `${e.from}-${e.to}`;
            const cp = controlPoint(from, to, curveFor(key));
            const t = 0.85;
            const pt = bezierPoint(from, cp, to, t);
            const perp = perpAt(bezierTangent(from, cp, to, t));
            const off = widthFor(key) / 2 + 11;
            const sx = pt.x + perp.x * off;
            const sy = pt.y + perp.y * off;
            const isGreen = e.signal === 'GREEN';
            return (
              <g key={`sig-${i}`} transform={`translate(${sx},${sy})`}>
                <rect x={-5.5} y={-14} width={11} height={28} rx={3} fill="#222" stroke="black" strokeWidth={0.6} />
                <circle cx={0} cy={-8.5} r={3} fill={!isGreen ? '#ff4d4d' : '#4a1010'} />
                <circle cx={0} cy={0} r={3} fill="#4a3d10" />
                <circle cx={0} cy={8.5} r={3} fill={isGreen ? '#4CD964' : '#0f3d1f'} />
              </g>
            );
          })}

          {state.nodes.map((n) => {
            const pos = NODE_POS[n.id];
            if (!pos) return null;
            return (
              <g key={n.id}>
                <circle cx={pos.x} cy={pos.y + 3} r={16} fill="#000000" opacity={0.35} />
                <circle cx={pos.x} cy={pos.y} r={16} fill="#378ADD" stroke="#1D5FA0" strokeWidth={1.5} />
                <text x={pos.x} y={pos.y + 4} textAnchor="middle" fill="white" fontSize={12}>{n.id}</text>
              </g>
            );
          })}

          {/* Vehicles follow the same curve the road uses. Lane offsets are
              computed per-edge below so vehicles sharing a road are always
              spread apart -- a fixed id%3 scheme could put two different
              vehicles in the exact same slot and render them on top of each
              other, making the road look emptier than the vehicle count. */}
          {(() => {
            const active = state.vehicles.filter((v) => v.status !== 2);
            const groups = {};
            active.forEach((v) => {
              const key = `${v.from}-${v.to}`;
              (groups[key] = groups[key] || []).push(v);
            });
            Object.values(groups).forEach((g) => g.sort((a, b) => a.id - b.id));
            const laneInfo = {};
            Object.values(groups).forEach((g) => {
              g.forEach((v, idx) => { laneInfo[v.id] = { idx, size: g.length }; });
            });
            const LANE_SPACING = 6;

            return active.map((v) => {
              const from = NODE_POS[v.from], to = NODE_POS[v.to];
              if (!from || !to) return null;
              const key = `${v.from}-${v.to}`;
              const cp = controlPoint(from, to, curveFor(key));
              const progress = typeof v.progress === 'number' ? v.progress : 0;
              const pt = bezierPoint(from, cp, to, progress);
              const tan = bezierTangent(from, cp, to, progress);
              const perp = perpAt(tan);
              const { idx, size } = laneInfo[v.id];
              const offset = (idx - (size - 1) / 2) * LANE_SPACING;
              const cx = pt.x + perp.x * offset;
              const cy = pt.y + perp.y * offset;
              const angleDeg = (Math.atan2(tan.y, tan.x) * 180) / Math.PI;
              const isAmbulance = v.type === 1;

              if (isAmbulance) {
                return (
                  <g key={v.id} transform={`translate(${cx},${cy})`} style={{ transition: 'transform 0.85s linear' }}>
                    <ellipse cx={0} cy={4} rx={14} ry={4} fill="#000000" opacity={0.35} />
                    <g transform={`rotate(${angleDeg})`}>
                      <rect x={-13} y={-6.5} width={26} height={13} rx={3} fill="#E24B4A" stroke="white" strokeWidth={1.2}>
                        <animate attributeName="fill" values="#E24B4A;#ffffff;#E24B4A" dur="0.5s" repeatCount="indefinite" />
                      </rect>
                      <rect x={-3} y={-3} width={6} height={6} fill="#E24B4A" />
                    </g>
                  </g>
                );
              }

              const color = v.status === 1 ? '#BA7517' : '#378ADD';
              return (
                <g key={v.id} transform={`translate(${cx},${cy})`} style={{ transition: 'transform 0.85s linear' }}>
                  <ellipse cx={0} cy={3.5} rx={11} ry={3.5} fill="#000000" opacity={0.3} />
                  <g transform={`rotate(${angleDeg})`}>
                    <rect x={-10} y={-5} width={20} height={10} rx={3} fill={color} stroke="white" strokeWidth={1.2} />
                  </g>
                </g>
              );
            });
          })()}
        </g>
      </svg>
    </div>
  );
}
