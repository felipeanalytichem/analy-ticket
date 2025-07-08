import { supabase } from "@/integrations/supabase/client";

// Cache-busting version - update this to force new deployments
const ADMIN_SERVICE_VERSION = "2025.01.07.v4";

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
}

interface AdminResponse {
  success: boolean;
  user?: any;
  users?: any[];
  temporaryPassword?: string;
  message?: string;
  error?: string;
  details?: string;
}

class AdminService {
  constructor() {
    console.log(`🔧 AdminService initialized - Version: ${ADMIN_SERVICE_VERSION}`);
    console.log(`📅 Built at: ${new Date().toISOString()}`);
  }

  private async callEdgeFunction(operation: string, data?: any): Promise<AdminResponse> {
    try {
      console.log(`🔗 Calling admin-users function with operation: ${operation}`);
      console.log('📦 Request data:', data);

      // Get access token with multiple fallback methods
      let accessToken: string | null = null;

      // Method 1: Try supabase.auth.getSession()
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (!sessionError && session?.access_token) {
          accessToken = session.access_token;
          console.log('🔑 Got token via supabase.auth.getSession()');
        }
      } catch (e) {
        console.log('⚠️ Method 1 failed:', e);
      }

      // Method 2: Try localStorage directly
      if (!accessToken) {
        try {
          const authData = localStorage.getItem('sb-plbmgjqitlxedsmdqpld-auth-token');
          if (authData) {
            const parsed = JSON.parse(authData);
            if (parsed.access_token) {
              accessToken = parsed.access_token;
              console.log('🔑 Got token via localStorage');
            }
          }
        } catch (e) {
          console.log('⚠️ Method 2 failed:', e);
        }
      }

      // Method 3: Try sessionStorage
      if (!accessToken) {
        try {
          const authData = sessionStorage.getItem('sb-plbmgjqitlxedsmdqpld-auth-token');
          if (authData) {
            const parsed = JSON.parse(authData);
            if (parsed.access_token) {
              accessToken = parsed.access_token;
              console.log('🔑 Got token via sessionStorage');
            }
          }
        } catch (e) {
          console.log('⚠️ Method 3 failed:', e);
        }
      }

      if (!accessToken) {
        throw new Error('No valid authentication token found. Please sign in again.');
      }

      console.log('🔑 Using access token (preview):', accessToken.substring(0, 20) + '...');

      // Include the operation in the request body for proper routing
      const requestBody = {
        operation: operation,
        ...data
      };

      // Use direct fetch instead of supabase.functions.invoke for reliability
      const response = await fetch('https://plbmgjqitlxedsmdqpld.supabase.co/functions/v1/admin-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNTIyMjYsImV4cCI6MjA2NDcyODIyNn0.m6MsXWqI6TbJQ1EeaX8R7L7GHzA23ZaffCmKrVdVD_U',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('📡 Error response:', errorText);
        
        let errorMessage = 'Failed to call admin function';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      console.log('📨 Function response:', responseData);
      return responseData;
    } catch (error) {
      console.error('AdminService error:', error);
      throw error;
    }
  }

  async createUser(userData: CreateUserRequest): Promise<AdminResponse> {
    console.log('📝 Creating user via Edge Function:', userData.email);
    
    const response = await this.callEdgeFunction('create', userData);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to create user');
    }

    console.log('✅ User created successfully via Edge Function');
    return response;
  }

  async updateUser(userData: UpdateUserRequest): Promise<AdminResponse> {
    console.log('📝 Updating user via Edge Function:', userData.id);
    
    const response = await this.callEdgeFunction('update', userData);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to update user');
    }

    console.log('✅ User updated successfully via Edge Function');
    return response;
  }

  async deleteUser(userId: string): Promise<AdminResponse> {
    console.log('🗑️ Deleting user via Edge Function:', userId);
    
    const response = await this.callEdgeFunction('delete', { id: userId });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete user');
    }

    console.log('✅ User deleted successfully via Edge Function');
    return response;
  }

  async listUsers(): Promise<AdminResponse> {
    console.log('📋 Listing users via Edge Function');
    
    const response = await this.callEdgeFunction('list', {});
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to list users');
    }

    console.log('✅ Users listed successfully via Edge Function');
    return response;
  }

  async generateTemporaryPassword(userId: string): Promise<string> {
    console.log('🔑 Generating temporary password for user:', userId);
    
    // For generating temp passwords, we'll use a simple approach
    // You can extend this to call a specific Edge Function endpoint if needed
    const tempPassword = Math.random().toString(36).slice(-8).toUpperCase();
    
    try {
      // Since we can't directly call admin.updateUserById from client,
      // we'll use the update function with a password reset flag
      const response = await this.callEdgeFunction('update', {
        id: userId,
        resetPassword: true,
        tempPassword: tempPassword
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to generate temporary password');
      }

      console.log('✅ Temporary password generated successfully');
      return tempPassword;
    } catch (error) {
      console.error('❌ Error generating temporary password:', error);
      throw error;
    }
  }
}

export const adminService = new AdminService(); 