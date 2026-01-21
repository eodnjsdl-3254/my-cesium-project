import * as Cesium from "cesium"

export class CameraManager {
  constructor(viewer) {
    this.viewer = viewer;
  }

  // 특정 좌표로 부드럽게 이동
  flyTo(lat, lon, height = 5000) {
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
      duration: 2,
    });
  }

  // 현재 시점 초기화 (예: 한반도 전체 보기)
  viewHome() {
    this.flyTo(36.5, 127.5, 1000000);
  }
}