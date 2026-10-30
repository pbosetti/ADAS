// Pendulum weighing scale (bilancia a pendolo), with an exploded view.
// node anatomy/pendulum-scale/build.mjs [--light] [--out path.html]
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import { cameraOf, iso, pathOf } from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import { kitScript } from "../scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const outArg = process.argv.indexOf("--out");
const OUT = outArg > 0 ? resolve(process.argv[outArg + 1]) : join(HERE, theme === "light" ? "pendulum-scale-light.html" : "pendulum-scale.html");

// --- Model -------------------------------------------------------------------
// Each ribbon carries F/2 on a sector of radius R; the counterweight m at arm L
// balances it: (F/2)·R = m·g·L·sin(phi). Full scale (10 kg) at phi = 60°.
// The crossbar drops R·phi, the rack turns the pinion (radius RP) by R·phi/RP.
const MODEL = { fmax: 10, phimax: Math.PI / 3, R: 22, RP: 6, L: 46 };
const phiOf = (f) => Math.asin(Math.min(0.999, Math.max(0, f / MODEL.fmax)) * Math.sin(MODEL.phimax));
const SWEEP = (MODEL.R * MODEL.phimax) / MODEL.RP;
const POINTER0 = -SWEEP / 2;

const WIDTH = 760;
const HEIGHT = 540;

const BASE = { x: -84, y: -72, w: 168, d: 132, r: 8 };
const BASE_H = 14;
const FOOT_H = 6;
const COL = { x: -10, y: -52, w: 20, d: 20, r: 2 };
const CASE = { x0: -95, x1: 95, z0: 140, z1: 345, yb: -22, yf: 18 };
const PIV = 38;
const PIV_Z = 225;
const BAR_Z = 186;
const DIAL = { z: 290, r: 47 };
const PAN_Z = 62;
const HUB_Z = 122;
const EXPLODE = { dial: [235, 40, 10], pointer: [235, 60, 10], glass: [0, 150, 0] };

const P = k.fitProjection(
  [
    ...k.boxCorners(BASE, -BASE_H - FOOT_H, 0),
    [CASE.x0, CASE.yb, CASE.z1 + 2],
    [CASE.x1, CASE.yb, CASE.z1 + 2],
    [CASE.x0, CASE.yf + EXPLODE.glass[1] + 4, CASE.z0],
    [CASE.x0, CASE.yf + EXPLODE.glass[1] + 4, CASE.z1],
    [CASE.x1, CASE.yf + EXPLODE.glass[1] + 4, CASE.z0],
    [EXPLODE.dial[0] + DIAL.r, 12 + EXPLODE.pointer[1], DIAL.z + DIAL.r + EXPLODE.dial[2]],
    [EXPLODE.dial[0] + DIAL.r, 12 + EXPLODE.pointer[1], DIAL.z - DIAL.r + EXPLODE.dial[2]],
  ],
  WIDTH,
  HEIGHT,
  { pad: 20, azimuth: 50, elevation: 20 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const along = (o, a) => G.frameAlong(o, a);
const planeY = (y) => k.sideMatrix([0, y], 0, P, "left");
const slabXZ = (x0, x1, y0, y1, z0, z1, r = 1, bevel = 0.4) => k.slabOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r }, z0, z1 - z0, P, 3, bevel);

// --- Flat plates in the x-z plane (rotating parts), shared with the page -------
function plateSvg(poly, y0, y1, P, opts) {
  const tone = (opts && opts.tone) || "hi";
  const lit = opts && opts.lit;
  const { sinA, cosA, sinE, cosE } = cameraOf(P);
  const V = [cosA * cosE, sinA * cosE, sinE];
  const ln = Math.hypot(sinA, cosA, 1.2);
  const Lt = [-sinA / ln, cosA / ln, 1.2 / ln];
  const band = (s) => Math.min(3, [0, 0.2, 0.42, 0.62].filter((b) => s >= b).length);
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const pts = area < 0 ? poly.slice().reverse() : poly;
  const n = pts.length;
  const fr = pts.map(([x, z]) => iso([x, y1, z], P));
  const bk = pts.map(([x, z]) => iso([x, y0, z], P));
  const vis = [];
  const shades = ["", "", "", ""];
  let fill = pathOf(fr, true);
  let edges = pathOf(fr, true);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = pts[j][0] - pts[i][0], dz = pts[j][1] - pts[i][1];
    const len = Math.hypot(dx, dz) || 1;
    const nx = dz / len, nz = -dx / len;
    vis[i] = nx * V[0] + nz * V[2] > 1e-6;
    if (!vis[i]) continue;
    const quad = pathOf([bk[i], bk[j], fr[j], fr[i]], true);
    fill += quad;
    shades[band(nx * Lt[0] + nz * Lt[2])] += quad;
    edges += pathOf([bk[i], bk[j]]);
  }
  for (let i = 0; i < n; i++) if (vis[(i + n - 1) % n] !== vis[i]) edges += pathOf([bk[i], fr[i]]);
  const front = band(Lt[1]);
  return (
    `<g class="iso-solid"${lit ? " data-lit" : ""}><path class="iso-fill" d="${fill}"/>` +
    shades.map((d, s) => (d ? `<path class="iso-shade" data-shade="${s}" d="${d}"/>` : "")).join("") +
    `<path class="iso-shade" data-shade="${front}" d="${pathOf(fr, true)}"/>` +
    `<path class="iso-line iso-edge" data-tone="${tone}" d="${edges}"/></g>`
  );
}
const rot = (pts, cx, cz, a) => pts.map(([x, z]) => [cx + x * Math.cos(a) - z * Math.sin(a), cz + x * Math.sin(a) + z * Math.cos(a)]);
// sector + arm, local frame at the pivot; side = -1 for the left pendulum (ribbon on +x), +1 for the right
// sector plate: a convex pie from the pivot out to the ribbon rim (radius R).
// The rim spans the ribbon's tangent and anchor over the whole swing (0..60°).
const SPAN = (side) => (side < 0 ? [-0.45, 2.0] : [Math.PI - 2.0, Math.PI + 0.45]);
function sectorPoly(side, R) {
  const [a0, a1] = SPAN(side), pts = [[0, 0]];
  for (let i = 0; i <= 28; i++) { const a = a0 + ((a1 - a0) * i) / 28; pts.push([R * Math.cos(a), R * Math.sin(a)]); }
  return pts;
}
// arm bar bolted on the sector face, from the hub down to the counterweight
const armPoly = (Lr) => [[-2.6, 4], [2.6, 4], [2.6, -Lr], [-2.6, -Lr]];
function gearPoly(teeth, ro, rr) {
  const pts = [];
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2, s = (Math.PI * 2) / teeth;
    pts.push([rr * Math.cos(a), rr * Math.sin(a)], [ro * Math.cos(a + s * 0.25), ro * Math.sin(a + s * 0.25)], [ro * Math.cos(a + s * 0.5), ro * Math.sin(a + s * 0.5)], [rr * Math.cos(a + s * 0.75), rr * Math.sin(a + s * 0.75)]);
  }
  return pts;
}
const pointerPoly = () => [[0, 42], [1.3, 6], [2.6, 0], [2.4, -8], [0, -13], [-2.4, -8], [-2.6, 0], [-1.3, 6]];
const arcLine = (cx, cz, r, a0, a1, y, steps = 24) => pathOf(Array.from({ length: steps + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / steps; return iso([cx + r * Math.cos(a), y, cz + r * Math.sin(a)], P); }));

// --- Static parts ---------------------------------------------------------------
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, -BASE_H - FOOT_H, BASE_H, P)}"/>`];
  const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  for (const [x, y] of byDepth(k.corners(BASE, 16))) {
    out.push(S(k.cylinder(x, y, 7, -BASE_H - FOOT_H, 2, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5, -BASE_H - FOOT_H + 2, FOOT_H - 2, P, 24), { tone: "mid" }));
    out.push(L(k.knurl(x, y, 5, -BASE_H - FOOT_H + 2, -BASE_H, 24, P), { tone: "lo" }));
  }
  out.push(S(k.slabOf(BASE, -BASE_H, BASE_H, P, 8, 1.4), { tone: "mid", inner: L(k.sideSeam(BASE, -BASE_H + 4, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(BASE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(BASE, 9);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // spirit level vial on the base front
  const vial = { x: 40, y: 38, w: 30, d: 10, r: 2 };
  out.push(S(k.slabOf(vial, 0, 4, P, 3, 0.4), { tone: "mid" }));
  out.push(L(k.planOutline({ x: 44, y: 40.5, w: 22, d: 5, r: 2.5 }, 4, P, 6), { tone: "lo" }));
  out.push(L(k.lineOnTop([53, 40.5], [53, 45.5], 4, P) + k.lineOnTop([57, 40.5], [57, 45.5], 4, P), { tone: "faint" }));
  out.push(D([at([55, 43, 4])], { size: 1, tone: "hi" }));
  // name plate
  const label = { x: -74, y: 36, w: 50, d: 13, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 3), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([label.x + 4, label.y + 8], 0.8, P, "x"), "10 kg · e = 0.1 kg", { size: 3, tone: "mid" }));
  return out.join("");
}

function column() {
  const out = [];
  out.push(S(k.slabOf(k.insetPlan(COL, -4), 0, 6, P, 3, 0.5), { tone: "mid" }));
  out.push(D(k.corners(k.insetPlan(COL, -4), 2.4).map(([x, y]) => at([x, y, 6])), { size: 0.45 }));
  out.push(S(k.slabOf(COL, 6, CASE.z1 - 20 - 6, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(COL, 120, P, 3), { tone: "faint" }) }));
  out.push(S(slabXZ(-14, 14, COL.y, CASE.yb, CASE.z1 - 70, CASE.z1 - 14, 1.5), { tone: "mid" }));
  out.push(D([at([-9, CASE.yb - 9, CASE.z1 - 14]), at([9, CASE.yb - 9, CASE.z1 - 14])], { size: 0.45 }));
  return out.join("");
}

function caseBack() {
  const out = [];
  const { x0, x1, z0, z1, yb, yf } = CASE;
  out.push(S(slabXZ(x0, x1, yb, yb + 4, z0, z1, 2, 0.6), { tone: "mid" }));
  out.push(S(slabXZ(x0, x0 + 4, yb + 4, yf, z0, z1, 1, 0.4), { tone: "mid" }));
  out.push(S(slabXZ(x0 + 4, x1 - 4, yb + 4, yf, z1 - 4, z1, 1, 0.4), { tone: "mid" }));
  out.push(D([at([-60, 0, z1]), at([60, 0, z1])], { size: 0.45 }));
  out.push(S(slabXZ(x0 + 4, x1 - 4, yb + 4, yb + 14, z0, z0 + 5, 1, 0.3), { tone: "mid" }));
  // pivot brackets and the fixed pins
  for (const s of [-1, 1]) {
    const x = s * PIV;
    out.push(S(slabXZ(x - 7, x + 7, yb + 4, yb + 9, PIV_Z - 10, PIV_Z + 8, 1, 0.3), { tone: "mid" }));
    out.push(D([at([x - 4, yb + 9, PIV_Z + 5]), at([x + 4, yb + 9, PIV_Z + 5])], { size: 0.4 }));
    const F = along([x, yb + 9, PIV_Z], [0, 1, 0]);
    out.push(S(G.disc(0, 18.5, 2.2, F, P), { tone: "mid" }));
  }
  // pinion shaft bearing and rack rollers
  const F = along([0, yb + 4, DIAL.z], [0, 1, 0]);
  out.push(S(G.disc(0, 3, 6, F, P), { tone: "mid" }));
  out.push(S(G.disc(3, 32, 1.6, F, P), { tone: "mid" }));
  for (const z of [212, 268]) {
    const R = along([13.6, yb + 4, z], [0, 1, 0]);
    out.push(S(G.disc(0, 18, 1.2, R, P), { tone: "mid" }));
    out.push(S(G.disc(17, 22, 2.5, R, P), { tone: "mid" }));
  }
  return out.join("");
}

function caseFront() {
  // the near side wall
  const { x1, z0, z1, yb, yf } = CASE;
  return S(slabXZ(x1 - 4, x1, yb + 4, yf, z0, z1 - 4, 1, 0.4), { tone: "mid" }) + D([at([x1, yf - 4, z0 + 8]), at([x1, yf - 4, z1 - 12])], { size: 0.45 });
}

function capsAndPinion() {
  const out = [];
  for (const s of [-1, 1]) {
    const F = along([s * PIV, 5.5, PIV_Z], [0, 1, 0]);
    out.push(S(G.disc(0, 2, 4.2, F, P), { tone: "mid" }));
    out.push(D([at([s * PIV, 7.5, PIV_Z])], { size: 0.5, tone: "mid" }));
  }
  return out.join("");
}

function dialPlate() {
  const out = [];
  const F = along([0, 6, DIAL.z], [0, 1, 0]);
  out.push(S(G.disc(0, 2.5, DIAL.r, F, P), { tone: "hi", crease: "lo" }));
  const y = 8.5;
  const pt = (theta, rho) => [rho * Math.sin(theta), -(DIAL.z + rho * Math.cos(theta))];
  const minor = [], mid = [], major = [], nums = [];
  for (let i = 0; i <= 100; i++) {
    const f = i / 10;
    const th = POINTER0 + (MODEL.R * phiOf(f)) / MODEL.RP;
    const len = i % 10 === 0 ? 6 : i % 5 === 0 ? 4.4 : 2.6;
    const [ax, az] = pt(th, DIAL.r - 4), [bx, bz] = pt(th, DIAL.r - 4 - len);
    (i % 10 === 0 ? major : i % 5 === 0 ? mid : minor).push(`M${ax.toFixed(2)} ${az.toFixed(2)}L${bx.toFixed(2)} ${bz.toFixed(2)}`);
    if (i % 10 === 0) {
      const [tx, tz] = pt(th, DIAL.r - 16);
      nums.push(`<text class="ps-num" x="${tx.toFixed(2)}" y="${(tz + 2).toFixed(2)}" font-size="5.6" text-anchor="middle">${i / 10}</text>`);
    }
  }
  const ring = (rho) => {
    const pts = [];
    for (let i = 0; i <= 60; i++) { const th = POINTER0 + (SWEEP * i) / 60; pts.push(pt(th, rho)); }
    return k.pathOf(pts);
  };
  out.push(
    `<g transform="${planeY(y)}">` +
      `<path class="iso-line" data-tone="lo" d="${ring(DIAL.r - 4)}"/>` +
      `<path class="iso-line" data-tone="lo" data-free="end" d="${minor.join("")}"/>` +
      `<path class="iso-line" data-tone="mid" data-free="end" d="${mid.join("")}"/>` +
      `<path class="iso-line" data-tone="hi" data-free="end" d="${major.join("")}"/>` +
      nums.join("") +
      `<text class="ps-unit" x="0" y="${-(DIAL.z - 22)}" font-size="5" text-anchor="middle">kg</text>` +
      `</g>`,
  );
  out.push(D([at([0, y, DIAL.z + DIAL.r - 2]), at([0, y, DIAL.z - DIAL.r + 2])], { size: 0.45 }));
  return out.join("");
}

function glass() {
  const { x0, x1, z0, z1, yf } = CASE;
  const out = [];
  const w = 7;
  const bars = [
    slabXZ(x0, x1, yf, yf + 4, z1 - w, z1, 1.2, 0.5),
    slabXZ(x0, x0 + w, yf, yf + 4, z0 + w, z1 - w, 0.6, 0.4),
    slabXZ(x1 - w, x1, yf, yf + 4, z0 + w, z1 - w, 0.6, 0.4),
    slabXZ(x0, x1, yf, yf + 4, z0, z0 + w, 1.2, 0.5),
  ];
  const pane = k.pathOf([[x0 + w, z0 + w], [x1 - w, z0 + w], [x1 - w, z1 - w], [x0 + w, z1 - w]].map(([x, z]) => at([x, yf + 2, z])), true);
  out.push(`<path class="ps-glass" d="${pane}"/>`);
  const sheen = [[x0 + w + 20, z1 - w, x0 + w, z1 - w - 26], [x0 + w + 44, z1 - w, x0 + w, z1 - w - 56]];
  out.push(L(sheen.map(([ax, az, bx, bz]) => k.pathOf([at([ax, yf + 2, az]), at([bx, yf + 2, bz])])).join(""), { tone: "faint" }));
  out.push(S(bars[0], { tone: "mid" }), S(bars[1], { tone: "mid" }), S(bars[2], { tone: "mid" }), S(bars[3], { tone: "mid" }));
  out.push(D([[x0 + 3.5, z1 - 3.5], [x1 - 3.5, z1 - 3.5], [x0 + 3.5, z0 + 3.5], [x1 - 3.5, z0 + 3.5]].map(([x, z]) => at([x, yf + 4, z])), { size: 0.5 }));
  return out.join("");
}

// --- Moving parts: built by the page each frame; static first frame here ---------
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  className: "ps-svg",
  label:
    "A column pendulum scale, analogue and purely mechanical. A pan hangs from a crossbar; two steel ribbons from the crossbar wrap over two circular sectors pivoted in the case, each carrying a pendulum with a counterweight. A load pulls the crossbar down, the ribbons unwind, the pendulums swing out until their weight balances the load. A rack on the crossbar turns a pinion and the pointer. The front glass, pointer and dial can slide forward in an exploded view.",
  body: [
    base(),
    column(),
    caseBack(),
    `<g data-part="mech"></g>`,
    capsAndPinion(),
    `<g data-part="pinion"></g>`,
    `<g data-part="pan"></g>`,
    caseFront(),
    `<g data-part="dial">${dialPlate()}</g>`,
    `<g data-part="pointer"></g>`,
    `<g data-part="glass">${glass()}</g>`,
  ],
});

// Pan and weights are prebuilt at rest and translated with the crossbar.
function panSvg() {
  const out = [];
  const rim = 40;
  const hub = [0, 0, HUB_Z];
  const rods = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6].map((a) => [rim * Math.cos(a) * 0.96, rim * Math.sin(a) * 0.96, PAN_Z + 5]);
  const rodLine = (p) => L(k.pathOf([at(hub), at(p)]), { tone: "mid" });
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: -34, y: -34, w: 68, d: 68, r: 34 }, -2, 1, P)}" style="opacity:.25"/>`);
  out.push(rodLine(rods[0]));
  const F = along([0, 0, PAN_Z], [0, 0, 1]);
  out.push(S(G.solidOf([[0, 6], [2, 20, 1], [4, 34, 1], [5, rim]], F, P), { tone: "mid", inner: L(G.circleOf(F, 5, rim - 2.5, P), { tone: "faint" }) }));
  for (let i = 0; i < 10; i++) {
    const z = PAN_Z + 5 + i * 4;
    const W = along([0, 0, z], [0, 0, 1]);
    out.push(`<g data-weight="${i}" style="display:none">${S(G.disc(0, 4, 10, W, P), { tone: "hi", crease: "lo", inner: L(G.arcOf(W, 2, 10, P), { tone: "faint" }) })}</g>`);
  }
  out.push(rodLine(rods[1]), rodLine(rods[2]));
  out.push(D(rods.map(at), { size: 0.7, tone: "mid" }));
  const H = along([0, 0, HUB_Z - 3], [0, 0, 1]);
  out.push(S(G.disc(0, 5, 3.4, H, P), { tone: "mid" }));
  const R = along([0, 0, HUB_Z + 2], [0, 0, 1]);
  out.push(S(G.disc(0, BAR_Z - 8 - HUB_Z - 2, 1.6, R, P), { tone: "mid" }));
  return out.join("");
}

const CSS = `
.ps-svg{--ps-glass:#9fb4c4}
.ps-glass{fill:var(--ps-glass);opacity:.1;stroke:var(--anatomy-lo);stroke-width:.6}
.ps-num{fill:var(--anatomy-hi);font-family:var(--anatomy-mono)}
.ps-unit{fill:var(--anatomy-mid);font-family:var(--anatomy-mono)}
.ps-screw{fill:var(--anatomy-dot);opacity:.5}
.ps-ribbon{fill:none;stroke:var(--anatomy-hi);stroke-width:1.5;stroke-linecap:butt}
.ps-stage{outline:none;touch-action:pan-y;cursor:pointer}
.ps-stage:focus-visible{outline:1px solid var(--anatomy-mid);outline-offset:4px}
body.ps-embed[data-theme="light"]{--anatomy-card:#fff;--anatomy-page:#fff}
body.ps-embed{background:var(--anatomy-card)}
body.ps-embed .iso-page{width:100%;margin:0}
body.ps-embed .iso-figure{margin:0}
body.ps-embed .iso-plate{box-shadow:none;padding:34px 8px 30px}
body.ps-embed .iso-plate-corners{inset:8px 10px}
body.ps-embed .iso-plate .iso-svg{max-height:calc(100vh - 64px);width:auto;max-width:100%}
`;

const live = `
const P = ${JSON.stringify(P)};
const M = ${JSON.stringify(MODEL)};
const MODEL = M;
const GEO = ${JSON.stringify({ PIV, PIV_Z, BAR_Z, DIAL, CASE, EXPLODE, POINTER0, HUB_Z })};
${plateSvg.toString()}
const rot = ${rot.toString()};
const SPAN = ${SPAN.toString()};
const armPoly = ${armPoly.toString()};
${sectorPoly.toString()}
${gearPoly.toString()}
const pointerPoly = ${pointerPoly.toString()};
const arcLine = ${arcLine.toString()};
const phiOf = ${phiOf.toString()};
const sphereSvg = ${JSON.stringify(S(G.sphereOf([0, 0, 0], 8, P), { tone: "hi" }))};
const stage = document.querySelector(".ps-stage");
const svg = stage.querySelector("svg");
const q = (n) => svg.querySelector('[data-part="' + n + '"]');
const mech = q("mech"), pinion = q("pinion"), pan = q("pan"), dial = q("dial"), pointer = q("pointer"), glassEl = q("glass");
pan.innerHTML = ${JSON.stringify(panSvg())};
const weights = [...pan.querySelectorAll("[data-weight]")];
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const { PIV, PIV_Z, BAR_Z, DIAL, EXPLODE, POINTER0 } = GEO;
const at = (p) => iso(p, P);
const ballAt = (p) => { const s = at(p), o = at([0, 0, 0]); return '<g transform="translate(' + (s[0] - o[0]).toFixed(2) + ' ' + (s[1] - o[1]).toFixed(2) + ')">' + sphereSvg + '</g>'; };
function drawMech(phi) {
  const drop = M.R * phi;
  const bar = BAR_Z - drop;
  let out = "";
  // ribbons: vertical runs behind the sectors' rims, then the wrapped arcs
  for (const s of [-1, 1]) {
    const x = s * PIV - s * (M.R + 0.5);
    out += '<path class="ps-ribbon" d="M' + at([x, 0, bar]).map((v) => v.toFixed(2)).join(" ") + "L" + at([x, 0, PIV_Z]).map((v) => v.toFixed(2)).join(" ") + '"/>';
  }
  // crossbar with rack and ribbon clamps
  out += plateSvg([[-26, bar - 8], [26, bar - 8], [26, bar], [-26, bar]], -4, 4, P, { tone: "hi" });
  out += plateSvg([[6, bar], [11, bar], [11, bar + 132], [6, bar + 132]], -4, 0, P, { tone: "hi" });
  let teeth = "";
  for (let z = bar + 70; z < bar + 130; z += 2.4) teeth += "M" + at([6, 0, z]).map((v) => v.toFixed(2)).join(" ") + "L" + at([4.6, 0, z + 1.2]).map((v) => v.toFixed(2)).join(" ") + "L" + at([6, 0, z + 2.4]).map((v) => v.toFixed(2)).join(" ");
  out += '<path class="iso-line" data-tone="mid" d="' + teeth + '"/>';
  for (const s of [-1, 1]) {
    const x = s * (PIV - M.R - 0.5);
    out += plateSvg([[x - 3.5, bar], [x + 3.5, bar], [x + 3.5, bar + 5], [x - 3.5, bar + 5]], -3, 3, P, { tone: "mid" });
  }
  // pendulums: sector + arm (lit), counterweight, wrapped ribbon arc
  for (const s of [-1, 1]) {
    const a = s < 0 ? -phi : phi;
    const cx = s * PIV;
    out += plateSvg(rot(sectorPoly(s, M.R), cx, PIV_Z, a), -3, 3, P, { tone: "hi", lit: true });
    // two lightening holes in the sector face
    const [sa, sb] = SPAN(s);
    for (const m of [0.3, 0.72]) {
      const g = sa + m * (sb - sa) + a;
      const hx = cx + 0.6 * M.R * Math.cos(g), hz = PIV_Z + 0.6 * M.R * Math.sin(g);
      out += '<path class="iso-line" data-tone="lo" d="' + arcLine(hx, hz, 3.2, 0, Math.PI * 2, 3, 20) + 'Z"/>';
    }
    const r0 = s < 0 ? 0 : Math.PI / 2 + phi, r1 = s < 0 ? Math.PI / 2 - phi : Math.PI;
    out += '<path class="ps-ribbon" d="' + arcLine(cx, PIV_Z, M.R + 0.5, r0, r1, 0, 16) + '"/>';
    const anchor = s < 0 ? Math.PI / 2 - phi : Math.PI / 2 + phi;
    out += '<circle class="iso-wire-end" cx="' + at([cx + (M.R + 0.5) * Math.cos(anchor), 0, PIV_Z + (M.R + 0.5) * Math.sin(anchor)])[0].toFixed(2) + '" cy="' + at([cx + (M.R + 0.5) * Math.cos(anchor), 0, PIV_Z + (M.R + 0.5) * Math.sin(anchor)])[1].toFixed(2) + '" r="1"/>';
    out += plateSvg(rot(armPoly(M.L), cx, PIV_Z, a), 3, 5.5, P, { tone: "hi", lit: true });
    for (const d of [-10, -16]) { const [bx, bz] = rot([[0, d]], cx, PIV_Z, a)[0]; const b = at([bx, 5.5, bz]); out += '<circle class="ps-screw" cx="' + b[0].toFixed(2) + '" cy="' + b[1].toFixed(2) + '" r="0.6"/>'; }
    // counterweight rigidly on the arm: centred on the arm's axis end, in the arm's mid-plane
    const [wx, wz] = rot([[0, -M.L]], cx, PIV_Z, a)[0];
    out += ballAt([wx, 4.25, wz]);
  }
  mech.innerHTML = out;
  const theta = (M.R * phi) / M.RP;
  pinion.innerHTML = plateSvg(rot(gearPoly(14, 7, 5.4), 0, DIAL.z, -theta), -4, 0, P, { tone: "hi" });
  const off = at([0, 0, -drop]), o = at([0, 0, 0]);
  pan.setAttribute("transform", "translate(" + (off[0] - o[0]).toFixed(2) + " " + (off[1] - o[1]).toFixed(2) + ")");
  return theta;
}
const shift = (v, t) => { const a = at([v[0] * t, v[1] * t, v[2] * t]), o = at([0, 0, 0]); return "translate(" + (a[0] - o[0]).toFixed(2) + " " + (a[1] - o[1]).toFixed(2) + ")"; };
function drawFront(theta, ex) {
  const pivot = [0, DIAL.z];
  pointer.innerHTML = plateSvg(rot(pointerPoly(), 0, DIAL.z, -(POINTER0 + theta)), 9.5, 11, P, { tone: "hi" }) + '<g>' + plateSvg(rot(gearPoly(24, 3.4, 3.4), 0, DIAL.z, 0), 11, 13, P, { tone: "mid" }) + "</g>";
  dial.setAttribute("transform", shift(EXPLODE.dial, ex));
  pointer.setAttribute("transform", shift(EXPLODE.pointer, ex));
  glassEl.setAttribute("transform", shift(EXPLODE.glass, ex));
}
let load = 0, f = 0, fv = 0, ex = 0, exTarget = 0, clock = 0, touring = true, visible = false, frame = 0, last = 0, idle = 0;
const tour = [[3, 0], [7, 0], [10, 0], [10, 1], [4, 1], [0, 1], [0, 0]];
let step = 0, stepClock = 0;
function draw() {
  const phi = phiOf(f);
  const theta = drawMech(phi);
  drawFront(theta, ex);
  weights.forEach((w, i) => (w.style.display = i < load ? "" : "none"));
  const reading = Math.sin(phi) / Math.sin(M.phimax) * M.fmax;
  const text = "carico " + load + " kg · φ " + (phi * 180 / Math.PI).toFixed(1) + "° · lettura " + reading.toFixed(1) + " kg";
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(load));
  stage.setAttribute("aria-valuetext", text + (exTarget ? ", vista esplosa" : ""));
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) {
    stepClock += dt;
    if (stepClock > 2.6) { stepClock = 0; step = (step + 1) % tour.length; load = tour[step][0]; exTarget = tour[step][1]; }
  }
  // damped pendulum response: natural frequency ~1.3 Hz, damping ratio 0.3
  const w = 8, z = 0.3;
  for (let i = 0; i < 4; i++) { const h = dt / 4; fv += (w * w * (load - f) - 2 * z * w * fv) * h; f += fv * h; }
  ex += (exTarget - ex) * (1 - Math.exp(-dt / 0.35));
  draw();
  const settled = !touring && Math.abs(load - f) < 0.002 && Math.abs(fv) < 0.002 && Math.abs(exTarget - ex) < 0.002;
  frame = visible && !still.matches && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => {
  if (still.matches) { f = load; fv = 0; ex = exTarget; draw(); return; }
  if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); }
};
const hold = () => { touring = false; clearTimeout(idle); idle = setTimeout(() => { touring = !still.matches; stepClock = 0; run(); }, 5000); };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) touring = false;
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const next = clamp(Math.round(((event.clientX - box.left) / box.width - 0.15) / 0.7 * M.fmax), 0, M.fmax);
  hold();
  if (next !== load) { load = next; run(); }
});
stage.addEventListener("click", () => { hold(); exTarget = exTarget ? 0 : 1; run(); });
stage.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight" || event.key === "ArrowUp") load = Math.min(M.fmax, load + 1);
  else if (event.key === "ArrowLeft" || event.key === "ArrowDown") load = Math.max(0, load - 1);
  else if (event.key === "e" || event.key === " " || event.key === "Enter") exTarget = exTarget ? 0 : 1;
  else return;
  event.preventDefault();
  hold();
  run();
});
draw();
`;

const body = k.plateHtml({
  fig: "Fig 3",
  title: "Bilancia a pendolo",
  hint: "Muovi: carico · clic: vista esplosa",
  readout: "carico 0 kg · φ 0.0° · lettura 0.0 kg",
  keys: [],
  caption: "",
  body: `<div class="iso-stage ps-stage" tabindex="0" role="slider" aria-label="Bilancia a pendolo: frecce per il carico, E per la vista esplosa" aria-valuemin="0" aria-valuemax="${MODEL.fmax}" aria-valuenow="0">${svg}</div>`,
});

const html = k
  .pageHtml({ title: "Pendulum scale", theme, body, script: kitScript() + live })
  .replace("</style>", `${CSS}</style>`)
  .replace(`<body class="iso"`, `<body class="iso ps-embed"`);
writeFileSync(OUT, html);
console.log("wrote", OUT);
