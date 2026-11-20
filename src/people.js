import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const Y = new THREE.Vector3(0,1,0), Z = new THREE.Vector3(0,0,1);
const swing = new THREE.Quaternion();
function makePerson(template) {
  const root=new THREE.Group(), model=clone(template);
  model.scale.setScalar(.01); model.rotation.y=Math.PI; root.add(model);
  // Rocketbox ships in a T-pose. Rotate upper arms toward a relaxed pose in
  // world space, then save that pose as the base for the procedural gait.
  root.updateMatrixWorld(true);
  for (const side of ['L','R']) {
    const upper=model.getObjectByName(`Bip01_${side}_UpperArm`);
    const lower=model.getObjectByName(`Bip01_${side}_Forearm`);
    if (!upper || !lower) continue;
    const from=lower.getWorldPosition(new THREE.Vector3()).sub(upper.getWorldPosition(new THREE.Vector3())).normalize();
    const target=new THREE.Vector3(Math.sign(from.x)*.17,-1,0).normalize();
    const worldDelta=new THREE.Quaternion().setFromUnitVectors(from,target);
    const parentWorld=upper.parent.getWorldQuaternion(new THREE.Quaternion());
    const localDelta=parentWorld.clone().invert().multiply(worldDelta).multiply(parentWorld);
    upper.quaternion.premultiply(localDelta); root.updateMatrixWorld(true);
  }
  const bones={};
  for(const name of ['L_Thigh','R_Thigh','L_Calf','R_Calf','L_UpperArm','R_UpperArm','L_Forearm','R_Forearm']) {
    const bone=model.getObjectByName(`Bip01_${name}`);
    if(bone) bones[name]={bone,base:bone.quaternion.clone()};
  }
  return {root,model,bones,phase:Math.random()*6.28};
}
// Procedural, in-place gait. Base rotations are retained so the biped stays rigged.
export function animatePerson(person, moving, dt, speed=1) {
  person.phase += dt*(moving?8*speed:1.8);
  const stride=moving?Math.sin(person.phase):0;
  const apply=(name,axis,angle)=>{const b=person.bones[name]; if(b)b.bone.quaternion.copy(b.base).multiply(swing.setFromAxisAngle(axis,angle));};
  apply('L_Thigh',Z,stride*.45);apply('R_Thigh',Z,-stride*.45);
  apply('L_Calf',Z,Math.max(0,-stride)*.35);apply('R_Calf',Z,Math.max(0,stride)*.35);
  apply('L_UpperArm',Z,-stride*.18);apply('R_UpperArm',Z,stride*.18);
  apply('L_Forearm',Z,-stride*.12);apply('R_Forearm',Z,stride*.12);
}
export async function loadPeople(scene) {
  const assets=await Promise.all(['civ4','civ5','civ11','civ18'].map(name=>loader.loadAsync(`/models/people/${name}.glb`)));
  const player=makePerson(assets[0].scene); player.root.visible=false; scene.add(player.root);
  const pedestrians=[];
  for(let i=0;i<24;i++) {
    const person=makePerson(assets[(i+1)%assets.length].scene);
    const side=i%2?1:-1;person.root.position.set(side*(16.3+(i%3)*.6),.18,-480+i*42);
    person.dir=i%4<2?1:-1;person.speed=.8+(i%4)*.17;person.root.rotation.y=person.dir===1?Math.PI:0;
    scene.add(person.root);pedestrians.push(person);
  }
  return {player,pedestrians};
}
