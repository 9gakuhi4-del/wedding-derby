"""Convert CC0 Lyndon Daniels / ChadM horse to a small, textured GLB, with authored gallop."""
import bpy, math, os
SOURCE=os.environ.get('HORSE_SOURCE','/tmp/horse-rigged.blend')
OUT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../public/assets/3d/racehorse.glb'))
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath=SOURCE)
scene=bpy.context.scene
for o in list(bpy.data.objects):
 if o.type not in {'MESH','ARMATURE'}:bpy.data.objects.remove(o,do_unlink=True)
rig=bpy.data.objects.get('Armature')
# Restore packed diffuse/normal textures from the original legacy Blender materials.
for obj in [o for o in bpy.data.objects if o.type=='MESH']:
 name=obj.name
 material=bpy.data.materials.new('coat' if name=='Plane' else 'eyes' if name.startswith('Sphere') else 'mane_tail')
 material.use_nodes=True;p=material.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.65
 image=bpy.data.images.get('HorseMain4k00.png' if name=='Plane' else 'eye_texture.bmp.001' if name.startswith('Sphere') else 'Hair12Main2k.png')
 if image and image.size[0]:
  image.scale(1024,1024) if image.size[0]>1024 else None
  t=material.node_tree.nodes.new('ShaderNodeTexImage');t.image=image;material.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color'])
  if name.startswith('Bezier'):
   material.node_tree.links.new(t.outputs['Alpha'],p.inputs['Alpha']);material.surface_render_method='DITHERED';material.use_transparency_overlap=False
 if name=='Plane':
  n=material.node_tree.nodes.new('ShaderNodeTexImage');n.image=bpy.data.images.get('HorseMain4k00Norm00.p');n.image.colorspace_settings.name='Non-Color';n.image.scale(1024,1024)
  normal=material.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.45;material.node_tree.links.new(n.outputs['Color'],normal.inputs['Color']);material.node_tree.links.new(normal.outputs['Normal'],p.inputs['Normal'])
 obj.data.materials.clear();obj.data.materials.append(material)
 for poly in obj.data.polygons:poly.use_smooth=True
 # Fix unbound mane, tail and eye meshes in the original source.
 if not any(m.type=='ARMATURE' for m in obj.modifiers):
  allowed=['Bone.002'] if name.startswith('Sphere') else ['Bone','Bone.001','Bone.002','Bone.003','Bone.004']
  groups={b:obj.vertex_groups.get(b) or obj.vertex_groups.new(name=b) for b in allowed}
  def dist(p,b):
   a=rig.matrix_world@rig.data.bones[b].head_local;c=rig.matrix_world@rig.data.bones[b].tail_local;d=c-a;t=max(0,min(1,(p-a).dot(d)/max(d.length_squared,1e-6)));return (p-a-d*t).length
  for v in obj.data.vertices:
   pnt=obj.matrix_world@v.co;weights=sorted([(dist(pnt,b),b) for b in allowed])[:2];total=sum(1/(d+.01)**4 for d,b in weights)
   for d,b in weights:groups[b].add([v.index],(1/(d+.01)**4)/total,'REPLACE')
  mod=obj.modifiers.new('Horse deformation','ARMATURE');mod.object=rig
# One real gallop cycle, sampled at 30 fps. Front pair lead; hind pair follows.
for b in rig.pose.bones:
 for constraint in list(b.constraints):b.constraints.remove(constraint)
for o in list(bpy.data.objects):
 if o.type=='MESH':
  world_matrix=o.matrix_world.copy();o.parent=rig;o.matrix_world=world_matrix
rig.animation_data_create();action=bpy.data.actions.new('Gallop');rig.animation_data.action=action
for bone in rig.pose.bones:bone.rotation_mode='XYZ'
for frame in range(31):
 p=frame/30*math.tau
 for bone in rig.pose.bones:bone.rotation_euler=(0,0,0);bone.location=(0,0,0)
 for side,offset in [('L',0),('R',.8)]:
  t=p+offset
  rig.pose.bones['Bone_'+side].rotation_euler.x=.20*math.sin(t)
  rig.pose.bones['Bone_'+side+'.001'].rotation_euler.x=.68*math.sin(t)
  rig.pose.bones['Bone_'+side+'.002'].rotation_euler.x=-.85*max(0,math.sin(t-.7))
  t=p+offset+2.6
  rig.pose.bones['Bone_'+side+'.003'].rotation_euler.x=.30*math.sin(t)
  rig.pose.bones['Bone_'+side+'.004'].rotation_euler.x=.68*math.sin(t)
  rig.pose.bones['Bone_'+side+'.005'].rotation_euler.x=.65*max(0,math.sin(t-.7))
 rig.pose.bones['Bone'].rotation_euler.x=.025*math.sin(p)
 rig.pose.bones['Bone'].location.z=.19*math.sin(p*2)
 rig.pose.bones['Bone.001'].rotation_euler.x=.05*math.sin(p+.4)
 rig.pose.bones['Bone.002'].rotation_euler.x=.06*math.sin(p-.2)
 rig.pose.bones['Bone.003'].rotation_euler.x=.28
 rig.pose.bones['Bone.004'].rotation_euler.x=.16*math.sin(p+.3)
 rig.pose.bones['Bone.004'].rotation_euler.z=.08*math.sin(p)
 for bone in rig.pose.bones:bone.keyframe_insert('rotation_euler',frame=frame);bone.keyframe_insert('location',frame=frame)
for fc in action.fcurves:
 for k in fc.keyframe_points:k.interpolation='LINEAR'
scene.frame_start=0;scene.frame_end=30;scene.render.fps=30;scene.frame_set(0)
# Normalize to a 1.6 m withers horse, forward -Z in glTF.
verts=[o.matrix_world@Vector(c) for o in bpy.data.objects if o.type=='MESH' for c in o.bound_box]
lo=Vector(tuple(min(v[i] for v in verts) for i in range(3)));hi=Vector(tuple(max(v[i] for v in verts) for i in range(3)))
print('BOUNDS',list(lo),list(hi))
root=bpy.data.objects.new('HorseRoot',None);scene.collection.objects.link(root)
for o in list(scene.objects):
 if o!=root and o.parent is None:o.parent=root
root.scale=(.2,)*3;root.rotation_euler.z=math.pi;root.location=(0,-.35,-lo.z*.2+.02)
bpy.context.view_layer.update()
output=OUT
bpy.ops.export_scene.gltf(filepath=output,export_format='GLB',export_animations=True,export_frame_range=True,export_force_sampling=True,export_image_format='AUTO',export_materials='EXPORT')
bpy.ops.wm.save_as_mainfile(filepath='/tmp/racehorse-source.blend')
# A real renderer preview of the exported shape and its first gait pose.
scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True
world=bpy.data.worlds.new('World') if not scene.world else scene.world;scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.50,.60,.70,1);world.node_tree.nodes['Background'].inputs[1].default_value=.7
bpy.ops.object.light_add(type='AREA',location=(-3,-4,7));bpy.context.object.data.energy=550;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=5
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015));plane=bpy.context.object;ma=bpy.data.materials.new('grass');ma.diffuse_color=(.12,.2,.07,1);plane.data.materials.append(ma)
bpy.ops.object.camera_add(location=(4.5,4.5,2.7));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,1.1))-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam;cam.data.lens=50
scene.render.resolution_x=800;scene.render.resolution_y=600;scene.render.resolution_percentage=100;scene.render.filepath='/tmp/horse-3d-preview.png';bpy.ops.render.render(write_still=True)
