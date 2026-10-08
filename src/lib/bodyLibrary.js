/**
 * lib/bodyLibrary.js
 *
 * The 3D body library and how a body is chosen for a person.
 *
 * 20 adult bodies (7 male, 13 female), each its own ~280 KB file in
 * /public/models/bodies/, so only the body on screen is downloaded.
 * Sources (all CC BY 4.0, credited in the Terms via MODEL_CREDITS):
 *   rawpheasant  "Five female body type models" by RawPheasant5745
 *   cakmak       "Humans Base Mesh" by Neslihan Çakmak
 *   seifert      "Body Types Basemesh" by Peter Seifert
 * Each was split from its source file, normalised (feet on the floor,
 * 1.75 m), and simplified to 24k triangles.
 *
 * refs = the body's own girths divided by its height, measured offline by
 * cutting the mesh with horizontal planes and taping the trunk outline
 * (arms excluded wherever they are separate):
 *   waist = narrowest trunk girth at 58–68% of height
 *   hip   = widest trunk girth at 48–58%
 *   chest = widest trunk girth at 68–76% (bust for women)
 *   bicep = upper-arm girth at 66–74%, corrected for the A-pose tilt
 * A few stylised bodies have deliberately extreme proportions (e.g. 40–45 cm
 * hourglass waists); they are only picked for people whose own
 * proportions are close.
 *
 * types = which body-type classes (lib/physiqueClassifier.js) a body suits.
 */

export const BODY_LIBRARY = [
  { id: 'm-slim', sex: 'male', label: 'Slim', source: 'seifert', types: ['SLIM'], refs: { chest: 0.535, waist: 0.366, hip: 0.408, bicep: 0.158 } },
  { id: 'm-lean', sex: 'male', label: 'Lean / athletic', source: 'seifert', types: ['LEAN'], refs: { chest: 0.541, waist: 0.344, hip: 0.371, bicep: 0.169 } },
  { id: 'm-average', sex: 'male', label: 'Average', source: 'cakmak', types: ['LEAN', 'SOFT_BELLY'], refs: { chest: 0.571, waist: 0.43, hip: 0.501, bicep: 0.166 } },
  { id: 'm-muscled', sex: 'male', label: 'Muscled', source: 'cakmak', types: ['MUSCULAR'], refs: { chest: 0.608, waist: 0.517, hip: 0.583, bicep: 0.208 } },
  { id: 'm-muscular', sex: 'male', label: 'Very muscular', source: 'seifert', types: ['MUSCULAR'], refs: { chest: 0.547, waist: 0.422, hip: 0.442, bicep: 0.205 } },
  { id: 'm-heavy', sex: 'male', label: 'Heavy-set', source: 'seifert', types: ['SOFT_BELLY', 'OBESE'], refs: { chest: 0.711, waist: 0.52, hip: 0.52, bicep: 0.168 } },
  { id: 'm-plus', sex: 'male', label: 'Plus-size', source: 'cakmak', types: ['OBESE'], refs: { chest: 0.722, waist: 0.719, hip: 0.794, bicep: 0.244 } },
  { id: 'f-slim', sex: 'female', label: 'Slim', source: 'rawpheasant', types: ['SLIM'], refs: { chest: 0.453, waist: 0.258, hip: 0.472, bicep: 0.131 } },
  { id: 'f-slim-tall', sex: 'female', label: 'Slim (tall build)', source: 'seifert', types: ['SLIM'], refs: { chest: 0.371, waist: 0.272, hip: 0.464, bicep: 0.099 } },
  { id: 'f-petite', sex: 'female', label: 'Petite athletic', source: 'seifert', types: ['SLIM', 'LEAN'], refs: { chest: 0.353, waist: 0.248, hip: 0.563, bicep: 0.121 } },
  { id: 'f-lean', sex: 'female', label: 'Lean', source: 'rawpheasant', types: ['LEAN'], refs: { chest: 0.508, waist: 0.352, hip: 0.595, bicep: 0.165 } },
  { id: 'f-average', sex: 'female', label: 'Average', source: 'cakmak', types: ['LEAN', 'SOFT_BELLY'], refs: { chest: 0.5, waist: 0.365, hip: 0.558, bicep: 0.145 } },
  { id: 'f-average-2', sex: 'female', label: 'Average (soft)', source: 'seifert', types: ['LEAN'], refs: { chest: 0.398, waist: 0.258, hip: 0.48, bicep: 0.113 } },
  { id: 'f-hourglass', sex: 'female', label: 'Hourglass', source: 'seifert', types: ['LEAN', 'SOFT_BELLY'], refs: { chest: 0.416, waist: 0.276, hip: 0.526, bicep: 0.126 } },
  { id: 'f-muscled', sex: 'female', label: 'Muscled', source: 'cakmak', types: ['MUSCULAR'], refs: { chest: 0.622, waist: 0.44, hip: 0.6, bicep: 0.181 } },
  { id: 'f-muscular', sex: 'female', label: 'Very muscular', source: 'rawpheasant', types: ['MUSCULAR'], refs: { chest: 0.536, waist: 0.365, hip: 0.622, bicep: 0.168 } },
  { id: 'f-soft', sex: 'female', label: 'Soft belly', source: 'rawpheasant', types: ['SOFT_BELLY'], refs: { chest: 0.483, waist: 0.392, hip: 0.647, bicep: 0.171 } },
  { id: 'f-curvy', sex: 'female', label: 'Curvy', source: 'seifert', types: ['SOFT_BELLY'], refs: { chest: 0.422, waist: 0.33, hip: 0.58, bicep: 0.144 } },
  { id: 'f-plus', sex: 'female', label: 'Plus-size', source: 'cakmak', types: ['OBESE'], refs: { chest: 0.63, waist: 0.594, hip: 0.739, bicep: 0.175 } },
  { id: 'f-heavy', sex: 'female', label: 'Heavy-set', source: 'rawpheasant', types: ['OBESE'], refs: { chest: 0.54, waist: 0.475, hip: 0.778, bicep: 0.188 } },
];

/** One representative body per type, for the landing-page showcase. */
const SHOWCASE = {
  male: { SLIM: 'm-slim', LEAN: 'm-lean', MUSCULAR: 'm-muscled', SOFT_BELLY: 'm-average', OBESE: 'm-plus' },
  female: { SLIM: 'f-slim', LEAN: 'f-lean', MUSCULAR: 'f-muscular', SOFT_BELLY: 'f-soft', OBESE: 'f-heavy' },
};

// How much each measurement counts when matching a body. Waist says the most
// about body fat; hips and chest describe the shape; the upper arm only
// fine-tunes (it is the hardest to measure consistently).
const WEIGHTS = { waist: 1.0, hip: 0.75, chest: 0.6, bicep: 0.3 };
// Score added when a body is not tagged for the person's body type. About
// the cost of a 12% waist mismatch: the type steers, the tape decides.
const TYPE_MISMATCH = 0.015;

export function bodyUrl(id) {
  return `/models/bodies/${id}.glb`;
}

export function getBody(id) {
  return BODY_LIBRARY.find((b) => b.id === id) || null;
}

/** Representative body for a type (landing showcase). */
export function showcaseBody(sex, typeKey) {
  const s = sex === 'female' ? 'female' : 'male';
  return getBody(SHOWCASE[s][typeKey] || SHOWCASE[s].LEAN);
}

/**
 * Pick the body whose own proportions are closest to the person's.
 * Distance = weighted sum of squared log-ratios (so 10% too big and 10% too
 * small count the same), plus a small penalty when the body is not tagged
 * for the person's body type.
 */
export function selectBody({ sex, typeKey, heightCm, chestCm, waistCm, hipCm, bicepCm }) {
  const s = sex === 'female' ? 'female' : 'male';
  const h = Number(heightCm);
  const user = {
    chest: Number(chestCm) / h,
    waist: Number(waistCm) / h,
    hip: Number(hipCm) / h,
    bicep: Number(bicepCm) / h,
  };
  let best = null;
  for (const body of BODY_LIBRARY) {
    if (body.sex !== s) continue;
    let sum = 0;
    let weight = 0;
    for (const [k, w] of Object.entries(WEIGHTS)) {
      const u = user[k];
      const r = body.refs[k];
      if (!(u > 0) || !(r > 0)) continue;
      sum += w * Math.log(u / r) ** 2;
      weight += w;
    }
    let score = weight ? sum / weight : 1;
    if (typeKey && !body.types.includes(typeKey)) score += TYPE_MISMATCH;
    if (!best || score < best.score) best = { body, score };
  }
  return best ? best.body : showcaseBody(s, typeKey);
}
