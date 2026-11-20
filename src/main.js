import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addImportedCity, updateImportedCity } from './city-assets.js';
import { loadPeople, animatePerson } from './people.js';
import { loadTraffic } from './traffic.js';
import { footDirection } from './movement.js';
import { bindTouchControls } from './touch-controls.js';

const $ = s => document.querySelector(s);
const loadingTasks=[], loadingFailures=[];let loadingDone=0;
function trackLoading(name, task){
  const entry=Promise.resolve(task).then(()=>({name,ok:true}),error=>{console.warn(`${name} failed to load:`,error);loadingFailures.push(name);return {name,ok:false}}).then(result=>{
    loadingDone++;$('#loading-count').textContent=`${loadingDone} / ${loadingTasks.length}`;
    $('#loading-bar').style.width=`${Math.round(loadingDone/loadingTasks.length*100)}%`;
    $('#loading-label').textContent=`LOADED ${name.toUpperCase()}`;return result;
  });
  loadingTasks.push(entry);$('#loading-count').textContent=`${loadingDone} / ${loadingTasks.length}`;return entry;
}
function closeLoader(){document.querySelector('#loader').hidden=true;$('#play').disabled=false;}
$('#retry-loading').onclick=()=>location.reload();$('#continue-loading').onclick=closeLoader;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xc6c2a9); scene.fog = new THREE.FogExp2(0xc5c3aa, .0055);
const renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:'high-performance'}); renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); renderer.setSize(innerWidth,innerHeight); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.25; $('#scene').appendChild(renderer.domElement);
const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; pmrem.dispose();
const camera = new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.1,1500);
scene.add(new THREE.HemisphereLight(0xd9e8e4,0x9a8168,2.15));
const sun = new THREE.DirectionalLight(0xffd7a1,2.7); sun.position.set(-100,150,70); scene.add(sun);
const sky = new THREE.Mesh(new THREE.SphereGeometry(1000,32,16),new THREE.ShaderMaterial({side:THREE.BackSide, uniforms:{}, vertexShader:'varying vec3 vWorld; void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}', fragmentShader:'varying vec3 vWorld; void main(){float h=normalize(vWorld).y; vec3 horizon=vec3(.91,.76,.61); vec3 upper=vec3(.39,.62,.65); vec3 col=mix(horizon,upper,smoothstep(-.04,.6,h));gl_FragColor=vec4(col,1.);}' })); scene.add(sky);
const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(28,24,16),new THREE.MeshBasicMaterial({color:0xffe8b6})); sunDisc.position.set(-450,110,-750); scene.add(sunDisc);

const mats={ road:new THREE.MeshStandardMaterial({color:0x454d4b,roughness:.95}), sidewalk:new THREE.MeshStandardMaterial({color:0xb0ad9d}), sand:new THREE.MeshStandardMaterial({color:0xc9b993}), water:new THREE.MeshStandardMaterial({color:0x598d8c,roughness:.35,metalness:.2}), white:new THREE.MeshStandardMaterial({color:0xdad5bd}), yellow:new THREE.MeshStandardMaterial({color:0xc5a264}), dark:new THREE.MeshStandardMaterial({color:0x555e59}), glass:new THREE.MeshStandardMaterial({color:0x57726e,roughness:.35,metalness:.22}), trunk:new THREE.MeshStandardMaterial({color:0x76654e}), leaf:new THREE.MeshStandardMaterial({color:0x52684a,side:THREE.DoubleSide}), wall:[0xb5b1a0,0x9fa9a1,0xc6b7a2,0x899a91,0xc6c2b2].map(color=>new THREE.MeshStandardMaterial({color,roughness:.9}))};
const textureLoader=new THREE.TextureLoader();
async function surface(path, material, repeatX, repeatY, normal=false){const tex=await textureLoader.loadAsync('/textures/'+path);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(repeatX,repeatY);tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());if(normal)material.normalMap=tex;else {tex.colorSpace=THREE.SRGBColorSpace;material.map=tex}material.needsUpdate=true;}
trackLoading('road textures',Promise.all([surface('asphalt.webp',mats.road,7,300),surface('asphalt-normal.webp',mats.road,7,300,true)]));trackLoading('sidewalk texture',surface('pavers.webp',mats.sidewalk,35,300));trackLoading('beach texture',surface('sand.webp',mats.sand,16,300));mats.road.color.set(0x777a76);mats.sidewalk.color.set(0xc5c3b7);mats.sand.color.set(0xd1c7ae);
let seed=42; const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}; const between=(a,b)=>a+rand()*(b-a);
const batches=new Map();
const proceduralPalms=[];let importedPalmsReady=false;
function addBox(mat,x,y,z,w,h,d){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push(g)}
function addGeo(mat,g){if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push(g)}
function buildDistrict(){
 addBox(mats.water,-175,-.4,0,240,.3,1200); addBox(mats.sand,-53,-.25,0,65,.3,1200);addBox(mats.sidewalk,110,-.35,0,220,.4,1200);addBox(mats.road,0,-.1,0,27,.2,1200);
 for(const x of [-13.5,13.5])addBox(mats.white,x,.06,0,.35,.18,1200);
 for(const x of [-.18,.18])addBox(mats.yellow,x,.015,0,.1,.025,1200);
 for(const x of [-6.7,6.7])for(let z=-590;z<600;z+=12)addBox(mats.white,x,.016,z,.15,.025,5);
 for(const x of [-16.3,16.3])addBox(mats.sidewalk,x,.07,0,5.5,.18,1200);
 for(let z=-580;z<600;z+=42){for(const x of [-19,19]){let h=between(7,10);let g=new THREE.CylinderGeometry(.15,.28,h,7);g.translate(x,h/2,z);addGeo(mats.trunk,g);for(let j=0;j<8;j++){let a=j*Math.PI/4+between(-.1,.1), l=between(3.2,4.4),dx=Math.cos(a),dz=Math.sin(a);let vertices=new Float32Array([x,h,z,x+dx*l*.38-dz*.65,h+.4,z+dz*l*.38+dx*.65,x+dx*l,h-1,z+dz*l,x,h,z,x+dx*l,h-1,z+dz*l,x+dx*l*.38+dz*.65,h+.4,z+dz*l*.38-dx*.65]);let leaf=new THREE.BufferGeometry();leaf.setAttribute('position',new THREE.BufferAttribute(vertices,3));leaf.computeVertexNormals();addGeo(mats.leaf,leaf)}}}
 for(let z=-590;z<600;z+=8)addBox(mats.white,-23,.65,z,.14,1.3,.14);addBox(mats.white,-23,1.25,0,.12,.12,1200);
 for(const [material,geometries] of batches){const merged=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());const mesh=new THREE.Mesh(merged,material);scene.add(mesh);if(material===mats.trunk||material===mats.leaf){proceduralPalms.push(mesh);mesh.visible=!importedPalmsReady;}}batches.clear();
}
function buildFallbackSkyline(){
 for(const rx of [35,65,100])for(let z=-560;z<590;z+=33){const w=20,d=24,h=18+between(0,32);addBox(mats.wall[Math.floor(rand()*5)],rx,h/2,z,w,h,d);addBox(mats.dark,rx,h+.35,z,w+1,.7,d+1);for(let f=1;f<Math.floor(h/4);f++)for(let wz=-8;wz<=8;wz+=5)addBox(mats.glass,rx-w/2-.04,f*4,z+wz,.08,2.3,3)}
 for(const [material,geometries] of batches){const merged=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());scene.add(new THREE.Mesh(merged,material));}batches.clear();
}
trackLoading('city architecture',addImportedCity(scene,()=>{importedPalmsReady=true;proceduralPalms.forEach(mesh=>mesh.visible=false)}).catch(error=>{buildFallbackSkyline();throw error}));
// The optional Blender export can replace the basic ground and skyline.
trackLoading('coastal district',fetch('/models/coast.glb',{method:'HEAD'}).then(async r=>{if(!r.ok || !r.headers.get('content-type')?.includes('model')){buildDistrict();return}try{scene.add((await new GLTFLoader().loadAsync('/models/coast.glb')).scene)}catch(error){console.warn('Blender map unavailable; using procedural district',error);buildDistrict()}}).catch(()=>buildDistrict()));

const car = new THREE.Group();scene.add(car);
// Fallback is also visible while the detailed model loads.
const fallback=new THREE.Group(); const body=new THREE.Mesh(new THREE.BoxGeometry(2.1,.75,4.5),new THREE.MeshStandardMaterial({color:0x959f88,metalness:.6,roughness:.28}));body.position.y=.8;fallback.add(body);const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.8,.65,2.1),mats.glass);cabin.position.set(0,1.45,.1);fallback.add(cabin);for(const x of [-1,1])for(const z of [-1.4,1.4]){let wheel=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,.3,16),mats.dark);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.45,z);fallback.add(wheel)}car.add(fallback);
trackLoading('player car',new GLTFLoader().loadAsync('/models/car.glb').then(g=>{const model=g.scene;let box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3());if(size.y>size.z && size.y>size.x)model.rotation.x=-Math.PI/2; else if(size.x>size.z && size.x>size.y)model.rotation.y=Math.PI/2;model.updateMatrixWorld(true);box.setFromObject(model);size=box.getSize(new THREE.Vector3());model.scale.setScalar(4.7/Math.max(size.x,size.z));model.updateMatrixWorld(true);box.setFromObject(model);let center=box.getCenter(new THREE.Vector3());model.position.set(-center.x,-box.min.y,-center.z);const oriented = new THREE.Group(); oriented.rotation.y = Math.PI; oriented.add(model);car.remove(fallback);car.add(oriented)}));
// The fallback fleet is only used if the licensed sedan cannot be loaded.
let traffic=[];
function fallbackTraffic(){for(let i=0;i<6;i++){const x=i%2?4:-3,group=new THREE.Group();const body=new THREE.Mesh(new THREE.BoxGeometry(2,.75,4),mats.dark);body.position.y=.72;group.add(body);const cab=new THREE.Mesh(new THREE.BoxGeometry(1.7,.65,1.9),mats.glass);cab.position.y=1.38;group.add(cab);group.position.set(x,0,-60-i*55);scene.add(group);traffic.push({group,wheels:[],x,direction:x<0?-1:1,speed:10})}}
trackLoading('traffic cars',loadTraffic(scene).then(cars=>{traffic=cars}).catch(error=>{fallbackTraffic();throw error}));
const ring=new THREE.Group();let torus=new THREE.Mesh(new THREE.TorusGeometry(5,.17,8,48),new THREE.MeshBasicMaterial({color:0xd8ff9d}));ring.add(torus);let beam=new THREE.Mesh(new THREE.CylinderGeometry(5,5,.05,48,1,true),new THREE.MeshBasicMaterial({color:0xd8ff9d,transparent:true,opacity:.14,side:THREE.DoubleSide}));beam.rotation.x=Math.PI/2;ring.add(beam);ring.visible=false;scene.add(ring);
let state={playing:false,speed:0,heading:0,cameraHeading:0,challenge:false,checkpoint:0,elapsed:0,muted:false,onFoot:false};
const footVelocity=new THREE.Vector2();
let player=null, pedestrians=[];
trackLoading('people',loadPeople(scene).then(people=>{player=people.player;pedestrians=people.pedestrians;})); const checkpoints=[-80,-160,-250,-340,-440];const keys={};
function toast(t){let el=$('#toast');el.textContent=t;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2600)}
function updateTouchMode(){const button=$('#mobile-action');button.querySelector('span').textContent=state.onFoot?'↟':'■';button.querySelector('small').textContent=state.onFoot?'SPRINT':'BRAKE';button.setAttribute('aria-label',state.onFoot?'Sprint':'Brake');document.body.classList.toggle('on-foot',state.onFoot);}
function enterCar(){if(player)player.root.visible=false;state.onFoot=false;touchControls.clear();updateTouchMode();state.heading=car.rotation.y;$('#mode-label').textContent='BEHIND THE WHEEL';$('#interaction').textContent='EXIT CAR';}
function interact(){if(!state.playing)return;if(!player){toast('Characters are still loading.');return}if(!state.onFoot){if(Math.abs(state.speed)>2){toast('Stop the car before getting out.');return}state.onFoot=true;touchControls.clear();updateTouchMode();state.speed=0;state.cameraHeading=state.heading;footVelocity.set(0,0);player.root.position.copy(car.position).add(new THREE.Vector3(-3,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),state.heading));player.root.rotation.y=state.heading;player.root.visible=true;$('#mode-label').textContent='ON FOOT · DRAG TO LOOK';$('#interaction').textContent='ENTER CAR';toast(matchMedia('(pointer: coarse)').matches?'Use the buttons to move, and drag to look. Tap ENTER CAR nearby.':'WASD to move, drag to look. Press E near your car to drive.')}else if(player.root.position.distanceTo(car.position)<5){enterCar();toast('Back behind the wheel.')}else toast('Move closer to your car to enter.')}
function startRun(){enterCar();car.position.set(0,0,0);car.rotation.y=0;state.heading=0;state.speed=0;state.challenge=true;state.checkpoint=0;state.elapsed=0;updateObjective();toast('Checkpoint run started. Follow the green rings.');}
function updateObjective(){if(state.challenge){ring.visible=true;ring.position.set(-3,5,checkpoints[state.checkpoint]);$('#objectiveTitle').textContent=`Checkpoint ${state.checkpoint+1} of ${checkpoints.length}`;$('#objectiveText').textContent='Drive through the glowing marker.';$('#challenge').innerHTML='RESTART <span>↗</span>'}else{ring.visible=false;$('#objectiveTitle').textContent='Take the scenic route';$('#objectiveText').textContent='Cruise the coast or start a checkpoint run.';$('#challenge').innerHTML='START RUN <span>↗</span>'}}
function reset(){enterCar();car.position.set(0,0,0);state.heading=0;state.speed=0;car.rotation.y=0;if(state.challenge)startRun();toast('Back on Ocean Drive');}
let audioCtx,osc,gain,footstepTimer=0;
function footstep(){if(!audioCtx || state.muted)return;const hit=audioCtx.createOscillator(),volume=audioCtx.createGain(),now=audioCtx.currentTime;hit.type='sine';hit.frequency.setValueAtTime(110,now);hit.frequency.exponentialRampToValueAtTime(45,now+.10);volume.gain.setValueAtTime(.025,now);volume.gain.exponentialRampToValueAtTime(.001,now+.12);hit.connect(volume);volume.connect(audioCtx.destination);hit.start(now);hit.stop(now+.13)}
function initAudio(){if(audioCtx){audioCtx.resume();return}try{audioCtx=new AudioContext();osc=audioCtx.createOscillator();let filter=audioCtx.createBiquadFilter();gain=audioCtx.createGain();osc.type='sawtooth';osc.frequency.value=45;filter.type='lowpass';filter.frequency.value=280;gain.gain.value=.025;osc.connect(filter);filter.connect(gain);gain.connect(audioCtx.destination);osc.start()}catch(e){console.warn('Audio unavailable',e)}}
$('#play').onclick=()=>{state.playing=true;document.body.classList.remove('intro-active');$('#intro').classList.add('hidden');initAudio();toast(matchMedia('(pointer: coarse)').matches?'Hold GO to drive; use the arrows to steer.':'The coast is yours. Drive with WASD or arrow keys.');};
$('#challenge').onclick=()=>{if(!state.playing){state.playing=true;document.body.classList.remove('intro-active');$('#intro').classList.add('hidden');initAudio()}startRun()};$('#audio').onclick=()=>{state.muted=!state.muted;if(!audioCtx&&!state.muted)initAudio();$('#audio').textContent=state.muted?'×':'♫';$('#audio').setAttribute('aria-label',state.muted?'Unmute sound':'Mute sound');toast(state.muted?'Sound muted':'Sound on')};
addEventListener('keydown',e=>{let k=e.key.toLowerCase();keys[k]=true;if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();if(k==='r'&&!e.repeat)reset();if(k==='e'&&!e.repeat)interact()});addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);const touchControls=bindTouchControls($('#mobile-controls'),{isOnFoot:()=>state.onFoot});
function clearInput(){Object.keys(keys).forEach(k=>keys[k]=false);touchControls.clear();}
addEventListener('blur',clearInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput()});
$('#interaction').addEventListener('click',interact);$('#mobile-reset').addEventListener('click',()=>{clearInput();reset()});
const down=k=>!!keys[k]||touchControls.isDown(k);
const mini=$('#minimap'),ctx=mini.getContext('2d');function drawMap(){let w=mini.width,h=mini.height;const focus=state.onFoot&&player?player.root:car;ctx.fillStyle='#b3bbaa';ctx.fillRect(0,0,w,h);ctx.fillStyle='#84a9a3';ctx.fillRect(0,0,50,h);ctx.fillStyle='#d3c8a8';ctx.fillRect(50,0,23,h);ctx.fillStyle='#7c8981';ctx.fillRect(75,0,45,h);ctx.strokeStyle='#e7e4cc';ctx.lineWidth=1;ctx.setLineDash([5,6]);ctx.beginPath();ctx.moveTo(97,0);ctx.lineTo(97,h);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#9da79a';for(let y=-20;y<h+30;y+=33){let offset=(focus.position.z*.6)%33;ctx.fillRect(126,y+offset,25,19);ctx.fillRect(157,y+offset,38,19)}if(state.challenge){let dy=(checkpoints[state.checkpoint]-focus.position.z)*.6;ctx.fillStyle='#d9f7a5';ctx.beginPath();ctx.arc(97,Math.max(7,Math.min(h-7,h/2+dy)),5,0,Math.PI*2);ctx.fill()}ctx.save();ctx.translate(97+focus.position.x*.6,h/2);ctx.rotate(-state.heading);ctx.fillStyle='#f8f9ed';ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(5,6);ctx.lineTo(0,3);ctx.lineTo(-5,6);ctx.closePath();ctx.fill();ctx.restore()}
const clock=new THREE.Clock(), camTarget=new THREE.Vector3(),look=new THREE.Vector3();
function animate(){
 requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);
 if(state.playing){
  const forward=(down('w')||down('arrowup')?1:0)-(down('s')||down('arrowdown')?1:0);
  const steer=(down('a')||down('arrowleft')?1:0)-(down('d')||down('arrowright')?1:0);
  if(state.onFoot && player){
   const yaw=state.cameraHeading, strafe=-steer;
   const {x:dx,z:dz}=footDirection(yaw,forward,strafe);
   const pace=down('shift')?5.2:3;
   footVelocity.lerp(new THREE.Vector2(dx*pace,dz*pace),1-Math.exp(-9*dt));
   player.root.position.x=THREE.MathUtils.clamp(player.root.position.x+footVelocity.x*dt,-22,22);
   player.root.position.z=THREE.MathUtils.clamp(player.root.position.z+footVelocity.y*dt,-570,570);
   if(footVelocity.length()>.12){const target=Math.atan2(-footVelocity.x,-footVelocity.y);const delta=Math.atan2(Math.sin(target-state.heading),Math.cos(target-state.heading));state.heading+=delta*(1-Math.exp(-12*dt));}
   player.root.rotation.y=state.heading;
   const moving=footVelocity.length()>.35;
   animatePerson(player,moving,dt,down('shift')?1.4:1);if(moving){footstepTimer-=dt;if(footstepTimer<=0){footstep();footstepTimer=down('shift')?.32:.47}}else footstepTimer=0;
  }else{
   state.speed+=forward*15*dt;if(!forward)state.speed*=Math.exp(-.35*dt);if(down(' '))state.speed*=Math.exp(-3*dt);
   state.speed=THREE.MathUtils.clamp(state.speed,-10,35);
   state.heading+=steer*dt*Math.min(Math.abs(state.speed)/8,1)*1.05*(state.speed<0?-1:1);
   car.position.x-=Math.sin(state.heading)*state.speed*dt;car.position.z-=Math.cos(state.heading)*state.speed*dt;
   if(Math.abs(car.position.x)>21){car.position.x=THREE.MathUtils.clamp(car.position.x,-21,21);state.speed*=.92}
   if(Math.abs(car.position.z)>570){car.position.z=THREE.MathUtils.clamp(car.position.z,-570,570);state.speed*=.8}
   car.rotation.y=state.heading;
   if(state.challenge){state.elapsed+=dt;if(car.position.distanceTo(new THREE.Vector3(-3,0,checkpoints[state.checkpoint]))<6){state.checkpoint++;if(state.checkpoint===checkpoints.length){state.challenge=false;toast(`Run complete in ${Math.round(state.elapsed)} seconds!`)}else toast(`Checkpoint ${state.checkpoint} cleared`);updateObjective()}}
  }
 }
 for(const t of traffic){t.group.position.z+=t.direction*t.speed*dt;for(const wheel of t.wheels)wheel.rotation.x+=t.speed*dt/.33;if(t.group.position.z>car.position.z+100)t.group.position.z-=500;if(t.group.position.z<car.position.z-450)t.group.position.z+=500;if(!state.onFoot&&Math.abs(t.group.position.z-car.position.z)<4.3&&Math.abs(t.group.position.x-car.position.x)<2.1){state.speed*=.65;car.position.z+=state.speed>=0?.12:-.12}}
 for(const p of pedestrians){const nearby=Math.abs(p.root.position.z-(state.onFoot&&player?player.root.position.z:car.position.z))<180;p.root.visible=nearby;if(!nearby)continue;p.root.position.z+=p.dir*p.speed*dt;if(p.root.position.z>560){p.dir=-1;p.root.rotation.y=0}if(p.root.position.z< -560){p.dir=1;p.root.rotation.y=Math.PI}animatePerson(p,true,dt,.8)}
 const focus=state.onFoot&&player?player.root:car; updateImportedCity(focus.position.z); const distance=state.onFoot?5:12, height=state.onFoot?3.1:6.5, cameraYaw=state.onFoot?state.cameraHeading:state.heading;
 camTarget.copy(focus.position).add(new THREE.Vector3(Math.sin(cameraYaw)*distance,height,Math.cos(cameraYaw)*distance));
 camera.position.lerp(camTarget,1-Math.exp(-3*dt));
 look.copy(focus.position).add(new THREE.Vector3(-Math.sin(cameraYaw)*(state.onFoot?4:9),state.onFoot?1.35:1.4,-Math.cos(cameraYaw)*(state.onFoot?4:9)));camera.lookAt(look);
 ring.rotation.z+=dt*.2;$('#speed').textContent=state.onFoot?'—':Math.round(Math.abs(state.speed)*2.237);$('#status-label').textContent=state.onFoot?'PLAYER STATUS':'VEHICLE STATUS';$('#speed-unit').textContent=state.onFoot?'WALK':'MPH';$('#gear').textContent=state.onFoot?'ON FOOT':'GEAR '+Math.min(5,Math.floor(Math.abs(state.speed)/8)+1);
 document.querySelectorAll('.speed-bars i').forEach((el,i)=>el.classList.toggle('active',!state.onFoot&&i<Math.abs(state.speed)/35*12));
 if(audioCtx&&gain){gain.gain.setTargetAtTime(state.muted||!state.playing||state.onFoot?0:.018+Math.abs(state.speed)*.0006,audioCtx.currentTime,.1);osc.frequency.setTargetAtTime(45+Math.abs(state.speed)*4,audioCtx.currentTime,.1)}
 drawMap();renderer.render(scene,camera)
}
let dragging=false,lastPointerX=0;
renderer.domElement.addEventListener('pointerdown',e=>{if(!state.onFoot)return;dragging=true;lastPointerX=e.clientX;renderer.domElement.setPointerCapture(e.pointerId)});
renderer.domElement.addEventListener('pointermove',e=>{if(dragging&&state.onFoot){state.cameraHeading-=(e.clientX-lastPointerX)*.006;lastPointerX=e.clientX}});
for(const type of ['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(type,()=>dragging=false);
Promise.all(loadingTasks).then(async()=>{
  $('#loading-label').textContent='PREPARING THE VIEW';
  // Compile in the background where supported; cap the wait on slow devices.
  if(renderer.compileAsync && renderer.extensions.has('KHR_parallel_shader_compile'))await Promise.race([renderer.compileAsync(scene,camera).catch(()=>{}),new Promise(resolve=>setTimeout(resolve,8000))]);
  else await new Promise(resolve=>requestAnimationFrame(resolve));
  if(loadingFailures.length){$('#loading-message').textContent=`Some assets could not load: ${loadingFailures.join(', ')}. Retry, or continue with available fallbacks.`;$('#loading-label').textContent='ASSETS UNAVAILABLE';$('#loading-actions').hidden=false;}
  else closeLoader();
});
car.position.set(0,0,0);camera.position.set(0,6.5,12);camera.lookAt(0,1,-9);animate();addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
