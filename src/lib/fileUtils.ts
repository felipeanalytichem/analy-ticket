/**
 * File utilities for handling attachments and file operations
 */

export interface FilePreviewInfo {
  isImage: boolean;
  isVideo: boolean;
  isAudio: boolean;
  isPDF: boolean;
  isText: boolean;
  isDocument: boolean;
  canPreview: boolean;
  icon: string;
  category: 'image' | 'video' | 'audio' | 'document' | 'text' | 'other';
}

/**
 * Get file information and preview capabilities
 */
export function getFileInfo(file: File | { file_name: string; mime_type?: string | null }): FilePreviewInfo {
  const mimeType = 'type' in file ? file.type : (file.mime_type || '');
  const fileName = 'name' in file ? file.name : file.file_name;
  const extension = fileName.toLowerCase().split('.').pop() || '';

  const isImage = mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(extension);
  const isVideo = mimeType.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(extension);
  const isAudio = mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(extension);
  const isPDF = mimeType === 'application/pdf' || extension === 'pdf';
  const isText = mimeType.startsWith('text/') || ['txt', 'md', 'csv', 'json', 'xml', 'html', 'css', 'js', 'ts'].includes(extension);
  const isDocument = [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ].includes(mimeType) || ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(extension);

  const canPreview = isImage || isPDF || isText || isVideo || isAudio;

  let category: FilePreviewInfo['category'] = 'other';
  let icon = '📄';

  if (isImage) {
    category = 'image';
    icon = '🖼️';
  } else if (isVideo) {
    category = 'video';
    icon = '🎥';
  } else if (isAudio) {
    category = 'audio';
    icon = '🎵';
  } else if (isPDF) {
    category = 'document';
    icon = '📕';
  } else if (isDocument) {
    category = 'document';
    if (['doc', 'docx'].includes(extension)) icon = '📘';
    else if (['xls', 'xlsx'].includes(extension)) icon = '📊';
    else if (['ppt', 'pptx'].includes(extension)) icon = '📈';
    else icon = '📋';
  } else if (isText) {
    category = 'text';
    icon = '📝';
  } else {
    // More specific icons for common file types
    if (['zip', 'rar', '7z'].includes(extension)) icon = '📦';
    else if (['exe', 'msi', 'dmg'].includes(extension)) icon = '💿';
    else icon = '📄';
  }

  return {
    isImage,
    isVideo,
    isAudio,
    isPDF,
    isText,
    isDocument,
    canPreview,
    icon,
    category
  };
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Create a preview URL for a file
 */
export function createFilePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Validate file for upload
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export function validateFile(file: File, options?: {
  maxSize?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
}): FileValidationResult {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = [
      'image/*',
      'application/pdf',
      'text/*',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'video/*',
      'audio/*'
    ],
    allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'mp4', 'mp3', 'wav']
  } = options || {};

  // Check file size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds ${formatFileSize(maxSize)} limit`
    };
  }

  // Check file type
  const fileInfo = getFileInfo(file);
  const extension = file.name.toLowerCase().split('.').pop() || '';
  
  const isTypeAllowed = allowedTypes.some(type => {
    if (type.endsWith('/*')) {
      return file.type.startsWith(type.replace('/*', '/'));
    }
    return file.type === type;
  });

  const isExtensionAllowed = allowedExtensions.includes(extension);

  if (!isTypeAllowed && !isExtensionAllowed) {
    return {
      valid: false,
      error: `File type not allowed. Supported types: ${allowedExtensions.join(', ')}`
    };
  }

  return { valid: true };
}

/**
 * Download a file from Supabase storage
 */
export async function downloadAttachment(
  supabaseClient: any,
  bucket: string,
  filePath: string,
  fileName: string
): Promise<void> {
  try {
    const { data, error } = await supabaseClient.storage
      .from(bucket)
      .download(filePath);

    if (error) {
      throw error;
    }

    // Create a URL for the downloaded file
    const url = window.URL.createObjectURL(data);
    
    // Create a temporary link element
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    
    // Trigger the download
    link.click();
    
    // Clean up
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
}

/**
 * Get a URL for viewing a file (handles both public and private buckets)
 */
export async function getFileViewUrl(
  supabaseClient: any,
  bucket: string,
  filePath: string
): Promise<string> {
  // For private buckets like 'ticket-attachments', we need signed URLs
  if (bucket === 'ticket-attachments' || bucket === 'attachments') {
    const { data, error } = await supabaseClient.storage
      .from(bucket)
      .createSignedUrl(filePath, 3600); // 1 hour expiry
    
    if (error) {
      console.error('Error creating signed URL:', error);
      // Fallback to public URL if signed URL fails
      const { data: publicData } = supabaseClient.storage
        .from(bucket)
        .getPublicUrl(filePath);
      return publicData.publicUrl;
    }
    
    return data.signedUrl;
  }
  
  // For public buckets, use public URL
  const { data } = supabaseClient.storage
    .from(bucket)
    .getPublicUrl(filePath);
  
  return data.publicUrl;
} 