import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

function glb(path) {
  const bytes = readFileSync(path);
  assert.equal(bytes.toString('ascii',0,4),'glTF',`${path} must be a GLB`);
  assert.equal(bytes.readUInt32LE(4),2,`${path} must use glTF 2`);
  assert.equal(bytes.readUInt32LE(8),bytes.length,`${path} must be complete`);
  return JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
}
test('imported environment kits retain the component names used by the city assembler',()=>{
  for(const file of ['modular_urban_apartments_facade','modular_factory_facade']) {
    const kit=glb(`public/models/city/${file}.glb`), names=new Set(kit.nodes.map(n=>n.name));
    for(const name of ['wall_window_centered_large_01','window_centered_large_01','wall_door_centered_small_01','door_centered_small_01','wall_standard_standard_01']) assert.ok(names.has(name),`${file}: ${name}`);
  }
  const palm=glb('public/models/city/palm.glb');assert.ok(palm.nodes.some(n=>n.name==='M_Palm_P2_31'));
  for(const file of ['street_lamp_02','fire_hydrant','metal_trash_can']) glb(`public/models/city/${file}.glb`);
});
test('characters retain skin and biped joints used by the procedural gait',()=>{
  for(const name of ['civ4','civ5','civ11','civ18']){
    const model=glb(`public/models/people/${name}.glb`); assert.ok(model.skins?.length);
    for(const bone of ['Bip01_L_Thigh','Bip01_R_Thigh','Bip01_L_UpperArm','Bip01_R_UpperArm']) assert.ok(model.nodes.some(n=>n.name===bone),`${name}: ${bone}`);
  }
});
test('surface assets and license are bundled',()=>{
  for(const name of ['asphalt.webp','asphalt-normal.webp','pavers.webp','sand.webp']) assert.ok(existsSync(`public/textures/${name}`));
  assert.match(readFileSync('public/models/people/LICENSE-Rocketbox.txt','utf8'),/Copyright \(c\) 2020 Microsoft/);
});
test('additional buildings and the traffic sedan are loadable, structured GLBs',()=>{
  const mid=glb('public/models/city/midcity.glb');
  assert.ok(mid.nodes.some(n=>n.name==='MidCity_Commercial_1'));
  assert.ok(glb('public/models/city/downtown.glb').meshes.length);
  assert.ok(glb('public/models/city/skyline.glb').nodes.some(n=>n.name==='Downtown_ModernOffice_3')); 
  const sedan=glb('public/models/traffic-sedan.glb');
  assert.ok(sedan.materials.some(m=>m.name==='blue'));
  for(const name of ['Front_tire','Rear_tire'])assert.ok(sedan.nodes.some(n=>n.name===name));
});
