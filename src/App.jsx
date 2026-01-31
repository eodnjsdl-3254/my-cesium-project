import React, { useState, useCallback, useRef, useEffect } from "react";
import { Viewer } from "resium";
import { useDTMap } from "./hooks/dtmap";
import { useGreeneryDraw } from "./hooks/useGreeneryDraw";
import { UI } from "./components/ui/ui";
import MapController from "./cesium/map";
import VWorld from "./cesium/vworld";

function App() {
  const { map, initMap } = useDTMap();
  const greeneryDraw = useGreeneryDraw();
  
  const [clickedCoord, setClickedCoord] = useState(null);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [isVWorldMode, setIsVWorldMode] = useState(false);
  
  // [핵심 1] 상태(State)와 참조(Ref)를 같이 사용
  const [isGreeneryActive, setIsGreeneryActive] = useState(false);
  const isGreeneryActiveRef = useRef(isGreeneryActive);

  // 상태가 바뀔 때마다 Ref도 최신화
  useEffect(() => {
    isGreeneryActiveRef.current = isGreeneryActive;
    console.log("녹지 모드 상태 변경:", isGreeneryActive); // 디버깅용
  }, [isGreeneryActive]);

  // [핵심 2] Ref를 사용하여 이벤트 즉시 차단
  const handleMapClick = useCallback((coords) => {
    if (isGreeneryActiveRef.current) {
      console.log("녹지 그리기 중이므로 맵 클릭 무시됨");
      return; 
    }
    setClickedCoord(coords);
  }, []);

  const handleBuildingClick = useCallback((info) => {
    if (isGreeneryActiveRef.current) {
      console.log("녹지 그리기 중이므로 건물 클릭 무시됨");
      return;
    }
    setSelectedBuilding(info);
  }, []);

  const handleInit = useCallback((viewer) => {
    initMap(viewer, handleMapClick, handleBuildingClick);
  }, [initMap, handleMapClick, handleBuildingClick]);

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      {isVWorldMode ? (
        <VWorld onClose={() => setIsVWorldMode(false)} />
      ) : (
        <>
          <UI 
            map={map} 
            clickedCoord={clickedCoord} 
            selectedBuilding={selectedBuilding} 
            setSelectedBuilding={setSelectedBuilding}
            onOpenVWorld={() => setIsVWorldMode(true)} 
            greeneryProps={{
              ...greeneryDraw,
              // UI에서 버튼 누르면 이 함수가 실행되어 State와 Ref를 모두 업데이트함
              setIsActive: setIsGreeneryActive,
              isActive: isGreeneryActive
            }}
          />
          
          <Viewer full selectionIndicator={false} infoBox={false}>
            <MapController initMap={handleInit} />
          </Viewer>
        </>
      )}
    </div>
  );
}

export default App;