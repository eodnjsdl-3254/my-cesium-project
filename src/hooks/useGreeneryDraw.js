import { useState } from "react";
import { Cartesian3 } from "cesium";

export const useGreeneryDraw = () => {
  const [isDrawing, setIsDrawing] = useState(false); 
  const [drawingPoints, setDrawingPoints] = useState([]);
  const [finalPolygon, setFinalPolygon] = useState(null);
  const [trees, setTrees] = useState([]);

  const startDrawing = () => {
    setFinalPolygon(null);
    setTrees([]);
    setDrawingPoints([]);
    setIsDrawing(true);
  };

  const addPoint = (position) => {
    if (!isDrawing || !position) return;

    //  좌표 유효성 검사
    if (typeof position.x !== 'number' || isNaN(position.x)) return;

    // 중복 클릭 방지 (이전 점과 거리가 1m 미만이면 무시)
    // 이 로직이 없으면 더블 클릭 시 에러가 발생합니다.
    if (drawingPoints.length > 0) {
      const lastPoint = drawingPoints[drawingPoints.length - 1];
      if (Cartesian3.distance(lastPoint, position) < 1.0) {
        return;
      }
    }

    setDrawingPoints((prev) => [...prev, position]);
  };

  const finishDrawing = () => {
    if (drawingPoints.length < 3) {
      alert("최소 3개 이상의 지점을 클릭해야 영역을 만들 수 있습니다.");
      setDrawingPoints([]);
      setIsDrawing(false);
      return;
    }
    setFinalPolygon([...drawingPoints]);
    setDrawingPoints([]);
    setIsDrawing(false); 
  };

  const plantTrees = (count) => {
    if (!finalPolygon) {
      alert("먼저 녹지 영역을 그려주세요.");
      return;
    }
    const newTrees = [];
    for (let i = 0; i < count; i++) {
      const randomIndex = Math.floor(Math.random() * finalPolygon.length);
      const basePos = finalPolygon[randomIndex];
      
      // 랜덤 오프셋 적용
      const offsetPos = new Cartesian3(
        basePos.x + (Math.random() - 0.5) * 150,
        basePos.y + (Math.random() - 0.5) * 150,
        basePos.z
      );
      
      // PNG 이미지 사용
      newTrees.push({
        position: offsetPos,
        image: Math.random() > 0.5 ? "/green/tree1.png" : "/green/tree2.png"
      });
    }
    setTrees(newTrees);
  };

  const reset = () => {
    setFinalPolygon(null);
    setTrees([]);
    setDrawingPoints([]);
    setIsDrawing(false);
  };

  return { isDrawing, drawingPoints, finalPolygon, trees, startDrawing, addPoint, finishDrawing, plantTrees, reset };
};