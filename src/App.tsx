import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import HistoryPage from './pages/HistoryPage';

function App() {
  return (
    <Router basename="/dailyrep">
      <nav style={{ padding: '1rem', borderBottom: '1px solid #ccc' }}>
        <Link to="/" style={{ marginRight: '1rem' }}>📅 Registro Diario</Link>
        <Link to="/historial">📊 Histórico</Link>
      </nav>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/historial" element={<HistoryPage />} />
      </Routes>
    </Router>
  );
}

export default App;
