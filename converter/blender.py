import bpy
import sys
import os
import mathutils

# -------------------------------------------------------------
# 인자 파싱
# -------------------------------------------------------------
argv = sys.argv
try:
    index = argv.index("--") + 1
except ValueError:
    index = len(argv)

argv = argv[index:] 
if len(argv) < 2:
    print("Error: Input and Output file paths are required.")
    sys.exit(1)

input_file = argv[0]
output_file = argv[1]

# -------------------------------------------------------------
# 1. 초기화 (씬 비우기)
# -------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)

# -------------------------------------------------------------
# 2. 임포트 (3DS)
# -------------------------------------------------------------
try:
    # 3DS 애드온 확인 및 활성화
    if "io_scene_3ds" not in bpy.context.preferences.addons:
        bpy.ops.preferences.addon_enable(module="io_scene_3ds")
        
    bpy.ops.import_scene.autodesk_3ds(filepath=input_file)
    print(f"✅ Imported: {input_file}")
except Exception as e:
    print(f"❌ Import Failed: {e}")
    sys.exit(1)

# -------------------------------------------------------------
# 3. [핵심] 객체 정리 및 병합 (하나의 덩어리로 만들기)
# -------------------------------------------------------------
# 모든 MESH 객체 선택
bpy.ops.object.select_all(action='DESELECT')
mesh_objs = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']

if not mesh_objs:
    print("❌ No mesh objects found in 3DS file.")
    sys.exit(1)

# 모든 메쉬 선택 후 하나로 합치기 (Join)
# 이렇게 해야 Cesium에서 Node_0 하나만 조절해도 건물 전체가 변형됨
c = {}
c["object"] = c["active_object"] = mesh_objs[0]
c["selected_objects"] = c["selected_editable_objects"] = mesh_objs
bpy.ops.object.join(c)

# 합쳐진 객체 가져오기
target_obj = bpy.context.scene.objects[0]
bpy.context.view_layer.objects.active = target_obj
target_obj.select_set(True)

# 이름 표준화 (Node_0 같은 이름 방지, 명확하게 MainBuilding으로 설정)
target_obj.name = "MainBuilding"

# -------------------------------------------------------------
# 4. [핵심] Transform 초기화 (Scale Baking)
# -------------------------------------------------------------
# 회전, 크기 등을 메쉬 데이터 자체에 적용해버림 (Scale을 1,1,1로 리셋)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# -------------------------------------------------------------
# 5. [옵션] 중심점(Origin)을 바닥 중앙으로 이동
# -------------------------------------------------------------
# 경계상자 계산
bbox_corners = [target_obj.matrix_world @ mathutils.Vector(corner) for corner in target_obj.bound_box]
min_x = min([v.x for v in bbox_corners])
max_x = max([v.x for v in bbox_corners])
min_y = min([v.y for v in bbox_corners])
max_y = max([v.y for v in bbox_corners])
min_z = min([v.z for v in bbox_corners])

# 바닥 중앙 좌표 계산
center_x = (min_x + max_x) / 2
center_y = (min_y + max_y) / 2
bottom_z = min_z

# 3D 커서를 바닥 중앙으로 이동 후 Origin 설정
bpy.context.scene.cursor.location = (center_x, center_y, bottom_z)
bpy.ops.object.origin_set(type='ORIGIN_CURSOR')

# 다시 0,0,0으로 이동 (Cesium 좌표계 일치)
target_obj.location = (0, 0, 0)

print("✅ Object Merged, Normalized & Origin Reset")

# -------------------------------------------------------------
# 6. GLB 익스포트
# -------------------------------------------------------------
try:
    bpy.ops.export_scene.gltf(
        filepath=output_file,
        export_format='GLB',
        ui_tab='GENERAL',
        export_yup=True,        # Y축이 위쪽 (일반적인 3D 표준)
        export_apply=True,      # 적용된 변형 내보내기
        export_image_format='AUTO', 
        export_materials='EXPORT',  
        export_texture_dir=""       
    )
    print(f"✅ Exported to {output_file}")
except Exception as e:
    print(f"❌ Export Failed: {e}")
    sys.exit(1)