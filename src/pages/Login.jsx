import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI, supabase } from '../services/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [loginMode, setLoginMode] = useState('standard'); // 'standard' ou 'sso'
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Vérifier s'il y a une erreur dans l'URL
    const errorFromUrl = searchParams.get('error');
    if (errorFromUrl) {
      setError(decodeURIComponent(errorFromUrl));
      // Nettoyer l'URL sans recharger la page
      window.history.replaceState({}, '', '/login');
    }
  }, [searchParams]);

  const handleStandardSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.signIn(email, password);
      
      if (response.success) {
        // Stocker les informations utilisateur
        localStorage.setItem('user', JSON.stringify({
          ...response.user,
          firstConnection: response.firstConnection
        }));
        
        navigate(response.firstConnection ? '/change-password' : '/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleSSOLogin = async (provider) => {
    setSsoLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        setError('Erreur lors de l\'initiation SSO');
        setSsoLoading(false);
      }
      // L'utilisateur est redirigé, pas besoin de gérer la réponse
    } catch (err) {
      setError('Erreur lors de l\'initiation SSO');
      setSsoLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-tabs">
        <button 
          className={`tab ${loginMode === 'standard' ? 'active' : ''}`}
          onClick={() => setLoginMode('standard')}
        >
          Connexion classique
        </button>
        <button 
          className={`tab ${loginMode === 'sso' ? 'active' : ''}`}
          onClick={() => setLoginMode('sso')}
        >
          Connexion SSO
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {loginMode === 'standard' ? (
        <form onSubmit={handleStandardSubmit} className="login-form">
          <h2>Connexion classique</h2>
          
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          
          <button type="submit" disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      ) : (
        <div className="login-form sso-form">
          <h2>Connexion SSO</h2>
          <p className="sso-description">
            Votre invitation sera vérifiée automatiquement après connexion.
          </p>
          
          <div className="sso-buttons">
            <button 
              type="button"
              onClick={() => handleSSOLogin('google')}
              disabled={ssoLoading}
              className="btn-sso btn-google"
            >
              {ssoLoading ? 'Connexion...' : (
                <>
                  <span>🔍</span>
                  Se connecter avec Google
                </>
              )}
            </button>

            <button 
              type="button"
              onClick={() => handleSSOLogin('azure')}
              disabled={ssoLoading}
              className="btn-sso btn-azure"
            >
              {ssoLoading ? 'Connexion...' : (
                <>
                  <span>🔷</span>
                  Se connecter avec Microsoft
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;