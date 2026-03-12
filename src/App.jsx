import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Inicio from './pages/Inicio';
import Alumnos from './pages/Alumnos';
import Horario from './pages/Horario';
import Cobros from './pages/Cobros';
import Ingresos from './pages/Ingresos';
import Perfil from './pages/Perfil';
import BottomNav from './components/BottomNav';

function AppInner() {
  const { user } = useAuth();
  const [activePage, setActivePage] = useState('inicio');
  const [horarioView, setHorarioView] = useState('diaria');

  const handlePageChange = (page, params = {}) => {
    if (page === 'horario' && params.view) {
      setHorarioView(params.view);
    }
    setActivePage(page);
  };

  // Loading state
  if (user === undefined) {
    return <div className="loader">🎾</div>;
  }

  // Not logged in → show login
  if (!user) {
    return <Login />;
  }

  const pages = {
    inicio: <Inicio setPage={handlePageChange} />,
    alumnos: <Alumnos />,
    horario: <Horario initialView={horarioView} setView={setHorarioView} />,
    cobros: <Cobros />,
    ingresos: <Ingresos setPage={handlePageChange} />,
    perfil: <Perfil />,
  };

  return (
    <div className="app-layout">
      <div className="page-content">
        {pages[activePage]}
      </div>
      <BottomNav active={activePage} onChange={setActivePage} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
