import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateUserRequest {
  email: string;
  name: string;
  role: 'user' | 'agent' | 'admin';
  generateTempPassword?: boolean;
}

interface UpdateUserRequest {
  id: string;
  email?: string;
  name?: string;
  role?: 'user' | 'agent' | 'admin';
  resetPassword?: boolean;
  tempPassword?: string;
}

interface DeleteUserRequest {
  id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log(`📋 Admin-users function called with method: ${req.method}`)
    
    // Create admin client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase environment variables')
      return new Response(
        JSON.stringify({ 
          error: 'Server configuration error',
          details: 'Missing required environment variables'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('✅ Supabase admin client created successfully')

    const { method } = req
    const url = new URL(req.url)
    
    // Check for operation in URL path first (for backwards compatibility)
    const pathParts = url.pathname.split('/').filter(Boolean)
    const operation = pathParts[pathParts.length - 1]
    
    console.log(`📝 URL: ${req.url}`)
    console.log(`📝 Path parts: ${pathParts.join('/')}`)
    console.log(`📝 Operation from path: ${operation}`)

    // Parse request body to determine operation
    const requestBody = await req.json().catch(() => ({}))
    console.log('📝 Request body keys:', Object.keys(requestBody))
    console.log('📝 Request body operation:', requestBody.operation)
    
    // Check for operation in request body first, then fall back to path-based routing
    const requestOperation = requestBody.operation || operation
    
    // Route based on HTTP method and operation
    switch (method) {
      case 'POST':
        if (requestOperation === 'create' || (requestBody.email && requestBody.name && requestBody.role)) {
          console.log('🔀 Routing to CREATE USER')
          return await handleCreateUser(requestBody, supabaseAdmin)
        } else if (requestOperation === 'update' || (requestBody.id && !requestBody.email && !requestBody.name)) {
          console.log('🔀 Routing to UPDATE USER')
          return await handleUpdateUser(requestBody, supabaseAdmin)
        } else if (requestOperation === 'delete' || requestBody.id) {
          console.log('🔀 Routing to DELETE USER')
          return await handleDeleteUser(requestBody, supabaseAdmin)
        } else if (requestOperation === 'list') {
          console.log('🔀 Routing to LIST USERS')
          return await handleListUsers(supabaseAdmin)
        } else {
          console.error('❌ Cannot determine operation from request')
          return new Response(
            JSON.stringify({ 
              error: 'Invalid request', 
              details: 'Cannot determine operation from request body',
              received: Object.keys(requestBody),
              operation: requestOperation
            }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }
      
      case 'GET':
        if (operation === 'list' || operation === 'admin-users' || pathParts.length <= 2) {
          console.log('🔀 Routing to LIST USERS')
          return await handleListUsers(supabaseAdmin)
        }
        break
      
      default:
        console.error(`❌ Unsupported HTTP method: ${method}`)
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          { 
            status: 405, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
    }

    console.error('❌ No matching route found')
    return new Response(
      JSON.stringify({ 
        error: 'Invalid operation',
        details: `Method: ${method}, Operation: ${operation || 'none'}`,
        availableOperations: ['create', 'update', 'delete', 'list']
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Unexpected error in admin-users function:', error)
    console.error('❌ Error stack:', error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})

async function handleCreateUser(userData: CreateUserRequest, supabaseAdmin: any) {
  const { email, name, role, generateTempPassword } = userData

  console.log(`👤 Creating user: ${email} with role: ${role}`)

  if (!email || !name || !role) {
    console.error('❌ Missing required fields for user creation')
    return new Response(
      JSON.stringify({ 
        error: 'Missing required fields', 
        details: 'email, name, and role are required',
        received: { email: !!email, name: !!name, role: !!role }
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }

  try {
    // Generate temporary password if requested
    const tempPassword = generateTempPassword 
      ? Math.random().toString(36).slice(-8).toUpperCase()
      : 'TempPass123!'

    console.log(`🔑 Generated ${generateTempPassword ? 'random' : 'default'} temporary password`)

    // Create user with Supabase Auth Admin
    console.log('📧 Creating user in Supabase Auth...')
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { 
        full_name: name, 
        role: role 
      }
    })

    if (authError) {
      console.error('❌ Auth error:', authError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create user in authentication system', 
          details: authError.message 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    console.log(`✅ Auth user created with ID: ${authData.user.id}`)

    // Wait a moment for the user to be created in the users table via trigger
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Get the created user from the users table
    console.log('📋 Fetching user profile from database...')
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single()

    if (userError) {
      console.error('❌ User query error:', userError)
      // User created in auth but not in profile table - this might be expected
      console.log('⚠️ User created in auth but profile not found - this may be normal')
    }

    console.log(`✅ User created successfully: ${email}`)

    // Send welcome email
    try {
      console.log('📧 Sending welcome email...')
      
      const emailPayload = {
        to: email,
        subject: 'Welcome to ACS Ticket System',
        html: `
          <h2>Welcome to ACS Ticket System!</h2>
          <p>Hello <strong>${name}</strong>,</p>
          <p>Your account has been created successfully.</p>
          <p><strong>Login Details:</strong></p>
          <ul>
            <li>Email: ${email}</li>
            <li>Temporary Password: <code>${tempPassword}</code></li>
            <li>Role: ${role}</li>
          </ul>
          <p>Please log in and change your password on first access.</p>
          <p><a href="https://acsticket-nolllpxx3-felipeanalytichems-projects.vercel.app">Access the system</a></p>
          <br/>
          <p>Best regards,<br/>ACS Ticket System</p>
        `,
        text: `Welcome to ACS Ticket System!\n\nHello ${name},\n\nYour account has been created successfully.\n\nLogin Details:\n- Email: ${email}\n- Temporary Password: ${tempPassword}\n- Role: ${role}\n\nPlease log in and change your password on first access.\n\nBest regards,\nACS Ticket System`
      }

      const { data: emailResult, error: emailError } = await supabaseAdmin.functions.invoke('send-email', {
        body: emailPayload
      })

      if (emailError) {
        console.error('❌ Email sending error:', emailError)
      } else {
        console.log('✅ Welcome email sent successfully')
      }
    } catch (emailSendError) {
      console.error('❌ Error sending welcome email:', emailSendError)
      // Don't fail user creation if email fails
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        user: userData || {
          id: authData.user.id,
          email: authData.user.email,
          full_name: name,
          role: role
        },
        temporaryPassword: generateTempPassword ? tempPassword : tempPassword,
        message: 'User created successfully and welcome email sent'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )

  } catch (error) {
    console.error('❌ Unexpected error creating user:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to create user', 
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
}

async function handleUpdateUser(userData: UpdateUserRequest, supabaseAdmin: any) {
  const { id, email, name, role, resetPassword, tempPassword } = userData

  console.log(`👤 Updating user: ${id}`)

  if (!id) {
    return new Response(
      JSON.stringify({ error: 'User ID is required' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }

  try {
    // Update user profile
    const updates: any = {}
    if (name) updates.full_name = name
    if (email) updates.email = email
    if (role) updates.role = role
    updates.updated_at = new Date().toISOString()

    console.log('📋 Updating user profile:', Object.keys(updates))

    const { error: profileError } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', id)

    if (profileError) {
      console.error('❌ Profile update error:', profileError)
      throw profileError
    }

    // Update auth user
    const authUpdates: any = {}
    if (email) authUpdates.email = email
    if (role) authUpdates.user_metadata = { role: role }
    if (resetPassword && tempPassword) authUpdates.password = tempPassword

    if (Object.keys(authUpdates).length > 0) {
      console.log('📋 Updating auth user:', Object.keys(authUpdates))
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        id,
        authUpdates
      )

      if (authError) {
        console.error('❌ Auth update error:', authError)
        throw authError
      }
    }

    console.log(`✅ User updated successfully: ${id}`)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'User updated successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )

  } catch (error) {
    console.error('❌ Error updating user:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to update user', 
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
}

async function handleDeleteUser(userData: DeleteUserRequest, supabaseAdmin: any) {
  const { id } = userData

  console.log(`🗑️ Deleting user: ${id}`)

  if (!id) {
    return new Response(
      JSON.stringify({ error: 'User ID is required' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }

  try {
    // Delete from auth (this will cascade to profile via trigger)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id)

    if (authError) {
      console.error('❌ Auth deletion error:', authError)
      throw authError
    }

    console.log(`✅ User deleted successfully: ${id}`)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'User deleted successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )

  } catch (error) {
    console.error('❌ Error deleting user:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to delete user', 
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
}

async function handleListUsers(supabaseAdmin: any) {
  console.log('📋 Listing all users')

  try {
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error listing users:', error)
      throw error
    }

    console.log(`✅ Retrieved ${users?.length || 0} users`)

    return new Response(
      JSON.stringify({ 
        success: true,
        users: users || [],
        count: users?.length || 0
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )

  } catch (error) {
    console.error('❌ Error listing users:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to list users', 
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
} 