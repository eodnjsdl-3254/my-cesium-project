import { useState, useCallback } from "react"
import { Map3D } from "../cesium/facade/map"

export const useDTMap = () => {
  const [map, setMap] = useState(null);

  const initMap = useCallback((viewer) => {
    // 1. 함수 호출 자체를 확인
    console.log("🚩 [Hook] initMap 호출됨"); 

    if (viewer && !map) {
      try {
        console.log("🚩 [Hook] Map3D 인스턴스 생성 시도");
        const instance = new Map3D(viewer);
        
        console.log("🚩 [Hook] 인스턴스 생성 성공:", instance);
        setMap(instance);
      } catch (error) {
        console.error("🚩 [Hook] Map3D 생성 실패:", error);
      }
    }
  }, []); // 의존성 배열을 비워서 한 번만 생성되도록 설정

  return { map, initMap };
};