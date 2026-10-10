// Soft product-photography environment: a neutral grey sweep with large
// diffused softboxes, so glossy parts get long, smooth highlights instead of
// small hard reflections.
import * as THREE from 'three';

export function studioEnvironment(renderer) {
  const env = new THREE.Scene();
  const sweep = new THREE.Mesh(
    new THREE.SphereGeometry(20, 64, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {},
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vP; void main(){
        float h = vP.y * 0.5 + 0.5;
        vec3 c = mix(vec3(0.16), vec3(0.62), smoothstep(0.0, 1.0, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
    }),
  );
  env.add(sweep);
  const box = (w, h, intensity, pos) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity, intensity), side: THREE.DoubleSide }),
    );
    m.position.copy(pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  box(9, 7, 6, new THREE.Vector3(-9, 8, 9)); // large key softbox
  box(2.2, 14, 4, new THREE.Vector3(12, 3, -6)); // rim strip
  box(14, 5, 2.2, new THREE.Vector3(0, 15, 0)); // overhead
  box(6, 8, 1.2, new THREE.Vector3(12, 1, 8)); // fill
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  return tex;
}
