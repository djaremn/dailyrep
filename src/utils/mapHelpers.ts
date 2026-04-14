import L from 'leaflet';

/**
 * Espera a que todos los tiles visibles del mapa estén cargados
 * o hasta que se alcance el timeout.
 */
export function waitForTiles(map: L.Map, timeout = 5000): Promise<void> {
  return new Promise((resolve) => {
    let resolved = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const checkTiles = () => {
      const tiles = document.querySelectorAll('.leaflet-tile');
      const allLoaded = Array.from(tiles).every(
        (tile) => (tile as HTMLImageElement).complete
      );
      if (allLoaded && tiles.length > 0 && !resolved) {
        resolved = true;
        if (timer) clearTimeout(timer);
        resolve();
      }
    };

    const onLoad = () => {
      if (!resolved) checkTiles();
    };

    map.on('load', onLoad);
    map.on('tileload', onLoad);

    timer = setTimeout(() => {
      if (!resolved) {
        map.off('load', onLoad);
        map.off('tileload', onLoad);
        resolved = true;
        resolve();
      }
    }, timeout);

    // Primera verificación después de un breve delay
    setTimeout(checkTiles, 100);
  });
}

/**
 * Ajusta la vista del mapa para que contenga todos los polígonos
 * representados por las cadenas GeoJSON proporcionadas.
 */
export function fitMapToGeoJSON(map: L.Map, geoJsonStrings: string[]) {
  const bounds = L.latLngBounds([]);
  geoJsonStrings.forEach((str) => {
    try {
      const geo = JSON.parse(str);
      const layer = L.geoJSON(geo);
      const layerBounds = layer.getBounds();
      if (layerBounds.isValid()) {
        bounds.extend(layerBounds);
      }
    } catch {
      // Ignorar polígonos corruptos
    }
  });
  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [30, 30] });
  }
}