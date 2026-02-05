import React, { useState, useEffect } from 'react';

const SimulationPanel = ({ map, onClose, selectedBuilding, onUpdate }) => {
  // -----------------------------------------------------------
  // 1. 상태 관리
  // -----------------------------------------------------------
  const [mode, setMode] = useState(null); // CREATE, UPLOAD, CONVERT, EDIT, LIBRARY, null
  
  const [sceneList, setSceneList] = useState([]); // 불러오기 목록
  const [showLoadModal, setShowLoadModal] = useState(false); // 로드 모달 표시 여부
  
  const [isPlacing, setIsPlacing] = useState(false);
  const [isRelocating, setIsRelocating] = useState(false);
  
  // 파일 업로드 및 변환 상태
  const [uploadFile, setUploadFile] = useState(null); 
  const [convertFiles, setConvertFiles] = useState([]);
  const [isConverting, setIsConverting] = useState(false);
  const [convertedResult, setConvertedResult] = useState(null);

  const [library, setLibrary] = useState([]); // DB 모델 리스트
  const [selectedLibModel, setSelectedLibModel] = useState(null);

  // 입력값 상태
  const [inputs, setInputs] = useState({
    width: 20, depth: 20, height: 50, // 박스용
    scale: 1.0,                       // 모델용
    rotation: 0,
    lat: 0, lon: 0,
    originalWidth: 0, originalDepth: 0, originalHeight: 0
  });

  // -----------------------------------------------------------
  // 2. 선택된 건물 감지 (EDIT 모드 진입)
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
      setMode(null); 
    }
  }, [selectedBuilding]);

  // -----------------------------------------------------------
  // 3. 라이브러리 목록 로드
  // -----------------------------------------------------------
  useEffect(() => {
    fetch('http://localhost/api/models') 
      .then(res => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.json();
      })
      .then(data => {
          if (Array.isArray(data)) {
              const formattedData = data.map(item => ({
                  ...item,
                  fullThumbUrl: item.thumb_save_url 
                    ? `http://localhost/files${item.thumb_save_url}`
                    : null
              }));
              setLibrary(formattedData);
          } else {
              setLibrary([]); 
          }
      })
      .catch(err => {
          console.error("❌ 라이브러리 로드 실패:", err);
          setLibrary([]); 
      });
  }, []);

  // -----------------------------------------------------------
  // 4. 핸들러 함수들
  // -----------------------------------------------------------
  const handleSelectLibraryModel = (model) => {
    setSelectedLibModel(model);
    setIsPlacing(true);
    if (map) map.pendingLibraryModel = model;
  };

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

  const handleScaleChange = (e) => {
    const newScale = parseFloat(e.target.value);
    handleInputChange('scale', newScale);
  };

  const handleStartPlacement = () => {
    if (!map) return;
    setIsPlacing(true);
    map.startBuildingPlacement(inputs.width, inputs.depth, inputs.height, inputs.rotation);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && (file.name.endsWith('.glb') || file.name.endsWith('.gltf'))) {
        setUploadFile(file);
    } else {
        alert("glb 또는 gltf 파일만 가능합니다.");
        setUploadFile(null);
    }
  };

  const handleStartModelPlacement = () => {
    if (!map || !uploadFile) {
        alert("파일을 먼저 선택해주세요.");
        return;
    }
    setIsPlacing(true);
    map.startModelPlacement(uploadFile);
  };

  const handleConvertFileSelect = (e) => {
    setConvertFiles(Array.from(e.target.files));
    setConvertedResult(null); 
  };

  const requestConversion = async () => {
    if (convertFiles.length === 0) { alert("파일을 선택하세요."); return; }
    const formData = new FormData();
    convertFiles.forEach(file => formData.append('files', file));

    setIsConverting(true); 
    try {
      const res = await fetch('http://localhost/api/convert', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
          setConvertedResult(data);
      }
      else alert("변환 실패: " + (data.error || "오류"));
    } catch (e) {
      alert("서버 연결 실패");
    } finally {
      setIsConverting(false); 
    }
  };

  const handlePlaceConvertedModel = () => {
    if (!map || !convertedResult) return;
    
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

  // [시나리오 저장 핸들러]
  const handleSaveScenario = async () => {
    if (!map) return;
    const name = prompt("저장할 시나리오 이름을 입력하세요:", "My Scene 1");
    if (!name) return;

    const geoJson = map.exportToGeoJSON(name);

    try {
      const res = await fetch("http://localhost/api/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
           scene_name: name,
           user_id: "demo_user",
           scene_data: geoJson
        })
      });
      const data = await res.json();
      if (data.status === "success") {
        alert("저장되었습니다!");
      } else {
        alert("저장 실패: " + JSON.stringify(data));
      }
    } catch (e) {
      alert("서버 연결 오류");
    }
  };

  // [시나리오 목록 불러오기]
  const fetchSceneList = () => {
      fetch("http://localhost/api/scenes")
        .then(res => res.json())
        .then(data => {
            setSceneList(data);
            setShowLoadModal(true); 
        });
  };

  // [특정 시나리오 적용]
  const loadScene = async (sceneId) => {
      if (!window.confirm("현재 작업 내용이 사라집니다. 불러오시겠습니까?")) return;
      
      try {
          const res = await fetch(`http://localhost/api/scenes/${sceneId}`);
          const data = await res.json();
          
          if (data.scene_data) {
              let targetData = data.scene_data;
              
              // 만약 안에 또 scene_data가 있고, 그 안에 features가 있다면? 한 꺼풀 벗김
              if (targetData.scene_data && targetData.scene_data.features) {
                  console.log("⚠️ 중첩된 데이터 구조 감지됨 (Unwrapping...)");
                  targetData = targetData.scene_data;
              }

              // 이제 올바른 데이터를 map.js로 전달
              map.importGeoJSON(targetData); 
              
              alert(`[${data.scene_name}] 로드 완료`);
              setShowLoadModal(false);
          }
      } catch (e) {
          console.error(e);
          alert("로드 실패");
      }
  };

  // -----------------------------------------------------------
  // 5. UI 렌더링 (return)
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

      {/* 탭 버튼 */}
      {mode !== 'EDIT' && (
        <div style={{display: 'flex', gap: '5px', marginBottom: '15px', flexWrap: 'wrap'}}>
          <button onClick={() => setMode(mode === 'CREATE' ? null : 'CREATE')} style={{...styles.tabBtn, background: mode==='CREATE'?'#2196F3':'#444'}}>📦 Box</button>
          <button onClick={() => setMode(mode === 'LIBRARY' ? null : 'LIBRARY')} style={{...styles.tabBtn, background: mode==='LIBRARY'?'#2196F3':'#444'}}>🏛️ Lib</button>
          <button onClick={() => setMode(mode === 'UPLOAD' ? null : 'UPLOAD')} style={{...styles.tabBtn, background: mode==='UPLOAD'?'#2196F3':'#444'}}>📂 GLB</button>
          <button onClick={() => setMode(mode === 'CONVERT' ? null : 'CONVERT')} style={{...styles.tabBtn, background: mode==='CONVERT'?'#2196F3':'#444'}}>🔄 3DS</button>
        </div>
      )}

      {!mode && (
          <div style={{textAlign:'center', color:'#888', padding:'20px', fontSize:'13px', border:'1px dashed #555', borderRadius:'4px'}}>
              👆 상단 버튼을 눌러 기능을 선택하세요.
          </div>
      )}

      {/* [모드 1] 박스 생성 */}
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

      {/* [모드 2] 라이브러리 */}
      {mode === 'LIBRARY' && (
        <div style={styles.libraryContainer}>
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

      {/* [모드 3] GLB 업로드 */}
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

      {/* [모드 4] 3DS 변환 */}
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

      {/* [모드 5] 편집 */}
      {mode === 'EDIT' && selectedBuilding && (
        <>
          <div style={styles.editSection}>
             {selectedBuilding.isModel ? (
               <>
                 <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px'}}>
                   <label style={styles.labelBold}>📐 크기 비율 (Scale)</label>
                   <input type="number" step="0.1" value={inputs.scale} onChange={handleScaleChange} style={{width:'60px', padding:'2px', background:'#222', border:'1px solid #555', color:'white', textAlign:'right'}} />
                 </div>
                 <input type="range" min="0.1" max="200.0" step="0.1" value={inputs.scale} onChange={handleScaleChange} style={{width:'100%', cursor:'pointer', marginBottom:'10px'}} />
                 
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

      {/* ✅ [추가됨] 시나리오 저장/로드 버튼 그룹 */}
      {mode !== 'EDIT' && mode !== null && (
        <div style={{marginTop: '15px', display:'flex', gap:'5px'}}>
            <button 
                onClick={handleSaveScenario}
                style={{...styles.mainBtn, background: '#4CAF50', border:'1px solid #2e7d32', flex:1}}
            >
                💾 저장
            </button>
            <button 
                onClick={fetchSceneList}
                style={{...styles.mainBtn, background: '#FF9800', border:'1px solid #F57C00', flex:1}}
            >
                📂 불러오기
            </button>
        </div>
      )}

      {/* ✅ [추가됨] 로드 모달 (목록 표시) */}
      {showLoadModal && (
           <div style={styles.modal}>
               <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #555', paddingBottom:'5px', marginBottom:'5px'}}>
                   <h4 style={{margin:0, color:'white'}}>📂 시나리오 목록</h4>
                   <button onClick={()=>setShowLoadModal(false)} style={{background:'none', border:'none', color:'#aaa', cursor:'pointer'}}>✖</button>
               </div>
               
               <ul style={{listStyle:'none', padding:0, margin:0, maxHeight:'200px', overflowY:'auto'}}>
                   {sceneList.length === 0 && <li style={{color:'#888', textAlign:'center', padding:'10px'}}>저장된 시나리오가 없습니다.</li>}
                   {sceneList.map(scene => (
                       <li key={scene.scene_id} style={{borderBottom:'1px solid #444', padding:'8px 0', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                           <div style={{overflow:'hidden', marginRight:'5px'}}>
                               <div style={{color:'white', fontSize:'13px', fontWeight:'bold', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{scene.scene_name}</div>
                               <div style={{color:'#888', fontSize:'10px'}}>{scene.reg_date?.substring(0,10)}</div>
                           </div>
                           <button onClick={()=>loadScene(scene.scene_id)} style={{background:'#2196F3', border:'none', color:'white', borderRadius:'4px', cursor:'pointer', padding:'4px 8px', fontSize:'11px'}}>
                               Load
                           </button>
                       </li>
                   ))}
               </ul>
           </div>
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
  // ... (기존 스타일 유지) ...
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
  metaBody: { padding: '8px', maxHeight: '150px', overflowY: 'auto' },
  
  // ✅ [추가됨] 모달 스타일
  modal: {
      position:'absolute', top:'100%', right:0, width:'100%', 
      background:'rgba(35, 35, 40, 0.98)', border:'1px solid #666', 
      padding:'10px', borderRadius:'8px', zIndex:6000,
      marginTop: '5px', boxSizing: 'border-box', boxShadow: '0 4px 15px rgba(0,0,0,0.8)'
  }
};

export default SimulationPanel;