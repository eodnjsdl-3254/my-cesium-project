import * as Cesium from "cesium"
import { CameraManager } from "../managers/camera"
import { DataManager } from "../managers/data"

export class Map3D {
  constructor(viewer, onMapClick) {
    if (!viewer) throw new Error("Viewer 인스턴스가 없습니다.");
    this.viewer = viewer;
    this.onMapClick = onMapClick;

    // 1. 초기화 시 모든 레이어/프라이머티브 제거 (유령 데이터 방지)
    this.viewer.imageryLayers.removeAll();
    this.viewer.scene.primitives.removeAll();

    this.baseImageryLayer = null;
    this.vworldImagery = null;
    this.osmBuildings = null;

    // 지형(Terrain) 활성화
    this.viewer.scene.globe.depthTestAgainstTerrain = true;

    // 매니저 초기화
    this.camera = new CameraManager(viewer);
    this.data = new DataManager(viewer);
    this.isTrackingEnabled = false;

    // 2. 초기 베이스맵 설정 (OSM)
    this.changeBaseMap("OSM");
    
    this.setupEventListeners();
    console.log("🏗️ [Map3D] 초기화 완료");
  }

  // 베이스맵 변경
  changeBaseMap(type) {
    if (this.baseImageryLayer) {
      this.viewer.imageryLayers.remove(this.baseImageryLayer);
      this.baseImageryLayer = null;
    }

    let provider = null;
    switch (type) {
      case "OSM":
        provider = new Cesium.OpenStreetMapImageryProvider({
          url: "https://a.tile.openstreetmap.org/"
        });
        break;
      case "SATELLITE":
        // [안정성] UrlTemplate 사용 (메타데이터 통신 에러 방지)
        provider = new Cesium.UrlTemplateImageryProvider({
          url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          maximumLevel: 19,
          credit: "Esri"
        });
        break;
      case "NONE":
        this.viewer.scene.globe.baseColor = new Cesium.Color(0.1, 0.1, 0.1, 1);
        return; 
    }

    if (provider) {
      this.baseImageryLayer = this.viewer.imageryLayers.addImageryProvider(provider, 0);
    }
  }

  // V-world 2D 토글 (에러 방지 레벨 조정)
  toggleVworldImagery(visible, layerType = "Base") {
    const vworldKey = "37B44C3A-8C01-30CE-806E-7D89E87B8473"; 
    
    if (this.vworldImagery) {
      this.viewer.imageryLayers.remove(this.vworldImagery);
      this.vworldImagery = null;
    }

    if (visible) {
      // 🚩 [수정] Midnight/Hybrid는 데이터가 없는 구간이 많으므로 최소 레벨을 8로 상향
      const minLevel = (layerType === "Midnight" || layerType === "Hybrid") ? 8 : 6;
      const ext = layerType === "Satellite" ? "jpeg" : "png";
      
      this.vworldImagery = this.viewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: `/vworld-bin/req/wmts/1.0.0/${vworldKey}/${layerType}/{z}/{y}/{x}.${ext}`,
          minimumLevel: minLevel,
          maximumLevel: 19,
          credit: `V-world ${layerType}`
        })
      );
      this.vworldImagery.show = true;
    }
  }

  // 3D 건물 토글
  async toggleVworldBuildings(visible) {
    // 이미 로드된 적이 없다면 로드 시도
    if (!this.osmBuildings && visible) {
      try {
        this.osmBuildings = await Cesium.createOsmBuildingsAsync();
        this.viewer.scene.primitives.add(this.osmBuildings);
        // 🚩 [중요] 초기 로드 시 일단 숨김 처리 (UI 상태와 동기화 위해)
        this.osmBuildings.show = false; 
        console.log("🏢 3D 건물 데이터 로드 완료");
      } catch (e) {
        console.error("❌ 건물 로드 실패:", e);
        return;
      }
    }

    // 로드된 객체가 있을 때만 show 속성 제어
    if (this.osmBuildings) {
      this.osmBuildings.show = visible;
    }
  }

  // 3D 건물 스타일 (높이 정보 없는 경우 예외 처리)
  styleOsmBuildings(styleMode) {
    if (!this.osmBuildings) return;

    if (styleMode === "HEIGHT") {
      this.osmBuildings.style = new Cesium.Cesium3DTileStyle({
        color: {
          conditions: [
            // 1. 높이 데이터가 없거나(undefined) null인 경우 흰색 처리 (에러 방지)
            ["${feature['element:height']} === undefined", "color('white', 0.5)"], 
            ["${feature['element:height']} === null", "color('white', 0.5)"],
            
            // 2. 높이가 있는 경우 색상 적용 (높음: 보라 -> 낮음: 파랑)
            ["${feature['element:height']} > 100", "color('purple', 0.8)"],
            ["${feature['element:height']} > 50", "color('red', 0.8)"],
            ["${feature['element:height']} > 20", "color('orange', 0.8)"],
            ["true", "color('cornflowerblue', 0.8)"] // 그 외 나머지
          ]
        }
      });
    } else {
      this.osmBuildings.style = undefined; // 기본 스타일 복구
    }
  }
  
  setupEventListeners() {
    const handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
    handler.setInputAction((click) => {
      const pickedObject = this.viewer.scene.pick(click.position);
      let cartesian = this.viewer.scene.pickPosition(click.position);
      
      if (!Cesium.defined(cartesian)) {
        cartesian = this.viewer.camera.pickEllipsoid(click.position);
      }

      if (Cesium.defined(cartesian)) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const lon = Cesium.Math.toDegrees(cartographic.longitude);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);
        if (this.onMapClick) this.onMapClick({ lon, lat });
      }

      if (Cesium.defined(pickedObject) && pickedObject.id instanceof Cesium.Entity) {
        if (this.isTrackingEnabled) this.viewer.trackedEntity = pickedObject.id;
      } else {
        this.viewer.trackedEntity = undefined;
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK); 
  }

  setTrackingMode(enabled) {
    this.isTrackingEnabled = enabled;
    if (!enabled) this.data.clearTracking();
  }

  focusLocation(lat, lon, name) {
    const entity = this.data.addMarker(lat, lon, Date.now().toString(), name);
    this.camera.flyTo(lat, lon, 1200);
    if (this.isTrackingEnabled) this.data.setTracking(entity);
  }
}