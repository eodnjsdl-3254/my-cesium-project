import React, { useState, useEffect, useCallback } from "react";
import { Viewer, useCesium } from "resium";
import { useDTMap } from "./hooks/dtmap";
import { UI } from "./components/ui";
import MapController from "./cesium/map";

// App.jsx
function App() {
  const { map, initMap } = useDTMap();
  const [clickedCoord, setClickedCoord] = useState(null); // 좌표 저장용 상태

  // 1. 클릭 핸들러를 메모리에 고정
  const handleMapClick = useCallback((coords) => {
    setClickedCoord(coords);
  }, []);

  // 2. 초기화 함수를 메모리에 고정 (가장 중요!)
  const handleInit = useCallback((viewer) => {
    initMap(viewer, handleMapClick);
  }, [initMap, handleMapClick]);

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      <UI map={map} clickedCoord={clickedCoord} /> {/* UI에 좌표 전달 */}
      
      <Viewer 
        full 
        selectionIndicator={false} // 클릭 시 초록색 사각형 안 나오게 함
        infoBox={false}            // 클릭 시 기본 팝업창 안 나오게 함
      >
        {/* Viewer의 자식으로 넣으면 useCesium()을 통해 viewer를 안전하게 가져옵니다. */}
        <MapController initMap={handleInit} />
      </Viewer>
    </div>
  );
}

export default App;