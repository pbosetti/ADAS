// Michelson laser interferometer on an optical breadboard.
// node anatomy/interferometer/build.mjs [--light] [--out path.html]
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import { kitScript } from "../scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const outArg = process.argv.indexOf("--out");
const OUT = outArg > 0 ? resolve(process.argv[outArg + 1]) : join(HERE, theme === "light" ? "interferometer-light.html" : "interferometer.html");

// --- Model -------------------------------------------------------------------
// HeNe laser, 632.8 nm. The drawing shows the wave 10 units long, so every drawn
// unit of mirror travel is 63.28 nm of real travel.
const MODEL = { lambda: 632.8, lambdaDrawn: 10, travel: 20, speed: 22 };

const WIDTH = 600;
const HEIGHT = 470;

const PLATE = { x: -180, y: -146, w: 304, d: 266, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;
const H = 44;

const L1 = 80;
const L2 = 80;
const LASER = { from: -160, to: -72, r: 10, nose: -62 };
const BS = 7;
const SUP = { x: -172, y: -134, w: 46, d: 32, r: 3 };
const SUP_TOP = 30;
const STAGE = { x: -22, y: -140, w: 44, d: 54, r: 2 };
const STAGE_TOP = 22;
const HOUSE_Y = -127;
const CAR_D = 14;
const DET = { y0: 72, y1: 88, r: 7 };
const BOX = { x: 34, y: 64, w: 70, d: 40, r: 3 };
const BOX_TOP = 30;
const BOX_FRONT = BOX.y + BOX.d;
const WIN = { x0: 40, x1: 92, z0: 5, z1: 25, r: 1.6, depth: 1.6 };

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [L1 + 20, 0, H + 18], [0, -L2 - 20, H + 18], [LASER.from, 0, H + 12]],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 45, elevation: 34 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const planeY = (y) => k.sideMatrix([0, y], 0, P, "left");
const flat = (x0, z0, x1, z1, r, steps = 6) => k.pathOf(k.roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, steps).map(([u, z]) => [u, -z]), true);
const along = (o, a) => G.frameAlong(o, a);

let clips = 0;
function recess({ x0, x1, z0, z1, r, depth }, y, back = "", backClass = "if-well") {
  const id = `if-clip-${clips++}`;
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
    `<clipPath id="${id}"><path transform="${planeY(y)}" d="${shape}"/></clipPath>`,
    `<g clip-path="url(#${id})">`,
    `<path class="iso-top" d="${tops.join("")}"/>`,
    ...sides.map((d, shade) => (d.length ? `<path class="iso-shade" data-shade="${shade}" d="${d.join("")}"/>` : "")),
    `<g transform="${planeY(y - depth)}"><path class="${backClass}" d="${shape}"/>${back}</g>`,
    `</g>`,
    `<g transform="${planeY(y)}"><path class="iso-line" data-tone="lo" d="${shape}"/></g>`,
  ].join("");
}

// Post assembly: slotted base, post holder, post up to `top`.
function post(x, y, top, { slot = "x" } = {}) {
  const out = [];
  const base = slot === "x" ? { x: x - 12, y: y - 6, w: 24, d: 12, r: 2 } : { x: x - 6, y: y - 12, w: 12, d: 24, r: 2 };
  out.push(S(k.slabOf(base, 0, 3, P, 3, 0.4), { tone: "lo" }));
  const slotPlan = slot === "x" ? { x: x - 10, y: y - 1.4, w: 5, d: 2.8, r: 1.4 } : { x: x - 1.4, y: y - 10, w: 2.8, d: 5, r: 1.4 };
  out.push(L(k.planOutline(slotPlan, 3, P, 4), { tone: "lo" }));
  const screw = slot === "x" ? [x + 8, y] : [x, y + 8];
  out.push(S(k.cylinder(screw[0], screw[1], 2, 3, 1.2, P, 16), { tone: "mid" }));
  out.push(L(k.ring(screw[0], screw[1], 0.9, 4.2, P, 12), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 5, 3, 13, P, 28, 0.4), { tone: "mid" }));
  out.push(L(k.sideArc(x, y, 5, 13, P, 20), { tone: "faint" }));
  out.push(S(k.slabOf({ x: x + 4.6, y: y - 1.2, w: 2, d: 2.4, r: 0.6 }, 10, 3, P, 2), { tone: "mid" }));
  out.push(S(k.cylinder(x + 7.2, y, 1.6, 9.6, 3.8, P, 14), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 3, 16, top - 16, P, 24), { tone: "mid", crease: "none" }));
  return out.join("");
}

function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 6.2, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -4, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 4), 0, P), { tone: "lo" }));
  // M6 tapped holes on a 12.5 grid
  const gap = 12.5;
  const cols = Math.floor((PLATE.w - 16) / gap) + 1;
  const rows = Math.floor((PLATE.d - 16) / gap) + 1;
  const x0 = PLATE.x + (PLATE.w - (cols - 1) * gap) / 2;
  const y0 = PLATE.y + (PLATE.d - (rows - 1) * gap) / 2;
  out.push(D(k.dotGrid(x0, y0, cols, rows, gap, 0, P), { size: 0.6, tone: "lo" }));
  const label = { x: -170, y: 90, w: 52, d: 14, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 3), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([label.x + 4, label.y + 8.4], 0.8, P, "x"), "HeNe 632.8 nm", { size: 3.4, tone: "mid" }));
  out.push(D([at([label.x + label.w - 3, label.y + 3, 0.8]), at([label.x + label.w - 3, label.y + label.d - 3, 0.8])], { size: 0.45 }));
  return out.join("");
}

function lead(points, cls = "") {
  const pts = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < 10; s++) {
      const t = s / 10, t2 = t * t, t3 = t2 * t;
      pts.push([0, 1, 2].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  pts.push(points[points.length - 1]);
  const flatPts = pts.map(at);
  const d = k.pathOf(flatPts);
  return `<path class="if-lead-under" d="${d}"/><path class="if-lead ${cls}" d="${d}"/>${D([flatPts[0], flatPts[flatPts.length - 1]], { size: 0.7, tone: "mid" })}`;
}

function supply() {
  const out = [`<path class="iso-halo" d="${k.haloOf(SUP, 0, 5, P)}"/>`];
  out.push(S(k.slabOf(SUP, 0, SUP_TOP, P, 3, 0.8), { tone: "mid", inner: L(k.sideSeam(SUP, 4, P, 3), { tone: "faint" }) }));
  const front = SUP.y + SUP.d;
  out.push(`<g transform="${planeY(front)}"><path class="iso-line" data-tone="lo" d="${flat(SUP.x + 4, 8, SUP.x + 20, 22, 1.2)}"/></g>`);
  const F = along([SUP.x + 32, front, 15], [0, 1, 0]);
  out.push(S(G.disc(0, 1.4, 5, F, P), { tone: "lo" }));
  out.push(S(G.disc(1.4, 5, 3.6, F, P), { tone: "mid" }));
  out.push(k.fadedSvg(G.ribsOf(F, 1.4, 5, 3.6, 22, P, { fade: [0.1, 0.55], seams: "first" }), { tone: "lo" }));
  out.push(D([at([SUP.x + 8, front, 15])], { size: 0.9, tone: "hi" }));
  out.push(L([20, 14, 17].map((w, i) => k.lineOnTop([SUP.x + 6, SUP.y + 8 + i * 4], [SUP.x + 6 + w, SUP.y + 8 + i * 4], SUP_TOP, P)).join(""), { tone: "lo", free: true }));
  // HV lead to the laser's back cap, PZT lead to the actuator
    out.push(lead([[SUP.x + SUP.w, SUP.y + 16, 12], [SUP.x + SUP.w + 10, SUP.y + 16, 6], [-70, -122, 3], [-28, -134, 10], [-14, -134, 20], [-5.5, -133, ROD_Z]]));
  return out.join("");
}

// Moving mirror: flexure stage pushed by a piezo actuator. Built at full retraction (d = travel).
const ROD_Z = STAGE_TOP + 3.5;
const ROD_F = along([0, 0, ROD_Z], [0, 1, 0]);
const ROD = G.rodOut(ROD_F, HOUSE_Y, -L2 - MODEL.travel - CAR_D, 2.6, P, { stroke: MODEL.travel });

function stageBase() {
  const out = [`<path class="iso-halo" d="${k.haloOf(STAGE, 0, 4, P)}"/>`];
  out.push(S(k.slabOf(STAGE, 0, STAGE_TOP - 2, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(STAGE, 6, P, 3), { tone: "faint" }) }));
  out.push(D(k.corners(STAGE, 3.5).map(([x, y]) => at([x, y, STAGE_TOP - 2])), { size: 0.45 }));
  for (const x of [-14, 9]) {
    out.push(S(k.slabOf({ x, y: STAGE.y + 16, w: 5, d: STAGE.d - 18, r: 0.8 }, STAGE_TOP - 2, 2, P, 2, 0.3), { tone: "mid" }));
    out.push(D([at([x + 2.5, STAGE.y + 19, STAGE_TOP]), at([x + 2.5, STAGE.y + STAGE.d - 5, STAGE_TOP])], { size: 0.4 }));
  }
  // actuator housing, a round can on a saddle block
  // piezo actuator can resting on the base, its push rod coming out of the gland
  const F = along([0, STAGE.y + 2, ROD_Z], [0, 1, 0]);
  const can = HOUSE_Y - STAGE.y - 2;
  out.push(S(G.disc(0, can - 2, 5.5, F, P), { tone: "mid", inner: L(G.arcOf(F, 3, 5.5, P) + G.arcOf(F, can - 5, 5.5, P), { tone: "faint" }) }));
  out.push(S(G.disc(can - 2, can, 3.8, F, P), { tone: "mid" }));
  out.push(L(G.circleOf(F, can, 3.1, P), { tone: "faint" }));
  return out.join("");
}

function carriage() {
  const yc = -L2 - MODEL.travel;
  const out = [];
  const car = { x: -18, y: yc - CAR_D, w: 36, d: CAR_D, r: 1.4 };
  out.push(S(k.slabOf(car, STAGE_TOP, 7, P, 3, 0.5), { tone: "mid" }));
  out.push(D([at([-14, yc - 3, STAGE_TOP + 7]), at([14, yc - 3, STAGE_TOP + 7])], { size: 0.45 }));
  // mirror mount plate standing on the carriage, mirror facing +y toward the splitter
  const mount = { x: -15, y: yc - 9, w: 30, d: 6, r: 1 };
  out.push(S(k.slabOf(mount, STAGE_TOP + 7, H + 15 - STAGE_TOP - 7, P, 3, 0.5), { tone: "hi", crease: "lo", lit: true }));
  out.push(D([at([-12, yc - 3, H + 12]), at([12, yc - 3, H + 12]), at([-12, yc - 3, STAGE_TOP + 10]), at([12, yc - 3, STAGE_TOP + 10])], { size: 0.45 }));
  const F = along([0, yc - 3, H], [0, 1, 0]);
  out.push(S(G.disc(0, 1.2, 10, F, P), { tone: "mid" }));
  out.push(S(G.disc(1.2, 3, 8.6, F, P), { tone: "hi", lit: true }));
  out.push(`<path class="if-mirror" d="${k.pathOf(Array.from({ length: 48 }, (_, i) => at(G.pointOf(F, 3, 7.6, (i / 48) * Math.PI * 2))), true)}"/>`);
  return out.join("");
}

const HV = { x: -174, y: 34, w: 40, d: 28, r: 3 };
const HV_TOP = 22;
// HV lead leaves the back of the laser supply and enters the tube's rear cap
const laserLead = () => lead([[HV.x + 12, HV.y, 16], [HV.x + 9, HV.y - 10, 24], [LASER.from - 7, 6, H - 2], [LASER.from - 5, 0, H], [LASER.from, 0, H]]);

function laserSupply() {
  const out = [`<path class="iso-halo" d="${k.haloOf(HV, 0, 5, P)}"/>`];
  out.push(S(k.slabOf(HV, 0, HV_TOP, P, 3, 0.8), { tone: "mid", inner: L(k.sideSeam(HV, 3.5, P, 3), { tone: "faint" }) }));
  const front = HV.y + HV.d;
  out.push(`<g transform="${planeY(front)}"><path class="iso-line" data-tone="lo" d="${flat(HV.x + 4, 7, HV.x + 22, 17, 1.2)}"/></g>`);
  out.push(D([at([HV.x + 8, front, 12])], { size: 0.9, tone: "hi" }));
  const F = along([HV.x + 30, front, 11], [0, 1, 0]);
  out.push(S(G.disc(0, 1.2, 4, F, P), { tone: "lo" }));
  out.push(S(G.disc(1.2, 3.6, 2.6, F, P), { tone: "mid" }));
  out.push(S(k.slabOf({ x: HV.x + 29.4, y: front + 3.6, w: 1.2, d: 1.4, r: 0.3 }, 9, 4, P, 2), { tone: "mid" }));
  out.push(L([16, 11].map((w, i) => k.lineOnTop([HV.x + 5, HV.y + 6 + i * 4], [HV.x + 5 + w, HV.y + 6 + i * 4], HV_TOP, P)).join(""), { tone: "lo", free: true }));
  out.push(D(k.corners(HV, 3).map(([x, y]) => at([x, y, HV_TOP])), { size: 0.4 }));
  return out.join("");
}

function laser() {
  const out = [];
  for (const x of [-140, -92]) {
    out.push(`<path class="iso-halo" d="${k.haloOf({ x: x - 12, y: -6, w: 24, d: 12, r: 2 }, 0, 3, P)}" style="filter:blur(4px)"/>`);
    out.push(post(x, 0, H - LASER.r - 6));
    out.push(S(k.slabOf({ x: x - 5, y: -12, w: 10, d: 24, r: 1 }, H - LASER.r - 6, 6, P, 3, 0.4), { tone: "mid" }));
  }
  const F = along([LASER.from, 0, H], [1, 0, 0]);
  const len = LASER.to - LASER.from;
  // straps over the cradles are bands on the tube: two seams each and a screw
  const straps = [-140, -92].map((x) => x - LASER.from);
  const seams = straps.flatMap((s) => [G.arcOf(F, s - 3, LASER.r, P), G.arcOf(F, s + 3, LASER.r, P)]);
  out.push(S(G.solidOf([[0, 8.6], [1.6, LASER.r], [len, LASER.r]], F, P), { tone: "mid", inner: L(seams.join(""), { tone: "lo" }) + L(G.arcOf(F, len - 10, LASER.r, P), { tone: "faint" }) }));
  out.push(D(straps.map((s) => at(G.pointOf(F, s, LASER.r, Math.PI * 0.62))), { size: 0.5 }));
  out.push(S(G.solidOf([[len, 7], [len + 6, 7], [len + 7, 5], [LASER.nose - LASER.from, 5]], F, P), { tone: "mid" }));
  const N = along([LASER.nose, 0, H], [1, 0, 0]);
  out.push(L(G.circleOf(N, 0, 2.2, P), { tone: "lo" }));
  out.push(D([at(G.pointOf(F, 30, LASER.r, Math.PI / 2 + 0.5))], { size: 0.9, tone: "hi" }));
  out.push(`<path class="if-warn" d="${k.pathOf([0, 1, 2, 3].map((i) => at(G.pointOf(F, 42 + (i === 1 || i === 2 ? 16 : 0), LASER.r + 0.05, Math.PI / 2 - 0.2 + (i >= 2 ? 0.8 : 0)))), true)}"/>`);
  return out.join("");
}

function splitter() {
  const out = [post(0, 0, H - BS - 3, { slot: "y" })];
  out.push(S(k.slabOf({ x: -11, y: -11, w: 22, d: 22, r: 1.2 }, H - BS - 3, 3, P, 3, 0.5), { tone: "mid" }));
  out.push(D([at([-8.6, 8.6, H - BS]), at([8.6, -8.6, H - BS])], { size: 0.45 }));
  const cube = { x: -BS, y: -BS, w: 2 * BS, d: 2 * BS, r: 0.3 };
  out.push(S(k.slabOf(cube, H - BS, 2 * BS, P, 2), { tone: "hi", crease: "lo", className: "if-glass" }));
  out.push(L(k.lineOnTop([-BS, BS], [BS, -BS], H + BS, P), { tone: "mid" }));
  return out.join("");
}

function fixedMirror() {
  const out = [];
  const x = L1;
  out.push(post(x + 9, 0, H - 16, { slot: "y" }));
  out.push(S(k.slabOf({ x: x + 2, y: -7, w: 14, d: 14, r: 1 }, H - 16, 3, P, 2, 0.4), { tone: "mid" }));
  const F = along([x, 0, H], [1, 0, 0]);
  out.push(S(G.disc(0, 2, 8.6, F, P), { tone: "hi" }));
  out.push(S(k.slabOf({ x: x + 2, y: -14, w: 5, d: 28, r: 1 }, H - 13, 27, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: x + 11, y: -14, w: 5, d: 28, r: 1 }, H - 13, 27, P, 3, 0.4), { tone: "mid" }));
  for (const [y, z] of [[-9, H + 9], [9, H + 9], [9, H - 9]]) {
    const A = along([x + 7, y, z], [1, 0, 0]);
    out.push(S(G.disc(0, 4, 1.6, A, P), { tone: "mid" }));
  }
  for (const [y, z] of [[-9, H + 9], [9, H - 9]]) {
    const A = along([x + 16, y, z], [1, 0, 0]);
    out.push(S(G.disc(0, 1.2, 4.4, A, P), { tone: "lo" }));
    out.push(S(G.disc(1.2, 6, 3.6, A, P), { tone: "mid" }));
    out.push(k.fadedSvg(G.ribsOf(A, 1.2, 6, 3.6, 20, P, { fade: [0.1, 0.55], seams: "first" }), { tone: "lo" }));
  }
  out.push(D([at([x + 16, 9, H + 9])], { size: 0.6, tone: "mid" }));
  return out.join("");
}

function detector() {
  const out = [post(0, (DET.y0 + DET.y1) / 2, H - DET.r - 4)];
  out.push(S(k.slabOf({ x: -6, y: DET.y0 + 2, w: 12, d: 12, r: 1 }, H - DET.r - 4, 4, P, 2, 0.4), { tone: "mid" }));
  const F = along([0, DET.y0, H], [0, 1, 0]);
  out.push(S(G.solidOf([[0, 4.5], [1.5, 4.5], [1.5, DET.r], [DET.y1 - DET.y0 - 3, DET.r], [DET.y1 - DET.y0 - 3, 4], [DET.y1 - DET.y0, 4]], F, P), { tone: "mid", inner: L(G.arcOf(F, 6, DET.r, P), { tone: "faint" }) }));
  return out.join("");
}

function counter() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BOX, 0, 5, P)}"/>`];
  out.push(S(k.slabOf(BOX, 0, BOX_TOP, P, 3, 0.8), { tone: "mid", inner: L(k.sideSeam(BOX, 3.5, P, 3), { tone: "faint" }) }));
  const chart = [];
  const back = [
    `<path class="if-grid" d="M${WIN.x0} ${-(WIN.z0 + 8)}H${WIN.x1}"/>`,
    `<path class="if-strip" data-part="strip" d=""/>`,
    `<text class="if-seg" data-part="count" x="${WIN.x0 + 2}" y="${-(WIN.z1 - 6.4)}" font-size="5.2">N 0</text>`,
    `<text class="if-seg" data-part="dx" x="${WIN.x1 - 2}" y="${-(WIN.z1 - 6.4)}" font-size="5.2" text-anchor="end">0.000 µm</text>`,
    ...chart,
  ].join("");
  out.push(recess(WIN, BOX_FRONT, back, "if-glass-screen"));
  out.push(D([at([WIN.x1 + 6, BOX_FRONT, 22])], { size: 0.8, tone: "hi" }));
  out.push(`<circle class="if-led" data-part="led" cx="${at([WIN.x1 + 6, BOX_FRONT, 22])[0]}" cy="${at([WIN.x1 + 6, BOX_FRONT, 22])[1]}" r="1.4" opacity="1"/>`);
  for (const z of [9, 16]) {
    const F = along([WIN.x1 + 6, BOX_FRONT, z - 2], [0, 1, 0]);
    out.push(S(G.disc(0, 2, 1.8, F, P), { tone: "mid" }));
  }
  out.push(L([22, 15].map((w, i) => k.lineOnTop([BOX.x + 6, BOX.y + 8 + i * 4], [BOX.x + 6 + w, BOX.y + 8 + i * 4], BOX_TOP, P)).join(""), { tone: "lo", free: true }));
  const C = along([BOX.x + 12, BOX.y + 26, BOX_TOP], [0, 0, 1]);
  out.push(S(G.disc(0, 1.6, 3.4, C, P), { tone: "lo" }));
  out.push(S(G.disc(1.6, 6, 2.4, C, P), { tone: "mid" }));
  return out.join("");
}

const detectorLead = () => lead([[0, DET.y1, H], [0, DET.y1 + 6, H - 2], [10, DET.y1 + 4, BOX_TOP + 16], [BOX.x + 12, BOX.y + 26, BOX_TOP + 14], [BOX.x + 12, BOX.y + 26, BOX_TOP + 6]]);

const move = (dy) => k.translateAlong(P, [0, dy, 0]);
const wave = (name) => `<path class="if-wave-glow" data-wave="${name}" d=""/><path class="if-wave" data-wave="${name}" d=""/>`;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  className: "if-svg",
  label:
    "A Michelson interferometer on an optical breadboard. A helium-neon laser sends its beam into a beam-splitter cube; half goes to a fixed mirror on a kinematic mount, half to a mirror on a piezo-driven stage. The two returning beams recombine toward a photodiode. As the stage moves, the wave from the moving arm slides in phase against the fixed one: their sum on the detector arm swells (constructive) and vanishes (destructive) once every half wavelength of travel, and a counter tallies the fringes.",
  body: [
    plate(),
    supply(),
    stageBase(),
    `<g data-part="rod" transform="${move(0)}"><clipPath id="if-rod"><path data-hold d="${ROD.clip}"/></clipPath><g clip-path="url(#if-rod)">${S(ROD.paths, { tone: "mid" })}</g></g>`,
    `<g data-part="carriage" transform="${move(0)}">${carriage()}</g>`,
    `<g class="if-beam">${wave("move")}</g>`,
    laserLead(),
    laser(),
    laserSupply(),
    `<g class="if-beam">${wave("in")}</g>`,
    splitter(),
    `<g class="if-beam">${wave("fixed")}</g>`,
    fixedMirror(),
    `<g class="if-beam if-out"><path class="if-wave if-part" data-wave="out1" d=""/><path class="if-wave if-part if-part2" data-wave="out2" d=""/>${wave("sum")}</g>`,
    detector(),
    detectorLead(),
    counter(),
  ],
});

const CSS = `
.if-svg{--if-beam:#d62b2b;--if-beam-glow:#ff5a4f;--if-glass:#1c2320;--if-text:#ff8a5c;--if-grid:#3b4a43;--if-strip:#ff8a5c}
.iso[data-theme="dark"] .if-svg{--if-beam:#ff4a3d;--if-glass:#070a08}
.if-wave{fill:none;stroke:var(--if-beam);stroke-width:1;stroke-linejoin:round;stroke-linecap:round}
.if-wave-glow{fill:none;stroke:var(--if-beam-glow);stroke-width:3.2;opacity:.18;stroke-linejoin:round;stroke-linecap:round;filter:blur(1.2px)}
.if-wave.if-part{stroke-width:.6;opacity:.55;stroke-dasharray:none}
.if-wave.if-part2{stroke:var(--anatomy-hi);opacity:.45}
.if-out .if-wave[data-wave="sum"]{stroke-width:1.5}
.if-glass-screen{fill:var(--if-glass)}
.if-well{fill:var(--anatomy-shade-0)}
.if-grid{fill:none;stroke:var(--if-grid);stroke-width:.35;vector-effect:none}
.if-strip{fill:none;stroke:var(--if-strip);stroke-width:.6;vector-effect:none;stroke-linejoin:round}
.if-seg{fill:var(--if-text);font-family:var(--anatomy-mono);letter-spacing:.04em}
.if-led{fill:var(--if-beam-glow);filter:blur(.6px)}
.if-mirror{fill:none;stroke:var(--anatomy-faint);stroke-width:.6}
.if-warn{fill:#f2c94c;stroke:var(--anatomy-lo);stroke-width:.4}
.if-lead-under{fill:none;stroke:var(--anatomy-paper);stroke-width:3.4;stroke-linecap:round;stroke-linejoin:round}
.if-lead{fill:none;stroke:var(--anatomy-mid);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.if-stage{outline:none;touch-action:pan-y;cursor:ew-resize}
.if-stage:focus-visible{outline:1px solid var(--anatomy-mid);outline-offset:4px}
body.if-embed[data-theme="light"]{--anatomy-card:#fff;--anatomy-page:#fff}
body.if-embed{background:var(--anatomy-card)}
body.if-embed .iso-page{width:100%;margin:0}
body.if-embed .iso-figure{margin:0}
body.if-embed .iso-plate{box-shadow:none;padding:34px 8px 30px}
body.if-embed .iso-plate-corners{inset:8px 10px}
body.if-embed .iso-plate .iso-svg{max-height:calc(100vh - 64px);width:auto;max-width:100%}
`;

const live = `
const P = ${JSON.stringify(P)};
const M = ${JSON.stringify(MODEL)};
const GEO = ${JSON.stringify({ H, L1, L2, BS, nose: LASER.nose, det: DET.y0, win: WIN })};
const stage = document.querySelector(".if-stage");
const svg = stage.querySelector("svg");
const q = (sel) => svg.querySelector(sel);
const rod = q('[data-part="rod"]'), car = q('[data-part="carriage"]');
const waves = {};
for (const el of svg.querySelectorAll("[data-wave]")) (waves[el.dataset.wave] ||= []).push(el);
const strip = q('[data-part="strip"]'), countEl = q('[data-part="count"]'), dxEl = q('[data-part="dx"]'), led = q('[data-part="led"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const K = (2 * Math.PI) / M.lambdaDrawn;
const W = K * M.speed;
const A = 5;
// a sinusoid along a beam: from point o in unit direction u over length len; path(s) is the optical path at s
function wavePath(o, u, len, path, amp, t) {
  let d = "";
  const n = Math.max(2, Math.ceil(len / 0.5));
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * len;
    const e = amp * Math.cos(K * path(s) - W * t);
    const p = iso([o[0] + u[0] * s, o[1] + u[1] * s, o[2] + e], P);
    d += (i ? "L" : "M") + p[0].toFixed(2) + " " + p[1].toFixed(2);
  }
  return d;
}
function sumPath(o, u, len, p1, p2, amp, t) {
  let d = "";
  const n = Math.ceil(len / 0.5);
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * len;
    const e = amp * (Math.cos(K * p1(s) - W * t) + Math.cos(K * p2(s) - W * t));
    const p = iso([o[0] + u[0] * s, o[1] + u[1] * s, o[2] + e], P);
    d += (i ? "L" : "M") + p[0].toFixed(2) + " " + p[1].toFixed(2);
  }
  return d;
}
const set = (name, d) => { for (const el of waves[name]) el.setAttribute("d", d); };
const HIST = 160;
const hist = new Float32Array(HIST).fill(1);
let disp = 0, target = 0, clock = 0, tour = 0, touring = true, visible = false, frame = 0, last = 0, idleTimer = 0, sampleClock = 0;
function draw() {
  const { H, L1, L2, BS, nose, det, win } = GEO;
  const l2 = L2 + disp;
  const t = clock;
  const off = -nose;
  set("in", wavePath([nose, 0, H], [1, 0], -BS - nose, (s) => s, A, t));
  set("fixed", wavePath([BS, 0, H], [1, 0], L1 - BS, (s) => off + BS + s, A / Math.SQRT2, t));
  set("move", wavePath([0, -l2, H], [0, 1], l2 - BS, (s) => off + l2 - s, A / Math.SQRT2, t));
  const p1 = (s) => off + 2 * L1 + BS + s;
  const p2 = (s) => off + 2 * l2 + BS + s;
  set("out1", wavePath([0, BS, H], [0, 1], det - BS, p1, A / 2, t));
  set("out2", wavePath([0, BS, H], [0, 1], det - BS, p2, A / 2, t));
  set("sum", sumPath([0, BS, H], [0, 1], det - BS, p1, p2, A / 2, t));
  const m = translateAlong(P, [0, M.travel - disp, 0]);
  car.setAttribute("transform", m);
  rod.setAttribute("transform", m);
  holdStill(rod, m.match(/-?[\\d.]+/g).map(Number));
  const I = (1 + Math.cos(2 * K * disp)) / 2;
  const dx = disp * M.lambda / M.lambdaDrawn;
  const N = Math.floor((2 * disp) / M.lambdaDrawn + 1e-6);
  countEl.textContent = "N " + N;
  dxEl.textContent = (dx / 1000).toFixed(3) + " µm";
  led.setAttribute("opacity", (0.08 + 0.92 * I).toFixed(3));
  let sd = "";
  for (let i = 0; i < HIST; i++) {
    const u = win.x0 + 1 + (i / (HIST - 1)) * (win.x1 - win.x0 - 2);
    const z = win.z0 + 1.2 + hist[i] * 6.2;
    sd += (i ? "L" : "M") + u.toFixed(2) + " " + (-z).toFixed(2);
  }
  strip.setAttribute("d", sd);
  const phase = (2 * disp / M.lambdaDrawn) % 1;
  const kind = I > 0.85 ? "costruttiva" : I < 0.15 ? "distruttiva" : "intermedia";
  const text = "Δx " + (dx / 1000).toFixed(3) + " µm · N " + N + " · I " + I.toFixed(2) + " (" + kind + ")";
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", dx.toFixed(0));
  stage.setAttribute("aria-valuetext", text);
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
  last = now;
  clock += dt;
  if (touring) { tour += dt; target = M.travel * (0.5 - 0.5 * Math.cos((2 * Math.PI * tour) / 16)); }
  disp += (target - disp) * (1 - Math.exp(-dt / 0.35));
  sampleClock += dt;
  while (sampleClock > 1 / 30) {
    sampleClock -= 1 / 30;
    hist.copyWithin(0, 1);
    hist[HIST - 1] = (1 + Math.cos(2 * K * disp)) / 2;
  }
  draw();
  frame = visible && !still.matches ? requestAnimationFrame(tick) : 0;
}
const run = () => {
  if (still.matches) { disp = target; hist.fill((1 + Math.cos(2 * K * disp)) / 2); draw(); return; }
  if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); }
};
const steer = (next) => {
  touring = false;
  target = clamp(next, 0, M.travel);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; tour = Math.acos(clamp(1 - 2 * disp / M.travel, -1, 1)) * 16 / (2 * Math.PI); run(); }, 4000);
  run();
};
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) touring = false;
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  steer(((event.clientX - box.left) / box.width - 0.2) / 0.6 * M.travel);
});
stage.addEventListener("keydown", (event) => {
  let to = null;
  const step = M.lambdaDrawn / 8;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = target + step;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = target - step;
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = M.travel;
  if (to === null) return;
  event.preventDefault();
  steer(to);
});
draw();
`;

const body = k.plateHtml({
  fig: "Fig 2",
  title: "Interferometro di Michelson",
  hint: "Muovi il puntatore: sposta lo specchio mobile",
  readout: "Δx 0.000 µm · N 0 · I 1.00 (costruttiva)",
  keys: [],
  caption: "",
  body: `<div class="iso-stage if-stage" tabindex="0" role="slider" aria-label="Michelson interferometer: arrow keys move the mirror by an eighth of a wavelength" aria-valuemin="0" aria-valuemax="${Math.round((MODEL.travel * MODEL.lambda) / MODEL.lambdaDrawn)}" aria-valuenow="0">${svg}</div>`,
});

const html = k
  .pageHtml({ title: "Michelson interferometer", theme, body, script: kitScript() + live })
  .replace("</style>", `${CSS}</style>`)
  .replace(`<body class="iso"`, `<body class="iso if-embed"`);
writeFileSync(OUT, html);
console.log("wrote", OUT);
