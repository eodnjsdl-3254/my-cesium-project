// src/cesium/vworld.jsx
import React from "react";

const VWorld = ({ onClose }) => {
  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000", position: "relative", zIndex: 9999 }}>
      {/* 이렇게 해야 Worker 경로 충돌 에러가 사라집니다. */}
      <iframe 
        src="/vworld.html"
        title="V-World Map"
        style={{ width: "100%", height: "100%", border: "none" }}
      />

      {/* UI 컨트롤 (뒤로가기 버튼) */}
      <div style={{ position: "absolute", top: 20, left: 20, background: "rgba(255,255,255,0.9)", padding: "15px", borderRadius: "8px", zIndex: 10000, boxShadow: "0 2px 10px rgba(0,0,0,0.3)" }}>
        <h3 style={{margin: "0 0 10px 0"}}>🇰🇷 V-World 실사 3D</h3>
        <p style={{fontSize: "12px", color: "#666", margin: "0 0 10px 0"}}>전용 뷰어 실행 중</p>
        <button onClick={onClose} style={{ padding: "8px 16px", background: "#f44336", color: "white", border: "none", cursor: "pointer", borderRadius: "4px", fontWeight: "bold" }}>
          🔙 메인으로 복귀
        </button>
      </div>
    </div>
  );
};

export default VWorld;