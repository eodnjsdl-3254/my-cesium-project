import { CameraManager } from "../managers/camera"
import { DataManager } from "../managers/data"

export class Map3D {
  constructor(viewer) {
    if (!viewer) throw new Error("Viewer 인스턴스가 없습니다.");
    this.viewer = viewer;
    this.camera = new CameraManager(viewer);
    this.data = new DataManager(viewer);
    console.log("🏗️ [Map3D] 매니저들 초기화 완료");
  }

  // UI에서 호출하는 이름과 똑같은 함수가 있어야 합니다!
  focusLocation(lat, lon, name) {
    console.log("📍 focusLocation 실행됨:", lat, lon, name);
    this.camera.flyTo(lat, lon, 2000); // CameraManager의 flyTo 호출
    this.data.addMarker(lat, lon, Date.now().toString(), name); // DataManager의 addMarker 호출
  }
}