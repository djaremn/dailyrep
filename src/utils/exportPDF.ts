import jsPDF from 'jspdf';
import L from 'leaflet';
import { db, type RegistroDiario } from '../db/database';

// ── Constantes ────────────────────────────────────────────────────────────────
const MAP_W = 800;   // píxeles del canvas de exportación
const MAP_H = 500;
const PAD   = 0.15;  // 15% padding alrededor de los polígonos

const ESRI_EXPORT =
  'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export';

// ── Helpers de dibujo Canvas 2D ───────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawRing(
  ctx: CanvasRenderingContext2D,
  ring: number[][],
  lx: (n: number) => number,
  ly: (n: number) => number
): void {
  if (!ring.length) return;
  ctx.moveTo(lx(ring[0][0]), ly(ring[0][1]));
  for (let i = 1; i < ring.length; i++) ctx.lineTo(lx(ring[i][0]), ly(ring[i][1]));
  ctx.closePath();
}

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  coords: number[][][],
  style: L.PathOptions,
  lx: (n: number) => number,
  ly: (n: number) => number
): void {
  ctx.beginPath();
  for (const ring of coords) drawRing(ctx, ring, lx, ly);

  const fill = style.fillColor ?? style.color ?? '#3388ff';
  ctx.fillStyle = hexToRgba(fill, style.fillOpacity ?? 0.2);
  ctx.fill('evenodd');

  if (style.color) {
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.weight ?? 2;
    ctx.globalAlpha = style.opacity ?? 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawGeoJSON(
  ctx: CanvasRenderingContext2D,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geojson: any,
  style: L.PathOptions,
  lx: (n: number) => number,
  ly: (n: number) => number
): void {
  const features =
    geojson?.type === 'FeatureCollection'
      ? geojson.features
      : geojson?.type === 'Feature'
        ? [geojson]
        : [];

  for (const f of features) {
    const g = f?.geometry;
    if (!g) continue;
    if (g.type === 'Polygon') {
      drawPolygon(ctx, g.coordinates, style, lx, ly);
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates) drawPolygon(ctx, poly, style, lx, ly);
    }
  }
}

// ── Crear canvas del mapa ─────────────────────────────────────────────────────
/**
 * Genera un canvas PNG del mapa satelital con los polígonos superpuestos.
 *
 * Estrategia:
 *  1. Calcular el bbox geográfico de todos los polígonos (con Leaflet, solo cálculo).
 *  2. Expandir el bbox con padding y ajustar al aspect ratio MAP_W/MAP_H.
 *  3. Solicitar imagen PNG a la ESRI Map Export API con ese bbox exacto.
 *     → Centrado perfecto: la API devuelve exactamente el área pedida.
 *     → Sin timing issues: es un fetch, no depende del DOM ni del GPU compositor.
 *  4. Superponer los polígonos GeoJSON con Canvas 2D (transformación lineal,
 *     válida para áreas pequeñas como un parque solar).
 */
async function crearCanvasMapa(
  geoJsonLayers: Array<{ geoJson: string; style: L.PathOptions }>
): Promise<HTMLCanvasElement> {
  // 1. Bounds con Leaflet (solo para cálculo, sin render)
  const fg = L.featureGroup();
  for (const { geoJson, style } of geoJsonLayers) {
    try {
      L.geoJSON(JSON.parse(geoJson), { style }).addTo(fg);
    } catch { /* ignorar GeoJSON inválido */ }
  }
  const bounds = fg.getBounds();

  // 2. Calcular bbox con padding y aspect ratio correcto
  let west: number, east: number, south: number, north: number;

  if (bounds.isValid()) {
    const rawS = bounds.getSouth(), rawN = bounds.getNorth();
    const rawW = bounds.getWest(), rawE = bounds.getEast();
    const dLat = rawN - rawS || 0.01; // evitar dLat=0 si es un punto
    const dLng = rawE - rawW || 0.01;

    let bLat = dLat * (1 + 2 * PAD);
    let bLng = dLng * (1 + 2 * PAD);

    // Ajustar para que el bbox tenga el mismo aspect ratio que el canvas
    const ratio = MAP_W / MAP_H;
    if (bLng / bLat < ratio) bLng = bLat * ratio;
    else bLat = bLng / ratio;

    const cLat = (rawS + rawN) / 2;
    const cLng = (rawW + rawE) / 2;
    south = cLat - bLat / 2;
    north = cLat + bLat / 2;
    west  = cLng - bLng / 2;
    east  = cLng + bLng / 2;
  } else {
    // Fallback: Chile central
    south = -36; north = -32; west = -72; east = -69;
  }

  // 3. Crear canvas @2x para calidad PDF
  const canvas = document.createElement('canvas');
  canvas.width  = MAP_W * 2;
  canvas.height = MAP_H * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);

  // 4. Obtener imagen satelital de ESRI Export API
  const url = new URL(ESRI_EXPORT);
  url.searchParams.set('bbox', `${west},${south},${east},${north}`);
  url.searchParams.set('bboxSR', '4326');
  url.searchParams.set('size', `${MAP_W},${MAP_H}`);
  url.searchParams.set('imageSR', '4326');
  url.searchParams.set('format', 'png');
  url.searchParams.set('transparent', 'false');
  url.searchParams.set('f', 'image');

  try {
    const resp = await fetch(url.toString());
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const blob = await resp.blob();
    const src = URL.createObjectURL(blob);
    await new Promise<void>((res, rej) => {
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 0, 0, MAP_W, MAP_H); URL.revokeObjectURL(src); res(); };
      img.onerror = () => { URL.revokeObjectURL(src); rej(new Error('img load')); };
      img.src = src;
    });
  } catch {
    // Fallback visual si ESRI no responde
    ctx.fillStyle = '#d0d8e4';
    ctx.fillRect(0, 0, MAP_W, MAP_H);
    ctx.fillStyle = '#445';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Imagen satelital no disponible', MAP_W / 2, MAP_H / 2 - 10);
    ctx.fillText('(requiere conexión a internet)', MAP_W / 2, MAP_H / 2 + 10);
  }

  // 5. Superponer polígonos con Canvas 2D
  // Transformación lineal lat/lng → píxel (válida a escala de parque solar)
  const lx = (lng: number) => ((lng - west) / (east - west)) * MAP_W;
  const ly = (lat: number) => ((north - lat) / (north - south)) * MAP_H;

  for (const { geoJson, style } of geoJsonLayers) {
    try {
      drawGeoJSON(ctx, JSON.parse(geoJson), style, lx, ly);
    } catch { /* ignorar */ }
  }

  return canvas;
}

// ── Exportar PDF ──────────────────────────────────────────────────────────────
export async function exportarRegistroAPDF(
  registro: RegistroDiario,
  historicalPolygons: string[]
): Promise<void> {
  const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW   = doc.internal.pageSize.getWidth();   // 210 mm
  const PH   = doc.internal.pageSize.getHeight();  // 297 mm
  const M    = 15;       // margen
  const UW   = PW - 2 * M; // ancho útil: 180 mm
  const NAVY = [28, 40, 65] as const;

  const proyecto    = await db.proyectos.get(registro.idProyecto);
  const fechaDisplay = registro.fecha.split('-').reverse().join('/'); // DD/MM/YYYY

  // Helper: separador de sección
  let y = 0;
  const seccion = (titulo: string) => {
    if (y > PH - 60) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(titulo, M, y);
    y += 2;
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.4);
    doc.line(M, y, M + UW, y);
    doc.setTextColor(0, 0, 0);
    y += 6;
  };

  // Helper: insertar canvas como imagen en el PDF
  const insertarMapa = (canvas: HTMLCanvasElement) => {
    const mapH = UW * (MAP_H / MAP_W); // mantener aspect ratio
    if (y + mapH > PH - M) { doc.addPage(); y = 20; }
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', M, y, UW, mapH);
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.2);
    doc.rect(M, y, UW, mapH, 'S');
    y += mapH + 12;
  };

  // ── Encabezado ────────────────────────────────────────────────────────────
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PW, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORME DE AVANCE DIARIO', PW / 2, 11, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Mantenimiento O&M — Parque Fotovoltaico', PW / 2, 19, { align: 'center' });

  // ── Info de proyecto ──────────────────────────────────────────────────────
  y = 36;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);

  // Fila: Proyecto | Fecha
  doc.setFont('helvetica', 'bold');
  doc.text('Proyecto:', M, y);
  doc.setFont('helvetica', 'normal');
  doc.text(proyecto?.nombre ?? 'Sin nombre', M + 24, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Fecha:', PW / 2 + 5, y);
  doc.setFont('helvetica', 'normal');
  doc.text(fechaDisplay, PW / 2 + 20, y);

  y += 6;

  // Caja de métricas
  doc.setFillColor(243, 244, 246);
  doc.rect(M, y - 2, UW, 12, 'F');

  doc.setFont('helvetica', 'bold');
  doc.text('Agua consumida:', M + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(`${registro.agua} L`, M + 40, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('Combustible:', PW / 2 + 5, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(`${registro.combustible} L`, PW / 2 + 34, y + 6);

  y += 18;

  // ── Mapas (generados en paralelo para mayor velocidad) ────────────────────
  const capasAcumuladas: Array<{ geoJson: string; style: L.PathOptions }> = [
    ...historicalPolygons.map((geoJson) => ({
      geoJson,
      style: { color: '#f97316', weight: 2, opacity: 0.9, fillOpacity: 0.15 } as L.PathOptions,
    })),
    {
      geoJson: registro.poligonosGeoJSON,
      style: { color: '#2563eb', weight: 2.5, fillOpacity: 0.25 } as L.PathOptions,
    },
  ];

  // Generar ambos mapas en paralelo
  const [canvas1, canvas2] = await Promise.all([
    crearCanvasMapa([
      { geoJson: registro.poligonosGeoJSON, style: { color: '#2563eb', weight: 2.5, fillOpacity: 0.25 } },
    ]),
    crearCanvasMapa(capasAcumuladas),
  ]);

  seccion('Avance del día');
  insertarMapa(canvas1);

  seccion('Avance acumulado hasta la fecha');
  insertarMapa(canvas2);

  // ── Fotos ─────────────────────────────────────────────────────────────────
  doc.addPage();
  y = 20;

  const PH_FOTO = 65;              // alto fijo de cada foto (mm)
  const PW_FOTO = (UW - 8) / 2;   // ancho: dos fotos por fila con 8 mm de separación

  const insertarFotos = (titulo: string, fotos: string[]) => {
    seccion(titulo);
    if (fotos.length === 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(150, 150, 150);
      doc.text('Sin fotos registradas.', M, y);
      doc.setTextColor(0, 0, 0);
      y += 12;
      return;
    }

    for (let i = 0; i < fotos.length; i += 2) {
      if (y + PH_FOTO + 4 > PH - M) { doc.addPage(); y = 20; }

      doc.addImage(fotos[i], 'JPEG', M, y, PW_FOTO, PH_FOTO);
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.2);
      doc.rect(M, y, PW_FOTO, PH_FOTO, 'S');

      if (fotos[i + 1]) {
        doc.addImage(fotos[i + 1], 'JPEG', M + PW_FOTO + 8, y, PW_FOTO, PH_FOTO);
        doc.rect(M + PW_FOTO + 8, y, PW_FOTO, PH_FOTO, 'S');
      }

      y += PH_FOTO + 5;
    }
    y += 8;
  };

  insertarFotos('Fotos Antes', registro.fotosAntes);
  insertarFotos('Fotos Después', registro.fotosDespues);

  // ── Guardar ───────────────────────────────────────────────────────────────
  const now = new Date();
  const hh  = String(now.getHours()).padStart(2, '0');
  const mm  = String(now.getMinutes()).padStart(2, '0');
  doc.save(`informe_${registro.fecha}_dwl_${hh}${mm}.pdf`);
}
