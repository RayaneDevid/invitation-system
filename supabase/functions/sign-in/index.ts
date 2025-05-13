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

    console.log('Tentative de connexion pour:', email)

    // Créer un client admin pour accéder aux données
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // 1. ÉTAPE OBLIGATOIRE : Vérifier l'invitation pour cet email
    console.log('Vérification de l\'invitation pour:', email)
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('invites')
      .select('*')
      .eq('email', email)
      .single()

    // Si aucune invitation n'existe pour cet email
    if (inviteError || !invitation) {
      console.log('Aucune invitation trouvée pour:', email)
      return new Response(
        JSON.stringify({ 
          error: 'Aucune invitation trouvée pour cet email. Vous devez être invité pour accéder à la plateforme.' 
        }),
        { 
          status: 403, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )
    }

    console.log('Invitation trouvée:', { 
      invite_id: invitation.invite_id,
      used: invitation.used,
      expires_at: invitation.expires_at 
    })

    // Vérifier si l'invitation a expiré
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Votre invitation a expiré' }),
        { 
          status: 403, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )
    }

    // 2. Essayer de se connecter directement
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    
    console.log('Tentative de connexion avec Supabase Auth')
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !authData.user) {
      console.log('Échec de l\'authentification:', authError)
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
    console.log('Authentification réussie:', { email, authUserId })

    // 3. Si la connexion réussit et que l'invitation n'était pas utilisée, la marquer comme utilisée
    if (!invitation.used) {
      console.log('Marquage de l\'invitation comme utilisée')
      await supabaseAdmin
        .from('invites')
        .update({ used: true })
        .eq('invite_id', invitation.invite_id)
    }

    // 4. Récupérer les informations utilisateur de la table profiles
    const { data: user, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('user_id', authUserId)
      .single()

    if (userError || !user) {
      console.error('Utilisateur non trouvé dans table profiles:', { authUserId, userError })
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

    // 5. Si c'est la première connexion
    if (user.first_connection) {
      console.log('Première connexion détectée')
      return new Response(
        JSON.stringify({
          success: true,
          firstConnection: true,
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

    // 6. Mettre à jour la date de dernière connexion
    await supabaseAdmin
      .from('profiles')
      .update({ last_login_date: new Date().toISOString() })
      .eq('user_id', user.user_id)

    // 7. Retourner les informations avec la session
    console.log('Connexion réussie pour utilisateur existant')
    return new Response(
      JSON.stringify({
        success: true,
        firstConnection: false,
        session: authData.session,
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
    console.error('Erreur serveur:', error)
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