import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { getFileInfo, formatFileSize, createFilePreview } from '@/lib/fileUtils';

interface AttachmentPreviewProps {
  files: File[];
  onRemove: (index: number) => void;
  className?: string;
}

interface FileWithPreview {
  file: File;
  preview?: string;
  error?: string;
}

export function AttachmentPreview({ files, onRemove, className }: AttachmentPreviewProps) {
  const [filesWithPreviews, setFilesWithPreviews] = useState<FileWithPreview[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<{ file: File; preview: string } | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const previewUrlsRef = useRef<string[]>([]);

  // Handle preview opening with debugging
  const handleOpenPreview = (file: File, preview: string) => {
    console.log('🖼️ Opening preview for:', file.name);
    setSelectedPreview({ file, preview });
    setIsPreviewOpen(true);
  };

  // Handle preview closing with debugging
  const handleClosePreview = () => {
    console.log('❌ Closing preview');
    setIsPreviewOpen(false);
    setTimeout(() => {
      setSelectedPreview(null);
    }, 150); // Small delay for animation
  };

  // Handle keyboard events for the modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPreviewOpen) {
        console.log('⌨️ Escape key pressed, closing preview');
        handleClosePreview();
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

  // Generate previews for files
  useEffect(() => {
    const generatePreviews = async () => {
      // Clean up previous URLs
      previewUrlsRef.current.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
      previewUrlsRef.current = [];

      try {
        const updated = await Promise.all(
          files.map(async (file) => {
            const fileInfo = getFileInfo(file);
            const fileWithPreview: FileWithPreview = { file };

            // Debug logging
            console.log(`Processing file: ${file.name}, type: ${file.type}, isImage: ${fileInfo.isImage}, canPreview: ${fileInfo.canPreview}`);

            if (fileInfo.isImage && fileInfo.canPreview) {
              try {
                console.log(`Generating preview for image: ${file.name}`);
                const preview = await createFilePreview(file);
                fileWithPreview.preview = preview;
                console.log(`✅ Preview generated successfully for: ${file.name}`);
                // Track the URL for cleanup
                if (preview.startsWith('blob:') || preview.startsWith('data:')) {
                  previewUrlsRef.current.push(preview);
                }
              } catch (error) {
                console.error('❌ Failed to generate preview for:', file.name, error);
                fileWithPreview.error = 'Failed to generate preview';
              }
            } else if (fileInfo.isImage) {
              console.log(`⚠️ Image ${file.name} cannot be previewed`);
            }

            return fileWithPreview;
          })
        );
        setFilesWithPreviews(updated);
      } catch (error) {
        console.error('Error generating file previews:', error);
      }
    };

    if (files.length > 0) {
      generatePreviews();
    } else {
      setFilesWithPreviews([]);
      // Clean up any existing URLs
      previewUrlsRef.current.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
      previewUrlsRef.current = [];
    }

    // Cleanup function
    return () => {
      previewUrlsRef.current.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
      previewUrlsRef.current = [];
    };
  }, [files]);

  if (files.length === 0) {
    return null;
  }

  // Debug: Log the current state
  console.log('🎯 AttachmentPreview render - isPreviewOpen:', isPreviewOpen, 'selectedPreview:', !!selectedPreview);

  return (
    <>
      <div className={`space-y-3 ${className || ''}`}>
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Attached Files ({files.length})
        </div>
        
        <div className="grid grid-cols-1 gap-3">
          {filesWithPreviews.map((fileWithPreview, index) => {
            const { file, preview, error } = fileWithPreview;
            const fileInfo = getFileInfo(file);
            
            return (
              <Card key={index} className="overflow-hidden">
                <CardContent className="p-4">
                  <div 
                    className="flex items-start gap-3"
                    onClick={(e) => {
                      // Prevent any potential card-level click handlers
                      e.stopPropagation();
                    }}
                  >
                    {/* File Preview/Icon */}
                    <div className="flex-shrink-0">
                      {preview ? (
                        <div className="relative group">
                          <img
                            src={preview}
                            alt={file.name}
                            className="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                          />
                          {/* Preview overlay button */}
                          <div
                            className="absolute inset-0 w-full h-full bg-black/0 hover:bg-black/30 opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer backdrop-blur-[1px] flex items-center justify-center"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log('📸 Thumbnail clicked for preview:', file.name);
                              handleOpenPreview(file, preview);
                            }}
                            title="Click to preview image"
                          >
                            <div className="flex flex-col items-center gap-1 text-white">
                              <Eye className="h-5 w-5" />
                              <span className="text-xs font-medium">Preview</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="w-16 h-16 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                          <span className="text-2xl">{fileInfo.icon}</span>
                        </div>
                      )}
                    </div>

                    {/* File Information */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {file.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {fileInfo.category}
                            </Badge>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {formatFileSize(file.size)}
                            </span>
                          </div>
                          {error && (
                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                              <X className="h-3 w-3" />
                              {error}
                            </p>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1">
                          {fileInfo.isImage && preview && (
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
                                console.log('👁️ Eye button clicked for preview:', file.name);
                                handleOpenPreview(file, preview);
                              }}
                              className="h-8 w-8 p-0 hover:bg-blue-50 dark:hover:bg-blue-900"
                              title="Preview Image"
                            >
                              <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </Button>
                          )}
                          {fileInfo.isImage && !preview && !error && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled
                              className="h-8 w-8 p-0"
                              title="Generating preview..."
                            >
                              <RotateCcw className="h-4 w-4 animate-spin text-gray-400" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onRemove(index);
                            }}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                            title="Remove File"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Additional File Info */}
                      {fileInfo.canPreview && (
                        <div className="mt-2">
                          <Badge variant="secondary" className="text-xs">
                            <Eye className="h-3 w-3 mr-1" />
                            Preview available
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Custom Image Preview Modal */}
      {isPreviewOpen && selectedPreview && (
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
              handleClosePreview();
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
                Image Preview
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClosePreview}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Image Container */}
            <div className="flex-1 flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-900 min-h-[400px] max-h-[70vh] overflow-hidden">
              <div className="relative max-w-full max-h-full flex items-center justify-center">
                <img
                  src={selectedPreview.preview}
                  alt={selectedPreview.file.name}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    width: 'auto',
                    height: 'auto'
                  }}
                  onError={(e) => {
                    console.error('Failed to load image preview:', e);
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                  onLoad={() => {
                    console.log('✅ Image loaded successfully:', selectedPreview.file.name);
                  }}
                />
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">🖼️</div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {selectedPreview.file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(selectedPreview.file.size)} • {selectedPreview.file.type || 'Unknown type'}
                    </p>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Download the image
                      const link = document.createElement('a');
                      link.href = selectedPreview.preview;
                      link.download = selectedPreview.file.name;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                  >
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClosePreview}
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