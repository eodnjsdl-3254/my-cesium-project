import * as Cesium from "cesium";
import * as turf from "@turf/turf";

export class GreeneryManager {
  constructor(viewer) {
    this.viewer = viewer;
    this.handler = null;
    
    // 상태 관리
    this.active = false;
    this.drawingPoints = []; 
    this.tempPoints = [];    
    this.tempLine = null;    
    
    // 텍스처 레이어링
    this.polygonEntityLow = null;  
    this.polygonEntityHigh = null; 
    
    this.treeEntities = []; 
    
    this.onDrawFinish = null;
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

    this.handler.setInputAction(() => {
      this._removeLastPoint();
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    this.handler.setInputAction(() => {
      this._finishDrawing();
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
  }

  // =================================================================
  // 2. 나무 심기
  // =================================================================
  plantTrees(count) {
    if (this.drawingPoints.length < 3) {
        alert("영역이 설정되지 않았습니다.");
        return;
    }

    this._clearTrees();

    const coords = this.drawingPoints.map(p => {
      const c = Cesium.Cartographic.fromCartesian(p);
      return [Cesium.Math.toDegrees(c.longitude), Cesium.Math.toDegrees(c.latitude)];
    });
    if (coords[0][0] !== coords[coords.length-1][0]) coords.push(coords[0]);
    
    const turfPoly = turf.polygon([coords]);
    const bbox = turf.bbox(turfPoly);

    let planted = 0;
    let attempts = 0;
    const maxAttempts = count * 20;

    while (planted < count && attempts < maxAttempts) {
      attempts++;
      const randomPoints = turf.randomPoint(1, { bbox: bbox });
      const point = randomPoints.features[0];

      if (turf.booleanPointInPolygon(point, turfPoly)) {
        const [lon, lat] = point.geometry.coordinates;
        const position = Cesium.Cartesian3.fromDegrees(lon, lat);
        
        const tree = this.viewer.entities.add({
          position: position,
          billboard: {
            image: Math.random() > 0.5 ? "/green/tree1.png" : "/green/tree2.png",
            width: 20, height: 20,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          }
        });
        this.treeEntities.push(tree);
        planted++;
      }
    }
    console.log(`🌲 나무 재배치 완료: ${planted}그루`);
  }

  // =================================================================
  // 3. 초기화
  // =================================================================
  reset() {
    this.active = false;
    this.drawingPoints = [];
    
    this.tempPoints.forEach(e => this.viewer.entities.remove(e));
    this.tempPoints = [];
    if (this.tempLine) this.viewer.entities.remove(this.tempLine);
    this.tempLine = null;
    
    if (this.polygonEntityLow) this.viewer.entities.remove(this.polygonEntityLow);
    if (this.polygonEntityHigh) this.viewer.entities.remove(this.polygonEntityHigh);
    this.polygonEntityLow = null;
    this.polygonEntityHigh = null;

    this._clearTrees();

    if (this.handler) {
      this.handler.destroy();
      this.handler = null;
    }
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
      alert("최소 3개 이상의 지점을 찍어주세요.");
      return;
    }

    if (this.handler) {
      this.handler.destroy();
      this.handler = null;
    }
    this.viewer.canvas.style.cursor = "default";

    const hierarchy = new Cesium.PolygonHierarchy(Array.from(this.drawingPoints));

    // ─────────────────────────────────────────────────────────────
    // 🚀 [설정] 속도 및 비율 조절
    // ─────────────────────────────────────────────────────────────
    const TILE_REPEAT = 20.0;
    const CYCLE_HEIGHT = 30.0; // 30m마다 변화 (빠른 깜빡임)

    // 1. Texture 1 (Main - 오래 머묾)
    const material1 = new Cesium.ImageMaterialProperty({
      image: "/green/texture1.png",
      transparent: true,
      repeat: new Cesium.Cartesian2(TILE_REPEAT, TILE_REPEAT),
      color: new Cesium.CallbackProperty(() => {
        const height = this.viewer.camera.positionCartographic.height;
        
        // [-1.0 ~ 1.0] 사이의 기본 파동
        const rawSine = Math.sin(height / CYCLE_HEIGHT);

        // 🌟 [핵심] 파동을 위로 +0.4 들어올림 (Bias)
        // 결과 범위: [-0.6 ~ 1.4]
        // 0.0보다 큰 구간이 훨씬 길어지므로 Texture 1이 화면에 더 오래 남음
        let biasedSine = rawSine + 0.4; 

        // 0.0 ~ 1.0 사이로 자르기 (Clamp)
        let ratio = Math.min(1.0, Math.max(0.0, (biasedSine + 1.0) / 2.0));
        
        // 투명도 적용: 0.75 ~ 1.0 (진하게 유지)
        let alpha = 0.75 + (0.25 * ratio);

        if (height < 300) alpha = alpha * (height / 300);
        return Cesium.Color.WHITE.withAlpha(alpha);
      }, false)
    });

    // 2. Texture 2 (Sub - 잠깐 나옴)
    const material2 = new Cesium.ImageMaterialProperty({
      image: "/green/texture2.png",
      transparent: true,
      repeat: new Cesium.Cartesian2(TILE_REPEAT, TILE_REPEAT),
      color: new Cesium.CallbackProperty(() => {
        const height = this.viewer.camera.positionCartographic.height;
        
        const rawSine = Math.sin(height / CYCLE_HEIGHT);
        
        // 🌟 [핵심] Texture 1과 반대지만, 범위가 좁음
        // Texture 1이 힘이 빠질 때(골짜기일 때)만 잠깐 등장
        // 파동을 뒤집고(-rawSine), 기준선을 낮춤(-0.2) -> 잠깐만 0.0 위로 올라옴
        let biasedSine = -rawSine - 0.2; 
        
        let ratio = Math.min(1.0, Math.max(0.0, (biasedSine + 1.0) / 2.0));

        // 투명도 적용: 0.1 ~ 0.4 (연하게)
        let alpha = 0.1 + (0.3 * ratio);

        if (height < 300) alpha = alpha * (height / 300);
        return Cesium.Color.WHITE.withAlpha(alpha);
      }, false)
    });

    // 레이어 생성
    this.polygonEntityLow = this.viewer.entities.add({
      polygon: {
        hierarchy: hierarchy,
        material: material1,
        classificationType: Cesium.ClassificationType.BOTH,
        zIndex: 12
      }
    });

    this.polygonEntityHigh = this.viewer.entities.add({
      polygon: {
        hierarchy: hierarchy,
        material: material2,
        classificationType: Cesium.ClassificationType.BOTH,
        zIndex: 11
      }
    });
    
    console.log("✅ T1 우세(Long-stay) & T2 짧은 교차 효과 적용 완료");

    // 가이드 삭제
    this.tempPoints.forEach(e => this.viewer.entities.remove(e));
    this.tempPoints = [];
    if (this.tempLine) this.viewer.entities.remove(this.tempLine);
    this.tempLine = null;

    if (this.onDrawFinish) this.onDrawFinish();
  }

  _clearTrees() {
    if (this.treeEntities.length > 0) {
      this.treeEntities.forEach(entity => {
        this.viewer.entities.remove(entity);
      });
      this.treeEntities = [];
    }
  }
}