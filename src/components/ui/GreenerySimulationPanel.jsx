import React from "react";

const GreenerySimulationPanel = ({ 
  isDrawing, 
  onStartDraw, 
  onPlant, 
  treeCount, 
  setTreeCount, 
  onReset,
  carbonAbsorption // [추가] 전달받은 데이터
}) => {
  return (
    <div style={panelStyle}>
      <h3 style={{ margin: "0 0 15px 0", fontSize: "16px", color: "#2ecc71", borderBottom: "1px solid #555", paddingBottom: "10px" }}>
        🌿 녹지 조성 시뮬레이션
      </h3>
      
      <button 
        onClick={onStartDraw}
        style={{
          ...btnStyle, 
          backgroundColor: isDrawing ? "#e74c3c" : "#3498db",
          marginBottom: "15px"
        }}
      >
        {isDrawing ? "🛑 그리기 취소" : "📐 영역 그리기 시작"}
      </button>

      {/* 탄소 데이터 디스플레이 영역 */}
      <div style={{ background: "rgba(255,255,255,0.1)", padding: "10px", borderRadius: "6px", marginBottom: "15px" }}>
        <p style={{ margin: "0", fontSize: "12px", color: "#aaa" }}>연간 예상 탄소 흡수량</p>
        <p style={{ margin: "5px 0 0 0", fontSize: "18px", fontWeight: "bold", color: "#2ecc71" }}>
          📉 {carbonAbsorption || 0} kg
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label style={{ fontSize: "12px" }}>나무 밀도(그루):</label>
          <input 
            type="number" value={treeCount} 
            onChange={(e) => setTreeCount(e.target.value)}
            style={{ width: "60px", padding: "5px", background: "#333", color: "white", border: "1px solid #555", borderRadius: "4px" }}
          />
        </div>
        <button onClick={() => onPlant(treeCount)} style={{ ...btnStyle, backgroundColor: "#27ae60" }}>🌲 나무 심기</button>
        <button onClick={onReset} style={{ ...btnStyle, backgroundColor: "transparent", border: "1px solid #666", color: "#aaa" }}>🔄 초기화</button>
      </div>
    </div>
  );
};

const panelStyle = { position: "absolute", top: "120px", right: "20px", zIndex: 1000, background: "rgba(30, 30, 30, 0.9)", padding: "20px", borderRadius: "12px", color: "white", width: "240px", boxShadow: "0 4px 20px rgba(0,0,0,0.6)", backdropFilter: "blur(5px)" };
const btnStyle = { width: "100%", padding: "10px", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", transition: "0.2s" };

export default GreenerySimulationPanel;