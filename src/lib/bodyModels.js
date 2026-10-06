/**
 * lib/bodyModels.js
 *
 * Which GLB to load for each sex, and which mesh inside it is which body.
 *
 * Meshes are picked by position, not by name. three.js's GLTFLoader strips
 * dots from node names ("guy.004_Skin.004_0" becomes "guy004_Skin004_0"),
 * so the old `name.includes('guy.004')` lookup never matched and every body
 * silently came from a hard-coded fallback index — several of which pointed
 * at the wrong body (e.g. "Obese" rendered the muscular mesh).
 *
 * Both files list their five bodies in the same order, so one slot table
 * serves both. Slots were checked visually against each mesh:
 *
 *   slot  male file   female file              shape
 *   0     guy.004     female_soft_belly        soft belly / "skinny fat"
 *   1     guy.001     female_lean              lean
 *   2     guy.002     female_muscular          muscular / athletic
 *   3     guy.003     female_heavyset_obese    obese
 *   4     guy.005     female_slim              slim / skinny
 *
 * The female file is built from "Five female body type models" by
 * RawPheasant5745 (CC BY 4.0). The original is one 1M-triangle lineup cut
 * into 10 arbitrary chunks, so it was merged, split into the five bodies,
 * put in the slot order above, simplified from ~200k to 36k triangles each
 * (27 MB -> 4.3 MB) and scaled to 1.70 m. Credit is shown in the Terms
 * (MODEL_CREDITS below) as the licence requires.
 */

export const BODY_MODEL_URL = {
  male: '/models/stylized_male_base_mesh_free.glb',
  female: '/models/female_body_types.glb',
};

export const MESH_SLOT = {
  SOFT_BELLY: 0,
  LEAN: 1,
  MUSCULAR: 2,
  OBESE: 3,
  SLIM: 4,
};

/**
 * Each female body's own proportions, measured from the meshes with a
 * horizontal plane cut and a tape-measure (convex hull) girth:
 * natural waist = narrowest trunk girth at 60–68% of height,
 * hips = widest girth at 52–58% of height. Divided by height.
 * The renderer uses these to stretch a body only by how far the user's own
 * waist and hips differ from that body's built-in shape, instead of
 * comparing a woman to fixed male reference ratios.
 */
export const FEMALE_MESH_PROPORTIONS = {
  [MESH_SLOT.SOFT_BELLY]: { waistToHeight: 0.392, hipToHeight: 0.647 },
  [MESH_SLOT.LEAN]: { waistToHeight: 0.352, hipToHeight: 0.591 },
  [MESH_SLOT.MUSCULAR]: { waistToHeight: 0.365, hipToHeight: 0.621 },
  [MESH_SLOT.OBESE]: { waistToHeight: 0.475, hipToHeight: 0.767 },
  [MESH_SLOT.SLIM]: { waistToHeight: 0.258, hipToHeight: 0.472 },
};

export const MODEL_CREDITS = [
  {
    use: 'Female 3D bodies',
    title: 'Five female body type models',
    author: 'RawPheasant5745',
    url: 'https://sketchfab.com/3d-models/five-female-body-type-models-e0c649e0fea042dea9061651539ffa5c',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    changes: 'split into separate bodies, simplified and rescaled',
  },
  {
    use: 'Male 3D bodies',
    title: 'Stylized male Base mesh FREE',
    author: 'Gostbento',
    url: 'https://sketchfab.com/3d-models/stylized-male-base-mesh-free-5264bf0ed23045c5843a56d7ff1a923a',
    license: 'CC BY-NC 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
    changes: 'rescaled',
  },
];

export function bodyModelUrl(sex) {
  return sex === 'female' ? BODY_MODEL_URL.female : BODY_MODEL_URL.male;
}

/**
 * Warm the browser cache for this user's model only (instead of preloading
 * both files for everyone). Safe to call from any client component; it
 * does not pull in three.js.
 */
const warmed = new Set();
export function prefetchBodyModel(sex) {
  if (typeof window === 'undefined') return;
  const url = bodyModelUrl(sex);
  if (warmed.has(url)) return;
  warmed.add(url);
  fetch(url, { priority: 'low' }).catch(() => warmed.delete(url));
}
