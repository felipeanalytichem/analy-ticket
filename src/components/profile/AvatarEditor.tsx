import React, { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { 
  Upload, 
  RotateCw, 
  ZoomIn, 
  Palette, 
  Sun, 
  Moon, 
  Contrast,
  Sparkles,
  Trash2,
  Camera,
  RefreshCw,
  Image as ImageIcon,
  Move,
  ArrowUpDown,
  ArrowLeftRight
} from 'lucide-react';
import { toast } from 'sonner';
import { UploadService } from '@/lib/uploadService';

interface AvatarEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (avatarUrl: string) => void;
  currentAvatar?: string;
  userId: string;
}

interface FilterStyle {
  name: string;
  icon: React.ReactNode;
  filter: string;
  description: string;
}

const filters: FilterStyle[] = [
  { name: 'Original', icon: <Camera className="h-4 w-4" />, filter: 'none', description: 'No filter' },
  { name: 'Vintage', icon: <Sun className="h-4 w-4" />, filter: 'sepia(50%) saturate(120%) hue-rotate(10deg)', description: 'Warm vintage look' },
  { name: 'B&W', icon: <Moon className="h-4 w-4" />, filter: 'grayscale(100%)', description: 'Classic black and white' },
  { name: 'Bright', icon: <Sparkles className="h-4 w-4" />, filter: 'brightness(120%) saturate(130%)', description: 'Enhanced brightness' },
  { name: 'Cool', icon: <ImageIcon className="h-4 w-4" />, filter: 'hue-rotate(180deg) saturate(110%)', description: 'Cool blue tones' },
  { name: 'Warm', icon: <Sun className="h-4 w-4" />, filter: 'hue-rotate(30deg) saturate(120%) brightness(110%)', description: 'Warm orange tones' },
  { name: 'High Contrast', icon: <Contrast className="h-4 w-4" />, filter: 'contrast(150%) saturate(120%)', description: 'Enhanced contrast' },
  { name: 'Soft', icon: <Moon className="h-4 w-4" />, filter: 'blur(0.5px) brightness(110%) saturate(90%)', description: 'Soft dreamy effect' }
];

export function AvatarEditor({ isOpen, onClose, onSave, currentAvatar, userId }: AvatarEditorProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterStyle>(filters[0]);
  
  // Transform controls
  const [scale, setScale] = useState([1]);
  const [rotation, setRotation] = useState([0]);
  const [positionX, setPositionX] = useState([0]);
  const [positionY, setPositionY] = useState([0]);
  const [brightness, setBrightness] = useState([100]);
  const [contrast, setContrast] = useState([100]);
  const [saturation, setSaturation] = useState([100]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }

      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      
      // Reset transform controls
      setScale([1]);
      setRotation([0]);
      setPositionX([0]);
      setPositionY([0]);
      setBrightness([100]);
      setContrast([100]);
      setSaturation([100]);
      setActiveFilter(filters[0]);
    }
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setImageUrl(url);
    }
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const resetTransforms = () => {
    setScale([1]);
    setRotation([0]);
    setPositionX([0]);
    setPositionY([0]);
    setBrightness([100]);
    setContrast([100]);
    setSaturation([100]);
    setActiveFilter(filters[0]);
  };

  const getImageStyle = () => {
    const combinedFilter = `
      ${activeFilter.filter === 'none' ? '' : activeFilter.filter}
      brightness(${brightness[0]}%)
      contrast(${contrast[0]}%)
      saturate(${saturation[0]}%)
    `.trim();

    return {
      transform: `translate(${positionX[0]}px, ${positionY[0]}px) scale(${scale[0]}) rotate(${rotation[0]}deg)`,
      filter: combinedFilter,
      transition: 'all 0.2s ease-in-out',
      transformOrigin: 'center'
    };
  };

  // Convert edited image to blob for upload
  const getEditedImageBlob = (): Promise<Blob> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Set canvas size (square for avatar)
        const size = 512; // Reasonable size for avatars
        canvas.width = size;
        canvas.height = size;
        
        if (ctx) {
          // Fill with white background (in case of transparency)
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, size, size);
          
          // Apply transformations
          ctx.save();
          ctx.translate(size / 2, size / 2);
          
          // Apply position offset (scaled for the final output)
          const positionScale = size / 320; // 320px is our preview size
          ctx.translate(positionX[0] * positionScale, positionY[0] * positionScale);
          
          // Apply scale and rotation
          ctx.scale(scale[0], scale[0]);
          ctx.rotate((rotation[0] * Math.PI) / 180);
          
          // Apply filters via CSS filters to canvas
          const filterString = `
            ${activeFilter.filter === 'none' ? '' : activeFilter.filter}
            brightness(${brightness[0]}%)
            contrast(${contrast[0]}%)
            saturate(${saturation[0]}%)
          `.trim();
          
          if (filterString) {
            ctx.filter = filterString;
          }
          
          // Draw image to fill the circle area (object-cover behavior)
          const imgAspect = img.width / img.height;
          let drawWidth, drawHeight;
          
          if (imgAspect > 1) {
            // Landscape image - fit height, crop width
            drawHeight = size;
            drawWidth = size * imgAspect;
          } else {
            // Portrait image - fit width, crop height  
            drawWidth = size;
            drawHeight = size / imgAspect;
          }
          
          ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
          ctx.restore();
        }
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          }
        }, 'image/jpeg', 0.9);
      };
      
      img.src = imageUrl;
    });
  };

  const handleSave = async () => {
    if (!selectedFile) {
      toast.error('Please select an image first');
      return;
    }

    setIsUploading(true);
    try {
      // Get the edited image as blob
      const editedBlob = await getEditedImageBlob();
      
      // Create a new File from the blob
      const editedFile = new File([editedBlob], `avatar-${Date.now()}.jpg`, {
        type: 'image/jpeg'
      });
      
      const result = await UploadService.uploadAvatar(editedFile, userId);
      
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success('Avatar updated successfully!');
      onSave(result.url);
      onClose();
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload avatar');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (imageUrl && imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imageUrl);
    }
    setSelectedFile(null);
    setImageUrl('');
    resetTransforms();
    onClose();
  };

  // Drag to move functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    setPositionX([positionX[0] + deltaX]);
    setPositionY([positionY[0] + deltaY]);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Avatar Editor
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="upload" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="upload">Upload</TabsTrigger>
              <TabsTrigger value="transform" disabled={!imageUrl}>Transform</TabsTrigger>
              <TabsTrigger value="filters" disabled={!imageUrl}>Filters</TabsTrigger>
              <TabsTrigger value="adjust" disabled={!imageUrl}>Adjust</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden mt-4">
              {/* Upload Tab */}
              <TabsContent value="upload" className="h-full">
                <div className="h-full flex flex-col gap-4">
                  {!imageUrl ? (
                    <div
                      className="flex-1 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                    >
                      <Upload className="h-12 w-12 text-gray-400 mb-4" />
                      <p className="text-lg font-medium text-gray-600 dark:text-gray-300 mb-2">
                        Drop your image here or click to browse
                      </p>
                      <p className="text-sm text-gray-500">
                        Supports JPEG, PNG, GIF, WebP (max 5MB)
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
                      <div className="relative">
                        <div className="w-72 h-72 md:w-80 md:h-80 rounded-full overflow-hidden border-4 border-white shadow-lg bg-white">
                          <img
                            src={imageUrl}
                            alt="Selected avatar"
                            className="w-full h-full object-cover"
                            style={getImageStyle()}
                          />
                        </div>
                        <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1 rounded-full">
                          Circular Preview
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {imageUrl && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2"
                      >
                        <Upload className="h-4 w-4" />
                        Change Image
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setImageUrl('')}
                        className="flex items-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Transform Tab */}
              <TabsContent value="transform" className="h-full">
                <div className="h-full flex gap-4">
                  <div 
                    className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden relative"
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  >
                    <div className="relative">
                      <div className="w-72 h-72 md:w-80 md:h-80 rounded-full overflow-hidden border-4 border-white shadow-lg bg-white relative">
                        <img
                          src={imageUrl}
                          alt="Avatar preview"
                          className={`w-full h-full object-cover ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                          style={getImageStyle()}
                          onMouseDown={handleMouseDown}
                          draggable={false}
                        />
                        {!isDragging && (
                          <div className="absolute top-4 left-4 bg-black/70 text-white text-xs px-2 py-1 rounded pointer-events-none">
                            <Move className="h-3 w-3 inline mr-1" />
                            Drag to move
                          </div>
                        )}
                      </div>
                      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1 rounded-full">
                        Circular Preview - Drag to Position
                      </div>
                    </div>
                  </div>
                  
                  <div className="w-80 space-y-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                        <Move className="h-4 w-4" />
                        Drag the image or use sliders to position
                      </p>
                    </div>
                    
                    <div>
                      <Label className="flex items-center gap-2 mb-3">
                        <ZoomIn className="h-4 w-4" />
                        Scale: {scale[0].toFixed(2)}x
                      </Label>
                      <Slider
                        value={scale}
                        onValueChange={setScale}
                        min={0.5}
                        max={3}
                        step={0.1}
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <Label className="flex items-center gap-2 mb-3">
                        <ArrowLeftRight className="h-4 w-4" />
                        Position X: {positionX[0]}px
                      </Label>
                      <Slider
                        value={positionX}
                        onValueChange={setPositionX}
                        min={-200}
                        max={200}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <Label className="flex items-center gap-2 mb-3">
                        <ArrowUpDown className="h-4 w-4" />
                        Position Y: {positionY[0]}px
                      </Label>
                      <Slider
                        value={positionY}
                        onValueChange={setPositionY}
                        min={-200}
                        max={200}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <Label className="flex items-center gap-2 mb-3">
                        <RotateCw className="h-4 w-4" />
                        Rotation: {rotation[0]}°
                      </Label>
                      <Slider
                        value={rotation}
                        onValueChange={setRotation}
                        min={-180}
                        max={180}
                        step={15}
                        className="w-full"
                      />
                    </div>
                    
                    <Button
                      variant="outline"
                      onClick={resetTransforms}
                      className="w-full flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Reset Transforms
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Filters Tab */}
              <TabsContent value="filters" className="h-full">
                <div className="h-full flex gap-4">
                  <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
                    <div className="relative">
                      <div className="w-72 h-72 md:w-80 md:h-80 rounded-full overflow-hidden border-4 border-white shadow-lg bg-white">
                        <img
                          src={imageUrl}
                          alt="Avatar preview"
                          className="w-full h-full object-cover"
                          style={getImageStyle()}
                        />
                      </div>
                      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1 rounded-full">
                        Filter Preview
                      </div>
                    </div>
                  </div>
                  
                  <div className="w-80 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg overflow-y-auto">
                    <Label className="flex items-center gap-2 mb-4">
                      <Palette className="h-4 w-4" />
                      Choose Filter
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      {filters.map((filter) => (
                        <button
                          key={filter.name}
                          onClick={() => setActiveFilter(filter)}
                          className={`p-3 rounded-lg border-2 transition-all hover:scale-105 ${
                            activeFilter.name === filter.name
                              ? 'border-primary bg-primary/10'
                              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            {filter.icon}
                            <span className="font-medium text-sm">{filter.name}</span>
                          </div>
                          <p className="text-xs text-gray-500">{filter.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Adjust Tab */}
              <TabsContent value="adjust" className="h-full">
                <div className="h-full flex gap-4">
                  <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
                    <div className="relative">
                      <div className="w-72 h-72 md:w-80 md:h-80 rounded-full overflow-hidden border-4 border-white shadow-lg bg-white">
                        <img
                          src={imageUrl}
                          alt="Avatar preview"
                          className="w-full h-full object-cover"
                          style={getImageStyle()}
                        />
                      </div>
                      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1 rounded-full">
                        Adjustment Preview
                      </div>
                    </div>
                  </div>
                  
                  <div className="w-80 space-y-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <Label className="flex items-center gap-2 mb-3">
                        <Sun className="h-4 w-4" />
                        Brightness: {brightness[0]}%
                      </Label>
                      <Slider
                        value={brightness}
                        onValueChange={setBrightness}
                        min={50}
                        max={200}
                        step={5}
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <Label className="flex items-center gap-2 mb-3">
                        <Contrast className="h-4 w-4" />
                        Contrast: {contrast[0]}%
                      </Label>
                      <Slider
                        value={contrast}
                        onValueChange={setContrast}
                        min={50}
                        max={200}
                        step={5}
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <Label className="flex items-center gap-2 mb-3">
                        <Palette className="h-4 w-4" />
                        Saturation: {saturation[0]}%
                      </Label>
                      <Slider
                        value={saturation}
                        onValueChange={setSaturation}
                        min={0}
                        max={200}
                        step={5}
                        className="w-full"
                      />
                    </div>
                    
                    <Button
                      variant="outline"
                      onClick={resetTransforms}
                      className="w-full flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Reset Adjustments
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!selectedFile || isUploading}
            className="flex items-center gap-2"
          >
            {isUploading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Camera className="h-4 w-4" />
                Save Avatar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
