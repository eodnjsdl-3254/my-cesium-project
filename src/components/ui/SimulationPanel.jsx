import React, { useState, useEffect } from 'react';

const SimulationPanel = ({ map, onClose, selectedBuilding, onUpdate }) => {
  const [mode, setMode] = useState('CREATE'); // CREATE, UPLOAD, CONVERT, EDIT
  const [isPlacing, setIsPlacing] = useState(false);
  const [isRelocating, setIsRelocating] = useState(false);
  const [uploadFile, setUploadFile] = useState(null); 
  
  // 변환 관련 상태
  const [convertFiles, setConvertFiles] = useState([]);
  const [isConverting, setIsConverting] = useState(false);
  const [convertedResult, setConvertedResult] = useState(null); // { url, filename }

  const [inputs, setInputs] = useState({
    width: 20, depth: 20, height: 50, rotation: 0, scale: 1.0, lat: 0, lon: 0
  });

  // 선택된 객체 감지 -> 편집 모드 진입
  useEffect(() => {
    if (selectedBuilding) {
      setMode('EDIT');
      setInputs({
        width: selectedBuilding.width || 0,
        depth: selectedBuilding.depth || 0,
        height: selectedBuilding.height || 0,
        scale: selectedBuilding.scale || 1.0,
        rotation: selectedBuilding.rotation || 0,
        lat: 0, lon: 0
      });
      setIsRelocating(false);
    } else {
      // 선택 해제 시 기본 모드로 복귀
      if (mode === 'EDIT') setMode('CREATE');
    }
  }, [selectedBuilding]);

  // 실시간 편집 반영
  useEffect(() => {
    if (mode === 'EDIT' && map && selectedBuilding) {
      map.updateBuilding(selectedBuilding.id, inputs);
    }
  }, [inputs, mode, map, selectedBuilding]);

  // --- 핸들러 ---

  const handleStartPlacement = () => {
    if (!map) return;
    setIsPlacing(true);
    map.startBuildingPlacement(inputs.width, inputs.depth, inputs.height, inputs.rotation);
  };

  const handleStartModelPlacement = () => {
    if (!map || !uploadFile) {
        alert("파일을 먼저 선택해주세요.");
        return;
    }
    setIsPlacing(true);
    map.startModelPlacement(uploadFile);
  };

  // 변환된 URL을 Blob으로 받아와서 지도에 배치
  const handlePlaceConvertedModel = () => {
    if (!map || !convertedResult) return;

    setIsConverting(true); // 잠시 로딩 표시 재활용
    
    // 1. URL에서 파일 데이터(Blob) 가져오기
    fetch(convertedResult.url)
      .then(res => res.blob())
      .then(blob => {
         // 2. File 객체로 변환
         const file = new File([blob], convertedResult.filename, { type: 'model/gltf-binary' });
         
         // 3. 기존 Map3D의 배치 로직 재사용
         setIsConverting(false);
         setIsPlacing(true);
         map.startModelPlacement(file);
      })
      .catch(err => {
         console.error(err);
         setIsConverting(false);
         alert("파일을 가져오는데 실패했습니다.");
      });
  };

  const handleRelocate = () => {
    if (!map || !selectedBuilding) return;
    setIsRelocating(true);
    map.startRelocation(selectedBuilding.id);
  };

  const handleDelete = () => {
    if (!map || !selectedBuilding) return;
    if (window.confirm("정말로 삭제하시겠습니까?")) {
      map.removeBuilding(selectedBuilding.id);
      if (onUpdate) onUpdate(); 
    }
  };

  const handleFinishEdit = () => { if (onUpdate) onUpdate(); };

  // 파일 선택
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && (file.name.endsWith('.glb') || file.name.endsWith('.gltf'))) {
        setUploadFile(file);
    } else {
        alert("gltf 또는 glb 파일만 가능합니다.");
        setUploadFile(null);
    }
  };

  // 변환용 파일 선택 (Multiple)
  const handleConvertFileSelect = (e) => {
    setConvertFiles(Array.from(e.target.files));
    setConvertedResult(null); // 새 파일 선택 시 이전 결과 초기화
  };

  // 변환 API 호출
  const requestConversion = async () => {
    if (convertFiles.length === 0) {
      alert("변환할 3ds 파일을 선택해주세요.");
      return;
    }
    
    const formData = new FormData();
    convertFiles.forEach(file => formData.append('files', file));

    setIsConverting(true);
    try {
      const res = await fetch('http://localhost:8000/convert', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      
      if (data.url) {
        setConvertedResult(data);
      } else {
        alert("변환 실패: " + (data.error || "알 수 없는 오류"));
      }
    } catch (e) {
      alert("서버 오류. Docker가 실행 중인지 확인하세요.");
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div style={{
      position: 'absolute', top: 80, right: 20, width: '320px', 
      background: 'rgba(30, 30, 30, 0.95)', color: 'white', 
      padding: '20px', borderRadius: '8px', zIndex: 5000,
      boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
    }}>
      <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '15px'}}>
        <h3 style={{margin:0}}>{mode === 'EDIT' ? "✏️ 편집 모드" : "🏗️ 시뮬레이션"}</h3>
        <button onClick={onClose} style={{background:'transparent', border:'none', color:'white', cursor:'pointer'}}>✖</button>
      </div>

      {/* 탭 버튼 (편집 모드가 아닐 때만 노출) */}
      {mode !== 'EDIT' && (
        <div style={{display: 'flex', gap: '5px', marginBottom: '15px'}}>
          <button onClick={() => {setMode('CREATE'); setIsPlacing(false);}} style={{...tabBtn, background: mode==='CREATE'?'#2196F3':'#444'}}>Box</button>
          <button onClick={() => {setMode('UPLOAD'); setIsPlacing(false);}} style={{...tabBtn, background: mode==='UPLOAD'?'#2196F3':'#444'}}>GLB</button>
          <button onClick={() => {setMode('CONVERT'); setIsPlacing(false);}} style={{...tabBtn, background: mode==='CONVERT'?'#2196F3':'#444'}}>3DS변환</button>
        </div>
      )}

      {/* 1. 박스 생성 모드 */}
      {mode === 'CREATE' && (
        <>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px'}}>
             <div><label style={ls}>가로 (m)</label><input type="number" value={inputs.width} onChange={(e)=>setInputs({...inputs, width: e.target.value})} style={is} /></div>
             <div><label style={ls}>세로 (m)</label><input type="number" value={inputs.depth} onChange={(e)=>setInputs({...inputs, depth: e.target.value})} style={is} /></div>
          </div>
          <div style={{marginBottom: '15px'}}>
             <label style={ls}>높이 (m)</label><input type="number" value={inputs.height} onChange={(e)=>setInputs({...inputs, height: e.target.value})} style={is} />
          </div>
          <button onClick={handleStartPlacement} style={{...btn, background: isPlacing ? '#FF9800' : '#4CAF50'}}>
             {isPlacing ? "📍 클릭하여 배치" : "🖱️ 마우스로 배치하기"}
          </button>
        </>
      )}

      {/* 2. GLB 직접 업로드 모드 */}
      {mode === 'UPLOAD' && (
         <div style={{marginTop:'10px'}}>
            <div style={{marginBottom:'10px', fontSize:'12px', color:'#ccc'}}>* .glb 또는 .gltf 파일 선택</div>
            <input type="file" accept=".glb,.gltf" onChange={handleFileSelect} style={{width:'100%', color:'white', marginBottom:'10px'}} />
            {uploadFile && (
                <button onClick={handleStartModelPlacement} style={{...btn, background: isPlacing ? '#FF9800' : '#4CAF50'}}>
                   {isPlacing ? "📍 클릭하여 배치" : "🖱️ 모델 배치하기"}
                </button>
            )}
         </div>
      )}

      {/* 3. 🚩 3DS 변환 모드 */}
      {mode === 'CONVERT' && (
         <div style={{marginTop:'10px'}}>
            <div style={{marginBottom:'10px', fontSize:'12px', color:'#ccc', lineHeight:'1.4'}}>
               * .3ds 파일과 텍스처(.jpg, .png)를<br/>함께 선택해주세요. (다중 선택 가능)
            </div>
            
            <input type="file" accept=".3ds,.jpg,.png" multiple onChange={handleConvertFileSelect} style={{width:'100%', color:'white', marginBottom:'10px'}} />

            {/* 변환 버튼 */}
            {convertFiles.length > 0 && !isConverting && !convertedResult && (
               <button onClick={requestConversion} style={{...btn, background: '#9C27B0'}}>
                  🔄 변환 시작 (Server)
               </button>
            )}

            {/* 로딩 표시 */}
            {isConverting && (
               <div style={{textAlign:'center', padding:'15px', color:'#FF9800', fontWeight:'bold'}}>
                  ⏳ 변환 및 로딩 중...
               </div>
            )}

            {/* 결과 표시 */}
            {convertedResult && !isConverting && (
               <div style={{marginTop:'15px', padding:'10px', background:'rgba(255,255,255,0.1)', borderRadius:'4px'}}>
                  <div style={{fontSize:'13px', color:'#4CAF50', marginBottom:'10px', fontWeight:'bold'}}>✅ 변환 성공!</div>
                  
                  {/* 다운로드 링크  */}
                  <a href={convertedResult.url} download={convertedResult.filename} style={{display:'block', marginBottom:'10px', color:'#64B5F6', fontSize:'13px', textDecoration:'none', border:'1px solid #64B5F6', padding:'5px', textAlign:'center', borderRadius:'4px'}}>
                     💾 파일 다운로드
                  </a>

                  {/* 배치 버튼 */}
                  <button onClick={handlePlaceConvertedModel} style={{...btn, background: isPlacing ? '#FF9800' : '#4CAF50', fontSize:'13px', padding:'10px'}}>
                     {isPlacing ? "📍 클릭하여 배치" : "🖱️ 지도에 배치하기"}
                  </button>
               </div>
            )}
         </div>
      )}

      {/* 4. 편집 모드 */}
      {mode === 'EDIT' && (
        <>
          {selectedBuilding?.isModel ? (
             <div style={{marginBottom: '10px'}}>
               <label style={ls}>크기 비율 (Scale)</label>
               <input type="number" step="0.1" value={inputs.scale} onChange={(e)=>setInputs({...inputs, scale: e.target.value})} style={is} />
             </div>
          ) : (
            <>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px'}}>
                <div><label style={ls}>가로 (m)</label><input type="number" value={inputs.width} onChange={(e)=>setInputs({...inputs, width: e.target.value})} style={is} /></div>
                <div><label style={ls}>세로 (m)</label><input type="number" value={inputs.depth} onChange={(e)=>setInputs({...inputs, depth: e.target.value})} style={is} /></div>
              </div>
              <div style={{marginBottom: '10px'}}>
                <label style={ls}>높이 (m)</label><input type="number" value={inputs.height} onChange={(e)=>setInputs({...inputs, height: e.target.value})} style={is} />
              </div>
            </>
          )}

          <div style={{marginBottom: '15px'}}>
             <label style={ls}>회전 ({inputs.rotation}°)</label>
             <input type="range" min="0" max="360" step="1" value={inputs.rotation} onChange={(e)=>setInputs({...inputs, rotation: e.target.value})} style={{width: '100%', cursor:'pointer'}} />
          </div>

          <div style={{display:'flex', flexDirection:'column', gap:'5px'}}>
             <button onClick={handleRelocate} style={{...btn, background: isRelocating ? '#FF9800' : '#9C27B0', marginBottom:'5px'}}>
               {isRelocating ? "📍 이동할 위치 클릭" : "🔄 위치 이동"}
             </button>
             <div style={{display:'flex', gap:'5px'}}>
               <button onClick={handleDelete} style={{...btn, background: '#D32F2F', flex:1}}>🗑️ 삭제</button>
               <button onClick={handleFinishEdit} style={{...btn, background: '#2196F3', flex:2}}>완료</button>
             </div>
          </div>
        </>
      )}
    </div>
  );
};

// 스타일
const ls = {fontSize:'12px', color:'#aaa', display:'block', marginBottom:'4px'};
const is = {width: '100%', padding: '8px', background: '#222', border: '1px solid #444', color: 'white', borderRadius: '4px', boxSizing: 'border-box'};
const btn = {width: '100%', padding: '12px', border: 'none', color: 'white', fontWeight: 'bold', borderRadius: '4px', cursor:'pointer'};
const tabBtn = {flex: 1, padding: '8px', border:'none', color:'white', borderRadius:'4px', cursor:'pointer', fontSize:'12px', fontWeight:'bold'};

export default SimulationPanel;