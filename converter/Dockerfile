# 베이스 이미지
FROM python:3.10-slim

# 1. 필수 시스템 패키지 설치
# Blender 실행에 필요한 의존성(libxkbcommon0, libglib2.0-0 등)을 모두 추가했습니다.
RUN apt-get update && \
    apt-get install -y \
    wget \
    xz-utils \
    libgl1 \
    libxi6 \
    libxrender1 \
    libxxf86vm1 \
    libxfixes3 \
    libsm6 \
    libxkbcommon0 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# 2. 작업 디렉토리
WORKDIR /app

# 3. Blender 3.6.7 LTS 다운로드 및 설치 (3DS 지원 버전)
RUN wget https://download.blender.org/release/Blender3.6/blender-3.6.7-linux-x64.tar.xz \
    && tar -xvf blender-3.6.7-linux-x64.tar.xz \
    && mv blender-3.6.7-linux-x64 /usr/local/blender \
    && rm blender-3.6.7-linux-x64.tar.xz

# 4. 블랜더를 PATH에 등록
ENV PATH="/usr/local/blender:$PATH"

# 5. 파이썬 라이브러리 설치
RUN pip install fastapi uvicorn python-multipart

# 6. 소스 코드 복사
COPY main.py .
COPY blender.py .

# 7. 파일 저장소 생성
RUN mkdir -p /app/files

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]