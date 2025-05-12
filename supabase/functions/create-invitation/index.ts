// supabase/functions/create-invitation/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface InvitationRequest {
  email: string
  firstName: string
  lastName: string
  companyId: number
  adminId: number
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
    // Vérifier la méthode HTTP
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

    const requestData: InvitationRequest = await req.json()
    const { email, firstName, lastName, companyId, adminId } = requestData

    console.log('Tentative de création d\'invitation pour:', email)

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Vérifier si l'admin existe et a les permissions
    const { data: admin, error: adminError } = await supabaseAdmin
      .from('users')
      .select('role, company_id')
      .eq('user_id', adminId)
      .single()

    if (adminError || !admin) {
      console.log('Admin non trouvé:', adminError)
      return new Response(
        JSON.stringify({ error: 'Admin non trouvé' }),
        { 
          status: 404, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )
    }

    if (admin.role !== 'Admin' && admin.role !== 'Superadmin') {
      return new Response(
        JSON.stringify({ error: 'Permissions insuffisantes' }),
        { 
          status: 403, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )
    }

    if (admin.company_id !== companyId) {
      return new Response(
        JSON.stringify({ error: 'L\'admin ne peut inviter que dans sa propre entreprise' }),
        { 
          status: 403, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )
    }

    // Vérifier si l'email existe déjà dans les users personnalisés
    const { data: existingUser, error: userCheckError } = await supabaseAdmin
      .from('users')
      .select('user_id, auth_id')
      .eq('email', email)
      .single()

    console.log('Vérification users personnalisés:', { existingUser, userCheckError })

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'Un utilisateur avec cet email existe déjà dans la table users' }),
        { 
          status: 409, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )
    }

    // Vérifier si l'email existe déjà dans auth.users
    console.log('Vérification auth.users pour:', email)
    
    try {
      const { data: userByEmail, error: emailError } = await supabaseAdmin.auth.admin.getUserByEmail(email)
      console.log('Résultat getUserByEmail:', { 
        user: userByEmail?.user ? {
          id: userByEmail.user.id,
          email: userByEmail.user.email
        } : null, 
        error: emailError 
      })
      
      if (userByEmail && userByEmail.user) {
        console.log('Utilisateur trouvé dans auth avec getUserByEmail:', userByEmail.user.email)
        return new Response(
          JSON.stringify({ 
            error: 'Un utilisateur avec cet email existe déjà dans l\'authentification',
            details: `Email trouvé: ${userByEmail.user.email}`
          }),
          { 
            status: 409, 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            } 
          }
        )
      }
    } catch (emailCheckError) {
      console.log('getUserByEmail error (normal si l\'utilisateur n\'existe pas):', emailCheckError)
    }

    // Vérifier si une invitation existe déjà pour cet email
    const { data: existingInvite, error: inviteCheckError } = await supabaseAdmin
      .from('invites')
      .select('invite_id')
      .eq('email', email)
      .eq('used', false)
      .single()

    console.log('Vérification invitations:', { existingInvite, inviteCheckError })

    if (existingInvite) {
      return new Response(
        JSON.stringify({ error: 'Une invitation existe déjà pour cet email' }),
        { 
          status: 409, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )
    }

    // Générer un token unique
    const token = crypto.randomUUID()
    console.log('Token généré pour:', email)
    
    try {
      // 1. D'abord, créer l'utilisateur dans auth.users avec le token comme mot de passe
      console.log('Création utilisateur auth pour:', email)
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: token,
        email_confirm: true, // Confirmer l'email automatiquement
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          company_id: companyId,
          first_connection: true
        }
      })

      console.log('Résultat création auth:', { 
        user: authUser?.user ? {
          id: authUser.user.id,
          email: authUser.user.email
        } : null, 
        error: authError 
      })

      if (authError || !authUser.user) {
        console.error('Erreur création auth:', authError)
        return new Response(
          JSON.stringify({ 
            error: 'Erreur lors de la création de l\'utilisateur d\'authentification', 
            details: authError?.message || 'Pas d\'utilisateur retourné'
          }),
          { 
            status: 500, 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            } 
          }
        )
      }

      const authUserId = authUser.user.id

      // 2. Ensuite, créer l'invitation
      console.log('Création invitation pour:', email)
      const { data: invite, error: inviteError } = await supabaseAdmin
        .from('invites')
        .insert({
          email,
          first_name: firstName,
          last_name: lastName,
          company_id: companyId,
          token,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // Expire dans 7 jours
        })
        .select()
        .single()

      console.log('Résultat création invitation:', { invite: invite?.invite_id, error: inviteError })

      if (inviteError) {
        console.error('Erreur création invitation:', inviteError)
        // Si erreur, supprimer l'utilisateur auth créé
        await supabaseAdmin.auth.admin.deleteUser(authUserId)
        
        return new Response(
          JSON.stringify({ error: 'Erreur lors de la création de l\'invitation' }),
          { 
            status: 500, 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            } 
          }
        )
      }

      // 3. Enfin, créer l'utilisateur dans la table personnalisée avec l'auth_id
      console.log('Création utilisateur table personnalisée pour:', email, 'avec auth_id:', authUserId)
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .insert({
          auth_id: authUserId, // Lier l'auth_id à l'user
          email,
          first_name: firstName,
          last_name: lastName,
          company_id: companyId,
          password: null, // On ne stocke pas le mot de passe dans notre table car il est géré par auth
          first_connection: true,
          active: true,
          role: 'User'
        })
        .select()
        .single()

      console.log('Résultat création user:', { user: user?.user_id, error: userError })

      if (userError) {
        console.error('Erreur création user:', userError)
        // Si erreur, supprimer l'utilisateur auth et l'invitation
        await supabaseAdmin.auth.admin.deleteUser(authUserId)
        await supabaseAdmin
          .from('invites')
          .delete()
          .eq('invite_id', invite.invite_id)

        return new Response(
          JSON.stringify({ error: 'Erreur lors de la création du compte utilisateur' }),
          { 
            status: 500, 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            } 
          }
        )
      }

      console.log('Invitation créée avec succès pour:', email, 'auth_id:', authUserId, 'user_id:', user.user_id)
      return new Response(
        JSON.stringify({ 
          success: true, 
          invite,
          user: {
            user_id: user.user_id,
            auth_id: user.auth_id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name
          },
          auth_user_id: authUserId
        }),
        { 
          status: 201, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )

    } catch (error) {
      // En cas d'erreur générale, tout nettoyer
      console.error('Erreur lors de la création de l\'invitation:', error)
      
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la création de l\'invitation', details: error.message }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )
    }

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