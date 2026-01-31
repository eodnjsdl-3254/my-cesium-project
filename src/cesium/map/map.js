import * as Cesium from "cesium";
import { CameraManager } from "../managers/camera";
import { DataManager } from "../managers/data";
import { VWorldManager } from "../managers/vworld";
import { GreeneryManager } from "../managers/greenery";

export class Map3D {
  constructor(viewer, onMapClick, onBuildingClick, onSimulationSelect) {
    if (!viewer) throw new Error("Viewer 인스턴스가 없습니다.");
    this.viewer = viewer;

    // UI 콜백
    this.onMapClick = onMapClick;
    this.onBuildingClick = onBuildingClick;
    this.onSimulationSelect = onSimulationSelect;

    // 상태 변수
    this.handler = null;
    this.isMarkerMode = false;
    this.isTrackingEnabled = false;

    // 시뮬레이션 상태
    this.isPlacementMode = false;
    this.placementOptions = null;
    this.pendingModelFile = null; // 업로드 대기 중인 파일
    this.selectedEntity = null;   // 선택된 건물 (하이라이트용)
    this.relocatingId = null;     // 재배치 중인 건물 ID

    // 🚀 렌더링 최적화 설정
    this.viewer.scene.requestRenderMode = true;
    this.viewer.scene.maximumRenderTimeChange = Infinity;

    // 초기화
    this.viewer.imageryLayers.removeAll();
    this.viewer.scene.primitives.removeAll();

    // 지형 로드
    this.setupTerrain();

    // 매니저 초기화
    this.camera = new CameraManager(viewer);
    this.data = new DataManager(viewer);
    this.vworld = new VWorldManager(viewer);

    // 건물 및 레이어 변수
    this.baseImageryLayer = null;
    this.osmBuildings = null;
    this.vworldBuildings = null;
    this.googleBuildings = null;

    // 녹지 모드 상태 플래그
    this.greenery = new GreeneryManager(viewer);
    this.isGreeneryMode = false;

    // 초기 실행
    this.changeBaseMap("OSM");
    this.setupEventListeners();

    console.log("🏗️ [Map3D] 모든 기능 초기화 완료");
  }

  // 외부(UI)에서 녹지 모드를 켜고 끌 수 있는 메서드
  setGreeneryMode(enabled) {
    this.isGreeneryMode = enabled;
    // 녹지 모드가 켜지면 기존 선택된 건물 하이라이트 끄기
    if (enabled) {
      this.highlightBuilding(null);
      this.viewer.selectedEntity = undefined;
    }
  }

  // 지형 설정
  async setupTerrain() {
    try {
      this.viewer.terrainProvider = await Cesium.CesiumTerrainProvider.fromUrl(
        Cesium.IonResource.fromAssetId(1)
      );
    } catch (e) {
      console.log("지형 로드 실패, 기본 타원체 사용");
    }
  }

  // 소멸자
  destroy() {
    if (this.handler) {
      this.handler.destroy();
      this.handler = null;
    }
  }

  // ---------------------------------------------------------------
  // 🗺️ [1] 베이스맵 및 V-World 기능
  // ---------------------------------------------------------------
  async changeBaseMap(type) {
    if (this.baseImageryLayer) {
      this.viewer.imageryLayers.remove(this.baseImageryLayer);
      this.baseImageryLayer = null;
    }

    let provider = null;
    try {
      switch (type) {
        case "OSM":
          provider = new Cesium.OpenStreetMapImageryProvider({
            url: "https://a.tile.openstreetmap.org/",
            maximumLevel: 19,
            fileExtension: "png",
          });
          break;
        case "SATELLITE":
          provider = await Cesium.IonImageryProvider.fromAssetId(2);
          break;
        case "NONE":
          this.viewer.scene.globe.baseColor = new Cesium.Color(0.1, 0.1, 0.1, 1);
          this.viewer.scene.requestRender();
          return;
      }
      if (provider) {
        this.baseImageryLayer = this.viewer.imageryLayers.addImageryProvider(
          provider,
          0
        );
      }
    } catch (error) {
      console.error(error);
    }
    this.viewer.scene.requestRender();
  }

  toggleVworldImagery(visible, layerType) {
    this.vworld.toggleImagery(visible, layerType);
    this.viewer.scene.requestRender();
  }

  // ---------------------------------------------------------------
  // 🏢 [2] 건물 모드 (OSM, V-World, Google)
  // ---------------------------------------------------------------
  async setBuildingMode(mode) {
    console.log(`🏗️ 건물 모드 변경: ${mode}`);

    // 기존 건물들 숨기기
    if (this.osmBuildings) this.osmBuildings.show = false;
    if (this.googleBuildings) this.googleBuildings.show = false;
    this.vworld.hideBuildings();

    this.viewer.scene.globe.show = true;

    switch (mode) {
      case "OSM":
        await this.loadOsmBuildings();
        if (this.osmBuildings) {
          this.osmBuildings.show = true;
          this.styleOsmBuildings("DEFAULT");
        }
        break;

      case "VWORLD":
        try {
          await this.vworld.loadBuildings();
          console.log("🇰🇷 V-World 실사 모드 활성화");
        } catch (e) {
          alert("V-World 3D 로드 실패. OSM 모드로 전환합니다.");
          this.setBuildingMode("OSM");
        }
        break;

      case "GOOGLE":
        this.viewer.scene.globe.show = false; // 구글은 자체 지형 사용
        this.viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
        await this.loadGoogleBuildings();
        if (this.googleBuildings) this.googleBuildings.show = true;
        break;
    }
    this.viewer.scene.requestRender();
  }

  async loadOsmBuildings() {
    if (!this.osmBuildings) {
      try {
        this.osmBuildings = await Cesium.createOsmBuildingsAsync();
        this.viewer.scene.primitives.add(this.osmBuildings);
      } catch (e) {
        console.error(e);
      }
    }
  }

  async loadGoogleBuildings() {
    if (!this.googleBuildings) {
      try {
        this.googleBuildings = await Cesium.Cesium3DTileset.fromIonAssetId(2275207);
        this.googleBuildings.maximumScreenSpaceError = 16;
        this.viewer.scene.primitives.add(this.googleBuildings);
      } catch (e) {}
    }
  }

  styleOsmBuildings(styleMode) {
    if (!this.osmBuildings) return;
    if (styleMode === "HEIGHT") {
      this.osmBuildings.style = new Cesium.Cesium3DTileStyle({
        color: {
          conditions: [
            ["${feature['element:height']} === undefined", "color('white', 0.5)"],
            ["${feature['element:height']} > 100", "color('purple', 0.8)"],
            ["${feature['element:height']} > 50", "color('red', 0.8)"],
            ["${feature['element:height']} > 20", "color('orange', 0.8)"],
            ["true", "color('cornflowerblue', 0.8)"],
          ],
        },
      });
    } else {
      this.osmBuildings.style = new Cesium.Cesium3DTileStyle({
        color: "color('white', 1.0)",
      });
    }
    this.viewer.scene.requestRender();
  }

  // ---------------------------------------------------------------
  // 📍 [3] 마커 및 유틸
  // ---------------------------------------------------------------
  setMarkerMode(enabled) {
    this.isMarkerMode = enabled;
  }
  setTrackingMode(enabled) {
    this.isTrackingEnabled = enabled;
    if (!enabled) this.viewer.trackedEntity = undefined;
  }
  focusLocation(lat, lon, name) {
    this.data.addMarker(lat, lon, Date.now().toString(), name);
    this.camera.flyTo(lat, lon, 1500);
  }

  // ---------------------------------------------------------------
  // 🛠️ [4] 시뮬레이션 기능 (최적화 + 재배치 + 하이라이트)
  // ---------------------------------------------------------------

  // 배치 모드 시작
  startBuildingPlacement(width, depth, height, rotation) {
    this.isPlacementMode = true;
    this.placementOptions = { width, depth, height, rotation };
    this.viewer.canvas.style.cursor = "crosshair";
    this.highlightBuilding(null);
  }

  // 모델 배치 모드 시작
  startModelPlacement(file) {
    this.pendingModelFile = file;
    this.viewer.canvas.style.cursor = "copy";
    this.highlightBuilding(null);
    console.log("📂 모델 배치 모드: 위치를 클릭하세요.");
  }

  // 재배치 모드 시작
  startRelocation(entityId) {
    this.relocatingId = entityId;
    this.viewer.canvas.style.cursor = "move";
    this.highlightBuilding(null);
  }

  // 건물 생성 (즉시 렌더링 최적화)
  async createProceduralBuilding(lat, lon, width, depth, height, rotation = 0) {
    const valWidth = parseFloat(width) || 10;
    const valDepth = parseFloat(depth) || 10;
    const valHeight = parseFloat(height) || 10;
    const valRotation = parseFloat(rotation) || 0;
    const valLat = parseFloat(lat);
    const valLon = parseFloat(lon);

    // 1. 임시 높이로 즉시 생성
    const cartographic = Cesium.Cartographic.fromDegrees(valLon, valLat);
    let currentHeight = this.viewer.scene.globe.getHeight(cartographic) || 0;

    let position = Cesium.Cartesian3.fromDegrees(
      valLon,
      valLat,
      currentHeight + valHeight / 2
    );
    const heading = Cesium.Math.toRadians(valRotation);
    const hpr = new Cesium.HeadingPitchRoll(heading, 0, 0);
    let orientation = Cesium.Transforms.headingPitchRollQuaternion(
      position,
      hpr
    );

    const buildingEntity = this.viewer.entities.add({
      name: "SIMULATION_BUILDING",
      position: position,
      orientation: orientation,
      box: {
        dimensions: new Cesium.Cartesian3(valWidth, valDepth, valHeight),
        material: Cesium.Color.WHITE.withAlpha(0.6), // 로딩 중 반투명
        outline: true,
        outlineColor: Cesium.Color.BLACK,
        shadows: Cesium.ShadowMode.DISABLED,
      },
      properties: {
        isSimulation: true,
        width: valWidth,
        depth: valDepth,
        height: valHeight,
        rotation: valRotation,
        lat: valLat,
        lon: valLon,
      },
    });

    this.viewer.scene.requestRender();

    // 2. 정밀 높이 보정
    if (this.viewer.terrainProvider) {
      try {
        const updated = await Cesium.sampleTerrainMostDetailed(
          this.viewer.terrainProvider,
          [cartographic]
        );
        const preciseHeight = updated[0].height || currentHeight;

        const finalHeight = preciseHeight + valHeight / 2;
        const newPos = Cesium.Cartesian3.fromDegrees(
          valLon,
          valLat,
          finalHeight
        );
        const newOri = Cesium.Transforms.headingPitchRollQuaternion(
          newPos,
          hpr
        );

        buildingEntity.position = newPos;
        buildingEntity.orientation = newOri;
        buildingEntity.box.material = Cesium.Color.WHITE.withAlpha(0.9);

        this.viewer.scene.requestRender();
      } catch (e) {}
    }
    return buildingEntity;
  }

  // 3D 모델 로드 (즉시 리턴)
  loadUser3DModel(file, lat, lon) {
    const fileUrl = URL.createObjectURL(file);
    const position = Cesium.Cartesian3.fromDegrees(
      parseFloat(lon),
      parseFloat(lat),
      0
    );
    const heading = Cesium.Math.toRadians(0);
    const hpr = new Cesium.HeadingPitchRoll(heading, 0, 0);
    const orientation = Cesium.Transforms.headingPitchRollQuaternion(
      position,
      hpr
    );

    const modelEntity = this.viewer.entities.add({
      name: "SIMULATION_BUILDING",
      position: position,
      orientation: orientation,
      model: {
        uri: fileUrl,
        scale: 1.0,
        minimumPixelSize: 64,
        maximumScale: 20000,
        runAnimations: true,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
      properties: {
        isSimulation: true,
        isModel: true,
        scale: 1.0,
        height: 0,
        rotation: 0,
        lat: parseFloat(lat),
        lon: parseFloat(lon),
      },
    });

    this.viewer.scene.requestRender();
    return modelEntity;
  }

  // 건물 업데이트 (박스 & 모델 공용)
  updateBuilding(entityId, newProps) {
    const entity = this.viewer.entities.getById(entityId);
    if (!entity) return;

    // A. 박스(Box)인 경우 치수 변경
    if (entity.box && newProps.width) {
      entity.box.dimensions = new Cesium.Cartesian3(
        parseFloat(newProps.width),
        parseFloat(newProps.depth),
        parseFloat(newProps.height)
      );
      entity.properties.width = newProps.width;
      entity.properties.depth = newProps.depth;
      entity.properties.height = newProps.height;
    }

    // B. 모델(Model)인 경우 스케일 변경
    if (entity.model && newProps.scale) {
      entity.model.scale = parseFloat(newProps.scale);
      entity.properties.scale = newProps.scale;
    }

    // C. 공통: 회전 변경
    if (newProps.rotation !== undefined) {
      const pos = entity.position.getValue(Cesium.JulianDate.now());
      const heading = Cesium.Math.toRadians(parseFloat(newProps.rotation));
      const hpr = new Cesium.HeadingPitchRoll(heading, 0, 0);
      entity.orientation = Cesium.Transforms.headingPitchRollQuaternion(
        pos,
        hpr
      );
      entity.properties.rotation = newProps.rotation;
    }

    this.viewer.scene.requestRender();
  }

  // 건물 삭제
  removeBuilding(entityId) {
    const entity = this.viewer.entities.getById(entityId);

    if (entity) {
      this.viewer.entities.remove(entity);

      if (this.selectedEntity === entity) {
        this.selectedEntity = null;
      }

      this.viewer.scene.requestRender();
      console.log("🗑️ 건물 삭제 완료:", entityId);
      return true;
    }
    return false;
  }

  // 하이라이트
  highlightBuilding(entity) {
    // 기존 선택 해제
    if (this.selectedEntity && this.selectedEntity !== entity) {
      // 박스인 경우만 색상 복구 (모델은 색상 변경 불가 또는 복잡함)
      if (this.selectedEntity.box) {
        this.selectedEntity.box.material = Cesium.Color.WHITE.withAlpha(0.9);
      } else if (this.selectedEntity.model) {
        this.selectedEntity.model.color = Cesium.Color.WHITE; // 원래 색상
      }
    }

    // 새 선택 하이라이트
    if (entity) {
      this.selectedEntity = entity;
      if (entity.box) {
        entity.box.material = Cesium.Color.YELLOW.withAlpha(0.9);
      } else if (entity.model) {
        entity.model.color = Cesium.Color.YELLOW; // 모델 색상 틴트
      }
    } else {
      this.selectedEntity = null;
    }
    this.viewer.scene.requestRender();
  }

  // 엔티티 선택 및 UI 이벤트 발생 (헬퍼 함수)
  selectAndTriggerEdit(entity) {
    this.highlightBuilding(entity);
    if (this.onSimulationSelect) {
      const isModel = entity.properties.isModel ? true : false;

      this.onSimulationSelect({
        id: entity.id,
        isModel: isModel,
        width: isModel ? 0 : entity.properties.width.getValue(),
        depth: isModel ? 0 : entity.properties.depth.getValue(),
        height: isModel ? 0 : entity.properties.height.getValue(),
        scale: isModel ? entity.properties.scale.getValue() : 1.0,
        rotation: entity.properties.rotation.getValue(),
      });
    }
  }

  // ---------------------------------------------------------------
  // 🖱️ [5] 이벤트 리스너 (통합)
  // ---------------------------------------------------------------
  setupEventListeners() {
    this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

    this.handler.setInputAction((click) => {
      if (this.isGreeneryMode) {
        return; 
      }

      let cartesian = this.viewer.scene.pickPosition(click.position);
      if (!Cesium.defined(cartesian)) {
        cartesian = this.viewer.camera.pickEllipsoid(click.position);
      }

      let lat, lon;
      if (Cesium.defined(cartesian)) {
        const c = Cesium.Cartographic.fromCartesian(cartesian);
        lon = Cesium.Math.toDegrees(c.longitude);
        lat = Cesium.Math.toDegrees(c.latitude);

        // A. [박스 배치 모드]
        if (this.isPlacementMode && this.placementOptions) {
          const entity = this.createProceduralBuilding(
            lat,
            lon,
            this.placementOptions.width,
            this.placementOptions.depth,
            this.placementOptions.height,
            this.placementOptions.rotation
          );

          this.isPlacementMode = false;
          this.placementOptions = null;
          this.viewer.canvas.style.cursor = "default";

          // 생성 즉시 선택 (편집 모드 진입)
          this.selectAndTriggerEdit(entity);
          return;
        }

        // B. [모델 배치 모드]
        if (this.pendingModelFile) {
          const entity = this.loadUser3DModel(this.pendingModelFile, lat, lon);

          this.pendingModelFile = null;
          this.viewer.canvas.style.cursor = "default";

          // 생성 즉시 선택 (편집 모드 진입)
          this.selectAndTriggerEdit(entity);
          return;
        }

        // C. [재배치 모드]
        if (this.relocatingId) {
          const entity = this.viewer.entities.getById(this.relocatingId);
          if (entity) {
            // 모델이냐 박스냐에 따라 다르게 처리
            if (entity.properties.isModel) {
              // 모델: 위치만 업데이트
              const position = Cesium.Cartesian3.fromDegrees(lon, lat, 0);
              entity.position = position;

              // 회전 유지
              const heading = Cesium.Math.toRadians(
                entity.properties.rotation.getValue()
              );
              const hpr = new Cesium.HeadingPitchRoll(heading, 0, 0);
              entity.orientation = Cesium.Transforms.headingPitchRollQuaternion(
                position,
                hpr
              );

              // 좌표 속성 갱신
              entity.properties.lat = lat;
              entity.properties.lon = lon;
            } else {
              // 박스: 기존 삭제 후 재생성 (높이 계산 때문)
              const newEntity = this.createProceduralBuilding(
                lat,
                lon,
                entity.properties.width.getValue(),
                entity.properties.depth.getValue(),
                entity.properties.height.getValue(),
                entity.properties.rotation.getValue()
              );
              this.viewer.entities.remove(entity);
              this.selectAndTriggerEdit(newEntity); // 재배치 후에도 선택 유지
              this.relocatingId = null;
              this.viewer.canvas.style.cursor = "default";
              return;
            }
          }
          this.relocatingId = null;
          this.viewer.canvas.style.cursor = "default";

          // 모델 이동 후에도 선택 유지
          if (entity) this.selectAndTriggerEdit(entity);
          return;
        }
      }

      // D. [선택 모드] (시뮬레이션 건물 클릭)
      const picked = this.viewer.scene.pick(click.position);
      if (
        Cesium.defined(picked) &&
        picked.id &&
        picked.id.name === "SIMULATION_BUILDING"
      ) {
        this.selectAndTriggerEdit(picked.id);
        return;
      } else {
        // 빈 땅 클릭 시 선택 해제
        this.highlightBuilding(null);
        if (this.onSimulationSelect) this.onSimulationSelect(null);
      }

      // E. [마커 찍기] (마커 모드일 때만)
      if (Cesium.defined(cartesian) && this.isMarkerMode) {
        this.data.addMarker(lat, lon, Date.now().toString(), "사용자 점");
        // 마커 찍은 좌표를 UI에 전달
        if (this.onMapClick) this.onMapClick({ lon, lat });
      } else if (Cesium.defined(cartesian) && this.onMapClick) {
        // 마커 모드가 아니어도 단순히 좌표 확인용으로 콜백 호출
        this.onMapClick({ lon, lat });
      }

      // F. [건물 정보 확인] (OSM 등 외부 건물 클릭 시)
      if (Cesium.defined(picked) && typeof picked.getProperty === "function") {
        const info = {
          name: picked.getProperty("name"),
          height: picked.getProperty("element:height"),
          type: picked.getProperty("building"),
        };
        if (this.onBuildingClick) this.onBuildingClick(info);
      }

      // G. [추적 모드]
      if (this.isTrackingEnabled) {
        if (
          Cesium.defined(picked) &&
          picked.id instanceof Cesium.Entity
        ) {
          this.viewer.trackedEntity = picked.id;
        } else {
          this.viewer.trackedEntity = undefined;
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  // ---------------------------------------------------------------
  // 🌿 [추가] 녹지 시뮬레이션 인터페이스 (Manager 연결)
  // ---------------------------------------------------------------
  
  // 1. 녹지 모드 시작 (그리기 모드 진입)
  startGreenerySimulation(onDrawFinishCallback) {
    this.setGreeneryMode(true);
    // 매니저에게 그리기 권한 위임
    this.greenery.startDrawing(onDrawFinishCallback);
    console.log("🌿 녹지 시뮬레이션 시작");
  }

  // 2. 나무 심기 명령
  plantTrees(count) {
    this.greenery.plantTrees(count);
  }

  // 3. 녹지 모드 종료 (초기화)
  stopGreenerySimulation() {
    this.setGreeneryMode(false);
    this.greenery.reset();
    console.log("🌿 녹지 시뮬레이션 종료");
  }
}