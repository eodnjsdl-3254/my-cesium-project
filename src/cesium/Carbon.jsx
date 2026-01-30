import React, { useEffect } from "react";
import {
  Entity,
  PolygonGraphics,
  BillboardGraphics,
  PointGraphics,
  PolylineGraphics,
  ScreenSpaceEventHandler, // [Resium 컴포넌트] JSX에서 사용 (<ScreenSpaceEventHandler>)
  ScreenSpaceEvent,
  useCesium,
} from "resium";
import {
  ScreenSpaceEventType,
  HeightReference,
  Color,
  defined,
  Cartesian3,
  Cartographic,
  Math as CesiumMath,
  ClassificationType,
  VerticalOrigin,
  // ★ [핵심] Cesium 클래스 이름 충돌 방지를 위해 별칭 사용
  ScreenSpaceEventHandler as CesiumScreenSpaceEventHandler, 
} from "cesium";
import * as turf from "@turf/turf";

// ==========================================
// [알고리즘] 영역 내부를 빽빽하게 채우는 필터링 방식
// ==========================================
const generateTreePositionsInPolygon = (positions, spacingMeters = 10) => {
  if (!positions || positions.length < 3) return [];

  // 1. Cesium Cartesian3 -> 위경도(Lon/Lat) 변환
  const coords = positions.map((cartesian) => {
    const carto = Cartographic.fromCartesian(cartesian);
    return [
      CesiumMath.toDegrees(carto.longitude),
      CesiumMath.toDegrees(carto.latitude),
    ];
  });

  // 2. 폴리곤 닫기 (시작점과 끝점이 같아야 함)
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coords.push(first);
  }

  // 3. Turf 폴리곤 생성
  const polygon = turf.polygon([coords]);
  
  // 4. 바운딩 박스(BBox) 생성
  const bbox = turf.bbox(polygon);

  // 5. [수정됨] BBox 전체에 그리드 생성 (마스크 옵션 제거)
  // spacingMeters를 km 단위로 변환 (예: 10m -> 0.01km)
  // 나무가 너무 많으면 렉이 걸릴 수 있으니 간격을 적절히 조정하세요 (현재 10m)
  const pointGrid = turf.pointGrid(bbox, spacingMeters / 1000, {
    units: "kilometers",
  });

  // 6. [핵심] 그리드 점들 중 폴리곤 '내부'에 있는 것만 필터링
  const featuresInside = pointGrid.features.filter((feature) => 
    turf.booleanPointInPolygon(feature.geometry.coordinates, polygon)
  );

  // 7. 다시 Cesium 좌표로 변환하여 반환
  return featuresInside.map((feature) => {
    const [lon, lat] = feature.geometry.coordinates;
    return Cartesian3.fromDegrees(lon, lat);
  });
};

const Carbon = ({ isActive, drawProps }) => {
  const { viewer } = useCesium();
  
  const { 
    isDrawing, 
    drawingPoints, 
    finalPolygon, 
    trees, 
    addPoint, 
    finishDrawing, 
    setTrees,      
    setPanelOpen   
  } = drawProps;

  // ==========================================
  // [로직 1] 더블 클릭 -> 그리기 종료 + 나무 심기
  // ==========================================
  const handleFinish = () => {
    if (drawingPoints.length < 3) return;

    // ★ 나무 간격 설정 (단위: 미터). 빽빽하게 하려면 5~10 정도로 설정
    // 너무 작게(예: 1) 잡으면 브라우저가 멈출 수 있으니 주의하세요.
    const treeSpacing = 10; 

    // 1. 내부 좌표 계산
    const newTreePositions = generateTreePositionsInPolygon(drawingPoints, treeSpacing);
    
    // 2. 나무 데이터 생성
    const newTrees = newTreePositions.map(pos => ({
      position: pos,
      image: "/assets/tree.png" // 투명 배경 PNG 이미지 경로 확인
    }));

    // 3. 부모 State 업데이트
    if (setTrees) setTrees(newTrees);

    // 4. 그리기 종료 처리
    finishDrawing(); 
  };

  // ==========================================
  // [로직 2] 그리기 모드 중 클릭 (점 추가)
  // ==========================================
  const handleMapClick = (e) => {
    if (!viewer || !isActive) return;

    if (isDrawing) {
      const position = e.position;
      let cartesian;
      if (viewer.scene.pickPositionSupported) {
        cartesian = viewer.scene.pickPosition(position);
      }
      if (!defined(cartesian)) {
        cartesian = viewer.camera.pickEllipsoid(position, viewer.scene.globe.ellipsoid);
      }
      if (cartesian) {
        addPoint(cartesian);
      }
    } 
  };

  // ==========================================
  // [로직 3] 편집 패널 제어 (충돌 방지 로직 포함)
  // ==========================================
  useEffect(() => {
    if (!viewer) return;

    // ★ [중요] CesiumScreenSpaceEventHandler 사용 (생성자 충돌 방지)
    const handler = new CesiumScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((click) => {
      // 1. [충돌 방지] 그리는 중이라면, 이 핸들러(선택/패널)는 무조건 무시
      if (isDrawing) {
        return; 
      }

      const pickedObject = viewer.scene.pick(click.position);

      if (!defined(pickedObject)) {
        // 2. 빈 땅 클릭 -> 선택 해제 & 패널 닫기
        viewer.selectedEntity = undefined; 
        if (setPanelOpen) setPanelOpen(false); 
        console.log("빈 공간 클릭: 패널 닫힘");
      } else {
        // 3. 객체(이미 생성된 나무나 폴리곤) 클릭 -> 패널 열기
        // (필요하다면 여기서 클릭된 객체가 내가 원하는 객체인지 ID 확인 가능)
        if (setPanelOpen) setPanelOpen(true);
        console.log("객체 선택됨: 패널 열림");
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      handler.destroy();
    };
  }, [viewer, isDrawing, setPanelOpen]); // isDrawing이 변경되면 핸들러가 재설정됨


  return (
    <>
      {/* 1. 그리기 모드용 이벤트 (Resium 컴포넌트) */}
      {isActive && isDrawing && (
        <ScreenSpaceEventHandler>
          <ScreenSpaceEvent
            action={handleMapClick}
            type={ScreenSpaceEventType.LEFT_CLICK}
          />
          <ScreenSpaceEvent
            action={handleFinish}
            type={ScreenSpaceEventType.LEFT_DOUBLE_CLICK}
          />
        </ScreenSpaceEventHandler>
      )}

      {/* 2. 찍고 있는 점 (가이드) */}
      {isActive && isDrawing && drawingPoints.map((pos, idx) => (
        <Entity key={`pt-${idx}`} position={pos}>
          <PointGraphics
            pixelSize={10}
            color={Color.RED}
            outlineColor={Color.WHITE}
            outlineWidth={2}
            heightReference={HeightReference.CLAMP_TO_GROUND}
            disableDepthTestDistance={Number.POSITIVE_INFINITY}
          />
        </Entity>
      ))}

      {/* 3. 점을 잇는 선 (가이드) */}
      {isActive && isDrawing && drawingPoints.length >= 2 && (
        <Entity>
          <PolylineGraphics
            positions={drawingPoints}
            width={3}
            material={Color.YELLOW}
            clampToGround={true}
          />
        </Entity>
      )}

      {/* 4. 완성된 녹지 면적 (초록색 영역) */}
      {finalPolygon && (
        <Entity>
          <PolygonGraphics
            hierarchy={finalPolygon}
            material={Color.FORESTGREEN.withAlpha(0.6)}
            classificationType={ClassificationType.BOTH}
          />
        </Entity>
      )}

      {/* 5. 생성된 나무들 (최종 결과물) */}
      {trees && trees.map((tree, i) => (
        <Entity key={`tree-${i}`} position={tree.position}>
          <BillboardGraphics
            image={tree.image} // assets/tree.png (투명 배경 권장)
            width={20}
            height={20}
            // 나무 뿌리를 땅에 고정
            heightReference={HeightReference.CLAMP_TO_GROUND}
            verticalOrigin={VerticalOrigin.BOTTOM} 
            disableDepthTestDistance={Number.POSITIVE_INFINITY}
          />
        </Entity>
      ))}
    </>
  );
};

export default Carbon;