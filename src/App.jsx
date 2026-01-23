import React, { useState, useCallback } from "react"
import { Viewer} from "resium"
import { useDTMap } from "./hooks/dtmap"
import { UI } from "./components/ui/ui"
import MapController from "./cesium/map"
import VWorld from "./cesium/vworld"

// App.jsx
function App() {
  const { map, initMap } = useDTMap();
  const [clickedCoord, setClickedCoord] = useState(null);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [isVWorldMode, setIsVWorldMode] = useState(false);

  const handleMapClick = useCallback((coords) => {
    setClickedCoord(coords);
  }, []);

  const handleBuildingClick = useCallback((info) => {
    setSelectedBuilding(info);
  }, []);

  const handleInit = useCallback((viewer) => {
    initMap(viewer, handleMapClick, handleBuildingClick);
  }, [initMap, handleMapClick, handleBuildingClick]);

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      
      {/* [핵심] V-World 모드이면 VWorld 컴포넌트만 렌더링 */}
      {isVWorldMode ? (
        <VWorld onClose={() => setIsVWorldMode(false)} />
      ) : (
        /* 기존 세슘 화면 */
        <>
          <UI 
            map={map} 
            clickedCoord={clickedCoord} 
            selectedBuilding={selectedBuilding} 
            setSelectedBuilding={setSelectedBuilding}
            // UI에서 V-World 모드를 켤 수 있게 함수 전달
            onOpenVWorld={() => setIsVWorldMode(true)} 
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