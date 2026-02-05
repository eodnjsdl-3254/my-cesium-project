/**
 * 🛠️ [Helper] 파싱 실패 시 반환할 기본 데이터
 */
const getDefaultData = (filename, errorMsg = "") => ({
  fileInfo: {
    name: filename,
    generator: "Unknown",
    version: "2.0",
    error: errorMsg
  },
  metaData: { 
    Note: "메타데이터를 추출할 수 없어 기본값으로 대체되었습니다.",
    Error: errorMsg 
  },
  geometry: {
    width: 10, depth: 10, height: 10,
    scale: [1, 1, 1],
    rotation: [0, 0, 0, 1],
    position: [0, 0, 0],
    rootNodeName: "Node_0" // 기본값
  }
});

/**
 * 📦 GLB 파일을 심층 분석하여 메타데이터와 물리적 정보를 추출하는 통합 함수
 * - 모든 메쉬의 Bounding Box를 계산하여 전체 크기 도출
 * - 숨겨진 Custom Properties (extras) 전수 조사
 * - ★ [중요] 비균등 스케일을 위한 Root Node 이름 추출
 */
export const extractGlbFullDetails = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target.result;
        const dataView = new DataView(buffer);

        // 1. 매직 넘버 체크 (GLTF 포맷 확인: 'glTF')
        if (dataView.getUint32(0, true) !== 0x46546c67) {
          console.warn("❌ 유효한 GLB 파일이 아닙니다.");
          resolve(getDefaultData(file.name, "Invalid Magic Number"));
          return;
        }

        // 2. JSON 청크 추출 및 파싱
        // GLB Header(12bytes) = Magic(4) + Version(4) + Length(4)
        // Chunk 0 Header(8bytes) = Length(4) + Type(4)
        const chunkLength = dataView.getUint32(12, true);
        const chunkType = dataView.getUint32(16, true);

        // JSON Chunk Type must be 0x4E4F534A ('JSON')
        if (chunkType !== 0x4E4F534A) {
             console.warn("❌ JSON 청크를 찾을 수 없습니다.");
             resolve(getDefaultData(file.name, "No JSON Chunk"));
             return;
        }

        const jsonChunk = new Uint8Array(buffer, 20, chunkLength);
        const decoder = new TextDecoder("utf-8");
        const jsonString = decoder.decode(jsonChunk);
        const gltf = JSON.parse(jsonString);

        // ---------------------------------------------------------
        // 📊 [분석 시작] 결과 객체 초기화
        // ---------------------------------------------------------
        const result = {
          fileInfo: {
            name: file.name,
            generator: gltf.asset?.generator || 'Unknown',
            version: gltf.asset?.version
          },
          metaData: {},
          geometry: {
            width: 0, depth: 0, height: 0,
            scale: [1, 1, 1],
            rotation: [0, 0, 0, 1],
            position: [0, 0, 0],
            rootNodeName: "Node_0"
          }
        };

        // ---------------------------------------------------------
        // A. 메타데이터 심층 탐색 (Nodes, Materials, Textures)
        // ---------------------------------------------------------
        
        // 1) 노드(Node) 속성 수집 및 Root Node 이름 확보
        if (gltf.nodes && gltf.nodes.length > 0) {
          
          // 🚨 [보강된 로직] "MainBuilding"이 있으면 그걸 쓰고, 없으면 첫 번째 노드를 쓴다.
          const mainNode = gltf.nodes.find(n => n.name === "MainBuilding");
          if (mainNode) {
              result.geometry.rootNodeName = "MainBuilding";
          } else if (gltf.nodes[0].name) {
              result.geometry.rootNodeName = gltf.nodes[0].name;
          }

          // 메타데이터 수집
          gltf.nodes.forEach((node, i) => {
            if (node.name && !node.name.includes('Scene')) {
                 result.metaData[`Node_${i}`] = node.name;
            }
            if (node.extras) {
                 Object.assign(result.metaData, node.extras);
            }
          });
        }

        // 2) 텍스처(Image) 이름 수집
        if (gltf.images && gltf.images.length > 0) {
           gltf.images.forEach((img, i) => {
              const imgName = img.name || (img.uri ? img.uri.split('/').pop() : `Texture_${i}`);
              result.metaData[`Texture_${i}`] = imgName; 
           });
        }

        // 3) 재질(Material) 이름 수집
        if (gltf.materials) {
           gltf.materials.forEach((mat, i) => {
              if (mat.name) result.metaData[`Material_${i}`] = mat.name;
              if (mat.extras) Object.assign(result.metaData, mat.extras);
           });
        }

        // 4) GIS 속성 (_BATCHID 등)
        if (gltf.meshes) {
           gltf.meshes.forEach(mesh => {
               mesh.primitives.forEach(prim => {
                   if (prim.attributes) {
                       Object.keys(prim.attributes).forEach(attr => {
                           if (attr.startsWith('_')) result.metaData['GIS_Attr'] = attr; 
                       });
                   }
               });
           });
        }

        // ---------------------------------------------------------
        // B. 물리적 크기 정밀 계산 (Global Bounding Box)
        // ---------------------------------------------------------
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        let foundGeometry = false;

        if (gltf.meshes && gltf.accessors) {
          gltf.meshes.forEach(mesh => {
            mesh.primitives.forEach(prim => {
              const positionIdx = prim.attributes.POSITION;
              if (positionIdx !== undefined) {
                const accessor = gltf.accessors[positionIdx];
                if (accessor.min && accessor.max) {
                   minX = Math.min(minX, accessor.min[0]);
                   minY = Math.min(minY, accessor.min[1]);
                   minZ = Math.min(minZ, accessor.min[2]);
                   maxX = Math.max(maxX, accessor.max[0]);
                   maxY = Math.max(maxY, accessor.max[1]);
                   maxZ = Math.max(maxZ, accessor.max[2]);
                   foundGeometry = true;
                }
              }
            });
          });
        }

        if (foundGeometry) {
            const rawW = Math.abs(maxX - minX);
            const rawH = Math.abs(maxY - minY); // Y-up 기준
            const rawD = Math.abs(maxZ - minZ);

            result.geometry.width = parseFloat((rawW < 0.01 ? 1.0 : rawW).toFixed(2));
            result.geometry.height = parseFloat((rawH < 0.01 ? 1.0 : rawH).toFixed(2));
            result.geometry.depth = parseFloat((rawD < 0.01 ? 1.0 : rawD).toFixed(2));
        } else {
            console.warn("⚠️ 메쉬 데이터를 찾을 수 없어 기본 크기를 적용합니다.");
            result.geometry.width = 10;
            result.geometry.height = 10;
            result.geometry.depth = 10;
        }

        // 초기 변환값 (Rotation, Scale, Position)
        if (gltf.nodes && gltf.nodes.length > 0) {
            const root = gltf.nodes[0];
            if (root.rotation) result.geometry.rotation = root.rotation;
            if (root.scale) result.geometry.scale = root.scale;
            if (root.translation) result.geometry.position = root.translation;
        }

        console.log("✅ [GLB 파서] 분석 완료:", result);
        resolve(result);

      } catch (err) {
        console.error("❌ GLB 파싱 치명적 오류:", err);
        resolve(getDefaultData(file.name, err.message));
      }
    };

    reader.onerror = () => {
        resolve(getDefaultData(file.name, "File Read Error"));
    };

    reader.readAsArrayBuffer(file);
  });
};