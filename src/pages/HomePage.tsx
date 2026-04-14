import React, { useState } from 'react';
import ProjectSelector from '../components/ProjectSelector';
import DailyForm from '../components/DailyForm';

const HomePage: React.FC = () => {
  const [selectedProyecto, setSelectedProyecto] = useState<number | null>(null);
  const today = new Date().toISOString().split('T')[0];

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
      <h1>📋 Registro de Avance Diario</h1>
      <ProjectSelector onSelect={setSelectedProyecto} />
      {selectedProyecto && (
        <DailyForm proyectoId={selectedProyecto} fecha={today} />
      )}
    </div>
  );
};

export default HomePage;