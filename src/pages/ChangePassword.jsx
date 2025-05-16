import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

const ChangePassword = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSSO, setIsSSO] = useState(false);
  const navigate = useNavigate();
  
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    // Vérifier si l'utilisateur est connecté via SSO (pas de mot de passe)
    checkIfSSO();
  }, []);

  const checkIfSSO = async () => {
    // Si l'utilisateur a un provider dans ses métadonnées, c'est du SSO
    const session = await authAPI.getSession();
    if (session?.user?.app_metadata?.provider) {
      setIsSSO(true);
    }
  };

  const handleSSOFirstConnection = async () => {
    setLoading(true);
    try {
      // Pour SSO, on marque juste first_connection à false
      const response = await authAPI.changePassword(
        user.email,
        null, // Pas de mot de passe actuel pour SSO
        null, // Pas de nouveau mot de passe pour SSO
        true  // C'est la première connexion
      );
      
      if (response.success) {
        // Mettre à jour l'utilisateur en local
        const updatedUser = { ...user, firstConnection: false };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        navigate('/dashboard');
      }
    } catch (err) {
      setError('Erreur lors de la finalisation de votre première connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleStandardSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      setLoading(false);
      return;
    }

    try {
      const response = await authAPI.changePassword(
        user.email,
        currentPassword,
        newPassword,
        user.firstConnection
      );
      
      if (response.success) {
        // Mettre à jour l'utilisateur en local
        const updatedUser = { ...user, firstConnection: false };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors du changement de mot de passe');
    } finally {
      setLoading(false);
    }
  };

  // Interface pour utilisateurs SSO
  if (isSSO) {
    return (
      <div className="change-password-container">
        <div className="sso-first-connection">
          <h2>Bienvenue !</h2>
          <p>Vous êtes connecté via Google/Microsoft.</p>
          <p>Cliquez sur "Continuer" pour accéder à votre tableau de bord.</p>
          
          {error && <div className="error">{error}</div>}
          
          <button 
            onClick={handleSSOFirstConnection}
            disabled={loading}
            style={{
              padding: '12px 24px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            {loading ? 'Finalisation...' : 'Continuer'}
          </button>
        </div>
      </div>
    );
  }

  // Interface pour utilisateurs avec mot de passe
  return (
    <div className="change-password-container">
      <form onSubmit={handleStandardSubmit} className="change-password-form">
        <h2>Changement de mot de passe</h2>
        {user.firstConnection && (
          <p className="info">Pour votre première connexion, vous devez changer votre mot de passe</p>
        )}
        
        {error && <div className="error">{error}</div>}
        
        <div className="form-group">
          <label>Mot de passe actuel</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        
        <div className="form-group">
          <label>Nouveau mot de passe</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            disabled={loading}
            minLength={6}
          />
        </div>
        
        <div className="form-group">
          <label>Confirmer le nouveau mot de passe</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={loading}
            minLength={6}
          />
        </div>
        
        <button type="submit" disabled={loading}>
          {loading ? 'Changement en cours...' : 'Changer le mot de passe'}
        </button>
      </form>
    </div>
  );
};

export default ChangePassword;