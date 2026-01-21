import React, { useEffect } from "react";
import { Viewer, useCesium } from "resium";
import { useDTMap } from "./hooks/dtmap";
import { UI } from "./components/ui";
import MapController from "./cesium/map";

// App.jsx
function App() {
  const { map, initMap } = useDTMap();

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      <UI map={map} />
      
      <Viewer full>
        {/* Viewer의 자식으로 넣으면 useCesium()을 통해 viewer를 안전하게 가져옵니다. */}
        <MapController initMap={initMap} />
      </Viewer>
    </div>
  );
}

export default App;