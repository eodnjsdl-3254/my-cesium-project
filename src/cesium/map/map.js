import * as Cesium from "cesium";
import { CameraManager } from "../managers/camera";
import { DataManager } from "../managers/data";
import { VWorldManager } from "../managers/vworld";
import { GreeneryManager } from "../managers/greenery";
// 🛠️ [중요] GLB 파서 임포트 (경로 확인 필수)
import { extractGlbFullDetails } from "../glb/glbParser"; 

/**
 * 🎞️ [Helper] 프레임 기반 렌더링 보장 (Promise)
 * GPU에 모델이 업로드되는 찰나의 시간 동안 렌더링을 유지시킵니다.
 */
const ensureRender = (scene, frameCount = 5) => {
  return new Promise((resolve) => {
    let count = 0;
    const renderLoop = () => {
      scene.requestRender(); // 렌더링 요청
      count++;
      if (count < frameCount) {
        requestAnimationFrame(renderLoop); // 다음 프레임에 또 요청
      } else {
        resolve(); // 지정된 프레임만큼 그렸으면 완료
      }
    };
    requestAnimationFrame(renderLoop);
  });
};

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
    this.pendingModelFile = null;    // 로컬 파일 업로드 대기
    this.pendingLibraryModel = null; // DB 라이브러리 모델 대기
    
    this.selectedEntity = null;      // 선택된 건물 (하이라이트용)
    this.relocatingId = null;        // 재배치 중인 건물 ID

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
    this.greenery = new GreeneryManager(viewer);
    this.isGreeneryMode = false;

    // 건물 및 레이어 변수
    this.baseImageryLayer = null;
    this.osmBuildings = null;
    this.vworldBuildings = null;
    this.googleBuildings = null;

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

  // [박스 생성] (즉시 렌더링 최적화)
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

  // [로컬 파일 모델 로드]
  async loadUser3DModel(file, lat, lon) {
    if (!this.viewer || !this.viewer.entities) {
      console.error("Cesium Viewer가 준비되지 않았습니다.");
      return null;
    }

    const fileUrl = URL.createObjectURL(file);
    
    // 1. GLB 분석 수행 (비동기)
    console.log("🔍 GLB 분석 시작...");
    // 🛠️ [중요] 수정된 함수 이름 사용
    const analysis = await extractGlbFullDetails(file);
    
    // 2. 데이터 정제 (데이터가 0이거나 없을 경우 기본값 10m 설정)
    const rawGeo = analysis?.geometry || {};
    const meta = analysis?.metaData || {};

    const safeWidth = (rawGeo.width && rawGeo.width > 0.1) ? rawGeo.width : 10.0;
    const safeDepth = (rawGeo.depth && rawGeo.depth > 0.1) ? rawGeo.depth : 10.0;
    const safeHeight = (rawGeo.height && rawGeo.height > 0.1) ? rawGeo.height : 10.0;
    // 🚨 [추가] 비균등 스케일링을 위해 루트 노드 이름이 반드시 필요함
    const rootNodeName = rawGeo.rootNodeName || "Node_0";

    console.log(`📏 추출된 크기: W=${safeWidth}, D=${safeDepth}, H=${safeHeight}, Node=${rootNodeName}`);

    const position = Cesium.Cartesian3.fromDegrees(parseFloat(lon), parseFloat(lat), 0);
    const heading = Cesium.Math.toRadians(0);
    const orientation = Cesium.Transforms.headingPitchRollQuaternion(
      position, new Cesium.HeadingPitchRoll(heading, 0, 0)
    );

    // 3. 엔티티 생성
    const modelEntity = this.viewer.entities.add({
      name: "SIMULATION_BUILDING",
      position: position,
      orientation: orientation,
      model: {
        uri: fileUrl,
        scale: 1.0, 
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
      properties: {
        isSimulation: true,
        isModel: true,
        scale: 1.0,
        rotation: 0,
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        originalWidth: safeWidth,
        originalDepth: safeDepth,
        originalHeight: safeHeight,
        width: safeWidth, 
        depth: safeDepth, 
        height: safeHeight,
        rootNodeName: rootNodeName, // 변형 대상 노드 저장
        ...meta
      },
    });

    console.log("⏳ 모델 GPU 업로드 대기 및 렌더링 요청...");
    // 🚀 [핵심] Promise 기반 프레임 요청으로 렌더링 보장
    await ensureRender(this.viewer.scene, 10);

    console.log("✅ 모델 렌더링 완료");
    return modelEntity;
  }

  // [DB 라이브러리 모델 로드] (자동 크기 보정 추가)
  async loadLibraryModel(modelData, lat, lon) {
      const { mlid, model_save_file_url } = modelData;
      const fullUrl = `http://localhost/files${model_save_file_url}`;

      console.log("🚀 모델 로드 시도:", fullUrl);

      // 1. GLB 파싱 및 크기 분석
      let realDims = { width: 1.0, depth: 1.0, height: 1.0, rootNodeName: "Node_0" };
      
      try {
          const response = await fetch(fullUrl);
          if (!response.ok) throw new Error("Fetch failed");
          const blob = await response.blob();
          const file = new File([blob], "model.glb");
          const analysis = await extractGlbFullDetails(file);
          
          if (analysis && analysis.geometry) {
              const g = analysis.geometry;
              realDims.width = g.width > 0.01 ? g.width : 1.0;
              realDims.depth = g.depth > 0.01 ? g.depth : 1.0;
              realDims.height = g.height > 0.01 ? g.height : 1.0;
              realDims.rootNodeName = g.rootNodeName || "Node_0";
          }
      } catch (e) {
          console.warn("⚠️ 파싱 실패, 기본값 사용");
      }

      // 🚨 [핵심] 단위 보정 계수 (cm 단위면 100배, dm 단위면 10배)
      // 사용자님 요청대로 일단 10배로 설정합니다. (cm라면 100으로 변경하세요)
      let baseCorrection = 10.0;

      // (옵션) 만약 높이가 1m도 안되면, 이건 무조건 cm 단위라고 보고 100배로 강제할 수도 있습니다.
      // if (realDims.height < 1.0) baseCorrection = 100.0;

      // 2. 위치 및 방향 설정
      // 지형 높이 샘플링 (생략 없이 기존 로직 사용)
      const cartographic = Cesium.Cartographic.fromDegrees(parseFloat(lon), parseFloat(lat));
      let terrainHeight = 0;
      try {
          if (this.viewer.terrainProvider) {
              const updated = await Cesium.sampleTerrainMostDetailed(this.viewer.terrainProvider, [cartographic]);
              terrainHeight = updated[0].height || 0;
          }
      } catch (e) {}

      const position = Cesium.Cartesian3.fromDegrees(parseFloat(lon), parseFloat(lat), terrainHeight);
      const orientation = Cesium.Transforms.headingPitchRollQuaternion(
          position, new Cesium.HeadingPitchRoll(0, 0, 0)
      );

      // 3. 엔티티 생성
      const entity = this.viewer.entities.add({
          name: "SIMULATION_BUILDING",
          position: position,
          orientation: orientation,
          model: {
              uri: fullUrl,
              // 초기 렌더링 시 보정된 크기로 보여줌
              scale: baseCorrection, 
              heightReference: Cesium.HeightReference.NONE, 
              color: Cesium.Color.WHITE, 
              colorBlendMode: Cesium.ColorBlendMode.HIGHLIGHT, 
          },
          properties: {
              isSimulation: true,
              isModel: true,
              mlid: mlid,
              
              // 📌 UI에는 1.0으로 보여줌
              scale: 1.0, 
              rotation: 0,
              lat: lat,
              lon: lon,
              
              // 📌 UI에 표시될 크기는 "보정된(커진) 크기"로 저장
              originalWidth: realDims.width * baseCorrection,
              originalDepth: realDims.depth * baseCorrection,
              originalHeight: realDims.height * baseCorrection,
              
              width: realDims.width * baseCorrection,
              depth: realDims.depth * baseCorrection,
              height: realDims.height * baseCorrection,
              
              rootNodeName: realDims.rootNodeName,
              
              // 📌 [중요] 실제 GLB를 뻥튀기하기 위한 계수 저장
              baseCorrection: baseCorrection 
          }
      });

      this.viewer.flyTo(entity, { duration: 1.0, offset: new Cesium.HeadingPitchRange(0, -0.5, 50) });
      await ensureRender(this.viewer.scene, 10);
      return entity;
  }

  // ---------------------------------------------------------------
  // 🛠️ 건물 업데이트 (박스 비율 문제 해결 및 비균등 스케일 적용)
  // ---------------------------------------------------------------
  // [건물 업데이트] (보정값 적용 + 비균등 스케일 + 박스 처리 통합)
  updateBuilding(entityId, newProps) {
    if (!entityId) return null;
    const entity = this.viewer.entities.getById(entityId);
    if (!entity) return null;

    const time = Cesium.JulianDate.now();
    let finalProps = {};

    // [A] 박스(Box) 업데이트 (비율 고정 해제)
    if (entity.box) {
      const currentDims = entity.box.dimensions.getValue(time) || new Cesium.Cartesian3(10, 10, 10);
      
      // 입력값 그대로 적용 (없으면 현재 값 유지)
      let w = (newProps.width !== undefined) ? parseFloat(newProps.width) : currentDims.x;
      let d = (newProps.depth !== undefined) ? parseFloat(newProps.depth) : currentDims.y;
      let h = (newProps.height !== undefined) ? parseFloat(newProps.height) : currentDims.z;

      // 최소값 방어
      const safeW = Math.max(0.1, w);
      const safeD = Math.max(0.1, d);
      const safeH = Math.max(0.1, h);

      entity.box.dimensions = new Cesium.Cartesian3(safeW, safeD, safeH);
      
      // 속성 동기화
      entity.properties.width = safeW; 
      entity.properties.depth = safeD; 
      entity.properties.height = safeH;

      // 높이가 변했을 때 위치(Z) 보정 (박스 바닥 기준 유지를 위해)
      if (newProps.height !== undefined) {
          const oldHeight = currentDims.z;
          const heightDiff = safeH - oldHeight;
          const currentPos = entity.position.getValue(time);
          if (currentPos) {
              const cartographic = Cesium.Cartographic.fromCartesian(currentPos);
              // 중심점이 바뀌므로 차이의 절반만큼 이동
              cartographic.height += heightDiff / 2;
              entity.position = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, cartographic.height);
          }
      }
      finalProps = { width: safeW, depth: safeD, height: safeH };
    }

    // [B] 모델(GLB) 업데이트 (비균등 스케일 + 보정값 적용)
    if (entity.model) {
      const getVal = (prop, def) => (prop && prop.getValue) ? prop.getValue(time) : (prop || def);
      
      const ow = getVal(entity.properties.originalWidth, 1.0);
      const od = getVal(entity.properties.originalDepth, 1.0);
      const oh = getVal(entity.properties.originalHeight, 1.0);
      const rootNodeName = getVal(entity.properties.rootNodeName, "Node_0");
      
      // 📌 저장된 보정값 가져오기 (없으면 1.0)
      // loadLibraryModel에서 저장한 10.0 또는 100.0 값이 여기 들어옵니다.
      const baseCorrection = getVal(entity.properties.baseCorrection, 1.0);

      let targetW = getVal(entity.properties.width, ow);
      let targetD = getVal(entity.properties.depth, od);
      let targetH = getVal(entity.properties.height, oh);

      // UI 입력값 적용
      if (newProps.width !== undefined) targetW = parseFloat(newProps.width);
      if (newProps.depth !== undefined) targetD = parseFloat(newProps.depth);
      if (newProps.height !== undefined) targetH = parseFloat(newProps.height);

      // 전체 스케일 슬라이더 조작 시 (비율 유지하면서 크기 변경)
      if (newProps.scale !== undefined) {
          const s = parseFloat(newProps.scale);
          // 원본 크기(ow)는 이미 보정된 값이므로, s=1.0이면 원상태 유지
          targetW = ow * s; 
          targetD = od * s; 
          targetH = oh * s;
      }

      // 0 나누기 방지 및 최소값 설정
      targetW = Math.max(0.1, targetW); 
      targetD = Math.max(0.1, targetD); 
      targetH = Math.max(0.1, targetH);

      // 📌 스케일 팩터 계산 (핵심)
      // 공식: (목표크기 / 원본보정크기) * 보정값
      // 예: 원본(10m) -> 목표(20m)라면 비율은 2.0. 여기에 보정값(10)을 곱해 최종 스케일은 20.0이 됨.
      const scaleX = ((ow > 0.01) ? targetW / ow : 1.0) * baseCorrection;
      const scaleY = ((od > 0.01) ? targetD / od : 1.0) * baseCorrection;
      const scaleZ = ((oh > 0.01) ? targetH / oh : 1.0) * baseCorrection;

      // nodeTransformations 생성 및 적용
      // 전체 model.scale은 1.0으로 초기화하고, 내부 노드만 변형합니다.
      entity.model.scale = 1.0; 
      
      const trs = new Cesium.TranslationRotationScale();
      trs.translation = Cesium.Cartesian3.ZERO;
      trs.rotation = Cesium.Quaternion.IDENTITY;
      trs.scale = new Cesium.Cartesian3(scaleX, scaleY, scaleZ);

      const nodeTransformations = {};
      nodeTransformations[rootNodeName] = trs;
      // 노드 이름 불일치 대비 안전장치
      nodeTransformations["Node_0"] = trs; 
      nodeTransformations["Scene"] = trs;
      nodeTransformations["Object_0"] = trs;
      nodeTransformations["MainBuilding"] = trs;

      entity.model.nodeTransformations = nodeTransformations;

      // UI 및 속성 동기화
      entity.properties.width = targetW;
      entity.properties.depth = targetD;
      entity.properties.height = targetH;
      
      // UI에 보여줄 스케일 값 (보정값을 제외한 순수 배율)
      if (newProps.scale !== undefined) {
          entity.properties.scale = parseFloat(newProps.scale);
      } else {
          // 너비 기준으로 역산 (UI 표시용)
          entity.properties.scale = (ow > 0.01) ? targetW / ow : 1.0;
      }

      console.log(`🔧 [GLB 변형] Node="${rootNodeName}", RealScale=(${scaleX.toFixed(2)}, ${scaleY.toFixed(2)}, ${scaleZ.toFixed(2)})`);

      finalProps = { 
          width: targetW, 
          depth: targetD, 
          height: targetH, 
          scale: entity.properties.scale.getValue() 
      };
    }

    // [C] 회전 업데이트
    if (newProps.rotation !== undefined && !isNaN(newProps.rotation)) {
      const pos = entity.position.getValue(time);
      if (pos) {
          const heading = Cesium.Math.toRadians(parseFloat(newProps.rotation));
          const hpr = new Cesium.HeadingPitchRoll(heading, 0, 0);
          entity.orientation = Cesium.Transforms.headingPitchRollQuaternion(pos, hpr);
          entity.properties.rotation = newProps.rotation;
          finalProps.rotation = newProps.rotation;
      }
    }
    
    this.viewer.scene.requestRender();
    return finalProps;
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
      if (this.selectedEntity.box) {
        this.selectedEntity.box.material = Cesium.Color.WHITE.withAlpha(0.9);
      } else if (this.selectedEntity.model) {
        this.selectedEntity.model.color = Cesium.Color.WHITE; 
      }
    }

    // 새 선택 하이라이트
    if (entity) {
      this.selectedEntity = entity;
      if (entity.box) {
        this.selectedEntity.box.material = Cesium.Color.YELLOW.withAlpha(0.9);
      } else if (entity.model) {
        this.selectedEntity.model.color = Cesium.Color.YELLOW; 
      }
    } else {
      this.selectedEntity = null;
    }
    this.viewer.scene.requestRender();
  }

  // ---------------------------------------------------------------
  // 🛠️ 엔티티 선택 및 UI 이벤트 발생 (데이터 전달)
  // ---------------------------------------------------------------
  selectAndTriggerEdit(entity) {
    this.highlightBuilding(entity);
    
    if (this.onSimulationSelect) {
      const props = {};
      if (entity.properties) {
          const names = entity.properties.propertyNames || Object.keys(entity.properties);
          names.forEach(name => {
              const propValue = entity.properties[name];
              if (propValue && typeof propValue.getValue === 'function') {
                  props[name] = propValue.getValue(Cesium.JulianDate.now());
              } else {
                  props[name] = propValue;
              }
          });
      }

      const isModel = props.isModel || false;
      const currentScale = props.scale || 1.0;

      // 원본 크기 데이터 확보
      const oriW = props.originalWidth || props.width || 10;
      const oriD = props.originalDepth || props.depth || 10;
      const oriH = props.originalHeight || props.height || 10;

      // UI로 전달할 페이로드 구성
      const payload = {
        id: entity.id.id || entity.id,
        isModel: isModel,
        
        // 현재 화면에 보이는 크기
        width: (props.width !== undefined) ? props.width : (oriW * currentScale),
        depth: (props.depth !== undefined) ? props.depth : (oriD * currentScale),
        height: (props.height !== undefined) ? props.height : (oriH * currentScale),
        
        scale: currentScale,
        rotation: props.rotation || 0,
        lat: props.lat,
        lon: props.lon,
        
        originalWidth: oriW,
        originalDepth: oriD,
        originalHeight: oriH,

        metaData: props 
      };

      console.log("🚀 UI로 던지는 데이터:", payload);
      this.onSimulationSelect(payload);
    }
  }

  // ---------------------------------------------------------------
  // 🖱️ [5] 이벤트 리스너 (통합)
  // ---------------------------------------------------------------
  setupEventListeners() {
    this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

    this.handler.setInputAction(async (click) => {
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
          const entity = await this.createProceduralBuilding(
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

          this.selectAndTriggerEdit(entity);
          return;
        }

        // B. [모델 배치 모드] (로컬)
        if (this.pendingModelFile) {
          const entity = await this.loadUser3DModel(this.pendingModelFile, lat, lon);

          this.pendingModelFile = null;
          this.viewer.canvas.style.cursor = "default";

          this.selectAndTriggerEdit(entity);
          return;
        }

        // C. [라이브러리 모델 배치 모드] (DB)
        if (this.pendingLibraryModel) {
            const entity = await this.loadLibraryModel(this.pendingLibraryModel, lat, lon);
            
            this.pendingLibraryModel = null;
            this.viewer.canvas.style.cursor = "default";
            
            this.selectAndTriggerEdit(entity);
            return;
        }

        // D. [재배치 모드]
        if (this.relocatingId) {
          const entity = this.viewer.entities.getById(this.relocatingId);
          if (entity) {
            // 모델이냐 박스냐에 따라 다르게 처리 (여기서는 단순 위치 이동으로 통일 가능)
            if (entity.properties.isModel) {
              const position = Cesium.Cartesian3.fromDegrees(lon, lat, 0);
              entity.position = position;
              
              const heading = Cesium.Math.toRadians(entity.properties.rotation.getValue());
              const hpr = new Cesium.HeadingPitchRoll(heading, 0, 0);
              entity.orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);

              entity.properties.lat = lat;
              entity.properties.lon = lon;
            } else {
              // 박스: 기존 삭제 후 재생성 (높이 계산 때문)
              const newEntity = await this.createProceduralBuilding(
                lat,
                lon,
                entity.properties.width.getValue(),
                entity.properties.depth.getValue(),
                entity.properties.height.getValue(),
                entity.properties.rotation.getValue()
              );
              this.viewer.entities.remove(entity);
              this.selectAndTriggerEdit(newEntity); 
              this.relocatingId = null;
              this.viewer.canvas.style.cursor = "default";
              return;
            }
          }
          this.relocatingId = null;
          this.viewer.canvas.style.cursor = "default";

          if (entity) this.selectAndTriggerEdit(entity);
          return;
        }
      }

      // E. [선택 모드] (시뮬레이션 건물 클릭)
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

      // F. [마커 찍기] (마커 모드일 때만)
      if (Cesium.defined(cartesian) && this.isMarkerMode) {
        this.data.addMarker(lat, lon, Date.now().toString(), "사용자 점");
        if (this.onMapClick) this.onMapClick({ lon, lat });
      } else if (Cesium.defined(cartesian) && this.onMapClick) {
        this.onMapClick({ lon, lat });
      }

      // G. [건물 정보 확인] (OSM 등 외부 건물 클릭 시)
      if (Cesium.defined(picked) && typeof picked.getProperty === "function") {
        const info = {
          name: picked.getProperty("name"),
          height: picked.getProperty("element:height"),
          type: picked.getProperty("building"),
        };
        if (this.onBuildingClick) this.onBuildingClick(info);
      }

      // H. [추적 모드]
      if (this.isTrackingEnabled) {
        if (Cesium.defined(picked) && picked.id instanceof Cesium.Entity) {
          this.viewer.trackedEntity = picked.id;
        } else {
          this.viewer.trackedEntity = undefined;
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  // ---------------------------------------------------------------
  // 🌿 [추가] 녹지 시뮬레이션 인터페이스
  // ---------------------------------------------------------------
  
  startGreenerySimulation(onDrawFinishCallback) {
    this.setGreeneryMode(true);
    this.greenery.startDrawing(onDrawFinishCallback);
    console.log("🌿 녹지 시뮬레이션 시작");
  }

  plantTrees(count) {
    this.greenery.plantTrees(count);
  }

  stopGreenerySimulation() {
    this.setGreeneryMode(false);
    this.greenery.reset();
    console.log("🌿 녹지 시뮬레이션 종료");
  }

  // [위치 2] 현재 배치 정보를 GeoJSON 시나리오로 내보내기
  exportToGeoJSON(sceneName) {
      const simulationEntities = this.viewer.entities.values.filter(
          e => e.properties && e.properties.isSimulation?.getValue()
      );

      const features = simulationEntities.map(e => {
          const p = e.properties;
          const pos = Cesium.Cartographic.fromCartesian(e.position.getValue(Cesium.JulianDate.now()));
          
          return {
              type: "Feature",
              geometry: {
                  type: "Point",
                  coordinates: [
                      Cesium.Math.toDegrees(pos.longitude),
                      Cesium.Math.toDegrees(pos.latitude),
                      pos.height
                  ]
              },
              properties: {
                  mlid: p.mlid?.getValue(), // 어떤 모델인지
                  scale: p.scale?.getValue(),
                  rotation: p.rotation?.getValue(),
                  width: p.width?.getValue(),
                  depth: p.depth?.getValue(),
                  height: p.height?.getValue()
              }
          };
      });

      const scenario = { scene_name: sceneName, scene_data: { type: "FeatureCollection", features: features } };
      
      // 테스트용 파일 다운로드 기능
      const blob = new Blob([JSON.stringify(scenario, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sceneName}.json`;
      a.click();

      return scenario;
  }
}