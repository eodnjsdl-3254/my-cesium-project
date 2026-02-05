import React, { useState, useEffect } from 'react';

const SimulationPanel = ({ map, onClose, selectedBuilding, onUpdate }) => {
  // -----------------------------------------------------------
  // 1. 상태 관리
  // -----------------------------------------------------------
  // 초기 상태를 null로 설정하여, 아무 버튼도 안 눌렀을 때는 빈 화면 유지
  const [mode, setMode] = useState(null); // CREATE, UPLOAD, CONVERT, EDIT, LIBRARY, null

  const [isPlacing, setIsPlacing] = useState(false);
  const [isRelocating, setIsRelocating] = useState(false);
  
  // 파일 업로드 및 변환 상태
  const [uploadFile, setUploadFile] = useState(null); 
  const [convertFiles, setConvertFiles] = useState([]);
  const [isConverting, setIsConverting] = useState(false);
  const [convertedResult, setConvertedResult] = useState(null);

  const [library, setLibrary] = useState([]); // DB 모델 리스트
  const [selectedLibModel, setSelectedLibModel] = useState(null);

  // 입력값 상태 (편집 및 생성 공용)
  const [inputs, setInputs] = useState({
    width: 20, depth: 20, height: 50, // 박스용
    scale: 1.0,                       // 모델용
    rotation: 0,
    lat: 0, lon: 0,
    originalWidth: 0, originalDepth: 0, originalHeight: 0
  });

  // -----------------------------------------------------------
  // 2. 선택된 건물 감지 (Data Binding -> EDIT 모드 진입)
  // -----------------------------------------------------------
  useEffect(() => {
    if (selectedBuilding && selectedBuilding.id) {
      console.log("📍 건물 편집 모드 진입:", selectedBuilding);
      setMode('EDIT');
      
      setInputs({
        width: Number(selectedBuilding.width) || 10,
        depth: Number(selectedBuilding.depth) || 10,
        height: Number(selectedBuilding.height) || 10,
        scale: Number(selectedBuilding.scale) || 1.0,
        rotation: Number(selectedBuilding.rotation) || 0,
        lat: Number(selectedBuilding.lat) || 0,
        lon: Number(selectedBuilding.lon) || 0,
        originalWidth: Number(selectedBuilding.originalWidth) || 10,
        originalDepth: Number(selectedBuilding.originalDepth) || 10,
        originalHeight: Number(selectedBuilding.originalHeight) || 10,
      });
      setIsRelocating(false);
    } else {
      // 선택 해제되면 초기 화면(빈 화면)으로 복귀
      setMode(null); 
    }
  }, [selectedBuilding]);

  // -----------------------------------------------------------
  // 3. 라이브러리 목록 로드 (Nginx Proxy API 사용)
  // -----------------------------------------------------------
  useEffect(() => {
    // http://localhost/api/models -> Nginx -> FastAPI
    fetch('http://localhost/api/models') 
      .then(res => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.json();
      })
      .then(data => {
          // [중요] 데이터가 배열인지 확인 (404 에러 시 객체가 올 수 있음)
          if (Array.isArray(data)) {
              // 썸네일 경로 보정: /public -> /files (Nginx Alias)
              const formattedData = data.map(item => ({
                  ...item,
                  fullThumbUrl: item.thumb_save_url 
                    ? `http://localhost/files${item.thumb_save_url}`
                    : null
              }));
              setLibrary(formattedData);
          } else {
              console.warn("⚠️ API 응답이 배열이 아닙니다:", data);
              setLibrary([]); // 빈 배열로 초기화하여 map 에러 방지
          }
      })
      .catch(err => {
          console.error("❌ 라이브러리 로드 실패:", err);
          setLibrary([]); // 에러 발생 시에도 빈 배열 유지
      });
  }, []);

  // -----------------------------------------------------------
  // 4. 핸들러 함수들
  // -----------------------------------------------------------

  // [Library] 모델 선택 핸들러
  const handleSelectLibraryModel = (model) => {
    setSelectedLibModel(model);
    setIsPlacing(true);
    // Map3D 클래스에 대기 모델 주입
    if (map) map.pendingLibraryModel = model;
  };

  // [Edit] 입력값 변경 핸들러
  const handleInputChange = (key, value) => {
    const newInputs = { ...inputs, [key]: value };
    setInputs(newInputs);

    if (mode === 'EDIT' && map && selectedBuilding) {
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
            map.updateBuilding(selectedBuilding.id, { [key]: numValue });
        }
    }
  };

  // [Edit] 스케일 슬라이더 핸들러
  const handleScaleChange = (e) => {
    const newScale = parseFloat(e.target.value);
    handleInputChange('scale', newScale);
  };

  // [Box] 박스 배치 시작
  const handleStartPlacement = () => {
    if (!map) return;
    setIsPlacing(true);
    map.startBuildingPlacement(inputs.width, inputs.depth, inputs.height, inputs.rotation);
  };

  // [GLB Upload] 로컬 파일 선택
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && (file.name.endsWith('.glb') || file.name.endsWith('.gltf'))) {
        setUploadFile(file);
    } else {
        alert("glb 또는 gltf 파일만 가능합니다.");
        setUploadFile(null);
    }
  };

  // [GLB Upload] 배치 시작
  const handleStartModelPlacement = () => {
    if (!map || !uploadFile) {
        alert("파일을 먼저 선택해주세요.");
        return;
    }
    setIsPlacing(true);
    map.startModelPlacement(uploadFile);
  };

  // [Convert] 변환 파일 선택
  const handleConvertFileSelect = (e) => {
    setConvertFiles(Array.from(e.target.files));
    setConvertedResult(null); 
  };

  // [Convert] 변환 요청 (미사용 변수 isConverting 활용)
  const requestConversion = async () => {
    if (convertFiles.length === 0) { alert("파일을 선택하세요."); return; }
    const formData = new FormData();
    convertFiles.forEach(file => formData.append('files', file));

    setIsConverting(true); // 로딩 시작
    try {
      // Nginx Proxy 경로 사용
      const res = await fetch('http://localhost/api/convert', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
          // 결과 URL도 localhost 기준 보정 필요할 수 있음
          setConvertedResult(data);
      }
      else alert("변환 실패: " + (data.error || "오류"));
    } catch (e) {
      alert("서버 연결 실패");
    } finally {
      setIsConverting(false); // 로딩 끝
    }
  };

  // [Convert] 변환된 모델 배치
  const handlePlaceConvertedModel = () => {
    if (!map || !convertedResult) return;
    
    // 변환된 파일을 다시 Fetch로 가져와서 Blob으로 만듦
    setIsConverting(true);
    fetch(convertedResult.url)
      .then(res => res.blob())
      .then(blob => {
         const file = new File([blob], convertedResult.filename, { type: 'model/gltf-binary' });
         setIsConverting(false);
         setIsPlacing(true);
         map.startModelPlacement(file);
      })
      .catch(err => {
         console.error(err);
         setIsConverting(false);
         alert("파일 로드 실패");
      });
  };

  // [Edit] 재배치
  const handleRelocate = () => {
    if (!map || !selectedBuilding) return;
    setIsRelocating(true);
    map.startRelocation(selectedBuilding.id);
  };

  // [Edit] 삭제
  const handleDelete = () => {
    if (!map || !selectedBuilding) return;
    if (window.confirm("정말로 삭제하시겠습니까?")) {
      map.removeBuilding(selectedBuilding.id);
      if (onUpdate) onUpdate(); 
    }
  };

  // -----------------------------------------------------------
  // 5. UI 렌더링
  // -----------------------------------------------------------
  return (
    <div style={styles.panel}>
      {/* 헤더 */}
      <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '15px'}}>
        <h3 style={{margin:0, display:'flex', alignItems:'center'}}>
           {mode === 'EDIT' ? "✏️ 속성 편집" : "🏗️ 시뮬레이션"}
        </h3>
        <button onClick={onClose} style={styles.closeBtn}>✖</button>
      </div>

      {/* 탭 버튼 (EDIT 모드가 아닐 때만 표시) */}
      {mode !== 'EDIT' && (
        <div style={{display: 'flex', gap: '5px', marginBottom: '15px', flexWrap: 'wrap'}}>
          {/* 버튼 클릭 시 해당 모드로 전환, 이미 선택된 상태면 null(닫기) */}
          <button onClick={() => setMode(mode === 'CREATE' ? null : 'CREATE')} style={{...styles.tabBtn, background: mode==='CREATE'?'#2196F3':'#444'}}>📦 Box</button>
          <button onClick={() => setMode(mode === 'LIBRARY' ? null : 'LIBRARY')} style={{...styles.tabBtn, background: mode==='LIBRARY'?'#2196F3':'#444'}}>🏛️ Lib</button>
          <button onClick={() => setMode(mode === 'UPLOAD' ? null : 'UPLOAD')} style={{...styles.tabBtn, background: mode==='UPLOAD'?'#2196F3':'#444'}}>📂 GLB</button>
          <button onClick={() => setMode(mode === 'CONVERT' ? null : 'CONVERT')} style={{...styles.tabBtn, background: mode==='CONVERT'?'#2196F3':'#444'}}>🔄 3DS</button>
        </div>
      )}

      {/* 초기 안내 (아무 모드도 선택 안 했을 때) */}
      {!mode && (
          <div style={{textAlign:'center', color:'#888', padding:'20px', fontSize:'13px', border:'1px dashed #555', borderRadius:'4px'}}>
              👆 상단 버튼을 눌러 기능을 선택하세요.
          </div>
      )}

      {/* ──────────────── [모드 1] 박스 생성 ──────────────── */}
      {mode === 'CREATE' && (
        <>
          <div style={styles.grid2}>
             <div><label style={styles.label}>가로 (m)</label><input type="number" value={inputs.width} onChange={(e)=>setInputs({...inputs, width: e.target.value})} style={styles.input} /></div>
             <div><label style={styles.label}>세로 (m)</label><input type="number" value={inputs.depth} onChange={(e)=>setInputs({...inputs, depth: e.target.value})} style={styles.input} /></div>
          </div>
          <div style={{marginBottom: '15px'}}>
             <label style={styles.label}>높이 (m)</label><input type="number" value={inputs.height} onChange={(e)=>setInputs({...inputs, height: e.target.value})} style={styles.input} />
          </div>
          <button onClick={handleStartPlacement} style={{...styles.mainBtn, background: isPlacing ? '#FF9800' : '#4CAF50'}}>
             {isPlacing ? "📍 지도 클릭하여 배치" : "🖱️ 배치 시작"}
          </button>
        </>
      )}

      {/* ──────────────── [모드 2] 라이브러리 ──────────────── */}
      {mode === 'LIBRARY' && (
        <div style={styles.libraryContainer}>
            {/* 로딩/데이터 없음 처리 */}
            {library.length === 0 && <div style={{textAlign:'center', padding:'20px', color:'#aaa'}}>데이터를 불러오는 중이거나 없습니다.</div>}
            
            <div style={styles.libraryGrid}>
                {library.map(model => (
                    <div 
                        key={model.mlid} 
                        onClick={() => handleSelectLibraryModel(model)}
                        style={{ 
                            ...styles.libItem,
                            border: selectedLibModel?.mlid === model.mlid ? '2px solid #2196F3' : '1px solid #444'
                        }}
                    >
                        <img 
                            src={model.fullThumbUrl || 'https://via.placeholder.com/80?text=No+Img'} 
                            style={styles.libThumb} 
                            alt="thumb" 
                            onError={(e) => e.target.src = 'https://via.placeholder.com/80?text=Error'}
                        />
                        <div style={styles.libText}>{model.model_org_file_name}</div>
                    </div>
                ))}
            </div>
            {selectedLibModel && (
                <div style={{ marginTop: '10px', textAlign: 'center', color: '#FFEB3B', fontSize: '12px' }}>
                    {isPlacing ? "📍 지도를 클릭하세요" : "모델 선택됨"}
                </div>
            )}
        </div>
      )}

      {/* ──────────────── [모드 3] GLB 업로드 ──────────────── */}
      {mode === 'UPLOAD' && (
         <div style={{marginTop:'10px'}}>
            <input type="file" accept=".glb,.gltf" onChange={handleFileSelect} style={{width:'100%', color:'#ddd', marginBottom:'10px', fontSize:'12px'}} />
            {uploadFile && (
                <button onClick={handleStartModelPlacement} style={{...styles.mainBtn, background: isPlacing ? '#FF9800' : '#4CAF50'}}>
                   {isPlacing ? "📍 위치 지정" : "🖱️ 모델 배치"}
                </button>
            )}
         </div>
      )}

      {/* ──────────────── [모드 4] 3DS 변환 ──────────────── */}
      {mode === 'CONVERT' && (
         <div style={{marginTop:'10px'}}>
            <div style={{marginBottom:'10px', fontSize:'11px', color:'#aaa'}}>* 3ds 파일과 텍스처(jpg/png)를 함께 선택하세요.</div>
            <input type="file" accept=".3ds,.jpg,.png" multiple onChange={handleConvertFileSelect} style={{width:'100%', color:'#ddd', marginBottom:'10px', fontSize:'12px'}} />
            
            {convertFiles.length > 0 && !isConverting && !convertedResult && (
               <button onClick={requestConversion} style={{...styles.mainBtn, background: '#9C27B0'}}>🔄 변환 실행</button>
            )}
            
            {isConverting && <div style={{textAlign:'center', color:'#FF9800', padding:'10px'}}>⏳ 변환 중...</div>}
            
            {convertedResult && !isConverting && (
               <div style={{marginTop:'10px', padding:'10px', background:'rgba(255,255,255,0.1)', borderRadius:'4px'}}>
                  <div style={{color:'#4CAF50', marginBottom:'5px', fontWeight:'bold', fontSize:'13px'}}>✅ 변환 성공</div>
                  <button onClick={handlePlaceConvertedModel} style={{...styles.mainBtn, background: isPlacing ? '#FF9800' : '#4CAF50'}}>
                     {isPlacing ? "📍 위치 지정" : "🖱️ 지도 배치"}
                  </button>
               </div>
            )}
         </div>
      )}

      {/* ──────────────── [모드 5] 편집 (핵심 수정 부분) ──────────────── */}
      {mode === 'EDIT' && selectedBuilding && (
        <>
          <div style={styles.editSection}>
             {selectedBuilding.isModel ? (
               <>
                 <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px'}}>
                   <label style={styles.labelBold}>📐 크기 비율 (Scale)</label>
                   
                   {/* [추가] 직접 숫자 입력 가능하도록 변경 */}
                   <input 
                      type="number" 
                      step="0.1" 
                      value={inputs.scale} 
                      onChange={handleScaleChange} 
                      style={{width:'60px', padding:'2px', background:'#222', border:'1px solid #555', color:'white', textAlign:'right'}} 
                   />
                 </div>
                 
                 {/* [수정] 최대값(max)을 5.0 -> 200으로 변경 (필요시 더 늘려도 됨) */}
                 <input type="range" min="0.1" max="200.0" step="0.1" 
                        value={inputs.scale} onChange={handleScaleChange} 
                        style={{width:'100%', cursor:'pointer', marginBottom:'10px'}} />
                 
                 <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px', textAlign:'center'}}>
                    <div style={styles.statBox}><span style={styles.statLabel}>가로</span><div style={styles.statValue}>{(inputs.originalWidth * inputs.scale).toFixed(1)}m</div></div>
                    <div style={styles.statBox}><span style={styles.statLabel}>세로</span><div style={styles.statValue}>{(inputs.originalDepth * inputs.scale).toFixed(1)}m</div></div>
                    <div style={styles.statBox}><span style={styles.statLabel}>높이</span><div style={styles.statValue}>{(inputs.originalHeight * inputs.scale).toFixed(1)}m</div></div>
                 </div>
               </>
             ) : (
               <>
                 <label style={styles.labelBold}>📐 크기 (Dimensions)</label>
                 <div style={styles.grid2}>
                    <div><label style={styles.label}>가로(m)</label><input type="number" step="0.1" value={inputs.width} onChange={(e)=>handleInputChange('width', e.target.value)} style={styles.input} /></div>
                    <div><label style={styles.label}>세로(m)</label><input type="number" step="0.1" value={inputs.depth} onChange={(e)=>handleInputChange('depth', e.target.value)} style={styles.input} /></div>
                 </div>
                 <div><label style={styles.label}>높이(m)</label><input type="number" step="0.1" value={inputs.height} onChange={(e)=>handleInputChange('height', e.target.value)} style={styles.input} /></div>
               </>
             )}
          </div>

          <div style={{marginBottom: '15px'}}>
             <div style={{display:'flex', justifyContent:'space-between'}}>
                <label style={styles.label}>🔄 회전</label>
                <span style={{fontSize:'11px', color:'#aaa'}}>{parseInt(inputs.rotation)}°</span>
             </div>
             <input type="range" min="0" max="360" step="1" value={inputs.rotation} onChange={(e)=>handleInputChange('rotation', e.target.value)} style={{width: '100%', cursor:'pointer'}} />
          </div>

          {selectedBuilding.metaData && (
            <div style={styles.metaContainer}>
              <div style={styles.metaHeader}>📊 속성 정보</div>
              <div style={styles.metaBody}>
                <table style={{width: '100%', borderCollapse: 'collapse'}}>
                  <tbody>
                    {Object.entries(selectedBuilding.metaData).map(([key, value]) => {
                      if (key.startsWith('_') || ['isSimulation', 'isModel', 'lat', 'lon', 'heading', 'pitch', 'roll', 'width', 'depth', 'height', 'scale', 'rotation', 'originalWidth', 'originalDepth', 'originalHeight'].includes(key)) return null;
                      return (
                        <tr key={key} style={{borderBottom: '1px solid #444'}}>
                          <td style={{padding: '4px 0', color: '#aaa', fontSize:'11px', width:'40%'}}>{key}</td>
                          <td style={{padding: '4px 0', color: '#fff', fontSize:'11px', textAlign: 'right', wordBreak: 'break-all'}}>{typeof value === 'object' ? '...' : String(value)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{display:'flex', flexDirection:'column', gap:'8px', marginTop:'15px'}}>
             <button onClick={handleRelocate} style={{...styles.mainBtn, background: isRelocating ? '#FF9800' : '#9C27B0'}}>
               {isRelocating ? "📍 지도 클릭하여 이동" : "✥ 위치 이동"}
             </button>
             <div style={{display:'flex', gap:'5px'}}>
               <button onClick={handleDelete} style={{...styles.mainBtn, background: '#D32F2F', flex:1}}>🗑️ 삭제</button>
               <button onClick={onUpdate} style={{...styles.mainBtn, background: '#2196F3', flex:2}}>완료</button>
             </div>
          </div>
        </>
      )}

      {/* [시나리오 저장 버튼] - 편집 모드가 아닐 때, 모드가 선택되어 있을 때만 표시 */}
      {mode !== 'EDIT' && mode !== null && (
        <button 
            onClick={() => map.exportToGeoJSON("New_Scenario")}
            style={{...styles.mainBtn, background: '#4CAF50', marginTop: '15px', border:'1px solid #2e7d32'}}
        >
            💾 시나리오 저장 (GeoJSON)
        </button>
      )}
    </div>
  );
};

// -----------------------------------------------------------
// 6. 스타일 상수
// -----------------------------------------------------------
const styles = {
  panel: { 
    position: 'absolute', top: 80, right: 20, width: '320px', 
    background: 'rgba(30, 30, 35, 0.95)', color: 'white', 
    padding: '20px', borderRadius: '8px', zIndex: 5000, 
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', 
    border: '1px solid rgba(255,255,255,0.1)' 
  },
  closeBtn: { background:'transparent', border:'none', color:'#aaa', cursor:'pointer', fontSize:'16px' },
  tabBtn: { flex: 1, padding: '8px', border:'none', color:'white', borderRadius:'4px', cursor:'pointer', fontSize:'12px', fontWeight:'bold', transition: '0.2s' },
  mainBtn: { width: '100%', padding: '12px', border: 'none', color: 'white', fontWeight: 'bold', borderRadius: '4px', cursor:'pointer', fontSize:'13px', transition: 'background 0.2s' },
  
  label: { fontSize:'12px', color:'#aaa', display:'block', marginBottom:'4px' },
  labelBold: { fontSize:'12px', color:'#fff', display:'block', marginBottom:'4px', fontWeight:'bold' },
  input: { width: '100%', padding: '8px', background: '#222', border: '1px solid #444', color: 'white', borderRadius: '4px', boxSizing: 'border-box' },
  
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' },
  statBox: { background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '4px' },
  statLabel: { display: 'block', fontSize: '10px', color: '#888' },
  statValue: { fontSize: '12px', color: '#fff', fontWeight: 'bold' },

  libraryContainer: { marginTop: '10px' },
  libraryGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', maxHeight: '300px', overflowY: 'auto', padding: '5px', background: '#222', borderRadius: '4px' },
  libItem: { padding: '8px', background: '#333', borderRadius: '4px', cursor: 'pointer', textAlign: 'center', transition: '0.2s' },
  libThumb: { width: '100%', height: '60px', objectFit: 'cover', borderRadius: '2px', marginBottom: '5px' },
  libText: { fontSize: '10px', color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },

  editSection: { marginBottom:'15px', padding:'10px', background:'rgba(255,255,255,0.05)', borderRadius:'6px', border:'1px solid #444' },
  metaContainer: { marginTop: '15px', borderRadius: '6px', border: '1px solid #444', background: 'rgba(0,0,0,0.2)', overflow: 'hidden' },
  metaHeader: { padding: '8px', background: 'rgba(255,255,255,0.05)', fontSize: '12px', color: '#4CAF50', fontWeight: 'bold', borderBottom: '1px solid #444' },
  metaBody: { padding: '8px', maxHeight: '150px', overflowY: 'auto' }
};

export default SimulationPanel;