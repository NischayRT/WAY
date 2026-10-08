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
    use: 'Male and female 3D bodies',
    title: 'Humans Base Mesh',
    author: 'Neslihan Çakmak',
    url: 'https://sketchfab.com/3d-models/humans-base-mesh-410626cce1454fb4bf01b7f507429a5c',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    changes: 'split into separate bodies, simplified and rescaled',
  },
  {
    use: 'Male and female 3D bodies',
    title: 'Body Types Basemesh',
    author: 'Peter Seifert',
    url: 'https://sketchfab.com/3d-models/body-types-basemesh-read-description-7eb782a9d9a64031a1784d9a19aadf13',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    changes: 'split into separate bodies, simplified and rescaled',
  },
];

export function bodyModelUrl(sex) {
  return sex === 'female' ? BODY_MODEL_URL.female : BODY_MODEL_URL.male;
}

/**
 * Warm the browser cache with the most common body for this sex. Bodies are
 * separate ~280 KB files now (lib/bodyLibrary.js), so this is cheap. Safe to
 * call from any client component; it does not pull in three.js.
 */
const warmed = new Set();
export function prefetchBodyModel(sex) {
  if (typeof window === 'undefined') return;
  const url = sex === 'female' ? '/models/bodies/f-average.glb' : '/models/bodies/m-average.glb';
  if (warmed.has(url)) return;
  warmed.add(url);
  fetch(url, { priority: 'low' }).catch(() => warmed.delete(url));
}
