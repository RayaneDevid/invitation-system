// supabase/functions/sign-in/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface SignInRequest {
  email: string
  password: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
  // Gérer les requêtes preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200, 
      headers: corsHeaders 
    })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Méthode non autorisée' }),
        { 
          status: 405, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )
    }

    const requestData: SignInRequest = await req.json()
    const { email, password } = requestData

    // Créer un client Supabase pour l'authentification
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    
    // Créer un client admin pour accéder aux données utilisateur
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Essayer de se connecter avec Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ error: 'Email ou mot de passe incorrect' }),
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )
    }

    const authUserId = authData.user.id
    console.log('Utilisateur authentifié:', { email, authUserId })

    // Récupérer les informations utilisateur de notre table personnalisée en utilisant l'auth_id
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('auth_id', authUserId) // Utiliser auth_id au lieu d'email
      .single()

    if (userError || !user) {
      console.error('Utilisateur non trouvé dans table users:', { authUserId, userError })
      
      // Fallback: essayer avec l'email si auth_id ne fonctionne pas
      const { data: userByEmail, error: emailError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('email', email)
        .single()
      
      if (emailError || !userByEmail) {
        return new Response(
          JSON.stringify({ error: 'Utilisateur non trouvé dans les données personnalisées' }),
          { 
            status: 404, 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            } 
          }
        )
      }
      
      // Si trouvé par email mais pas d'auth_id, le mettre à jour
      console.log('Mise à jour auth_id pour utilisateur:', user_id)
      await supabaseAdmin
        .from('users')
        .update({ auth_id: authUserId })
        .eq('user_id', userByEmail.user_id)
      
      user = userByEmail
    }

    // Vérifier si l'utilisateur est actif
    if (!user.active) {
      return new Response(
        JSON.stringify({ error: 'Compte désactivé' }),
        { 
          status: 403, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )
    }

    // Si c'est la première connexion, on le signale mais on ne marque pas le token comme utilisé
    // C'est le front qui gèrera la mise à jour de first_connection après le changement de mot de passe
    if (user.first_connection) {
      return new Response(
        JSON.stringify({
          success: true,
          firstConnection: true,
          user: {
            user_id: user.user_id,
            auth_id: user.auth_id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            company_id: user.company_id,
            role: user.role
          },
          session: authData.session
        }),
        { 
          status: 200, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )
    }

    // Mettre à jour la date de dernière connexion
    await supabaseAdmin
      .from('users')
      .update({ last_login_date: new Date().toISOString() })
      .eq('user_id', user.user_id)

    // Retourner les informations avec la session Supabase
    return new Response(
      JSON.stringify({
        success: true,
        firstConnection: false,
        session: authData.session,
        user: {
          user_id: user.user_id,
          auth_id: user.auth_id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          company_id: user.company_id,
          role: user.role,
          photo: user.photo,
          birth_date: user.birth_date,
          total_activ_points: user.total_activ_points
        }
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        } 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Erreur serveur', details: error.message }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        } 
      }
    )
  }
})