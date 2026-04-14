import { useState, useEffect } from 'react';
import { db, type Proyecto, type RegistroDiario } from '../db/database';
import { exportarRegistroAPDF } from '../utils/exportPDF';

const HistoricalView: React.FC = () => {
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [selectedProyecto, setSelectedProyecto] = useState<number | null>(null);
  const [registros, setRegistros] = useState<RegistroDiario[]>([]);
  const [exportingId, setExportingId] = useState<number | null>(null);

  useEffect(() => {
    db.proyectos.toArray().then(setProyectos);
  }, []);

  useEffect(() => {
    let ignore = false;
    if (selectedProyecto) {
      db.registrosDiarios
        .where('idProyecto')
        .equals(selectedProyecto)
        .toArray()
        .then(data => {
          if (!ignore) setRegistros(data);
        });
    } else {
      // Limpiar registros sin warning: lo hacemos dentro de un setTimeout o Promise.resolve
      Promise.resolve().then(() => {
        if (!ignore) setRegistros([]);
      });
    }
    return () => {
      ignore = true;
    };
  }, [selectedProyecto]);

  const handleExportPDF = async (registro: RegistroDiario) => {
    if (!registro.id) return;
    setExportingId(registro.id);
    try {
      const anteriores = await db.registrosDiarios
        .where('idProyecto')
        .equals(registro.idProyecto)
        .filter(r => r.fecha < registro.fecha)
        .toArray();
      const historicalPolygons = anteriores.map(r => r.poligonosGeoJSON).filter(Boolean);
      await exportarRegistroAPDF(registro, historicalPolygons);
    } catch (err) {
      console.error('Error exportando PDF:', err);
      alert('Error al generar el PDF. Intente nuevamente.');
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h2>Histórico de Consumos</h2>
      <select onChange={e => setSelectedProyecto(Number(e.target.value))} defaultValue="">
        <option value="" disabled>
          Seleccione un proyecto
        </option>
        {proyectos.map(p => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
      </select>

      {selectedProyecto && (
        <table style={{ marginTop: '1rem', width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Agua (L)</th>
              <th>Combustible (L)</th>
              <th>Fotos Antes</th>
              <th>Fotos Después</th>
              <th>Polígono</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {registros.map(r => (
              <tr key={r.id}>
                <td>{r.fecha}</td>
                <td>{r.agua}</td>
                <td>{r.combustible}</td>
                <td>{r.fotosAntes.length}</td>
                <td>{r.fotosDespues.length}</td>
                <td>{r.poligonosGeoJSON ? '✅' : '❌'}</td>
                <td>
                  <button
                    onClick={() => handleExportPDF(r)}
                    disabled={exportingId === r.id}
                  >
                    {exportingId === r.id ? 'Generando...' : '📄 PDF'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default HistoricalView;