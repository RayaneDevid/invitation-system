// supabase/functions/migrate-users/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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
        JSON.stringify({ error: 'Méthode non autorisée. Utilisez POST.' }),
        { 
          status: 405, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )
    }

    console.log('Début de la migration des utilisateurs...')
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Récupérer tous les utilisateurs de la table users qui n'ont pas d'auth_id
    console.log('Récupération des utilisateurs sans auth_id...')
    const { data: usersWithoutAuthId, error: usersError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, email')
      .is('auth_id', null)

    if (usersError) {
      console.error('Erreur récupération users:', usersError)
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la récupération des utilisateurs', details: usersError }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )
    }

    console.log(`Trouvé ${usersWithoutAuthId.length} utilisateurs sans auth_id`)

    // 2. Récupérer tous les utilisateurs auth
    console.log('Récupération de tous les utilisateurs auth...')
    const { data: allAuthUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (authError) {
      console.error('Erreur récupération auth users:', authError)
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la récupération des utilisateurs auth', details: authError }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )
    }

    console.log(`Trouvé ${allAuthUsers.users.length} utilisateurs auth`)

    // 3. Créer un map email -> auth_id pour une recherche rapide
    const authUsersMap = new Map()
    allAuthUsers.users.forEach(authUser => {
      if (authUser.email) {
        authUsersMap.set(authUser.email.toLowerCase(), authUser.id)
      }
    })

    const results = {
      total: usersWithoutAuthId.length,
      migrated: 0,
      skipped: 0,
      errors: []
    }

    // 4. Pour chaque utilisateur, chercher son auth_id correspondant
    for (const user of usersWithoutAuthId) {
      try {
        console.log(`Traitement de ${user.email}...`)
        
        // Chercher l'auth_id dans le map
        const authId = authUsersMap.get(user.email.toLowerCase())
        
        if (!authId) {
          console.log(`Pas d'auth user trouvé pour ${user.email}`)
          results.skipped++
          results.errors.push({
            email: user.email,
            error: 'Auth user not found',
            details: 'Aucun utilisateur auth correspondant trouvé'
          })
          continue
        }

        // Mettre à jour la table users avec l'auth_id
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ auth_id: authId })
          .eq('user_id', user.user_id)
        
        if (updateError) {
          console.error(`Erreur mise à jour pour ${user.email}:`, updateError)
          results.errors.push({
            email: user.email,
            error: 'Update failed',
            details: updateError
          })
        } else {
          console.log(`✓ Migré ${user.email} -> ${authId}`)
          results.migrated++
        }
      } catch (error) {
        console.error(`Erreur pour ${user.email}:`, error)
        results.errors.push({
          email: user.email,
          error: 'Unexpected error',
          details: error.message
        })
      }
    }

    console.log('Migration terminée')
    console.log('Résultats:', results)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Migration terminée',
        results
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
    console.error('Erreur migration:', error)
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