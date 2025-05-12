import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const Navbar = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);

  useEffect(() => {
    checkUserAndSession();
  }, []);

  const checkUserAndSession = async () => {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const currentSession = await authAPI.getSession();
    
    setUser(storedUser);
    setSession(currentSession);
  };

  const handleLogout = async () => {
    try {
      // Déconnexion Supabase
      await authAPI.logout();
      
      // Nettoyer le localStorage
      localStorage.removeItem('user');
      
      // Mettre à jour l'état local
      setUser(null);
      setSession(null);
      
      navigate('/login');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      // Même en cas d'erreur, on redirige vers login
      localStorage.removeItem('user');
      setUser(null);
      setSession(null);
      navigate('/login');
    }
  };

  // Ne pas afficher la navbar si pas d'utilisateur ou pas de session
  if (!user?.email || !session) return null;

  return (
    <nav className="navbar">
      <div className="nav-content">
        <h2>Invitation System</h2>
        <div className="nav-links">
          <Link to="/dashboard">Dashboard</Link>
          {(user.role === 'Admin' || user.role === 'Superadmin') && (
            <>
              <Link to="/invitations">Invitations</Link>
              <Link to="/create-invitation">Créer Invitation</Link>
            </>
          )}
          <span>Bonjour, {user.first_name}</span>
          <button onClick={handleLogout}>Déconnexion</button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;