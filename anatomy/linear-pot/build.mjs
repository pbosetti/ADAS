// Linear resistive transducer (wire-wound potentiometer) feeding an oscilloscope.
// node anatomy/linear-pot/build.mjs [--light] [--out path.html]
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import { kitScript } from "../scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const outArg = process.argv.indexOf("--out");
const OUT = outArg > 0 ? resolve(process.argv[outArg + 1]) : join(HERE, theme === "light" ? "linear-pot-light.html" : "linear-pot.html");

// --- Model (true numbers) ---------------------------------------------------
const MODEL = { stroke: 100, turns: 50, vs: 10, rv: 10e3, rl: 1e6 };

const WIDTH = 600;
const HEIGHT = 430;

const PLATE = { x: -198, y: -106, w: 374, d: 168, r: 10 };
const PLATE_H = 10;
const FOOT_H = 5;

const SUP = { x: -190, y: -98, w: 60, d: 48, r: 4 };
const SUP_FRONT = SUP.y + SUP.d;
const SUP_TOP = 54;
const SUP_WIN = { x0: -182, x1: -150, z0: 36, z1: 47, r: 1.6, depth: 1.6 };
const POSTS = [[-174, 18], [-160, 18]];

const SC = { x: -118, y: -100, w: 198, d: 68, r: 6 };
const FRONT = SC.y + SC.d;
const SIDE = SC.x + SC.w;
const SC_TOP = 124;
const PLINTH_H = 5;
const BEZEL = { x0: -46, x1: 66, z0: 17, z1: 113, r: 5, depth: 1.6 };
const GLASS = { x0: -40, x1: 60, z0: 24, z1: 104, r: 3, depth: 3 };
const GLASS_Y = FRONT - BEZEL.depth - GLASS.depth;
const DIV = 10;
const ZERO_Z = GLASS.z0 + DIV;
const V_PER_DIV = 2;
const S_PER_DIV = 0.5;
const KNOBS = [[-98, 96, 7], [-70, 96, 4.6], [-98, 70, 7], [-70, 70, 4.6]];
const BNC = [[-98, 24], [-70, 24]];

const TB = { x: -180, y: 14, w: 24, d: 24, r: 2 };
const TB_TOP = 22;
const TERMS = [-174, -168, -162];

const HOUSING = { x: -156, y: 14, w: 142, d: 24, r: 1.5 };
const FLOOR_Z = 6;
const IN_Z = 10;
const WALL_TOP = 26;
const TRACK = { x: -146, y: 26, w: 104, d: 8, r: 0.6 };
const TRACK_TOP = 13;
const PITCH = MODEL.stroke / MODEL.turns;
const X0 = -144;
const COLL = { x: -146, y: 17.5, w: 104, d: 3, r: 0.5 };
const ROD_Y = 22;
const ROD_Z = 19.5;
const ROD_R = 2.2;
const ROD_L = 160;
const GLAND = -11;
const CAP_X = -19;
const TIP0 = X0 + ROD_L;

const RAIL_FROM = -6;
const RAIL_TO = 162;
const RULER = { x: TIP0 + 11, y: 44, w: 108, d: 7, r: 1 };

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(SC, 0, SC_TOP + 8)],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 60 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const planeOf = (y) => k.sideMatrix([0, y], 0, P, "left");
const flat = (x0, z0, x1, z1, r, steps = 6) => k.pathOf(k.roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, steps).map(([u, z]) => [u, -z]), true);
const sideSlot = (x, y, z0, z1, half = 0.8) => k.pathOf(k.roundedPlan({ x: y - half, y: z0, w: half * 2, d: z1 - z0, r: half }, 4).map(([u, z]) => at([x, u, z])), true);
const alongY = (x, y, z) => G.frameAlong([x, y, z], [0, 1, 0]);
const alongX = (x, y, z) => G.frameAlong([x, y, z], [1, 0, 0]);

let clips = 0;
function recess({ x0, x1, z0, z1, r, depth }, y, back = "", backClass = "lp-well", inside = "") {
  const id = `lp-clip-${clips++}`;
  const ring = k.roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, 6);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const { sinA } = k.cameraOf(P);
  const tops = [];
  const sides = [[], [], [], []];
  ring.forEach(([ax, az], index) => {
    const [bx, bz] = ring[(index + 1) % ring.length];
    const length = Math.hypot(bx - ax, bz - az) || 1;
    let [nx, nz] = [(bz - az) / length, -(bx - ax) / length];
    if (nx * (cx - (ax + bx) / 2) + nz * (cz - (az + bz) / 2) < 0) [nx, nz] = [-nx, -nz];
    if (nx <= 0 && nz <= 0) return;
    const quad = k.pathOf([at([ax, y, az]), at([bx, y, bz]), at([bx, y - depth, bz]), at([ax, y - depth, az])], true);
    if (nz >= nx) tops.push(quad);
    else sides[Math.min(3, Math.max(0, Math.floor(((nx * -sinA + 1) / 2) * 4)))].push(quad);
  });
  const shape = flat(x0, z0, x1, z1, r);
  return [
    `<clipPath id="${id}"><path transform="${planeOf(y)}" d="${shape}"/></clipPath>`,
    `<g clip-path="url(#${id})">`,
    `<path class="iso-top" d="${tops.join("")}"/>`,
    ...sides.map((d, shade) => (d.length ? `<path class="iso-shade" data-shade="${shade}" d="${d.join("")}"/>` : "")),
    `<g transform="${planeOf(y - depth)}"><path class="${backClass}" d="${shape}"/>${back}<path class="iso-line" data-tone="faint" d="${shape}"/></g>`,
    inside,
    `</g>`,
    `<g transform="${planeOf(y)}"><path class="iso-line" data-tone="lo" d="${shape}"/></g>`,
  ].join("");
}

// A knob on a vertical face pointing +y: skirt, knurled cap, pointer.
function knob(x, z, r, y, angle = -0.6) {
  const out = [];
  const F = alongY(x, y, z);
  out.push(S(G.disc(0, 1.2, r + 1.6, F, P), { tone: "mid" }));
  out.push(S(G.disc(1.2, 5, r, F, P), { tone: "mid" }));
  out.push(k.fadedSvg(G.ribsOf(F, 1.2, 5, r, Math.round(r * 6), P, { fade: [0.1, 0.55], seams: "first" }), { tone: "lo" }));
  const tip = at(G.pointOf(F, 5, r * 0.8, angle));
  const tail = at(G.pointOf(F, 5, r * 0.15, angle));
  out.push(L(k.pathOf([tail, tip]), { tone: "hi", free: true }));
  return out.join("");
}

function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  const label = { x: -186, y: 44, w: 46, d: 10, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 3), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([label.x + 4, label.y + 6.4], 0.8, P, "x"), "POT 100 mm", { size: 3.6, tone: "mid" }));
  out.push(D([at([label.x + label.w - 3, label.y + 3, 0.8]), at([label.x + label.w - 3, label.y + label.d - 3, 0.8])], { size: 0.45 }));
  // ruler under the carriage index: 0..100 mm
  out.push(S(k.slabOf(RULER, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(RULER.x + 4, RULER.x + 104, 2, 5, RULER.y + 0.8, 0.6, [2, 3.8], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([RULER.x + 2, RULER.y + RULER.d / 2, 0.6]), at([RULER.x + RULER.w - 2, RULER.y + RULER.d / 2, 0.6])], { size: 0.45 }));
  return out.join("");
}

function supply() {
  const out = [`<path class="iso-halo" d="${k.haloOf(SUP, 0, 6, P)}"/>`];
  out.push(S(k.slabOf(k.insetPlan(SUP, 2.5), 0, 3, P, 4), { tone: "lo" }));
  out.push(S(k.slabOf(SUP, 3, SUP_TOP - 3, P, 4, 1), { tone: "mid", inner: L(k.sideSeam(SUP, SUP_TOP - 8, P, 4), { tone: "faint" }) }));
  const right = SUP.x + SUP.w;
  const rowOf = (from, to, step) => Array.from({ length: Math.floor((to - from) / step + 1e-9) + 1 }, (_, i) => from + i * step);
  out.push(L(rowOf(SUP.y + 10, SUP.y + 36, 3.2).map((y) => sideSlot(right, y, 14, 36)).join(""), { tone: "faint" }));
  out.push(L(k.planOutline({ x: SUP.x + 10, y: SUP.y + 12, w: 40, d: 22, r: 2 }, SUP_TOP, P, 4), { tone: "faint" }));
  out.push(D(k.corners({ x: SUP.x + 10, y: SUP.y + 12, w: 40, d: 22, r: 2 }, 3).map(([x, y]) => at([x, y, SUP_TOP])), { size: 0.4 }));
  const digits = `<text class="lp-seg" x="${SUP_WIN.x1 - 2}" y="${-(SUP_WIN.z0 + 2.6)}" font-size="7" text-anchor="end">10.00</text>`;
  out.push(recess(SUP_WIN, SUP_FRONT, digits, "lp-glass"));
  out.push(`<g transform="${planeOf(SUP_FRONT)}"><text class="iso-face-text" data-tone="lo" x="${SUP_WIN.x1 + 2}" y="${-(SUP_WIN.z0 + 3)}" font-size="4">V</text></g>`);
  out.push(knob(-140, 41, 4.6, SUP_FRONT, 0.5));
  out.push(knob(-140, 27, 3.4, SUP_FRONT, -0.9));
  for (const [index, [x, z]] of POSTS.entries()) {
    const F = alongY(x, SUP_FRONT, z);
    out.push(S(G.disc(0, 1.6, 4.2, F, P), { tone: "lo" }));
    out.push(S(G.disc(1.6, 6.5, 3, F, P), { tone: index === 0 ? "hi" : "mid" }));
    out.push(k.fadedSvg(G.ribsOf(F, 1.6, 6.5, 3, 18, P, { fade: [0.1, 0.55], seams: "first" }), { tone: "lo" }));
  }
  out.push(D([at([-146, SUP_FRONT, 18])], { size: 0.8, tone: "hi" }));
  return out.join("");
}

function scopeScreen() {
  const grid = [];
  for (let i = 1; i < 10; i++) grid.push(`M${GLASS.x0 + i * DIV} ${-GLASS.z0}V${-GLASS.z1}`);
  for (let j = 1; j < 8; j++) grid.push(`M${GLASS.x0} ${-(GLASS.z0 + j * DIV)}H${GLASS.x1}`);
  const ticks = [];
  const midX = GLASS.x0 + 5 * DIV;
  const midZ = GLASS.z0 + 4 * DIV;
  for (let u = GLASS.x0 + 2; u < GLASS.x1; u += 2) ticks.push(`M${u} ${-(midZ - 0.9)}V${-(midZ + 0.9)}`);
  for (let z = GLASS.z0 + 2; z < GLASS.z1; z += 2) ticks.push(`M${midX - 0.9} ${-z}H${midX + 0.9}`);
  const ground = `M${GLASS.x0} ${-(ZERO_Z + 2.2)}L${GLASS.x0 + 3.2} ${-ZERO_Z}L${GLASS.x0} ${-(ZERO_Z - 2.2)}Z`;
  const text = (x, z, s, anchor = "start", part = "") => `<text class="lp-text"${part ? ` data-part="${part}"` : ""} x="${x}" y="${-z}" font-size="3.6" text-anchor="${anchor}">${s}</text>`;
  const back = [
    `<path class="lp-grid" d="${grid.join("")}"/>`,
    `<path class="lp-grid" d="${ticks.join("")}"/>`,
    `<path class="lp-mark" d="${ground}"/>`,
    text(GLASS.x0 + 2.4, GLASS.z1 - 5, `CH1 ${V_PER_DIV.toFixed(2)} V/div`),
    text(GLASS.x1 - 7, GLASS.z1 - 5, `ROLL ${S_PER_DIV * 1000} ms/div`, "end"),
    text(GLASS.x1 - 7, GLASS.z0 + 3, "", "end", "vout"),
    `<path class="lp-glow" data-part="glow" d=""/>`,
    `<path class="lp-trace" data-part="trace" d=""/>`,
    `<circle class="lp-head" data-part="head" cx="${GLASS.x1}" cy="${-ZERO_Z}" r="0.9"/>`,
  ].join("");
  return recess(BEZEL, FRONT, "", "lp-bezel", recess(GLASS, FRONT - BEZEL.depth, back, "lp-glass"));
}

function scope() {
  const out = [`<path class="iso-halo" d="${k.haloOf(SC, 0, 8, P)}"/>`];
  for (const [x, y] of byDepth([[SC.x + 12, SC.y + 10], [SIDE - 12, SC.y + 10]])) out.push(S(k.cylinder(x, y, 3.4, 0, PLINTH_H, P, 20), { tone: "lo" }));
  out.push(S(k.slabOf(k.insetPlan(SC, 3), 0, PLINTH_H, P, 6), { tone: "lo" }));
  const seam = FRONT - 10;
  out.push(S(k.slabOf(SC, PLINTH_H, SC_TOP - PLINTH_H, P, 6, 1.4), { tone: "mid", inner: L(k.sideSeam(SC, PLINTH_H + 6, P, 6), { tone: "faint" }) }));
  out.push(L(k.lineOnTop([SC.x, seam], [SIDE, seam], SC_TOP, P) + k.segment([SIDE, seam, SC_TOP], [SIDE, seam, PLINTH_H], P), { tone: "lo" }));
  // side vents
  const rowOf = (from, to, step) => Array.from({ length: Math.floor((to - from) / step + 1e-9) + 1 }, (_, i) => from + i * step);
  out.push(L(rowOf(SC.y + 10, SC.y + 46, 3.2).map((y) => sideSlot(SIDE, y, SC_TOP - 40, SC_TOP - 12)).join(""), { tone: "faint" }));
  out.push(L(rowOf(SC.y + 10, SC.y + 46, 3.2).map((y) => sideSlot(SIDE, y, 18, 34)).join(""), { tone: "faint" }));
  // carrying handle on the top
  const lugs = [[SC.x + 40, SC.y + 30], [SIDE - 40, SC.y + 30]];
  for (const [x, y] of lugs) out.push(S(k.slabOf({ x: x - 4, y: y - 5, w: 8, d: 10, r: 1.5 }, SC_TOP, 4, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: SC.x + 36, y: SC.y + 27, w: SIDE - SC.x - 72, d: 6, r: 3 }, SC_TOP + 4, 3, P, 6, 0.5), { tone: "mid" }));
  out.push(D(lugs.map(([x, y]) => at([x, y + 3.4, SC_TOP + 4])), { size: 0.45 }));
  // top label plate
  const label = { x: SIDE - 46, y: SC.y + 46, w: 34, d: 12, r: 1.2 };
  out.push(L(k.planOutline(label, SC_TOP, P, 3), { tone: "lo" }));
  out.push(L([24, 16, 20].map((w, i) => k.lineOnTop([label.x + 4, label.y + 3 + i * 3], [label.x + 4 + w, label.y + 3 + i * 3], SC_TOP, P)).join(""), { tone: "lo", free: true }));
  // front
  out.push(`<g transform="${planeOf(FRONT)}"><path class="iso-line" data-tone="faint" d="${flat(SC.x + 4, PLINTH_H + 4, SIDE - 4, SC_TOP - 4, 4)}"/></g>`);
  out.push(scopeScreen());
  out.push(`<g transform="${planeOf(FRONT)}"><path class="iso-line" data-tone="lo" d="${flat(-112, 12, -54, 110, 3)}"/><path class="iso-line" data-tone="faint" d="M-112 -56H-54"/></g>`);
  for (const [x, z, r] of KNOBS) out.push(knob(x, z, r, FRONT, x < -80 ? -0.4 : 0.9));
  const buttons = [-106, -95, -84, -73, -62];
  out.push(buttons.map((x) => S(k.slabOf({ x, y: FRONT, w: 7, d: 1.6, r: 0.5 }, 44, 4, P, 2), { tone: "mid" })).join(""));
  out.push(`<g transform="${planeOf(FRONT)}"><path class="iso-line" data-tone="faint" d="${["M-112 -38H-54"].join("")}"/></g>`);
  out.push(D([at([-102.5, FRONT, 50.5])], { size: 0.7, tone: "hi" }));
  for (const [index, [x, z]] of BNC.entries()) {
    const F = alongY(x, FRONT, z);
    out.push(S(G.disc(0, 1.4, 5.2, F, P), { tone: "lo" }));
    out.push(S(G.disc(1.4, 7, 3.2, F, P), { tone: "mid" }));
    if (index === 1) {
      out.push(L(G.circleOf(F, 7, 2.2, P), { tone: "lo" }));
      out.push(D([at(G.pointOf(F, 7, 0, 0))], { size: 0.6, tone: "mid" }));
    }
  }
  return out.join("");
}

function terminalBlock() {
  const out = [`<path class="iso-halo" d="${k.haloOf(TB, 0, 4, P)}"/>`];
  out.push(S(k.slabOf(TB, 0, TB_TOP, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(TB, 6, P, 3), { tone: "faint" }) }));
  for (const x of TERMS) {
    out.push(S(k.cylinder(x, TB.y + 12, 2.4, TB_TOP, 1.6, P, 20), { tone: "hi", crease: "lo" }));
    out.push(L(k.lineOnTop([x - 1.8, TB.y + 12], [x + 1.8, TB.y + 12], TB_TOP + 1.6, P), { tone: "lo" }));
  }
  out.push(D([at([TB.x + 3, TB.y + 3, TB_TOP]), at([TB.x + 3, TB.y + TB.d - 3, TB_TOP])], { size: 0.45 }));
  return out.join("");
}

// Leads: smooth 3D polylines that end on a plug, a BNC or a terminal screw.
function leadPoints(points, perSegment = 10) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < perSegment; s++) {
      const t = s / perSegment, t2 = t * t, t3 = t2 * t;
      out.push([0, 1, 2].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

function lead(points, cls) {
  const flatPts = leadPoints(points).map(at);
  const d = k.pathOf(flatPts);
  return `<path class="lp-lead-under" d="${d}"/><path class="lp-lead ${cls}" d="${d}"/>${D([flatPts[0], flatPts[flatPts.length - 1]], { size: 0.7, tone: "mid" })}`;
}

function leads() {
  const out = [];
  const plugEnd = (x, z, s0, s1, r) => {
    const F = alongY(x, SUP_FRONT, z);
    out.push(S(G.disc(s0, s1, r, F, P), { tone: "mid" }));
    return G.pointOf(F, s1, 0, 0);
  };
  const top = (x) => [x, TB.y + 12, TB_TOP + 1.6];
  const pA = plugEnd(POSTS[0][0], POSTS[0][1], 6.5, 12, 2.2);
  const pC = plugEnd(POSTS[1][0], POSTS[1][1], 6.5, 12, 2.2);
  const FB = alongY(BNC[0][0], FRONT, BNC[0][1]);
  out.push(S(G.disc(7, 15, 3.8, FB, P), { tone: "mid" }));
  out.push(k.fadedSvg(G.ribsOf(FB, 7, 15, 3.8, 22, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }));
  out.push(S(G.disc(15, 19, 2.4, FB, P), { tone: "lo" }));
  const pB = G.pointOf(FB, 19, 0, 0);
  const [a, c, b] = TERMS.map(top);
  out.push(lead([a, [a[0], a[1] - 3, a[2] + 5], [a[0] + 1, a[1] - 30, a[2] + 6], [pA[0] - 1, pA[1] + 14, pA[2] + 4], pA], "lp-plus"));
  out.push(lead([c, [c[0], c[1] - 3, c[2] + 5], [c[0] + 2, c[1] - 26, c[2] + 5], [pC[0] - 1, pC[1] + 14, pC[2] + 4], pC], "lp-minus"));
  out.push(lead([b, [b[0], b[1] - 3, b[2] + 6], [b[0] + 4, b[1] - 18, b[2] + 7], [b[0] + 30, pB[1] + 20, pB[2] + 9], [pB[0] - 2, pB[1] + 9, pB[2] + 3], pB], "lp-coax"));
  return out.join("");
}

function housingBack() {
  const out = [`<path class="iso-halo" d="${k.haloOf(HOUSING, 0, 4, P)}"/>`];
  for (const x of [-146, -36]) {
    const foot = { x, y: 10, w: 12, d: 32, r: 1.5 };
    out.push(S(k.slabOf(foot, 0, FLOOR_Z, P, 3, 0.4), { tone: "lo" }));
    out.push(D([at([x + 6, 12.2, FLOOR_Z]), at([x + 6, 39.8, FLOOR_Z])], { size: 0.45 }));
  }
  out.push(S(k.slabOf(HOUSING, FLOOR_Z, IN_Z - FLOOR_Z, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: HOUSING.x, y: HOUSING.y, w: HOUSING.w, d: 3, r: 0.6 }, IN_Z, WALL_TOP - IN_Z, P, 2, 0.3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: HOUSING.x, y: 17, w: 6, d: 21, r: 0.6 }, IN_Z, WALL_TOP - IN_Z, P, 2, 0.3), { tone: "mid" }));
  out.push(D([at([HOUSING.x + 3, 21, WALL_TOP]), at([HOUSING.x + 3, 34, WALL_TOP])], { size: 0.45 }));
  // collector strip, then the wire-wound track (back to front)
  out.push(S(k.slabOf(TRACK, IN_Z, TRACK_TOP - IN_Z, P, 2), { tone: "hi", crease: "lo" }));
  const turns = [];
  for (let i = 0; i <= MODEL.turns; i++) {
    const x = X0 + i * PITCH;
    turns.push(k.lineOnTop([x, TRACK.y], [x + 0.7, TRACK.y + TRACK.d], TRACK_TOP, P) + k.segment([x + 0.7, TRACK.y + TRACK.d, TRACK_TOP], [x + 0.7, TRACK.y + TRACK.d, IN_Z], P));
  }
  out.push(L(turns.join(""), { tone: "mid" }));
  for (const x of [TRACK.x - 3, TRACK.x + TRACK.w]) out.push(S(k.slabOf({ x, y: TRACK.y - 1, w: 3, d: TRACK.d + 2, r: 0.5 }, IN_Z, 4.4, P, 2), { tone: "mid" }));
  out.push(S(k.slabOf(COLL, IN_Z, 2, P, 2), { tone: "mid" }));
  out.push(D([at([COLL.x + 2, COLL.y + 1.5, IN_Z + 2]), at([COLL.x + COLL.w - 2, COLL.y + 1.5, IN_Z + 2])], { size: 0.4 }));
  return out.join("");
}

const ROD_F = alongX(0, ROD_Y, ROD_Z);
const ROD = G.rodOut(ROD_F, GLAND, TIP0, ROD_R, P, { stroke: MODEL.stroke });

function wiper() {
  const out = [];
  const w = X0;
  out.push(S(G.disc(w + 5, TIP0, ROD_R, ROD_F, P), { tone: "mid" }));
  out.push(S(k.slabOf({ x: w - 1, y: COLL.y + 0.5, w: 2, d: 2, r: 0.6 }, IN_Z + 2, 5, P, 2), { tone: "mid" }));
  const block = { x: w - 5, y: 15.5, w: 10, d: 11.5, r: 1.2 };
  out.push(S(k.slabOf(block, 16.5, 6.5, P, 3, 0.5), { tone: "hi", crease: "lo" }));
  out.push(D([at([w - 2.6, 18, 23]), at([w + 2.6, 18, 23])], { size: 0.45 }));
  // leaf spring reaching forward from the block, its tip pressing on one turn
  out.push(S(k.slabOf({ x: w - 1.2, y: block.y + block.d, w: 2.4, d: 4.5, r: 0.4 }, 17.6, 1, P, 2), { tone: "hi", lit: true }));
  out.push(S(k.slabOf({ x: w - 0.9, y: TRACK.y + 3.4, w: 1.8, d: 1.8, r: 0.6 }, TRACK_TOP, 5.6, P, 2), { tone: "hi", lit: true }));
  return out.join("");
}

function housingFront() {
  const out = [];
  out.push(S(k.slabOf({ x: CAP_X, y: 17, w: 5, d: 21, r: 0.6 }, IN_Z, WALL_TOP - IN_Z, P, 2, 0.3), { tone: "mid" }));
  out.push(D([at([CAP_X + 2.5, 21, WALL_TOP]), at([CAP_X + 2.5, 34, WALL_TOP])], { size: 0.45 }));
  const F = alongX(CAP_X + 5, ROD_Y, ROD_Z);
  out.push(S(G.disc(0, GLAND - CAP_X - 5, 4.8, F, P), { tone: "mid" }));
  out.push(L(G.circleOf(F, GLAND - CAP_X - 5, ROD_R + 0.5, P), { tone: "faint" }));
  out.push(S(k.slabOf({ x: HOUSING.x + 6, y: 35, w: HOUSING.w - 11, d: 3, r: 0.6 }, IN_Z, 4, P, 2, 0.3), { tone: "mid" }));
  return out.join("");
}

function rails() {
  const out = [];
  for (const y of [16, 31]) {
    out.push(S(k.slabOf({ x: RAIL_FROM, y, w: RAIL_TO - RAIL_FROM, d: 5, r: 1 }, 0, 3, P, 3, 0.4), { tone: "mid" }));
    out.push(D([RAIL_FROM + 6, RAIL_TO - 6].map((x) => at([x, y + 2.5, 3])), { size: 0.4 }));
  }
  for (const x of [RAIL_FROM - 5, RAIL_TO]) {
    out.push(S(k.slabOf({ x, y: 13, w: 5, d: 26, r: 1.2 }, 0, 7, P, 3, 0.5), { tone: "mid" }));
    out.push(D([at([x + 2.5, 17, 7]), at([x + 2.5, 35, 7])], { size: 0.45 }));
  }
  return out.join("");
}

function carriage() {
  const t = TIP0;
  const base = { x: t - 1, y: 13, w: 32, d: 26, r: 2.5 };
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(base, 3), 3, 0.1, P)}" style="filter:blur(4px)"/>`];
  out.push(S(k.slabOf(base, 3, 6, P, 5, 0.6), { tone: "mid" }));
  out.push(D([4, 12, 20, 28].map((dx) => at([t + dx, base.y + base.d - 2.4, 9])), { size: 0.4, tone: "lo" }));
  const lug = { x: t, y: ROD_Y - 6, w: 8, d: 12, r: 1 };
  out.push(S(k.slabOf(lug, 9, ROD_Z + 5 - 9, P, 3, 0.4), { tone: "mid" }));
  out.push(L(G.circleOf(G.frameAlong([t + 8, ROD_Y, ROD_Z], [1, 0, 0]), 0, ROD_R, P), { tone: "lo" }));
  out.push(S(k.cylinder(t + 4, ROD_Y, 1.8, ROD_Z + 5, 1.6, P, 16), { tone: "mid" }));
  // index pointer over the ruler
  const idx = t + 15;
  out.push(S(k.slabOf({ x: idx - 1.5, y: base.y + base.d, w: 3, d: 6.5, r: 0.6 }, 3, 1.4, P, 2), { tone: "hi" }));
  out.push(L(k.lineOnTop([idx, base.y + base.d], [idx, base.y + base.d + 6.5], 4.4, P), { tone: "hi" }));
  // knurled push knob on the right end
  const F = alongX(t + 31, 26, 6);
  out.push(S(G.disc(0, 2, 3, F, P), { tone: "mid" }));
  out.push(S(G.disc(2, 9, 5, F, P), { tone: "mid" }));
  out.push(k.fadedSvg(G.ribsOf(F, 2, 9, 5, 30, P, { fade: [0.1, 0.55], seams: "first" }), { tone: "lo" }));
  return out.join("");
}

const move = (dx) => k.translateAlong(P, [dx, 0, 0]);
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  className: "lp-svg",
  label:
    "A wire-wound linear potentiometer with its cover off, on a bench plate. A bench supply feeds 10 V across the wound track; the wiper rides on the turns and is pushed by a rod from a carriage on rails. The wiper voltage goes by coax to an oscilloscope, whose roll-mode trace rises and falls with the carriage position.",
  body: [
    plate(),
    supply(),
    scope(),
    terminalBlock(),
    leads(),
    housingBack(),
    `<g data-part="wiper" transform="${move(0)}">${wiper()}</g>`,
    housingFront(),
    rails(),
    `<g data-part="rod" transform="${move(0)}"><clipPath id="lp-rod"><path data-hold d="${ROD.clip}"/></clipPath><g clip-path="url(#lp-rod)">${S(ROD.paths, { tone: "mid" })}</g></g>`,
    `<g data-part="carriage" transform="${move(0)}">${carriage()}</g>`,
  ],
});

const CSS = `
.lp-svg{--lp-glass:#1c2320;--lp-grid:#3b4a43;--lp-text:#9db3a6;--lp-trace:#d9f36c;--lp-seg:#ff8a5c}
.iso[data-theme="dark"] .lp-svg{--lp-glass:#070a08;--lp-grid:#26322c}
.lp-glass{fill:var(--lp-glass)}
.lp-bezel{fill:var(--anatomy-shade-1)}
.lp-well{fill:var(--anatomy-shade-0)}
.lp-grid{fill:none;stroke:var(--lp-grid);stroke-width:.35;vector-effect:none}
.lp-mark{fill:var(--lp-text);opacity:.8}
.lp-text{fill:var(--lp-text);font-family:var(--anatomy-mono);letter-spacing:.02em}
.lp-seg{fill:var(--lp-seg);font-family:var(--anatomy-mono);letter-spacing:.06em}
.lp-trace{fill:none;stroke:var(--lp-trace);stroke-width:.7;stroke-linejoin:round;stroke-linecap:round;vector-effect:none}
.lp-glow{fill:none;stroke:var(--lp-trace);stroke-width:2.6;opacity:.22;stroke-linejoin:round;stroke-linecap:round;vector-effect:none;filter:blur(.8px)}
.lp-head{fill:#fff;opacity:.9}
.lp-lead-under{fill:none;stroke:var(--anatomy-paper);stroke-width:3.6;stroke-linecap:round;stroke-linejoin:round}
.lp-lead{fill:none;stroke:var(--anatomy-mid);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.lp-lead.lp-plus{stroke:var(--anatomy-hi)}
.lp-lead.lp-coax{stroke-width:2.2}
.lp-stage{outline:none;touch-action:pan-y;cursor:ew-resize}
.lp-stage:focus-visible{outline:1px solid var(--anatomy-mid);outline-offset:4px}
body.lp-embed[data-theme="light"]{--anatomy-card:#fff;--anatomy-page:#fff}
body.lp-embed{background:var(--anatomy-card)}
body.lp-embed .iso-page{width:100%;margin:0}
body.lp-embed .iso-figure{margin:0}
body.lp-embed .iso-plate{box-shadow:none;padding:34px 8px 30px}
body.lp-embed .iso-plate-corners{inset:8px 10px}
`;

const live = `
const P = ${JSON.stringify(P)};
const M = ${JSON.stringify(MODEL)};
const G0 = ${JSON.stringify({ x0: GLASS.x0, x1: GLASS.x1, z0: GLASS.z0, z1: GLASS.z1, zero: ZERO_Z, div: DIV, vdiv: V_PER_DIV, sdiv: S_PER_DIV })};
const stage = document.querySelector(".lp-stage");
const svg = stage.querySelector("svg");
const parts = Object.fromEntries(["wiper", "rod", "carriage", "trace", "glow", "head", "vout"].map((name) => [name, svg.querySelector('[data-part="' + name + '"]')]));
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const pitch = M.stroke / M.turns;
// wiper sits on one turn at a time: the output moves in steps of Vs/N
const vOut = (x) => {
  const d = Math.round(clamp(x, 0, M.stroke) / pitch) / M.turns;
  return M.vs * d / (1 + d * (1 - d) * M.rv / M.rl);
};
const RATE = 50, SPAN = 10 * G0.sdiv, COUNT = Math.round(SPAN * RATE);
const samples = new Float32Array(COUNT).fill(vOut(0));
let x = 0, target = 0, prevX = 0, clock = 0, sampleClock = 0, frame = 0, last = 0, touring = true, visible = false, idleTimer = 0, tourClock = 0;
const tour = [0, 80, 30, 100, 55, 15, 70];
let seed = 7;
const noise = () => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647) * 2 - 1; };
const zOf = (v) => G0.zero + (v / G0.vdiv) * G0.div;
function drawTrace() {
  const du = (G0.x1 - G0.x0) / (COUNT - 1);
  let d = "";
  for (let i = 0; i < COUNT; i++) {
    const z = clamp(zOf(samples[i]), G0.z0 + 0.6, G0.z1 - 0.6);
    d += (i ? "L" : "M") + (G0.x0 + i * du).toFixed(2) + " " + (-z).toFixed(2);
  }
  parts.trace.setAttribute("d", d);
  parts.glow.setAttribute("d", d);
  parts.head.setAttribute("cy", (-clamp(zOf(samples[COUNT - 1]), G0.z0, G0.z1)).toFixed(2));
}
function draw() {
  const m = translateAlong(P, [x, 0, 0]);
  parts.wiper.setAttribute("transform", m);
  parts.carriage.setAttribute("transform", m);
  parts.rod.setAttribute("transform", m);
  const off = m.match(/-?[\\d.]+/g).map(Number);
  holdStill(parts.rod, off);
  const v = vOut(x);
  parts.vout.textContent = "Vout " + v.toFixed(2) + " V";
  const text = "x " + x.toFixed(1) + " mm · Vout " + v.toFixed(2) + " V";
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", x.toFixed(0));
  stage.setAttribute("aria-valuetext", text);
  drawTrace();
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) { tourClock += dt; target = tour[Math.floor(tourClock / 1.7) % tour.length]; }
  x = calm ? target : x + (target - x) * (1 - Math.exp(-dt / 0.45));
  if (Math.abs(target - x) < 0.02) x = target;
  const speed = Math.abs(x - prevX) / dt;
  prevX = x;
  sampleClock += dt;
  while (sampleClock >= 1 / RATE) {
    sampleClock -= 1 / RATE;
    samples.copyWithin(0, 1);
    samples[COUNT - 1] = vOut(x) + noise() * 0.06 * Math.min(1, speed / 40);
  }
  draw();
  frame = visible && !calm ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } if (still.matches) { x = target; samples.fill(vOut(x)); draw(); } };
const steer = (next) => {
  touring = false;
  target = clamp(next, 0, M.stroke);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; tourClock = 0; run(); }, 4000);
  run();
};
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) touring = false;
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  steer(((event.clientX - box.left) / box.width - 0.3) / 0.55 * M.stroke);
});
stage.addEventListener("keydown", (event) => {
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = target + 5;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = target - 5;
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = M.stroke;
  if (to === null) return;
  event.preventDefault();
  steer(to);
});
draw();
`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "Trasduttore resistivo",
  hint: "Muovi il puntatore: sposta il cursore",
  readout: `x 0.0 mm · Vout 0.00 V`,
  keys: [],
  caption: "",
  body: `<div class="iso-stage lp-stage" tabindex="0" role="slider" aria-label="Linear potentiometer: arrow keys move the wiper" aria-valuemin="0" aria-valuemax="${MODEL.stroke}" aria-valuenow="0">${svg}</div>`,
});

const html = k
  .pageHtml({ title: "Linear potentiometer", theme, body, script: kitScript() + live })
  .replace("</style>", `${CSS}</style>`)
  .replace(`<body class="iso"`, `<body class="iso lp-embed"`);
writeFileSync(OUT, html);
console.log("wrote", OUT);
