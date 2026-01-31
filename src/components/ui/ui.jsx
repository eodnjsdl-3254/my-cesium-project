import React, { useState, useEffect } from 'react';
import SimulationPanel from './SimulationPanel';
import GreenerySimulationPanel from './GreenerySimulationPanel';

export const UI = ({ map, clickedCoord, selectedBuilding, setSelectedBuilding, onOpenVWorld }) => {
  
  // =================================================================
  // 1. 상태 관리 (State Management)
  // =================================================================
  // [기본 지도 상태]
  const [baseMapType, setBaseMapType] = useState("OSM");
  const [showVworld, setShowVworld] = useState(false);
  const [vworldType, setVworldType] = useState("Base");
  const [buildingMode, setBuildingMode] = useState("NONE");
  const [buildingStyle, setBuildingStyle] = useState("DEFAULT");  
  const [isTracking, setIsTracking] = useState(false);
  const [isMarkerMode, setIsMarkerMode] = useState(false);
  
  // [건물 편집 상태]
  const [showSimulation, setShowSimulation] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  // [녹지 시뮬레이션 상태]
  const [showGreeneryPanel, setShowGreeneryPanel] = useState(false);
  const [isUiDrawing, setIsUiDrawing] = useState(false); // UI 상의 그리기 상태 표시용
  const [treeCount, setTreeCount] = useState(100);

  // =================================================================
  // 2. 효과 (Effect)
  // =================================================================
  // 녹지 그리기 모드일 때 마우스 커서 변경
  useEffect(() => {
    if (isUiDrawing) {
      document.body.style.cursor = 'crosshair';
    } else {
      document.body.style.cursor = 'default';
    }
  }, [isUiDrawing]);

  // =================================================================
  // 3. 녹지 관련 핸들러 (Manager 패턴 적용)
  // =================================================================
  
  // A. 그리기 시작 (재시작)
  const handleStartDraw = () => {
    if (!map) return;
    setIsUiDrawing(true);
    
    // Map3D(Manager)에게 그리기 시작 명령
    // 콜백함수: 그리기가 완료(더블클릭)되면 실행됨
    map.startGreenerySimulation(() => {
        console.log("✅ 그리기 완료 (UI 상태 업데이트)");
        setIsUiDrawing(false); 
    });
  };

  // B. 녹지 패널 토글 (켜기/끄기)
  const toggleGreeneryPanel = () => {
    const nextState = !showGreeneryPanel;
    setShowGreeneryPanel(nextState);

    if (map) {
        // 1. 건물 클릭 방지 모드 설정
        map.setGreeneryMode(nextState);

        if (nextState) {
            // [ON] 켜질 때: 건물 편집 UI 모두 닫기
            setShowSimulation(false);
            setEditTarget(null);
            setSelectedBuilding(null);
            
            // 자동으로 그리기 모드 시작
            handleStartDraw();
        } else {
            // [OFF] 꺼질 때: 초기화
            setIsUiDrawing(false);
            map.stopGreenerySimulation(); 
        }
    }
  };

  // C. 나무 심기
  const handlePlantTrees = (count) => {
    if (isUiDrawing) {
        alert("먼저 영역 그리기를 완료해주세요 (지도 더블클릭).");
        return;
    }
    if (map) map.plantTrees(count);
  };

  // =================================================================
  // 4. 기존 지도 핸들러 (유지)
  // =================================================================
  
  // 건물 선택 (녹지 모드일 땐 무시)
  const handleSimulationSelect = (buildingProps) => {
    if (showGreeneryPanel) return; // 차단
    setEditTarget(buildingProps);
    setShowSimulation(true);
  };

  // Map3D에 이벤트 연결
  if (map && !map.onSimulationSelect) {
     map.onSimulationSelect = handleSimulationSelect;
  }

  const handleClosePanel = () => {
    setShowSimulation(false);
    setEditTarget(null);
  };

  const handleBuildingChange = (mode) => {
    if (mode === "VWORLD") { if (onOpenVWorld) onOpenVWorld(); return; }
    setBuildingMode(mode); map?.setBuildingMode(mode);
  };
  const handleBaseMapChange = (e) => { setBaseMapType(e.target.value); map?.changeBaseMap(e.target.value); };
  const handleVworldTypeChange = (e) => { setVworldType(e.target.value); if (showVworld) map?.toggleVworldImagery(true, e.target.value); };

  // =================================================================
  // 5. 렌더링 (Render)
  // =================================================================
  return (
    <>
      {/* ───────────────────────────────────────────────────────────── */}
      {/* A. 상단 컨트롤 바 (기존 버튼 100% 유지) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div style={{ position: "absolute", zIndex: 10, top: 10, left: 10, display: "flex", gap: "5px", flexWrap: "wrap", alignItems: "center" }}>
        
        {/* 1. 베이스맵 */}
        <select value={baseMapType} onChange={handleBaseMapChange} style={selectStyle}>
          <option value="OSM">🗺️ 일반 지도 (OSM)</option>
          <option value="SATELLITE">🛰️ 위성 지도 (Cesium)</option>
          <option value="NONE">🌑 배경 없음</option>
        </select>

        {/* 2. 카메라 이동 */}
        <button onClick={() => map?.camera.viewHome()} style={btnStyle}>홈</button>
        <button onClick={() => map?.focusLocation(37.6585, 126.8320, "고양시청")} style={btnStyle}>고양 이동</button>

        {/* 3. V-World 2D */}
        <div style={groupStyle}>
          <select value={vworldType} onChange={handleVworldTypeChange} style={innerSelectStyle}>
            <option value="Base">VWorld-일반</option>
            <option value="Satellite">VWorld-위성</option>
            <option value="Hybrid">VWorld-복합</option>
          </select>
          <button onClick={() => { const next = !showVworld; setShowVworld(next); map?.toggleVworldImagery(next, vworldType); }} 
            style={{ ...toggleBtnStyle, backgroundColor: showVworld ? "#2196F3" : "#ccc" }}>
            2D: {showVworld ? "ON" : "OFF"}
          </button>
        </div>

        {/* 4. 건물 모드 */}
        <div style={groupStyle}>
          <span style={{ fontSize: "12px", padding: "0 5px", color: "#666", fontWeight: "bold" }}>🏢 건물:</span>
          <button onClick={() => handleBuildingChange("NONE")} style={{ ...toggleBtnStyle, backgroundColor: buildingMode === "NONE" ? "#555" : "#ccc" }}>OFF</button>
          <button onClick={() => handleBuildingChange("OSM")} style={{ ...toggleBtnStyle, backgroundColor: buildingMode === "OSM" ? "#9C27B0" : "#ccc" }}>분석</button>
          <button onClick={() => handleBuildingChange("VWORLD")} style={{ ...toggleBtnStyle, backgroundColor: buildingMode === "VWORLD" ? "#4285F4" : "#ccc" }}>실사</button>
          <button onClick={() => handleBuildingChange("GOOGLE")} style={{ ...toggleBtnStyle, backgroundColor: buildingMode === "GOOGLE" ? "#EA4335" : "#ccc" }}>구글</button>
        </div>

        {/* 5. 높이 스타일 (OSM 전용) */}
        {buildingMode === "OSM" && (
           <button onClick={() => { const nextStyle = buildingStyle === "DEFAULT" ? "HEIGHT" : "DEFAULT"; setBuildingStyle(nextStyle); map?.styleOsmBuildings(nextStyle); }} 
             style={{ ...toggleBtnStyle, backgroundColor: buildingStyle === "HEIGHT" ? "#FF9800" : "#666" }}>
             📊 높이
           </button>
        )}

        {/* 6. 마커 모드 */}
        <button onClick={() => { const next = !isMarkerMode; setIsMarkerMode(next); map?.setMarkerMode(next); }} 
          style={{ ...btnStyle, backgroundColor: isMarkerMode ? "#FFEB3B" : "white", border: isMarkerMode ? "2px solid #FBC02D" : "none" }}>
          {isMarkerMode ? "📍 마커: ON" : "📍 마커: OFF"}
        </button>

        {/* 7. 추적 모드 */}
        <button onClick={() => { const next = !isTracking; setIsTracking(next); map?.setTrackingMode(next); }} 
          style={{ ...btnStyle, backgroundColor: isTracking ? "#4CAF50" : "white", color: isTracking ? "white" : "black" }}>
          {isTracking ? "📡 추적 중" : "📡 추적 모드"}
        </button>
        
        {/* 8. 🔥 [녹지 모드 버튼] */}
        <button 
          onClick={toggleGreeneryPanel} 
          style={{ 
            ...btnStyle, 
            backgroundColor: showGreeneryPanel ? "#2ecc71" : "white", 
            color: showGreeneryPanel ? "white" : "black",
            border: showGreeneryPanel ? "2px solid #145a32" : "none"
          }}
        >
          🌿 녹지 시뮬레이션: {showGreeneryPanel ? "ON" : "OFF"}
        </button>

        {/* 9. 초기화 */}
        <button onClick={() => map?.data.clearAll()} style={btnStyle}>데이터 삭제</button>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* B. 정보창 및 좌표바 */}
      {/* ───────────────────────────────────────────────────────────── */}
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

      {clickedCoord && (
        <div style={coordBarStyle}>📍 경도 {clickedCoord.lon.toFixed(6)} / 위도 {clickedCoord.lat.toFixed(6)}</div>
      )}
      
      {/* ───────────────────────────────────────────────────────────── */}
      {/* C. [핵심] 패널 분기 (삼항 연산자) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showGreeneryPanel ? (
        /* 🌿 CASE 1: 녹지 시뮬레이션 모드 */
        <>
          <GreenerySimulationPanel 
            isDrawing={isUiDrawing}       // UI 상태 전달 (greeneryProps 안 씀)
            onStartDraw={handleStartDraw} // 재시작 핸들러
            onPlant={handlePlantTrees}    // 나무심기 핸들러
            onReset={handleStartDraw}     // 그리기 취소 -> 다시 그리기
            treeCount={treeCount} 
            setTreeCount={setTreeCount} 
            carbonAbsorption={(treeCount * 8.2).toLocaleString(undefined, { maximumFractionDigits: 1 })}
          />
          
          {/* 안내 배너 */}
          {isUiDrawing && (
            <div style={bannerStyle}>
              🎯 지도 위를 클릭하여 영역을 그리세요 (우클릭: 점취소 / 더블클릭: 완료)
            </div>
          )}
        </>
      ) : (
        /* 🏢 CASE 2: 건물 편집 모드 (기본) */
        <>
          {/* 패널이 닫혀있을 때만 버튼 노출 */}
          {!showSimulation && (
            <div style={{ position: "absolute", top: 20, right: 20, zIndex: 1000 }}>
              <button 
                onClick={() => setShowSimulation(true)}
                style={{ padding: "10px 20px", background: "#673AB7", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", boxShadow: "0 2px 5px rgba(0,0,0,0.3)" }}
              >
                🛠️ 편집 시뮬레이션
              </button>
            </div>
          )}

          {/* 패널 */}
          {showSimulation && (
            <SimulationPanel 
               map={map} 
               selectedBuilding={editTarget} 
               onClose={handleClosePanel} 
               onUpdate={() => setEditTarget(null)} 
            />
          )}
        </>
      )}
    </>
  );
};

// 스타일 상수 (변경 없음)
const btnStyle = { padding: "8px 12px", borderRadius: "4px", border: "none", cursor: "pointer", background: "white", fontWeight: "bold", boxShadow: "0 2px 4px rgba(0,0,0,0.2)", fontSize: "12px" };
const selectStyle = { padding: "8px", borderRadius: "4px", border: "1px solid #ccc", fontWeight: "bold", cursor: "pointer", fontSize: "12px" };
const groupStyle = { display: "flex", gap: "2px", border: "1px solid #ddd", padding: "2px", borderRadius: "4px", background: "rgba(255,255,255,0.8)", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", alignItems: "center" };
const innerSelectStyle = { border: "none", background: "transparent", fontWeight: "bold", cursor: "pointer", fontSize: "12px" };
const toggleBtnStyle = { color: "white", border: "none", borderRadius: "2px", padding: "5px 10px", cursor: "pointer", fontSize: "12px" };
const infoCardStyle = { position: "absolute", top: 10, right: 10, width: "220px", background: "rgba(0,0,0,0.8)", color: "white", padding: "15px", borderRadius: "8px", zIndex: 10, fontSize: "14px", border: "1px solid #444" };
const coordBarStyle = { position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.7)", color: "white", padding: "10px 20px", borderRadius: "20px", fontSize: "14px", zIndex: 10 };
const bannerStyle = { position: 'absolute', top: '70px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(52, 152, 219, 0.9)', color: 'white', padding: '8px 25px', borderRadius: '20px', zIndex: 1000, fontWeight: 'bold', boxShadow: "0 4px 10px rgba(0,0,0,0.3)" };