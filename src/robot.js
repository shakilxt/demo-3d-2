// Procedural recreation of the reference robot: elongated white ceramic skull,
// gloss-black face visor, pointed white jaw plates, side "ear" drive housings
// with swept blades, black carbon neck vertebrae, titanium pistons, ribbed
// cables, and heavy shoulder armour with restrained red LED accents.
//
// Conventions: robot space has +Y up and +Z forward. The head pivots at the
// top neck joint (head-local origin).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ellipsoidMap, ellipsoidPoint, shellMesh } from './shell.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function mesh(geo, mat, { pos, rot, scale, shadow = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.copy(pos);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  if (scale) m.scale.copy(scale);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

function blade(points, depth, mat, bevel = 0.018) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (const p of points.slice(1)) s.lineTo(p[0], p[1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
  });
  // shape x -> robot z, shape y -> robot y, extrusion -> robot -x
  g.rotateY(-PI / 2);
  g.translate(depth / 2, 0, 0);
  return mesh(g, mat);
}

/** Axis-aligned cylinder helper: axis 'x' | 'y' | 'z'. */
function cyl(rTop, rBot, h, mat, axis = 'y', pos = V(0, 0, 0), seg = 48) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg);
  if (axis === 'x') g.rotateZ(-PI / 2);
  if (axis === 'z') g.rotateX(PI / 2);
  return mesh(g, mat, { pos });
}

function torus(R, r, mat, axis = 'z', pos = V(0, 0, 0)) {
  const g = new THREE.TorusGeometry(R, r, 16, 96);
  if (axis === 'x') g.rotateY(PI / 2);
  if (axis === 'y') g.rotateX(PI / 2);
  return mesh(g, mat, { pos });
}

// ---------------------------------------------------------------------------

export function createRobot(M) {
  const shellMats = { outer: M.ceramic, inner: M.ceramicInner, rim: M.ceramicRim };
  const shellMatsAlt = { outer: M.ceramicAlt, inner: M.ceramicInner, rim: M.ceramicRim };

  const root = new THREE.Group();
  root.name = 'robot';

  // ---------------- torso ----------------
  const torso = new THREE.Group();
  root.add(torso);

  const chestC = V(0, -1.1, -0.05);
  const chestR = V(1.02, 1.22, 0.82);
  torso.add(
    shellMesh(
      {
        thetaMin: 0.2 * PI,
        thetaMax: 0.78 * PI,
        thickness: 0.05,
        map: ellipsoidMap(chestC, chestR),
        uvScale: [3, 1.5],
      },
      shellMats,
    ),
  );
  // layered pectoral plate over the chest shell
  torso.add(
    shellMesh(
      {
        thetaMin: (phi) => 0.23 * PI + 0.03 * PI * Math.cos(phi),
        thetaMax: (phi) => 0.47 * PI - 0.06 * PI * Math.cos(phi * 2),
        phiStart: -0.62 * PI,
        phiLength: 1.24 * PI,
        segPhi: 96,
        segTheta: 24,
        thickness: 0.05,
        map: ellipsoidMap(chestC, chestR.clone().multiplyScalar(1.045)),
        uvScale: [3, 1.5],
      },
      shellMatsAlt,
    ),
  );
  // dark under-structure visible through the collar opening
  torso.add(
    mesh(new THREE.SphereGeometry(1, 64, 48), M.carbon, {
      pos: chestC,
      scale: chestR.clone().multiplyScalar(0.93),
    }),
  );
  // collar
  torso.add(cyl(0.58, 0.62, 0.12, M.carbon, 'y', V(0, 0.0, -0.02), 96));
  torso.add(torus(0.57, 0.04, M.titanium, 'y', V(0, 0.065, -0.02)));
  torso.add(cyl(0.36, 0.42, 0.16, M.darkMetal, 'y', V(0, 0.12, -0.02), 64));
  // sternum plate with LED slit
  const sternum = mesh(new RoundedBoxGeometry(0.5, 0.36, 0.1, 4, 0.04), M.ceramicAlt, {
    pos: V(0, -0.3, 0.7),
    rot: [-0.5, 0, 0],
  });
  torso.add(sternum);
  torso.add(
    mesh(new THREE.BoxGeometry(0.22, 0.018, 0.02), M.ledDim, {
      pos: V(0, -0.28, 0.756),
      rot: [-0.5, 0, 0],
      shadow: false,
    }),
  );

  // shoulders (built for +X, mirrored for -X)
  const shoulder = (side) => {
    const g = new THREE.Group();
    g.scale.x = side;
    // pauldron
    g.add(
      shellMesh(
        {
          thetaMax: (phi) => 0.56 * PI + 0.05 * PI * Math.cos(phi * 2),
          thickness: 0.07,
          map: ellipsoidMap(V(1.06, -0.36, -0.05), V(0.62, 0.5, 0.78), { rotZ: -0.34 }),
          uvScale: [2, 1],
        },
        shellMatsAlt,
      ),
    );
    // shoulder joint drum
    g.add(cyl(0.42, 0.42, 0.26, M.darkMetal, 'x', V(1.24, -0.86, -0.02), 96));
    g.add(cyl(0.32, 0.32, 0.28, M.carbon, 'x', V(1.26, -0.86, -0.02), 96));
    g.add(torus(0.4, 0.03, M.titanium, 'x', V(1.38, -0.86, -0.02)));
    g.add(cyl(0.13, 0.13, 0.32, M.titanium, 'x', V(1.27, -0.86, -0.02)));
    // upper-arm plate with the red triangle status button
    const arm = new THREE.Group();
    arm.position.set(1.32, -1.62, 0.02);
    arm.rotation.z = -0.06;
    arm.add(mesh(new RoundedBoxGeometry(0.42, 1.0, 0.78, 5, 0.12), M.ceramic));
    arm.add(cyl(0.18, 0.18, 0.04, M.titanium, 'x', V(0.215, -0.2, 0.12)));
    arm.add(cyl(0.135, 0.135, 0.05, M.carbon, 'x', V(0.22, -0.2, 0.12)));
    arm.add(cyl(0.05, 0.05, 0.06, M.darkMetal, 'x', V(0.225, -0.2, 0.12), 24));
    for (const dz of [-0.085, 0.085]) {
      const tri = new THREE.Mesh(new THREE.CircleGeometry(0.035, 3), M.led);
      tri.position.set(0.252, -0.2, 0.12 + dz);
      tri.rotation.set(0, PI / 2, dz > 0 ? 0 : PI);
      arm.add(tri);
    }
    for (let k = 0; k < 4; k++) {
      arm.add(
        mesh(new THREE.BoxGeometry(0.01, 0.012, 0.12), M.darkMetal, {
          pos: V(0.212, 0.25 - k * 0.04, -0.2),
        }),
      );
    }
    g.add(arm);
    // swept shoulder fins
    const fin1 = blade(
      [
        [0.5, 0.0],
        [0.15, 0.14],
        [-0.95, 0.52],
        [-0.84, 0.41],
        [-0.05, -0.06],
      ],
      0.05,
      M.ceramicAlt,
    );
    fin1.position.set(0.78, 0.12, -0.15);
    fin1.rotation.z = -0.22;
    g.add(fin1);
    const fin2 = blade(
      [
        [0.3, 0.0],
        [0.0, 0.1],
        [-0.62, 0.3],
        [-0.56, 0.22],
        [-0.1, -0.05],
      ],
      0.04,
      M.ceramic,
    );
    fin2.position.set(0.98, 0.0, -0.2);
    fin2.rotation.z = -0.3;
    g.add(fin2);
    g.add(
      mesh(new THREE.BoxGeometry(0.05, 0.02, 0.3), M.led, {
        pos: V(0.86, 0.16, 0.2),
        rot: [0, 0, -0.25],
        shadow: false,
      }),
    );
    return g;
  };
  torso.add(shoulder(1), shoulder(-1));

  // ---------------- neck chain ----------------
  const neckBase = new THREE.Group();
  neckBase.position.set(0, 0.18, -0.02);
  neckBase.rotation.x = 0.2; // neutral forward lean
  root.add(neckBase);

  const segs = [];
  let parent = neckBase;
  const SEG_H = 0.34;
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Group();
    if (i > 0) s.position.y = SEG_H;
    parent.add(s);
    const rTop = 0.21 - i * 0.012;
    s.add(cyl(rTop, rTop + 0.03, 0.24, M.carbon, 'y', V(0, 0.15, 0), 64));
    s.add(cyl(0.29 - i * 0.015, 0.29 - i * 0.015, 0.045, M.titanium, 'y', V(0, 0.02, 0), 64));
    s.add(torus(0.27 - i * 0.015, 0.018, M.darkMetal, 'y', V(0, 0.045, 0)));
    s.add(
      mesh(new RoundedBoxGeometry(0.24, 0.2, 0.14, 3, 0.03), M.darkMetal, {
        pos: V(0, 0.15, -0.22),
      }),
    );
    for (const sx of [-1, 1]) {
      s.add(
        mesh(new RoundedBoxGeometry(0.08, 0.16, 0.12, 2, 0.02), M.titanium, {
          pos: V(sx * 0.22, 0.15, 0.02),
        }),
      );
      s.add(
        mesh(new THREE.BoxGeometry(0.012, 0.03, 0.03), M.ledDim, {
          pos: V(sx * 0.262, 0.17, 0.05),
          shadow: false,
        }),
      );
    }
    segs.push(s);
    parent = s;
  }
  // the silver throat lens (as in the reference, below the face)
  const lens = new THREE.Group();
  lens.position.set(0, 0.16, 0.2);
  lens.add(cyl(0.1, 0.11, 0.12, M.titanium, 'z', V(0, 0, 0.0)));
  lens.add(torus(0.085, 0.014, M.chrome, 'z', V(0, 0, 0.06)));
  lens.add(mesh(new THREE.SphereGeometry(0.07, 32, 16), M.chrome, { pos: V(0, 0, 0.04) }));
  lens.add(mesh(new THREE.SphereGeometry(0.04, 32, 16), M.visor, { pos: V(0, 0, 0.09) }));
  segs[1].add(lens);

  const headPivot = new THREE.Group();
  headPivot.position.y = SEG_H;
  segs[2].add(headPivot);

  // ---------------- head ----------------
  const head = new THREE.Group();
  head.scale.setScalar(1.1);
  headPivot.add(head);

  head.add(mesh(new THREE.SphereGeometry(0.27, 48, 32), M.darkMetal)); // top joint

  const HC = V(0, 0.62, 0.1); // skull centre
  const HR = V(0.76, 0.92, 1.4);
  const IC = V(0, 0.52, 0.2); // face core centre
  const IR = V(0.66, 0.8, 1.28);

  // skull: open towards the front-lower face
  head.add(
    shellMesh(
      {
        thetaMax: (phi) =>
          0.635 * PI - 0.215 * PI * Math.cos(phi) + 0.025 * PI * Math.cos(phi * 3),
        thickness: 0.045,
        map: ellipsoidMap(HC, HR),
        uvScale: [2, 1],
        segPhi: 192,
        segTheta: 72,
      },
      shellMats,
    ),
  );
  // face core
  head.add(mesh(new THREE.SphereGeometry(1, 96, 64), M.carbon, { pos: IC, scale: IR }));
  // gloss visor band
  const VR = IR.clone().multiplyScalar(1.018);
  head.add(
    shellMesh(
      {
        thetaMin: 0.39 * PI,
        thetaMax: 0.645 * PI,
        phiStart: -0.43 * PI,
        phiLength: 0.86 * PI,
        segPhi: 96,
        segTheta: 32,
        thickness: 0.025,
        map: ellipsoidMap(IC, VR),
      },
      { outer: M.visor, inner: M.ceramicInner, rim: M.titanium },
    ),
  );
  // pointed jaw plates
  const chin = (p) => {
    const k = smooth(-0.5, -1.0, p.y) * smooth(0.1, 0.9, p.z);
    p.z += 0.42 * k;
    p.y -= 0.18 * k;
    p.x *= 1 - 0.6 * k;
  };
  head.add(
    shellMesh(
      {
        thetaMin: (phi) => 0.64 * PI + 0.03 * PI * (1 - Math.cos(phi)),
        thetaMax: 0.93 * PI,
        phiStart: -0.47 * PI,
        phiLength: 0.94 * PI,
        segPhi: 96,
        segTheta: 40,
        thickness: 0.05,
        map: ellipsoidMap(IC, IR.clone().multiplyScalar(1.05), { deform: chin }),
        uvScale: [2, 1],
      },
      shellMatsAlt,
    ),
  );
  // jaw centre seam + LED ticks on visor flanks
  for (const sx of [-1, 1]) {
    const a = ellipsoidPoint(IC, VR, 0.5 * PI, sx * 0.34 * PI, -0.004);
    const tick = mesh(new THREE.BoxGeometry(0.012, 0.12, 0.012), M.led, {
      pos: a.position,
      shadow: false,
    });
    tick.lookAt(a.position.clone().add(a.normal));
    head.add(tick);
    for (let k = 0; k < 3; k++) {
      const b = ellipsoidPoint(IC, VR, (0.585 + k * 0.016) * PI, sx * 0.24 * PI, -0.004);
      const dot = mesh(new THREE.BoxGeometry(0.03 - k * 0.006, 0.008, 0.01), M.ledDim, {
        pos: b.position,
        shadow: false,
      });
      dot.lookAt(b.position.clone().add(b.normal));
      head.add(dot);
    }
  }

  // eyes
  const eyes = [];
  for (const sx of [-1, 1]) {
    const pt = ellipsoidPoint(IC, VR, 0.505 * PI, sx * 0.145 * PI, 0.02);
    const socket = new THREE.Group();
    socket.position.copy(pt.position);
    socket.scale.setScalar(0.8);
    const facing = pt.normal.clone().lerp(V(0, 0, 1), 0.55).normalize();
    socket.quaternion.setFromUnitVectors(V(0, 0, 1), facing);
    head.add(socket);

    socket.add(cyl(0.118, 0.118, 0.14, M.darkMetal, 'z', V(0, 0, -0.05)));
    socket.add(torus(0.114, 0.016, M.titanium, 'z', V(0, 0, 0.018)));
    socket.add(torus(0.132, 0.006, M.darkMetal, 'z', V(0, 0, 0.012)));

    const ball = new THREE.Group();
    socket.add(ball);
    const eg = new THREE.SphereGeometry(0.085, 64, 32);
    eg.rotateX(PI / 2);
    const uv = eg.attributes.uv;
    const pos = eg.attributes.position;
    for (let k = 0; k < uv.count; k++) {
      uv.setXY(k, 0.5 + pos.getX(k) / 0.15, 0.5 + pos.getY(k) / 0.15);
    }
    ball.add(mesh(eg, M.iris, { shadow: false }));
    const cornea = new THREE.SphereGeometry(0.089, 48, 16, 0, 2 * PI, 0, 0.42 * PI);
    cornea.rotateX(PI / 2);
    ball.add(mesh(cornea, M.lens, { shadow: false }));

    const upper = mesh(
      new THREE.SphereGeometry(0.1, 64, 16, 0, 2 * PI, 0, PI / 2),
      M.titanium,
    );
    const lower = mesh(
      new THREE.SphereGeometry(0.1, 64, 16, 0, 2 * PI, PI / 2, PI / 2),
      M.titanium,
    );
    // lid edge trims
    const edgeU = torus(0.1, 0.006, M.darkMetal, 'y');
    const edgeL = torus(0.1, 0.006, M.darkMetal, 'y');
    upper.add(edgeU);
    lower.add(edgeL);
    socket.add(upper, lower);
    eyes.push({ socket, ball, upper, lower });
  }

  // side kits: ear drive housing + swept blade (+X, mirrored for -X)
  const kits = [];
  for (const side of [1, -1]) {
    const k = new THREE.Group();
    k.scale.x = side;
    k.position.x = -0.06 * side;
    head.add(k);
    const EC = V(0.83, 0.5, -0.05);
    k.add(torus(0.42, 0.055, M.carbon, 'x', V(0.8, 0.5, -0.05)));
    const prof = [
      [0, 0.17],
      [0.12, 0.17],
      [0.14, 0.15],
      [0.29, 0.15],
      [0.34, 0.12],
      [0.37, 0.06],
      [0.38, 0],
      [0.37, -0.06],
    ].map(([r, h]) => new THREE.Vector2(r, h));
    const housing = new THREE.LatheGeometry(prof, 128);
    housing.rotateZ(-PI / 2);
    k.add(mesh(housing, M.ceramicAlt, { pos: EC }));
    k.add(torus(0.25, 0.008, M.darkMetal, 'x', V(0.995, 0.5, -0.05)));
    k.add(cyl(0.12, 0.13, 0.08, M.titanium, 'x', V(1.0, 0.5, -0.05)));
    k.add(cyl(0.06, 0.06, 0.1, M.darkMetal, 'x', V(1.01, 0.5, -0.05), 24));
    for (let b = 0; b < 6; b++) {
      const a = (b / 6) * PI * 2;
      k.add(
        cyl(0.016, 0.016, 0.03, M.darkMetal, 'x', V(0.99, 0.5 + Math.sin(a) * 0.2, -0.05 + Math.cos(a) * 0.2), 12),
      );
    }
    k.add(
      mesh(new THREE.BoxGeometry(0.02, 0.05, 0.02), M.led, {
        pos: V(0.96, 0.24, 0.12),
        shadow: false,
      }),
    );
    // cable sockets
    const sock = (p, dir) => {
      const c = cyl(0.055, 0.06, 0.16, M.titanium, 'y');
      c.position.copy(p);
      c.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
      k.add(c);
    };
    sock(V(0.95, 0.28, -0.28), V(0.25, -0.55, -0.8));
    sock(V(0.95, 0.22, 0.12), V(0.25, -1, 0.15));
    // the long swept blade
    const bl = blade(
      [
        [0.32, 0.82],
        [0.06, 0.95],
        [-1.5, 1.24],
        [-1.36, 1.1],
        [-0.45, 0.74],
        [0.12, 0.58],
      ],
      0.07,
      M.ceramic,
    );
    bl.position.x = 0.95;
    bl.rotation.y = -0.06;
    k.add(bl);
    const bl2 = blade(
      [
        [-0.2, 0.86],
        [-1.05, 1.06],
        [-1.0, 0.98],
        [-0.3, 0.78],
      ],
      0.03,
      M.darkMetal,
      0.01,
    );
    bl2.position.x = 1.0;
    bl2.rotation.y = -0.06;
    k.add(bl2);
    kits.push(k);
  }

  // dorsal spike
  const spike = blade(
    [
      [-0.05, 1.45],
      [-0.35, 1.62],
      [-1.05, 1.85],
      [-0.9, 1.58],
      [-0.7, 1.28],
    ],
    0.035,
    M.ceramicAlt,
    0.01,
  );
  head.add(spike);

  // ---------------- pistons (live-oriented between torso and head) ----------------
  const pistons = [];
  const pistonDefs = [
    [V(0.32, 0.08, 0.36), V(0.25, -0.02, 0.32)],
    [V(0.26, 0.08, -0.42), V(0.2, 0.05, -0.3)],
  ];
  for (const sx of [-1, 1]) {
    for (const [a, b] of pistonDefs) {
      const sleeveG = new THREE.CylinderGeometry(0.045, 0.05, 0.55, 32);
      sleeveG.translate(0, 0.275, 0);
      const rodG = new THREE.CylinderGeometry(0.022, 0.022, 0.62, 24);
      rodG.translate(0, 0.31, 0);
      const sleeve = mesh(sleeveG, M.carbon);
      const rod = mesh(rodG, M.chrome);
      sleeve.add(cyl(0.056, 0.056, 0.05, M.titanium, 'y', V(0, 0.53, 0), 32));
      root.add(sleeve, rod);
      pistons.push({
        sleeve,
        rod,
        a: V(a.x * sx, a.y, a.z),
        b: V(b.x * sx, b.y, b.z),
      });
    }
  }

  // ---------------- cables ----------------
  const cableDefs = [];
  const addCable = (fromObj, fromP, fromD, toP, toD, radius, slack, mat) => {
    for (const sx of [1, -1]) {
      const kitSide = fromObj === 'kit';
      cableDefs.push({
        from: kitSide ? kits[sx === 1 ? 0 : 1] : head,
        fromP: kitSide ? fromP.clone() : V(fromP.x * sx, fromP.y, fromP.z),
        fromD: kitSide ? fromD.clone().normalize() : V(fromD.x * sx, fromD.y, fromD.z).normalize(),
        toP: V(toP.x * sx, toP.y, toP.z),
        toD: V(toD.x * sx, toD.y, toD.z).normalize(),
        radius,
        slack,
        mat,
        mesh: null,
      });
    }
  };
  addCable('kit', V(1.0, 0.21, -0.37), V(0.25, -0.55, -0.8), V(0.45, 0.06, -0.36), V(0, 1, 0.1), 0.04, 0.22, M.rubber);
  addCable('kit', V(0.97, 0.14, 0.14), V(0.25, -1, 0.15), V(0.52, 0.0, 0.3), V(0, 1, 0.1), 0.032, 0.2, M.rubber);
  addCable('head', V(0.24, -0.05, -0.42), V(0.1, -0.6, -0.7), V(0.5, -0.02, -0.5), V(0, 1, -0.25), 0.05, 0.12, M.rubber);
  addCable('head', V(0.4, 0.2, 0.68), V(0.1, -1, 0.0), V(0.42, 0.05, 0.47), V(0, 1, 0.05), 0.026, 0.1, M.rubber);
  addCable('kit', V(0.99, 0.98, -1.15), V(0.05, -0.35, -0.9), V(0.82, 0.12, -0.62), V(0.1, 1, 0.3), 0.016, 0.55, M.cableWhite);
  for (const c of cableDefs) {
    // titanium ferrules at both ends
    const f1 = cyl(c.radius * 1.5, c.radius * 1.5, 0.08, M.titanium, 'y', V(0, 0, 0), 24);
    f1.position.copy(c.fromP).addScaledVector(c.fromD, 0.02);
    f1.quaternion.setFromUnitVectors(V(0, 1, 0), c.fromD);
    c.from.add(f1);
    const f2 = cyl(c.radius * 1.5, c.radius * 1.5, 0.08, M.titanium, 'y', V(0, 0, 0), 24);
    f2.position.copy(c.toP).addScaledVector(c.toD, 0.02);
    f2.quaternion.setFromUnitVectors(V(0, 1, 0), c.toD);
    torso.add(f2);
  }

  // ---------------------------------------------------------------------------
  const tmpQ = new THREE.Quaternion();
  const tmpV = new THREE.Vector3();
  const yAxis = V(0, 1, 0);

  /** Sets every rotational DOF from a pose object (radians). */
  function applyPose(p) {
    root.position.y = p.breathe;
    const yawW = [0.16, 0.2, 0.24];
    const pitchW = [0.18, 0.2, 0.22];
    const rollW = [0.12, 0.14, 0.2];
    segs.forEach((s, i) => {
      s.rotation.set(
        p.pitch * pitchW[i] + (p.neckPitchLag || 0) * (i === 0 ? 1 : 0),
        p.yaw * yawW[i] + (p.neckYawLead || 0) * (2 - i) * 0.5,
        p.roll * rollW[i],
        'YXZ',
      );
    });
    const yawUsed = segs.reduce((a, s) => a + s.rotation.y, 0);
    const pitchUsed = segs.reduce((a, s) => a + s.rotation.x, 0);
    const rollUsed = segs.reduce((a, s) => a + s.rotation.z, 0);
    headPivot.rotation.set(p.pitch - pitchUsed, p.yaw - yawUsed, p.roll - rollUsed, 'YXZ');
    for (const e of eyes) {
      e.upper.rotation.x = THREE.MathUtils.lerp(-1.0, 0.1, p.lid);
      e.lower.rotation.x = THREE.MathUtils.lerp(0.75, -0.06, p.lid);
    }
  }

  /** Aims the eyeballs at a world-space target, with a gaze offset (radians). */
  function aimEyes(targetWorld, offX, offY) {
    for (const e of eyes) {
      e.socket.updateWorldMatrix(true, false);
      const local = e.socket.worldToLocal(targetWorld.clone());
      let yaw = Math.atan2(local.x, local.z) + offX;
      let pitch = -Math.atan2(local.y, Math.hypot(local.x, local.z)) + offY;
      yaw = THREE.MathUtils.clamp(yaw, -0.42, 0.42);
      pitch = THREE.MathUtils.clamp(pitch, -0.3, 0.3);
      e.ball.rotation.set(pitch, yaw, 0, 'YXZ');
    }
  }

  function headForwardWorld() {
    head.updateWorldMatrix(true, false);
    return V(0, 0, 1).transformDirection(head.matrixWorld);
  }
  function eyeCentreWorld() {
    head.updateWorldMatrix(true, false);
    return head.localToWorld(ellipsoidPoint(IC, VR, 0.505 * PI, 0, 0).position);
  }

  function anchorsSnapshot() {
    root.updateWorldMatrix(true, true);
    return cableDefs.map((c) => {
      const p = root.worldToLocal(c.from.localToWorld(c.fromP.clone()));
      const d = root
        .worldToLocal(c.from.localToWorld(c.fromP.clone().add(c.fromD)))
        .sub(p)
        .normalize();
      return { p, d };
    });
  }

  /**
   * Rebuilds cable tubes. `now` is the current anchor snapshot; `lag1`/`lag2`
   * are snapshots of the same anchors at slightly earlier times, which gives
   * the cables physically plausible trailing / secondary motion.
   */
  function updateCables(now, lag1, lag2) {
    cableDefs.forEach((c, i) => {
      const a = now[i].p;
      const da = now[i].d;
      const b = c.toP;
      const db = c.toD;
      const dist = a.distanceTo(b);
      const L = Math.min(0.35, dist * 0.28);
      const p1 = lag1[i].p.clone().addScaledVector(lag1[i].d, L).lerp(a.clone().addScaledVector(da, L), 0.55);
      const p3 = b.clone().addScaledVector(db, L);
      const lagStart = lag2[i].p.clone().addScaledVector(lag2[i].d, L);
      const mid = lagStart.lerp(p3, 0.5);
      mid.y -= c.slack;
      const curve = new THREE.CatmullRomCurve3([a, p1, mid, p3, b], false, 'centripetal');
      const segsN = Math.max(48, Math.round(dist * 60));
      const g = new THREE.TubeGeometry(curve, segsN, c.radius, 12, false);
      g.attributes.uv.array.forEach((v, k, arr) => {
        if (k % 2 === 0) arr[k] = v * dist * 1.6; // keep rib spacing constant
      });
      if (!c.mesh) {
        c.mesh = mesh(g, c.mat);
        root.add(c.mesh);
      } else {
        c.mesh.geometry.dispose();
        c.mesh.geometry = g;
      }
    });
  }

  function updatePistons() {
    root.updateWorldMatrix(true, true);
    for (const p of pistons) {
      const A = root.worldToLocal(torso.localToWorld(p.a.clone()));
      const B = root.worldToLocal(head.localToWorld(p.b.clone()));
      const dir = tmpV.copy(B).sub(A).normalize();
      tmpQ.setFromUnitVectors(yAxis, dir);
      p.sleeve.position.copy(A);
      p.sleeve.quaternion.copy(tmpQ);
      p.rod.position.copy(B);
      p.rod.quaternion.setFromUnitVectors(yAxis, dir.clone().negate());
    }
  }

  return {
    root,
    head,
    applyPose,
    aimEyes,
    headForwardWorld,
    eyeCentreWorld,
    anchorsSnapshot,
    updateCables,
    updatePistons,
  };
}
