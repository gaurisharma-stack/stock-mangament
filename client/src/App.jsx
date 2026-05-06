import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { auth } from './api';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Transactions from './pages/Transactions';
import Purchase from './pages/Purchase';
import Sales from './pages/Sales';
import Production from './pages/Production';

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = auth.getToken();
    if (!token) {
      setChecking(false);
      return;
    }

    auth.getMe()
      .then(userData => {
        setUser(userData);
        setChecking(false);
      })
      .catch(() => {
        auth.logout();
        setChecking(false);
      });
  }, []);

  if (checking) {
    return (
      <div className="loading-spinner" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar user={user} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/purchase" element={<Purchase />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/production" element={<Production />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
