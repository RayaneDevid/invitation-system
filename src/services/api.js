import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Créer le client Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const api = axios.create({
  baseURL: `${SUPABASE_URL}/functions/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token de session Supabase si disponible
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session?.access_token) {
    config.headers['Authorization'] = `Bearer ${session.access_token}`;
  } else {
    // Fallback sur SUPABASE_ANON_KEY si pas de session
    config.headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
  }
  
  return config;
});

export const authAPI = {
  signIn: async (email, password) => {
    const response = await api.post('/sign-in', { email, password });
    
    // Si la connexion réussit et qu'on a une session, la stocker
    if (response.data.success && response.data.session) {
      await supabase.auth.setSession(response.data.session);
    }
    
    return response.data;
  },

  changePassword: async (email, currentPassword, newPassword, isFirstConnection) => {
    const response = await api.post('/change-password', {
      email,
      currentPassword,
      newPassword,
      isFirstConnection,
    });
    return response.data;
  },

  checkInvitation: async (email) => {
    const response = await api.post('/check-invitation', { email });
    return response.data;
  },

  logout: async () => {
    await supabase.auth.signOut();
  },

  getSession: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },
};

export const ssoAPI = {
  initiate: async (provider, email) => {
    const response = await api.post('/sso-sign-in', {
      provider,
      email
    });
    return response.data;
  },
};

export const invitationAPI = {
  create: async (data) => {
    const response = await api.post('/create-invitation', data);
    return response.data;
  },

  list: async (adminId, companyId) => {
    const response = await api.post('/list-invitations', { adminId, companyId });
    return response.data;
  },
};

export default api;