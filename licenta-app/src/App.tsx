// Router logic in App.tsx
import { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Settings from './pages/Settings';
import Library from './pages/Library';
import History from './pages/History';
import Users from './pages/Users';

const AppLayout = () => {
  // Bugfix: Electron/Chromium pierde complet focusul tastaturii după interacțiunea cu un iframe (ex. YouTube).
  // Prin forțarea window.focus() când dăm click pe orice căsuță de text (input/textarea), 
  // forțăm sistemul de operare să predea controlul la loc aplicației React.
  useEffect(() => {
    const handleFocusFix = (e: MouseEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        window.focus();
      }
    };
    document.addEventListener('mousedown', handleFocusFix);
    return () => document.removeEventListener('mousedown', handleFocusFix);
  }, []);

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />

        {/* Protected/Main Layout Routes */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/library" element={<Library />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/history" element={<History />} />
          <Route path="/users" element={<Users />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
