// supabase/functions/change-password/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface ChangePasswordRequest {
  email: string
  currentPassword: string
  newPassword: string
  isFirstConnection: boolean
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

    const requestData: ChangePasswordRequest = await req.json()
    const { email, currentPassword, newPassword, isFirstConnection } = requestData

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Récupérer l'utilisateur de la table profiles
    const { data: user, error: userError } = await supabaseAdmin
      .from('profiles')  // Changé de 'users' à 'profiles'
      .select('*')
      .eq('email', email)
      .single()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Utilisateur non trouvé' }),
        { 
          status: 404, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )
    }

    // Vérifier que le nouveau mot de passe est différent du mot de passe actuel
    if (currentPassword === newPassword) {
      return new Response(
        JSON.stringify({ error: 'Le nouveau mot de passe doit être différent du mot de passe actuel' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )
    }

    // Récupérer l'utilisateur auth par email
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
    
    if (!authUsers?.users || authUsers.users.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Aucun utilisateur d\'authentification trouvé' }),
        { 
          status: 404, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )
    }

    // Trouver l'utilisateur auth correspondant
    const authUser = authUsers.users.find(u => u.email === email)
    
    if (!authUser) {
      return new Response(
        JSON.stringify({ error: 'Utilisateur d\'authentification non trouvé' }),
        { 
          status: 404, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )
    }

    // D'abord vérifier l'ancien mot de passe en tentant une connexion
    const { error: verifyError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password: currentPassword,
    })

    if (verifyError) {
      return new Response(
        JSON.stringify({ error: 'Mot de passe actuel incorrect' }),
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )
    }

    // Mettre à jour le mot de passe de l'utilisateur auth
    const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
      authUser.id,
      {
        password: newPassword
      }
    )

    if (updateAuthError) {
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la mise à jour du mot de passe auth' }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )
    }

    // Si c'est la première connexion, mettre à jour la table profiles
    if (isFirstConnection) {
      const { error: updateUserError } = await supabaseAdmin
        .from('profiles')  // Changé de 'users' à 'profiles'
        .update({ first_connection: false })
        .eq('email', email)

      if (updateUserError) {
        return new Response(
          JSON.stringify({ error: 'Erreur lors de la mise à jour de l\'état de première connexion' }),
          { 
            status: 500, 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            } 
          }
        )
      }

      // Marquer l'invitation comme utilisée
      const { error: inviteUpdateError } = await supabaseAdmin
        .from('invites')
        .update({ used: true })
        .eq('email', email)
        .eq('used', false)

      if (inviteUpdateError) {
        console.error('Erreur lors de la mise à jour de l\'invitation:', inviteUpdateError)
        // Ne pas faire échouer la requête pour cette erreur
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Mot de passe changé avec succès'
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