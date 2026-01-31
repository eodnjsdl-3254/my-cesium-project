import { useState, useCallback } from "react";
import * as Cesium from "cesium";
import * as turf from "@turf/turf";

export const useGreeneryDraw = () => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState([]); // 확정된 점들
  const [mousePosition, setMousePosition] = useState(null); // 마우스 따라다니는 임시 점
  const [finalPolygon, setFinalPolygon] = useState(null);
  const [trees, setTrees] = useState([]);

  // 1. 그리기 시작
  const startDrawing = useCallback(() => {
    setFinalPolygon(null);
    setTrees([]);
    setDrawingPoints([]);
    setMousePosition(null);
    setIsDrawing(true);
  }, []);

  // 2. 점 추가 (클릭 시)
  const addPoint = useCallback((position) => {
    if (!isDrawing || !position) return;
    
    setDrawingPoints((prev) => {
      // 너무 가까운 점 중복 클릭 방지 (0.5m)
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        if (Cesium.Cartesian3.distance(last, position) < 0.5) return prev;
      }
      return [...prev, position];
    });
  }, [isDrawing]);

  // 3. 마우스 이동 (가이드 라인용)
  const updateMousePosition = useCallback((position) => {
    if (isDrawing) setMousePosition(position);
  }, [isDrawing]);

  // 4. 마지막 점 취소 (우클릭 등)
  const removeLastPoint = useCallback(() => {
    setDrawingPoints((prev) => prev.slice(0, -1));
  }, []);

  // 5. 그리기 완료 (더블 클릭)
  const finishDrawing = useCallback(() => {
    if (drawingPoints.length < 3) {
      alert("최소 3개 이상의 지점을 찍어주세요.");
      return;
    }
    // 마우스 커서 위치 초기화
    setMousePosition(null);
    // 폴리곤 확정
    setFinalPolygon([...drawingPoints]);
    // 점들은 초기화 (폴리곤이 생기므로)
    setDrawingPoints([]); 
    setIsDrawing(false);
  }, [drawingPoints]);

  // 6. 초기화 (취소 버튼)
  const reset = useCallback(() => {
    setFinalPolygon(null);
    setTrees([]);
    setDrawingPoints([]);
    setMousePosition(null);
    setIsDrawing(false);
  }, []);

  // 7. 나무 심기 (Turf.js)
  const plantTrees = useCallback((count) => {
    if (!finalPolygon || finalPolygon.length < 3) {
        alert("먼저 영역을 그려주세요.");
        return;
    }

    // Cartesian3 -> 경위도 변환
    const coords = finalPolygon.map((cartesian) => {
      const c = Cesium.Cartographic.fromCartesian(cartesian);
      return [Cesium.Math.toDegrees(c.longitude), Cesium.Math.toDegrees(c.latitude)];
    });
    // 폴리곤 닫기
    if (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1]) {
        coords.push(coords[0]);
    }

    const turfPoly = turf.polygon([coords]);
    const bbox = turf.bbox(turfPoly);
    const newTrees = [];
    let attempts = 0;

    while (newTrees.length < count && attempts < count * 20) {
      attempts++;
      const randomPoints = turf.randomPoint(1, { bbox: bbox });
      const point = randomPoints.features[0];
      if (turf.booleanPointInPolygon(point, turfPoly)) {
         const [lon, lat] = point.geometry.coordinates;
         newTrees.push({
           position: Cesium.Cartesian3.fromDegrees(lon, lat),
           image: Math.random() > 0.5 ? "/green/tree1.png" : "/green/tree2.png" // 경로 확인 필수!
         });
      }
    }
    setTrees(newTrees);
  }, [finalPolygon]);

  return {
    isDrawing,
    drawingPoints,
    mousePosition, // 추가됨
    finalPolygon,
    trees,
    setTrees,
    startDrawing,
    addPoint,
    updateMousePosition, // 추가됨
    removeLastPoint,     // 추가됨
    finishDrawing,
    plantTrees,
    reset
  };
};