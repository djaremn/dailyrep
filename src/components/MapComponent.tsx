import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import 'leaflet.offline';

// Corregir iconos de Leaflet
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapComponentProps {
  initialPolygons?: string | null;
  onPolygonDrawn?: (geoJson: string) => void;
  readOnly?: boolean;
  historicalPolygons?: string[];
}

const MapComponent: React.FC<MapComponentProps> = ({
  initialPolygons,
  onPolygonDrawn,
  readOnly = false,
  historicalPolygons = [],
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [drawnItems] = useState<L.FeatureGroup>(() => new L.FeatureGroup());
  const [historicalLayer] = useState<L.FeatureGroup>(() => new L.FeatureGroup());

  // Inicializar mapa
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [-33.4489, -70.6693],
      zoom: 13,
    });

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles &copy; Esri' }
    ).addTo(map);

    map.addLayer(drawnItems);
    map.addLayer(historicalLayer);

    if (!readOnly) {
      const drawControl = new L.Control.Draw({
        draw: {
          polygon: {
            allowIntersection: false,
            shapeOptions: { color: '#3388ff' },
          },
          polyline: false,
          rectangle: false,
          circle: false,
          marker: false,
          circlemarker: false,
        },
        edit: {
          featureGroup: drawnItems,
          remove: true,
        },
      });
      map.addControl(drawControl);

      // Usar strings para los nombres de eventos (evita problemas de tipos)
      map.on('draw:created', (e: unknown) => {
        const event = e as L.DrawEvents.Created;
        const layer = event.layer;
        drawnItems.addLayer(layer);
        const geoJson = drawnItems.toGeoJSON();
        onPolygonDrawn?.(JSON.stringify(geoJson));
      });

      map.on('draw:edited', () => {
        const geoJson = drawnItems.toGeoJSON();
        onPolygonDrawn?.(JSON.stringify(geoJson));
      });

      map.on('draw:deleted', () => {
        const geoJson = drawnItems.toGeoJSON();
        onPolygonDrawn?.(JSON.stringify(geoJson));
      });
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, onPolygonDrawn]);

  // Cargar polígono del día actual
  useEffect(() => {
    if (!mapRef.current) return;
    drawnItems.clearLayers();
    if (initialPolygons) {
      try {
        const geoJson = JSON.parse(initialPolygons);
        L.geoJSON(geoJson).eachLayer((layer) => drawnItems.addLayer(layer));
      } catch (e) {
        console.warn('Error cargando polígono actual', e);
      }
    }
  }, [initialPolygons, drawnItems]);

  // Cargar polígonos históricos
  useEffect(() => {
    if (!mapRef.current) return;
    historicalLayer.clearLayers();
    historicalPolygons.forEach((geoJsonStr) => {
      try {
        const geoJson = JSON.parse(geoJsonStr);
        L.geoJSON(geoJson, {
          style: { color: '#ff7800', weight: 2, opacity: 0.7, fillOpacity: 0.1 },
        }).eachLayer((layer) => historicalLayer.addLayer(layer));
      } catch (e) {
        console.warn('Error cargando polígono histórico', e);
      }
    });
  }, [historicalPolygons, historicalLayer]);

  return <div ref={mapContainerRef} style={{ height: '400px', width: '100%' }} />;
};

export default MapComponent;