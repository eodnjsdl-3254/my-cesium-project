import React from "react";
import { Entity, PolygonGraphics, BillboardGraphics, ScreenSpaceEventHandler, ScreenSpaceEvent } from "resium";
import { ScreenSpaceEventType, HeightReference, CallbackProperty } from "cesium";

const GreeneryLayer = ({ isActive, drawProps }) => {
  const { drawingPoints, finalPolygon, trees, addPoint, finishDrawing } = drawProps;

  return (
    <>
      {/* 1. 그리기 핸들러: 활성화 시에만 작동 */}
      {isActive && (
        <ScreenSpaceEventHandler>
          <ScreenSpaceEvent action={(e) => addPoint(e.position)} type={ScreenSpaceEventType.LEFT_CLICK} />
          <ScreenSpaceEvent action={finishDrawing} type={ScreenSpaceEventType.LEFT_DOUBLE_CLICK} />
        </ScreenSpaceEventHandler>
      )}

      {/* 2. 녹지 폴리곤 시각화 */}
      {finalPolygon && (
        <>
          {/* 베이스 울창한 숲 */}
          <Entity>
            <PolygonGraphics hierarchy={finalPolygon} material={"/green/texture1.jpg"} />
          </Entity>
          {/* 상단 움직이는 텍스처 (바람 효과) */}
          <Entity>
            <PolygonGraphics 
              hierarchy={finalPolygon} 
              height={1.5} 
              material={"/green/texture2.jpg"} 
              stRotation={new CallbackProperty(() => Date.now() * 0.00005, false)} 
            />
          </Entity>
        </>
      )}

      {/* 3. 배치된 나무들 */}
      {trees.map((tree, i) => (
        <Entity key={i} position={tree.position}>
          <BillboardGraphics 
            image={tree.image} 
            width={40} height={40} 
            heightReference={HeightReference.CLAMP_TO_GROUND} 
          />
        </Entity>
      ))}
    </>
  );
};

export default GreeneryLayer;