import os
import shutil
import subprocess
import uuid
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List

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
        # 3. Blender 실행 (스크립트 파일명: blender.py 확인)
        result = subprocess.run([
            blender_exe,
            "-b", 
            "-P", "/app/blender.py", 
            "--", 
            input_3ds,
            output_glb
        ], capture_output=True, text=True, check=True)
        
        # 성공 로그
        print("✅ Blender Success!")
        print(result.stdout)

    except subprocess.CalledProcessError as e:
        # 실패 로그를 더 자세히 출력
        print("❌ Blender Failed!")
        print("--- Blender STDOUT (에러 원인 확인용) ---")
        print(e.stdout) 
        print("--- Blender STDERR ---")
        print(e.stderr)
        
        # 프론트엔드에 에러 내용 전달
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