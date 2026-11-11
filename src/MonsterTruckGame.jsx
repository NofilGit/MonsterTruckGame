import React, { useEffect, useRef, useState } from "react";

/* ---------- Constants ---------- */
const GRAVITY = 0.5; // natural gravity
const JUMP_POWER = 13; // higher jump
const MAX_SPEED = 5.2; // faster truck
const REVERSE_SPEED = 2.6;
const PX_PER_METER = 10;
const COURSE_END = 30000; // 3000 m course
const CHECKPOINTS = [6000, 12000, 18000, 24000]; // every 600 m
const COIN_COUNT = 90; // coins on the course
const COIN_PASS = 35; // fewer coins than this at the finish = not enough coins
const LIVES_START = 3;
const ROUNDS = 10; // rounds per map
const COIN_X = (i) => 200 + i * 330;
const FUEL_PER_UNIT = 100 / 4000; // 100% fuel = 400 m (4000 world units)
const FUEL_STATION_GAP = 3000; // a fuel station every 300 m
const FLIP_SPEED = 0.11; // radians per frame while FLIP is held in the air
const WHEELIE_ANGLE = 0.28; // nose-up angle while WHEELIE is held on the ground
const FLIP_LIMIT = 0.42; // holding a wheelie past this angle flips the truck
const HILL_EVERY = 3000; // a steep hill every 300 m (3000 world units)
const HILL_L = 600; // hill length
const HILL_H = 170; // hill height

// 2D ramp catalog. Heights are added to the road profile; positive values rise.
const RAMP_MODELS = [
  { id: "classic", name: "Classic", points: [[0,0],[0.18,2],[0.42,12],[0.68,34],[0.88,54],[1,0]] },
  { id: "steep", name: "Steep Jump", points: [[0,0],[0.35,0],[0.58,18],[0.78,62],[0.94,100],[1,0]] },
  { id: "long", name: "Long Ramp", points: [[0,0],[0.15,3],[0.45,18],[0.72,36],[0.92,52],[1,0]] },
  { id: "double", name: "Double Ramp", points: [[0,0],[0.18,32],[0.34,48],[0.48,8],[0.64,8],[0.82,48],[0.94,62],[1,0]] },
  { id: "launch", name: "Launch Ramp", points: [[0,0],[0.25,-12],[0.48,-18],[0.7,18],[0.88,78],[0.96,105],[1,0]] },
  { id: "suspended", name: "Suspended", points: [[0,0],[0.18,24],[0.42,34],[0.68,42],[0.88,58],[1,0]] },
  { id: "bridge", name: "Bridge Jump", points: [[0,0],[0.2,22],[0.8,22],[1,0]] },
  { id: "descending", name: "Descending", points: [[0,0],[0.12,78],[0.3,72],[0.55,48],[0.78,20],[1,0]] },
  { id: "loop", name: "Loop Arc", points: [[0,0],[0.18,35],[0.35,82],[0.5,112],[0.65,82],[0.82,35],[1,0]] },
  { id: "bumpy", name: "Bumpy", points: [[0,0],[0.12,24],[0.24,8],[0.38,36],[0.52,12],[0.68,42],[0.84,18],[1,0]] },
  { id: "mega", name: "Mega Jump", points: [[0,0],[0.22,4],[0.48,30],[0.72,78],[0.92,132],[1,0]] },
  { id: "platform", name: "Landing Platform", points: [[0,0],[0.16,38],[0.84,38],[1,0]] },
];
const rampModelFor = (seed) => RAMP_MODELS[Math.floor(rnd(seed) * RAMP_MODELS.length)];


// Truck geometry (local units, origin = bottom of the wheels when resting)
const SVG_S = 26 / 125; // game units per artwork unit
const SVG_CX = 582.5; // centre between the two wheels (artwork x)
const SVG_GROUND = 615; // bottom of the tyres (artwork y)
const SVG_WHEEL_Y = 490; // wheel centre y (artwork)
const SVG_WHEELS = [300, 865]; // wheel centre x (artwork)
const WHEEL_X = SVG_WHEELS.map((x) => (x - SVG_CX) * SVG_S);
const WHEEL_R = 26;
const CH = 30; // chassis height above the wheel bottoms
const BODY_POINTS = [-88, -40, 0, 80];

// Suspension (visual spring for the tyres)
const SUSP_K = 0.22;
const SUSP_D = 0.7;
const SUSP_EXT = 8;
const SUSP_COMP = 10;

// World layout
const BLOCK = 1000;
const BLOCK_AMP = { mountain: 1, flat: 0.08, ramp: 0.08, pond: 0.4, mud: 0.25, bridge: 0.3 };

// Maps the player can choose from (colours, road grip and decorations)
const MAPS = [
  {
    name: "Snow Mountain ❄️",
    desc: "Icy road, low grip. Drive carefully!",
    grip: 0.6,
    decor: "snow",
    skyTop: "#cfe8ff",
    skyBot: "#f4fbff",
    far1: "#d6e6f5",
    far2: "#b8cfe6",
    gTop: "#ffffff",
    gMid: "#dfeaf5",
    gBot: "#9fb4c8",
    rock: "#9aa9b8",
  },
  {
    name: "Sea Side 🌊",
    desc: "Drive on the sand, good grip.",
    grip: 0.85,
    decor: "sea",
    skyTop: "#4fc3f7",
    skyBot: "#fff4d6",
    far1: "#7fd0e8",
    far2: "#4fb0cf",
    gTop: "#f7e3a1",
    gMid: "#e8c97a",
    gBot: "#b8914f",
    rock: "#8d8478",
  },
  {
    name: "Jungle 🌴",
    desc: "Dense jungle, solid grip.",
    grip: 1.0,
    decor: "jungle",
    skyTop: "#7fd38a",
    skyBot: "#d9f5c5",
    far1: "#2e7d4f",
    far2: "#1b5e3a",
    gTop: "#4caf50",
    gMid: "#6d4c2b",
    gBot: "#3a2a18",
    rock: "#6b6b5a",
  },
  {
    name: "Desert 🏜️",
    desc: "Hot desert, good grip, rolling dunes.",
    grip: 0.95,
    decor: "dunes",
    skyTop: "#ffb347",
    skyBot: "#ffe9b0",
    far1: "#d9a066",
    far2: "#b97a45",
    gTop: "#f2d08a",
    gMid: "#d9b06a",
    gBot: "#9c7040",
    rock: "#8a6d4f",
  },
  {
    name: "Night City 🌙",
    desc: "Night drive, grip can be low.",
    grip: 0.8,
    decor: "stars",
    skyTop: "#0b1030",
    skyBot: "#2b2f5c",
    far1: "#262b52",
    far2: "#1a1d3a",
    gTop: "#3a3f66",
    gMid: "#2a2d4e",
    gBot: "#161829",
    rock: "#4a4d6e",
  },
  {
    name: "Volcano 🌋",
    desc: "Drive near the lava, it is very hot!",
    grip: 0.9,
    decor: "embers",
    skyTop: "#3a0d05",
    skyBot: "#c2410c",
    far1: "#5a1a0b",
    far2: "#3b1006",
    gTop: "#4a2a20",
    gMid: "#2e1a14",
    gBot: "#150b08",
    rock: "#5b4638",
  },
];

// Truck colour choices shown in the pause menu
const THEMES = [
  {
    name: "Blue Thunder",
    primary: "#087bff",
    secondary: "#00d9ff",
    dark: "#06152c",
    rim: "#168cff",
    flame: "#00cfff",
    accent: "#ffffff",
    body: "#087bff",
    light: "#00d9ff",
  },
  {
    name: "Toxic Beast",
    primary: "#8bff00",
    secondary: "#d8ff00",
    dark: "#152000",
    rim: "#80d900",
    flame: "#b5ff00",
    accent: "#111111",
    body: "#8bff00",
    light: "#d8ff00",
  },
  {
    name: "Desert Crusher",
    primary: "#ff9d00",
    secondary: "#ffdf24",
    dark: "#301400",
    rim: "#d87900",
    flame: "#ff4a00",
    accent: "#ffffff",
    body: "#ff9d00",
    light: "#ffdf24",
  },
  {
    name: "Lava Kong",
    primary: "#e53935",
    secondary: "#ffb300",
    dark: "#2a0606",
    rim: "#ff7043",
    flame: "#ffea00",
    accent: "#ffffff",
    body: "#e53935",
    light: "#ffb300",
  },
  {
    name: "Ice Viper",
    primary: "#e3f2fd",
    secondary: "#29b6f6",
    dark: "#0d2233",
    rim: "#4fc3f7",
    flame: "#80deea",
    accent: "#0d2233",
    body: "#e3f2fd",
    light: "#29b6f6",
  },
  {
    name: "Shadow Rex",
    primary: "#37474f",
    secondary: "#b388ff",
    dark: "#0b0b0f",
    rim: "#7e57c2",
    flame: "#d500f9",
    accent: "#ffffff",
    body: "#37474f",
    light: "#b388ff",
  },
];

/* ---------- Helpers ---------- */
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

let worldSeed = 0; // changes the road for each round
let courseRound = 1; // current round (sets how many ramps and how hard they are)

// Ramps for the current round: round 1 has 2 ramps, round 2 has 3, and so on.
// Later rounds mix in harder ramp types.
const EASY_RAMPS = ["classic", "long", "bridge", "platform", "bumpy"];
const MID_RAMPS = ["suspended", "double", "descending", "steep"];
const HARD_RAMPS = ["launch", "loop", "mega", "steep"];
const nearRamp = (x, margin) => courseRamps().some((r) => Math.abs(r.cx - x) < margin);
const rampWeight = (x) => {
  let w = 0;
  courseRamps().forEach((r) => {
    const d = Math.abs(x - r.cx);
    if (d < 420) w = Math.max(w, 0.5 + 0.5 * Math.cos((Math.PI * d) / 420));
  });
  return w;
};

const courseRamps = () => {
  const count = courseRound + 1;
  const hardShare = courseRound >= 7 ? 0.4 : courseRound >= 4 ? 0.2 : 0;
  const midShare = courseRound >= 3 ? 0.5 : 0;
  const list = [];
  for (let i = 0; i < count; i++) {
    const slot = (COURSE_END - 2000) / count;
    const cx = 1000 + (i + 0.5) * slot + (rnd(i * 13 + worldSeed) - 0.5) * Math.min(300, slot * 0.4);
    const u = rnd(i * 7 + 3 + worldSeed * 5);
    const pool = u < hardShare ? HARD_RAMPS : u < hardShare + midShare ? MID_RAMPS : EASY_RAMPS;
    const id = pool[Math.floor(rnd(i * 11 + 1 + worldSeed * 3) * pool.length)];
    list.push({ cx, id });
  }
  return list;
};
let truckWorldX = 0; // truck position, used to sag the bridge under its weight
const rnd = (n) => {
  const s = Math.sin((n + worldSeed * 7919) * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

const bell = (d, hw) => (Math.abs(d) < hw ? 0.5 * (1 + Math.cos((Math.PI * d) / hw)) : 0);

const mountainY = (x) =>
  120 * Math.sin(x * 0.002) +
  50 * Math.sin(x * 0.007 + 1) +
  18 * Math.sin(x * 0.021) +
  5 * Math.sin(x * 0.06 + 1);

const blockType = (k) => {
  if (k === 0 || k === -1) return "flat";
  const r = rnd(k * 7 + 3);
  if (r < 0.3) return "mountain";
  if (r < 0.5) return "flat";
  if (r < 0.58) return "ramp";
  if (r < 0.7) return "pond";
  if (r < 0.83) return "mud";
  return "bridge";
};
const blockCenter = (k) => k * BLOCK + 500;

const ampAt = (x) => {
  let num = 0;
  let den = 0;
  const k0 = Math.floor(x / BLOCK);
  for (let k = k0 - 2; k <= k0 + 2; k++) {
    const w = Math.exp(-(((x - blockCenter(k)) / 350) ** 2));
    num += BLOCK_AMP[blockType(k)] * w;
    den += w;
  }
  return num / den;
};

// 1 near a fuel station (flat, straight road), 0 elsewhere
const stationWeight = (x) => {
  const k = Math.round(x / FUEL_STATION_GAP);
  if (k < 1) return 0;
  const d = Math.abs(x - k * FUEL_STATION_GAP);
  return d < 450 ? 0.5 + 0.5 * Math.cos((Math.PI * d) / 450) : 0;
};

const baseY = (x) => {
  const flat = 1 - Math.max(stationWeight(x), rampWeight(x));
  return (mountainY(x) * ampAt(x) + 3 * Math.sin(x * 0.013)) * flat;
};

const featuresNear = (x) => {
  const out = [];
  for (let k = Math.floor((x - 800) / BLOCK); k <= Math.floor((x + 800) / BLOCK); k++) {
    const c = blockCenter(k);
    const type = blockType(k);
    if (type === "mountain" && rnd(k + 5) > 0.45) {
      out.push({ kind: "rock", cx: c + (rnd(k + 21) - 0.5) * 400, hw: 70 + rnd(k + 9) * 30, h: 22 + rnd(k + 13) * 14 });
    }
    if (type === "flat" && rnd(k + 11) > 0.35) {
      out.push({ kind: "car", cx: c + (rnd(k + 31) - 0.5) * 200, hw: 80, h: 18 });
    }
    if (type === "pond") out.push({ kind: "pond", cx: c, hw: 170, h: 60 });
    if (type === "mud") out.push({ kind: "mud", cx: c, hw: 240, h: 10 });
    if (type === "bridge") out.push({ kind: "chasm", cx: c, hw: 170, h: 260 });
  }
  courseRamps().forEach((r) => {
    if (Math.abs(r.cx - x) < 800) out.push({ kind: "launch", cx: r.cx, hw: 260, h: 0, rampType: r.id });
  });
  return out.filter((f) => stationWeight(f.cx) < 0.05 && (f.kind === "launch" || !nearRamp(f.cx, 420))); // obstacles stay off ramps and fuel roads
};

// Steep hill: climbs to a crest, then drops steeply on the far side (smooth curves)
const hillProfile = (f, x) => {
  const u = (x - (f.cx - f.hw)) / (2 * f.hw);
  if (u < 0 || u > 1) return 0;
  if (u <= 0.45) return (f.h * (1 - Math.cos((Math.PI * u) / 0.45))) / 2;
  if (u <= 0.55) return f.h;
  return (f.h * (1 + Math.cos((Math.PI * (u - 0.55)) / 0.45))) / 2;
};

// Interpolate a selected ramp's profile with smooth easing between control points.
const launchProfile = (f, x) => {
  const t = (x - (f.cx - f.hw)) / (2 * f.hw);
  if (t <= 0 || t >= 1) return 0;
  const model = RAMP_MODELS.find((m) => m.id === f.rampType) || RAMP_MODELS[0];
  const pts = model.points;
  let i = 0;
  while (i < pts.length - 2 && t > pts[i + 1][0]) i++;
  const [t0, y0] = pts[i];
  const [t1, y1] = pts[i + 1];
  const u = clamp((t - t0) / (t1 - t0), 0, 1);
  const eased = u * u * (3 - 2 * u);
  return y0 + (y1 - y0) * eased;
};

// Only the final rising section releases the truck from the ramp.
const onLaunchLip = (x) =>
  featuresNear(x).some((f) => {
    if (f.kind !== "launch") return false;
    const t = (x - (f.cx - f.hw)) / (2 * f.hw);
    const rising = launchProfile(f, Math.min(f.cx + f.hw, x + 8)) >
      launchProfile(f, Math.max(f.cx - f.hw, x - 8));
    return t > 0.78 && t < 0.99 && rising;
  });

const groundY = (x) => {
  let y = baseY(x);
  featuresNear(x).forEach((f) => {
    if (f.kind === "hill") {
      y += hillProfile(f, x);
      return;
    }
    if (f.kind === "launch") {
      y += launchProfile(f, x);
      return;
    }
    const b = bell(x - f.cx, f.hw);
    if (f.kind === "rock" || f.kind === "car") y += f.h * b;
    else y -= f.h * b;
  });
  return y;
};

const deckY = (f, x) => {
  const x0 = f.cx - f.hw;
  const x1 = f.cx + f.hw;
  const t = (x - x0) / (x1 - x0);
  return baseY(x0) + (baseY(x1) - baseY(x0)) * t - 14 * 4 * t * (1 - t);
};

const surfaceY = (x) => {
  let y = groundY(x);
  featuresNear(x).forEach((f) => {
    if (f.kind === "chasm" && Math.abs(x - f.cx) < f.hw) y = Math.max(y, deckY(f, x));
  });
  return y;
};

const zoneAt = (x) => {
  const z = { water: null, mud: false, bridge: false };
  featuresNear(x).forEach((f) => {
    if (Math.abs(x - f.cx) >= f.hw) return;
    if (f.kind === "pond") z.water = Math.min(baseY(f.cx - f.hw), baseY(f.cx + f.hw)) - 1;
    if (f.kind === "mud") z.mud = true;
    if (f.kind === "chasm") z.bridge = true;
  });
  return z;
};

const initialState = () => ({
  x: 0,
  alt: 0,
  vx: 0,
  vy: 0,
  wheel: 0,
  dist: 0,
  grounded: true,
  status: "",
  flip: 0, // extra rotation from flips in the air
  wheelie: 0, // nose-up angle on the ground
  stunts: 0,
  stuntMsg: "",
  stuntTimer: 0,
  susp: WHEEL_X.map(() => 0),
  suspV: WHEEL_X.map(() => 0),
  impact: 0,
  heat: 0, // engine heat 0-100
  phase: "none", // none | burning | fading | over
  phaseT: 0,
  fuel: 100, // fuel 0-100
  collected: {}, // fuel stations already used
  nitro: 100, // nitro boost 0-100
  wheelieRaw: 0, // how long WHEELIE has been held (drives the lift and the flip)
  lean: 0, // body lean from braking (forward) or nitro (back)
  flipLift: 0, // raises the truck while it lies on its roof
  lives: LIVES_START,
  checkpoint: 0, // last checkpoint reached (world x)
  coinSet: {}, // coins collected so far
  toolsGot: {}, // repair and boost tools collected
  boostLeft: 0, // boost distance left (world units, 1000 = 100 m)
  blastDist: 0, // distance driven with boost + nitro together
  debris: [], // tyres that came off in an explosion
});

// Puts the truck back on the road at its last checkpoint with fresh fuel, nitro and heat
function respawnTruck(g) {
  const cp = g.checkpoint;
  g.x = cp;
  g.alt = 0;
  g.vx = 0;
  g.vy = 0;
  g.wheelie = 0;
  g.wheelieRaw = 0;
  g.flip = 0;
  g.lean = 0;
  g.flipLift = 0;
  g.heat = 0;
  g.fuel = 100;
  g.nitro = 100;
  g.phase = "none";
  g.phaseT = 0;
  g.impact = 0;
  g.status = "";
  g.susp = WHEEL_X.map(() => 0);
  g.suspV = WHEEL_X.map(() => 0);
  g.flipDir = 0;
  g.debris = [];
  g.boostLeft = 0;
  g.blastDist = 0;
  g.stuntMsg = "▶ Continue from checkpoint";
  g.stuntTimer = 90;
}

// How far the truck must be raised so none of its body goes under the road while flipping
function flipLiftFor(g, tilt, k) {
  const px = WHEEL_X[0] * k;
  const a = -g.wheelie;
  const rot = (x, y, ang) => [x * Math.cos(ang) - y * Math.sin(ang), x * Math.sin(ang) + y * Math.cos(ang)];
  const pts = [];
  [-110, 90].forEach((x) => [-2, -60, -120, -190].forEach((y) => pts.push([x * k, y * k])));
  WHEEL_X.forEach((wx) => pts.push([wx * k, 0]));
  let maxY = 0;
  pts.forEach(([x, y]) => {
    const [qx, qy] = rot(x - px, y, a);
    const [rx, ry] = rot(qx + px, qy, tilt);
    if (ry > maxY) maxY = ry;
  });
  return maxY;
}

/* ---------- Drawing: tyres ---------- */
function drawWheel(ctx, wx, bottomY, wheelAngle, s) {
  const ry = WHEEL_R - s * 0.7;
  const rx = WHEEL_R + s * 0.5;
  const cy = -ry;

  ctx.save();
  ctx.translate(wx, bottomY);

  ctx.fillStyle = "#151515";
  ctx.beginPath();
  ctx.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#3a3a3a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, cy, rx - 4, ry - 4, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#070707";
  for (let i = 0; i < 14; i++) {
    const a = wheelAngle + (i * Math.PI * 2) / 14;
    ctx.save();
    ctx.translate(Math.cos(a) * (rx - 2), cy + Math.sin(a) * (ry - 2));
    ctx.rotate(a + Math.PI / 2);
    ctx.fillRect(-3, -2.5, 6, 5);
    ctx.restore();
  }

  const rimScale = ry / WHEEL_R;
  ctx.save();
  ctx.translate(0, cy);
  ctx.scale(rimScale, rimScale);
  ctx.fillStyle = "#c4c4c4";
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6f6f6f";
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e0e0e0";
  for (let i = 0; i < 5; i++) {
    const a = wheelAngle + (i * Math.PI * 2) / 5;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 5, Math.sin(a) * 5, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#333";
  ctx.beginPath();
  ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "rgba(190,160,115,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/* ---------- Drawing: truck ---------- */
function drawTruck(ctx, g, theme) {
  ctx.fillStyle = "#3e2f22";
  ctx.fillRect(-110, -CH, 200, 12);

  ctx.fillStyle = theme.body;
  ctx.fillRect(-106, -CH - 60, 116, 60);
  ctx.fillStyle = theme.light;
  ctx.fillRect(-106, -CH - 60, 116, 7);
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 2;
  for (let x = -96; x < 6; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, -CH - 52);
    ctx.lineTo(x, -CH - 4);
    ctx.stroke();
  }

  // ROAD WHEELS sticker
  ctx.save();
  ctx.translate(-48, -CH - 30);
  ctx.rotate(-0.05);
  ctx.fillStyle = "#fdd835";
  ctx.fillRect(-58, -14, 116, 28);
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 3;
  ctx.strokeRect(-58, -14, 116, 28);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  ctx.strokeRect(-54, -10, 108, 20);
  ctx.fillStyle = "#111";
  ctx.font = "bold 14px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ROAD WHEELS", 0, 1);
  [-47, 47].forEach((ix) => {
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(ix, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fdd835";
    ctx.beginPath();
    ctx.arc(ix, 0, 2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  // cab
  ctx.fillStyle = theme.cab;
  ctx.beginPath();
  ctx.moveTo(0, -CH);
  ctx.lineTo(0, -CH - 78);
  ctx.lineTo(24, -CH - 94);
  ctx.lineTo(66, -CH - 78);
  ctx.lineTo(84, -CH - 28);
  ctx.lineTo(90, -CH);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#212121";
  ctx.fillRect(0, -CH - 10, 90, 10);

  ctx.fillStyle = "#90caf9";
  ctx.beginPath();
  ctx.moveTo(30, -CH - 78);
  ctx.lineTo(62, -CH - 66);
  ctx.lineTo(72, -CH - 40);
  ctx.lineTo(30, -CH - 40);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#64b5f6";
  ctx.fillRect(4, -CH - 78, 20, 36);
  ctx.fillStyle = "#4e0000";
  ctx.fillRect(26, -CH - 40, 2, 30);
  ctx.fillStyle = "#212121";
  ctx.fillRect(66, -CH - 72, 4, 14);

  ctx.fillStyle = "#212121";
  ctx.fillRect(82, -CH - 34, 10, 26);
  ctx.fillStyle = "#cfd8dc";
  for (let i = 0; i < 4; i++) ctx.fillRect(82, -CH - 30 + i * 6, 10, 2);
  ctx.fillStyle = "#fff59d";
  ctx.fillRect(80, -CH - 52, 8, 8);
  ctx.fillStyle = "#37474f";
  ctx.fillRect(78, -CH + 2, 18, 10);

  ctx.fillStyle = "#424242";
  ctx.fillRect(-18, -CH - 128, 8, 56);
  ctx.fillStyle = "#616161";
  ctx.fillRect(-20, -CH - 130, 12, 4);

  // roll cage over the cab
  ctx.strokeStyle = "#212121";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(6, -CH - 80);
  ctx.lineTo(10, -CH - 110);
  ctx.lineTo(58, -CH - 104);
  ctx.lineTo(62, -CH - 76);
  ctx.moveTo(34, -CH - 98);
  ctx.lineTo(34, -CH - 82);
  ctx.stroke();

  // roof light bar
  ctx.fillStyle = "#37474f";
  ctx.fillRect(14, -CH - 116, 44, 6);
  ctx.fillStyle = "#fff59d";
  [18, 28, 38, 48].forEach((lx) => ctx.fillRect(lx, -CH - 116, 5, 4));

  // chunky bumper with number plate
  ctx.fillStyle = "#212121";
  ctx.fillRect(76, -CH - 4, 22, 10);
  ctx.fillStyle = "#ff6f00";
  ctx.fillRect(12, -CH - 14, 28, 10);

  ctx.fillStyle = "#2a2019";
  WHEEL_X.forEach((wx, i) => {
    const cy = -g.susp[i] - WHEEL_R;
    ctx.beginPath();
    ctx.arc(wx, cy, WHEEL_R + 5, Math.PI, 0);
    ctx.fill();
  });

  WHEEL_X.forEach((wx, i) => {
    const e = g.susp[i];
    const topY = -CH + 2;
    const botY = -e - 2 * WHEEL_R + 6;
    const len = botY - topY;
    ctx.fillStyle = "#37474f";
    ctx.fillRect(wx - 4, topY, 8, len * 0.55);
    ctx.fillStyle = "#b0bec5";
    ctx.fillRect(wx - 2, topY + len * 0.55, 4, len * 0.45);
    ctx.strokeStyle = "#ffca28";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(wx, topY);
    for (let j = 1; j <= 6; j++) ctx.lineTo(wx + (j % 2 ? 5 : -5), topY + (len * j) / 7);
    ctx.lineTo(wx, botY);
    ctx.stroke();
  });

  WHEEL_X.forEach((wx, i) => {
    const e = g.susp[i];
    const squash = clamp(Math.max(0, e) * 0.6 + g.impact * 0.5, 0, 8);
    drawWheel(ctx, wx, -e, g.wheel, squash);
  });
}

// Rounded rectangle path helper
function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Cartoon monster truck: rounded body, big googly eyes, smile, cyan trim, yellow springs
function drawTruckCartoon(ctx, g, theme) {
  // underframe
  ctx.fillStyle = "#263238";
  roundedRectPath(ctx, -108, -CH - 2, 206, 12, 5);
  ctx.fill();

  // rear body
  ctx.fillStyle = theme.body;
  roundedRectPath(ctx, -104, -CH - 46, 150, 46, 16);
  ctx.fill();

  // rounded front cab
  roundedRectPath(ctx, 14, -CH - 100, 84, 100, 34);
  ctx.fill();

  // shine bands
  ctx.fillStyle = theme.light;
  roundedRectPath(ctx, -96, -CH - 42, 130, 7, 4);
  ctx.fill();
  roundedRectPath(ctx, 30, -CH - 94, 40, 6, 3);
  ctx.fill();

  // cyan trim outlines
  ctx.strokeStyle = "#22d3ee";
  ctx.lineWidth = 4;
  roundedRectPath(ctx, -104, -CH - 46, 150, 46, 16);
  ctx.stroke();
  roundedRectPath(ctx, 14, -CH - 100, 84, 100, 34);
  ctx.stroke();

  // side window
  ctx.fillStyle = "#1e2a33";
  roundedRectPath(ctx, 22, -CH - 86, 34, 36, 12);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(28, -CH - 80, 8, 4);

  // chrome front bumper
  ctx.fillStyle = "#cfd8dc";
  roundedRectPath(ctx, 92, -CH - 40, 14, 30, 6);
  ctx.fill();

  // exhaust pipe at the back
  ctx.fillStyle = "#455a64";
  ctx.fillRect(-98, -CH - 62, 8, 18);

  // googly eyes on top of the cab
  [
    [54, -CH - 96],
    [86, -CH - 96],
  ].forEach(([ex, ey]) => {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ex, ey, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#1e88e5";
    ctx.beginPath();
    ctx.arc(ex + 3, ey + 2, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0d47a1";
    ctx.beginPath();
    ctx.arc(ex + 4, ey + 3, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ex - 1, ey - 3, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // smile with teeth
  ctx.fillStyle = "#5d0000";
  ctx.beginPath();
  ctx.arc(70, -CH - 58, 16, 0, Math.PI);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(60, -CH - 58, 20, 4);

  // ROAD WHEELS sticker on the body
  ctx.save();
  ctx.translate(-40, -CH - 22);
  ctx.rotate(-0.04);
  ctx.fillStyle = "#fdd835";
  ctx.fillRect(-52, -9, 104, 18);
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 2;
  ctx.strokeRect(-52, -9, 104, 18);
  ctx.fillStyle = "#111";
  ctx.font = "bold 11px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ROAD WHEELS", 0, 1);
  ctx.restore();

  // wheel arches
  ctx.fillStyle = "#1a1a1a";
  WHEEL_X.forEach((wx, i) => {
    const cy = -g.susp[i] - WHEEL_R;
    ctx.beginPath();
    ctx.arc(wx, cy, WHEEL_R + 5, Math.PI, 0);
    ctx.fill();
  });

  // yellow coil springs (suspension)
  WHEEL_X.forEach((wx, i) => {
    const e = g.susp[i];
    const topY = -CH + 2;
    const botY = -e - 2 * WHEEL_R + 6;
    const len = botY - topY;
    ctx.fillStyle = "#37474f";
    ctx.fillRect(wx - 4, topY, 8, len * 0.55);
    ctx.fillStyle = "#b0bec5";
    ctx.fillRect(wx - 2, topY + len * 0.55, 4, len * 0.45);
    ctx.strokeStyle = "#ffca28";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(wx, topY);
    for (let j = 1; j <= 6; j++) ctx.lineTo(wx + (j % 2 ? 5 : -5), topY + (len * j) / 7);
    ctx.lineTo(wx, botY);
    ctx.stroke();
  });

  // big tyres with chrome hubs
  WHEEL_X.forEach((wx, i) => {
    const e = g.susp[i];
    const squash = clamp(Math.max(0, e) * 0.6 + g.impact * 0.5, 0, 8);
    drawWheel(ctx, wx, -e, g.wheel, squash);
  });
}

// Upgraded monster truck: shaded two-tone body, windshield, headlights, grille,
// roof light bar, chrome exhausts, painted fenders, number decal, chunky tyres
function drawTruckPro(ctx, g, theme) {
  // chassis frame
  ctx.fillStyle = "#1c262b";
  roundedRectPath(ctx, -116, -CH - 4, 224, 14, 6);
  ctx.fill();

  // rear body with gradient shading
  const bodyGrad = ctx.createLinearGradient(0, -CH - 52, 0, -CH);
  bodyGrad.addColorStop(0, theme.light);
  bodyGrad.addColorStop(0.45, theme.body);
  bodyGrad.addColorStop(1, "#1a1a1a");
  ctx.fillStyle = bodyGrad;
  roundedRectPath(ctx, -108, -CH - 52, 152, 52, 14);
  ctx.fill();

  // front cab with gradient
  const cabGrad = ctx.createLinearGradient(0, -CH - 110, 0, -CH);
  cabGrad.addColorStop(0, theme.light);
  cabGrad.addColorStop(0.5, theme.cab);
  cabGrad.addColorStop(1, theme.body);
  ctx.fillStyle = cabGrad;
  roundedRectPath(ctx, 10, -CH - 104, 92, 104, 36);
  ctx.fill();

  // cyan accent stripe
  ctx.fillStyle = "#22d3ee";
  ctx.fillRect(-106, -CH - 22, 148, 3);
  ctx.fillRect(12, -CH - 30, 88, 3);

  // painted fenders over the tyres
  ctx.fillStyle = theme.body;
  WHEEL_X.forEach((wx, i) => {
    const cy = -g.susp[i] - WHEEL_R;
    ctx.beginPath();
    ctx.arc(wx, cy, WHEEL_R + 9, Math.PI, 0);
    ctx.fill();
  });
  ctx.fillStyle = "#151515";
  WHEEL_X.forEach((wx, i) => {
    const cy = -g.susp[i] - WHEEL_R;
    ctx.beginPath();
    ctx.arc(wx, cy, WHEEL_R + 4, Math.PI, 0);
    ctx.fill();
  });

  // windshield with reflection
  ctx.fillStyle = "#0f1c24";
  roundedRectPath(ctx, 24, -CH - 94, 60, 42, 14);
  ctx.fill();
  ctx.fillStyle = "rgba(180,230,255,0.35)";
  ctx.beginPath();
  ctx.moveTo(34, -CH - 88);
  ctx.lineTo(50, -CH - 88);
  ctx.lineTo(38, -CH - 62);
  ctx.lineTo(28, -CH - 62);
  ctx.closePath();
  ctx.fill();

  // grille and headlights
  ctx.fillStyle = "#263238";
  roundedRectPath(ctx, 84, -CH - 46, 24, 36, 6);
  ctx.fill();
  ctx.fillStyle = "#cfd8dc";
  for (let i = 0; i < 4; i++) ctx.fillRect(87, -CH - 42 + i * 8, 18, 2);
  ctx.fillStyle = "rgba(255,245,157,0.35)";
  ctx.beginPath();
  ctx.arc(100, -CH - 84, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff59d";
  roundedRectPath(ctx, 93, -CH - 88, 14, 10, 4);
  ctx.fill();

  // chrome front bumper
  ctx.fillStyle = "#b0bec5";
  roundedRectPath(ctx, 96, -CH - 16, 18, 10, 4);
  ctx.fill();

  // roof light bar
  ctx.fillStyle = "#263238";
  roundedRectPath(ctx, 26, -CH - 112, 58, 7, 3);
  ctx.fill();
  ctx.fillStyle = "#fff59d";
  [30, 42, 54, 66].forEach((lx) => ctx.fillRect(lx, -CH - 112, 6, 4));

  // chrome exhaust stacks on the back
  ctx.fillStyle = "#90a4ae";
  ctx.fillRect(-100, -CH - 92, 8, 42);
  ctx.fillRect(-88, -CH - 92, 8, 42);
  ctx.fillStyle = "#cfd8dc";
  ctx.fillRect(-102, -CH - 94, 12, 4);
  ctx.fillRect(-90, -CH - 94, 12, 4);

  // number decal
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-44, -CH - 26, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111111";
  ctx.font = "bold 15px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("77", -44, -CH - 25);

  // yellow coil springs
  WHEEL_X.forEach((wx, i) => {
    const e = g.susp[i];
    const topY = -CH + 2;
    const botY = -e - 2 * WHEEL_R + 6;
    const len = botY - topY;
    ctx.fillStyle = "#37474f";
    ctx.fillRect(wx - 4, topY, 8, len * 0.55);
    ctx.fillStyle = "#b0bec5";
    ctx.fillRect(wx - 2, topY + len * 0.55, 4, len * 0.45);
    ctx.strokeStyle = "#ffca28";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(wx, topY);
    for (let j = 1; j <= 6; j++) ctx.lineTo(wx + (j % 2 ? 5 : -5), topY + (len * j) / 7);
    ctx.lineTo(wx, botY);
    ctx.stroke();
  });

  // tyres with chrome rims
  WHEEL_X.forEach((wx, i) => {
    const e = g.susp[i];
    const squash = clamp(Math.max(0, e) * 0.6 + g.impact * 0.5, 0, 8);
    drawWheel(ctx, wx, -e, g.wheel, squash);
  });
}

// One tyre with rim, spokes, bolts and hub, drawn in artwork units
function drawSvgWheel(ctx, cx, cy, rot) {
  const P = (d) => new Path2D(d);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);

  // tyre
  const tireGrad = ctx.createRadialGradient(-60, -60, 20, 0, 0, 198);
  tireGrad.addColorStop(0, "#515151");
  tireGrad.addColorStop(0.4, "#171717");
  tireGrad.addColorStop(1, "#080808");
  ctx.beginPath();
  ctx.arc(0, 0, 198, 0, Math.PI * 2);
  ctx.fillStyle = tireGrad;
  ctx.fill();
  ctx.strokeStyle = "#050505";
  ctx.lineWidth = 12;
  ctx.stroke();

  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.arc(0, 0, 171, 0, Math.PI * 2);
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 9;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 155, 0, Math.PI * 2);
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 15;
  ctx.stroke();

  // tread blocks
  const tread = P("M-19 -183 L-25 -158 L-8 -143 L15 -143 L27 -163 L18 -183 Z");
  const treadLine = P("M-9 -178 L0 -151 L13 -164");
  for (let i = 0; i < 32; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 16);
    ctx.fillStyle = "#414141";
    ctx.strokeStyle = "#090909";
    ctx.lineWidth = 5;
    ctx.fill(tread);
    ctx.stroke(tread);
    ctx.strokeStyle = "#686868";
    ctx.lineWidth = 4;
    ctx.stroke(treadLine);
    ctx.restore();
  }

  // red rim
  const redGrad = ctx.createLinearGradient(0, -112, 0, 112);
  redGrad.addColorStop(0, "#ff6b5e");
  redGrad.addColorStop(0.5, "#e00000");
  redGrad.addColorStop(1, "#740000");
  ctx.beginPath();
  ctx.arc(0, 0, 112, 0, Math.PI * 2);
  ctx.fillStyle = redGrad;
  ctx.fill();
  ctx.strokeStyle = "#090909";
  ctx.lineWidth = 9;
  ctx.stroke();

  // inner rim
  const rimGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 91);
  rimGrad.addColorStop(0, "#858585");
  rimGrad.addColorStop(0.35, "#292929");
  rimGrad.addColorStop(1, "#090909");
  ctx.beginPath();
  ctx.arc(0, 0, 91, 0, Math.PI * 2);
  ctx.fillStyle = rimGrad;
  ctx.fill();
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 9;
  ctx.stroke();

  // spokes
  const spoke = P("M-10 -55 L-17 -86 L17 -86 L10 -55 Z");
  for (let i = 0; i < 10; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 5);
    ctx.fillStyle = "#777";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 4;
    ctx.fill(spoke);
    ctx.stroke(spoke);
    ctx.restore();
  }

  // bolts
  for (let i = 0; i < 20; i++) {
    const a = (i * Math.PI) / 10;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 101, Math.sin(a) * 101, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#d1d1d1";
    ctx.fill();
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // hub
  ctx.beginPath();
  ctx.arc(0, 0, 35, 0, Math.PI * 2);
  ctx.fillStyle = "#444";
  ctx.fill();
  ctx.strokeStyle = "#050505";
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, Math.PI * 2);
  ctx.fillStyle = "#777";
  ctx.fill();
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.restore();
}

// The two-wheel monster truck artwork, drawn in its own coordinates and scaled to the game
function drawTruckSvg(ctx, g, theme) {
  const P = (d) => new Path2D(d);
  ctx.save();
  ctx.scale(SVG_S, SVG_S);
  ctx.translate(-SVG_CX, -SVG_GROUND);
  ctx.scale(-1, 1); // flipped to the other side
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // chassis
  const chassisGrad = ctx.createLinearGradient(275, 440, 1390, 580);
  chassisGrad.addColorStop(0, "#858b91");
  chassisGrad.addColorStop(0.4, "#292d32");
  chassisGrad.addColorStop(1, "#080a0d");
  const chassis = P("M330 440 L1320 440 L1390 535 L275 535 Z");
  ctx.fillStyle = chassisGrad;
  ctx.fill(chassis);
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 20;
  ctx.stroke(chassis);
  ctx.stroke(P("M450 470 L360 580 L580 580 L720 470"));
  ctx.stroke(P("M1170 470 L1070 580 L1320 580 L1390 470"));

  // suspension arms
  ctx.strokeStyle = "#858585";
  ctx.lineWidth = 13;
  [
    "M290 455 L420 620 L520 455",
    "M1130 455 L1235 620 L1350 455",
    "M280 515 L530 640",
    "M1110 640 L1370 515",
  ].forEach((d) => ctx.stroke(P(d)));

  // shock absorbers with red coils
  [365, 425, 1190, 1260].forEach((x) => {
    const box = P(`M${x - 10} 335 H${x + 11} V490 H${x - 10} Z`);
    ctx.fillStyle = "#171717";
    ctx.fill(box);
    ctx.strokeStyle = "#777";
    ctx.lineWidth = 4;
    ctx.stroke(box);
    ctx.strokeStyle = "#ed1717";
    ctx.lineWidth = 8;
    ctx.stroke(P(`M${x} 345 l-15 12 30 12 -30 12 30 12 -30 12 30 12 -30 12 30 12 -15 12`));
  });

  // main body (paint colour follows the chosen theme)
  const bodyGrad = ctx.createLinearGradient(0, 85, 0, 420);
  bodyGrad.addColorStop(0, theme.light);
  bodyGrad.addColorStop(0.35, theme.body);
  bodyGrad.addColorStop(0.75, "#1a1a1a");
  bodyGrad.addColorStop(1, "#050505");
  const body = P("M105 405 L125 325 Q135 290 195 275 L545 245 L645 125 Q670 85 730 85 L930 85 Q1000 85 1035 145 L1090 260 L1480 265 L1515 310 L1515 420 L105 420 Z");
  ctx.fillStyle = bodyGrad;
  ctx.fill(body);
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 17;
  ctx.stroke(body);

  // hood
  const hood = P("M135 320 L180 285 L545 255 L615 280 L590 405 L125 405 Z");
  ctx.fillStyle = theme.cab;
  ctx.fill(hood);
  ctx.strokeStyle = "#650000";
  ctx.lineWidth = 8;
  ctx.stroke(hood);

  // truck bed
  const bed = P("M1070 275 L1485 280 L1495 400 L1085 400 Z");
  ctx.fillStyle = "#18191b";
  ctx.fill(bed);
  ctx.strokeStyle = "#080808";
  ctx.lineWidth = 8;
  ctx.stroke(bed);

  // flame graphics
  const flame = ctx.createLinearGradient(100, 0, 1500, 0);
  flame.addColorStop(0, "#ff2525");
  flame.addColorStop(0.55, "#ff8a00");
  flame.addColorStop(1, "#ffec45");
  ctx.fillStyle = flame;
  ctx.fill(P("M170 320 Q310 260 440 285 Q540 305 620 250 Q550 330 450 340 Q330 330 220 385 Q350 365 470 390 Q610 400 700 330 Q630 410 520 430 L100 440 Z"));
  ctx.fill(P("M650 285 Q780 235 870 280 Q970 315 1100 250 Q1060 320 960 345 Q1080 350 1210 290 Q1360 240 1490 275 L1500 360 Q1360 320 1260 370 Q1130 420 970 375 Q850 350 740 395 Z"));

  // windows
  const glass = ctx.createLinearGradient(570, 100, 1050, 270);
  glass.addColorStop(0, "#a8c6d8");
  glass.addColorStop(0.4, "#263d50");
  glass.addColorStop(1, "#050c15");
  const win1 = P("M570 245 L660 130 Q685 100 730 100 L815 100 L815 260 L590 275 Z");
  const win2 = P("M830 100 L930 100 Q980 100 1005 150 L1050 270 L830 260 Z");
  ctx.fillStyle = glass;
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 12;
  [win1, win2].forEach((w) => {
    ctx.fill(w);
    ctx.stroke(w);
  });
  ctx.fillStyle = "rgba(211,233,250,0.15)";
  ctx.fill(P("M690 125 L780 108 L705 245 L620 250 Z"));
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fill(P("M850 112 L915 112 L975 235 L925 235 Z"));
  ctx.strokeStyle = "#151515";
  ctx.lineWidth = 15;
  ctx.stroke(P("M820 95 L820 265"));

  // door lines and handle
  ctx.strokeStyle = "#650000";
  ctx.lineWidth = 7;
  ctx.stroke(P("M580 270 L580 405 M830 265 L830 405"));
  ctx.fillStyle = "#171717";
  ctx.strokeStyle = "#777";
  ctx.lineWidth = 3;
  ctx.fillRect(735, 292, 65, 13);
  ctx.strokeRect(735, 292, 65, 13);

  // side mirror
  const metalGrad = ctx.createLinearGradient(275, 440, 1390, 580);
  metalGrad.addColorStop(0, "#858b91");
  metalGrad.addColorStop(0.4, "#292d32");
  metalGrad.addColorStop(1, "#080a0d");
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 10;
  ctx.stroke(P("M555 190 L525 170"));
  ctx.fillStyle = metalGrad;
  ctx.lineWidth = 7;
  ctx.fillRect(510, 155, 60, 48);
  ctx.strokeRect(510, 155, 60, 48);

  // roof and roll cage
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 16;
  ctx.stroke(P("M650 92 L1010 92"));
  ctx.lineWidth = 19;
  ctx.stroke(P("M1010 115 Q1080 115 1100 210 L1100 265"));
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 9;
  ctx.stroke(P("M1030 145 L1115 265"));

  // roof light bar
  ctx.fillStyle = "#171717";
  ctx.strokeStyle = "#050505";
  ctx.lineWidth = 8;
  ctx.fillRect(680, 30, 250, 65);
  ctx.strokeRect(680, 30, 250, 65);
  [710, 765, 820, 875].forEach((x) => {
    ctx.beginPath();
    ctx.arc(x, 62, 23, 0, Math.PI * 2);
    ctx.fillStyle = "#ffae28";
    ctx.fill();
    ctx.strokeStyle = "#aaa";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, 62, 14, 0, Math.PI * 2);
    ctx.fillStyle = "#fff3ae";
    ctx.fill();
  });

  // grille and headlights
  ctx.fillStyle = "#151515";
  ctx.strokeStyle = "#050505";
  ctx.lineWidth = 10;
  ctx.fillRect(105, 320, 105, 82);
  ctx.strokeRect(105, 320, 105, 82);
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 5;
  [340, 355, 370, 385].forEach((y) => ctx.stroke(P(`M115 ${y} L200 ${y}`)));
  ctx.fillStyle = "#eee";
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 8;
  ctx.fillRect(215, 295, 85, 55);
  ctx.strokeRect(215, 295, 85, 55);
  ctx.fillStyle = "#fff";
  ctx.fillRect(225, 305, 65, 15);
  ctx.fillStyle = "#cbd9e3";
  ctx.fillRect(225, 325, 65, 15);

  // front bumper
  const bumper = P("M100 390 L300 390 L310 435 L95 435 Z");
  ctx.fillStyle = metalGrad;
  ctx.strokeStyle = "#050505";
  ctx.lineWidth = 12;
  ctx.fill(bumper);
  ctx.stroke(bumper);

  // rear lights
  ctx.fillStyle = "#151515";
  ctx.strokeStyle = "#080808";
  ctx.lineWidth = 7;
  ctx.fillRect(1460, 290, 45, 100);
  ctx.strokeRect(1460, 290, 45, 100);
  ctx.fillStyle = "#fa1717";
  ctx.fillRect(1468, 302, 28, 32);
  ctx.fillStyle = "#ffb32c";
  ctx.fillRect(1468, 340, 28, 17);
  ctx.fillStyle = "#c80000";
  ctx.fillRect(1468, 363, 28, 18);

  // branding (un-mirrored so the text reads normally)
  ctx.save();
  ctx.translate(845, 0);
  ctx.scale(-1, 1);
  ctx.translate(-845, 0);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 2;
  ctx.font = "italic 900 70px Arial, sans-serif";
  ctx.fillStyle = "#fff";
  ctx.strokeText("MONSTER", 845, 345);
  ctx.fillText("MONSTER", 845, 345);
  ctx.font = "italic 900 49px Arial, sans-serif";
  ctx.fillStyle = "#ffcf00";
  ctx.strokeText("TRUCK", 845, 395);
  ctx.fillText("TRUCK", 845, 395);
  ctx.restore();

  // wheels: each one moves with its own suspension
  SVG_WHEELS.forEach((wx, i) => {
    const cy = SVG_WHEEL_Y - g.susp[i] / SVG_S;
    drawSvgWheel(ctx, wx, cy, -g.wheel); // mirrored, so the spin direction is reversed
  });

  // wheel arch trim
  ctx.strokeStyle = "#141414";
  ctx.lineWidth = 22;
  ctx.stroke(P("M185 470 A205 205 0 0 1 595 470"));
  ctx.stroke(P("M1035 470 A205 205 0 0 1 1445 470"));

  // body bolts
  ctx.fillStyle = "#aaa";
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 4;
  [210, 255, 300, 345, 390, 435, 480, 525, 1080, 1130, 1180, 1230, 1280, 1330, 1380].forEach((x) => {
    ctx.beginPath();
    ctx.arc(x, 425, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  ctx.restore();
}

// One tyre of the new design, in artwork units
function drawDesignWheel(ctx, cx, cy, rot, d) {
  const P = (s) => new Path2D(s);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);

  const tireGrad = ctx.createLinearGradient(-125, -125, 125, 125);
  tireGrad.addColorStop(0, "#555");
  tireGrad.addColorStop(0.45, "#151515");
  tireGrad.addColorStop(1, "#050505");
  ctx.beginPath();
  ctx.arc(0, 0, 125, 0, Math.PI * 2);
  ctx.fillStyle = tireGrad;
  ctx.fill();
  ctx.strokeStyle = "#050505";
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 105, 0, Math.PI * 2);
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 8;
  ctx.stroke();

  // tread blocks
  const tread = P("M-15 -119 L-21 -98 L-7 -87 L12 -87 L21 -101 L14 -119 Z");
  const treadLine = P("M-7 -115 L0 -95 L12 -104");
  for (let i = 0; i < 24; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 12);
    ctx.fillStyle = "#444";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 4;
    ctx.fill(tread);
    ctx.stroke(tread);
    ctx.strokeStyle = "#777";
    ctx.lineWidth = 3;
    ctx.stroke(treadLine);
    ctx.restore();
  }

  // coloured rim
  ctx.beginPath();
  ctx.arc(0, 0, 76, 0, Math.PI * 2);
  ctx.fillStyle = d.rim;
  ctx.fill();
  ctx.strokeStyle = "#080808";
  ctx.lineWidth = 8;
  ctx.stroke();

  // inner wheel
  const innerGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 62);
  innerGrad.addColorStop(0, "#888");
  innerGrad.addColorStop(0.4, "#222");
  innerGrad.addColorStop(1, "#050505");
  ctx.beginPath();
  ctx.arc(0, 0, 62, 0, Math.PI * 2);
  ctx.fillStyle = innerGrad;
  ctx.fill();
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 7;
  ctx.stroke();

  // spokes
  const spoke = P("M-8 -37 L-14 -56 L14 -56 L8 -37 Z");
  for (let i = 0; i < 10; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 5);
    ctx.fillStyle = "#999";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 3;
    ctx.fill(spoke);
    ctx.stroke(spoke);
    ctx.restore();
  }

  // bolts
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI * 2) / 16;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 69, Math.sin(a) * 69, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#ddd";
    ctx.fill();
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // hub
  ctx.beginPath();
  ctx.arc(0, 0, 25, 0, Math.PI * 2);
  ctx.fillStyle = "#444";
  ctx.fill();
  ctx.strokeStyle = "#999";
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fillStyle = "#aaa";
  ctx.fill();
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.restore();
}

// The new monster truck designs (Blue Thunder / Toxic Beast / Desert Crusher), drawn from the artwork
function drawTruckDesign(ctx, g, d) {
  const P = (s) => new Path2D(s);
  ctx.save();
  ctx.scale(SVG_S, SVG_S);
  ctx.translate(-SVG_CX, -SVG_GROUND);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // chassis
  const metal = ctx.createLinearGradient(160, 380, 1040, 470);
  metal.addColorStop(0, "#aaa");
  metal.addColorStop(0.4, "#292929");
  metal.addColorStop(1, "#080808");
  const chassis = P("M180 380 L1000 380 L1040 470 L160 470 Z");
  ctx.fillStyle = metal;
  ctx.fill(chassis);
  ctx.strokeStyle = "#080808";
  ctx.lineWidth = 16;
  ctx.stroke(chassis);

  // suspension arms
  ctx.strokeStyle = "#777";
  ctx.lineWidth = 12;
  [
    "M250 390 L300 510 L410 390",
    "M790 390 L865 510 L980 390",
    "M200 450 L400 530",
    "M780 530 L1030 450",
  ].forEach((s) => ctx.stroke(P(s)));

  // shock absorbers
  [255, 345, 815, 915].forEach((x) => {
    const box = P(`M${x} 330 H${x + 17} V445 H${x} Z`);
    ctx.fillStyle = "#171717";
    ctx.fill(box);
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 3;
    ctx.stroke(box);
    ctx.strokeStyle = d.primary;
    ctx.lineWidth = 7;
    ctx.stroke(P(`M${x + 8} 338 l-12 10 24 10 -24 10 24 10 -24 10 24 10 -12 10`));
  });

  // main body
  const bodyGrad = ctx.createLinearGradient(0, 85, 0, 400);
  bodyGrad.addColorStop(0, d.secondary);
  bodyGrad.addColorStop(0.35, d.primary);
  bodyGrad.addColorStop(1, d.dark);
  const body = P(
    "M90 370 L100 300 Q110 260 165 250 L450 245 L520 130 Q545 85 610 85 L780 85 Q840 85 875 145 L925 250 L1060 260 Q1100 265 1110 315 L1110 400 L90 400 Z"
  );
  ctx.fillStyle = bodyGrad;
  ctx.fill(body);
  ctx.strokeStyle = "#090909";
  ctx.lineWidth = 13;
  ctx.stroke(body);

  // rear panel
  const rear = P("M100 300 L450 260 L440 400 L95 400 Z");
  ctx.fillStyle = d.dark;
  ctx.fill(rear);
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 7;
  ctx.stroke(rear);

  // front hood
  const hood = P("M925 260 L1080 275 L1100 340 L1080 400 L900 400 Z");
  ctx.fillStyle = d.primary;
  ctx.fill(hood);
  ctx.strokeStyle = d.dark;
  ctx.lineWidth = 7;
  ctx.stroke(hood);

  // flame decals
  const flameGrad = ctx.createLinearGradient(110, 0, 550, 0);
  flameGrad.addColorStop(0, d.primary);
  flameGrad.addColorStop(1, d.flame);
  ctx.fillStyle = flameGrad;
  ctx.fill(
    P(
      "M110 305 Q240 255 330 285 Q400 300 480 240 Q440 315 360 320 Q480 340 550 275 Q510 365 400 370 Q250 345 110 385 Z"
    )
  );
  ctx.fillStyle = d.dark;
  ctx.fill(
    P(
      "M650 300 Q750 240 840 285 Q900 315 990 260 Q950 330 870 350 Q950 370 1050 320 L1090 355 Q970 400 870 370 Q750 340 650 385 Z"
    )
  );
  ctx.strokeStyle = d.secondary;
  ctx.lineWidth = 12;
  ctx.stroke(P("M600 325 Q760 260 860 300 Q950 330 1050 285"));

  // cabin glass
  const glass = ctx.createLinearGradient(475, 105, 890, 260);
  glass.addColorStop(0, "#b9e9ff");
  glass.addColorStop(0.35, "#35536b");
  glass.addColorStop(1, "#050b13");
  const glass1 = P("M475 245 L540 135 Q560 105 610 105 L680 105 L680 255 Z");
  const glass2 = P("M695 105 L775 105 Q820 105 845 155 L890 260 L695 255 Z");
  ctx.fillStyle = glass;
  ctx.strokeStyle = "#090909";
  ctx.lineWidth = 12;
  [glass1, glass2].forEach((gp) => {
    ctx.fill(gp);
    ctx.stroke(gp);
  });
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fill(P("M560 125 L640 115 L570 230 L520 235 Z"));
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fill(P("M720 115 L765 115 L820 225 L780 225 Z"));
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 13;
  ctx.stroke(P("M690 95 L690 265"));

  // doors and handle
  ctx.strokeStyle = d.dark;
  ctx.lineWidth = 6;
  ctx.stroke(P("M475 260 L475 395 M695 260 L695 395"));
  ctx.fillStyle = "#111";
  ctx.strokeStyle = "#aaa";
  ctx.lineWidth = 2;
  ctx.fillRect(560, 290, 55, 12);
  ctx.strokeRect(560, 290, 55, 12);

  // side mirror
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 10;
  ctx.stroke(P("M475 175 L450 155"));
  ctx.fillStyle = metal;
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 6;
  ctx.fillRect(420, 140, 55, 42);
  ctx.strokeRect(420, 140, 55, 42);

  // roll cage
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 17;
  ctx.stroke(P("M850 120 Q920 115 945 220 L945 265"));
  ctx.strokeStyle = "#777";
  ctx.lineWidth = 8;
  ctx.stroke(P("M875 145 L950 260"));

  // roof lights
  ctx.fillStyle = "#111";
  ctx.strokeStyle = "#050505";
  ctx.lineWidth = 7;
  ctx.fillRect(530, 25, 220, 65);
  ctx.strokeRect(530, 25, 220, 65);
  [560, 610, 660, 710].forEach((x) => {
    ctx.beginPath();
    ctx.arc(x, 57, 22, 0, Math.PI * 2);
    ctx.fillStyle = "#ffae22";
    ctx.fill();
    ctx.strokeStyle = "#aaa";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, 57, 12, 0, Math.PI * 2);
    ctx.fillStyle = "#fff2b0";
    ctx.fill();
  });

  // grille and headlights (front is on the right)
  ctx.fillStyle = "#101010";
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 6;
  ctx.fillRect(1055, 315, 48, 70);
  ctx.strokeRect(1055, 315, 48, 70);
  ctx.strokeStyle = "#777";
  ctx.lineWidth = 4;
  [330, 345, 360, 375].forEach((y) => ctx.stroke(P(`M1060 ${y} L1098 ${y}`)));
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 7;
  ctx.fillRect(1000, 270, 65, 42);
  ctx.strokeRect(1000, 270, 65, 42);
  ctx.fillStyle = "#e9f9ff";
  ctx.fillRect(1007, 278, 51, 12);

  // front bumper
  const bumper = P("M1025 395 L1135 395 L1150 435 L1015 435 Z");
  ctx.fillStyle = metal;
  ctx.strokeStyle = "#050505";
  ctx.lineWidth = 10;
  ctx.fill(bumper);
  ctx.stroke(bumper);

  // rear light
  ctx.fillStyle = "#111";
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 5;
  ctx.fillRect(90, 285, 30, 95);
  ctx.strokeRect(90, 285, 30, 95);
  ctx.fillStyle = "#ed1717";
  ctx.fillRect(95, 295, 20, 28);
  ctx.fillStyle = "#ffb52e";
  ctx.fillRect(95, 330, 20, 17);

  // branding (drawn un-mirrored and readable)
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = "italic 900 43px Arial, sans-serif";
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 2;
  ctx.fillStyle = d.accent;
  ctx.strokeText(d.name || "", 760, 335);
  ctx.fillText(d.name || "", 760, 335);
  ctx.font = "italic 900 25px Arial, sans-serif";
  ctx.fillStyle = d.secondary;
  ctx.fillText("4X4 OFF ROAD", 760, 375);

  // wheels: each one moves with its own suspension
  SVG_WHEELS.forEach((wx, i) => {
    const cy = SVG_WHEEL_Y - g.susp[i] / SVG_S;
    drawDesignWheel(ctx, wx, cy, g.wheel, d);
  });

  // wheel arch accents
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 16;
  ctx.stroke(P("M170 390 A130 130 0 0 1 430 390"));
  ctx.stroke(P("M735 390 A130 130 0 0 1 995 390"));

  // body bolts
  ctx.fillStyle = "#bbb";
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 3;
  [150, 190, 230, 270, 330, 370, 410, 950, 990, 1030].forEach((x) => {
    ctx.beginPath();
    ctx.arc(x, 405, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  ctx.restore();
}

/* ---------- Drawing: scenery ---------- */
function drawCrashedCar(ctx) {
  ctx.fillStyle = "#5b4a3a";
  ctx.fillRect(-68, -14, 136, 12);
  ctx.beginPath();
  ctx.moveTo(-44, -14);
  ctx.lineTo(-30, -24);
  ctx.lineTo(18, -22);
  ctx.lineTo(40, -14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#24191d";
  ctx.beginPath();
  ctx.moveTo(-38, -15);
  ctx.lineTo(-28, -21);
  ctx.lineTo(14, -20);
  ctx.lineTo(34, -15);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#2f241b";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-10, -12);
  ctx.lineTo(6, -7);
  ctx.moveTo(-54, -8);
  ctx.lineTo(-40, -5);
  ctx.stroke();
  ctx.fillStyle = "rgba(160,120,80,0.6)";
  [[-50, -10], [0, -5], [44, -9]].forEach(([x, y]) => ctx.fillRect(x, y, 7, 4));
  [-54, 50].forEach((wx) => {
    ctx.fillStyle = "#1c1c1c";
    ctx.beginPath();
    ctx.ellipse(wx, -3, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

/* ---------- Engine sound (Web Audio API) ---------- */
const ensureAudio = (ref) => {
  if (!ref.current) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      const filt = ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 300;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(filt);
      filt.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      ref.current = { ctx, osc, filt, gain };
    } catch (e) {
      ref.current = null;
    }
  }
  if (ref.current && ref.current.ctx.state === "suspended") ref.current.ctx.resume();
};

const updateEngine = (ref, speed, volume, on) => {
  if (!ref.current) return;
  const { ctx, osc, filt, gain } = ref.current;
  const t = ctx.currentTime;
  osc.frequency.setTargetAtTime(55 + Math.abs(speed) * 14, t, 0.1);
  filt.frequency.setTargetAtTime(300 + Math.abs(speed) * 60, t, 0.1);
  gain.gain.setTargetAtTime(on ? (volume / 100) * 0.06 : 0, t, 0.1);
};

// Vector icons, so they are always perfectly centred
const PlayGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" style={{ display: "block" }}>
    <path d="M5 2.5 L15.5 9 L5 15.5 Z" fill="currentColor" />
  </svg>
);
const PauseGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" style={{ display: "block" }}>
    <rect x="3.5" y="2.5" width="4" height="13" rx="1" fill="currentColor" />
    <rect x="10.5" y="2.5" width="4" height="13" rx="1" fill="currentColor" />
  </svg>
);
const RestartGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" style={{ display: "block" }}>
    <path d="M14.5 9 A5.5 5.5 0 1 1 12.9 5.1" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M13.2 1.8 L13.2 5.6 L9.4 5.6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ExitGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" style={{ display: "block" }}>
    <path d="M3 3 L13 13 M13 3 L3 13" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

// Round icon button (play / pause)
const iconRoundStyle = {
  width: 48,
  height: 48,
  borderRadius: 24,
  border: "2px solid rgba(255,255,255,0.8)",
  background: "linear-gradient(135deg, #ff9800, #e65100)",
  color: "#fff",
  fontSize: 20,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
  cursor: "pointer",
  zIndex: 5,
};

// Toggle segment (restart / exit) inside a pill
const toggleSegStyle = (active) => ({
  width: 48,
  height: 40,
  borderRadius: 20,
  border: "none",
  background: active ? "linear-gradient(135deg, #ffd54f, #ff8f00)" : "transparent",
  color: active ? "#3e2723" : "#fff",
  fontSize: 20,
  fontWeight: 900,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "background 0.25s ease, color 0.25s ease",
});

// Carousel arrow button
const arrowBtnStyle = (disabled) => ({
  width: 44,
  height: 44,
  borderRadius: 22,
  border: "2px solid #fff",
  fontSize: 18,
  fontWeight: 900,
  color: "#fff",
  background: "linear-gradient(135deg, #ffb300, #e65100)",
  opacity: disabled ? 0.35 : 1,
  cursor: disabled ? "default" : "pointer",
});

// Small live preview of a truck design (uses the same artwork as the game)
function TruckPreview({ design, width, height }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr;
    c.height = height * dpr;
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width * 0.5, height - 6);
    ctx.scale(width / 330, width / 330);
    drawTruckDesign(ctx, { susp: [0, 0], suspV: [0, 0], wheel: 0, impact: 0 }, design);
    ctx.restore();
  }, [design, width, height]);
  return <canvas ref={ref} style={{ width, height, display: "block" }} />;
}

/* ---------- Shared button look for the top bar ---------- */
const topBtnStyle = {
  width: 130,
  height: 42,
  borderRadius: 21,
  border: "2px solid rgba(255,255,255,0.7)",
  background: "linear-gradient(135deg, #ff9800, #e65100)",
  color: "#fff",
  fontSize: 14,
  fontWeight: 800,
  letterSpacing: 0.5,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
  cursor: "pointer",
  zIndex: 5,
};

/* ---------- Component ---------- */
const POPUP_CSS = `
@keyframes mtFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes mtPop {
  0% { transform: scale(0.5) translateY(40px); opacity: 0; }
  70% { transform: scale(1.04) translateY(-4px); opacity: 1; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}
@keyframes mtBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
@keyframes mtGlow {
  0%, 100% { box-shadow: 0 0 14px rgba(255,152,0,0.5), 0 6px 16px rgba(0,0,0,0.35); }
  50% { box-shadow: 0 0 34px rgba(255,152,0,0.95), 0 6px 16px rgba(0,0,0,0.35); }
}
@keyframes mtFadeOut { from { opacity: 0; } to { opacity: 1; } }
@keyframes mtShine { from { background-position: 0% center; } to { background-position: 200% center; } }
@keyframes mtBorder {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
.mt-btn { transition: transform 0.15s ease, filter 0.15s ease; }
.mt-btn:hover { transform: scale(1.07); filter: brightness(1.1); }
.mt-btn:active { transform: scale(0.96); }
.mt-swatch { transition: transform 0.15s ease, box-shadow 0.15s ease; }
.mt-swatch:hover { transform: scale(1.2); }
.mt-title {
  background: linear-gradient(90deg, #ff9800, #ffeb3b, #ff5722, #ffeb3b, #ff9800);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: mtShine 3s linear infinite;
}
.mt-slider { accent-color: #ff6f00; cursor: pointer; }
`;

// Rows shown in the control guide popup
// Icons shown on small screens instead of the control names
const GUIDE_ICONS = {
  Move: "◀ ▶",
  Jump: "⬆",
  Wheelie: "🌀",
  Flip: "🔄",
  Nitro: "🚀",
  Brake: "◀",
  Hill: "⛰️",
  Coins: "$",
  Lives: "❤️",
  "Engine heat": "🔥",
  Fuel: "⛽",
};

const GUIDE = [
  { key: "◀ ▶", name: "Move", keys: "← → / A D", desc: "Drive forward or reverse. Keyboard: ← → or A D" },
  { key: "JUMP", name: "Jump", keys: "Space / W / ↑", desc: "Jump, and fly off the ramp lips. Keyboard: Space / W" },
  { key: "🌀 WHEELIE", name: "Wheelie", keys: "G", desc: "Lift the front on the ground. Keyboard: G" },
  { key: "🔄 FLIP", name: "Flip", keys: "F", desc: "Flip the truck in the air. Land it to score a stunt. Keyboard: F" },
  {
    key: "🚀 NITRO",
    name: "Nitro",
    keys: "N",
    desc: "Hold while driving forward for a big speed boost, with a small wheelie. The bar empties and refills when released. Keyboard: N",
  },
  {
    key: "◀ BRAKE",
    name: "Brake",
    keys: "← / A while fast",
    desc: "Hold ◀ while driving fast: the truck skids and dips forward (G-force)",
  },
  {
    key: "🚀 RAMP",
    name: "Hill",
    desc: "Different stunt ramps appear along the course. Build speed, hit the striped kicker and fly for coins and flips",
  },
  { key: "🪙 COINS", name: "Coins", desc: "The 3000 m course has 90 coins. Collect at least 35 or you cannot finish" },
  { key: "❤️ LIVES", name: "Lives", desc: "3 lives. A flip, running out of fuel or an engine fire costs a life. You continue from the last checkpoint" },
  { key: "🔥 HEAT", name: "Engine heat", desc: "Heats up while driving and doing stunts. At 100% the engine catches fire" },
  { key: "⛽ FUEL", name: "Fuel", desc: "100% fuel lasts 400 m. Refill at a fuel station every 300 m" },
];

export default function MonsterTruckGame() {
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1000);
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const compact = vw < 700; // small screens: smaller controls, fonts and popups
  const cs = compact ? 0.72 : 1;
  const panelW = compact ? 290 : 380; // every popup has the same size
  const panelH = compact ? 340 : 400;
  const canvasRef = useRef(null);
  const game = useRef(initialState());
  const dust = useRef([]);
  const input = useRef({ fwd: false, back: false, jumpQueued: false, flipHeld: false, wheelieHeld: false, nitroHeld: false });
  const lastHud = useRef({ d: -1, h: -1, s: "", n: 0 });
  const [distance, setDistance] = useState(0);
  const [height, setHeight] = useState(0);
  const [status, setStatus] = useState("");
  const [stunts, setStunts] = useState(0);
  const [screen, setScreen] = useState("menu"); // menu | playing | paused
  const [volume, setVolume] = useState(70);
  const [colorIdx, setColorIdx] = useState(0);
  const screenRef = useRef("menu");
  const volumeRef = useRef(70);
  const themeRef = useRef(THEMES[0]);
  const audioRef = useRef(null);
  const fx = useRef([]); // smoke and fire particles
  const [heat, setHeat] = useState(0);
  const [fuel, setFuel] = useState(100);
  const [best, setBest] = useState(0);
  const [round, setRound] = useState(1);
  const [unlocked, setUnlocked] = useState(MAPS.map(() => 1)); // highest unlocked round per map
  const [wins, setWins] = useState({}); // "mapIndex-round" -> true when won
  const [lives, setLives] = useState(LIVES_START);
  const [coins, setCoins] = useState(0);
  const [nitro, setNitro] = useState(100);
  const [mapIdx, setMapIdx] = useState(0);
  const [topSide, setTopSide] = useState("restart"); // which side of the restart/exit toggle is active
  const mapRef = useRef(MAPS[0]);
  useEffect(() => {
    mapRef.current = MAPS[mapIdx];
  }, [mapIdx]);
  const [overPhase, setOverPhase] = useState("none");
  useEffect(() => {
    if (overPhase !== "none") setBest((b) => Math.max(b, distance));
  }, [overPhase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (overPhase === "finished" && coins >= COIN_PASS) {
      setWins((w) => ({ ...w, [`${mapIdx}-${round}`]: true }));
      setUnlocked((u) => u.map((v, i) => (i === mapIdx ? Math.min(ROUNDS, Math.max(v, round + 1)) : v)));
    }
  }, [overPhase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);
  useEffect(() => {
    themeRef.current = THEMES[colorIdx];
  }, [colorIdx]);

  // Keyboard controls (desktop testing)
  useEffect(() => {
    const down = (e) => {
      if (e.code === "ArrowRight" || e.code === "KeyD") input.current.fwd = true;
      if (e.code === "ArrowLeft" || e.code === "KeyA") input.current.back = true;
      if (e.code === "KeyF") input.current.flipHeld = true;
      if (e.code === "KeyG") input.current.wheelieHeld = true;
      if (e.code === "KeyN") input.current.nitroHeld = true;
      if (e.code === "KeyP") {
        setScreen((s) => (s === "playing" ? "paused" : s === "paused" ? "playing" : s));
      }
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        if (!e.repeat) input.current.jumpQueued = true;
        e.preventDefault();
      }
    };
    const up = (e) => {
      if (e.code === "ArrowRight" || e.code === "KeyD") input.current.fwd = false;
      if (e.code === "ArrowLeft" || e.code === "KeyA") input.current.back = false;
      if (e.code === "KeyF") input.current.flipHeld = false;
      if (e.code === "KeyG") input.current.wheelieHeld = false;
      if (e.code === "KeyN") input.current.nitroHeld = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let W = 0;
    let H = 0;
    let raf;
    let last = performance.now();

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const localSurface = (x, offset, slope) =>
      surfaceY(x + offset) - surfaceY(x) - slope * offset;

    // Lowest the truck's reference point can be while the ground touches the truck.
    // While doing a wheelie only the rear wheel touches the ground.
    const contactHeight = (x, slope, wheelie) => {
      let c = -Infinity;
      if (wheelie > 0.02) {
        c = Math.max(c, localSurface(x, WHEEL_X[0], slope));
        BODY_POINTS.forEach((p) => {
          if (p <= 0) c = Math.max(c, localSurface(x, p, slope) - CH);
        });
      } else {
        WHEEL_X.forEach((wx) => {
          c = Math.max(c, localSurface(x, wx, slope));
        });
        BODY_POINTS.forEach((p) => {
          c = Math.max(c, localSurface(x, p, slope) - CH);
        });
      }
      return c;
    };

    const update = (dt) => {
      const g = game.current;
      truckWorldX = g.x;
      const inp = input.current;
      const slope = (surfaceY(g.x + 6) - surfaceY(g.x - 6)) / 12;
      const contact = contactHeight(g.x, slope, g.wheelie);
      g.grounded = g.alt <= contact + 3 && g.vy <= 0.5;

      const zone = zoneAt(g.x);
      const inWater = zone.water !== null && surfaceY(g.x) < zone.water;
      const inMud = zone.mud;

      // Speed
      let target = 0;
      if (inp.fwd && g.phase === "none" && g.fuel > 0) {
        const nitroOn = inp.nitroHeld && g.nitro > 0;
        const boosting = g.boostLeft > 0;
        target = MAX_SPEED * (boosting ? (nitroOn ? 3.2 : 2.6) : nitroOn ? 2.2 : 1);
      }
      if (inp.back && g.phase === "none" && g.fuel > 0) target = -REVERSE_SPEED;
      if (g.grounded) target *= clamp(1 - slope * 0.45, 0.3, 1.15);
      if (g.wheelie > 0.05) target *= 0.55;
      const steepUp = g.grounded && slope > 0.75 && inp.fwd && !(inp.nitroHeld && g.nitro > 0);
      if (steepUp && g.phase === "none") target = -0.8; // can't climb without nitro
      if (inWater) target *= 0.45;
      if (inMud) target *= 0.22;
      const braking = inp.back && g.vx > 0.5;
      const rate = braking ? 0.025 : inMud ? 0.16 : inWater ? 0.14 : 0.12;
      const leanTarget = (braking ? 0.15 : 0) - (inp.nitroHeld && g.nitro > 0 && inp.fwd ? 0.07 : 0);
      g.lean += (leanTarget - g.lean) * Math.min(1, 0.08 * dt);
      g.vx += (target - g.vx) * Math.min(1, rate * dt * mapRef.current.grip);

      // Jump
      if (inp.jumpQueued && g.grounded) g.vy = JUMP_POWER;
      inp.jumpQueued = false;

      // Stunts: FLIP rotates the truck in the air, WHEELIE lifts the nose on the ground
      if (!g.grounded && inp.flipHeld) g.flip += FLIP_SPEED * dt;
      if (inp.wheelieHeld && g.grounded) g.wheelieRaw += 0.008 * dt;
      else g.wheelieRaw = Math.max(0, g.wheelieRaw - 0.03 * dt);
      const nitroLift = inp.nitroHeld && g.grounded && g.nitro > 0 ? 0.12 : 0;
      const wheelieTarget = (g.grounded ? g.wheelieRaw : 0) + nitroLift;
      if (g.phase === "none") g.wheelie += (wheelieTarget - g.wheelie) * Math.min(1, 0.1 * dt);
      if (g.wheelie >= FLIP_LIMIT && g.grounded && g.phase === "none") {
        g.phase = "flipping";
        g.phaseT = 0;
      }

      g.x += g.vx * dt;

      // Vertical physics
      const slopeNow = (surfaceY(g.x + 6) - surfaceY(g.x - 6)) / 12;
      const contactNow = contactHeight(g.x, slopeNow, g.wheelie);
      const prevVy = g.vy;
      const wasGrounded = g.grounded;
      // Snap window: normally the truck sticks to the road; on a kicker lip it can leave the ground
      const snapWindow = onLaunchLip(g.x) ? 0.5 : 6;
      g.vy -= GRAVITY * dt;
      g.alt += g.vy * dt;
      if (wasGrounded && g.alt > contactNow + snapWindow && onLaunchLip(g.x)) {
        // leaving the road: keep moving along the road's tangent (this gives the jump)
        g.vy = g.vx * slopeNow;
      }
      if (g.vy <= 0 && g.alt <= contactNow + snapWindow) {
        if (prevVy < -3 && g.alt <= contactNow + 3) {
          g.impact = clamp(-prevVy * 0.8, 0, 8);
          WHEEL_X.forEach((_, i) => {
            g.suspV[i] += clamp(-prevVy * 0.1, 0, 1.5);
          });
        }
        // A front flip that lands upside down is a crash (same as the back flip)
        const remFlip = Math.abs(g.flip) % (Math.PI * 2);
        if (g.phase === "none" && Math.abs(g.flip) > 0.5 && remFlip > Math.PI * 0.6 && remFlip < Math.PI * 1.4) {
          const n0 = Math.floor(Math.abs(g.flip) / (Math.PI * 2));
          const up1 = n0 * Math.PI * 2 + Math.PI;
          const up2 = up1 + Math.PI * 2;
          g.flipTarget = Math.abs(Math.abs(g.flip) - up1) <= Math.abs(Math.abs(g.flip) - up2) ? up1 : up2;
          g.flipDir = 1;
          g.phase = "flipping";
          g.phaseT = 0;
        }
        // Landing after a flip: score it, then snap the rotation to the nearest full turn
        if (g.phase === "none" && Math.abs(g.flip) > 0.3) {
          const turns = Math.round(Math.abs(g.flip) / (Math.PI * 2));
          if (turns >= 1) {
            g.stunts += turns;
            const perfect = Math.abs(Math.abs(g.flip) - turns * Math.PI * 2) < 0.6;
            g.stuntMsg = `🔥 ${turns} FLIP${turns > 1 ? "S" : ""}${perfect ? " PERFECT!" : " rough landing"}`;
            g.stuntTimer = 150;
          } else {
            g.stuntMsg = "Landed";
            g.stuntTimer = 60;
          }
        }
        if (g.phase === "none") g.flip = Math.round(g.flip / (Math.PI * 2)) * Math.PI * 2;
        g.alt = contactNow;
        g.vy = 0;
      }
      g.impact *= Math.pow(0.92, dt);
      if (g.stuntTimer > 0) g.stuntTimer -= dt;

      // Visual suspension
      WHEEL_X.forEach((wx, i) => {
        const tgt = clamp(localSurface(g.x, wx, slopeNow) - g.alt, -SUSP_EXT, SUSP_COMP);
        for (let sub = 0; sub < 4; sub++) {
          g.suspV[i] += (SUSP_K * (tgt - g.susp[i]) - SUSP_D * g.suspV[i]) * (dt / 4);
          g.susp[i] += g.suspV[i] * (dt / 4);
        }
      });

      // Dust behind the wheels on dry ground
      if (g.grounded && Math.abs(g.vx) > 1 && Math.random() < 0.6) {
        dust.current.push({
          x: g.x - 80 * Math.sign(g.vx),
          y: surfaceY(g.x - 80 * Math.sign(g.vx)) + 6,
          vx: -g.vx * 0.2 + (Math.random() - 0.5) * 0.4,
          vy: 0.3 + Math.random() * 0.4,
          life: 1,
        });
        if (dust.current.length > 70) dust.current.shift();
      }
      dust.current = dust.current
        .map((p) => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, life: p.life - 0.022 * dt }))
        .filter((p) => p.life > 0);

      g.status = inWater
        ? "💧 In water"
        : inMud
        ? "🟫 In mud"
        : zone.bridge
        ? "🌉 On rope bridge"
        : "";

      // Fuel stations: passing one refills the tank to 100%
      const stationIndex = Math.round(g.x / FUEL_STATION_GAP);
      if (
        stationIndex >= 1 &&
        Math.abs(g.x - stationIndex * FUEL_STATION_GAP) < 60 &&
        !g.collected[stationIndex]
      ) {
        g.collected[stationIndex] = true;
        g.fuel = 100;
        g.stuntMsg = "⛽ Fuel 100%!";
        g.stuntTimer = 120;
      }
      // Fuel is used while driving; when it runs out the game is over
      if (g.phase === "none" && g.fuel > 0) {
        g.fuel = Math.max(0, g.fuel - Math.abs(g.vx) * dt * FUEL_PER_UNIT);
        if (g.fuel <= 0) g.phase = "nofuel";
      }

      // Nitro: speed boost, drains the nitro tank and leaves a rocket flame behind
      if (inp.nitroHeld && inp.fwd && g.phase === "none" && g.nitro > 0) {
        g.nitro = Math.max(0, g.nitro - 0.5 * dt);
        g.heat += 0.12 * dt;
        fx.current.push({
          kind: "jet",
          x: g.x - 100,
          y: surfaceY(g.x) + g.alt + 42 + (Math.random() - 0.5) * 10,
          vx: -1.5 - Math.random() * 2,
          vy: (Math.random() - 0.5) * 0.4,
          life: 1,
        });
      } else {
        g.nitro = Math.min(100, g.nitro + 0.08 * dt);
      }

      // Flip: the truck rolls over, then the game is over
      if (g.phase === "flipping" && g.flipDir === 1) {
        // front flip: rotate forward until upside down
        g.phaseT += dt / 60;
        const diff = g.flipTarget - g.flip;
        g.flip += Math.sign(diff) * Math.min(Math.abs(diff), (Math.PI / 120) * dt);
        if (Math.abs(g.flipTarget - g.flip) < 0.01 || g.phaseT >= 2.2) {
          g.phase = "flipped";
          g.phaseT = 0;
        }
      } else if (g.phase === "flipping") {
        // roll backwards over the rear wheel until the truck is upside down
        g.phaseT += dt / 60;
        g.wheelie = Math.min(Math.PI, g.wheelie + ((Math.PI - FLIP_LIMIT) / 120) * dt); // about 2 seconds
        if (g.wheelie >= Math.PI - 0.01 || g.phaseT >= 2.2) {
          g.phase = "flipped";
          g.phaseT = 0;
        }
      }
      if (g.phase === "flipped") g.phaseT += dt / 60; // time the truck lies upside down
      if (g.phase === "flipping" || g.phase === "flipped") {
        g.flipLift = g.flipDir === 1 ? 125 * clamp((Math.abs(g.flip) % (Math.PI * 2)) / Math.PI, 0, 1) : 125 * clamp(g.wheelie / Math.PI, 0, 1); // lifts the roof onto the road
      }
      if (g.phase === "none" && g.wheelie > FLIP_LIMIT * 0.7 && g.grounded) {
        g.status = "⚠️ Truck unstable!";
      } else if (g.phase === "none" && steepUp) {
        g.status = "⛰️ Nitro needed!";
      }

      // Checkpoints every 400 m
      CHECKPOINTS.forEach((cp) => {
        if (g.x >= cp && g.checkpoint < cp) {
          g.checkpoint = cp;
          g.stuntMsg = `✅ Checkpoint ${cp / 10} m!`;
          g.stuntTimer = 120;
        }
      });

      // Coins: collect them by driving through, or jumping up to the high ones
      const bodyMid = surfaceY(g.x) + g.alt + 40;
      const firstCoin = Math.max(0, Math.floor((g.x - 200) / 330) - 1);
      for (let i = firstCoin; i <= firstCoin + 3 && i < COIN_COUNT; i++) {
        if (g.coinSet[i] || nearRamp(COIN_X(i), 300)) continue;
        const cx = COIN_X(i);
        const cy = surfaceY(cx) + (i % 3 === 2 ? 150 : 50);
        if (Math.abs(g.x - cx) < 60 && Math.abs(bodyMid - cy) < 90) g.coinSet[i] = true;
      }

      // Finish line at 3000 m
      if (g.phase === "none" && g.x >= COURSE_END) g.phase = "finished";

      // A flip (after 2 s upside down), fuel-out or engine fire costs a life.
      // With lives left, the lives popup shows and the game waits for CONTINUE.
      if ((g.phase === "flipped" && g.phaseT >= 2) || (g.phase === "blast" && g.phaseT >= 2) || g.phase === "nofuel" || g.phase === "over") {
        if (g.lives > 1) {
          g.lives -= 1;
          g.phase = "lostLife";
        } else {
          g.lives = 0;
        }
      }

      // Repair tool (cools the engine) and boost tool (100 m of extra speed) every 500 m
      for (let k = 1; k <= 5; k++) {
        const rx = k * 5000;
        const bx = rx + 160;
        const bodyTool = surfaceY(g.x) + g.alt + 40;
        if (!g.toolsGot["r" + k] && !nearRamp(rx, 300) && Math.abs(g.x - rx) < 70 && Math.abs(bodyTool - (surfaceY(rx) + 60)) < 100) {
          g.toolsGot["r" + k] = true;
          g.heat = 0;
          g.stuntMsg = "🔧 Repaired! Engine cooled down";
          g.stuntTimer = 120;
        }
        if (!g.toolsGot["b" + k] && !nearRamp(bx, 300) && Math.abs(g.x - bx) < 70 && Math.abs(bodyTool - (surfaceY(bx) + 60)) < 100) {
          g.toolsGot["b" + k] = true;
          g.boostLeft = 1000;
          g.stuntMsg = "⚡ Boost! 100 m of extra speed";
          g.stuntTimer = 120;
        }
      }
      if (g.boostLeft > 0) {
        g.boostLeft = Math.max(0, g.boostLeft - Math.abs(g.vx) * dt);
        g.status = "⚡ Boost";
        // exhaust flame from the silencer: orange with boost, blue with boost + nitro
        const blue = inp.nitroHeld && g.nitro > 0;
        if (Math.random() < 0.8) {
          fx.current.push({
            kind: blue ? "blueFire" : "boostFire",
            x: g.x - 100,
            y: surfaceY(g.x) + g.alt + 75 + (Math.random() - 0.5) * 6,
            vx: -2 - Math.random() * 2,
            vy: (Math.random() - 0.5) * 0.8,
            life: 1,
          });
        }
      }

      // Boost + nitro for 70 m in a row: warning, then the truck blows up
      if (g.phase === "none") {
        if (g.boostLeft > 0 && inp.nitroHeld && inp.fwd && g.nitro > 0) g.blastDist += Math.abs(g.vx) * dt;
        else g.blastDist = 0;
        if (g.blastDist >= 700) {
          g.phase = "warning";
          g.phaseT = 0;
          g.blastDist = 0;
        }
      } else if (g.phase === "warning") {
        g.phaseT += dt / 60;
        if (g.phaseT >= 1) {
          g.phase = "blast";
          g.phaseT = 0;
          // the two tyres come off and fly away, the rest of the truck explodes
          [WHEEL_X[0], WHEEL_X[1]].forEach((wx, i) => {
            g.debris.push({
              x: g.x + wx,
              y: surfaceY(g.x + wx) + WHEEL_R,
              vx: (i === 0 ? -4 : 4) + Math.random() * 2,
              vy: 6 + Math.random() * 4,
              rot: 0,
              vr: (i === 0 ? -0.25 : 0.25),
            });
          });
          for (let i = 0; i < 40; i++) {
            fx.current.push({
              kind: i % 3 === 0 ? "smoke" : "fire",
              x: g.x + (Math.random() - 0.5) * 160,
              y: surfaceY(g.x) + g.alt + 40 + Math.random() * 80,
              vx: (Math.random() - 0.5) * 8,
              vy: Math.random() * 6,
              life: 1,
            });
          }
        }
      } else if (g.phase === "blast") {
        g.phaseT += dt / 60;
      }
      g.debris.forEach((d) => {
        d.vy -= GRAVITY * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.rot += d.vr * dt;
        const ground = surfaceY(d.x) + WHEEL_R;
        if (d.y < ground) {
          d.y = ground;
          d.vy = -d.vy * 0.4;
          d.vx *= 0.85;
          d.vr *= 0.8;
          if (Math.abs(d.vy) < 1) d.vy = 0;
        }
      });

      // Engine heat: driving and stunts heat it up, water and idling cool it
      if (g.phase === "none") {
        if (inp.fwd || inp.back) g.heat += 0.09 * dt;
        if (inp.wheelieHeld && g.grounded) g.heat += 0.14 * dt;
        if (inp.flipHeld && !g.grounded) g.heat += 0.14 * dt;
        if (!inp.fwd && !inp.back) g.heat -= 0.3 * dt; // fast cooling when not driving
        else if (g.heat > 0) g.heat -= 0.04 * dt; // slow cooling while driving
        g.heat = clamp(g.heat, 0, 100);
        if (g.heat >= 85 && Math.random() < 0.6) {
          fx.current.push({
            kind: "smoke",
            x: g.x + 60,
            y: surfaceY(g.x) + g.alt + CH + 70,
            vx: 0.15 + Math.random() * 0.2,
            vy: 0.5 + Math.random() * 0.4,
            life: 1,
          });
        }
        if (g.heat >= 100) {
          g.phase = "burning";
          g.phaseT = 0;
        }
      } else if (g.phase === "burning") {
        // the truck is on fire for 3 seconds
        g.heat = 100;
        g.phaseT += dt / 60;
        if (Math.random() < 0.9) {
          fx.current.push({
            kind: "fire",
            x: g.x + (Math.random() - 0.5) * 120,
            y: surfaceY(g.x) + g.alt + Math.random() * 110,
            vx: (Math.random() - 0.5) * 0.6,
            vy: 0.8 + Math.random() * 0.8,
            life: 1,
          });
        }
        if (g.phaseT >= 3) {
          g.phase = "fading";
          g.phaseT = 0;
        }
      } else if (g.phase === "fading") {
        // screen fades out for 3 seconds, then the Try Again popup shows
        g.phaseT += dt / 60;
        if (g.phaseT >= 3) g.phase = "over";
      }
      fx.current = fx.current
        .map((p) => ({
          ...p,
          x: p.x + p.vx * dt,
          y: p.y + p.vy * dt,
          life: p.life - (p.kind === "fire" || p.kind === "boostFire" || p.kind === "blueFire" ? 0.05 : 0.012) * dt,
        }))
        .filter((p) => p.life > 0);

      g.wheel += (g.vx * dt) / WHEEL_R;
      g.dist = Math.max(g.dist, g.x / PX_PER_METER);
    };

    const draw = () => {
      const g = game.current;
      const baseLine = H * 0.55;
      const camX = g.x - W * (W < 700 ? 0.5 : 0.35);
      const sY = (wy) => baseLine - wy;

      const MP = mapRef.current;
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, MP.skyTop);
      sky.addColorStop(1, MP.skyBot);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      const haze = ctx.createRadialGradient(W * 0.8, H * 0.2, 10, W * 0.8, H * 0.2, W * 0.5);
      haze.addColorStop(0, "rgba(255,246,220,0.6)");
      haze.addColorStop(1, "rgba(255,246,220,0)");
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, W, H);

      [
        { k: 0.25, amp: 110, off: 60, col: MP.far1 },
        { k: 0.4, amp: 150, off: 20, col: MP.far2 },
      ].forEach((layer) => {
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let px = 0; px <= W; px += 8) {
          const wx = camX * layer.k + px;
          const wy =
            layer.amp * Math.abs(Math.sin(wx * 0.0018)) +
            layer.amp * 0.4 * Math.abs(Math.sin(wx * 0.005 + 2));
          ctx.lineTo(px, baseLine - layer.off - wy * 0.6);
        }
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fillStyle = layer.col;
        ctx.fill();
      });

      const grad = ctx.createLinearGradient(0, baseLine - 200, 0, H);
      grad.addColorStop(0, MP.gTop);
      grad.addColorStop(0.3, MP.gMid);
      grad.addColorStop(1, MP.gBot);
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let px = 0; px <= W; px += 4) ctx.lineTo(px, sY(groundY(camX + px)));
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      if (MP.decor === "snow") {
        const tt = performance.now() / 1000;
        for (let i = 0; i < 45; i++) {
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.beginPath();
          ctx.arc((i * 53.7 + tt * 22) % W, (i * 97.3 + tt * 45) % H, 2 + (i % 3), 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (MP.decor === "jungle") {
        ctx.fillStyle = "rgba(20,70,30,0.55)";
        for (let i = 0; i < 9; i++) {
          ctx.beginPath();
          ctx.ellipse(i * (W / 8) - 40, 40 + (i % 3) * 18, 120, 50, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (MP.decor === "stars") {
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        for (let i = 0; i < 60; i++) {
          ctx.beginPath();
          ctx.arc((i * 137.5) % W, (i * 61.3) % (H * 0.5), 1 + (i % 2), 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (MP.decor === "embers") {
        const te = performance.now() / 1000;
        for (let i = 0; i < 40; i++) {
          ctx.fillStyle = "rgba(255,140,0,0.8)";
          ctx.beginPath();
          ctx.arc((i * 53.7) % W, H - ((i * 97.3 + te * 60) % H), 2 + (i % 3), 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (MP.decor === "dunes") {
        ctx.fillStyle = "rgba(230,180,110,0.5)";
        for (let i = 0; i < 6; i++) {
          ctx.beginPath();
          ctx.ellipse(i * (W / 5) - 60, H * 0.5 + (i % 2) * 14, 180, 36, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (MP.decor === "sea") {
        ctx.fillStyle = "rgba(255,240,180,0.9)";
        ctx.beginPath();
        ctx.arc(W * 0.85, H * 0.16, 46, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let gx = Math.floor(camX / 9); gx <= Math.floor((camX + W) / 9); gx++) {
        const r1 = rnd(gx * 3 + 1);
        if (r1 < 0.45) continue;
        const wx = gx * 9;
        const sx = wx - camX;
        const sy = sY(groundY(wx)) + 4 + rnd(gx * 5 + 2) * 60;
        ctx.fillStyle = r1 > 0.85 ? "rgba(60,50,40,0.35)" : "rgba(255,255,255,0.25)";
        ctx.fillRect(sx, sy, 2 + rnd(gx) * 2, 2);
      }

      const feats = featuresNear(camX + W / 2);

      feats.forEach((f) => {
        if (f.kind !== "rock") return;
        const x0 = f.cx - f.hw;
        const x1 = f.cx + f.hw;
        ctx.beginPath();
        for (let wx = x0; wx <= x1; wx += 3) {
          const sx = wx - camX;
          const top = sY(groundY(wx));
          if (wx === x0) ctx.moveTo(sx, top);
          else ctx.lineTo(sx, top);
        }
        for (let wx = x1; wx >= x0; wx -= 3) ctx.lineTo(wx - camX, sY(groundY(wx)) + 14);
        ctx.closePath();
        ctx.fillStyle = MP.rock;
        ctx.fill();
        ctx.strokeStyle = "#b8ab9a";
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let wx = x0; wx <= x1; wx += 3) {
          const sx = wx - camX;
          const top = sY(groundY(wx)) + 1;
          if (wx === x0) ctx.moveTo(sx, top);
          else ctx.lineTo(sx, top);
        }
        ctx.stroke();
      });

      feats.forEach((f) => {
        if (f.kind !== "mud") return;
        for (let wx = f.cx - f.hw; wx <= f.cx + f.hw; wx += 4) {
          ctx.fillStyle = "#4a3426";
          ctx.fillRect(wx - camX, sY(groundY(wx)), 4, 14);
        }
        for (let i = 0; i < 8; i++) {
          const bx = f.cx - f.hw + rnd(i + Math.floor(f.cx)) * f.hw * 2;
          const by = sY(groundY(bx)) + 4 + rnd(i * 3 + 1) * 6;
          ctx.fillStyle = "rgba(110,80,60,0.8)";
          ctx.beginPath();
          ctx.arc(bx - camX, by, 2 + rnd(i) * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      feats.forEach((f) => {
        if (f.kind !== "pond") return;
        const level = Math.min(baseY(f.cx - f.hw), baseY(f.cx + f.hw)) - 1;
        for (let wx = f.cx - f.hw; wx <= f.cx + f.hw; wx += 4) {
          const gy = groundY(wx);
          if (gy >= level) continue;
          ctx.fillStyle = "rgba(40,110,150,0.75)";
          ctx.fillRect(wx - camX, sY(level), 4, sY(gy) - sY(level));
        }
      });

      feats.forEach((f) => {
        if (f.kind === "launch") {
          // Heavy dirt ramp silhouette with a black/yellow hazard-striped riding surface.
          const x0 = f.cx - f.hw;
          const x1 = f.cx + f.hw;
          ctx.save();
          ctx.beginPath();
          for (let wx = x0; wx <= x1; wx += 5) {
            const px = wx - camX;
            const py = sY(groundY(wx));
            if (wx === x0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.lineTo(x1 - camX, sY(baseY(x1)) + 12);
          for (let wx = x1; wx >= x0; wx -= 5) {
            ctx.lineTo(wx - camX, sY(baseY(wx)) + 12);
          }
          ctx.closePath();
          ctx.fillStyle = "#493126";
          ctx.fill();
          ctx.strokeStyle = "#21150f";
          ctx.lineWidth = 4;
          ctx.stroke();

          // Top edge and alternating caution blocks follow the actual collision profile.
          ctx.beginPath();
          for (let wx = x0; wx <= x1; wx += 4) {
            const px = wx - camX;
            const py = sY(groundY(wx));
            if (wx === x0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.strokeStyle = "#171717";
          ctx.lineWidth = 13;
          ctx.lineJoin = "round";
          ctx.stroke();

          for (let wx = x0; wx < x1 - 2; wx += 22) {
            const mid = wx + 10;
            const y1 = sY(groundY(wx)) - 2;
            const y2 = sY(groundY(Math.min(x1, wx + 18))) - 2;
            ctx.strokeStyle = Math.floor((wx - x0) / 22) % 2 ? "#ffca28" : "#e6a900";
            ctx.lineWidth = 7;
            ctx.beginPath();
            ctx.moveTo(wx - camX, y1);
            ctx.lineTo(Math.min(x1, wx + 18) - camX, y2);
            ctx.stroke();
          }

          // Structural supports for bridge/platform-style models.
          if (["suspended", "bridge", "platform"].includes(f.rampType)) {
            for (let wx = x0 + 45; wx < x1 - 20; wx += 95) {
              const top = sY(groundY(wx)) + 5;
              const bottom = sY(baseY(wx)) + 12;
              ctx.strokeStyle = "#34383b";
              ctx.lineWidth = 9;
              ctx.beginPath();
              ctx.moveTo(wx - camX, top);
              ctx.lineTo(wx - camX, bottom);
              ctx.stroke();
              ctx.strokeStyle = "#9aa0a6";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(wx - camX - 5, top + 8);
              ctx.lineTo(wx - camX + 5, bottom - 5);
              ctx.moveTo(wx - camX + 5, top + 8);
              ctx.lineTo(wx - camX - 5, bottom - 5);
              ctx.stroke();
            }
          }
          ctx.restore();
          return;
        }
        if (f.kind === "hill") {
          const bx = f.cx - f.hw - camX;
          const by = sY(groundY(f.cx - f.hw));
          ctx.save();
          ctx.fillStyle = "#455a64";
          ctx.fillRect(bx - 3, by - 90, 6, 90);
          ctx.fillStyle = "#ffca28";
          ctx.strokeStyle = "#111";
          ctx.lineWidth = 3;
          roundedRectPath(ctx, bx - 80, by - 130, 160, 42, 8);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#111";
          ctx.font = "bold 14px Arial, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("⛰️ NITRO ZAROORI", bx, by - 109);
          ctx.restore();
          return;
        }
        if (f.kind !== "car") return;
        ctx.save();
        ctx.translate(f.cx - camX, sY(groundY(f.cx)) + 1);
        drawCrashedCar(ctx);
        ctx.restore();
      });

      feats.forEach((f) => {
        if (f.kind !== "chasm") return;
        const x0 = f.cx - f.hw;
        const x1 = f.cx + f.hw;
        const d0 = deckY(f, x0);
        const d1 = deckY(f, x1);

        ctx.strokeStyle = "#8c7050";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let t = 0; t <= 1.0001; t += 0.02) {
          const wx = x0 + t * (x1 - x0);
          const ry = d0 + (d1 - d0) * t + 40 - 26 * 4 * t * (1 - t);
          if (t === 0) ctx.moveTo(wx - camX, sY(ry));
          else ctx.lineTo(wx - camX, sY(ry));
        }
        ctx.stroke();

        ctx.strokeStyle = "#6e5538";
        ctx.lineWidth = 1.5;
        for (let wx = x0; wx <= x1; wx += 14) {
          const t = (wx - x0) / (x1 - x0);
          const railY = d0 + (d1 - d0) * t + 40 - 26 * 4 * t * (1 - t);
          ctx.beginPath();
          ctx.moveTo(wx - camX, sY(railY));
          ctx.lineTo(wx - camX, sY(deckY(f, wx)));
          ctx.stroke();
        }

        for (let wx = x0; wx <= x1; wx += 12) {
          ctx.fillStyle = Math.floor(wx / 12) & 1 ? "#8a6a4a" : "#74563a";
          ctx.fillRect(wx - camX, sY(deckY(f, wx)), 11, 10);
        }

        ctx.fillStyle = "#5a4330";
        [x0, x1].forEach((px) => {
          ctx.fillRect(px - camX - 4, sY(deckY(f, px) + 42), 8, 42);
        });
      });

      // Fuel stations every 300 m: canopy over two pumps
      for (
        let k = Math.max(1, Math.floor((camX - 200) / FUEL_STATION_GAP));
        k <= Math.floor((camX + W + 200) / FUEL_STATION_GAP);
        k++
      ) {
        const wx = k * FUEL_STATION_GAP;
        const used = g.collected[k];
        ctx.save();
        ctx.translate(wx - camX, sY(groundY(wx)));
        ctx.globalAlpha = used ? 0.5 : 1;
        // shadow on the road
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(-112, -3, 224, 6);
        // canopy posts
        ctx.fillStyle = "#cfd8dc";
        ctx.fillRect(-100, -122, 8, 122);
        ctx.fillRect(92, -122, 8, 122);
        // canopy with red brand band and FUEL sign
        const roof = ctx.createLinearGradient(0, -150, 0, -120);
        roof.addColorStop(0, "#ffffff");
        roof.addColorStop(1, "#b0bec5");
        ctx.fillStyle = roof;
        roundedRectPath(ctx, -116, -150, 232, 30, 6);
        ctx.fill();
        ctx.fillStyle = "#e53935";
        ctx.fillRect(-116, -134, 232, 12);
        ctx.fillStyle = "#e53935";
        ctx.font = "bold 16px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("FUEL", 0, -141);
        // two pumps
        [-52, 52].forEach((px) => {
          ctx.fillStyle = "#263238";
          roundedRectPath(ctx, px - 16, -96, 32, 96, 8);
          ctx.fill();
          ctx.fillStyle = "#e53935";
          roundedRectPath(ctx, px - 14, -92, 28, 18, 4);
          ctx.fill();
          ctx.fillStyle = "#00e676";
          ctx.fillRect(px - 10, -66, 20, 14);
          ctx.fillStyle = "#1b5e20";
          ctx.fillRect(px - 8, -62, 16, 2);
          ctx.fillRect(px - 8, -58, 10, 2);
          ctx.strokeStyle = "#111";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(px + 16, -58);
          ctx.quadraticCurveTo(px + 30, -30, px + 22, -10);
          ctx.stroke();
          ctx.fillStyle = "#ffb300";
          ctx.fillRect(px + 18, -12, 9, 7);
        });
        ctx.restore();
      }

      // Coins
      for (let i = Math.max(0, Math.floor((camX - 200) / 330) - 1); i < COIN_COUNT && COIN_X(i) < camX + W + 100; i++) {
        if (g.coinSet[i] || nearRamp(COIN_X(i), 300)) continue;
        const cx = COIN_X(i);
        const cy = surfaceY(cx) + (i % 3 === 2 ? 150 : 50);
        const spin = Math.abs(Math.cos(performance.now() / 250 + i));
        ctx.save();
        ctx.translate(cx - camX, sY(cy));
        ctx.scale(Math.max(0.2, spin), 1);
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fillStyle = "#ffd600";
        ctx.fill();
        ctx.strokeStyle = "#ff8f00";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = "#fff59d";
        ctx.beginPath();
        ctx.arc(-4, -5, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#8d6e00";
        ctx.font = "bold 16px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("$", 0, 1);
        ctx.restore();
      }

      // Repair and boost tools
      for (let k = 1; k <= 5; k++) {
        [[k * 5000, "r"], [k * 5000 + 160, "b"]].forEach(([tx, kind]) => {
          const key = kind + k;
          if (g.toolsGot[key] || nearRamp(tx, 300)) return;
          if (tx < camX - 100 || tx > camX + W + 100) return;
          const ty = surfaceY(tx) + 60;
          const bob = Math.sin(performance.now() / 300 + k) * 3;
          ctx.save();
          ctx.translate(tx - camX, sY(ty) + bob);
          ctx.beginPath();
          ctx.arc(0, 0, 18, 0, Math.PI * 2);
          ctx.fillStyle = kind === "r" ? "#43a047" : "#ff9800";
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.fillStyle = "#fff";
          if (kind === "r") {
            // wrench
            ctx.fillRect(-9, -2.5, 18, 5);
            ctx.beginPath();
            ctx.arc(6, -6, 5, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // lightning bolt
            ctx.beginPath();
            ctx.moveTo(3, -11);
            ctx.lineTo(-6, 1);
            ctx.lineTo(-1, 1);
            ctx.lineTo(-4, 11);
            ctx.lineTo(6, -2);
            ctx.lineTo(1, -2);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        });
      }

      // Tyres that came off in an explosion
      g.debris.forEach((d) => {
        ctx.save();
        ctx.translate(d.x - camX, sY(d.y));
        ctx.rotate(d.rot);
        ctx.scale(SVG_S, SVG_S);
        drawDesignWheel(ctx, 0, 0, 0, themeRef.current);
        ctx.restore();
      });

      // Checkpoints: a bench with cheerleaders cheering
      CHECKPOINTS.forEach((cp, ci) => {
        if (cp < camX - 150 || cp > camX + W + 150) return;
        const px = cp - camX;
        const py = sY(surfaceY(cp));
        const reached = g.checkpoint >= cp;
        const tt = performance.now() / 1000;
        const cols = ["#e91e63", "#ffeb3b", "#4fc3f7", "#66bb6a"];
        // standing cheerleaders on both sides
        [-92, 92].forEach((ox, k) => {
          const bob = Math.sin(tt * 6 + k + ci) * 4;
          ctx.fillStyle = cols[(k + ci) % cols.length];
          ctx.fillRect(px + ox - 7, py - 58, 14, 40);
          ctx.fillStyle = "#f2c29b";
          ctx.beginPath();
          ctx.arc(px + ox, py - 66, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = cols[(k + ci) % cols.length];
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(px + ox - 6, py - 52);
          ctx.lineTo(px + ox - 14, py - 84 + bob);
          ctx.moveTo(px + ox + 6, py - 52);
          ctx.lineTo(px + ox + 14, py - 84 - bob);
          ctx.stroke();
          ctx.fillStyle = "#ff80ab";
          ctx.beginPath();
          ctx.arc(px + ox - 14, py - 88 + bob, 5, 0, Math.PI * 2);
          ctx.arc(px + ox + 14, py - 88 - bob, 5, 0, Math.PI * 2);
          ctx.fill();
        });
        // seated fans on the bench, arms up
        [-44, 0, 44].forEach((ox, k) => {
          const c2 = cols[(k + ci + 1) % cols.length];
          const bob = Math.sin(tt * 5 + k * 2 + ci) * 3;
          ctx.fillStyle = c2;
          ctx.fillRect(px + ox - 8, py - 36, 16, 18);
          ctx.fillStyle = "#f2c29b";
          ctx.beginPath();
          ctx.arc(px + ox, py - 42, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = c2;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(px + ox - 7, py - 32);
          ctx.lineTo(px + ox - 11, py - 56 + bob);
          ctx.moveTo(px + ox + 7, py - 32);
          ctx.lineTo(px + ox + 11, py - 56 - bob);
          ctx.stroke();
        });
        // bench
        ctx.fillStyle = "#8d6e63";
        ctx.fillRect(px - 70, py - 20, 140, 8);
        ctx.fillStyle = "#6d4c41";
        ctx.fillRect(px - 66, py - 12, 6, 12);
        ctx.fillRect(px + 60, py - 12, 6, 12);
        ctx.fillRect(px - 70, py - 30, 140, 5);
        // checkpoint sign
        ctx.fillStyle = reached ? "#2e7d32" : "#37474f";
        roundedRectPath(ctx, px - 46, py - 110, 92, 24, 6);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 13px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(reached ? `✅ ${cp / 10} m` : `${cp / 10} m`, px, py - 98);
      });

      // Finish line: a clean race gantry with a LED board and checkered track band
      if (COURSE_END > camX - 150 && COURSE_END < camX + W + 150) {
        const px = COURSE_END - camX;
        const py = sY(surfaceY(COURSE_END));
        // checkered band across the track
        for (let c = 0; c < 16; c++) {
          for (let r = 0; r < 2; r++) {
            ctx.fillStyle = (r + c) % 2 ? "#ffffff" : "#151515";
            ctx.fillRect(px - 4 + c * 4, py - 4 - r * 4, 4, 4);
          }
        }
        // steel columns with highlights
        const steel = ctx.createLinearGradient(px - 70, 0, px - 52, 0);
        steel.addColorStop(0, "#90a4ae");
        steel.addColorStop(0.5, "#eceff1");
        steel.addColorStop(1, "#607d8b");
        ctx.fillStyle = steel;
        ctx.fillRect(px - 70, py - 160, 12, 160);
        ctx.fillRect(px + 58, py - 160, 12, 160);
        // truss beam on top
        ctx.fillStyle = "#263238";
        ctx.fillRect(px - 76, py - 174, 152, 18);
        ctx.fillStyle = "#37474f";
        ctx.fillRect(px - 76, py - 174, 152, 4);
        // LED board
        ctx.fillStyle = "#111";
        roundedRectPath(ctx, px - 64, py - 150, 128, 46, 6);
        ctx.fill();
        ctx.strokeStyle = "#eceff1";
        ctx.lineWidth = 2;
        ctx.stroke();
        const tl = performance.now() / 1000;
        for (let i = 0; i < 16; i++) {
          ctx.fillStyle = Math.sin(tl * 5 + i) > 0 ? "#ffd600" : "#5d4037";
          ctx.fillRect(px - 64 + 4 + i * 8, py - 146, 4, 4);
          ctx.fillRect(px - 64 + 4 + i * 8, py - 110, 4, 4);
        }
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 22px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("FINISH", px, py - 127);
        // tiny lights on the columns
        ctx.fillStyle = "#00e5ff";
        ctx.fillRect(px - 67, py - 96, 6, 6);
        ctx.fillRect(px + 61, py - 96, 6, 6);
      }

      // Smoke and fire particles
      fx.current.forEach((p) => {
        const sx = p.x - camX;
        const sy = sY(p.y);
        if (p.kind === "boostFire") {
          ctx.fillStyle = `rgba(255,${Math.round(120 + p.life * 100)},0,${(p.life * 0.9).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 5 + (1 - p.life) * 9, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === "blueFire") {
          ctx.fillStyle = `rgba(64,160,255,${(p.life * 0.9).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 5 + (1 - p.life) * 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(220,240,255,${p.life.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 2 + p.life * 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === "jet") {
          ctx.fillStyle = `rgba(120,210,255,${(p.life * 0.8).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 4 + (1 - p.life) * 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(255,255,255,${p.life.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 2 + p.life * 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === "smoke") {
          ctx.fillStyle = `rgba(70,70,70,${(p.life * 0.5).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 8 + (1 - p.life) * 18, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = p.life > 0.5 ? `rgba(255,213,79,${p.life.toFixed(3)})` : `rgba(244,67,54,${(p.life * 1.4).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 6 + p.life * 10, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      dust.current.forEach((p) => {
        ctx.fillStyle = `rgba(214,186,140,${(p.life * 0.45).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x - camX, sY(p.y), 6 + (1 - p.life) * 12, 0, Math.PI * 2);
        ctx.fill();
      });

      // Truck: follows the road slope, plus air rotation (FLIP) and nose-up (WHEELIE)
      const slope = (surfaceY(g.x + 6) - surfaceY(g.x - 6)) / 12;
      const airPitch = g.grounded ? 0 : clamp(-g.vy * 0.012, -0.15, 0.15);
      const tilt = -Math.atan(slope) + airPitch + g.flip + g.lean;
      ctx.save();
      const TRUCK_K = W < 700 ? 0.8 : 1; // smaller truck on mobile screens
      const flipping = g.phase === "flipping" || g.phase === "flipped";
      const liftNow = flipping ? flipLiftFor(g, tilt, TRUCK_K) : 0;
      ctx.translate(g.x - camX, sY(surfaceY(g.x) + g.alt) - liftNow);
      ctx.rotate(tilt);
      ctx.scale(TRUCK_K, TRUCK_K);
      ctx.translate(WHEEL_X[0], 0);
      ctx.rotate(-g.wheelie); // pivot on the rear wheel
      ctx.translate(-WHEEL_X[0], 0);
      if (g.phase !== "blast") drawTruckDesign(ctx, g, themeRef.current);
      ctx.restore();
    };

    const loop = (now) => {
      const dt = Math.min((now - last) / (1000 / 60), 2);
      last = now;
      if (screenRef.current === "playing" && game.current.phase !== "lostLife") update(dt);
      updateEngine(audioRef, game.current.vx, volumeRef.current, screenRef.current === "playing");
      draw();

      const g = game.current;
      const d = Math.floor(g.dist);
      const h = Math.max(0, Math.floor(surfaceY(g.x) + g.alt));
      const line = g.stuntTimer > 0 ? g.stuntMsg : g.status;
      const hot = Math.round(g.heat);
      const fu = Math.round(g.fuel);
      const ni = Math.round(g.nitro);
      const cn = Object.keys(g.coinSet).length;
      const lv = g.lives;
      if (
        d !== lastHud.current.d ||
        h !== lastHud.current.h ||
        line !== lastHud.current.s ||
        g.stunts !== lastHud.current.n ||
        hot !== lastHud.current.heat ||
        fu !== lastHud.current.fuel ||
        ni !== lastHud.current.nitro ||
        cn !== lastHud.current.coins ||
        lv !== lastHud.current.lives ||
        g.phase !== lastHud.current.phase
      ) {
        lastHud.current = { d, h, s: line, n: g.stunts, heat: hot, fuel: fu, nitro: ni, coins: cn, lives: lv, phase: g.phase };
        setDistance(d);
        setHeight(h);
        setStatus(line);
        setStunts(g.stunts);
        setHeat(hot);
        setFuel(fu);
        setNitro(ni);
        setCoins(cn);
        setLives(lv);
        setOverPhase(g.phase);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const startGame = () => {
    ensureAudio(audioRef);
    setScreen("playing");
  };

  const exitGame = () => {
    game.current = initialState();
    dust.current = [];
    fx.current = [];
    lastHud.current = { d: -1, h: -1, s: "", n: 0, heat: -1, fuel: -1, phase: "none" };
    setDistance(0);
    setHeight(0);
    setStatus("");
    setStunts(0);
    setHeat(0);
    setFuel(100);
    setOverPhase("none");
    setTopSide("restart");
    setScreen("trucks");
  };

  const startRound = (mi, rn) => {
    setMapIdx(mi);
    setRound(rn);
    worldSeed = rn * 13 + mi * 101; // each round has its own road
    courseRound = rn; // more and harder ramps in later rounds
    game.current = initialState();
    dust.current = [];
    fx.current = [];
    lastHud.current = { d: -1, h: -1, s: "", n: 0, heat: -1, fuel: -1, nitro: -1, coins: -1, lives: -1, phase: "none" };
    setDistance(0);
    setHeight(0);
    setStatus("");
    setStunts(0);
    setHeat(0);
    setFuel(100);
    setOverPhase("none");
    setTopSide("restart");
    setScreen("playing");
    ensureAudio(audioRef);
  };

  const toRoundSelect = () => {
    game.current = initialState();
    setOverPhase("none");
    setScreen("rounds");
  };

  const continueRun = () => {
    respawnTruck(game.current);
    lastHud.current = { d: -1, h: -1, s: "", n: 0, heat: -1, fuel: -1, nitro: -1, coins: -1, lives: -1, phase: "none" };
    setOverPhase("none");
  };

  const restart = () => {
    game.current = initialState();
    dust.current = [];
    lastHud.current = { d: -1, h: -1, s: "", n: 0 };
    setDistance(0);
    setHeight(0);
    setStatus("");
    setStunts(0);
    setOverPhase("none");
    setHeat(0);
    setFuel(100);
    fx.current = [];
    setScreen("playing");
  };

  const overlayStyle = {
    position: "absolute",
    inset: 0,
    background: "radial-gradient(circle at center, rgba(40,20,5,0.55), rgba(10,5,0,0.85))",
    backdropFilter: "blur(3px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    animation: "mtFadeIn 0.35s ease both",
  };
  const panelStyle = {
    background: "linear-gradient(160deg, #fff8e1 0%, #ffe0b2 100%)",
    border: "4px solid transparent",
    backgroundClip: "padding-box",
    borderRadius: 24,
    padding: compact ? "14px 14px" : "26px 28px",
    width: panelW,
    minHeight: panelH,
    boxSizing: "border-box",
    maxWidth: "92vw",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    color: "#3e2723",
    boxShadow: "0 0 0 4px #ff9800, 0 0 40px rgba(255,152,0,0.6), 0 12px 40px rgba(0,0,0,0.5)",
    animation: "mtPop 0.6s cubic-bezier(0.2, 1.3, 0.4, 1) both",
    position: "relative",
  };
  const bigBtnStyle = {
    marginTop: 14,
    padding: compact ? "9px 18px" : "12px 28px",
    fontSize: compact ? 14 : 18,
    fontWeight: 800,
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(135deg, #ffb300, #ff6f00, #e65100)",
    color: "#fff",
    cursor: "pointer",
    textShadow: "0 2px 4px rgba(0,0,0,0.3)",
    animation: "mtGlow 1.6s ease-in-out infinite",
    letterSpacing: 1,
  };

  // Hold-to-use buttons (move, wheelie, flip)
  const hint = (t) =>
    !compact && <span style={{ fontSize: 9, fontWeight: 600, marginTop: 2, opacity: 0.9 }}>{t}</span>;

  const holdProps = (key) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      input.current[key] = true;
    },
    onPointerUp: () => {
      input.current[key] = false;
    },
    onPointerLeave: () => {
      input.current[key] = false;
    },
    onPointerCancel: () => {
      input.current[key] = false;
    },
    onContextMenu: (e) => e.preventDefault(),
  });

  const jumpProps = {
    onPointerDown: (e) => {
      e.preventDefault();
      input.current.jumpQueued = true;
    },
    onContextMenu: (e) => e.preventDefault(),
  };

  const ctrlStyle = {
    width: Math.round(64 * cs),
    height: Math.round(64 * cs),
    borderRadius: 32,
    border: "2px solid rgba(255,255,255,0.75)",
    background: "rgba(60,40,20,0.45)",
    color: "#fff",
    fontSize: 20,
    fontWeight: 700,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
    touchAction: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
    WebkitTapHighlightColor: "transparent",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: "#000",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block" }} />
      <style>{POPUP_CSS}</style>

      {screen === "menu" && (
        <div style={overlayStyle}>
          <div style={panelStyle}>
            <div style={{ fontSize: 46, animation: "mtBounce 1.4s ease-in-out infinite" }}>🚚</div>
            <h1 className="mt-title" style={{ margin: "4px 0 8px", fontSize: 28, fontWeight: 900 }}>
              MONSTER TRUCK
            </h1>
            <button onClick={() => setScreen("guide")} className="mt-btn" style={bigBtnStyle}>
              ▶ PLAY
            </button>
          </div>
        </div>
      )}

      {screen === "maps" && (
        <div style={overlayStyle}>
          <div style={panelStyle}>
            <div style={{ fontSize: 34 }}>🗺️</div>
            <h2 className="mt-title" style={{ margin: "2px 0 12px", fontSize: compact ? 20 : 26, fontWeight: 900 }}>
              CHOOSE MAP
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={() => setMapIdx(Math.max(0, mapIdx - 1))}
                disabled={mapIdx === 0}
                style={arrowBtnStyle(mapIdx === 0)}
              >
                ◀
              </button>
              <div
                key={mapIdx}
                style={{
                  width: compact ? 160 : 230,
                  height: compact ? 170 : 200,
                  borderRadius: 16,
                  border: "3px solid #fff",
                  boxShadow: "0 6px 18px rgba(0,0,0,0.3)",
                  background: `linear-gradient(180deg, ${MAPS[mapIdx].skyTop}, ${MAPS[mapIdx].skyBot} 55%, ${MAPS[mapIdx].gTop} 56%, ${MAPS[mapIdx].gBot})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  animation: "mtPop 0.45s ease both",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontFamily: "system-ui, sans-serif" }}>
                  <div style={{ fontSize: compact ? 40 : 52, lineHeight: 1 }}>{MAPS[mapIdx].name.split(" ").slice(-1)[0]}</div>
                  <div style={{ fontSize: compact ? 16 : 20, fontWeight: 300, color: "#fff", letterSpacing: 0.5, textShadow: "0 2px 6px rgba(0,0,0,0.5)" }}>
                    {MAPS[mapIdx].name.split(" ").slice(0, -1).join(" ")}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setMapIdx(Math.min(MAPS.length - 1, mapIdx + 1))}
                disabled={mapIdx === MAPS.length - 1}
                style={arrowBtnStyle(mapIdx === MAPS.length - 1)}
              >
                ▶
              </button>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10 }}>
              {MAPS.map((m, i) => (
                <span key={m.name} style={{ width: 9, height: 9, borderRadius: 5, background: i === mapIdx ? "#e65100" : "#bcaaa4" }} />
              ))}
            </div>
            <button onClick={() => setScreen("rounds")} className="mt-btn" style={{ ...bigBtnStyle, marginTop: 14 }}>
              NEXT ▶
            </button>
          </div>
        </div>
      )}

      {screen === "rounds" && (
        <div style={overlayStyle}>
          <div style={panelStyle}>
            <div style={{ fontSize: 34 }}>🏁</div>
            <h2 className="mt-title" style={{ margin: "2px 0 8px", fontSize: compact ? 18 : 24, fontWeight: 900 }}>
              {MAPS[mapIdx].name}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginTop: 6 }}>
              {Array.from({ length: ROUNDS }, (_, i) => i + 1).map((r) => {
                const open = r <= unlocked[mapIdx];
                const won = wins[`${mapIdx}-${r}`];
                return (
                  <button
                    key={r}
                    disabled={!open}
                    onClick={() => startRound(mapIdx, r)}
                    className={open ? "mt-btn" : undefined}
                    title={open ? `Round ${r}` : "Locked"}
                    style={{
                      width: "100%",
                      aspectRatio: "1 / 1",
                      borderRadius: 16,
                      padding: 0,
                      border: "2px solid #fff",
                      fontWeight: 900,
                      fontSize: 16,
                      color: "#fff",
                      background: won
                        ? "linear-gradient(135deg, #43a047, #1b5e20)"
                        : open
                        ? "linear-gradient(135deg, #ffb300, #e65100)"
                        : "#757575",
                      opacity: open ? 1 : 0.6,
                      cursor: open ? "pointer" : "not-allowed",
                    }}
                  >
                    {open ? (won ? `✓ ${r}` : r) : "🔒"}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setScreen("maps")} className="mt-btn" style={{ ...bigBtnStyle, marginTop: 12, background: "#6d4c41" }}>
              ◀ BACK TO MAPS
            </button>
          </div>
        </div>
      )}

      {screen === "trucks" && (
        <div style={overlayStyle}>
          <div style={panelStyle}>
            <h2 className="mt-title" style={{ margin: "2px 0 12px", fontSize: compact ? 18 : 24, fontWeight: 900 }}>
              CHOOSE TRUCK
            </h2>
            <div style={{ position: "relative", width: Math.round(panelW * 0.7), height: compact ? 150 : 170 }}>
              <div
                key={colorIdx}
                style={{
                  width: "100%",
                  height: "100%",
                  boxSizing: "border-box",
                  borderRadius: 16,
                  border: "3px solid #fff",
                  boxShadow: "0 6px 18px rgba(0,0,0,0.3)",
                  background: `linear-gradient(135deg, ${THEMES[colorIdx].secondary}, ${THEMES[colorIdx].primary} 55%, ${THEMES[colorIdx].dark})`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  animation: "mtPop 0.45s ease both",
                  overflow: "hidden",
                }}
              >
                <TruckPreview design={THEMES[colorIdx]} width={compact ? 190 : 220} height={compact ? 84 : 96} />
                <div
                  style={{
                    fontSize: compact ? 11 : 13,
                    fontWeight: 600,
                    color: THEMES[colorIdx].accent,
                    textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                    letterSpacing: 0.5,
                  }}
                >
                  {THEMES[colorIdx].name}
                </div>
              </div>
              <button
                onClick={() => setColorIdx(Math.max(0, colorIdx - 1))}
                disabled={colorIdx === 0}
                style={{ ...arrowBtnStyle(colorIdx === 0), position: "absolute", left: -22, top: "50%", transform: "translateY(-50%)" }}
              >
                ◀
              </button>
              <button
                onClick={() => setColorIdx(Math.min(THEMES.length - 1, colorIdx + 1))}
                disabled={colorIdx === THEMES.length - 1}
                style={{ ...arrowBtnStyle(colorIdx === THEMES.length - 1), position: "absolute", right: -22, top: "50%", transform: "translateY(-50%)" }}
              >
                ▶
              </button>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 12 }}>
              {THEMES.map((t, i) => (
                <span key={t.name} style={{ width: 9, height: 9, borderRadius: 5, background: i === colorIdx ? "#e65100" : "#bcaaa4" }} />
              ))}
            </div>
            <button onClick={() => setScreen("maps")} className="mt-btn" style={{ ...bigBtnStyle, marginTop: 14 }}>
              NEXT ▶
            </button>
          </div>
        </div>
      )}

      {screen === "guide" && (
        <div style={overlayStyle}>
          <div style={{ ...panelStyle, padding: "22px 20px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontSize: 40, animation: "mtBounce 1.4s ease-in-out infinite" }}>🎮</div>
            <h2 className="mt-title" style={{ margin: "2px 0 12px", fontSize: 26, fontWeight: 900 }}>
              CONTROL GUIDE
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {GUIDE.map((row, i) => (
                <div
                  key={row.name}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    background: "rgba(255,255,255,0.65)",
                    borderRadius: 10,
                    padding: "6px 4px",
                    animation: `mtPop 0.5s ease ${i * 0.05}s both`,
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      textAlign: "center",
                      background: "linear-gradient(135deg, #ffb300, #e65100)",
                      color: "#fff",
                      borderRadius: 8,
                      padding: "3px 2px",
                      fontWeight: 800,
                      fontSize: compact ? 18 : 10,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {compact ? GUIDE_ICONS[row.name] || row.key : row.key}
                  </div>
                  {!compact && (
                  <div style={{ fontSize: 11, lineHeight: 1.2, fontWeight: 300, textAlign: "center" }}>
                    <b style={{ fontWeight: 600 }}>{row.name}</b>
                    {!compact && row.keys && <div style={{ fontSize: 9, opacity: 0.85, marginTop: 2 }}>⌨ {row.keys}</div>}
                  </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setScreen("trucks")} className="mt-btn" style={{ ...bigBtnStyle, marginTop: 16 }}>
              ▶ LET'S GO
            </button>
          </div>
        </div>
      )}

      {/* HUD (top left) */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          color: "#fff",
          fontSize: compact ? 13 : 18,
          fontWeight: 700,
          textShadow: "0 2px 4px rgba(0,0,0,0.6)",
          pointerEvents: "none",
        }}
      >
        Round {round} &nbsp; 🏁 {distance}/3000 m &nbsp; {stunts > 0 && <>⭐ {stunts} &nbsp; </>}❤️ {lives} &nbsp; ${coins}/{COIN_COUNT}
        {status && <div style={{ fontSize: 15, marginTop: 4 }}>{status}</div>}
      </div>

      {/* Engine heat gauge */}
      {screen !== "menu" && (
        <div
          style={{
            position: "absolute",
            top: 100,
            left: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
            zIndex: 4,
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              fontSize: 22,
              display: "inline-block",
              animation: heat >= 85 ? "mtBounce 0.5s ease-in-out infinite" : "none",
            }}
          >
            🔥
          </span>
          <div
            style={{
              width: compact ? 110 : 170,
              height: 16,
              borderRadius: 8,
              background: "rgba(0,0,0,0.4)",
              border: "2px solid rgba(255,255,255,0.75)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${heat}%`,
                height: "100%",
                background: "linear-gradient(90deg, #ffeb3b, #ff9800, #d50000)",
                transition: "width 0.2s",
                boxShadow: heat >= 85 ? "0 0 12px #ff3d00" : "none",
              }}
            />
          </div>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 13, textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}>
            {heat}%{heat >= 85 ? " ⚠️" : ""}
          </span>
        </div>
      )}

      {(status.startsWith("⚠️") || status.startsWith("⛰️")) && screen === "playing" && (
        <div
          style={{
            position: "absolute",
            top: "30%",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(213,0,0,0.88)",
            color: "#fff",
            padding: "10px 22px",
            borderRadius: 14,
            fontWeight: 900,
            fontSize: 20,
            zIndex: 6,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            animation: "mtGlow 0.6s ease-in-out infinite",
          }}
        >
          {status}
        </div>
      )}

      {/* Nitro gauge */}
      {screen !== "menu" && (
        <div
          style={{
            position: "absolute",
            top: 172,
            left: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
            zIndex: 4,
            pointerEvents: "none",
          }}
        >
          <span style={{ fontSize: 20 }}>🚀</span>
          <div
            style={{
              width: compact ? 110 : 170,
              height: 16,
              borderRadius: 8,
              background: "rgba(0,0,0,0.4)",
              border: "2px solid rgba(255,255,255,0.75)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${nitro}%`,
                height: "100%",
                background: "linear-gradient(90deg, #80d8ff, #2962ff)",
                transition: "width 0.2s",
              }}
            />
          </div>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 13, textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}>
            {nitro}%
          </span>
        </div>
      )}

      {/* Fuel gauge */}
      {screen !== "menu" && (
        <div
          style={{
            position: "absolute",
            top: 136,
            left: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
            zIndex: 4,
            pointerEvents: "none",
          }}
        >
          <span style={{ fontSize: 20 }}>⛽</span>
          <div
            style={{
              width: compact ? 110 : 170,
              height: 16,
              borderRadius: 8,
              background: "rgba(0,0,0,0.4)",
              border: "2px solid rgba(255,255,255,0.75)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${fuel}%`,
                height: "100%",
                background:
                  fuel < 25
                    ? "linear-gradient(90deg, #ff5252, #d50000)"
                    : "linear-gradient(90deg, #81c784, #2e7d32)",
                transition: "width 0.3s",
              }}
            />
          </div>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 13, textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}>
            {fuel}%
          </span>
        </div>
      )}

      {/* Screen fades out for 3 seconds after the engine catches fire */}
      {overPhase === "fading" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#000",
            zIndex: 20,
            animation: "mtFadeOut 3s ease-in forwards",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Warning before the blast: the whole screen flashes red for 1 second */}
      {overPhase === "warning" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(255,0,0,0.9)",
            zIndex: 25,
            animation: "mtFadeOut 1s ease-in forwards",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Life lost popup: shows the remaining hearts, then CONTINUE from the checkpoint */}
      {overPhase === "lostLife" && (
        <div style={{ ...overlayStyle, background: "rgba(0,0,0,0.8)", zIndex: 30 }}>
          <div style={panelStyle}>
            <div style={{ fontSize: compact ? 15 : 18, fontWeight: 900, color: "#c62828" }}>LIFE LOST</div>
            <div style={{ display: "flex", gap: compact ? 6 : 10, justifyContent: "center", margin: "10px 0", fontSize: compact ? 30 : 42 }}>
              {Array.from({ length: LIVES_START }, (_, i) => (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    animation: i < lives ? "mtBounce 1.2s ease-in-out infinite" : "none",
                    filter: i < lives ? "none" : "grayscale(1) opacity(0.45)",
                  }}
                >
                  ❤️
                </span>
              ))}
            </div>
            <p style={{ margin: "0 0 6px", fontWeight: 800, color: "#5d4037" }}>
              {lives} li{lives === 1 ? "fe" : "ves"} left. Continue from the {(game.current.checkpoint / 10) | 0} m checkpoint.
            </p>
            <button onClick={continueRun} className="mt-btn" style={bigBtnStyle}>
              ▶ CONTINUE
            </button>
          </div>
        </div>
      )}

      {/* Try Again popup */}
      {(overPhase === "over" || overPhase === "nofuel" || (overPhase === "flipped" && lives === 0) || (overPhase === "blast" && lives === 0) || overPhase === "finished") && (
        <div style={{ ...overlayStyle, background: "#000", zIndex: 30 }}>
          <div style={panelStyle}>
            <div style={{ fontSize: 56, animation: "mtBounce 1.2s ease-in-out infinite" }}>💥</div>
            <h2 className="mt-title" style={{ margin: "4px 0 6px", fontSize: 30, fontWeight: 900 }}>
              {overPhase === "finished" ? (coins >= COIN_PASS ? `ROUND ${round} COMPLETE!` : "NOT ENOUGH COINS!") : overPhase === "blast" ? "TRUCK BLEW UP!" : overPhase === "nofuel" ? "OUT OF FUEL!" : overPhase === "flipped" ? "TRUCK FLIPPED!" : "ENGINE BLEW UP!"}
            </h2>
            <p style={{ margin: "0 0 6px", fontWeight: 700, color: "#5d4037" }}>
              {overPhase === "blast"
                ? "Boost and nitro were used together for too long. Use nitro in short bursts!"
                : overPhase === "nofuel"
                ? "You ran out of fuel before the next fuel station."
                : overPhase === "flipped"
                ? "The wheelie was held too long and the truck flipped. Keep wheelies short!"
                : overPhase === "finished"
                ? coins >= COIN_PASS
                  ? `3000 m complete! You collected ${coins}/${COIN_COUNT} coins.`
                  : `Only ${coins}/${COIN_COUNT} coins! You need ${COIN_PASS}. Try again!`
                : "The truck overheated. Try again!"}
            </p>
            <p style={{ margin: "0 0 4px", fontWeight: 800 }}>
              🏁 {distance} m &nbsp; ⭐ {stunts} stunts &nbsp; 🏆 Best: {best} m
            </p>
            {overPhase === "finished" && coins >= COIN_PASS ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                {round < ROUNDS && (
                  <button onClick={() => startRound(mapIdx, round + 1)} className="mt-btn" style={bigBtnStyle}>
                    ▶ NEXT ROUND
                  </button>
                )}
                <button onClick={toRoundSelect} className="mt-btn" style={{ ...bigBtnStyle, marginTop: 0, background: "#6d4c41" }}>
                  🏁 ROUND SELECT
                </button>
              </div>
            ) : (
              <button onClick={restart} className="mt-btn" style={bigBtnStyle}>
                ↻ TRY AGAIN
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top-right buttons: same size, same style */}
      {(screen === "playing" || screen === "paused") && (
        <div style={{ position: "absolute", top: 12, right: 12, display: "flex", alignItems: "center", gap: 10, zIndex: 5 }}>
          <button
            onClick={() => setScreen(screen === "playing" ? "paused" : "playing")}
            title={screen === "playing" ? "Pause" : "Play"}
            style={{ ...iconRoundStyle, width: Math.round(48 * cs), height: Math.round(48 * cs), flexDirection: "column", gap: 1 }}
          >
            {screen === "playing" ? <PauseGlyph /> : <PlayGlyph />}
            {hint("P")}
          </button>
          <div
            style={{
              display: "flex",
              gap: 2,
              padding: 4,
              borderRadius: 24,
              background: "rgba(60,40,20,0.6)",
              border: "2px solid rgba(255,255,255,0.8)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
            }}
          >
            <button
              title="Restart"
              onClick={() => {
                setTopSide("restart");
                restart();
              }}
              style={toggleSegStyle(topSide === "restart")}
            >
              <RestartGlyph />
            </button>
            <button
              title="Exit"
              onClick={() => {
                setTopSide("exit");
                exitGame();
              }}
              style={toggleSegStyle(topSide === "exit")}
            >
              <ExitGlyph />
            </button>
          </div>
        </div>
      )}

      {/* Left controls: drive */}
      <div style={{ position: "absolute", left: 14, bottom: 18, display: "flex", gap: 12 }}>
        <button {...holdProps("back")} style={ctrlStyle}>
          ◀
          {hint("← / A")}
        </button>
        <button {...holdProps("fwd")} style={ctrlStyle}>
          ▶
          {hint("→ / D")}
        </button>
      </div>

      {/* Right controls: stunts + jump */}
      <div style={{ position: "absolute", right: 14, bottom: 18, display: "flex", gap: 12, alignItems: "flex-end" }}>
        <button
          {...holdProps("nitroHeld")}
          style={{ ...ctrlStyle, width: Math.round(58 * cs), height: Math.round(58 * cs), fontSize: 14, background: "linear-gradient(135deg, #40c4ff, #1565c0)" }}
        >
          🚀
          {hint("N")}
        </button>
        <button {...holdProps("wheelieHeld")} style={{ ...ctrlStyle, width: Math.round(58 * cs), height: Math.round(58 * cs), fontSize: 14 }}>
          🌀
          {hint("G")}
        </button>
        <button {...holdProps("flipHeld")} style={{ ...ctrlStyle, width: Math.round(58 * cs), height: Math.round(58 * cs), fontSize: 14 }}>
          🔄
          {hint("F")}
        </button>
        <button
          {...jumpProps}
          style={{
            ...ctrlStyle,
            width: Math.round(76 * cs),
            height: Math.round(76 * cs),
            borderRadius: 38,
            background: "linear-gradient(135deg, #ff7043, #d84315)",
            fontSize: 15,
          }}
        >
          ⬆
          {hint("Space")}
        </button>
      </div>

      {screen === "paused" && (
        <div style={overlayStyle}>
          <div style={panelStyle}>
            <div style={{ fontSize: 36, animation: "mtBounce 1.4s ease-in-out infinite" }}>⏸️</div>
            <h2 className="mt-title" style={{ margin: "2px 0 14px", fontSize: 26, fontWeight: 900 }}>
              PAUSED
            </h2>

            <div style={{ marginBottom: 6, fontWeight: 800 }}>🔊 Volume: {volume}%</div>
            <input
              className="mt-slider"
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              style={{ width: "100%" }}
            />

            <button onClick={() => setScreen("playing")} className="mt-btn" style={bigBtnStyle}>
              ▶ Continue
            </button>

            <div style={{ marginTop: 18, fontWeight: 700 }}>🚚 Truck design</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 8, flexWrap: "wrap" }}>
              {THEMES.map((t, i) => (
                <button
                  key={t.name}
                  title={t.name}
                  className="mt-swatch"
                  onClick={() => setColorIdx(i)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    background: `linear-gradient(135deg, ${t.light}, ${t.body})`,
                    border: i === colorIdx ? "4px solid #3e2723" : "3px solid #fff",
                    boxShadow: i === colorIdx ? "0 0 14px rgba(255,152,0,0.9)" : "0 2px 6px rgba(0,0,0,0.25)",
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: 13, marginTop: 6 }}>{THEMES[colorIdx].name}</div>
          </div>
        </div>
      )}
    </div>
  );
}