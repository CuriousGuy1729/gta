import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Merge the sedan's many small parts into body/wheel batches, preserving
// independently rotating wheels without issuing dozens of draws per vehicle.
export async function loadTraffic(scene) {
  const model=(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/models/traffic-sedan.glb')).scene;
  model.updateMatrixWorld(true);
  const buckets=new Map();
  model.traverse(mesh=>{
    if(!mesh.isMesh || Array.isArray(mesh.material)) return;
    const wheel=/^(Front|Rear)_(tire|rim|spoke|hub)/i.test(mesh.name);
    const p=new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld);
    const key=wheel?`${p.x<0?'L':'R'}${p.z>0?'F':'B'}`:'body';
    const pivot=wheel?new THREE.Vector3(p.x<0?-.89:.89,.33,p.z>0?1.36:-1.36):new THREE.Vector3();
    const geo=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);geo.translate(-pivot.x,-pivot.y,-pivot.z);
    for(const a of Object.keys(geo.attributes))if(!['position','normal','uv'].includes(a))geo.deleteAttribute(a);
    if(!geo.getAttribute('uv'))geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(geo.getAttribute('position').count*2),2));
    const bucketKey=key+':'+mesh.material.uuid;
    if(!buckets.has(bucketKey))buckets.set(bucketKey,{key,pivot,material:mesh.material,geometries:[]});
    buckets.get(bucketKey).geometries.push(geo);
  });
  const parts=[];
  for(const bucket of buckets.values()){
    const geometry=mergeGeometries(bucket.geometries);
    bucket.geometries.forEach(g=>g.dispose());
    if(geometry)parts.push({...bucket,geometry});
  }
  if(!parts.length) throw new Error('No usable traffic geometry');
  const colors=[0xdad8ce,0x9d4d40,0x426e7c,0x273b3b,0xb7b1a3,0x706e83,0x3e5650,0x9b9b8c];
  const traffic=[];
  for(let i=0;i<8;i++){
    const group=new THREE.Group(),wheels=new Map(),paint=new Map();
    for(const part of parts){
      let material=part.material;
      if(material.name==='blue'){
        if(!paint.has(material.uuid)){const m=material.clone();m.color.set(colors[i]);m.metalness=.4;m.roughness=.35;paint.set(material.uuid,m)}
        material=paint.get(material.uuid);
      }
      let parent=group;
      if(part.key!=='body'){
        if(!wheels.has(part.key)){const wheel=new THREE.Group();wheel.position.copy(part.pivot);group.add(wheel);wheels.set(part.key,wheel)}
        parent=wheels.get(part.key);
      }
      parent.add(new THREE.Mesh(part.geometry,material));
    }
    // Model's front points +Z. Negative-X lanes travel away from spawn.
    const x=[-3,4,-9,9,-3,4,-9,9][i], direction=x<0?-1:1;
    group.position.set(x,0,-30-i*52);group.rotation.y=direction<0?Math.PI:0;scene.add(group);
    traffic.push({group,wheels:[...wheels.values()],x,direction,speed:8+(i%4)*2});
  }
  return traffic;
}
