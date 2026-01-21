import React from 'react';

export const UI = ({ map }) => {
  // 컴포넌트가 렌더링될 때마다 map의 상태를 출력합니다.
  console.log("🖥️ UI가 받은 map 객체:", map);

  return (
    <div style={{ position: "absolute", zIndex: 10, top: 10, left: 10, display: "flex", gap: "5px" }}>
      <button onClick={() => {
        console.log("🖱️ '홈으로' 클릭! map 존재여부:", !!map);
        map?.camera.viewHome();
      }}>홈으로</button>

      <button onClick={() => {
        console.log("🖱️ '서울 이동' 클릭! focusLocation 존재여부:", !!map?.focusLocation);
        // 만약 map3d.js에 focusLocation을 정의하지 않았다면 여기서 아무 일도 안 일어납니다.
        map?.focusLocation(37.5665, 126.9780, "서울시청");
      }}>서울 이동</button>

      <button onClick={() => {
        console.log("🖱️ '데이터 삭제' 클릭!");
        map?.data.clearAll();
      }}>데이터 삭제</button>
    </div>
  );
};