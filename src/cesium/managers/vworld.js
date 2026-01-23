import * as Cesium from "cesium"

export class VWorldManager {
  constructor(viewer) {
    this.viewer = viewer;
    this.layer2D = null;   // 위성/하이브리드 레이어
    this.tileset3D = null; // 3D 건물 데이터
    this.key = "37B44C3A-8C01-30CE-806E-7D89E87B8473";
  }

  // 1. 위성/하이브리드/일반 지도 토글
  toggleImagery(visible, layerType = "Satellite") {
    // 기존 레이어 제거
    if (this.layer2D) {
      this.viewer.imageryLayers.remove(this.layer2D);
      this.layer2D = null;
    }

    if (visible) {
      // 확장자 자동 선택 (위성: jpeg, 나머지: png)
      const ext = layerType === "Satellite" ? "jpeg" : "png";
      
      this.layer2D = this.viewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: `/vworld-bin/req/wmts/1.0.0/${this.key}/${layerType}/{z}/{y}/{x}.${ext}`,
          minimumLevel: 6,
          maximumLevel: 19,
          credit: new Cesium.Credit("V-World")
        })
      );
    }
  }

  // 2. 3D 건물 로드
  async loadBuildings() {
    if (this.tileset3D) {
      this.tileset3D.show = true;
      return;
    }

    try {
      console.log("🇰🇷 V-World 3D 데이터 로드 시도...");

      // 프록시를 통한 데이터 요청
      const tilesetUrl = "/vworld-data/TDServer/services/facility_build/tileset.json";
      
      this.tileset3D = await Cesium.Cesium3DTileset.fromUrl(tilesetUrl, {
        maximumScreenSpaceError: 16, 
        skipLevelOfDetail: true
      });

      this.viewer.scene.primitives.add(this.tileset3D);
      
      // 높이 보정
      this.adjustHeight(100); 

      // 카메라 이동
      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(126.8320, 37.6585, 1000),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 }
      });

    } catch (e) {
      console.warn("⚠️ V-World 3D 로드 실패 (Iframe 모드 권장):", e);
    }
  }
  
  hideBuildings() {
    if (this.tileset3D) {
      this.tileset3D.show = false;
    }
  }

  // 높이 보정 유틸
  adjustHeight(heightOffset) {
    if (!this.tileset3D) return;
    const cartographic = Cesium.Cartographic.fromCartesian(this.tileset3D.boundingSphere.center);
    const surface = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, 0.0);
    const offset = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, heightOffset);
    const translation = Cesium.Cartesian3.subtract(offset, surface, new Cesium.Cartesian3());
    this.tileset3D.modelMatrix = Cesium.Matrix4.fromTranslation(translation);
  }
}