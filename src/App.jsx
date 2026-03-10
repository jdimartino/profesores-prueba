import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Inicio from './pages/Inicio';
import Alumnos from './pages/Alumnos';
import Horario from './pages/Horario';
import Cobros from './pages/Cobros';
import Perfil from './pages/Perfil';
import BottomNav from './components/BottomNav';

function AppInner() {
  const { user } = useAuth();
  const [activePage, setActivePage] = useState('inicio');

  // Loading state
  if (user === undefined) {
    return <div className="loader">🎾</div>;
  }

  // Not logged in → show login
  if (!user) {
    return <Login />;
  }

  const pages = {
    inicio: <Inicio />,
    alumnos: <Alumnos />,
    horario: <Horario />,
    cobros: <Cobros />,
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
