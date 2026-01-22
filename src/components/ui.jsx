import React, { useState } from 'react'

export const UI = ({ map, clickedCoord }) => {
  const [baseMapType, setBaseMapType] = useState("OSM");
  const [showVworld, setShowVworld] = useState(false);
  const [vworldType, setVworldType] = useState("Base");
  const [buildingStyle, setBuildingStyle] = useState("DEFAULT");
  
  // 🚩 건물이 꺼져있는 상태(false)로 시작
  const [showBuildings, setShowBuildings] = useState(false); 
  const [isTracking, setIsTracking] = useState(false);

  const handleBaseMapChange = (e) => {
    const newType = e.target.value;
    setBaseMapType(newType);
    map?.changeBaseMap(newType);
  };

  const handleVworldTypeChange = (e) => {
    const newType = e.target.value;
    setVworldType(newType);
    if (showVworld) {
      map?.toggleVworldImagery(true, newType);
    }
  };

  const handleToggleTracking = () => {
    if (!map) return;
    const nextMode = !isTracking;
    map.setTrackingMode(nextMode);
    setIsTracking(nextMode);
  };

  return (
    <>
      <div style={{ position: "absolute", zIndex: 10, top: 10, left: 10, display: "flex", gap: "5px", flexWrap: "wrap", alignItems: "center" }}>
        
        {/* 베이스맵 선택 */}
        <select 
          value={baseMapType} 
          onChange={handleBaseMapChange}
          style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc", cursor: "pointer", fontWeight: "bold" }}
        >
          <option value="OSM">🗺️ 일반 지도 (OSM)</option>
          <option value="SATELLITE">🛰️ 위성 지도</option>
          <option value="NONE">🌑 배경 없음</option>
        </select>

        <button onClick={() => map?.camera.viewHome()}>홈으로</button>
        <button onClick={() => map?.focusLocation(37.6585, 126.8320, "고양시청")}>고양 이동</button>

        {/* V-world 제어 그룹 */}
        <div style={{ display: "flex", gap: "2px", border: "1px solid #ddd", padding: "2px", borderRadius: "4px", background: "rgba(255,255,255,0.8)" }}>
          <select 
            value={vworldType} 
            onChange={handleVworldTypeChange}
            style={{ border: "none", background: "transparent", fontWeight: "bold", cursor: "pointer" }}
          >
            <option value="Base">VWorld-일반</option>
            <option value="Satellite">VWorld-위성</option>
            <option value="Hybrid">VWorld-복합</option>
            {/* Midnight은 에러가 잦아 제거 권장 */}
          </select>
          <button 
            onClick={() => {
              const next = !showVworld;
              setShowVworld(next);
              map?.toggleVworldImagery(next, vworldType);
            }}
            style={{ backgroundColor: showVworld ? "#2196F3" : "#ccc", color: "white", border: "none", borderRadius: "2px", cursor: "pointer", padding: "0 10px" }}
          >
            {showVworld ? "ON" : "OFF"}
          </button>
        </div>

        {/* 3D 건물 제어 그룹 */}
        <div style={{ display: "flex", gap: "2px", border: "1px solid #ddd", padding: "2px", borderRadius: "4px", background: "rgba(255,255,255,0.8)" }}>
          <button 
            onClick={() => {
              const next = !showBuildings;
              setShowBuildings(next);
              map?.toggleVworldBuildings(next);
            }}
            style={{ backgroundColor: showBuildings ? "#9C27B0" : "#ccc", color: "white", border: "none", borderRadius: "2px", cursor: "pointer", padding: "5px 10px" }}
          >
            {showBuildings ? "건물 ON" : "건물 OFF"}
          </button>
          
          <button 
            onClick={() => {
              if (!showBuildings) return;
              const nextStyle = buildingStyle === "DEFAULT" ? "HEIGHT" : "DEFAULT";
              setBuildingStyle(nextStyle);
              map?.styleOsmBuildings(nextStyle);
            }}
            style={{ backgroundColor: buildingStyle === "HEIGHT" ? "#FF9800" : "#ccc", color: "white", border: "none", borderRadius: "2px", cursor: "pointer", padding: "5px 10px" }}
          >
            {buildingStyle === "HEIGHT" ? "색상 끄기" : "높이 분석"}
          </button>
        </div>

        {/* 추적 모드 */}
        <button 
          onClick={handleToggleTracking} 
          style={{ backgroundColor: isTracking ? "#4CAF50" : "#f44336", color: "white", padding: "8px 12px", borderRadius: "4px", border: "none", cursor: "pointer" }}
        >
          추적 모드: {isTracking ? "ON" : "OFF"}
        </button>

        <button onClick={() => map?.data.clearAll()} style={{ cursor: "pointer" }}>데이터 삭제</button>
      </div>

      {clickedCoord && (
        <div style={{
          position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
          backgroundColor: "rgba(0,0,0,0.7)", color: "white", padding: "10px 20px",
          borderRadius: "20px", fontSize: "14px", zIndex: 10
        }}>
          📍 경도 {clickedCoord.lon.toFixed(6)} / 위도 {clickedCoord.lat.toFixed(6)}
        </div>
      )}
    </>
  );
};