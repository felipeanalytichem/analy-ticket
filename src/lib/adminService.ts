import { supabase } from "@/integrations/supabase/client";

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
  private async callEdgeFunction(operation: string, data?: any): Promise<AdminResponse> {
    try {
      console.log(`🔗 Calling admin-users function with operation: ${operation}`);
      console.log('📦 Request data:', data);

      // Include the operation in the request body for proper routing
      const requestBody = {
        operation: operation,
        ...data
      };

      const { data: response, error } = await supabase.functions.invoke('admin-users', {
        body: requestBody,
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to call admin function');
      }

      console.log('📨 Function response:', response);
      return response;
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