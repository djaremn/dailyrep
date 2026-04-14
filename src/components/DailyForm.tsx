import { useState, useRef, useEffect } from 'react';
import MapComponent from './MapComponent';
import { db, type RegistroDiario } from '../db/database';
import CameraModal from './CameraModal';
import { exportarRegistroAPDF } from '../utils/exportPDF';

interface DailyFormProps {
  proyectoId: number;
  fecha: string;
  onSaved?: () => void;
}

const DailyForm: React.FC<DailyFormProps> = ({ proyectoId, fecha, onSaved }) => {
  const [fotosAntes, setFotosAntes] = useState<string[]>([]);
  const [fotosDespues, setFotosDespues] = useState<string[]>([]);
  const [agua, setAgua] = useState<number>(0);
  const [combustible, setCombustible] = useState<number>(0);
  const [polygonGeoJSON, setPolygonGeoJSON] = useState<string>('');
  const [registroExistente, setRegistroExistente] = useState<RegistroDiario | null>(null);
  const [historicalPolygons, setHistoricalPolygons] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tipoFoto, setTipoFoto] = useState<'antes' | 'despues'>('antes');
  const [showCamera, setShowCamera] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState<'antes' | 'despues' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Cargar registro existente y polígonos históricos
  useEffect(() => {
    const cargarDatos = async () => {
      const existente = await db.registrosDiarios
        .where({ idProyecto: proyectoId, fecha })
        .first();
      if (existente) {
        setRegistroExistente(existente);
        setFotosAntes(existente.fotosAntes);
        setFotosDespues(existente.fotosDespues);
        setAgua(existente.agua);
        setCombustible(existente.combustible);
        setPolygonGeoJSON(existente.poligonosGeoJSON);
      }

      const anteriores = await db.registrosDiarios
        .where('idProyecto')
        .equals(proyectoId)
        .filter(r => r.fecha < fecha)
        .toArray();
      setHistoricalPolygons(anteriores.map(r => r.poligonosGeoJSON).filter(Boolean));
    };
    cargarDatos();
  }, [proyectoId, fecha]);

  const handleCapture = (tipo: 'antes' | 'despues') => {
    setTipoFoto(tipo);
    setMenuAbierto(tipo);
  };

  const abrirCamara = () => {
    setShowCamera(true);
    setMenuAbierto(null);
  };

  const abrirGaleria = () => {
    fileInputRef.current?.click();
    setMenuAbierto(null);
  };

  const handlePhotoCaptured = (base64: string) => {
    if (tipoFoto === 'antes') {
      setFotosAntes(prev => [...prev, base64]);
    } else {
      setFotosDespues(prev => [...prev, base64]);
    }
    setShowCamera(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        if (tipoFoto === 'antes') {
          setFotosAntes(prev => [...prev, base64]);
        } else {
          setFotosDespues(prev => [...prev, base64]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleGuardar = async () => {
    if (!polygonGeoJSON) {
      alert('Debe dibujar al menos un polígono de avance');
      return;
    }
    if (agua < 0 || combustible < 0) {
      alert('Los valores de agua y combustible no pueden ser negativos');
      return;
    }

    const registro = {
      idProyecto: proyectoId,
      fecha,
      fotosAntes,
      fotosDespues,
      agua,
      combustible,
      poligonosGeoJSON: polygonGeoJSON,
    };

    setIsSaving(true);
    try {
      if (registroExistente?.id) {
        if (!confirm('Ya existe un registro para este día. ¿Desea sobrescribirlo?')) return;
        await db.registrosDiarios.update(registroExistente.id, registro);
        setRegistroExistente({ ...registro, id: registroExistente.id });
        alert('Registro actualizado correctamente');
      } else {
        const id = await db.registrosDiarios.add(registro);
        setRegistroExistente({ ...registro, id: id as number });
        alert('Registro guardado correctamente');
      }
      onSaved?.();
    } catch (err) {
      console.error('Error guardando registro:', err);
      alert('Error al guardar el registro. Intente nuevamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const eliminarFoto = (tipo: 'antes' | 'despues', index: number) => {
    if (tipo === 'antes') {
      setFotosAntes(prev => prev.filter((_, i) => i !== index));
    } else {
      setFotosDespues(prev => prev.filter((_, i) => i !== index));
    }
  };

  // ========== FUNCIÓN DE EXPORTACIÓN A PDF ==========
  const exportarPDF = async () => {
    if (!registroExistente) {
      alert('No hay datos guardados para este día. Guarde primero el registro.');
      return;
    }
    setIsExporting(true);
    try {
      await exportarRegistroAPDF(registroExistente, historicalPolygons);
    } catch (err) {
      console.error('Error exportando PDF:', err);
      alert('Error al generar el PDF. Intente nuevamente.');
    } finally {
      setIsExporting(false);
    }
  };

  // ========== RENDER ==========
  return (
    <div style={{ padding: '1rem', border: '1px solid #ccc', marginTop: '1rem' }}>
      <h2>Registro del {fecha}</h2>

      {/* Botones de fotos con menú desplegable */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
        <div style={{ position: 'relative' }}>
          <button onClick={() => handleCapture('antes')}>📸 Fotos ANTES</button>
          {menuAbierto === 'antes' && (
            <div style={{ position: 'absolute', top: '100%', left: 0, background: 'white', border: '1px solid #ccc', zIndex: 10 }}>
              <button onClick={abrirCamara} style={{ display: 'block', width: '100%' }}>📷 Cámara</button>
              <button onClick={abrirGaleria} style={{ display: 'block', width: '100%' }}>🖼️ Galería</button>
            </div>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => handleCapture('despues')}>📸 Fotos DESPUÉS</button>
          {menuAbierto === 'despues' && (
            <div style={{ position: 'absolute', top: '100%', left: 0, background: 'white', border: '1px solid #ccc', zIndex: 10 }}>
              <button onClick={abrirCamara} style={{ display: 'block', width: '100%' }}>📷 Cámara</button>
              <button onClick={abrirGaleria} style={{ display: 'block', width: '100%' }}>🖼️ Galería</button>
            </div>
          )}
        </div>
        <input
          type="file"
          accept="image/*"
          multiple
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {/* Galería de fotos con botón eliminar */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
        <div>
          <strong>Antes ({fotosAntes.length})</strong>
          <button onClick={() => setFotosAntes([])} style={{ marginLeft: '0.5rem' }}>
            🗑️ Borrar todas
          </button>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {fotosAntes.map((f, i) => (
              <div key={i} style={{ position: 'relative', margin: '2px' }}>
                <img src={f} style={{ width: '80px', height: '80px', objectFit: 'cover' }} />
                <button
                  onClick={() => eliminarFoto('antes', i)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    background: 'red',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
        <div>
          <strong>Después ({fotosDespues.length})</strong>
          <button onClick={() => setFotosDespues([])} style={{ marginLeft: '0.5rem' }}>
            🗑️ Borrar todas
          </button>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {fotosDespues.map((f, i) => (
              <div key={i} style={{ position: 'relative', margin: '2px' }}>
                <img src={f} style={{ width: '80px', height: '80px', objectFit: 'cover' }} />
                <button
                  onClick={() => eliminarFoto('despues', i)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    background: 'red',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <label>
          Agua (litros):{' '}
          <input type="number" min="0" step="0.1" value={agua} onChange={e => setAgua(Math.max(0, Number(e.target.value)))} />
        </label>
        <label style={{ marginLeft: '1rem' }}>
          Combustible (litros):{' '}
          <input type="number" min="0" step="0.1" value={combustible} onChange={e => setCombustible(Math.max(0, Number(e.target.value)))} />
        </label>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <h4>Polígono de avance del día (naranja = días anteriores)</h4>
        <MapComponent
          onPolygonDrawn={setPolygonGeoJSON}
          initialPolygons={polygonGeoJSON || null}
          historicalPolygons={historicalPolygons}
        />
      </div>

      <div style={{ marginTop: '1rem' }}>
        <button onClick={handleGuardar} disabled={isSaving} style={{ padding: '0.5rem 1rem' }}>
          {isSaving ? 'Guardando...' : '💾 Guardar registro del día'}
        </button>
        <button
          onClick={exportarPDF}
          disabled={isExporting}
          style={{
            marginLeft: '1rem',
            padding: '0.5rem 1rem',
            background: isExporting ? '#9E9E9E' : '#4CAF50',
            color: 'white',
            border: 'none',
            cursor: isExporting ? 'not-allowed' : 'pointer',
          }}
        >
          {isExporting ? 'Generando PDF...' : '📄 Exportar PDF'}
        </button>
      </div>

      {/* Modal de cámara */}
      {showCamera && (
        <CameraModal
          onCapture={handlePhotoCaptured}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
};

export default DailyForm;