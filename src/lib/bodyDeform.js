/**
 * lib/bodyDeform.js
 *
 * Shapes a 3D body to real tape measurements, region by region.
 *
 * The old renderer blended waist and chest (men) or waist and hips (women)
 * into ONE sideways stretch and ONE front-to-back stretch for the whole body,
 * so a bigger waist also widened the head, shoulders and ankles, hips were
 * ignored for men, chest for women, and arm size for everyone.
 *
 * Here each region is scaled on its own and blended smoothly into its
 * neighbours:
 *   chest/bust  around ~72% of height
 *   waist       narrowest trunk girth, ~58–66%
 *   hips        widest trunk girth above the crotch, ~51–58% (fading down
 *               the thighs to mid-thigh)
 *   upper arm   around the biceps, fading to the elbow and shoulder
 *
 * The body's OWN girths are measured from the mesh first (a horizontal
 * slice through the trunk, taped as an ellipse), so the target ratio for a
 * region is simply  (your girth / your height) / (body's girth / its height).
 * That makes it work for any of the male or female meshes without
 * hand-tuned per-model numbers.
 *
 * Pure functions on a positions array (x, y, z; y up). No three.js import.
 */

const BINS = 200; // height bins (0.5% of height each)

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Ramanujan's approximation of an ellipse perimeter (a, b = half axes). */
function ellipsePerimeter(a, b) {
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

function movingAverage(arr, radius) {
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i += 1) {
    let s = 0;
    let n = 0;
    for (let j = Math.max(0, i - radius); j <= Math.min(arr.length - 1, i + radius); j += 1) {
      if (Number.isFinite(arr[j])) {
        s += arr[j];
        n += 1;
      }
    }
    out[i] = n ? s / n : NaN;
  }
  return out;
}

/**
 * Measure a body mesh once (cache the result per geometry).
 * @param {Float32Array|number[]} pos  vertex positions, xyz interleaved, y up
 * @param {{ sex?: 'male'|'female' }} [opts]  women are taped at the fullest
 *        part of the bust, which usually sits where the arms rest against it
 */
export function analyzeBody(pos, { sex = 'male' } = {}) {
  const n = pos.length / 3;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i += 1) {
    const x = pos[i * 3];
    const y = pos[i * 3 + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const H = maxY - minY || 1;
  const cx = (minX + maxX) / 2;

  const f = new Float32Array(n);
  const bin = new Uint16Array(n);
  const members = Array.from({ length: BINS }, () => []);
  for (let i = 0; i < n; i += 1) {
    f[i] = (pos[i * 3 + 1] - minY) / H;
    bin[i] = Math.min(BINS - 1, Math.floor(f[i] * BINS));
    members[bin[i]].push(i);
  }

  // --- arms: between the wrists and the armpits the arm is separated from
  // the trunk by a clear gap in |x|; everything beyond that gap is arm.
  // armSplit marks the heights where that separation exists (above the
  // armpits the arm joins the shoulder and the trunk can't be isolated).
  const arm = new Uint8Array(n);
  const armSplit = new Uint8Array(BINS);
  const trunkEdge = new Float32Array(BINS).fill(NaN);
  // Thresholds sized for the narrowest trunk (a slim woman is ~0.055 of her
  // height either side of centre) and the lowest hands (~47% of height).
  const gapMin = 0.03 * H;
  const trunkMin = 0.035 * H;
  for (let b = Math.floor(0.47 * BINS); b <= Math.floor(0.745 * BINS); b += 1) {
    const ids = members[b];
    if (ids.length < 8) continue;
    const xs = ids.map((i) => Math.abs(pos[i * 3] - cx)).sort((p, q) => p - q);
    let edge = null;
    for (let k = 0; k < xs.length - 1; k += 1) {
      if (xs[k] > trunkMin && xs[k + 1] - xs[k] > gapMin) {
        edge = xs[k];
        break;
      }
    }
    if (edge === null) continue;
    armSplit[b] = 1;
    trunkEdge[b] = edge;
    for (const i of ids) if (Math.abs(pos[i * 3] - cx) > edge + 1e-6) arm[i] = 1;
  }
  // Where the arms touch the trunk (bust height, especially on women) no gap
  // exists. Follow each arm up from where it is still separate: fit its
  // centre line (x, z against height) over the last clean heights and keep
  // its thickness, then above that point treat only vertices inside the
  // predicted arm tube as arm when MEASURING. This keeps the full width of
  // the bust or chest instead of clipping it.
  let armTopBin = null;
  for (let b = Math.floor(0.47 * BINS); b <= Math.floor(0.745 * BINS); b += 1) if (armSplit[b]) armTopBin = b;
  const armTrack = [null, null]; // per side: { at(b) -> [x, z], r }
  if (armTopBin !== null) {
    for (let side = 0; side < 2; side += 1) {
      const pts = [];
      for (let b = Math.max(0, armTopBin - 10); b <= armTopBin; b += 1) {
        if (!armSplit[b]) continue;
        let sx = 0;
        let sz = 0;
        let c = 0;
        for (const i of members[b]) {
          if (!arm[i] || (pos[i * 3] < cx ? 0 : 1) !== side) continue;
          sx += pos[i * 3];
          sz += pos[i * 3 + 2];
          c += 1;
        }
        if (c < 3) continue;
        const mx = sx / c;
        const mz = sz / c;
        let r = 0;
        for (const i of members[b]) {
          if (!arm[i] || (pos[i * 3] < cx ? 0 : 1) !== side) continue;
          r += Math.hypot(pos[i * 3] - mx, pos[i * 3 + 2] - mz);
        }
        pts.push({ b, x: mx, z: mz, r: r / c });
      }
      if (pts.length < 2) continue;
      // least-squares line for x(b) and z(b)
      const m = pts.length;
      const mb = pts.reduce((a2, q) => a2 + q.b, 0) / m;
      const mxx = pts.reduce((a2, q) => a2 + q.x, 0) / m;
      const mzz = pts.reduce((a2, q) => a2 + q.z, 0) / m;
      const vb = pts.reduce((a2, q) => a2 + (q.b - mb) ** 2, 0) || 1;
      const kx = pts.reduce((a2, q) => a2 + (q.b - mb) * (q.x - mxx), 0) / vb;
      const kz = pts.reduce((a2, q) => a2 + (q.b - mb) * (q.z - mzz), 0) / vb;
      const r = pts.reduce((a2, q) => a2 + q.r, 0) / m;
      armTrack[side] = { at: (bb) => [mxx + kx * (bb - mb), mzz + kz * (bb - mb)], r };
    }
  }
  const armTubeTop = Math.floor(0.79 * BINS);
  const measureAsArm = (i, b) => {
    if (arm[i]) return true;
    if (armTopBin === null || b <= armTopBin || b > armTubeTop) return false;
    const tr = armTrack[pos[i * 3] < cx ? 0 : 1];
    if (!tr) return false;
    const [ax, az] = tr.at(b);
    // 1.6 x the mean radius ~ the arm's outer surface plus a small margin
    return Math.hypot(pos[i * 3] - ax, pos[i * 3 + 2] - az) < tr.r * 1.6;
  };
  const carried = (b) => armTopBin !== null && b > armTopBin && b <= armTubeTop;

  // Bins whose trunk outline is trustworthy: below the wrists, above the
  // shoulders, where the arm was split off, or where its edge was carried.
  const trunkValid = (b) => {
    const t = (b + 0.5) / BINS;
    return t < 0.47 || t > 0.8 || armSplit[b] === 1 || carried(b);
  };

  // --- raw trunk extents per bin (arms excluded); legs per side
  const rx0 = new Float32Array(BINS).fill(Infinity);
  const rx1 = new Float32Array(BINS).fill(-Infinity);
  const rz0 = new Float32Array(BINS).fill(Infinity);
  const rz1 = new Float32Array(BINS).fill(-Infinity);
  const legX = [new Float32Array(BINS).fill(NaN), new Float32Array(BINS).fill(NaN)]; // [left, right]
  const legZ = [new Float32Array(BINS).fill(NaN), new Float32Array(BINS).fill(NaN)];
  for (let b = 0; b < BINS; b += 1) {
    const sx = [0, 0];
    const sz = [0, 0];
    const cnt = [0, 0];
    for (const i of members[b]) {
      if (measureAsArm(i, b)) continue;
      const x = pos[i * 3];
      const z = pos[i * 3 + 2];
      if (x < rx0[b]) rx0[b] = x;
      if (x > rx1[b]) rx1[b] = x;
      if (z < rz0[b]) rz0[b] = z;
      if (z > rz1[b]) rz1[b] = z;
      const s = x < cx ? 0 : 1;
      sx[s] += x;
      sz[s] += z;
      cnt[s] += 1;
    }
    for (let s = 0; s < 2; s += 1) {
      if (cnt[s]) {
        legX[s][b] = sx[s] / cnt[s];
        legZ[s][b] = sz[s] / cnt[s];
      }
    }
  }

  // --- trunk outline per bin over a +/-1.5% band (a thin slice of a
  // low-poly mesh catches too few vertices and under-reads the girth)
  const W = 3;
  // Don't mix slice kinds in one band: arm-split slices, arm-tracked slices
  // (arms touching the trunk) and plain slices each measure the trunk a
  // slightly different way.
  const sliceKind = (b) => (armSplit[b] ? 1 : carried(b) ? 2 : 0);
  const halfW = new Float32Array(BINS).fill(NaN);
  const czB = new Float32Array(BINS).fill(NaN);
  const girth = new Float32Array(BINS).fill(NaN);
  for (let b = 0; b < BINS; b += 1) {
    if (!trunkValid(b)) continue;
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (let j = Math.max(0, b - W); j <= Math.min(BINS - 1, b + W); j += 1) {
      if (!trunkValid(j) || sliceKind(j) !== sliceKind(b) || !(rx1[j] > rx0[j])) continue;
      x0 = Math.min(x0, rx0[j]);
      x1 = Math.max(x1, rx1[j]);
      z0 = Math.min(z0, rz0[j]);
      z1 = Math.max(z1, rz1[j]);
    }
    if (!(x1 > x0)) continue;
    halfW[b] = Math.max(Math.abs(x0 - cx), Math.abs(x1 - cx));
    czB[b] = (z0 + z1) / 2;
    girth[b] = ellipsePerimeter((x1 - x0) / 2, (z1 - z0) / 2) / H;
  }

  const range = (a, b) => [Math.floor(a * BINS), Math.min(BINS - 1, Math.floor(b * BINS))];
  const pick = ([a, b], better) => {
    let best = null;
    for (let k = a; k <= b; k += 1) {
      if (!Number.isFinite(girth[k])) continue;
      if (best === null || better(girth[k], girth[best])) best = k;
    }
    return best;
  };
  const hipBin = pick(range(0.51, 0.58), (p, q) => p > q);
  const waistBin = pick(range(0.58, 0.665), (p, q) => p < q);
  // Chest (men): where the arms are cleanly separate at chest height, tape
  // there; the arm-tracked slices above it also catch the deltoids.
  // Bust (women): the fullest part of the bust usually sits where the arms
  // rest against it, so the arm-tracked slices count too.
  const chestRange = range(0.69, 0.745);
  let chestBin = null;
  const kindOrder = sex === 'female' ? [[1, 2]] : [[1], [2]];
  for (const kinds of kindOrder) {
    for (let k = chestRange[0]; k <= chestRange[1]; k += 1) {
      if (!kinds.includes(sliceKind(k)) || !Number.isFinite(girth[k])) continue;
      if (chestBin === null || girth[k] > girth[chestBin]) chestBin = k;
    }
    if (chestBin !== null) break;
  }
  const armTop = armTopBin === null ? 0.72 : (armTopBin + 0.5) / BINS;

  // --- arm membership used for SHAPING: the split-off arm below the armpit
  // plus the tracked arm tube above it, and each arm's centre per height.
  const armLike = new Uint8Array(n);
  const armCx = [new Float32Array(BINS).fill(NaN), new Float32Array(BINS).fill(NaN)];
  const armCz = [new Float32Array(BINS).fill(NaN), new Float32Array(BINS).fill(NaN)];
  for (let bb = 0; bb < BINS; bb += 1) {
    const sx = [0, 0];
    const sz = [0, 0];
    const c = [0, 0];
    for (const i of members[bb]) {
      if (!measureAsArm(i, bb)) continue;
      armLike[i] = 1;
      const side = pos[i * 3] < cx ? 0 : 1;
      sx[side] += pos[i * 3];
      sz[side] += pos[i * 3 + 2];
      c[side] += 1;
    }
    for (let side = 0; side < 2; side += 1) {
      if (carried(bb) && armTrack[side]) {
        const [px, pz] = armTrack[side].at(bb);
        armCx[side][bb] = px;
        armCz[side][bb] = pz;
      } else if (c[side]) {
        armCx[side][bb] = sx[side] / c[side];
        armCz[side][bb] = sz[side] / c[side];
      }
    }
  }

  // --- upper-arm girth at the biceps (~71% of height, midway between the
  // shoulder and the elbow): distance of arm vertices from the arm's own
  // centre line (the fitted track, which follows the A-pose tilt).
  let bicepSum = 0;
  let bicepCount = 0;
  for (let i = 0; i < n; i += 1) {
    if (!armLike[i] || f[i] < 0.69 || f[i] > 0.73) continue;
    const tr = armTrack[pos[i * 3] < cx ? 0 : 1];
    if (!tr) continue;
    const bb = bin[i];
    const [px, pz] = tr.at(bb);
    const [qx, qz] = tr.at(bb + 1);
    // direction of the arm line per bin step (x, y, z)
    const d = [qx - px, H / BINS, qz - pz];
    const dl = Math.hypot(d[0], d[1], d[2]) || 1;
    const v = [pos[i * 3] - px, 0, pos[i * 3 + 2] - pz];
    const along = (v[0] * d[0] + v[2] * d[2]) / dl;
    bicepSum += Math.sqrt(Math.max(0, v[0] * v[0] + v[2] * v[2] - along * along));
    bicepCount += 1;
  }

  return {
    n,
    H,
    cx,
    f,
    bin,
    arm,
    halfW: movingAverage(halfW, 3),
    czB: movingAverage(czB, 4),
    legX: legX.map((a) => movingAverage(a, 4)),
    legZ: legZ.map((a) => movingAverage(a, 4)),
    armLike,
    armCx: armCx.map((a) => movingAverage(a, 2)),
    armCz: armCz.map((a) => movingAverage(a, 2)),
    landmarks: {
      armTop,
      hip: hipBin === null ? 0.54 : (hipBin + 0.5) / BINS,
      waist: waistBin === null ? 0.62 : (waistBin + 0.5) / BINS,
      chest: chestBin === null ? 0.72 : (chestBin + 0.5) / BINS,
    },
    // Girths as a fraction of height (scale-free, so comparable with a person's).
    refs: {
      hip: hipBin === null ? null : girth[hipBin],
      waist: waistBin === null ? null : girth[waistBin],
      chest: chestBin === null ? null : girth[chestBin],
      bicep: bicepCount ? (2 * Math.PI * (bicepSum / bicepCount)) / H : null,
    },
  };
}

/**
 * Region factors from real measurements: 1.0 = the body as modelled.
 *
 * The body itself is chosen to be the closest match in the library
 * (lib/bodyLibrary.js), so reshaping only fine-tunes it: each region is
 * limited to +/-6% by default. Larger changes made bodies look abnormal.
 *
 * @param refs  the body's own girth/height ratios; pass the library's
 *              offline measurements (more reliable), else the runtime ones
 */
export function measurementFactors(analysis, { heightCm, chestCm, waistCm, hipCm, bicepCm }, limits = [0.94, 1.06], refs = null) {
  const h = Number(heightCm);
  const factor = (cm, ref) => {
    const v = Number(cm);
    if (!(h > 0) || !(v > 0) || !(ref > 0)) return 1;
    return clamp(v / h / ref, limits[0], limits[1]);
  };
  const r = (k) => (refs && refs[k] > 0 ? refs[k] : analysis.refs[k]);
  return {
    chest: factor(chestCm, r('chest')),
    waist: factor(waistCm, r('waist')),
    hip: factor(hipCm, r('hip')),
    bicep: factor(bicepCm, r('bicep')),
  };
}

/** Trunk scale at height fraction t, interpolated through the landmarks. */
function trunkFactor(t, L, k) {
  const keys = [
    [L.hip - 0.11, 1], // mid-thigh: unchanged
    [L.hip, k.hip],
    [L.waist, k.waist],
    [L.chest, k.chest],
    [Math.min(L.chest + 0.09, 0.87), 1], // base of the neck: unchanged
  ];
  if (t <= keys[0][0] || t >= keys[keys.length - 1][0]) return 1;
  for (let j = 0; j < keys.length - 1; j += 1) {
    const [t0, v0] = keys[j];
    const [t1, v1] = keys[j + 1];
    if (t >= t0 && t <= t1) return v0 + (v1 - v0) * smooth(t0, t1, t);
  }
  return 1;
}

/**
 * Return reshaped positions (new Float32Array).
 * @param pos       original positions
 * @param analysis  from analyzeBody(pos)
 * @param k         { chest, waist, hip, bicep } from measurementFactors()
 */
export function deformBody(pos, analysis, k) {
  const { n, H, cx, f, bin, armLike, halfW, czB, legX, legZ, armCx, armCz, landmarks: L } = analysis;
  const out = new Float32Array(pos.length);
  const ok = (v) => Number.isFinite(v);
  const blendBand = 0.04 * H; // how quickly front-back scaling fades beyond the trunk edge

  for (let i = 0; i < n; i += 1) {
    const x0 = pos[i * 3];
    const y = pos[i * 3 + 1];
    const z0 = pos[i * 3 + 2];
    const t = f[i];
    const b = bin[i];
    const F = trunkFactor(t, L, k);
    const side = x0 < cx ? 0 : 1;
    const sign = side === 0 ? -1 : 1;
    const isArm = armLike[i] === 1;

    let x = x0;
    let z = z0;

    // 1. Upper arm (biceps): thicken/thin around the arm's own centre,
    //    strongest midway between shoulder and elbow, fading at both ends.
    const wArm = smooth(0.62, 0.67, t) * (1 - smooth(0.75, 0.79, t));
    if (isArm && k.bicep !== 1 && wArm > 0 && ok(armCx[side][b])) {
      const m = 1 + (k.bicep - 1) * wArm;
      x = armCx[side][b] + (x - armCx[side][b]) * m;
      z = armCz[side][b] + (z - armCz[side][b]) * m;
    }

    if (F !== 1) {
      // 2. Trunk. One continuous rule: whatever lies within the trunk's
      //    half-width is scaled; whatever lies beyond it (arms, shoulder
      //    caps) is carried outward with the trunk edge, so no seam can form
      //    where an arm meets the body.
      const hw = ok(halfW[b]) ? halfW[b] : Math.abs(x0 - cx);
      const ax = Math.abs(x0 - cx);
      const trunkX = cx + sign * (Math.min(ax, hw) * F + Math.max(0, ax - hw));
      const cz = ok(czB[b]) ? czB[b] : 0;
      const wz = isArm ? 0 : 1 - smooth(hw, hw + blendBand, ax);
      const trunkZ = cz + (z0 - cz) * (1 + (F - 1) * wz);

      // 3. Legs: below the hips each thigh scales about its own centre;
      //    blended into the trunk rule across the top of the thighs.
      const lx = ok(legX[side][b]) ? legX[side][b] : cx;
      const lz = ok(legZ[side][b]) ? legZ[side][b] : cz;
      const legXv = lx + (x0 - lx) * F;
      const legZv = lz + (z0 - lz) * F;
      const wTrunk = smooth(L.hip - 0.07, L.hip - 0.02, t);

      const dx = legXv + (trunkX - legXv) * wTrunk - x0;
      const dz = legZv + (trunkZ - legZv) * wTrunk - z0;
      x += dx;
      z += dz;
    }

    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  }
  return out;
}
