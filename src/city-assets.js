import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// The facade kits contain loose, laid-out components. Reassemble a small set of
// matching wall and window/door modules, then instance them down the boulevard.
const cityChunks = [];
export function updateImportedCity(z) { for(const item of cityChunks) item.mesh.visible = item.max >= z - 230 && item.min <= z + 100; }
export function addImportedCity(scene, onPalmReady = () => {}) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const urls = ['modular_urban_apartments_facade','modular_factory_facade','street_lamp_02','fire_hydrant','metal_trash_can','palm'];
  return Promise.all([...urls,'midcity','downtown','skyline'].map(name => loader.loadAsync(`/models/city/${name}.glb`))).then(results => {
    const kits = results.map(g => { g.scene.updateMatrixWorld(true); return g.scene; });
    // The palm is a multi-part scan. Merge its small pieces per material once
    // before instancing, otherwise every leaf becomes a separate draw call.
    const palmParts=new Map();
    (kits[5].getObjectByName('M_Palm_P2_31') || kits[5]).traverse(mesh=>{
      if(!mesh.isMesh || Array.isArray(mesh.material))return;
      let geometry=mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      for(const key of Object.keys(geometry.attributes)) if(!['position','normal','uv'].includes(key))geometry.deleteAttribute(key);
      const key=mesh.material.uuid+':'+Object.keys(geometry.attributes).sort().join(',');
      if(!palmParts.has(key))palmParts.set(key,{material:mesh.material,parts:[]});
      palmParts.get(key).parts.push(geometry);
    });
    const palm=new THREE.Group();
    for(const {material,parts} of palmParts.values()){
      const geometry=mergeGeometries(parts); if(geometry) palm.add(new THREE.Mesh(geometry,material));
      parts.forEach(part=>part.dispose());
    }
    palm.updateMatrixWorld(true);kits[5]=palm;
    const batches = new Map();
        function queue(nodes, origin, placement) {
      const offset = new THREE.Matrix4().makeTranslation(-origin.x, -origin.y, -origin.z);
      for (const node of nodes) if (node) node.traverse(mesh => {
        if (!mesh.isMesh) return;
        const key = mesh.uuid + ':' + Math.floor(placement.elements[14] / 99);
        let batch = batches.get(key);
        if (!batch) { batch = { mesh, matrices: [], min:Infinity, max:-Infinity }; batches.set(key, batch); }
        batch.matrices.push(new THREE.Matrix4().multiplyMatrices(placement, offset).multiply(mesh.matrixWorld));
        batch.min=Math.min(batch.min,placement.elements[14]); batch.max=Math.max(batch.max,placement.elements[14]);
      });
    }
    function wallModule(kit, wallName, accessoryName) {
      const wall = kit.getObjectByName(wallName), accessory = kit.getObjectByName(accessoryName);
      if (!wall) return null;
      const box = new THREE.Box3().setFromObject(wall);
      return { nodes: [wall, accessory], origin: new THREE.Vector3(box.min.x, box.min.y, box.max.z) };
    }
    const modules = kits.slice(0, 2).map(kit => ({
      window: wallModule(kit,'wall_window_centered_large_01','window_centered_large_01'),
      door: wallModule(kit,'wall_door_centered_small_01','door_centered_small_01'),
      blank: wallModule(kit,'wall_standard_standard_01',''),
    }));
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-Math.PI/2);
    const unit = new THREE.Vector3(1,1,1);
    const midcity = kits[6];
    const midBuildings = midcity.getObjectByName('RootNode')?.children.filter(n=>n.name.startsWith('MidCity_Commercial_')) || [];
    const downtown = kits[7];
    const skyline = kits[8].getObjectByName('RootNode')?.children.filter(n=>n.name.startsWith('Downtown_')) || [];
    const backing = new THREE.InstancedMesh(new THREE.BoxGeometry(16,1,24), new THREE.MeshStandardMaterial({ color:0x77766e, roughness:1 }), 35);
    let n=0;
    for(let z=-552; z<=570; z+=33) {
      const i=n++, floors=3+(n%2), kit=modules[n%2];
      // Alternate fully-authored, textured commercial blocks with modular facades.
      if (i%3===1 && midBuildings.length) {
        const node=midBuildings[(Math.floor(i/3))%midBuildings.length];
        const box=new THREE.Box3().setFromObject(node), size=box.getSize(new THREE.Vector3());
        if(size.x>0){
          const scale=THREE.MathUtils.clamp(24/size.x,.5,1.4);
          const anchor=new THREE.Vector3((box.min.x+box.max.x)/2,box.min.y,box.max.z);
          const transform=new THREE.Matrix4().compose(new THREE.Vector3(23,.18,z+12),rotation,new THREE.Vector3(scale,scale,scale));
          queue([node],anchor,transform);backing.setMatrixAt(i,new THREE.Matrix4().makeScale(0,0,0));continue;
        }
      }
      const backingMatrix = new THREE.Matrix4().compose(new THREE.Vector3(31.4, floors*1.5, z+12),new THREE.Quaternion(),new THREE.Vector3(1,floors*3,1));
      backing.setMatrixAt(i,backingMatrix);
      for(let floor=0;floor<floors;floor++) for(let bay=0;bay<8;bay++) {
        const module = floor===0 && bay===3 ? kit.door : (floor===0 && bay%3===0 ? kit.blank : kit.window);
        if (!module) continue;
        const transform = new THREE.Matrix4().compose(new THREE.Vector3(23,floor*3+.18,z+bay*3),rotation,unit);
        queue(module.nodes,module.origin,transform);
      }
    }
    backing.count=n; backing.instanceMatrix.needsUpdate=true; backing.computeBoundingSphere(); scene.add(backing);
    // Fully modelled downtown buildings replace the old procedural backdrop.
    // Each source building is centered and scaled independently, retaining its
    // authored roofline, windows and materials instead of stretching a box.
    const towerPool=[...skyline,downtown];
    if(towerPool.length){
      for(let row=0;row<2;row++)for(let z=-540,i=0;z<550;z+=42,i++){
        const node=towerPool[(i*3+row*5)%towerPool.length];
        const box=new THREE.Box3().setFromObject(node), size=box.getSize(new THREE.Vector3());
        if(size.x<=0 || size.z<=0 || size.y<=0)continue;
        const scale=27/Math.max(size.x,size.z);
        const origin=new THREE.Vector3((box.min.x+box.max.x)/2,box.min.y,(box.min.z+box.max.z)/2);
        const transform=new THREE.Matrix4().compose(new THREE.Vector3(58+row*36,0,z),rotation,new THREE.Vector3(scale,scale,scale));
        queue([node],origin,transform);
      }
    }
    // Object kits are grouped around an arbitrary authoring origin; normalize their footprint.
    function prop(kit, count, height, location) {
      const bounds=new THREE.Box3().setFromObject(kit), size=bounds.getSize(new THREE.Vector3()), center=bounds.getCenter(new THREE.Vector3());
      if (!size.y) return;
      const scale=height/size.y, origin=new THREE.Vector3(center.x,bounds.min.y,center.z);
      for(let i=0;i<count;i++) {
        const {x,z,angle=0}=location(i);
        const transform=new THREE.Matrix4().compose(new THREE.Vector3(x,.18,z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle),new THREE.Vector3(scale,scale,scale));
        queue([kit],origin,transform);
      }
    }
    prop(kits[2], 52, 6.2, i=>({x:i%2?20.8:-20.8,z:-550+Math.floor(i/2)*42,angle:i%2?-Math.PI/2:Math.PI/2}));
    prop(kits[3], 24, .95, i=>({x:20.1,z:-540+i*46}));
    prop(kits[4], 24, 1.0, i=>({x:21.2,z:-519+i*46}));
    prop(kits[5], 52, 10, i=>({x:i%2?19.6:-19.6,z:-550+Math.floor(i/2)*42,angle:i%3}));
    onPalmReady();
    for (const {mesh,matrices,min,max} of batches.values()) {
      const instances=new THREE.InstancedMesh(mesh.geometry,mesh.material,matrices.length);
      matrices.forEach((matrix,index)=>instances.setMatrixAt(index,matrix));
      instances.instanceMatrix.needsUpdate=true; instances.computeBoundingSphere(); scene.add(instances); cityChunks.push({mesh:instances,min,max});
    }
    updateImportedCity(0);
  });
}
