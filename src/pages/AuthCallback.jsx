// src/pages/AuthCallback.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/api';
import api from '../services/api';

const AuthCallback = () => {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    handleAuthCallback();
  }, []);

  const handleAuthCallback = async () => {
    try {
      // Récupérer la session après le callback OAuth de Supabase
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Erreur session:', error);
        window.location.href = `/login?error=${encodeURIComponent('Erreur lors de la récupération de la session')}`;
        return;
      }

      if (session && session.user) {
        // Appeler notre fonction SSO pour vérifier l'invitation
        try {
          const response = await api.post('/sso-sign-in', {}, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          });

          if (response.data.success) {
            // Stocker l'utilisateur
            localStorage.setItem('user', JSON.stringify({
              ...response.data.user,
              firstConnection: response.data.firstConnection
            }));

            // Pour SSO, marquer automatiquement first_connection à false si nécessaire
            if (response.data.provider && response.data.firstConnection) {
              // Appeler change-password pour marquer la première connexion comme terminée
              try {
                await api.post('/change-password', {
                  email: response.data.user.email,
                  currentPassword: null,
                  newPassword: null,
                  isFirstConnection: true
                });
                
                // Mettre à jour localement
                const updatedUser = { ...response.data.user, firstConnection: false };
                localStorage.setItem('user', JSON.stringify(updatedUser));
                navigate('/dashboard');
              } catch (err) {
                // Si erreur, aller quand même vers change-password
                navigate('/change-password');
              }
            } else {
              // Rediriger selon la première connexion
              navigate(response.data.firstConnection ? '/change-password' : '/dashboard');
            }
          } else {
            // Rediriger vers login avec l'erreur
            window.location.href = `/login?error=${encodeURIComponent(response.data.error)}`;
          }
        } catch (apiError) {
          console.error('Erreur API SSO:', apiError);
          const errorMessage = apiError.response?.data?.error || 'Erreur lors du traitement SSO';
          
          // Rediriger immédiatement vers login avec l'erreur
          window.location.href = `/login?error=${encodeURIComponent(errorMessage)}`;
        }
      } else {
        window.location.href = `/login?error=${encodeURIComponent('Aucune session trouvée')}`;
      }
    } catch (err) {
      console.error('Erreur callback:', err);
      window.location.href = `/login?error=${encodeURIComponent('Erreur lors du traitement de l\'authentification')}`;
    } finally {
      setLoading(false);
    }
  };

  // Interface pendant le chargement
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      textAlign: 'center'
    }}>
      <div style={{
        border: '4px solid #f3f3f3',
        borderTop: '4px solid #3498db',
        borderRadius: '50%',
        width: '50px',
        height: '50px',
        animation: 'spin 1s linear infinite',
        marginBottom: '20px'
      }}></div>
      <h2>Vérification de votre invitation...</h2>
      <p>Veuillez patienter, nous vérifons votre accès.</p>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default AuthCallback;