// src/cesium/MapController.jsx
import { useEffect } from "react";
import { useCesium } from "resium";

const MapController = ({ initMap }) => {
  const { viewer } = useCesium();

  useEffect(() => {
    if (viewer) {
      initMap(viewer);
    }
  }, [viewer, initMap]);

  return null;
};

export default MapController;