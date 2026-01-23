import React, { useState } from 'react'

export const UI = ({ map, clickedCoord, selectedBuilding, setSelectedBuilding, onOpenVWorld }) => {
  
  // 상태 관리
  const [baseMapType, setBaseMapType] = useState("OSM");
  const [showVworld, setShowVworld] = useState(false);
  const [vworldType, setVworldType] = useState("Base");
  const [buildingMode, setBuildingMode] = useState("NONE"); // 건물 모드 ("NONE", "OSM", "VWORLD")
  const [buildingStyle, setBuildingStyle] = useState("DEFAULT");  
  const [isTracking, setIsTracking] = useState(false);
  const [isMarkerMode, setIsMarkerMode] = useState(false);

  // 핸들러: 건물 모드 변경
  const handleBuildingChange = (mode) => {
    // V-World 버튼을 누르면 -> 세슘 모드를 끄고 -> V-World 전용화면으로 전환
    if (mode === "VWORLD") {
      if (onOpenVWorld) onOpenVWorld(); // App.jsx의 상태 변경
      return;
    }

    setBuildingMode(mode);
    map?.setBuildingMode(mode);
  };

  // 핸들러: 베이스맵
  const handleBaseMapChange = (e) => {
    setBaseMapType(e.target.value);
    map?.changeBaseMap(e.target.value);
  };

  // 핸들러: V-World 2D
  const handleVworldTypeChange = (e) => {
    setVworldType(e.target.value);
    if (showVworld) map?.toggleVworldImagery(true, e.target.value);
  };

  return (
    <>
      {/* 상단 컨트롤 바 */}
      <div style={{ position: "absolute", zIndex: 10, top: 10, left: 10, display: "flex", gap: "5px", flexWrap: "wrap", alignItems: "center" }}>
        
        {/* 1. 베이스맵 */}
        <select value={baseMapType} onChange={handleBaseMapChange} style={selectStyle}>
          <option value="OSM">🗺️ 일반 지도 (OSM)</option>
          <option value="SATELLITE">🛰️ 위성 지도 (Cesium)</option>
          <option value="NONE">🌑 배경 없음</option>
        </select>

        {/* 2. 이동 버튼 */}
        <button onClick={() => map?.camera.viewHome()} style={btnStyle}>홈</button>
        <button onClick={() => map?.focusLocation(37.6585, 126.8320, "고양시청")} style={btnStyle}>고양 이동</button>

        {/* 3. V-World 2D 레이어 */}
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

        {/* 4. 건물 제어 */}
        <div style={groupStyle}>
          <span style={{ fontSize: "12px", padding: "0 5px", color: "#666", fontWeight: "bold" }}>🏢 건물:</span>
          
          <button onClick={() => handleBuildingChange("NONE")}
            style={{ ...toggleBtnStyle, backgroundColor: buildingMode === "NONE" ? "#555" : "#ccc" }}>
            OFF
          </button>

          <button onClick={() => handleBuildingChange("OSM")}
            style={{ ...toggleBtnStyle, backgroundColor: buildingMode === "OSM" ? "#9C27B0" : "#ccc" }}>
            분석(OSM)
          </button>
          
          <button onClick={() => handleBuildingChange("VWORLD")}
            style={{ ...toggleBtnStyle, backgroundColor: buildingMode === "VWORLD" ? "#4285F4" : "#ccc" }}>
            실사(V-World)
          </button>

          <button onClick={() => handleBuildingChange("GOOGLE")}
            style={{ ...toggleBtnStyle, backgroundColor: buildingMode === "GOOGLE" ? "#EA4335" : "#ccc" }}>
            구글(해외)
          </button>
        </div>

        {/* OSM 분석 도구 */}
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

        {/* 5. 마커 모드 */}
        <button onClick={() => {
            const next = !isMarkerMode;
            setIsMarkerMode(next);
            map?.setMarkerMode(next);
          }}
          style={{ 
            ...btnStyle, 
            backgroundColor: isMarkerMode ? "#FFEB3B" : "white", 
            border: isMarkerMode ? "2px solid #FBC02D" : "none" 
          }}>
          {isMarkerMode ? "📍 마커: ON" : "📍 마커: OFF"}
        </button>

        {/* 6. 추적 모드 */}
        <button onClick={() => {
            const next = !isTracking;
            setIsTracking(next);
            map?.setTrackingMode(next);
          }}
          style={{ ...btnStyle, backgroundColor: isTracking ? "#4CAF50" : "white", color: isTracking ? "white" : "black" }}>
          {isTracking ? "📡 추적 중" : "📡 추적 모드"}
        </button>

        <button onClick={() => map?.data.clearAll()} style={btnStyle}>데이터 삭제</button>
      </div>

      {/* 정보창 (Props 사용) */}
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
        <div style={coordBarStyle}>
          📍 경도 {clickedCoord.lon.toFixed(6)} / 위도 {clickedCoord.lat.toFixed(6)}
        </div>
      )}
    </>
  );
};

// 스타일 (동일)
const btnStyle = { padding: "8px 12px", borderRadius: "4px", border: "none", cursor: "pointer", background: "white", fontWeight: "bold", boxShadow: "0 2px 4px rgba(0,0,0,0.2)", fontSize: "12px" };
const selectStyle = { padding: "8px", borderRadius: "4px", border: "1px solid #ccc", fontWeight: "bold", cursor: "pointer", fontSize: "12px" };
const groupStyle = { display: "flex", gap: "2px", border: "1px solid #ddd", padding: "2px", borderRadius: "4px", background: "rgba(255,255,255,0.8)", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", alignItems: "center" };
const innerSelectStyle = { border: "none", background: "transparent", fontWeight: "bold", cursor: "pointer", fontSize: "12px" };
const toggleBtnStyle = { color: "white", border: "none", borderRadius: "2px", padding: "5px 10px", cursor: "pointer", fontSize: "12px" };
const infoCardStyle = { position: "absolute", top: 10, right: 10, width: "220px", background: "rgba(0,0,0,0.8)", color: "white", padding: "15px", borderRadius: "8px", zIndex: 10, fontSize: "14px", border: "1px solid #444" };
const coordBarStyle = { position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.7)", color: "white", padding: "10px 20px", borderRadius: "20px", fontSize: "14px", zIndex: 10 };