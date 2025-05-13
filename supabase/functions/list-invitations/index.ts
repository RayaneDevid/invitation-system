// supabase/functions/list-invitations/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface ListInvitationsRequest {
  adminId: string  // UUID maintenant
  companyId: number
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

    const requestData: ListInvitationsRequest = await req.json()
    const { adminId, companyId } = requestData

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Vérifier si l'admin existe et a les permissions
    const { data: admin, error: adminError } = await supabaseAdmin
      .from('profiles')  // Changé de 'users' à 'profiles'
      .select('role, company_id')
      .eq('user_id', adminId)
      .single()

    if (adminError || !admin) {
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

    if (admin.role !== 'ADMIN' && admin.role !== 'SUPER_ADMIN') {
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
        JSON.stringify({ error: 'L\'admin ne peut voir que les invitations de sa propre entreprise' }),
        { 
          status: 403, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )
    }

    // Récupérer toutes les invitations de l'entreprise
    const { data: invitations, error: invitationsError } = await supabaseAdmin
      .from('invites')
      .select('*')
      .eq('company_id', companyId)
      .order('invited_at', { ascending: false })

    if (invitationsError) {
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la récupération des invitations' }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )
    }

    // Formater les invitations avec leur statut
    const formattedInvitations = invitations.map(invite => ({
      invite_id: invite.invite_id,
      email: invite.email,
      first_name: invite.first_name,
      last_name: invite.last_name,
      invited_at: invite.invited_at,
      expires_at: invite.expires_at,
      used: invite.used,
      status: invite.used ? 'Used' : 
              (invite.expires_at && new Date(invite.expires_at) < new Date()) ? 'Expired' : 
              'Pending'
    }))

    return new Response(
      JSON.stringify({
        success: true,
        invitations: formattedInvitations
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