import { Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const PrivateRoute = ({ children }) => {
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

  // Afficher un loader pendant la vérification de la session
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

  // Si pas de session, rediriger vers login
  if (!session) {
    return <Navigate to="/login" />;
  }

  // Si première connexion, rediriger vers changement de mot de passe
  if (user.firstConnection) {
    return <Navigate to="/change-password" />;
  }

  return children;
};

export default PrivateRoute;