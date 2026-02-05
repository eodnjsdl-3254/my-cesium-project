import React, { useState, useEffect } from "react";

const GreenerySimulationPanel = ({ 
  isDrawing, 
  onStartDraw, 
  onPlant, 
  onReset,
  area = 0,
  treeSpecs // { coniferArea: number, deciduousArea: number }
}) => {
  // 상태 관리
  const [coniferRatio, setConiferRatio] = useState(20);
  const [density, setDensity] = useState(50); 
  const [maxCapacity, setMaxCapacity] = useState(0);

  // 🌲 기본값 (분석 전 or 실패 시 사용 - 단위 m²)
  // 침엽수(3x3=9), 활엽수(5x5=25)
  const DEFAULT_CONIFER_AREA = 9.0;
  const DEFAULT_DECIDUOUS_AREA = 25.0;
  const PACKING_FACTOR = 0.7; // 식재 효율 (70%)

  // 🧮 [핵심] 실제 분석 데이터를 반영한 계산
  useEffect(() => {
    if (area <= 0) {
        setMaxCapacity(0);
        return;
    }

    // 1. 분석된 값이 유효한지 확인 (없으면 기본값 사용)
    const cArea = (treeSpecs && treeSpecs.coniferArea > 0) 
                  ? treeSpecs.coniferArea 
                  : DEFAULT_CONIFER_AREA;
                  
    const dArea = (treeSpecs && treeSpecs.deciduousArea > 0) 
                  ? treeSpecs.deciduousArea 
                  : DEFAULT_DECIDUOUS_AREA;

    // 2. 가중 평균 면적 계산
    const rC = coniferRatio / 100; // 0.0 ~ 1.0
    const rD = 1 - rC;

    // (비율 * 면적) 합산
    const avgTreeArea = (rC * cArea) + (rD * dArea);

    // 3. 최대 수량 도출
    // 전체면적 * 효율 / 평균나무면적
    const calculatedMax = Math.floor((area * PACKING_FACTOR) / avgTreeArea);
    
    setMaxCapacity(calculatedMax);

  }, [area, coniferRatio, treeSpecs]); 

  // 실제 심을 개수 (밀도 반영)
  const currentCount = Math.floor(maxCapacity * (density / 100));

  // 탄소 흡수량 시뮬레이션
  const estimatedCarbon = Math.floor(
    (currentCount * (coniferRatio / 100) * 12.0) + 
    (currentCount * ((100 - coniferRatio) / 100) * 8.0)
  );

  return (
    <div style={panelStyle}>
      <h3 style={headerStyle}>🌿 녹지 조성 시뮬레이션</h3>
      
      <button onClick={onStartDraw} style={{...btnStyle, background: isDrawing ? "#e74c3c" : "#3498db", marginBottom: "15px"}}>
        {isDrawing ? "🛑 그리기 취소" : "📐 영역 그리기 (새로고침)"}
      </button>

      <div style={infoBoxStyle}>
        <div style={{fontSize:'12px', color:'#aaa'}}>대상지 면적</div>
        <div style={{fontSize:'18px', fontWeight:'bold', color:'#FF9800'}}>
          {area > 0 ? `${Math.round(area).toLocaleString()} m²` : "-"}
        </div>
      </div>

      {area > 0 && (
        <>
          {/* 모델 스펙 정보 표시 (신뢰성 강화) */}
          <div style={{fontSize: '10px', color: '#888', marginBottom: '10px', textAlign: 'right', borderBottom:'1px dashed #444', paddingBottom:'5px'}}>
             {treeSpecs ? "✅ 3D 모델 실제 크기 반영됨" : "⚠️ 기본값 크기 사용 중"} <br/>
             🌲침엽수: {Math.round(treeSpecs?.coniferArea || DEFAULT_CONIFER_AREA)}m² / 
             🌳활엽수: {Math.round(treeSpecs?.deciduousArea || DEFAULT_DECIDUOUS_AREA)}m²
          </div>

          {/* 수종 비율 슬라이더 */}
          <div style={{marginBottom: '15px'}}>
            <label style={labelStyle}>🌲 수종 비율 설정</label>
            <div style={{display:'flex', justifyContent:'space-between', fontSize:'11px', color:'#ccc', marginBottom:'5px'}}>
              <span style={{color: '#2ecc71'}}>침엽수 {coniferRatio}%</span>
              <span style={{color: '#e67e22'}}>활엽수 {100 - coniferRatio}%</span>
            </div>
            <input 
              type="range" min="0" max="100" step="10"
              value={coniferRatio}
              onChange={(e) => setConiferRatio(Number(e.target.value))}
              style={{width: '100%', cursor:'pointer'}}
            />
            <div style={{height:'4px', background:`linear-gradient(to right, #2ecc71 ${coniferRatio}%, #e67e22 ${coniferRatio}%)`, borderRadius:'2px', marginTop:'-6px'}}></div>
          </div>

          {/* 밀도 슬라이더 */}
          <div style={{marginBottom: '15px'}}>
            <label style={labelStyle}>🌳 식재 밀도 ({currentCount}그루)</label>
            <input 
              type="range" min="1" max="100" 
              value={density}
              onChange={(e) => setDensity(Number(e.target.value))}
              style={{width: '100%', cursor:'pointer'}}
            />
            <div style={{textAlign:'right', fontSize:'11px', color:'#888'}}>
                최대 수용량: {maxCapacity.toLocaleString()}그루
            </div>
          </div>

          {/* 탄소 흡수량 */}
          <div style={{...infoBoxStyle, marginBottom:'15px', border:'1px solid #2ecc71'}}>
            <div style={{fontSize:'12px', color:'#ccc'}}>연간 예상 탄소 흡수량</div>
            <div style={{fontSize:'18px', fontWeight:'bold', color:'#2ecc71'}}>
              📉 {estimatedCarbon.toLocaleString()} kg
            </div>
          </div>

          {/* 실행 버튼 */}
          <div style={{display:'flex', gap:'5px'}}>
            <button 
              onClick={() => onPlant(currentCount, coniferRatio / 100)} 
              style={{...btnStyle, background: "#27ae60", flex: 2}}
            >
              🌳 배치 실행
            </button>
            <button onClick={onReset} style={{...btnStyle, background: "transparent", border: "1px solid #666", color: "#aaa", flex: 1}}>
              초기화
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// 스타일 (기존 유지)
const panelStyle = { position: "absolute", top: "80px", right: "20px", width: "260px", background: "rgba(30, 30, 35, 0.95)", padding: "20px", borderRadius: "12px", color: "white", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", backdropFilter: "blur(10px)", zIndex: 5000, border: "1px solid rgba(255,255,255,0.1)" };
const headerStyle = { margin: "0 0 15px 0", fontSize: "16px", color: "#2ecc71", borderBottom: "1px solid #555", paddingBottom: "10px" };
const btnStyle = { padding: "10px", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", transition: "0.2s" };
const infoBoxStyle = { background: "rgba(0,0,0,0.3)", padding: "10px", borderRadius: "6px", textAlign: "center" };
const labelStyle = { display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "8px", color: "#ddd" };

export default GreenerySimulationPanel;