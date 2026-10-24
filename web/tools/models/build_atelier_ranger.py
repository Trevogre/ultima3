"""Authored ranger study. Run in Blender; preserves unrelated scenes and objects.
Outputs only this study's GLB and .blend. No network or external assets.
"""
import bpy
import math
from mathutils import Vector

ROOT = '/Users/trevorgreen/Documents/GitHub/ultima3/web'
STUDY = 'Atelier Ranger Review'
old = bpy.data.scenes.get(STUDY)
if old:
    # Rebuild only the explicitly named generated study, never the user's scene.
    for obj in list(old.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.scenes.remove(old)
    for action in list(bpy.data.actions):
        if action.get('ultima_atelier'): bpy.data.actions.remove(action)
scene = bpy.data.scenes.new(STUDY)
bpy.context.window.scene = scene
scene.unit_settings.system = 'METRIC'
scene.render.resolution_x = 1000
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.render.fps = 30
scene.world = bpy.data.worlds.new('Atelier Twilight')
scene.world.use_nodes = True
background = next(n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND')
background.inputs['Color'].default_value = (0.11, 0.15, 0.24, 1)
background.inputs['Strength'].default_value = 0.35

mat = bpy.data.materials.new('Atelier | brushed colour')
mat.use_nodes = True
bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
bsdf.inputs['Roughness'].default_value = 0.84
color = mat.node_tree.nodes.new('ShaderNodeVertexColor')
color.layer_name = 'Paint'
mat.node_tree.links.new(color.outputs['Color'], bsdf.inputs['Base Color'])
objects = []

def linear(v):
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4

def rgb(hexcode):
    return tuple(linear(((hexcode >> n) & 255) / 255) for n in (16, 8, 0))

PALETTE = {
    'coat': 0x244F63, 'coatLight': 0x3C7980, 'cloak': 0x263D60,
    'lining': 0x65717D, 'trouser': 0x3B4648, 'leather': 0x704C31,
    'boot': 0x49372D, 'sole': 0x292C2B, 'skin': 0xBE9270,
    'hair': 0x473A2C, 'hairLight': 0x6E5637, 'gold': 0xC5A04D,
    'eye': 0x333A30, 'white': 0xB4AF96, 'lip': 0x865A4E,
}

def skin_weights(z):
    centres = [('hips', .91), ('spine', 1.13), ('chest', 1.39)]
    if z <= centres[0][1]: return {'hips': 1}
    for (a, az), (b, bz) in zip(centres, centres[1:]):
        if z <= bz:
            t = (z - az) / (bz - az)
            return {a: 1-t, b: t}
    return {'chest': 1}

def resolve_weights(point, weights):
    if isinstance(weights, dict): return weights
    z=point[2]
    if weights[0]=='torso': return skin_weights(z)
    if weights[0]=='arm':
        t=max(0,min(1,(1.20-z)/.12));return {weights[1]:1-t,weights[2]:t}
    if weights[0]=='leg':
        t=max(0,min(1,(.61-z)/.13));return {weights[1]:1-t,weights[2]:t}
    return {weights[2]:1} if z<.16 else {weights[1]:1}

def mesh(name, verts, faces, colour, weights, brush=.08, smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    ob = bpy.data.objects.new(name, data)
    scene.collection.objects.link(ob)
    data.materials.append(mat)
    colours = data.color_attributes.new(name='Paint', type='FLOAT_COLOR', domain='CORNER')
    base = rgb(PALETTE.get(colour, colour))
    for poly in data.polygons:
        poly.use_smooth = smooth
        for li in poly.loop_indices:
            vi = data.loops[li].vertex_index
            x,y,z = verts[vi]
            # Elongated, intersecting colour strokes follow garment height.
            stroke = math.sin(x*92 + z*19 + math.sin(y*21)*2)*.46 + math.sin(z*67 + y*15)*.24
            broad = math.sin(x*13 + y*17 + z*9)*.3
            factor = 1 + brush*(stroke+broad)
            painted=tuple(max(0,min(1,c*factor)) for c in base)
            if colour in ['coat','cloak']:
                stroke=max(0,math.sin(z*95+math.sin(x*24+y*13)*1.4))**8*.42
                highlight=rgb(0x68A69A if colour=='coat' else 0x4C729D)
                painted=tuple(c*(1-stroke)+h*stroke for c,h in zip(painted,highlight))
            colours.data[li].color = painted+(1,)
    for i, point in enumerate(verts):
        ws = resolve_weights(point, weights)
        for bone, value in ws.items():
            if value <= 0: continue
            vg = ob.vertex_groups.get(bone) or ob.vertex_groups.new(name=bone)
            vg.add([i], value, 'REPLACE')
    objects.append(ob)
    return ob

def loft(name, rings, colour, weights, sides=24, folds=0, brush=.16):
    """Horizontal shaped cross-sections: z, x-centre, y-centre, half-width, depth."""
    if colour in ['coat','trouser']:
        dense=[]
        for a,b in zip(rings,rings[1:]):
            for j in range(4):
                t=j/4;dense.append(tuple(aa*(1-t)+bb*t for aa,bb in zip(a,b)))
        dense.append(rings[-1]);rings=dense;sides=max(sides,48)
    verts=[]
    for z,cx,cy,rx,ry in rings:
        for i in range(sides):
            a=2*math.pi*i/sides
            f=1+folds*(.65*math.sin(a*7+z*5)+.35*math.sin(a*11-z*3))
            verts.append((cx+math.cos(a)*rx*f, cy+math.sin(a)*ry*f, z))
    faces=[]
    for r in range(len(rings)-1):
        for i in range(sides):
            a=r*sides+i; b=r*sides+(i+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.extend([tuple(reversed(range(sides))),tuple((len(rings)-1)*sides+i for i in range(sides))])
    return mesh(name,verts,faces,colour,weights,brush)

def tube(name, points, radii, colour, weights, sides=10, brush=.12):
    verts=[]
    for i, p in enumerate(points):
        p=Vector(p)
        tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
        tangent.normalize()
        a=tangent.cross(Vector((0,1,0)))
        if a.length < .001: a=tangent.cross(Vector((0,0,1)))
        a.normalize(); b=tangent.cross(a).normalized()
        radius=radii[i]
        if not isinstance(radius,tuple): radius=(radius,radius)
        for j in range(sides):
            theta=2*math.pi*j/sides
            verts.append(tuple(p+a*(math.cos(theta)*radius[0])+b*(math.sin(theta)*radius[1])))
    faces=[]
    for i in range(len(points)-1):
        for j in range(sides):
            a=i*sides+j; b=i*sides+(j+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.extend([tuple(reversed(range(sides))),tuple((len(points)-1)*sides+j for j in range(sides))])
    return mesh(name,verts,faces,colour,weights,brush)

# Cloth follows adult anatomy, with a shaped waist and several hem folds.
loft('Tunic | shaped torso',[(.91,0,0,.164,.105),(1.01,0,0,.154,.103),(1.11,0,.005,.146,.095),(1.24,0,0,.183,.112),(1.37,0,0,.219,.10),(1.43,0,.008,.211,.077),(1.49,0,.012,.074,.065)],'coat',('torso',),32,.025)
loft('Tunic | flared hem',[(.75,0,.008,.207,.13),(.82,0,.004,.194,.124),(.94,0,0,.165,.108),(1.01,0,0,.154,.105)],'coat',('torso',),40,.065)
loft('Belt',[(.965,0,-.002,.169,.113),(.998,0,-.002,.166,.111)],'leather',{'hips':1},48,0,.1)
# Front of the character faces -Y. A hollow buckle, not a solid gold brick.
for x1,z1,x2,z2 in [(-.025,.968,.025,.968),(-.025,1.001,.025,1.001),(-.025,.968,-.025,1.001),(.025,.968,.025,1.001)]:
    tube('Buckle',[(x1,-.117,z1),(x2,-.117,z2)],[.004,.004],'gold',{'hips':1},8)
loft('Neck',[(1.465,0,0,.054,.052),(1.55,0,-.005,.055,.05)],'skin',{'neck':.4,'head':.6},24,0,.035)
loft('Collar',[(1.455,0,.008,.082,.073),(1.49,0,.008,.077,.069),(1.513,0,.008,.064,.057)],'coatLight',{'chest':1},32,.015)

# Head cross-sections: defined chin/jaw, cheek planes and a normal-sized cranium.
loft('Head | jaw and cheek planes',[(1.525,0,-.033,.027,.035),(1.55,0,-.014,.052,.055),(1.58,0,-.003,.066,.064),(1.62,0,0,.073,.073),(1.66,0,.002,.075,.077),(1.70,0,.004,.073,.076),(1.74,0,.009,.067,.066),(1.775,0,.014,.048,.048),(1.79,0,.015,.012,.014)],'skin',{'head':1},32,0,.035)
# Nose with a deliberate bridge, tip and underside, rather than a sphere.
mesh('Nose', [(-.012,-.067,1.679),(.012,-.067,1.679),(-.014,-.084,1.626),(.014,-.084,1.626),(0,-.104,1.626),(-.017,-.075,1.613),(.017,-.075,1.613),(0,-.091,1.611)], [(0,1,4),(0,4,2),(1,3,4),(2,4,5),(4,3,6),(5,4,7),(4,6,7)],'skin',{'head':1},.025)
for sign in [-1,1]:
    # Almond-shaped eye socket, upper lid and narrow iris.
    cx=sign*.035
    mesh('Eye | almond',[(cx-.018,-.065,1.66),(cx,-.073,1.668),(cx+.018,-.065,1.66),(cx,-.072,1.655)],[(0,1,2,3)],'white',{'head':1},0)
    tube('Upper eyelid',[(cx-.018,-.067,1.66),(cx,-.075,1.669),(cx+.018,-.067,1.66)],[.0025,.003,.0025],'hair',{'head':1},8,0)
    tube('Iris',[(cx,-.074,1.657),(cx,-.074,1.664)],[.004,.004],'eye',{'head':1},10,0)
    tube('Brow',[(cx-.019,-.066,1.683),(cx,-.073,1.688),(cx+.018,-.065,1.684)],[.003,.004,.0025],'hair',{'head':1},8)
    loft('Ear',[(1.605,sign*.075,.005,.012,.013),(1.634,sign*.08,.003,.015,.018),(1.662,sign*.075,.003,.01,.015)],'skin',{'head':1},16,0,.025)
tube('Mouth', [(-.022,-.067,1.583),(0,-.074,1.581),(.022,-.067,1.583)],[.002,.0028,.002],'lip',{'head':1},8,0)
# Layered swept locks and a short beard follow the head surface.
loft('Hair | crown',[(1.69,0,.022,.075,.065),(1.735,0,.012,.077,.075),(1.775,0,.018,.056,.058),(1.80,0,.021,.012,.015)],'hair',{'head':1},32,.05)
for i in range(13):
    a=2*math.pi*i/13
    tube('Hair | swept locks',[(math.cos(a)*.018,.02+math.sin(a)*.016,1.795),(math.cos(a)*.055,.016+math.sin(a)*.055,1.77),(math.cos(a)*.074,.015+math.sin(a)*.074,1.711)],[.012,.016,.009], 'hairLight' if i%4==0 else 'hair',{'head':1},8)
loft('Beard | jaw',[(1.526,0,-.034,.029,.037),(1.55,0,-.012,.054,.059),(1.568,0,-.008,.06,.06)],'hair',{'head':1},28,.035)

for sign,suffix in [(-1,'L'),(1,'R')]:
    arm='upper_arm.'+suffix; fore='forearm.'+suffix; hand='hand.'+suffix
    thigh='thigh.'+suffix; shin='shin.'+suffix; foot='foot.'+suffix
    def aw(p,arm=arm,fore=fore):
        t=max(0,min(1,(1.20-p[2])/.12))
        return {arm:1-t,fore:t}
    tube('Sleeve.'+suffix,[(sign*.194,.004,1.40),(sign*.24,0,1.35),(sign*.28,-.005,1.25),(sign*.305,-.015,1.17),(sign*.324,-.024,1.08)],[.072,.078,.066,.055,.048],'coat',('arm',arm,fore),24,.19)
    tube('Cuff.'+suffix,[(sign*.321,-.024,1.10),(sign*.335,-.028,1.045)],[.051,.048],'leather',{fore:1},24)
    tube('Wrist.'+suffix,[(sign*.331,-.028,1.055),(sign*.345,-.035,1.005)],[.034,.03],'skin',{fore:.25,hand:.75},20,.025)
    loft('Hand.'+suffix,[(.942,sign*.351,-.032,.026,.021),(.979,sign*.353,-.037,.032,.024),(1.018,sign*.345,-.035,.028,.025)],'skin',{hand:1},20,0,.025)
    for finger in range(4):
        xx=sign*(.328+finger*.014)
        tube('Finger.'+suffix,[(xx,-.042,.966),(xx,-.049,.935-abs(finger-1.5)*.004),(xx,-.039,.924-abs(finger-1.5)*.004)],[.007,.006,.005],'skin',{hand:1},8,.02)
    tube('Thumb.'+suffix,[(sign*.326,-.046,.997),(sign*.315,-.065,.975),(sign*.32,-.067,.953)],[.012,.01,.007],'skin',{hand:1},10,.02)
    def lw(p,thigh=thigh,shin=shin):
        t=max(0,min(1,(.61-p[2])/.13))
        return {thigh:1-t,shin:t}
    loft('Trousers.'+suffix,[(.19,sign*.105,.012,.051,.05),(.36,sign*.106,.014,.06,.059),(.53,sign*.103,.004,.065,.06),(.65,sign*.099,0,.073,.071),(.83,sign*.09,.005,.085,.08),(.95,sign*.085,0,.082,.076)],'trouser',('leg',thigh,shin),28,.025)
    loft('Boot.'+suffix,[(.045,sign*.107,-.066,.065,.127),(.085,sign*.107,-.071,.064,.128),(.125,sign*.107,-.051,.059,.105),(.18,sign*.107,.002,.052,.057),(.31,sign*.107,.01,.059,.059),(.37,sign*.107,.01,.065,.061)],'boot',('boot',shin,foot),28,.015,.09)
    loft('Boot sole.'+suffix,[(.023,sign*.107,-.065,.066,.128),(.05,sign*.107,-.065,.068,.13)],'sole',{foot:1},32,0,.05)
    loft('Boot cuff.'+suffix,[(.345,sign*.107,.01,.067,.063),(.384,sign*.107,.01,.068,.065)],'leather',{shin:1},28,.01)

# Cloak is a draped surface, shaped in cross-sections with asymmetric hanging folds.
verts=[]; faces=[]
for r,(z,width,depth) in enumerate([(1.45,.217,.075),(1.34,.25,.115),(1.15,.255,.14),(.95,.26,.16),(.75,.273,.17),(.57,.285,.18)]):
    for i in range(25):
        u=i/24; a=.12+u*(math.pi-.24)
        fold=math.sin(u*math.pi*10+z*1.7)*.012*(1.55-z)
        verts.append((math.cos(a)*width, .035+math.sin(a)*depth+fold, z+(math.sin(u*8)*.015 if r==5 else 0)))
for r in range(5):
    for i in range(24):
        a=r*25+i; faces.append((a,a+1,a+26,a+25))
cloak=mesh('Cloak | draped folds',verts,faces,'cloak',('torso',),.24)
solid=cloak.modifiers.new('Fabric thickness','SOLIDIFY');solid.thickness=.004
# Shoulder fastening and diagonal leather strap.
tube('Shoulder strap', [(-.155,-.059,1.425),(-.11,-.096,1.31),(-.045,-.115,1.17),(.035,-.113,1.02)],[ (.021,.007)]*4,'leather',('torso',),12)
for sign in [-1,1]:
    tube('Cloak clasp',[(sign*.15,-.065,1.422),(sign*.15,-.075,1.422)],[.012,.012],'gold',{'chest':1},16)
tube('Clasp chain',[(-.145,-.077,1.418),(0,-.092,1.39),(.145,-.077,1.418)],[.0025]*3,'gold',{'chest':1},8)
# A slim sheath and sword on the belt add a readable ranger silhouette.
tube('Scabbard',[(.176,.021,.97),(.22,.039,.72),(.255,.058,.48)],[ (.025,.017),(.023,.015),(.012,.012)],'leather',{'hips':1},16)
tube('Sword grip',[(.171,.019,.985),(.157,.012,1.10)],[.013,.012],'boot',{'hips':1},12)
tube('Sword guard',[(.119,.006,.982),(.218,.03,.982)],[.008,.008],'gold',{'hips':1},12)

# Apply non-deformation modifiers, then combine into a single skinned draw surface.
bpy.ops.object.select_all(action='DESELECT')
for ob in objects:
    bpy.context.view_layer.objects.active=ob
    for mod in list(ob.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
    ob.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.object.join()
body=bpy.context.object
body.name='Ranger | painted skinned mesh'

arm_data=bpy.data.armatures.new('Ranger skeleton')
rig=bpy.data.objects.new('Atelier Ranger',arm_data)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig
body.select_set(False);rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')

def bone(name,head,tail,parent=None):
    b=arm_data.edit_bones.new(name);b.head=head;b.tail=tail
    if parent: b.parent=arm_data.edit_bones[parent]
    return b
bone('root',(0,0,0),(0,0,.2))
bone('hips',(0,0,.90),(0,0,1.06),'root')
bone('spine',(0,0,1.06),(0,0,1.27),'hips')
bone('chest',(0,0,1.27),(0,0,1.47),'spine')
bone('neck',(0,0,1.47),(0,0,1.55),'chest')
bone('head',(0,0,1.55),(0,0,1.78),'neck')
for sign,s in [(-1,'L'),(1,'R')]:
    bone('upper_arm.'+s,(sign*.20,0,1.4),(sign*.304,-.015,1.17),'chest')
    bone('forearm.'+s,(sign*.304,-.015,1.17),(sign*.345,-.035,1.01),'upper_arm.'+s)
    bone('hand.'+s,(sign*.345,-.035,1.01),(sign*.352,-.038,.94),'forearm.'+s)
    bone('thigh.'+s,(sign*.09,0,.91),(sign*.104,0,.54),'hips')
    bone('shin.'+s,(sign*.104,0,.54),(sign*.107,.01,.14),'thigh.'+s)
    bone('foot.'+s,(sign*.107,.01,.14),(sign*.107,-.15,.07),'shin.'+s)
bpy.ops.object.mode_set(mode='OBJECT')
body.parent=rig
modifier=body.modifiers.new('Ranger deformation','ARMATURE');modifier.object=rig
for p in rig.pose.bones:p.rotation_mode='XYZ'

# Hand-authored continuous motion. Feet plant in the middle of each stance;
# joint offsets vary independently instead of switching whole-mesh frames.
rig.animation_data_create()
for name,length in [('Idle',90),('Walk',30),('Attack',36),('Cast',60),('Hit',24)]:
    action=bpy.data.actions.new(name)
    action['ultima_atelier']=True
    rig.animation_data.action=action
    for frame in range(1,length+1,3):
        t=(frame-1)/(length-1); phase=t*math.tau
        for p in rig.pose.bones:
            p.rotation_euler=(0,0,0);p.location=(0,0,0);p.scale=(1,1,1)
        hips=rig.pose.bones['hips']; chest=rig.pose.bones['chest']; head=rig.pose.bones['head']
        if name=='Idle':
            chest.rotation_euler.x=math.sin(phase)*.018
            chest.scale=(1+math.sin(phase)*.004,1+math.sin(phase)*.008,1)
            head.rotation_euler.z=math.sin(phase*.5)*.025
            for i,s in enumerate(['L','R']):rig.pose.bones['forearm.'+s].rotation_euler.x=.08+math.sin(phase+i)*.015
        elif name=='Walk':
            hips.location.y=.012*(1-math.cos(phase*2))
            hips.rotation_euler.z=math.sin(phase)*.035
            chest.rotation_euler.z=-math.sin(phase)*.06
            chest.rotation_euler.x=.035
            for i,s in enumerate(['L','R']):
                a=phase+i*math.pi
                rig.pose.bones['thigh.'+s].rotation_euler.x=math.sin(a)*.37
                rig.pose.bones['shin.'+s].rotation_euler.x=max(0,math.sin(a))*.65
                rig.pose.bones['foot.'+s].rotation_euler.x=-max(0,math.sin(a))*.18
                rig.pose.bones['upper_arm.'+s].rotation_euler.x=-math.sin(a)*.28
                rig.pose.bones['forearm.'+s].rotation_euler.x=.12+max(0,math.sin(a))*.18
        elif name=='Attack':
            anticipation=math.sin(math.pi*min(t/.38,1)) if t<.38 else 0
            strike=math.sin(math.pi*max(0,min((t-.32)/.68,1)))
            chest.rotation_euler.z=-anticipation*.35+strike*.42
            rig.pose.bones['upper_arm.R'].rotation_euler.x=anticipation*.8-strike*1.15
            rig.pose.bones['forearm.R'].rotation_euler.x=-anticipation*.8-strike*.35
            rig.pose.bones['upper_arm.L'].rotation_euler.x=.3*strike
            hips.rotation_euler.x=.08*strike
        elif name=='Cast':
            lift=math.sin(math.pi*t)**.7
            chest.rotation_euler.x=-.08*lift
            for sign,s in [(-1,'L'),(1,'R')]:
                rig.pose.bones['upper_arm.'+s].rotation_euler.x=-1.0*lift
                rig.pose.bones['upper_arm.'+s].rotation_euler.z=sign*.38*lift
                rig.pose.bones['forearm.'+s].rotation_euler.x=-.8*lift
                rig.pose.bones['hand.'+s].rotation_euler.x=.2*lift
            head.rotation_euler.x=-.10*lift
        else:
            impact=math.sin(math.pi*t)*math.exp(-t*2)
            chest.rotation_euler.x=-.5*impact;chest.rotation_euler.z=.2*impact
            head.rotation_euler.x=-.25*impact
            rig.pose.bones['upper_arm.L'].rotation_euler.x=-.4*impact
            rig.pose.bones['upper_arm.R'].rotation_euler.x=-.35*impact
        for p in rig.pose.bones:
            p.keyframe_insert('rotation_euler',frame=frame,group=p.name)
            p.keyframe_insert('location',frame=frame,group=p.name)
            p.keyframe_insert('scale',frame=frame,group=p.name)
    # Exact loop/recovery end pose.
    scene.frame_set(1)
    for p in rig.pose.bones:
        p.keyframe_insert('rotation_euler',frame=length,group=p.name)
        p.keyframe_insert('location',frame=length,group=p.name)
        p.keyframe_insert('scale',frame=length,group=p.name)
    action.use_fake_user=True
    track=rig.animation_data.nla_tracks.new();track.name=name
    track.strips.new(name,1,action);track.mute=True
rig.animation_data.action=bpy.data.actions.get('Idle')
scene.frame_end=90;scene.frame_set(1)

# Review staging is not part of the exported character.
cam_data=bpy.data.cameras.new('Atelier review camera')
cam=bpy.data.objects.new('Atelier review camera',cam_data);scene.collection.objects.link(cam)
cam.location=(2.8,-5.5,2.7)
cam.rotation_euler=(Vector((0,0,.95))-cam.location).to_track_quat('-Z','Y').to_euler()
cam_data.type='ORTHO';cam_data.ortho_scale=2.25;scene.camera=cam
for name,location,energy,size,colour in [('Warm key',(-3,-4,5),650,4,(1,.86,.65)),('Cool fill',(3,-1,3),350,3,(.55,.73,1)),('Rim',(1,3,4),800,3,(1,.65,.32))]:
    data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=size;data.color=colour
    light=bpy.data.objects.new(name,data);scene.collection.objects.link(light);light.location=location
    light.rotation_euler=(Vector((0,0,1))-light.location).to_track_quat('-Z','Y').to_euler()

# glTF enum values are inspected on the installed exporter before use.
rna=bpy.ops.export_scene.gltf.get_rna_type()
formats=[i.identifier for i in rna.properties['export_format'].enum_items]
print('glTF formats:',formats)
if not formats:
    # Dynamic RNA enums can under-report; TypeError gives the installed identifiers.
    try: bpy.ops.export_scene.gltf(export_format='__inspect_enum__')
    except TypeError as error:
        if "'GLB'" in str(error): formats=['GLB']
if 'GLB' not in formats: raise RuntimeError('GLB export unavailable')
for ob in scene.objects:ob.select_set(False)
rig.select_set(True);body.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=ROOT+'/public/models/atelier/ranger.glb',export_format='GLB',use_selection=True,use_active_scene=True,export_animations=True,export_nla_strips=True,export_skins=True,export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/docs/models/atelier/ranger-study.blend')
triangles=sum(len(p.vertices)-2 for p in body.data.polygons)
print({'scene':scene.name,'vertices':len(body.data.vertices),'triangles':triangles,'bones':len(arm_data.bones),'actions':[a.name for a in bpy.data.actions],'bounds':[tuple(body.bound_box[0]),tuple(body.bound_box[6])]})
