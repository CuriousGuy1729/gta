"""Create the coastal district in Blender (or Python with the bpy wheel)."""
import bpy, math, random, os
from mathutils import Vector
random.seed(42)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

def mat(name, color, rough=0.8, metal=0):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*color,1); bs.inputs['Roughness'].default_value=rough; bs.inputs['Metallic'].default_value=metal
 return m
asphalt=mat('sun-worn asphalt',(.105,.115,.12)); concrete=mat('warm sidewalk',(.48,.46,.41)); sand=mat('sand',(.58,.49,.35)); ocean=mat('pacific',(.045,.25,.28),.28,.2); white=mat('road paint',(.83,.79,.66)); yellow=mat('lane gold',(.83,.58,.22)); trunk=mat('palm trunk',(.29,.24,.18)); leaf=mat('palm fronds',(.17,.27,.16)); window=mat('blue glass',(.13,.23,.25),.25,.35); dark=mat('details',(.16,.18,.17)); walls=[mat('plaster '+str(i),c) for i,c in enumerate([(.60,.57,.48),(.50,.52,.48),(.69,.60,.48),(.40,.46,.45),(.62,.62,.57)])]
groups={}
def box(name,loc,scale,material):
 bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o=bpy.context.object; o.name=name; o.dimensions=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(material); groups.setdefault(material.name,[]).append(o); return o
# Blender x/y plane becomes glTF x/-z
box('ocean',(-175,0,-.35),(240,1200,.3),ocean)
box('beach',(-53,0,-.2),(65,1200,.3),sand)
box('city base',(110,0,-.3),(220,1200,.4),concrete)
box('boulevard',(0,0,-.07),(27,1200,.18),asphalt)
for x in [-13.5,13.5]: box('curb',(x,0,.07),(.35,1200,.2),white)
for x in [-.18,.18]: box('center line',(x,0,.03),(.10,1200,.025),yellow)
for x in [-6.7,6.7]:
 for y in range(-590,600,12): box('lane dash',(x,y,.035),(.15,5,.025),white)
# pavements and planters
for x in [-16.3,16.3]: box('sidewalk',(x,0,.08),(5.5,1200,.2),concrete)
for y in range(-580,600,42):
 # palm tree trunk and pointed fronds
 for x in [-19,19]:
  h=random.uniform(7,10)
  bpy.ops.mesh.primitive_cone_add(vertices=7, radius1=.28,radius2=.14,depth=h,location=(x,y,h/2)); o=bpy.context.object; o.data.materials.append(trunk); groups.setdefault(trunk.name,[]).append(o)
  for j in range(8):
   a=j*math.tau/8+random.uniform(-.1,.1); length=random.uniform(3.2,4.4)
   # slender frond represented by tapered triangle
   base=Vector((x,y,h)); tip=Vector((x+math.cos(a)*length,y+math.sin(a)*length,h-1.0)); side=Vector((-math.sin(a)*.65,math.cos(a)*.65,0)); mid=base.lerp(tip,.38)+Vector((0,0,.4))
   mesh=bpy.data.meshes.new('frond'); mesh.from_pydata([base,mid+side,tip,mid-side],[],[(0,1,2),(0,2,3)]); mesh.materials.append(leaf); obj=bpy.data.objects.new('frond',mesh); bpy.context.collection.objects.link(obj); groups.setdefault(leaf.name,[]).append(obj)
# waterfront railing
for y in range(-590,600,8): box('beach rail post',(-23,y,.65),(.14,.14,1.3),white)
box('beach railing',(-23,0,1.25),(.12,1200,.12),white)
# dense skyline, buildings and glazing
for rowx in [35,65,100,145]:
 for y in range(-560,590,33):
  x=rowx+random.uniform(-3,3); yy=y+random.uniform(-4,4); w=random.uniform(17,25); d=random.uniform(19,27); h=random.uniform(13,35) if rowx==35 else random.uniform(22,75)
  box('building',(x,yy,h/2),(w,d,h),random.choice(walls))
  box('roof',(x,yy,h+.35),(w+1,d+1,.7),dark)
  # regular glass strips on road-facing facades
  floors=int(h/4)
  for f in range(1,floors):
   for wy in range(-int(d/2)+3,int(d/2)-1,5):
    box('window',(x-w/2-.035,yy+wy,f*4),(0.08,3,2.3),window)
  if rowx>35:
   for f in range(1,floors): box('side window band',(x,yy-d/2-.04,f*4),(w*.82,.08,2.0),window)
# join per material for efficient drawing
for name,objects in groups.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects: o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join(); objects[0].name='District - '+name
os.makedirs('public/models',exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath('public/models/coast.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.abspath('public/models/coast.glb'), export_format='GLB')
print('MAP EXPORTED')
