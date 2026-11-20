import test from 'node:test';
import assert from 'node:assert/strict';
import { bindTouchControls } from '../src/touch-controls.js';

class Button extends EventTarget {
  constructor(hold, footKey) { super(); this.dataset={hold,footKey}; this.classes=new Set(); this.classList={add:name=>this.classes.add(name),remove:name=>this.classes.delete(name)}; }
  setPointerCapture() {}
  send(type, id) { const event=new Event(type,{cancelable:true}); Object.assign(event,{pointerId:id,pointerType:'touch',button:0}); this.dispatchEvent(event); }
}

test('touch controls support simultaneous presses and release on cancellation',()=>{
  const left=new Button('a'), go=new Button('w'), action=new Button('space','shift');
  let onFoot=false;
  const input=bindTouchControls({querySelectorAll:()=>[left,go,action]},{isOnFoot:()=>onFoot});
  left.send('pointerdown',1);go.send('pointerdown',2);
  assert.ok(input.isDown('a'));assert.ok(input.isDown('w'));
  left.send('pointercancel',1);assert.equal(input.isDown('a'),false);assert.ok(input.isDown('w'));
  go.send('lostpointercapture',2);assert.equal(input.isDown('w'),false);
  action.send('pointerdown',3);assert.ok(input.isDown(' '));input.clear();assert.equal(input.isDown(' '),false);
  onFoot=true;action.send('pointerdown',4);assert.ok(input.isDown('shift'));assert.equal(input.isDown(' '),false);
  action.send('pointerdown',5);action.send('pointerup',4);assert.ok(input.isDown('shift'));assert.ok(action.classes.has('pressed'));
  action.send('pointerup',5);assert.equal(input.isDown('shift'),false);assert.equal(action.classes.has('pressed'),false);
});
