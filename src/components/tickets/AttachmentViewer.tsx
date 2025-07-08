import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Eye, X, ExternalLink, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getFileInfo, formatFileSize, getFileViewUrl, downloadAttachment } from '@/lib/fileUtils';
import { useToast } from '@/hooks/use-toast';

interface TicketAttachment {
  id: string;
  ticket_id: string;
  file_name: string;
  file_path: string;
  file_size?: number | null;
  mime_type?: string | null;
  uploaded_by: string;
  uploaded_at?: string | null;
}

interface AttachmentViewerProps {
  attachments: TicketAttachment[];
  className?: string;
}

export function AttachmentViewer({ attachments, className }: AttachmentViewerProps) {
  const [selectedAttachment, setSelectedAttachment] = useState<TicketAttachment | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [justOpened, setJustOpened] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const { toast } = useToast();

  // Handle preview opening with debugging and protection
  const handleOpenPreview = (attachment: TicketAttachment, url: string) => {
    console.log('🖼️ Opening preview for:', attachment.file_name);
    
    // Use setTimeout to ensure the click event has fully processed
    setTimeout(() => {
      setSelectedAttachment(attachment);
      setPreviewUrl(url);
      setPreviewError(null); // Clear any previous errors
      setJustOpened(true);
      setIsPreviewOpen(true);
      console.log('✅ Preview state set to open');
      
      // Clear the justOpened flag after a short delay
      setTimeout(() => {
        setJustOpened(false);
        console.log('🔓 Modal ready for normal closing');
      }, 300);
    }, 10);
  };

  // Handle preview closing with debugging and reason tracking
  const handleClosePreview = (reason = 'unknown') => {
    console.log('❌ Closing preview, reason:', reason);
    setIsPreviewOpen(false);
    setJustOpened(false);
    setTimeout(() => {
      setSelectedAttachment(null);
      setPreviewUrl(null);
      setPreviewError(null);
      console.log('🧹 Preview state cleaned up');
    }, 150);
  };

  // Handle button click close
  const handleButtonClose = () => {
    handleClosePreview('button_click');
  };

  // Handle outside click close
  const handleOutsideClick = () => {
    if (justOpened) {
      console.log('🛡️ Preventing close - modal just opened');
      return;
    }
    handleClosePreview('outside_click');
  };

  // Handle escape key close
  const handleEscapeClose = () => {
    handleClosePreview('escape_key');
  };

  // Handle keyboard events for the modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPreviewOpen) {
        console.log('⌨️ Escape key pressed, closing preview');
        handleEscapeClose();
      }
    };

    if (isPreviewOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isPreviewOpen]);

  // Handle download
  const handleDownload = async (attachment: TicketAttachment) => {
    try {
      await downloadAttachment(
        supabase,
        'ticket-attachments',
        attachment.file_path,
        attachment.file_name
      );
      
      toast({
        title: "Download started",
        description: `${attachment.file_name} is being downloaded.`,
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Download failed",
        description: "There was an error downloading the file. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle preview
  const handlePreview = async (attachment: TicketAttachment) => {
    const fileInfo = getFileInfo(attachment);
    
    if (!fileInfo.canPreview) {
      toast({
        title: "Preview not available",
        description: "This file type cannot be previewed.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // First, let's check if the bucket exists and file exists
      console.log('🔍 Checking file existence...');
      
      // Try both possible bucket names
      const bucketNames = ['ticket-attachments', 'attachments'];
      let workingBucket = 'ticket-attachments';
      
      for (const bucketName of bucketNames) {
        console.log(`🪣 Trying bucket: ${bucketName}`);
        const { data: bucketList, error: bucketError } = await supabase.storage
          .from(bucketName)
          .list();
        
        console.log(`📂 ${bucketName} bucket contents:`, bucketList, bucketError);
        
        if (!bucketError && bucketList) {
          workingBucket = bucketName;
          console.log(`✅ Found working bucket: ${bucketName}`);
          break;
        }
      }
      
      // Search for the file in the working bucket
      const { data: fileData, error: fileError } = await supabase.storage
        .from(workingBucket)
        .list('', { search: attachment.file_name });
      
      console.log('📂 File search result:', fileData, fileError);

      const previewUrl = await getFileViewUrl(supabase, workingBucket, attachment.file_path);
      console.log('🔗 Generated preview URL:', previewUrl);
      console.log('📁 File path:', attachment.file_path);
      console.log('🪣 Using bucket:', workingBucket);
      
      handleOpenPreview(attachment, previewUrl);
    } catch (error) {
      console.error('❌ Error generating preview URL:', error);
      toast({
        title: "Preview failed",
        description: "There was an error generating the preview URL.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <>
      <div className={className}>
        <h4 className="font-semibold mb-3 flex items-center gap-2 text-gray-900 dark:text-gray-100">
          <FileText className="h-4 w-4" />
          Attachments ({attachments.length})
        </h4>
        
        <div className="space-y-3">
          {attachments.map((attachment) => {
            const fileInfo = getFileInfo(attachment);
            
            return (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={(e) => {
                  // Prevent any potential row-level click handlers
                  e.stopPropagation();
                }}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* File Icon */}
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 flex items-center justify-center bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                      <span className="text-lg">{fileInfo.icon}</span>
                    </div>
                  </div>

                  {/* File Information */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {attachment.file_name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {fileInfo.category}
                      </Badge>
                      {attachment.file_size && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatFileSize(attachment.file_size)}
                        </span>
                      )}
                      {fileInfo.canPreview && (
                        <Badge variant="secondary" className="text-xs">
                          <Eye className="h-3 w-3 mr-1" />
                          Previewable
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1">
                  {fileInfo.canPreview && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('👁️ Preview button clicked for:', attachment.file_name);
                        handlePreview(attachment);
                      }}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      title="Preview"
                      disabled={isLoading}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(attachment)}
                    className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom File Preview Modal */}
      {isPreviewOpen && selectedAttachment && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-300"
          style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(4px)'
          }}
          onClick={(e) => {
                         // Close when clicking outside the modal content
             if (e.target === e.currentTarget) {
               console.log('🖱️ Clicked outside modal, closing...');
               handleOutsideClick();
             }
          }}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-6xl max-h-[95vh] w-full mx-4 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
            onClick={(e) => {
              // Prevent closing when clicking inside the modal
              e.stopPropagation();
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Eye className="h-5 w-5" />
                File Preview
              </h2>
                             <Button
                 variant="ghost"
                 size="sm"
                 onClick={handleButtonClose}
                 className="h-8 w-8 p-0"
               >
                 <X className="h-4 w-4" />
               </Button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto">
              {previewUrl && (
                <div className="flex flex-col h-full">
                  {/* Preview Content */}
                  <div className="flex-1 p-6 bg-gray-50 dark:bg-gray-900 min-h-[400px]">
                    {(() => {
                      const fileInfo = getFileInfo(selectedAttachment);
                      
                                             if (fileInfo.isImage) {
                         return (
                           <div className="flex items-center justify-center h-full">
                             {previewError ? (
                               // Error state
                               <div className="text-center p-8">
                                 <div className="w-32 h-32 mx-auto mb-6 flex items-center justify-center bg-red-100 dark:bg-red-900/20 rounded-full">
                                   <span className="text-5xl">⚠️</span>
                                 </div>
                                 <h3 className="text-lg font-medium mb-2 text-red-600 dark:text-red-400">
                                   Image Preview Failed
                                 </h3>
                                 <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                   {previewError.includes('Bucket not found') 
                                     ? 'Storage bucket configuration issue. The image file may have been uploaded to a different location.'
                                     : previewError
                                   }
                                 </p>
                                 <div className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
                                   <p><strong>File:</strong> {selectedAttachment.file_name}</p>
                                   <p><strong>URL:</strong> {previewUrl}</p>
                                   <p><strong>Path:</strong> {selectedAttachment.file_path}</p>
                                 </div>
                                 <div className="mt-6 space-x-2">
                                   <Button
                                     variant="outline"
                                     size="sm"
                                     onClick={() => {
                                       setPreviewError(null);
                                       console.log('🔄 Retrying image load...');
                                     }}
                                   >
                                     Retry
                                   </Button>
                                   <Button
                                     variant="outline"
                                     size="sm"
                                     onClick={() => handleDownload(selectedAttachment)}
                                   >
                                     <Download className="h-4 w-4 mr-2" />
                                     Download Instead
                                   </Button>
                                 </div>
                               </div>
                             ) : (
                               // Normal image display
                               <img
                                 src={previewUrl}
                                 alt={selectedAttachment.file_name}
                                 className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                                 onError={(e) => {
                                   console.error('❌ Image failed to load:', selectedAttachment.file_name);
                                   console.error('🔗 Failed URL:', previewUrl);
                                   setPreviewError(`Failed to load image: ${selectedAttachment.file_name}`);
                                   
                                   // Test if the URL is accessible
                                   fetch(previewUrl, { method: 'HEAD' })
                                     .then(response => {
                                       console.log('🌐 URL accessibility test:', response.status, response.statusText);
                                     })
                                     .catch(error => {
                                       console.error('🌐 URL not accessible:', error);
                                     });
                                 }}
                                 onLoad={() => {
                                   console.log('✅ Image loaded successfully:', selectedAttachment.file_name);
                                 }}
                               />
                             )}
                           </div>
                         );
                       }
                      
                      if (fileInfo.isPDF) {
                        return (
                          <div className="w-full h-[70vh]">
                            <iframe
                              src={previewUrl}
                              title={selectedAttachment.file_name}
                              className="w-full h-full border rounded-lg"
                                                             onError={() => {
                                 console.error('❌ PDF failed to load:', selectedAttachment.file_name);
                                 console.error('🔗 Failed URL:', previewUrl);
                                 setPreviewError(`Failed to load PDF: ${selectedAttachment.file_name}`);
                               }}
                            />
                          </div>
                        );
                      }
                      
                      if (fileInfo.isVideo) {
                        return (
                          <div className="flex items-center justify-center h-full">
                            <video
                              src={previewUrl}
                              controls
                              className="max-w-full max-h-[70vh] rounded-lg shadow-lg"
                                                             onError={() => {
                                 console.error('❌ Video failed to load:', selectedAttachment.file_name);
                                 console.error('🔗 Failed URL:', previewUrl);
                                 setPreviewError(`Failed to load video: ${selectedAttachment.file_name}`);
                               }}
                            >
                              Your browser does not support the video tag.
                            </video>
                          </div>
                        );
                      }
                      
                      if (fileInfo.isAudio) {
                        return (
                          <div className="flex items-center justify-center p-8 h-full">
                            <div className="text-center">
                              <div className="w-32 h-32 mx-auto mb-6 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full">
                                <span className="text-5xl">{fileInfo.icon}</span>
                              </div>
                              <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">
                                {selectedAttachment.file_name}
                              </h3>
                              <audio
                                src={previewUrl}
                                controls
                                className="w-full max-w-md"
                                                                 onError={() => {
                                   console.error('❌ Audio failed to load:', selectedAttachment.file_name);
                                   console.error('🔗 Failed URL:', previewUrl);
                                   setPreviewError(`Failed to load audio: ${selectedAttachment.file_name}`);
                                 }}
                              >
                                Your browser does not support the audio tag.
                              </audio>
                            </div>
                          </div>
                        );
                      }
                      
                      // Fallback for other file types
                      return (
                        <div className="flex items-center justify-center p-8 text-center h-full">
                          <div>
                            <div className="w-32 h-32 mx-auto mb-6 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full">
                              <span className="text-5xl">{fileInfo.icon}</span>
                            </div>
                            <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-100">
                              {selectedAttachment.file_name}
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400 mb-4">
                              Preview not available for this file type
                            </p>
                            <Button
                              variant="outline"
                              onClick={() => handleDownload(selectedAttachment)}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download to view
                            </Button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {isLoading && (
                <div className="flex items-center justify-center p-8 h-96">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading preview...</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{getFileInfo(selectedAttachment).icon}</div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {selectedAttachment.file_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {selectedAttachment.file_size && formatFileSize(selectedAttachment.file_size)}
                      {selectedAttachment.uploaded_at && 
                        ` • Uploaded ${new Date(selectedAttachment.uploaded_at).toLocaleDateString()}`
                      }
                    </p>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(selectedAttachment)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  
                  {previewUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(previewUrl, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open in new tab
                    </Button>
                  )}
                  
                                     <Button
                     variant="outline"
                     size="sm"
                     onClick={handleButtonClose}
                   >
                     Close
                   </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 