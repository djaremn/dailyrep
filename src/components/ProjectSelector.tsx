import { useState, useEffect } from 'react';
import { db, type Proyecto } from '../db/database';

interface ProjectSelectorProps {
  onSelect: (proyectoId: number) => void;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({ onSelect }) => {
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [nuevoNombre, setNuevoNombre] = useState('');

  // 1. Declarar la función ANTES de usarla en useEffect
  const cargarProyectos = async () => {
    const all = await db.proyectos.toArray();
    setProyectos(all);
  };

  useEffect(() => {
    cargarProyectos();
  }, []);

  const crearProyecto = async () => {
    if (!nuevoNombre.trim()) return;
    const id = await db.proyectos.add({
      nombre: nuevoNombre,
      fechaCreacion: new Date()
    });
    setNuevoNombre('');
    await cargarProyectos();
    onSelect(id as number);
  };

  return (
    <div style={{ marginBottom: '1rem' }}>
      <h3>Seleccionar Proyecto</h3>
      <select onChange={(e) => onSelect(Number(e.target.value))} defaultValue="">
        <option value="" disabled>Seleccione un proyecto</option>
        {proyectos.map(p => (
          <option key={p.id} value={p.id}>{p.nombre}</option>
        ))}
      </select>
      <div style={{ marginTop: '0.5rem' }}>
        <input
          type="text"
          placeholder="Nuevo proyecto"
          value={nuevoNombre}
          onChange={(e) => setNuevoNombre(e.target.value)}
        />
        <button onClick={crearProyecto}>Crear</button>
      </div>
    </div>
  );
};

export default ProjectSelector;