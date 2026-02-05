import os
import shutil
import subprocess
import uuid
import psycopg2
import json
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 도커 내부 저장 경로
UPLOAD_DIR = "/app/files"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# -------------------------------------------------------------
# [1] 3D 변환 API
# -------------------------------------------------------------
@app.post("/convert")
async def convert_3ds_to_glb(files: List[UploadFile] = File(...)):
    # 1. 작업 ID 생성 및 폴더 생성
    task_id = str(uuid.uuid4())
    task_dir = os.path.join(UPLOAD_DIR, task_id)
    os.makedirs(task_dir, exist_ok=True)

    input_3ds = None
    
    # 2. 파일 저장
    for file in files:
        file_path = os.path.join(task_dir, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 대소문자 무시하고 3ds 파일 찾기
        if file.filename.lower().endswith(".3ds"):
            input_3ds = file_path

    if not input_3ds:
        return {"error": "3ds file missing. Please upload a .3ds file."}

    # 출력 파일명 설정
    output_glb = input_3ds.rsplit('.', 1)[0] + ".glb"
    
    # Blender 실행 커맨드
    blender_exe = "blender"
    
    print(f"🚀 [Start] Converting {input_3ds} -> {output_glb}")
    
    try:
        # 3. Blender 실행
        result = subprocess.run([
            blender_exe,
            "-b", 
            "-P", "/app/blender.py", 
            "--", 
            input_3ds,
            output_glb
        ], capture_output=True, text=True, check=True)
        
        print("✅ Blender Success!")
        print(result.stdout)

    except subprocess.CalledProcessError as e:
        print("❌ Blender Failed!")
        print("--- Blender STDOUT ---")
        print(e.stdout) 
        print("--- Blender STDERR ---")
        print(e.stderr)
        return {"error": "Blender conversion failed", "details": f"Stdout: {e.stdout} / Stderr: {e.stderr}"}
        
    except Exception as e:
        print(f"❌ System Error: {str(e)}")
        return {"error": "System error", "details": str(e)}

    # 4. 파일 생성 확인
    if not os.path.exists(output_glb):
        return {"error": "Conversion finished but GLB file not found.", "details": "Check blender script logic."}

    # 5. URL 반환 (Nginx 경로 기준)
    download_url = f"http://localhost/files/{task_id}/{os.path.basename(output_glb)}"
    
    return {
        "status": "success",
        "url": download_url,
        "filename": os.path.basename(output_glb)
    }

# -------------------------------------------------------------
# [2] 라이브러리 목록 조회 API (들여쓰기 수정 완료)
# -------------------------------------------------------------
@app.get("/models")
async def get_models():
    """DB 라이브러리 목록 반환"""
    print("📢 [API] /models 요청 처리 시작")
    try:
        # docker-compose의 서비스명 'db'로 접속
        conn = psycopg2.connect(
            host="db",
            database="gisdb",
            user="docker",
            password="docker"
        )
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # 데이터 조회
        cur.execute("""
            SELECT mlid, model_org_file_name, model_save_file_url, thumb_save_url 
            FROM cbn.tbd_simlatn_model_info 
            ORDER BY mlid ASC
        """)
        rows = cur.fetchall()
        
        cur.close()
        conn.close()
        
        print(f"✅ DB 조회 성공: {len(rows)}건")
        return rows

    except Exception as e:
        print(f"❌ DB Error: {str(e)}")
        # 에러 발생 시 빈 리스트 반환하여 프론트엔드 크래시 방지
        return []

# -------------------------------------------------------------
# [DTO] 데이터 검증 모델
# -------------------------------------------------------------
class SceneRequest(BaseModel):
    scene_name: str
    user_id: Optional[str] = "guest" # 로그인 기능 연동 전까지 임시값
    scene_data: Dict[str, Any]       # GeoJSON 전체가 들어옴 (FeatureCollection)

# -------------------------------------------------------------
# [3] 시나리오(Scene) 저장 API
# -------------------------------------------------------------
@app.post("/scenes")
async def save_scene(scene: SceneRequest):
    print(f"💾 [API] 시나리오 저장 요청: {scene.scene_name}")
    try:
        conn = psycopg2.connect(
            host="db", database="gisdb", user="docker", password="docker"
        )
        cur = conn.cursor()

        # PostgreSQL JSONB 컬럼에 Dict를 바로 넣으려면, 
        # psycopg2.extras.Json 을 쓰거나, json.dumps()로 문자열 변환 후 넣어야 합니다.
        import json
        json_data = json.dumps(scene.scene_data)

        sql = """
            INSERT INTO cbn.tbd_simlatn_scene_info 
            (scene_name, user_id, scene_data, reg_date)
            VALUES (%s, %s, %s::jsonb, NOW())
            RETURNING scene_id
        """
        cur.execute(sql, (scene.scene_name, scene.user_id, json_data))
        
        new_id = cur.fetchone()[0]
        conn.commit()
        
        cur.close()
        conn.close()
        
        return {"status": "success", "scene_id": new_id, "message": "저장 완료"}

    except Exception as e:
        print(f"❌ Save Error: {str(e)}")
        return {"error": "DB Save Failed", "details": str(e)}

# -------------------------------------------------------------
# [4] 시나리오 목록 조회 API
# -------------------------------------------------------------
@app.get("/scenes")
async def get_scenes():
    try:
        conn = psycopg2.connect(
            host="db", database="gisdb", user="docker", password="docker"
        )
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # 목록 조회 시 무거운 jsonb 데이터(scene_data)는 제외하고 가져오는 것이 성능상 좋음
        cur.execute("""
            SELECT scene_id, scene_name, user_id, reg_date 
            FROM cbn.tbd_simlatn_scene_info 
            ORDER BY reg_date DESC
        """)
        rows = cur.fetchall()
        
        cur.close()
        conn.close()
        return rows
    except Exception as e:
        return []

# -------------------------------------------------------------
# [5] 특정 시나리오 상세 조회 (Load) API
# -------------------------------------------------------------
@app.get("/scenes/{scene_id}")
async def get_scene_detail(scene_id: int):
    try:
        conn = psycopg2.connect(
            host="db", database="gisdb", user="docker", password="docker"
        )
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("""
            SELECT scene_id, scene_name, scene_data 
            FROM cbn.tbd_simlatn_scene_info 
            WHERE scene_id = %s
        """, (scene_id,))
        row = cur.fetchone()
        
        cur.close()
        conn.close()
        
        if row:
            return row
        else:
            return {"error": "Scene not found"}
    except Exception as e:
        return {"error": str(e)}

@app.get("/scenes/{scene_id}")
async def get_scene_detail(scene_id: int):
    print(f"📂 [API] 시나리오 상세 조회 요청: ID={scene_id}")
    try:
        conn = psycopg2.connect(
            host="db", database="gisdb", user="docker", password="docker"
        )
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # 1. 시나리오 데이터 조회
        cur.execute("""
            SELECT scene_id, scene_name, scene_data 
            FROM cbn.tbd_simlatn_scene_info 
            WHERE scene_id = %s
        """, (scene_id,))
        row = cur.fetchone()
        
        if not row:
            cur.close()
            conn.close()
            return {"error": "Scene not found"}

        # ------------------------------------------------------------------
        # [핵심 로직] GeoJSON 내부를 순회하며 mlid에 해당하는 파일 경로 주입
        # ------------------------------------------------------------------
        scene_data = row['scene_data']
        
        # (중첩 구조 방어 코드: DB에 scene_data.scene_data로 저장된 경우 한 꺼풀 벗김)
        if isinstance(scene_data, dict) and 'scene_data' in scene_data:
            print("⚠️ 중첩된 데이터 구조 감지됨. 내부 데이터로 진입합니다.")
            scene_data = scene_data['scene_data']

        # features 배열이 있는지 확인
        if isinstance(scene_data, dict) and 'features' in scene_data:
            # 1) GeoJSON에서 필요한 mlid 목록 추출 (중복 제거)
            mlids = set()
            for feature in scene_data['features']:
                props = feature.get('properties', {})
                if props.get('mlid'):
                    mlids.add(int(props['mlid']))
            
            # 2) DB에서 해당 mlid들의 파일 경로 한꺼번에 조회
            if mlids:
                # SQL IN 절을 위한 튜플 생성
                mlid_tuple = tuple(mlids)
                if len(mlids) == 1:
                    mlid_tuple = (list(mlids)[0],) # 항목이 하나일 때 튜플 문법 유지 (1,)
                
                # 모델 정보 조회 쿼리
                sql_models = f"""
                    SELECT mlid, model_save_file_url, model_org_file_name
                    FROM cbn.tbd_simlatn_model_info 
                    WHERE mlid IN {mlid_tuple}
                """
                cur.execute(sql_models)
                model_rows = cur.fetchall()
                
                # 3) 조회 결과를 딕셔너리로 변환 (mlid -> url 매핑)
                # Nginx 경로(/files)가 포함되어 있다고 가정합니다. 만약 DB에 '/files'가 없다면 앞에 붙여줘야 합니다.
                model_map = {m['mlid']: m['model_save_file_url'] for m in model_rows}
                
                # 4) GeoJSON properties에 'modelUrl' 주입
                for feature in scene_data['features']:
                    props = feature.get('properties', {})
                    m_id = props.get('mlid')
                    
                    # mlid가 있고, DB에서 찾은 URL이 있다면 주입
                    if m_id and m_id in model_map:
                        # 프론트엔드 접근 가능한 전체 URL로 가공
                        # 예: DB값이 '/models/tree.glb' 라면 -> 'http://localhost/files/models/tree.glb'
                        # (이미 DB에 /files 경로가 포함되어 있다면 중복되지 않게 주의)
                        
                        relative_path = model_map[m_id]
                        if not relative_path.startswith("/files"): 
                             # Nginx alias 경로에 맞춤
                             full_url = f"http://localhost/files{relative_path}"
                        else:
                             full_url = f"http://localhost{relative_path}"

                        props['modelUrl'] = full_url
                        
                        # feature 속성 업데이트
                        feature['properties'] = props

        # ------------------------------------------------------------------
        
        cur.close()
        conn.close()
        
        # 수정된 scene_data를 결과 객체에 반영
        row['scene_data'] = scene_data
        
        print("✅ 시나리오 데이터 로드 및 경로 주입 완료")
        return row

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}