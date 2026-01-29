import bpy
import sys
import os
import addon_utils 

# 인자 파싱
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

# 1. 초기화
bpy.ops.wm.read_factory_settings(use_empty=True)

# 2. 3DS 플러그인 활성화
try:
    addon_utils.enable("io_scene_3ds")
    print("✅ Enabled io_scene_3ds addon")
except Exception as e:
    print(f"❌ Failed to enable io_scene_3ds addon: {e}")
    # 일단 진행 시도

# 3. 임포트
try:
    # 🚩 [수정] constrict_to_image_bounds 옵션 제거 (기본값 사용)
    bpy.ops.import_scene.autodesk_3ds(filepath=input_file)
except Exception as e:
    print(f"❌ Import Failed: {e}")
    sys.exit(1)

# 4. 객체 선택 및 정리
bpy.ops.object.select_all(action='SELECT')

# 5. GLB 익스포트
try:
    bpy.ops.export_scene.gltf(
        filepath=output_file,
        export_format='GLB',
        ui_tab='GENERAL',
        export_yup=True,
        export_apply=True,
        export_image_format='AUTO', 
        export_materials='EXPORT',  
        export_texture_dir=""       
    )
    print(f"✅ Exported to {output_file}")
except Exception as e:
    print(f"❌ Export Failed: {e}")
    sys.exit(1)