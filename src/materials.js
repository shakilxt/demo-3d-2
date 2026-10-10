import * as THREE from 'three';
import {
  armourTextures,
  brushedTexture,
  carbonTextures,
  irisTexture,
  ribTexture,
} from './textures.js';

export function createMaterials() {
  const armourA = armourTextures(11);
  const armourB = armourTextures(29, { density: 0.7 });
  const carbon = carbonTextures([10, 10]);
  const brushed = brushedTexture();
  const ribs = ribTexture();
  const iris = irisTexture();

  const ceramic = (t) =>
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: t.map,
      bumpMap: t.bump,
      bumpScale: 0.9,
      roughnessMap: t.rough,
      roughness: 0.62,
      metalness: 0,
      clearcoat: 0.35,
      clearcoatRoughness: 0.32,
      specularIntensity: 0.6,
    });

  const m = {
    ceramic: ceramic(armourA),
    ceramicAlt: ceramic(armourB),
    ceramicInner: new THREE.MeshStandardMaterial({ color: 0x1a1b1d, roughness: 0.7 }),
    carbon: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: carbon.map,
      bumpMap: carbon.bump,
      bumpScale: 0.35,
      roughness: 0.38,
      metalness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
    }),
    visor: new THREE.MeshPhysicalMaterial({
      color: 0x060607,
      roughness: 0.13,
      metalness: 0.15,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      reflectivity: 0.6,
    }),
    titanium: new THREE.MeshPhysicalMaterial({
      color: 0xbfc2c8,
      metalness: 1,
      roughness: 0.34,
      roughnessMap: brushed,
      anisotropy: 0.6,
      anisotropyRotation: 0,
      clearcoat: 0.1,
    }),
    darkMetal: new THREE.MeshPhysicalMaterial({
      color: 0x3b3d42,
      metalness: 1,
      roughness: 0.42,
      roughnessMap: brushed,
    }),
    rubber: new THREE.MeshPhysicalMaterial({
      color: 0x111214,
      roughness: 0.48,
      bumpMap: ribs,
      bumpScale: 1.4,
      clearcoat: 0.4,
      clearcoatRoughness: 0.35,
    }),
    cableWhite: new THREE.MeshPhysicalMaterial({
      color: 0xe9e8e4,
      roughness: 0.42,
      clearcoat: 0.5,
      clearcoatRoughness: 0.25,
    }),
    led: new THREE.MeshStandardMaterial({
      color: 0x2a0303,
      emissive: 0xff2214,
      emissiveIntensity: 8,
      roughness: 0.3,
    }),
    ledDim: new THREE.MeshStandardMaterial({
      color: 0x200303,
      emissive: 0xd8160e,
      emissiveIntensity: 4.5,
      roughness: 0.3,
    }),
    iris: new THREE.MeshStandardMaterial({
      map: iris.map,
      emissiveMap: iris.emissive,
      emissive: 0xffffff,
      emissiveIntensity: 1.6,
      roughness: 0.25,
      metalness: 0.3,
    }),
    lens: new THREE.MeshPhysicalMaterial({
      color: 0x0d0d10,
      roughness: 0.02,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
    chrome: new THREE.MeshPhysicalMaterial({ color: 0xdfe2e6, metalness: 1, roughness: 0.12 }),
  };
  m.ceramicRim = m.ceramic.clone();
  m.ceramicRim.side = THREE.DoubleSide;
  m.ceramicInner.side = THREE.DoubleSide;
  return m;
}
