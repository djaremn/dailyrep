# PLAN DE CONTINUACIÓN — Avance Diario PWA

> Actualizado al cierre de sesión 2026-04-11.
> Para continuar: abre este archivo y di "Claude, continua con PLAN.md".

---

## Contexto del proyecto

PWA offline-first para registrar avance diario de O&M en **parques fotovoltaicos** (Chile, zonas rurales).
El trabajo consiste en limpieza de paneles (consume agua) y deslezado/control de vegetación (consume combustible).
El trabajador marca con polígonos el área trabajada cada día sobre imagen satelital.

**Stack:** React 19 + TypeScript + Vite 8 + Dexie (IndexedDB) + Leaflet + leaflet-draw + jsPDF + ESRI tiles/Export API.
**Sin backend** — todo en el dispositivo. Sin html2canvas (eliminado).

---

## Lo que se hizo en sesión 2026-04-10

| Archivo | Cambio |
|---|---|
| `CameraModal.tsx` | Bug: stream de cámara nunca se cerraba (stale closure). Fix: `useRef` para el stream. |
| `CameraModal.tsx` | Android/HTTP: `navigator.mediaDevices` undefined en HTTP. Fix: mensaje explicativo. |
| `DailyForm.tsx` | Eliminados ~120 líneas de lógica PDF duplicada. Delega a `exportarRegistroAPDF`. |
| `DailyForm.tsx` | Loading states: botones "Guardar" y "Exportar PDF" se deshabilitan durante operación. |
| `DailyForm.tsx` | Validación inputs: `min="0"`, `step="0.1"`, `Math.max(0, ...)` para agua y combustible. |
| `DailyForm.tsx` | Try/catch en operaciones de DB. |
| `HistoricalView.tsx` | Loading state por fila + try/catch en exportación. |
| `MapComponent.tsx` | OpenStreetMap → ESRI World Imagery (satelital). |
| `package.json` | Eliminada dependencia `localforage` (no se usaba). |

---

## Lo que se hizo en sesión 2026-04-11

### Fix de mapas en PDF (problema central)

html2canvas + Leaflet oculto fue probado con **5 estrategias distintas** — todas fallaron:

| Intento | Problema |
|---|---|
| `top:-600px` | Compositor GPU descarta tiles off-screen → imagen gris |
| `opacity:0` | html2canvas respeta CSS opacity → canvas transparente |
| `visibility:hidden` | Mismo efecto que opacity |
| Wrapper `overflow:hidden 0×0` | Comportamiento errático de html2canvas |
| Container visible + `fitBounds` pre-tileLayer | Polígonos se mueven pero no centran bien |

**Causa raíz del no-centrado:** Si los tiles de Santiago están en caché del browser, `tileLayer.once('load')` se disparaba inmediatamente al registrar el listener, antes de que `fitBounds` cambiara el viewport.

**Solución definitiva adoptada:** ESRI Map Export API + Canvas 2D nativo. Sin html2canvas, sin DOM, sin timing.

```
URL: https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export
Params: bbox={w},{s},{e},{n}&bboxSR=4326&size={W},{H}&imageSR=4326&format=png&f=image
```

- La API devuelve exactamente el PNG del área pedida → centrado garantizado
- Los polígonos se dibujan encima con Canvas 2D (transformación lineal lat/lng→px)
- Ambos mapas se generan en paralelo con `Promise.all`
- Si ESRI no responde (offline), el PDF muestra un placeholder y continúa sin crashear

### Rediseño del PDF

Layout anterior: texto plano, fotos pequeñas, mapas grises y mal ubicados.

Layout nuevo:
- Encabezado navy con título "INFORME DE AVANCE DIARIO" + subtítulo O&M
- Fila: Proyecto + Fecha
- Caja gris: métricas (agua/combustible) en una línea
- Mapa del día (ancho completo, con borde sutil)
- Mapa acumulado (siguiente sección)
- Fotos Antes y Después: 2 por fila, con borde y sección titulada
- Nombre del archivo con timestamp: `informe_YYYY-MM-DD_dwl_HHMM.pdf`

---

## Lo que sigue (por prioridad)

### 1. Estilo visual de la app
La app funciona correctamente pero usa estilos inline en todos los componentes.
Opciones a decidir con el usuario:
- **Tailwind CSS** — recomendado para PWA, sin build overhead extra
- CSS modules — alternativa más simple
- Styled-components — más verbose, menos recomendado para mobile

### 2. Filtro por proyecto en HistoricalView
El historial muestra todos los registros de todos los proyectos mezclados.
Cuando haya varios proyectos, será confuso. Agregar selector de proyecto encima de la tabla.

### 3. Mejoras UX menores
- Paginación en `HistoricalView` (actualmente carga todo de IndexedDB de golpe)
- Error boundaries (si un componente crashea, cae toda la app)
- Loading skeleton al cargar datos desde IndexedDB

### 4. HTTPS para cámara en Android
La cámara no funciona desde red local (HTTP). `navigator.mediaDevices` es `undefined`.
Opciones:
- `vite-plugin-mkcert` — certificado local de confianza, más limpio
- Ngrok — tunnel HTTPS rápido para pruebas
- `vite --https` — self-signed, puede generar warnings en el browser

---

## Estado de archivos clave

```
src/
├── components/
│   ├── CameraModal.tsx       ✅ stream fix + mensaje Android HTTP
│   ├── DailyForm.tsx         ✅ PDF deduplicado, loading, validación
│   ├── HistoricalView.tsx    ✅ loading por fila, try/catch
│   ├── MapComponent.tsx      ✅ ESRI satelital
│   └── ProjectSelector.tsx   — sin cambios
├── pages/
│   ├── HomePage.tsx          — sin cambios
│   └── HistoryPage.tsx       — sin cambios
├── db/database.ts            — sin cambios
└── utils/
    ├── exportPDF.ts          ✅ ESRI Export API + Canvas 2D (sin html2canvas)
    └── mapHelpers.ts         — sin cambios
```

---

## Notas técnicas

- **ESRI tile URL**: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` — orden `{z}/{y}/{x}`, diferente a OSM.
- **ESRI Export API**: requiere internet. Si offline, el PDF genera un placeholder en lugar del mapa.
- **npm install**: usar siempre `--legacy-peer-deps` (conflicto `vite-plugin-pwa@1.2.0` con Vite 8).
- **Cámara Android**: solo funciona en HTTPS o localhost. El modal ya muestra mensaje explicativo.
- **IndexedDB**: Dexie v4. Base: `AvanceDiarioDB`. Tablas: `proyectos`, `registrosDiarios`.
- **Polígonos en mapa activo**: los del día anterior SÍ se muestran mientras el usuario dibuja el nuevo. Comportamiento correcto, no modificar.
