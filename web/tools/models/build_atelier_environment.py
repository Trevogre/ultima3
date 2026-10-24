"""Locally authored volumetric environment library. No sprite cards or third-party assets.
Run in Blender through MCP or --background --python. Rebuilds its own named scene.
"""
import bpy
import math
from mathutils import Vector

ROOT='/Users/trevorgreen/Documents/GitHub/ultima3/web'
NAME='Atelier Environment Review'
old=bpy.data.scenes.get(NAME)
if old:
    for obj in list(old.objects): bpy.data.objects.remove(obj,do_unlink=True)
    bpy.data.scenes.remove(old)
scene=bpy.data.scenes.new(NAME);bpy.context.window.scene=scene
scene.world=bpy.data.worlds.new('Environment studio');scene.world.use_nodes=True
next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND').inputs['Color'].default_value=(.09,.12,.17,1)
mat=bpy.data.materials.new('Atelier environment | painted surfaces');mat.use_nodes=True
bsdf=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bsdf.inputs['Roughness'].default_value=.88
paint=mat.node_tree.nodes.new('ShaderNodeVertexColor');paint.layer_name='Paint'
mat.node_tree.links.new(paint.outputs['Color'],bsdf.inputs['Base Color'])
vertices=[];faces=[];colours=[];assets=[]

def rgb(hexcode):
    c=[((hexcode>>n)&255)/255 for n in (16,8,0)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c)

def point(p,c):
    vertices.append(tuple(p));colours.append(rgb(c));return len(vertices)-1

def tube(points,radii,colour,sides=10,twist=0):
    start=len(vertices)
    for i,p in enumerate(points):
        p=Vector(p);d=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
        d.normalize();a=d.cross(Vector((0,1,0)))
        if a.length<.01:a=d.cross(Vector((0,0,1)))
        a.normalize();b=d.cross(a).normalized()
        for j in range(sides):
            angle=math.tau*j/sides;groove=1+.09*math.sin(j*3+twist+i*.4)
            v=p+(a*math.cos(angle)+b*math.sin(angle))*radii[i]*groove
            point(v,0xAD8A51 if j%5==1 else colour)
    for i in range(len(points)-1):
        for j in range(sides):
            a=start+i*sides+j;b=start+i*sides+(j+1)%sides;faces.append((a,b,b+sides,a+sides))
    faces.extend([tuple(start+j for j in reversed(range(sides))),tuple(start+(len(points)-1)*sides+j for j in range(sides))])

def crown(cx,cy,base,height,width,depth,seed,colour=0x315C44):
    start=len(vertices);sides=20;rings=12
    for r in range(rings):
        t=r/(rings-1)
        # Hand-shaped flame profile with curved tip and broken foliage edges.
        profile=max(.015,math.sin(math.pi*t)**.68)*(1-.48*t)
        bend=math.sin(t*2.4+seed)*.13*t
        for j in range(sides):
            a=math.tau*j/sides
            scallop=1+.12*math.sin(a*5+t*6+seed)+.065*math.sin(a*9-t*12)
            x=cx+bend+math.cos(a)*width*profile*scallop
            y=cy+math.sin(t*2+seed)*.04*t+math.sin(a)*depth*profile*scallop
            z=base+t*height+math.sin(a*7+seed)*.025*math.sin(math.pi*t)
            light=math.sin(a*6+t*17+seed)
            c=0x829448 if light>.72 else 0x4F8053 if light>-.1 else colour
            point((x,y,z),c)
    for r in range(rings-1):
        for j in range(sides):
            a=start+r*sides+j;b=start+r*sides+(j+1)%sides;faces.append((a,b,b+sides,a+sides))
    faces.extend([tuple(start+j for j in reversed(range(sides))),tuple(start+(rings-1)*sides+j for j in range(sides))])

def leaf(base,tip,width,colour,roll=0):
    a=Vector(base);b=Vector(tip);axis=(b-a).normalized();right=axis.cross(Vector((0,0,1)))
    if right.length<.01:right=axis.cross(Vector((0,1,0)))
    right.normalize();normal=axis.cross(right).normalized()
    right=right*math.cos(roll)+normal*math.sin(roll);normal=axis.cross(right).normalized()
    middle=a.lerp(b,.47);start=len(vertices)
    for p,c in [(a,colour),(middle+right*width,colour),(b,0xA0A35A),(middle-right*width,colour),(middle+normal*width*.32,0x638453),(middle-normal*width*.16,colour)]:point(p,c)
    for k in range(4):faces.extend([(start+k,start+(k+1)%4,start+4),(start+(k+1)%4,start+k,start+5)])

def finish(kind,index,description):
    name=kind+'-'+str(index);data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update()
    ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);data.materials.append(mat)
    attr=data.color_attributes.new(name='Paint',type='FLOAT_COLOR',domain='CORNER')
    for poly in data.polygons:
        poly.use_smooth=kind not in ['grass','reed']
        for li in poly.loop_indices:attr.data[li].color=colours[data.loops[li].vertex_index]+(1,)
    ob['description']=description;ob['asset_kind']=kind;ob['variant']=index;assets.append(ob)
    # Review layout is node translation only; each mesh retains a grounded local origin.
    rows={'tree':0,'brush':1,'rock':2,'grass':3,'reed':4}
    ob.location=(index*2.4,-rows[kind]*3.2,0)
    vertices.clear();faces.clear();colours.clear()
    return ob

# Five authored silhouettes, not one tree randomly rotated.
for variant in range(5):
    if variant==0:
        tube([(0,0,0),(.01,.01,.6),(-.035,0,1.3),(.04,.01,2.6)],[.09,.065,.045,.008],0x6A5035,14)
        crown(0,0,.5,2.4,.39,.32,1)
        crown(-.21,.02,.6,1.65,.2,.22,3)
        crown(.2,-.03,.8,1.55,.19,.23,6)
        label='Tall cypress with asymmetric flame crown'
    elif variant==1:
        tube([(0,0,0),(-.04,.01,.45),(.06,.02,.85),(.01,0,1.4)],[.11,.085,.06,.015],0x705638,14)
        for i in range(6):
            a=i*math.tau/6+.3;x=math.cos(a)*.43;y=math.sin(a)*.34
            tube([(.01,0,.65),(x*.45,y*.45,1.03),(x,y,1.25)],[.043,.028,.008],0x705638,9)
            crown(x,y,1.05,.72,.44,.36,i+2,0x3B6347)
        crown(0,.02,1.27,.66,.49,.4,8,0x3B6347)
        label='Wide olive canopy with exposed forked branches'
    elif variant==2:
        tube([(0,0,0),(.025,0,.8),(-.02,.025,1.6),(.02,.01,2.6)],[.085,.06,.035,.004],0x6B4D32,14)
        for level in range(4):
            z=.65+level*.43;radius=.5-level*.10
            for i in range(4):
                a=i*math.tau/4+level*.9;x=math.cos(a)*radius;y=math.sin(a)*radius
                tube([(0,0,z),(x*.7,y*.7,z-.05),(x,y,z+.13)],[.03,.016,.005],0x6B4D32,8)
                crown(x*.65,y*.65,z-.07,.57,radius*.66,radius*.59,i+level*2,0x264C43)
        crown(0,0,2.02,.66,.16,.15,9,0x264C43)
        label='Open Scots pine with irregular whorled boughs'
    elif variant==3:
        tube([(0,0,0),(.06,0,.3),(-.04,.035,.7),(.10,.025,1.13)],[.14,.12,.09,.06],0x75573A,16)
        for i in range(7):
            a=i*2.4;x=math.cos(a)*(.46+(i%2)*.13);y=math.sin(a)*.40
            tube([(-.01,.02,.6),(.07+x*.42,y*.4,1.06),(x,y,1.42+(i%3)*.08)],[.065,.043,.01],0x75573A,10,i)
            crown(x,y,1.12+(i%3)*.08,.91,.4,.34,i+4,0x395B38)
        label='Gnarled oak with a divided broad crown'
    else:
        tube([(0,0,0),(.02,0,.35),(.18,.01,.85),(.32,.025,1.5),(.48,.02,2.1)],[.1,.085,.065,.04,.008],0x755438,14)
        crown(.25,.02,.63,1.95,.36,.28,3,0x2D5948)
        crown(.5,-.04,.95,1.6,.27,.24,4,0x2D5948)
        for i in range(3):
            z=.65+i*.28;tube([(.15,0,z),(.4,-.02,z+.10),(.62,-.03,z+.23)],[.025,.017,.004],0x755438,8)
        label='Wind-shaped coastal cypress with a leaning trunk'
    finish('tree',variant,label)

for variant in range(5):
    for i in range(5+variant):
        a=i*2.4+variant;length=.20+(i%3)*.04
        end=(math.cos(a)*length,math.sin(a)*length,.24+(i%3)*.035)
        tube([(0,0,.01),(end[0]*.45,end[1]*.45,end[2]*.6),end],[.012,.007,.002],0x73603C,6)
        if variant in [1,3]:
            # Ferns and bracken: each frond has paired, solid leaflets.
            for j in range(1,5):
                t=j/5;centre=Vector((end[0]*t,end[1]*t,end[2]*math.sin(t*math.pi*.7)))
                for sign in [-1,1]:
                    tip=centre+Vector((-math.sin(a)*sign*.10*(1-t*.5),math.cos(a)*sign*.10*(1-t*.5),.018))
                    leaf(centre,tip,.024,0xA18D49 if variant==3 else 0x4D7951)
        else:
            for j in range(5):
                aa=a+j*2.4;tip=Vector(end)+Vector((math.cos(aa)*.1,math.sin(aa)*.1,.04))
                leaf(Vector(end)*.7,tip,.047,0x537B4B if variant!=4 else 0x365D49)
            if variant==2:
                for j in range(5):
                    aa=j*math.tau/5
                    leaf(end,(end[0]+math.cos(aa)*.04,end[1]+math.sin(aa)*.04,end[2]+.012),.018,0xC6AE4A)
    finish('brush',variant,['Leafy heather','Spreading fern','Flowering gorse','Dry bracken','Low juniper'][variant])

for variant in range(5):
    # Broken rock planes use authored ring proportions and an off-centre ridge.
    start=len(vertices);n=22
    for r,(z,radius) in enumerate([(0,.40),(.18,.48),(.47,.43),(.72,.31),(.82,.26)]):
        for j in range(n):
            a=j*math.tau/n;rough=1+.10*math.sin(j*2.8+variant)+.045*math.cos(j*7+r)
            x=math.cos(a)*radius*rough+z*(variant-2)*.12
            y=math.sin(a)*radius*(.65+variant*.055)*rough
            zz=z*(.74+variant*.07)+math.sin(a*3+variant)*.12*math.sin(math.pi*z)
            point((x,y,zz),0xA89C78 if j%4==0 else 0x6B7181 if j%3==0 else 0x4B586E)
    for r in range(4):
        for j in range(n):
            a=start+r*n+j;b=start+r*n+(j+1)%n
            faces.extend([(a,b,a+n),(b,b+n,a+n)])
    faces.extend([tuple(start+j for j in reversed(range(n))),tuple(start+4*n+j for j in range(n))])
    finish('rock',variant,'Fractured ridge boulder '+str(variant+1))

for variant in range(5):
    for i in range(6+variant):
        a=i*2.4+variant;length=.1+(i%4)*.018;bx=math.cos(a)*.04;by=math.sin(a)*.04
        leaf((bx,by,0),(bx+math.cos(a)*.055,by+math.sin(a)*.055,length),.009,0x6A894D,math.sin(i)*.4)
    finish('grass',variant,'Grounded volumetric grass tuft '+str(variant+1))

for variant in range(3):
    for i in range(5+variant):
        a=i*2.4;bx=math.cos(a)*.045;by=math.sin(a)*.045;h=.25+(i%3)*.07
        leaf((bx,by,0),(bx+math.cos(a)*.07,by+math.sin(a)*.07,h),.012,0x7E9053)
        if i%3==0:
            tube([(bx,by,0),(bx,by,h*.9),(bx+.01,by,h*1.15)],[.003,.003,.002],0x8D9250,6)
            crown(bx+.01,by,h,.09,.012,.012,i,0x6D563A)
    finish('reed',variant,'Shore reed and cattail cluster '+str(variant+1))

# A lightweight silhouette-preserving LOD accompanies each tree and shrub.
types=[i.identifier for i in bpy.types.Modifier.bl_rna.properties['type'].enum_items]
if 'DECIMATE' in types:
    for ob in list(assets):
        if ob['asset_kind'] not in ['tree','brush']:continue
        low=bpy.data.objects.new(ob.name+'-lod',ob.data.copy());scene.collection.objects.link(low);low.location=ob.location
        bpy.context.view_layer.objects.active=low
        mod=low.modifiers.new('Distant silhouette','DECIMATE');mod.ratio=.16 if ob['asset_kind']=='tree' else .28
        bpy.ops.object.modifier_apply(modifier=mod.name)
        low.data.validate()
        low.hide_set(True);assets.append(low)

cam_data=bpy.data.cameras.new('Environment camera');cam=bpy.data.objects.new('Environment camera',cam_data);scene.collection.objects.link(cam)
cam.location=(11,-18,15);cam.rotation_euler=(Vector((4.8,-5.4,.8))-cam.location).to_track_quat('-Z','Y').to_euler();cam_data.type='ORTHO';cam_data.ortho_scale=17;scene.camera=cam
for name,loc,power,size in [('Key',(-4,-8,12),1600,8),('Fill',(10,-1,10),1200,8)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.size=size;ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector((4,-5,0))-ob.location).to_track_quat('-Z','Y').to_euler()
for ob in scene.objects:ob.select_set(False)
for ob in assets:ob.hide_set(False);ob.select_set(True)
bpy.context.view_layer.objects.active=assets[0]
# GLB is verified against the installed exporter's dynamic enum diagnostic.
try:bpy.ops.export_scene.gltf(export_format='__inspect_enum__')
except TypeError as error:
    if "'GLB'" not in str(error):raise RuntimeError('GLB not supported')
bpy.ops.export_scene.gltf(filepath=ROOT+'/public/models/atelier/environment.glb',export_format='GLB',use_selection=True,use_active_scene=True,export_animations=False,export_yup=True)
for ob in assets:
    if ob.name.endswith('-lod'):ob.hide_set(True)
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/docs/models/atelier/environment-study.blend')
print('Environment assets:',[(ob.name,sum(len(p.vertices)-2 for p in ob.data.polygons)) for ob in assets])
