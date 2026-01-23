export class VWorldNativeManager {
  constructor() {
    this.vmap = null;
  }

  // V-World API 초기화
  init(containerId) {
    if (!window.vw) {
      console.error("V-World 스크립트 로드 실패");
      return;
    }

    // 지도 옵션
    const mapOptions = new window.vw.MapOptions(
      window.vw.BasemapType.GRAPHIC,
      "",
      window.vw.DensityType.BASIC,
      window.vw.DensityType.BASIC,
      false,
      new window.vw.CameraPosition(
        new window.vw.CoordZ(126.8320, 37.6585, 1000), // 고양시청
        new window.vw.Direction(-45, 0, 0)
      ),
      new window.vw.CameraPosition(
        new window.vw.CoordZ(126.8320, 37.6585, 1000),
        new window.vw.Direction(0, -90, 0)
      )
    );

    this.vmap = new window.vw.Map(containerId, mapOptions);
    console.log("🇰🇷 V-World 네이티브 맵 생성 완료");
  }

  destroy() {
    this.vmap = null;
  }
}