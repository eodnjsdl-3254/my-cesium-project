import * as Cesium from "cesium"

export class DataManager {
  constructor(viewer) {
    this.viewer = viewer;
  }

  // 기본 마커(포인트) 추가
  addMarker(lat, lon, id, name) {
    return this.viewer.entities.add({
      id: id,
      name: name,
      position: Cesium.Cartesian3.fromDegrees(lon, lat),
      point: { pixelSize: 10, color: Cesium.Color.YELLOW, outlineWidth: 2 },
      label: { text: name, font: '14pt sans-serif', pixelOffset: new Cesium.Cartesian2(0, -20) }
    });
  }

  // 모든 데이터 삭제
  clearAll() {
    this.viewer.entities.removeAll();
  }
}