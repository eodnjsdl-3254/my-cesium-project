import React, { useState, useEffect } from 'react' // [수정] useEffect 추가 필수
import SimulationPanel from './SimulationPanel';
import GreenerySimulationPanel from './GreenerySimulationPanel';

export const UI = ({ map, clickedCoord, selectedBuilding, setSelectedBuilding, onOpenVWorld, greeneryProps }) => {
  
  // 1. 상태 관리
  const [baseMapType, setBaseMapType] = useState("OSM");
  const [showVworld, setShowVworld] = useState(false);
  const [vworldType, setVworldType] = useState("Base");
  const [buildingMode, setBuildingMode] = useState("NONE");
  const [buildingStyle, setBuildingStyle] = useState("DEFAULT");  
  const [isTracking, setIsTracking] = useState(false);
  const [isMarkerMode, setIsMarkerMode] = useState(false);
  const [showSimulation, setShowSimulation] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  // 2. 녹지 시뮬레이션 상태
  const [showGreeneryPanel, setShowGreeneryPanel] = useState(false);
  const [treeCount, setTreeCount] = useState(100);

  // [기능 보완] 그리기 모드일 때 커서 모양 변경 (십자선)
  useEffect(() => {
    if (greeneryProps && greeneryProps.isDrawing) {
      document.body.style.cursor = 'crosshair';
    } else {
      document.body.style.cursor = 'default';
    }
  }, [greeneryProps?.isDrawing]);

  // 3. 핸들러들
  const handleSimulationSelect = (buildingProps) => {
    if (showGreeneryPanel) return; // 녹지 모드 중에는 건물 선택 차단
    setEditTarget(buildingProps);
    setShowSimulation(true);
  };

  if (map && !map.onSimulationSelect) {
     map.onSimulationSelect = handleSimulationSelect;
  }

  const handleClosePanel = () => {
    setShowSimulation(false);
    setEditTarget(null);
  };

  const handleBuildingChange = (mode) => {
    if (mode === "VWORLD") {
      if (onOpenVWorld) onOpenVWorld();
      return;
    }
    setBuildingMode(mode);
    map?.setBuildingMode(mode);
  };

  const handleBaseMapChange = (e) => {
    setBaseMapType(e.target.value);
    map?.changeBaseMap(e.target.value);
  };

  const handleVworldTypeChange = (e) => {
    setVworldType(e.target.value);
    if (showVworld) map?.toggleVworldImagery(true, e.target.value);
  };

  return (
    <>
      {/* 상단 컨트롤 바 */}
      <div style={{ position: "absolute", zIndex: 10, top: 10, left: 10, display: "flex", gap: "5px", flexWrap: "wrap", alignItems: "center" }}>
        
        {/* 베이스맵 선택 */}
        <select value={baseMapType} onChange={handleBaseMapChange} style={selectStyle}>
          <option value="OSM">🗺️ 일반 지도 (OSM)</option>
          <option value="SATELLITE">🛰️ 위성 지도 (Cesium)</option>
          <option value="NONE">🌑 배경 없음</option>
        </select>

        <button onClick={() => map?.camera.viewHome()} style={btnStyle}>홈</button>
        <button onClick={() => map?.focusLocation(37.6585, 126.8320, "고양시청")} style={btnStyle}>고양 이동</button>

        {/* V-World 레이어 */}
        <div style={groupStyle}>
          <select value={vworldType} onChange={handleVworldTypeChange} style={innerSelectStyle}>
            <option value="Base">VWorld-일반</option>
            <option value="Satellite">VWorld-위성</option>
            <option value="Hybrid">VWorld-복합</option>
          </select>
          <button onClick={() => { 
              const next = !showVworld; 
              setShowVworld(next); 
              map?.toggleVworldImagery(next, vworldType); 
            }} 
            style={{ ...toggleBtnStyle, backgroundColor: showVworld ? "#2196F3" : "#ccc" }}>
            2D: {showVworld ? "ON" : "OFF"}
          </button>
        </div>

        {/* 건물 제어 */}
        <div style={groupStyle}>
          <span style={{ fontSize: "12px", padding: "0 5px", color: "#666", fontWeight: "bold" }}>🏢 건물:</span>
          <button onClick={() => handleBuildingChange("NONE")} style={{ ...toggleBtnStyle, backgroundColor: buildingMode === "NONE" ? "#555" : "#ccc" }}>OFF</button>
          <button onClick={() => handleBuildingChange("OSM")} style={{ ...toggleBtnStyle, backgroundColor: buildingMode === "OSM" ? "#9C27B0" : "#ccc" }}>분석(OSM)</button>
          <button onClick={() => handleBuildingChange("VWORLD")} style={{ ...toggleBtnStyle, backgroundColor: buildingMode === "VWORLD" ? "#4285F4" : "#ccc" }}>실사(V-World)</button>
          <button onClick={() => handleBuildingChange("GOOGLE")} style={{ ...toggleBtnStyle, backgroundColor: buildingMode === "GOOGLE" ? "#EA4335" : "#ccc" }}>구글(해외)</button>
        </div>

        {/* OSM 높이 스타일 */}
        {buildingMode === "OSM" && (
           <button onClick={() => { 
               const nextStyle = buildingStyle === "DEFAULT" ? "HEIGHT" : "DEFAULT"; 
               setBuildingStyle(nextStyle); 
               map?.styleOsmBuildings(nextStyle); 
             }}
             style={{ ...toggleBtnStyle, backgroundColor: buildingStyle === "HEIGHT" ? "#FF9800" : "#666" }}>
             📊 높이 색상
           </button>
        )}

        {/* 마커 모드 */}
        <button onClick={() => {
            const next = !isMarkerMode;
            setIsMarkerMode(next);
            map?.setMarkerMode(next);
          }}
          style={{ ...btnStyle, backgroundColor: isMarkerMode ? "#FFEB3B" : "white", border: isMarkerMode ? "2px solid #FBC02D" : "none" }}>
          {isMarkerMode ? "📍 마커: ON" : "📍 마커: OFF"}
        </button>

        {/* 추적 모드 */}
        <button onClick={() => {
            const next = !isTracking;
            setIsTracking(next);
            map?.setTrackingMode(next);
          }}
          style={{ ...btnStyle, backgroundColor: isTracking ? "#4CAF50" : "white", color: isTracking ? "white" : "black" }}>
          {isTracking ? "📡 추적 중" : "📡 추적 모드"}
        </button>

        {/* 녹지 모드 토글 버튼 */}
        <button 
          onClick={() => {
            const next = !showGreeneryPanel;
            setShowGreeneryPanel(next);
            
            // App.jsx로 상태 전파
            if (greeneryProps && typeof greeneryProps.setIsActive === "function") {
              greeneryProps.setIsActive(next);
            }

            if (next) {
              // 켤 때: 다른 패널 닫기
              setSelectedBuilding(null);
              setShowSimulation(false);
            } else {
              // [보완] 끌 때: 그리기 상태 초기화 (안전장치)
              if (greeneryProps && typeof greeneryProps.reset === "function") {
                greeneryProps.reset();
              }
            }
          }}
          style={{ 
            ...btnStyle, 
            backgroundColor: showGreeneryPanel ? "#2ecc71" : "white", 
            color: showGreeneryPanel ? "white" : "black",
            border: showGreeneryPanel ? "2px solid #145a32" : "none"
          }}
        >
          🌿 녹지 시뮬레이션: {showGreeneryPanel ? "ON" : "OFF"}
        </button>

        <button onClick={() => map?.data.clearAll()} style={btnStyle}>데이터 삭제</button>
      </div>

      {/* 정보창 */}
      {selectedBuilding && (
        <div style={infoCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>🏢 건물 정보</h3>
            <button onClick={() => setSelectedBuilding(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'white' }}>✖</button>
          </div>
          <hr />
          <p><strong>명칭:</strong> {selectedBuilding.name || "정보 없음"}</p>
          <p><strong>높이:</strong> {selectedBuilding.height ? `${selectedBuilding.height}m` : "데이터 없음"}</p>
          <p><strong>용도:</strong> {selectedBuilding.type || "알 수 없음"}</p>
        </div>
      )}

      {/* 좌표 바 */}
      {clickedCoord && (
        <div style={coordBarStyle}>📍 경도 {clickedCoord.lon.toFixed(6)} / 위도 {clickedCoord.lat.toFixed(6)}</div>
      )}
      
      {/* 편집 시뮬레이션 버튼 (녹지 모드 아닐 때만 노출) */}
      {!showGreeneryPanel && (
        <div style={{ position: "absolute", top: 20, right: 20, zIndex: 1000 }}>
          <button 
            onClick={() => setShowSimulation(!showSimulation)}
            style={{ padding: "10px 20px", background: "#673AB7", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", boxShadow: "0 2px 5px rgba(0,0,0,0.3)" }}
          >
            🛠️ 편집 시뮬레이션
          </button>
        </div>
      )}

      {/* 건물 편집 패널 */}
      {showSimulation && (
        <SimulationPanel 
            map={map} 
            selectedBuilding={editTarget} 
            onClose={handleClosePanel} 
            onUpdate={() => setEditTarget(null)} 
        />
      )}
      
      {/* 녹지 시뮬레이션 패널 */}
      {showGreeneryPanel && (
        <GreenerySimulationPanel 
            isDrawing={greeneryProps.isDrawing}
            onStartDraw={greeneryProps.startDrawing}
            onPlant={greeneryProps.plantTrees} 
            treeCount={treeCount} 
            setTreeCount={setTreeCount} 
            onReset={greeneryProps.reset} 
            // 탄소 흡수량 데이터 전달 (예시: 나무당 8.2kg)
            carbonAbsorption={(treeCount * 8.2).toLocaleString(undefined, { maximumFractionDigits: 1 })}
        />
      )}

      {/* 그리기 모드 안내 배너 */}
      {showGreeneryPanel && greeneryProps.isDrawing && (
        <div style={{
          position: 'absolute', top: '70px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(52, 152, 219, 0.9)', color: 'white', padding: '8px 25px',
          borderRadius: '20px', zIndex: 1000, fontWeight: 'bold', boxShadow: "0 4px 10px rgba(0,0,0,0.3)"
        }}>
          🎯 지도 위를 클릭하여 영역을 그리세요 (더블 클릭으로 완료)
        </div>
      )}
    </>
  );
};

// 스타일 상수
const btnStyle = { padding: "8px 12px", borderRadius: "4px", border: "none", cursor: "pointer", background: "white", fontWeight: "bold", boxShadow: "0 2px 4px rgba(0,0,0,0.2)", fontSize: "12px" };
const selectStyle = { padding: "8px", borderRadius: "4px", border: "1px solid #ccc", fontWeight: "bold", cursor: "pointer", fontSize: "12px" };
const groupStyle = { display: "flex", gap: "2px", border: "1px solid #ddd", padding: "2px", borderRadius: "4px", background: "rgba(255,255,255,0.8)", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", alignItems: "center" };
const innerSelectStyle = { border: "none", background: "transparent", fontWeight: "bold", cursor: "pointer", fontSize: "12px" };
const toggleBtnStyle = { color: "white", border: "none", borderRadius: "2px", padding: "5px 10px", cursor: "pointer", fontSize: "12px" };
const infoCardStyle = { position: "absolute", top: 10, right: 10, width: "220px", background: "rgba(0,0,0,0.8)", color: "white", padding: "15px", borderRadius: "8px", zIndex: 10, fontSize: "14px", border: "1px solid #444" };
const coordBarStyle = { position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.7)", color: "white", padding: "10px 20px", borderRadius: "20px", fontSize: "14px", zIndex: 10 };