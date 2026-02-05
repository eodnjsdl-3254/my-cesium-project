import React, { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';

// 🎛️ 입력 오류 없는 스마트 인풋
const SmartInput = ({ label, value, onChange, step = 0.1, unit = "m" }) => {
  // 1. 화면에 보여질 문자열 상태 (입력 중 끊김 방지)
  const [localStr, setLocalStr] = useState(value?.toString() || "");

  // 2. 외부 값(value)이 변할 때만 localStr 동기화
  // (예: +/- 버튼을 눌렀거나 다른 건물을 클릭했을 때)
  useEffect(() => {
    // 현재 입력창의 값과 부모의 값이 숫자로서는 같지만 문자열이 다를 때 (예: "4." vs 4)
    // 사용자가 타이핑 중인 "4."를 "4"로 강제 변환하지 않도록 방어
    const parsedLocal = parseFloat(localStr);
    if (parsedLocal !== value) {
        setLocalStr(Number(value).toFixed(2)); // 외부 변경 시에는 포맷팅 적용
    }
  }, [value]);

  // 3. 버튼 조작 핸들러
  const handleStep = (direction) => {
    const currentVal = parseFloat(localStr) || 0;
    const nextVal = direction === 'up' ? currentVal + step : currentVal - step;
    
    // 계산된 값을 부모에게 전달 (소수점 오차 보정)
    const fixedVal = parseFloat(nextVal.toFixed(2));
    onChange(fixedVal);
    // 버튼 클릭은 즉시 포맷팅해서 보여줘도 됨
    setLocalStr(fixedVal.toFixed(2));
  };

  // 4. 타이핑 핸들러
  const handleInputChange = (e) => {
    const raw = e.target.value;
    setLocalStr(raw); // 화면에는 타이핑한 그대로 표시 ("4", "4.", "45")
    
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
        onChange(parsed); // 부모에게는 숫자만 조용히 전달 (리렌더링 되어도 useEffect가 방어함)
    }
  };

  // 5. 포커스 해제 시 깔끔하게 정리
  const handleBlur = () => {
     const parsed = parseFloat(localStr);
     if (!isNaN(parsed)) {
         setLocalStr(parsed.toFixed(2));
     }
  };

  // 6. 엔터키 처리
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
        e.target.blur(); // 포커스 해제 -> handleBlur 실행됨
    }
  };

  return (
    <div style={styles.row}>
      <span style={styles.label}>{label}</span>
      <div style={styles.controlGroup}>
        {/* 감소 버튼 */}
        <button onClick={() => handleStep('down')} style={styles.stepBtn}>-</button>
        
        {/* 입력창 */}
        <input 
          type="number" 
          value={localStr}
          step={step}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          style={styles.input} 
        />
        
        {/* 증가 버튼 */}
        <button onClick={() => handleStep('up')} style={styles.stepBtn}>+</button>
      </div>
      <span style={styles.unit}>{unit}</span>
    </div>
  );
};

const BuildingTag = ({ viewer, buildingData, onUpdate }) => {
  const divRef = useRef(null);
  
  // 초기 데이터 관리
  const [vals, setVals] = useState({ width: 0, depth: 0, height: 0, scale: 1 });

  useEffect(() => {
    if (buildingData) {
      setVals({
        width: parseFloat(buildingData.width || 0),
        depth: parseFloat(buildingData.depth || 0),
        height: parseFloat(buildingData.height || 0),
        scale: parseFloat(buildingData.scale || 1),
      });
    }
  }, [buildingData]);

  // 3D 좌표 추적
  useEffect(() => {
    if (!viewer || !buildingData || !divRef.current) return;
    
    const updatePosition = () => {
      const position = Cesium.Cartesian3.fromDegrees(
        parseFloat(buildingData.lon), parseFloat(buildingData.lat)
      );

      // Cesium 버전 호환성 체크
      let canvasPosition;
      if (Cesium.SceneTransforms.worldToWindowCoordinates) {
          canvasPosition = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, position);
      } else if (Cesium.SceneTransforms.wgs84ToWindowCoordinates) {
          canvasPosition = Cesium.SceneTransforms.wgs84ToWindowCoordinates(viewer.scene, position);
      }
      
      if (canvasPosition) {
        // 오프셋 (x+60, y+60)
        divRef.current.style.transform = `translate(${canvasPosition.x + 60}px, ${canvasPosition.y + 60}px)`;
        divRef.current.style.display = 'block';
      } else {
        divRef.current.style.display = 'none';
      }
    };

    const removeListener = viewer.scene.postRender.addEventListener(updatePosition);
    return () => removeListener();
  }, [viewer, buildingData]);

  // 부모로 데이터 업데이트 요청
  const handleValueChange = (newValue, type) => {
    if (isNaN(newValue) || newValue < 0.1) return;

    if (buildingData.isModel) {
      let newScale = vals.scale;
      // 스케일 역산
      if (type === 'width') newScale = newValue / buildingData.originalWidth;
      if (type === 'depth') newScale = newValue / buildingData.originalDepth;
      if (type === 'height') newScale = newValue / buildingData.originalHeight;
      
      onUpdate({ scale: newScale }); 
    } else {
      onUpdate({ [type]: newValue });
    }
  };

  if (!buildingData) return null;

  return (
    <div ref={divRef} style={styles.container}>
      <div style={styles.header}>📏 치수 정밀 편집</div>
      
      {/* toFixed를 제거하고 raw 숫자값 전달 -> SmartInput 내부에서 처리 */}
      <SmartInput 
        label="가로(W)" 
        value={vals.width} 
        onChange={(v) => handleValueChange(v, 'width')} 
      />
      <SmartInput 
        label="세로(D)" 
        value={vals.depth} 
        onChange={(v) => handleValueChange(v, 'depth')} 
      />
      <SmartInput 
        label="높이(H)" 
        value={vals.height} 
        onChange={(v) => handleValueChange(v, 'height')} 
      />
      
      <div style={styles.footer}>※ 버튼 또는 직접 입력</div>
    </div>
  );
};

const styles = {
  container: {
    position: 'absolute', top: 0, left: 0,
    background: 'rgba(30, 30, 30, 0.9)',
    backdropFilter: 'blur(5px)',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    boxShadow: '0 4px 15px rgba(0,0,0,0.6)',
    zIndex: 100, color: 'white', width: '160px',
    pointerEvents: 'auto',
  },
  header: { fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#4CAF50', textAlign: 'center', borderBottom:'1px solid #555', paddingBottom:'4px' },
  row: { display: 'flex', alignItems: 'center', marginBottom: '6px', justifyContent: 'space-between' },
  label: { fontSize: '11px', color: '#ccc', width: '40px' },
  controlGroup: { display: 'flex', alignItems: 'center', background:'#444', borderRadius:'4px', overflow:'hidden' },
  stepBtn: { 
    width: '20px', height: '22px', border: 'none', background: '#555', color: 'white', 
    cursor: 'pointer', fontSize: '12px', display:'flex', alignItems:'center', justifyContent:'center',
    transition: 'background 0.2s', padding: 0
  },
  input: { 
    width: '40px', height: '20px', background: 'transparent', border: 'none', 
    color: '#fff', fontSize: '11px', textAlign: 'center', outline: 'none', fontWeight:'bold' 
  },
  unit: { fontSize: '10px', color: '#888', marginLeft: '3px' },
  footer: { fontSize: '9px', color: '#666', textAlign: 'center', marginTop: '2px' }
};

export default BuildingTag;