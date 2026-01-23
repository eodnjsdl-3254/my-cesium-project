import * as Cesium from "cesium"
import { CameraManager } from "../managers/camera"
import { DataManager } from "../managers/data"
import { VWorldManager } from "../managers/vworld"

export class Map3D {
  constructor(viewer, onMapClick, onBuildingClick) {
    if (!viewer) throw new Error("Viewer 인스턴스가 없습니다.");
    this.viewer = viewer;
    this.onMapClick = onMapClick;
    this.onBuildingClick = onBuildingClick;
    this.isMarkerMode = false;
    this.isTrackingEnabled = false;

    // 초기화: 모든 레이어/프라이머티브 제거
    this.viewer.imageryLayers.removeAll();
    this.viewer.scene.primitives.removeAll();

    // 지형 설정 (V-World 사용 시 기본 지형 필요)
    this.setupTerrain();

    this.baseImageryLayer = null;
    this.vworldImagery = null;
    this.osmBuildings = null;
    this.vworldBuildings = null; // V-World 3D 건물 저장용
    this.googleBuildings = null;

    // 지형 심도 테스트 활성화
    this.viewer.scene.globe.depthTestAgainstTerrain = true;

    // 매니저 초기화
    this.camera = new CameraManager(viewer);
    this.data = new DataManager(viewer);
    this.vworld = new VWorldManager(viewer);

    // 초기 베이스맵 설정
    this.changeBaseMap("OSM");
    this.setupEventListeners();

    console.log("🏗️ [Map3D] 초기화 완료");
  }

  // 지형 데이터 설정
  async setupTerrain() {
    try {
      this.viewer.terrainProvider = await Cesium.CesiumTerrainProvider.fromUrl(
        Cesium.IonResource.fromAssetId(1)
      );
    } catch (e) {
      console.log("지형 로드 실패, 기본 구체 사용");
    }
  }

  // 건물 모드 통합 관리 함수 (OSM vs V-World)
  async setBuildingMode(mode) {
    console.log(`🏗️ 건물 모드 변경: ${mode}`);

    // 1. 일단 다 끄기
    if (this.osmBuildings) this.osmBuildings.show = false;
    if (this.googleBuildings) this.googleBuildings.show = false;
    this.vworld.hideBuildings(); // 매니저에게 끄라고 명령

    // 기본 지형 복구
    this.viewer.scene.globe.show = true;
    if (!(this.viewer.terrainProvider instanceof Cesium.CesiumTerrainProvider)) {
       await this.setupTerrain();
    }

    switch (mode) {
      case "OSM":
        await this.loadOsmBuildings();
        if (this.osmBuildings) {
            this.osmBuildings.show = true;
            this.styleOsmBuildings("DEFAULT");
        }
        break;

      case "VWORLD":
        // 매니저에게 3D 로드 명령
        try {
          await this.vworld.loadBuildings();
          console.log("🇰🇷 V-World 실사 모드 (3D 건물) 활성화");
        } catch (e) {
          // 실패 시 OSM으로 대체하는 똑똑한 로직
          alert("V-World 3D 로드 실패 (보안 정책). OSM 모드로 전환합니다.");
          this.setBuildingMode("OSM"); 
          if (this.osmBuildings) this.osmBuildings.show = true;
        }
        break;

      case "GOOGLE":
        this.viewer.scene.globe.show = false;
        this.viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
        await this.loadGoogleBuildings();
        if (this.googleBuildings) this.googleBuildings.show = true;
        break;
    }
    this.viewer.scene.requestRender();
  }

  // 📦 OSM 로드
  async loadOsmBuildings() {
    if (!this.osmBuildings) {
      try {
        this.osmBuildings = await Cesium.createOsmBuildingsAsync();
        this.viewer.scene.primitives.add(this.osmBuildings);
        this.styleOsmBuildings("DEFAULT");

      } catch (e) { console.error(e); }
    }
  }

  // 📦 V-World 로드
  async loadVworldBuildings() {
    if (!this.vworldBuildings) {
      try {
        console.log("🇰🇷 V-World 3D 로드 시도 (XDWorld)...");
        
        this.vworldBuildings = await Cesium.Cesium3DTileset.fromUrl(
          `/vworld-3d/3d-data/tileset.json` // 가상의 표준 경로
        );
        
        this.viewer.scene.primitives.add(this.vworldBuildings);
        
        // 높이 보정
        //const heightOffset = -30; 
        this.vworldBuildings.style = new Cesium.Cesium3DTileStyle({ show: true });
        console.log("🏢 V-World 3D 로드 성공");
        
      } catch (e) {
        console.error("❌ V-World 3D 로드 실패 (지원하지 않는 형식):", e);
        alert("V-World 3D 로드 실패: V-World는 현재 2D(WMTS)만 안정적으로 지원하며, 3D Tileset(JSON) 직접 호출은 제한될 수 있습니다.");
      }
    }
  }

  // 📦 구글 로드
  async loadGoogleBuildings() {
    if (!this.googleBuildings) {
      try {
        this.googleBuildings = await Cesium.Cesium3DTileset.fromIonAssetId(2275207);
        this.googleBuildings.maximumScreenSpaceError = 16;
        this.viewer.scene.primitives.add(this.googleBuildings);
        
        // 카메라 45도 기울이기 (입체감)
        const currentPos = this.viewer.camera.positionCartographic;
        this.viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromRadians(currentPos.longitude, currentPos.latitude, currentPos.height),
          orientation: { heading: this.viewer.camera.heading, pitch: Cesium.Math.toRadians(-45), roll: 0.0 }
        });
        console.log("🏙️ 구글 3D 로드 성공");
      } catch (e) { console.error("❌ 구글 로드 실패:", e); }
    }
  }

  // 🎨 OSM 건물 높이별 색상 적용
  styleOsmBuildings(styleMode) {
    if (!this.osmBuildings) return;

    if (styleMode === "HEIGHT") {
      this.osmBuildings.style = new Cesium.Cesium3DTileStyle({
        color: {
          conditions: [
            // 0.5라고 적힌 부분이 투명도입니다. (0.5 = 반투명)
            ["${feature['element:height']} === undefined", "color('white', 0.5)"],
            ["${feature['element:height']} === null", "color('white', 0.5)"],
            
            // 높이별 색상 (뒤에 0.8은 80% 불투명)
            ["${feature['element:height']} > 100", "color('purple', 0.8)"],
            ["${feature['element:height']} > 50", "color('red', 0.8)"],
            ["${feature['element:height']} > 20", "color('orange', 0.8)"],
            ["true", "color('cornflowerblue', 0.8)"]
          ]
        }
      });
    } else {
      this.osmBuildings.style = new Cesium.Cesium3DTileStyle({
        color: "color('white', 1.0)" 
      });
    }
    this.viewer.scene.requestRender();
  }

  // 베이스맵 변경
  async changeBaseMap(type) {
    // 1. 기존 베이스맵 제거
    if (this.baseImageryLayer) {
      this.viewer.imageryLayers.remove(this.baseImageryLayer);
      this.baseImageryLayer = null;
    }

    let provider = null;
    
    try {
      switch (type) {
        case "OSM":
          // OSM 최대 레벨 제한 (20레벨 요청 에러 방지)
          provider = new Cesium.OpenStreetMapImageryProvider({
            url: "https://a.tile.openstreetmap.org/",
            maximumLevel: 19, // 필수 설정
            fileExtension: "png"
          });
          break;

        case "SATELLITE":          
          provider = await Cesium.IonImageryProvider.fromAssetId(2);
          break;

        case "NONE":
          this.viewer.scene.globe.baseColor = new Cesium.Color(0.1, 0.1, 0.1, 1);
          return;
      }

      // 2. 레이어 추가
      if (provider) {
        this.baseImageryLayer = this.viewer.imageryLayers.addImageryProvider(provider, 0);
      }
      
    } catch (error) {
      console.error("❌ 베이스맵 로드 실패:", error);
    }
  }

  // V-World 2D 레이어 토글
  toggleVworldImagery(visible, layerType) {
    this.vworld.toggleImagery(visible, layerType);
  }

  // 마커 모드 설정
  setMarkerMode(enabled) {
    this.isMarkerMode = enabled;
  }

  // 추적 모드 설정
  setTrackingMode(enabled) {
    this.isTrackingEnabled = enabled;
    if (!enabled) this.viewer.trackedEntity = undefined;
  }

  // 위치 이동
  focusLocation(lat, lon, name) {
    const entity = this.data.addMarker(lat, lon, Date.now().toString(), name);
    this.camera.flyTo(lat, lon, 1500); // 고도 살짝 높임
  }

  // 이벤트 리스너
  setupEventListeners() {
    const handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

    handler.setInputAction((click) => {
      const pickedObject = this.viewer.scene.pick(click.position);
      
      // 1. 건물 정보 추출 (OSM용)
      if (Cesium.defined(pickedObject) && typeof pickedObject.getProperty === 'function') {
        const info = {
          id: pickedObject.getProperty('elementId') || "N/A",
          name: pickedObject.getProperty('name') || "정보 없음",
          height: pickedObject.getProperty('element:height'),
          type: pickedObject.getProperty('building')
        };
        if (this.onBuildingClick) this.onBuildingClick(info);
      }

      // 2. 좌표 피킹 및 마커 생성
      let cartesian = this.viewer.scene.pickPosition(click.position);
      if (!Cesium.defined(cartesian)) {
        cartesian = this.viewer.camera.pickEllipsoid(click.position);
      }

      if (Cesium.defined(cartesian)) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const lon = Cesium.Math.toDegrees(cartographic.longitude);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);
        
        if (this.isMarkerMode) {
          this.data.addMarker(lat, lon, Date.now().toString(), "사용자 점");
        }
        if (this.onMapClick) this.onMapClick({ lon, lat });
      }

      // 3. 추적 모드 로직
      if (this.isTrackingEnabled) {
        if (Cesium.defined(pickedObject) && pickedObject.id instanceof Cesium.Entity) {
          this.viewer.trackedEntity = pickedObject.id;
        } else {
          this.viewer.trackedEntity = undefined;
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK); 
  }
}