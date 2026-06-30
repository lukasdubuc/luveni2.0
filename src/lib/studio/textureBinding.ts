// ─────────────────────────────────────────────────────────────
//  Luveni Studio — CLO 3D-style live texture binding
//  Binds the active 2D design (a <canvas> — the flattened Procreate
//  layers) directly onto a 3D garment mesh as its material map. Edits on
//  the 2D canvas push to the GPU each frame via needsUpdate, so the 3D
//  preview updates in real time. Adds normal mapping for fabric wrinkles.
// ─────────────────────────────────────────────────────────────

import * as THREE from "three";

export interface GarmentTextureBinding {
  texture: THREE.CanvasTexture;
  /** Call after drawing to the source canvas to push the update to the GPU. */
  update: () => void;
  dispose: () => void;
}

/**
 * Bind a source canvas as the colour map of every mesh material under
 * `root`. Returns a handle whose update() flags the texture dirty.
 */
export function bindCanvasToGarment(
  root: THREE.Object3D,
  source: HTMLCanvasElement,
  opts: { flipY?: boolean; anisotropy?: number } = {},
): GarmentTextureBinding {
  const texture = new THREE.CanvasTexture(source);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = opts.flipY ?? true;
  texture.anisotropy = opts.anisotropy ?? 8;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;

  const applied: THREE.Material[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial;
      if ("map" in mat) {
        mat.map = texture;
        mat.needsUpdate = true;
        applied.push(mat);
      }
    }
  });

  return {
    texture,
    update: () => { texture.needsUpdate = true; },
    dispose: () => {
      texture.dispose();
      for (const m of applied) (m as THREE.MeshStandardMaterial).map = null;
    },
  };
}

/**
 * Apply a tiling normal map for realistic fabric folds/wrinkles to all
 * standard materials under `root`. Returns a dispose fn.
 */
export function applyFabricNormalMap(
  root: THREE.Object3D,
  url: string,
  repeat = 4,
  strength = 0.6,
): () => void {
  const loader = new THREE.TextureLoader();
  const normal = loader.load(url);
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.repeat.set(repeat, repeat);
  const touched: THREE.MeshStandardMaterial[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial;
      if ("normalMap" in mat) {
        mat.normalMap = normal;
        mat.normalScale = new THREE.Vector2(strength, strength);
        mat.needsUpdate = true;
        touched.push(mat);
      }
    }
  });
  return () => {
    normal.dispose();
    for (const m of touched) { m.normalMap = null; m.needsUpdate = true; }
  };
}
