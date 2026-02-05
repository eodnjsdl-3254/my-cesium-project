import React, { useState, useEffect, useCallback } from 'react';
import SimulationPanel from './SimulationPanel';
import GreenerySimulationPanel from './GreenerySimulationPanel';
import BuildingTag from './BuildingTag'; 

export const UI = ({ map, clickedCoord, selectedBuilding, setSelectedBuilding, onOpenVWorld }) => {
  
  // =================================================================
  // 1. 상태 관리
  // =================================================================
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
  const [isUiDrawing, setIsUiDrawing] = useState(false); 
  const [treeCount, setTreeCount] = useState(100);

  // =================================================================
  // 2. 효과 (Effect)
  // =================================================================
  
  // 마우스 커서 변경
  useEffect(() => {
    document.body.style.cursor = isUiDrawing ? 'crosshair' : 'default';
  }, [isUiDrawing]);

  // Map3D 이벤트 리스너 연결 (건물 선택)
  const handleSimulationSelect = useCallback((buildingProps) => {
    if (showGreeneryPanel) return; 

    setSelectedBuilding(buildingProps); // UI 정보창용
    setEditTarget(buildingProps);       // 편집 패널용
    
    if (buildingProps) {
        setShowSimulation(true);
    } else {
        setShowSimulation(false);
    }
  }, [showGreeneryPanel, setSelectedBuilding]);

  // 이벤트 바인딩
  useEffect(() => {
    if (map) {
       map.onSimulationSelect = handleSimulationSelect;
    }
  }, [map, handleSimulationSelect]);


  // =================================================================
  // 3. 핸들러 함수들
  // =================================================================
  
  // 🚨 [수정됨] BuildingTag에서 값이 변경되었을 때 (비균등 스케일 대응)
  const handleTagUpdate = (newValues) => {
    if (map && selectedBuilding) {
      // 1. Map3D에게 업데이트 요청하고, 비균등 스케일이 적용된 "최종 결과값"을 받습니다.
      const result = map.updateBuilding(selectedBuilding.id, newValues);
      
      if (result) {
          // 2. 기존 상태에 Map3D가 계산해준 width, depth, height, scale 등을 덮어씁니다.
          // 여기서 중요한 점: UI가 독자적으로 계산하지 않고 Map3D의 리턴값을 전적으로 신뢰합니다.
          const updated = { ...selectedBuilding, ...result };
          
          setSelectedBuilding(updated);
          setEditTarget(updated);
      }
    }
  };

  // [녹지] 그리기 시작
  const handleStartDraw = () => {
    if (!map) return;
    setIsUiDrawing(true);
    map.startGreenerySimulation(() => {
        console.log("✅ 그리기 완료");
        setIsUiDrawing(false); 
    });
  };

  const toggleGreeneryPanel = () => {
    const nextState = !showGreeneryPanel;
    setShowGreeneryPanel(nextState);

    if (map) {
        map.setGreeneryMode(nextState); 

        if (nextState) {
            setShowSimulation(false);
            setEditTarget(null);
            setSelectedBuilding(null);
            handleStartDraw();
        } else {
            setIsUiDrawing(false);
            map.stopGreenerySimulation(); 
        }
    }
  };

  const handlePlantTrees = (count) => {
    if (isUiDrawing) {
        alert("영역 그리기를 먼저 완료해주세요 (지도 더블클릭).");
        return;
    }
    if (map) map.plantTrees(count);
  };

  // [건물] 패널 닫기
  const handleClosePanel = () => {
    setShowSimulation(false);
    setEditTarget(null);
    setSelectedBuilding(null); 
    if(map) map.highlightBuilding(null); 
  };

  const handleUpdateBuilding = () => {
      setEditTarget(null);
      setSelectedBuilding(null);
      setShowSimulation(false);
  };

  const handleBuildingChange = (mode) => {
    if (mode === "VWORLD") { if (onOpenVWorld) onOpenVWorld(); return; }
    setBuildingMode(mode); map?.setBuildingMode(mode);
  };
  const handleBaseMapChange = (e) => { setBaseMapType(e.target.value); map?.changeBaseMap(e.target.value); };
  const handleVworldTypeChange = (e) => { setVworldType(e.target.value); if (showVworld) map?.toggleVworldImagery(true, e.target.value); };


  // =================================================================
  // 4. 렌더링
  // =================================================================
  return (
    <>
      {/* A. 상단 컨트롤 바 */}
      <div style={{ position: "absolute", zIndex: 10, top: 10, left: 10, display: "flex", gap: "5px", flexWrap: "wrap", alignItems: "center" }}>
        
        <select value={baseMapType} onChange={handleBaseMapChange} style={selectStyle}>
          <option value="OSM">🗺️ 일반 지도 (OSM)</option>
          <option value="SATELLITE">🛰️ 위성 지도 (Cesium)</option>
          <option value="NONE">🌑 배경 없음</option>
        </select>

        <button onClick={() => map?.camera.viewHome()} style={btnStyle}>홈</button>
        <button onClick={() => map?.focusLocation(37.6585, 126.8320, "고양시청")} style={btnStyle}>고양 이동</button>

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

        <div style={groupStyle}>
          <span style={{ fontSize: "12px", padding: "0 5px", color: "#666", fontWeight: "bold" }}>🏢 건물:</span>
          <button onClick={() => handleBuildingChange("NONE")} style={{ ...toggleBtnStyle, backgroundColor: buildingMode === "NONE" ? "#555" : "#ccc" }}>OFF</button>
          <button onClick={() => handleBuildingChange("OSM")} style={{ ...toggleBtnStyle, backgroundColor: buildingMode === "OSM" ? "#9C27B0" : "#ccc" }}>분석</button>
          <button onClick={() => handleBuildingChange("VWORLD")} style={{ ...toggleBtnStyle, backgroundColor: buildingMode === "VWORLD" ? "#4285F4" : "#ccc" }}>실사</button>
          <button onClick={() => handleBuildingChange("GOOGLE")} style={{ ...toggleBtnStyle, backgroundColor: buildingMode === "GOOGLE" ? "#EA4335" : "#ccc" }}>구글</button>
        </div>

        {buildingMode === "OSM" && (
           <button onClick={() => { const nextStyle = buildingStyle === "DEFAULT" ? "HEIGHT" : "DEFAULT"; setBuildingStyle(nextStyle); map?.styleOsmBuildings(nextStyle); }} 
             style={{ ...toggleBtnStyle, backgroundColor: buildingStyle === "HEIGHT" ? "#FF9800" : "#666" }}>
             📊 높이
           </button>
        )}

        <button onClick={() => { const next = !isMarkerMode; setIsMarkerMode(next); map?.setMarkerMode(next); }} 
          style={{ ...btnStyle, backgroundColor: isMarkerMode ? "#FFEB3B" : "white", border: isMarkerMode ? "2px solid #FBC02D" : "none" }}>
          {isMarkerMode ? "📍 마커: ON" : "📍 마커: OFF"}
        </button>

        <button onClick={() => { const next = !isTracking; setIsTracking(next); map?.setTrackingMode(next); }} 
          style={{ ...btnStyle, backgroundColor: isTracking ? "#4CAF50" : "white", color: isTracking ? "white" : "black" }}>
          {isTracking ? "📡 추적 중" : "📡 추적 모드"}
        </button>
        
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

        <button onClick={() => map?.data.clearAll()} style={btnStyle}>데이터 삭제</button>
      </div>

      {/* B. 정보창 (Info Card) */}
      {selectedBuilding && (
        <div style={infoCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '16px' }}>🏢 건물 정보</h3>
            <button onClick={handleClosePanel} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'white', fontSize: '16px' }}>✖</button>
          </div>
          <hr style={{ margin: '8px 0', borderColor: '#555' }} />
          
          <div style={{ marginBottom: '10px', background:'rgba(255,255,255,0.05)', padding:'5px', borderRadius:'4px' }}>
            <p style={{ margin: '2px 0', fontSize:'12px' }}><strong>ID:</strong> <span style={{color:'#aaa'}}>{selectedBuilding.id.substring(0,8)}...</span></p>
            <p style={{ margin: '2px 0', fontSize:'12px' }}><strong>Type:</strong> {selectedBuilding.isModel ? "GLB Model" : "Volume Box"}</p>
            
            <div style={{ display:'flex', gap:'5px', marginTop:'5px' }}>
               <span style={badgeStyle}>W: {Number(selectedBuilding.width).toFixed(1)}m</span>
               <span style={badgeStyle}>D: {Number(selectedBuilding.depth).toFixed(1)}m</span>
               <span style={badgeStyle}>H: {Number(selectedBuilding.height).toFixed(1)}m</span>
            </div>
          </div>

          {/* 동적 메타데이터 매핑 */}
          {selectedBuilding.metaData && (
            <div style={{ 
              marginTop: '5px', 
              maxHeight: '200px', 
              overflowY: 'auto',
              fontSize: '11px',
              borderTop: '1px dashed #555',
              paddingTop: '5px'
            }}>
              <p style={{ margin: '0 0 5px 0', color: '#4CAF50', fontWeight: 'bold' }}>📋 상세 속성 (Metadata)</p>
              
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {Object.entries(selectedBuilding.metaData).map(([key, value]) => {
                    if (key.startsWith('_') || key === 'id' || 
                        ['isSimulation', 'isModel', 'lat', 'lon', 'heading', 'pitch', 'roll', 
                         'width', 'depth', 'height', 'scale', 'rotation', 
                         'originalWidth', 'originalDepth', 'originalHeight'].includes(key)) {
                        return null;
                    }

                    let displayVal = value;
                    if (typeof value === 'object' && value !== null) {
                        displayVal = JSON.stringify(value).substring(0, 20) + "..."; 
                    }

                    return (
                      <tr key={key} style={{ borderBottom: '1px solid #444' }}>
                        <td style={{ padding: '4px', color: '#ccc', width: '40%', wordBreak:'break-all' }}>{key}</td>
                        <td style={{ padding: '4px', textAlign: 'right', color: '#fff', fontWeight:'bold' }}>{String(displayVal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {Object.keys(selectedBuilding.metaData).length === 0 && (
                  <div style={{color:'#777', textAlign:'center', padding:'10px'}}>추가 속성 없음</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ✨ [추가] 건물 따라다니는 편집 태그 ✨ */}
      {selectedBuilding && !showGreeneryPanel && (
        <BuildingTag 
          viewer={map?.viewer} 
          buildingData={selectedBuilding} 
          onUpdate={handleTagUpdate} 
        />
      )}

      {/* 좌표바 */}
      {clickedCoord && (
        <div style={coordBarStyle}>📍 경도 {clickedCoord.lon.toFixed(6)} / 위도 {clickedCoord.lat.toFixed(6)}</div>
      )}
      
      {/* C. 패널 분기 */}
      {showGreeneryPanel ? (
        <>
          <GreenerySimulationPanel 
            isDrawing={isUiDrawing}       
            onStartDraw={handleStartDraw} 
            onPlant={handlePlantTrees}    
            onReset={handleStartDraw}     
            treeCount={treeCount} 
            setTreeCount={setTreeCount} 
            carbonAbsorption={(treeCount * 8.2).toLocaleString(undefined, { maximumFractionDigits: 1 })}
          />
          {isUiDrawing && (
            <div style={bannerStyle}>
              🎯 지도 위를 클릭하여 영역을 그리세요 (우클릭: 점취소 / 더블클릭: 완료)
            </div>
          )}
        </>
      ) : (
        <>
          {!showSimulation && !selectedBuilding && (
            <div style={{ position: "absolute", top: 20, right: 20, zIndex: 1000 }}>
              <button 
                onClick={() => setShowSimulation(true)}
                style={{ padding: "10px 20px", background: "#673AB7", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", boxShadow: "0 2px 5px rgba(0,0,0,0.3)" }}
              >
                🛠️ 편집 시뮬레이션
              </button>
            </div>
          )}
          {showSimulation && (
            <SimulationPanel 
               map={map} 
               selectedBuilding={editTarget || selectedBuilding} 
               onClose={handleClosePanel} 
               onUpdate={handleUpdateBuilding} 
            />
          )}
        </>
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
const infoCardStyle = { position: "absolute", top: 60, right: 10, width: "260px", background: "rgba(0,0,0,0.85)", color: "white", padding: "15px", borderRadius: "8px", zIndex: 10, fontSize: "14px", border: "1px solid #444", boxShadow: "0 4px 10px rgba(0,0,0,0.5)" };
const coordBarStyle = { position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.7)", color: "white", padding: "10px 20px", borderRadius: "20px", fontSize: "14px", zIndex: 10 };
const bannerStyle = { position: 'absolute', top: '70px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(52, 152, 219, 0.9)', color: 'white', padding: '8px 25px', borderRadius: '20px', zIndex: 1000, fontWeight: 'bold', boxShadow: "0 4px 10px rgba(0,0,0,0.3)" };
const badgeStyle = { background:'#2196F3', color:'white', padding:'2px 5px', borderRadius:'3px', fontSize:'11px', fontWeight:'bold' };