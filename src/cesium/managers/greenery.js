import * as Cesium from "cesium";
import * as turf from "@turf/turf";
import { extractGlbFullDetails } from "../glb/glbParser";

export class GreeneryManager {
  constructor(viewer) {
    this.viewer = viewer;
    this.handler = null;
    
    this.active = false;
    this.drawingPoints = []; 
    this.tempPoints = [];    
    this.tempLine = null;    
    this.polygonEntityLow = null;  
    this.polygonEntityHigh = null; 
    this.treeEntities = []; 
    this.onDrawFinish = null; 
    this.currentArea = 0; 

    // 🌲 [수정 1] 초기 설정 (Scale 1.0 고정, 크기는 분석 후 업데이트)
    this.treeConfig = {
      conifer: {
        id: 'tree_01',
        mlid: 143,    
        url: null,
        scale: 8.5,   // ✅ 요청하신 대로 1.0 고정
        width: 5.0,   // 기본값 (분석 실패 시 사용)
        depth: 5.0,
        area: 25.0,    // 기본 면적
        loaded: false
      },
      deciduous: {
        id: 'tree_13',
        mlid: 148,    
        url: null,
        scale: 1.0,   // ✅ 요청하신 대로 1.0 고정
        width: 5.0,   // 기본값
        depth: 5.0,
        area: 25.0,   // 기본 면적
        loaded: false
      }
    };

    this.onAnalysisUpdate = null;

    // 생성 시점에 분석 시작
    this.initTreeModels();
  }

  // 📡 [API & 분석] DB경로 조회 -> 파일 다운로드 -> GLB 파싱 -> 크기 계산
  async initTreeModels() {
    try {
      console.log("🔍 [Greenery] 나무 모델 정보 조회 및 분석 시작...");
      const res = await fetch('http://localhost/api/models');
      if (!res.ok) throw new Error("API Error");
      const models = await res.json();
      
      // 1. 침엽수 찾기 (ID 또는 MLID)
      const coniferData = models.find(m => 
          m.mlid == this.treeConfig.conifer.mlid || 
          (m.model_org_file_name && m.model_org_file_name.includes(this.treeConfig.conifer.id))
      );
      
      if (coniferData) {
          console.log(`🎯 침엽수 매칭 성공! (${coniferData.model_org_file_name})`);
          await this._processModelConfig('conifer', models, coniferData.mlid);
      } else {
          console.warn(`⚠️ 침엽수(${this.treeConfig.conifer.id})를 DB에서 찾을 수 없습니다.`);
      }

      // 2. 활엽수 찾기
      const deciduousData = models.find(m => 
          m.mlid == this.treeConfig.deciduous.mlid || 
          (m.model_org_file_name && m.model_org_file_name.includes(this.treeConfig.deciduous.id))
      );

      if (deciduousData) {
          await this._processModelConfig('deciduous', models, deciduousData.mlid);
      }

    } catch (e) {
      console.error("❌ 나무 모델 로드/분석 실패:", e);
    }
  }

  // UI에서 분석 결과를 실시간으로 듣기 위해 등록하는 함수
  setOnAnalysisUpdate(callback) {
    this.onAnalysisUpdate = callback;
    
    // 이미 로드된 상태라면 즉시 알려줌 (패널 열 때 바로 갱신되도록)
    if (this.treeConfig.conifer.loaded || this.treeConfig.deciduous.loaded) {
        this._notifyUpdate();
    }
  }

  // 내부 헬퍼: 현재 스펙을 콜백으로 전송
  _notifyUpdate() {
    if (this.onAnalysisUpdate) {
        this.onAnalysisUpdate({
            coniferArea: this.treeConfig.conifer.area,
            coniferHeight: this.treeConfig.conifer.height, // 🌲 높이 추가            
            deciduousArea: this.treeConfig.deciduous.area,
            deciduousHeight: this.treeConfig.deciduous.height, // 🌳 높이 추가
            loaded: true
        });
    }
  }

  // 🛠️ [Helper] 모델 정보 설정 및 GLB 분석 공통 함수
  async _processModelConfig(type, models, targetMlid) {
      const data = models.find(m => m.mlid == targetMlid);
      if (!data) return;

      const url = `http://localhost/files${data.model_save_file_url}`;
      this.treeConfig[type].url = url;
      this.treeConfig[type].loaded = true;

      try {
          // console.log(`📥 [Greenery] ${type} 모델 다운로드...`); 
          const fileRes = await fetch(url);
          const blob = await fileRes.blob();
          const file = new File([blob], "temp.glb");
          
          const details = await extractGlbFullDetails(file);
          
          if (details) {
              const rawW = details.geometry.width || 1.0;
              const rawH = details.geometry.height || 1.0; 
              const rawD = details.geometry.depth || 1.0;
              
              const scale = this.treeConfig[type].scale;

              const realW = rawW * scale;
              const realH = rawH * scale; 
              const realD = rawD * scale;
              const realArea = realW * realD; 

              this.treeConfig[type].width = realW;
              this.treeConfig[type].height = realH; 
              this.treeConfig[type].depth = realD;
              this.treeConfig[type].area = realArea;
              
              console.log(`📏 [최종 적용] ${type}: 높이(${realH.toFixed(2)}m), 면적(${realArea.toFixed(2)}m²)`);
              this._notifyUpdate();
          }
      } catch (err) {
          console.error(`❌ ${type} 분석 오류:`, err);
      }
  }

  // =================================================================
  // 1. 그리기 모드 시작
  // =================================================================
  startDrawing(onDrawFinishCallback) {
    this.reset(); 
    this.active = true;
    this.onDrawFinish = onDrawFinishCallback;
    this.viewer.canvas.style.cursor = "crosshair";
    this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
    
    this.handler.setInputAction((click) => {
        const position = this._pickPosition(click.position);
        if (position) this._addPoint(position);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    this.handler.setInputAction((movement) => {
        const position = this._pickPosition(movement.endPosition);
        if (position) this._updateGuideLine(position);
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    this.handler.setInputAction(() => this._removeLastPoint(), Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    this.handler.setInputAction(() => this._finishDrawing(), Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
  }
  
  // =================================================================
  // 2. 나무 심기
  // =================================================================
  plantTrees(count, coniferRatio) {
    
    // 🚨 비율값 방어 코드
    if (coniferRatio === undefined || coniferRatio === null) {
        console.warn("⚠️ 비율(ratio) 미전달 -> 기본값 20% 적용");
        coniferRatio = 0.2;
    }

    if (this.drawingPoints.length < 3) {
        alert("영역이 설정되지 않았습니다.");
        return;
    }

    if (!this.treeConfig.conifer.loaded || !this.treeConfig.deciduous.loaded) {
        alert("모델 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
        return; 
    }

    this._clearTrees();

    // Polygon
    const coords = this.drawingPoints.map(p => {
      const c = Cesium.Cartographic.fromCartesian(p);
      return [Cesium.Math.toDegrees(c.longitude), Cesium.Math.toDegrees(c.latitude)];
    });
    if (coords[0][0] !== coords[coords.length-1][0]) coords.push(coords[0]);
    
    const turfPoly = turf.polygon([coords]);
    const bbox = turf.bbox(turfPoly);

    const coniferCount = Math.floor(count * coniferRatio);
    const deciduousCount = count - coniferCount;

    console.log(`🌲 식재 실행: 총 ${count} | 비율 ${(coniferRatio*100).toFixed(0)}% (침엽수 ${coniferCount}, 활엽수 ${deciduousCount})`);

    // 좌표 생성 (Batch)
    let points = [];
    let attempts = 0;
    while (points.length < count && attempts < count * 20) {
        attempts++;
        const batch = turf.randomPoint(Math.min(100, count - points.length), { bbox: bbox });
        for (const feature of batch.features) {
            if (turf.booleanPointInPolygon(feature, turfPoly)) {
                points.push(feature.geometry.coordinates);
                if (points.length >= count) break;
            }
        }
    }

    // 섞기
    points.sort(() => Math.random() - 0.5);

    // 모델 배치
    points.forEach((coord, index) => {
        const [lon, lat] = coord;
        const position = Cesium.Cartesian3.fromDegrees(lon, lat);
        
        // 인덱스 기준 할당 (앞쪽 n개는 침엽수)
        const isConifer = index < coniferCount;
        const config = isConifer ? this.treeConfig.conifer : this.treeConfig.deciduous;

        // 🚨 [디버깅] 침엽수인데 1m짜리인지 확인
        // if (index === 0) console.log(`첫번째 나무: ${isConifer ? '침엽수' : '활엽수'}, 스케일: ${config.scale}`);

        const treeEntity = this.viewer.entities.add({
            position: position,
            model: {
                uri: config.url,
                scale: config.scale, // 12.0 적용됨
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                //minimumPixelSize: 64, 
                shadows: Cesium.ShadowMode.ENABLED,
                //maximumScale: 50.0
            }
        });
        
        treeEntity.properties = {
            type: isConifer ? "침엽수" : "활엽수",
            realArea: config.area,
            carbonAbsorb: isConifer ? 12.0 : 8.2
        };

        this.treeEntities.push(treeEntity);
    });

    console.log(`✅ 배치 완료`);
  }

  // =================================================================
  // 3. 초기화
  // =================================================================
  reset() {
    this.active = false;
    this.drawingPoints = [];
    this.currentArea = 0;
    this._clearTempEntities();
    if (this.polygonEntityLow) this.viewer.entities.remove(this.polygonEntityLow);
    if (this.polygonEntityHigh) this.viewer.entities.remove(this.polygonEntityHigh);
    this.polygonEntityLow = null;
    this.polygonEntityHigh = null;
    this._clearTrees();
    if (this.handler) { this.handler.destroy(); this.handler = null; }
    this.viewer.canvas.style.cursor = "default";
  }

  // =================================================================
  // 4. 내부 로직
  // =================================================================

  _pickPosition(mousePos) {
    let cartesian = this.viewer.scene.pickPosition(mousePos);
    if (!Cesium.defined(cartesian)) {
      cartesian = this.viewer.camera.pickEllipsoid(mousePos, this.viewer.scene.globe.ellipsoid);
    }
    return cartesian;
  }

  _addPoint(position) {
    if (this.drawingPoints.length > 0) {
        const last = this.drawingPoints[this.drawingPoints.length - 1];
        if (Cesium.Cartesian3.distance(last, position) < 0.5) return;
    }

    this.drawingPoints.push(position);
    
    const pointEntity = this.viewer.entities.add({
      position: position,
      point: { pixelSize: 10, color: Cesium.Color.RED, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND }
    });
    this.tempPoints.push(pointEntity);
  }

  _updateGuideLine(mousePos) {
    if (this.drawingPoints.length === 0) return;
    const positions = [...this.drawingPoints, mousePos];
    
    if (this.tempLine) this.viewer.entities.remove(this.tempLine);
    
    this.tempLine = this.viewer.entities.add({
      polyline: {
        positions: positions,
        width: 2,
        material: Cesium.Color.YELLOW,
        clampToGround: true
      }
    });
  }

  _removeLastPoint() {
    if (this.drawingPoints.length > 0) {
      this.drawingPoints.pop();
      const lastEntity = this.tempPoints.pop();
      this.viewer.entities.remove(lastEntity);
      if (this.tempLine) {
        this.viewer.entities.remove(this.tempLine);
        this.tempLine = null;
      }
    }
  }

  // 듀얼 텍스처 폴리곤 생성 (고속 반복 + 더 연하게)
  _finishDrawing() {
    if (this.drawingPoints.length < 3) {
        alert("3개 이상 점을 찍어주세요.");
        return;
    }
    if (this.handler) { this.handler.destroy(); this.handler = null; }
    this.viewer.canvas.style.cursor = "default";

    const hierarchy = new Cesium.PolygonHierarchy(Array.from(this.drawingPoints));
    this._createPolygonLayers(hierarchy);

    const coords = this.drawingPoints.map(p => {
        const c = Cesium.Cartographic.fromCartesian(p);
        return [Cesium.Math.toDegrees(c.longitude), Cesium.Math.toDegrees(c.latitude)];
    });
    if (coords[0][0] !== coords[coords.length-1][0]) coords.push(coords[0]);
    const turfPoly = turf.polygon([coords]);
    this.currentArea = turf.area(turfPoly); 

    this._clearTempEntities();

    // 🚀 [핵심] 면적뿐만 아니라, 분석된 나무 스펙도 함께 UI로 전달
    if (this.onDrawFinish) {
        this.onDrawFinish(this.currentArea, {
            coniferArea: this.treeConfig.conifer.area,
            coniferHeight: this.treeConfig.conifer.height,
            deciduousArea: this.treeConfig.deciduous.area,
            deciduousHeight: this.treeConfig.deciduous.height
        });
    }
  }

  _clearTrees() {
    if (this.treeEntities.length > 0) {
      this.treeEntities.forEach(entity => {
        this.viewer.entities.remove(entity);
      });
      this.treeEntities = [];
    }
  }

  _createPolygonLayers(hierarchy) { 
      const TILE_REPEAT = 20.0;
      const CYCLE_HEIGHT = 30.0;
      const createMaterial = (image, isMain) => new Cesium.ImageMaterialProperty({
          image: image,
          transparent: true,
          repeat: new Cesium.Cartesian2(TILE_REPEAT, TILE_REPEAT),
          color: new Cesium.CallbackProperty(() => {
              const height = this.viewer.camera.positionCartographic.height;
              const rawSine = Math.sin(height / CYCLE_HEIGHT);
              const biasedSine = isMain ? (rawSine + 0.4) : (-rawSine - 0.2);
              const ratio = Math.min(1.0, Math.max(0.0, (biasedSine + 1.0) / 2.0));
              let alpha = isMain ? (0.75 + 0.25 * ratio) : (0.1 + 0.3 * ratio);
              if (height < 300) alpha *= (height / 300);
              return Cesium.Color.WHITE.withAlpha(alpha);
          }, false)
      });
      this.polygonEntityLow = this.viewer.entities.add({
          polygon: { hierarchy, material: createMaterial("/green/texture1.png", true), classificationType: Cesium.ClassificationType.BOTH, zIndex: 12 }
      });
      this.polygonEntityHigh = this.viewer.entities.add({
          polygon: { hierarchy, material: createMaterial("/green/texture2.png", false), classificationType: Cesium.ClassificationType.BOTH, zIndex: 11 }
      });
  }
  _pickPosition(mousePos) { return this.viewer.scene.pickPosition(mousePos) || this.viewer.camera.pickEllipsoid(mousePos); }
  _addPoint(p) { this.drawingPoints.push(p); const pt = this.viewer.entities.add({ position: p, point: { pixelSize: 10, color: Cesium.Color.RED, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND } }); this.tempPoints.push(pt); }
  _updateGuideLine(p) { if (this.drawingPoints.length === 0) return; const positions = [...this.drawingPoints, p]; if (this.tempLine) this.viewer.entities.remove(this.tempLine); this.tempLine = this.viewer.entities.add({ polyline: { positions, width: 2, material: Cesium.Color.YELLOW, clampToGround: true } }); }
  _removeLastPoint() { if (this.drawingPoints.length > 0) { this.drawingPoints.pop(); const last = this.tempPoints.pop(); this.viewer.entities.remove(last); if (this.tempLine) { this.viewer.entities.remove(this.tempLine); this.tempLine = null; } } }
  _clearTempEntities() { this.tempPoints.forEach(e => this.viewer.entities.remove(e)); this.tempPoints = []; if (this.tempLine) { this.viewer.entities.remove(this.tempLine); this.tempLine = null; } }
  _clearTrees() { this.treeEntities.forEach(e => this.viewer.entities.remove(e)); this.treeEntities = []; }
}