import * as Cesium from "cesium"

export class DataManager {
  constructor(viewer) {
    this.viewer = viewer;
  }

  // 기본 마커(포인트) 추가
  addMarker(lat, lon, id, name) {
    return this.viewer.entities.add({
      id: id,
      name: name,
      position: Cesium.Cartesian3.fromDegrees(lon, lat),
      // 이미지가 깨져도 마커가 보이도록 '점(Point)'을 추가합니다.
      point: {
        pixelSize: 10,
        color: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      },
      // 이미지를 쓰고 싶다면 경로를 아래와 같이 수정하세요.
      billboard: {
        image: Cesium.buildModuleUrl('Assets/Textures/pin.png'), // 내부 자산 경로 사용
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY 
      },
      label: {
        text: name,
        font: '14px sans-serif',
        fillColor: Cesium.Color.WHITE,
        pixelOffset: new Cesium.Cartesian2(0, -20),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      }
  });
}

  // V월드 3D 건물(3D Tiles) 추가 함수
  async addVworld3DBuildings() {
    try {
      // V월드 3D Tileset URL (인증키가 포함된 URL 구조)
      // 인증키는 브라우저용(localhost:5173 등록 필요)을 사용해야 합니다.
      const vworldKey = "37B44C3A-8C01-30CE-806E-7D89E87B8473"; 
      
      const tileset = await Cesium.Cesium3DTileset.fromUrl(
        `https://api.vworld.kr/real3d/wmts/1.0.0/${vworldKey}/tileset.json`,
        {
          // 건물 바닥이 지형 아래로 파묻히는 것을 방지
          heightOffset: 0 
        }
      );

      this.viewer.scene.primitives.add(tileset);
      
      // 건물이 로드되면 해당 위치로 카메라를 이동시키고 싶을 때 (선택사항)
      // this.viewer.zoomTo(tileset);
      
      console.log("🏢 V월드 3D 건물 로드 성공");
    } catch (error) {
      console.error("❌ 3D 빌딩 로드 실패:", error);
    }
  }

  // 3D 공간에서 클릭된 위치의 좌표를 계산
  pickPosition(windowPosition) {
    const cartesian = this.viewer.scene.pickPosition(windowPosition);
    if (Cesium.defined(cartesian)) {
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      return {
        lon: Cesium.Math.toDegrees(cartographic.longitude),
        lat: Cesium.Math.toDegrees(cartographic.latitude)
      };
    }
    return null;
  }

  // 카메라 고정 해제
  clearTracking() {
    this.viewer.trackedEntity = undefined; // undefined로 설정하면 고정이 풀립니다.
    console.log("🔓 카메라 추적 모드 해제");
  }

  // 특정 엔티티를 카메라가 추적
  setTracking(entity) {
    if (entity) {
      this.viewer.trackedEntity = entity;
      console.log("🔒 카메라 추적 모드 활성화:", entity.name);
    }
  }

  // 모든 데이터 삭제
  clearAll() {
    this.viewer.entities.removeAll();
  }
}