import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ChangePassword from './pages/ChangePassword';
import CreateInvitation from './pages/CreateInvitation';
import AdminInvitations from './pages/AdminInvitations';
import AuthCallback from './pages/AuthCallback';
import { authAPI } from './services/api';
import './App.css';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const currentSession = await authAPI.getSession();
      setSession(currentSession);
    } catch (error) {
      console.error('Erreur lors de la vérification de la session:', error);
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div>Chargement...</div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route 
              path="/login" 
              element={session && !user.firstConnection ? <Navigate to="/dashboard" /> : <Login />} 
            />
            <Route 
              path="/change-password" 
              element={<ChangePassword />} 
            />
            <Route 
              path="/dashboard" 
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/create-invitation" 
              element={
                <PrivateRoute>
                  <CreateInvitation />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/invitations" 
              element={
                <PrivateRoute>
                  <AdminInvitations />
                </PrivateRoute>
              } 
            />
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;