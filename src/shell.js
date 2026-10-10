// Thick ellipsoidal armour shells with arbitrary (per-azimuth) cut edges.
// Sphere parameterisation: theta from +Y pole, phi = 0 points to +Z (forward),
// phi = +PI/2 points to +X.
import * as THREE from 'three';

const val = (f, phi) => (typeof f === 'function' ? f(phi) : f);

/**
 * @param {object} o
 * @param {number|function} o.thetaMin  start of the band (0 = closed at the pole)
 * @param {number|function} o.thetaMax  cut edge
 * @param {function} o.map  (unitPoint: Vector3, isInner: boolean) => Vector3 (in place)
 * @returns {{outer, inner, rim}} BufferGeometries
 */
export function shellGeometry({
  thetaMin = 0,
  thetaMax = Math.PI,
  phiStart = -Math.PI,
  phiLength = Math.PI * 2,
  segPhi = 160,
  segTheta = 56,
  thickness = 0.05,
  map = (p) => p,
  uvScale = [2, 1],
}) {
  const full = Math.abs(phiLength - Math.PI * 2) < 1e-6;
  const cols = segPhi + 1;
  const outerPos = [];
  const innerPos = [];
  const uvs = [];
  const p = new THREE.Vector3();
  for (let i = 0; i <= segTheta; i++) {
    for (let j = 0; j <= segPhi; j++) {
      const phi = phiStart + (j / segPhi) * phiLength;
      const t0 = val(thetaMin, phi);
      const t1 = val(thetaMax, phi);
      const th = t0 + (t1 - t0) * (i / segTheta);
      const s = Math.sin(th);
      p.set(s * Math.sin(phi), Math.cos(th), s * Math.cos(phi));
      const o = map(p.clone(), false);
      const n = map(p.clone().multiplyScalar(1 - thickness), true);
      outerPos.push(o.x, o.y, o.z);
      innerPos.push(n.x, n.y, n.z);
      uvs.push(((phi - phiStart) / (Math.PI * 2)) * uvScale[0], (th / Math.PI) * uvScale[1]);
    }
  }

  const idxOuter = [];
  const idxInner = [];
  for (let i = 0; i < segTheta; i++) {
    for (let j = 0; j < segPhi; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      idxOuter.push(a, c, b, b, c, d);
      idxInner.push(a, b, c, b, d, c);
    }
  }

  const build = (pos, idx) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    if (full) {
      // weld normals across the phi seam
      const nrm = g.attributes.normal;
      for (let i = 0; i <= segTheta; i++) {
        const a = i * cols;
        const b = a + segPhi;
        const x = nrm.getX(a) + nrm.getX(b);
        const y = nrm.getY(a) + nrm.getY(b);
        const z = nrm.getZ(a) + nrm.getZ(b);
        const l = Math.hypot(x, y, z) || 1;
        nrm.setXYZ(a, x / l, y / l, z / l);
        nrm.setXYZ(b, x / l, y / l, z / l);
      }
    }
    return g;
  };

  // Rim strips: along the cut edge(s), and along the phi edges for partial shells.
  const rimPos = [];
  const rimUv = [];
  const rimIdx = [];
  const strip = (indices) => {
    const base = rimPos.length / 3;
    indices.forEach((k, n) => {
      rimPos.push(outerPos[k * 3], outerPos[k * 3 + 1], outerPos[k * 3 + 2]);
      rimPos.push(innerPos[k * 3], innerPos[k * 3 + 1], innerPos[k * 3 + 2]);
      rimUv.push(n / indices.length, 0, n / indices.length, 0.01);
    });
    for (let n = 0; n < indices.length - 1; n++) {
      const a = base + n * 2;
      rimIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  };
  const row = (i) => Array.from({ length: cols }, (_, j) => i * cols + j);
  const col = (j) => Array.from({ length: segTheta + 1 }, (_, i) => i * cols + j);
  strip(row(segTheta));
  const hasMin = typeof thetaMin === 'function' || thetaMin > 0;
  if (hasMin) strip(row(0));
  if (!full) {
    strip(col(0));
    strip(col(segPhi));
  }
  const rim = new THREE.BufferGeometry();
  rim.setAttribute('position', new THREE.Float32BufferAttribute(rimPos, 3));
  rim.setAttribute('uv', new THREE.Float32BufferAttribute(rimUv, 2));
  rim.setIndex(rimIdx);
  rim.computeVertexNormals();

  return { outer: build(outerPos, idxOuter), inner: build(innerPos, idxInner), rim };
}

/** Ellipsoid mapping helper: unit point -> scaled, optionally rotated, translated. */
export function ellipsoidMap(center, radii, { rotX = 0, rotZ = 0, deform } = {}) {
  const e = new THREE.Euler(rotX, 0, rotZ);
  return (p) => {
    if (deform) deform(p);
    p.multiply(radii).applyEuler(e).add(center);
    return p;
  };
}

/** Builds a Group of three meshes (outer armour, dark inner face, rim). */
export function shellMesh(opts, mats) {
  const g = shellGeometry(opts);
  const group = new THREE.Group();
  const outer = new THREE.Mesh(g.outer, mats.outer);
  const inner = new THREE.Mesh(g.inner, mats.inner);
  const rim = new THREE.Mesh(g.rim, mats.rim);
  for (const m of [outer, inner, rim]) {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  return group;
}

/** Point on an axis-aligned ellipsoid surface in direction (theta, phi). */
export function ellipsoidPoint(center, radii, theta, phi, inset = 0) {
  const s = Math.sin(theta);
  const d = new THREE.Vector3(s * Math.sin(phi), Math.cos(theta), s * Math.cos(phi));
  const p = d.clone().multiply(radii);
  const normal = d.clone().divide(radii).normalize();
  p.add(center).addScaledVector(normal, -inset);
  return { position: p, normal };
}
