import { supabase } from '@/lib/supabase';

export interface UploadResult {
  url: string;
  path: string;
  error?: string;
}

export class UploadService {
  /**
   * Upload an avatar image for a user
   */
  static async uploadAvatar(file: File, userId: string): Promise<UploadResult> {
    try {
      console.log('Starting avatar upload for user:', userId);
      console.log('File details:', { name: file.name, type: file.type, size: file.size });

      // Check if user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error('Authentication error:', authError);
        return {
          url: '',
          path: '',
          error: 'Usuário não autenticado.'
        };
      }
      console.log('User authenticated:', user.id);

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        return {
          url: '',
          path: '',
          error: 'Tipo de arquivo não suportado. Use JPEG, PNG, GIF ou WebP.'
        };
      }

      // Validate file size (5MB max)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        return {
          url: '',
          path: '',
          error: 'Arquivo muito grande. Tamanho máximo: 5MB.'
        };
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/avatar-${Date.now()}.${fileExt}`;
      console.log('Generated filename:', fileName);

      // Delete existing avatar if any
      await this.deleteExistingAvatar(userId);

      // Upload file
      console.log('Uploading file to avatars bucket...');
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type
        });

      if (error) {
        console.error('Upload error:', error);
        return {
          url: '',
          path: '',
          error: `Erro ao fazer upload da imagem: ${error.message}`
        };
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      return {
        url: publicUrl,
        path: fileName,
        error: undefined
      };
    } catch (error) {
      console.error('Upload service error:', error);
      return {
        url: '',
        path: '',
        error: 'Erro inesperado ao fazer upload.'
      };
    }
  }

  /**
   * Delete existing avatar for a user
   */
  private static async deleteExistingAvatar(userId: string): Promise<void> {
    try {
      // List existing files for the user
      const { data: files } = await supabase.storage
        .from('avatars')
        .list(userId);

      if (files && files.length > 0) {
        // Delete all existing avatar files
        const filesToDelete = files.map(file => `${userId}/${file.name}`);
        await supabase.storage
          .from('avatars')
          .remove(filesToDelete);
      }
    } catch (error) {
      console.error('Error deleting existing avatar:', error);
      // Don't throw error, just log it
    }
  }

  /**
   * Upload an attachment for a ticket
   */
  static async uploadAttachment(file: File, ticketId: string, userId: string): Promise<UploadResult> {
    try {
      // Validate file type
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        return {
          url: '',
          path: '',
          error: 'Tipo de arquivo não suportado.'
        };
      }

      // Validate file size (50MB max)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        return {
          url: '',
          path: '',
          error: 'Arquivo muito grande. Tamanho máximo: 50MB.'
        };
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${userId}/${ticketId}/${Date.now()}-${sanitizedFileName}`;

      // Upload file
      const { data, error } = await supabase.storage
        .from('attachments')
        .upload(fileName, file, {
          cacheControl: '3600'
        });

      if (error) {
        console.error('Attachment upload error:', error);
        return {
          url: '',
          path: '',
          error: 'Erro ao fazer upload do anexo.'
        };
      }

      // Get signed URL (since attachments bucket is private)
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('attachments')
        .createSignedUrl(fileName, 3600); // 1 hour expiry

      if (urlError) {
        console.error('Error creating signed URL:', urlError);
        return {
          url: '',
          path: '',
          error: 'Erro ao gerar URL do anexo.'
        };
      }

      return {
        url: signedUrlData.signedUrl,
        path: fileName,
        error: undefined
      };
    } catch (error) {
      console.error('Attachment upload service error:', error);
      return {
        url: '',
        path: '',
        error: 'Erro inesperado ao fazer upload do anexo.'
      };
    }
  }

  /**
   * Delete an attachment
   */
  static async deleteAttachment(filePath: string): Promise<{ error?: string }> {
    try {
      const { error } = await supabase.storage
        .from('attachments')
        .remove([filePath]);

      if (error) {
        console.error('Delete attachment error:', error);
        return { error: 'Erro ao deletar anexo.' };
      }

      return {};
    } catch (error) {
      console.error('Delete attachment service error:', error);
      return { error: 'Erro inesperado ao deletar anexo.' };
    }
  }

  /**
   * Get a fresh signed URL for an attachment
   */
  static async getAttachmentUrl(filePath: string): Promise<{ url?: string; error?: string }> {
    try {
      const { data, error } = await supabase.storage
        .from('attachments')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) {
        console.error('Error creating signed URL:', error);
        return { error: 'Erro ao gerar URL do anexo.' };
      }

      return { url: data.signedUrl };
    } catch (error) {
      console.error('Get attachment URL service error:', error);
      return { error: 'Erro inesperado ao gerar URL do anexo.' };
    }
  }
} 