// supabase/functions/create-invitation/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface InvitationRequest {
  email: string
  firstName: string
  lastName: string
  companyId: string
  adminId: string
  role?: 'USER' | 'ADMIN' | 'SUPER_ADMIN'
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
    // Debug: Log des headers reçus
    console.log('Headers reçus:', Object.fromEntries(req.headers.entries()))
    
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

    // Récupérer et débugger les données de la requête
    const requestData: InvitationRequest = await req.json()
    console.log('Données reçues:', requestData)
    
    const { email, firstName, lastName, companyId, adminId, role = 'USER' } = requestData

    // Validation des données requises
    if (!email || !firstName || !lastName || !companyId || !adminId) {
      return new Response(
        JSON.stringify({ 
          error: 'Tous les champs sont requis: email, firstName, lastName, companyId, adminId' 
        }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )
    }

    console.log('Tentative de création d\'invitation pour:', email, 'par admin:', adminId)

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Vérifier si l'admin existe et a les permissions
    console.log('Recherche admin avec UUID:', adminId)
    const { data: admin, error: adminError } = await supabaseAdmin
      .from('profiles')
      .select('role, company_id')
      .eq('user_id', adminId)
      .single()

    if (adminError) {
      console.error('Erreur lors de la recherche admin:', adminError)
      return new Response(
        JSON.stringify({ 
          error: 'Erreur recherche admin', 
          details: adminError.message,
          adminId 
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

    if (!admin) {
      console.log('Admin non trouvé pour UUID:', adminId)
      return new Response(
        JSON.stringify({ 
          error: 'Admin non trouvé',
          adminId,
          details: 'Aucun profil trouvé avec cet UUID'
        }),
        { 
          status: 404, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )
    }

    console.log('Admin trouvé:', { role: admin.role, company_id: admin.company_id })

    // Vérifier les permissions
    if (admin.role !== 'ADMIN' && admin.role !== 'SUPER_ADMIN') {
      return new Response(
        JSON.stringify({ 
          error: 'Permissions insuffisantes',
          currentRole: admin.role,
          requiredRoles: ['ADMIN', 'SUPER_ADMIN']
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

    // Vérifier que l'admin appartient à la même entreprise
    if (admin.company_id !== companyId) {
      return new Response(
        JSON.stringify({ 
          error: 'L\'admin ne peut inviter que dans sa propre entreprise',
          adminCompanyId: admin.company_id,
          requestedCompanyId: companyId
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

    // Vérifier si l'utilisateur n'existe pas déjà
    console.log('Vérification existence utilisateur pour:', email)
    
    const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = authUsers?.users?.find(u => u.email === email)

    if (existingUser) {
      console.log('Utilisateur déjà existant:', email)
      return new Response(
        JSON.stringify({ 
          error: 'Un utilisateur avec cet email existe déjà' 
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

    try {
      // Générer un token unique pour l'invitation
      const inviteToken = crypto.randomUUID()
      
      // Calculer la date d'expiration (ex: 7 jours)
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)
      
      console.log('Création de l\'invitation dans la table invites pour:', email)
      
      // Créer l'invitation dans la table invites
      const { data: invitation, error: inviteError } = await supabaseAdmin
        .from('invites')
        .insert({
          email,
          first_name: firstName,
          last_name: lastName,
          company_id: companyId,
          token: inviteToken,
          expires_at: expiresAt.toISOString(),
          used: false,
          invited_at: new Date().toISOString()
        })
        .select()
        .single()

      if (inviteError) {
        console.error('Erreur création invitation:', inviteError)
        return new Response(
          JSON.stringify({ 
            error: 'Erreur lors de la création de l\'invitation', 
            details: inviteError.message 
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

      console.log('Invitation créée avec succès, création de l\'utilisateur dans auth.users')
      
      // Créer l'utilisateur dans auth.users avec le token comme mot de passe
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: inviteToken,  // Le token sert de mot de passe temporaire
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          company_id: companyId,
          role: role,
          first_connection: true
        }
      })

      if (authError) {
        console.error('Erreur création auth user:', authError)
        
        // Si l'erreur survient, supprimer l'invitation créée
        await supabaseAdmin
          .from('invites')
          .delete()
          .eq('invite_id', invitation.invite_id)

        return new Response(
          JSON.stringify({ 
            error: 'Erreur lors de la création du compte utilisateur', 
            details: authError.message 
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

      console.log('Utilisateur créé avec succès:', authUser.user.id)
      
      // TODO: Ici vous pouvez ajouter l'envoi d'email
      // Ex: envoyer un email avec les informations de connexion
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Invitation et compte utilisateur créés avec succès',
          inviteId: invitation.invite_id,
          userId: authUser.user.id,
          expiresAt: expiresAt.toISOString(),
          // En production, ne pas retourner les infos de connexion
          loginInfo: {
            email: email,
            temporaryPassword: inviteToken
          }
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
      console.error('Erreur lors de la création de l\'invitation:', error)
      return new Response(
        JSON.stringify({ 
          error: 'Erreur lors de la création de l\'invitation', 
          details: error.message 
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

  } catch (error) {
    console.error('Erreur serveur:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Erreur serveur', 
        details: error.message,
        stack: error.stack
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
})