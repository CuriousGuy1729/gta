import test from 'node:test';
import assert from 'node:assert/strict';
import {footDirection} from '../src/movement.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('on-foot movement is camera-relative and diagonal speed is normalized',()=>{
 let v=footDirection(0,1,0);near(v.x,0);near(v.z,-1);
 v=footDirection(0,0,-1);near(v.x,-1);near(v.z,0);
 v=footDirection(Math.PI/2,1,0);near(v.x,-1);near(v.z,0);
 v=footDirection(0,1,1);near(Math.hypot(v.x,v.z),1);
 v=footDirection(0,0,0);near(v.x,0);near(v.z,0);
});
