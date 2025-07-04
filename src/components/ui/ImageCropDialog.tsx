import React, { useState, useRef, useCallback } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { RotateCw, RotateCcw, Crop as CropIcon, Download } from 'lucide-react';
import 'react-image-crop/dist/ReactCrop.css';

interface ImageCropDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (croppedImageFile: File) => void;
  imageFile: File | null;
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

export function ImageCropDialog({ isOpen, onClose, onCropComplete, imageFile }: ImageCropDialogProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [aspect, setAspect] = useState<number | undefined>(1); // 1:1 aspect ratio for avatars
  const [imageSrc, setImageSrc] = useState<string>('');
  
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load image when file changes
  React.useEffect(() => {
    if (imageFile) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result as string);
      };
      reader.readAsDataURL(imageFile);
    }
  }, [imageFile]);

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    if (aspect) {
      const { width, height } = e.currentTarget;
      setCrop(centerAspectCrop(width, height, aspect));
    }
  }

  const generateCroppedImage = useCallback(async () => {
    if (!completedCrop || !imgRef.current || !canvasRef.current) {
      return;
    }

    const image = imgRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return;
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const pixelRatio = window.devicePixelRatio;

    canvas.width = Math.floor(completedCrop.width * scaleX * pixelRatio);
    canvas.height = Math.floor(completedCrop.height * scaleY * pixelRatio);

    ctx.scale(pixelRatio, pixelRatio);
    ctx.imageSmoothingQuality = 'high';

    const cropX = completedCrop.x * scaleX;
    const cropY = completedCrop.y * scaleY;

    const centerX = image.naturalWidth / 2;
    const centerY = image.naturalHeight / 2;

    ctx.save();

    ctx.translate(-cropX, -cropY);
    ctx.translate(centerX, centerY);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -centerY);
    ctx.drawImage(
      image,
      0,
      0,
      image.naturalWidth,
      image.naturalHeight,
      0,
      0,
      image.naturalWidth,
      image.naturalHeight,
    );

    ctx.restore();

    return new Promise<File>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], imageFile?.name || 'cropped-avatar.jpg', {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(file);
        }
      }, 'image/jpeg', 0.9);
    });
  }, [completedCrop, scale, rotate, imageFile]);

  const handleCropComplete = async () => {
    const croppedFile = await generateCroppedImage();
    if (croppedFile) {
      onCropComplete(croppedFile);
      onClose();
    }
  };

  const handleRotateLeft = () => {
    setRotate((prev) => prev - 90);
  };

  const handleRotateRight = () => {
    setRotate((prev) => prev + 90);
  };

  const resetTransforms = () => {
    setScale(1);
    setRotate(0);
    if (imgRef.current && aspect) {
      const { width, height } = imgRef.current;
      setCrop(centerAspectCrop(width, height, aspect));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CropIcon className="h-5 w-5" />
            Editar e Recortar Imagem
          </DialogTitle>
          <DialogDescription>
            Ajuste, recorte e edite sua imagem antes de fazer o upload. Use os controles abaixo para zoom, rotação e proporção.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Image Crop Area */}
          {imageSrc && (
            <div className="flex justify-center bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="max-w-full max-h-[400px] overflow-hidden rounded-lg">
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={aspect}
                  minWidth={50}
                  minHeight={50}
                  keepSelection
                  className="max-w-full max-h-full"
                >
                  <img
                    ref={imgRef}
                    alt="Crop preview"
                    src={imageSrc}
                    style={{
                      transform: `scale(${scale}) rotate(${rotate}deg)`,
                      maxWidth: '100%',
                      maxHeight: '400px',
                      display: 'block',
                    }}
                    onLoad={onImageLoad}
                  />
                </ReactCrop>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Scale Control */}
            <div className="space-y-2">
              <Label>Zoom: {Math.round(scale * 100)}%</Label>
              <Slider
                value={[scale]}
                onValueChange={(value) => setScale(value[0])}
                min={0.5}
                max={3}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Rotation Controls */}
            <div className="space-y-2">
              <Label>Rotação</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRotateLeft}
                  className="flex-1"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  90° ←
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRotateRight}
                  className="flex-1"
                >
                  <RotateCw className="h-4 w-4 mr-2" />
                  90° →
                </Button>
              </div>
            </div>
          </div>

          {/* Aspect Ratio Controls */}
          <div className="space-y-2">
            <Label>Proporção</Label>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={aspect === 1 ? "default" : "outline"}
                size="sm"
                onClick={() => setAspect(1)}
              >
                1:1 (Quadrado)
              </Button>
              <Button
                variant={aspect === 4/3 ? "default" : "outline"}
                size="sm"
                onClick={() => setAspect(4/3)}
              >
                4:3
              </Button>
              <Button
                variant={aspect === 16/9 ? "default" : "outline"}
                size="sm"
                onClick={() => setAspect(16/9)}
              >
                16:9
              </Button>
              <Button
                variant={aspect === undefined ? "default" : "outline"}
                size="sm"
                onClick={() => setAspect(undefined)}
              >
                Livre
              </Button>
            </div>
          </div>

          {/* Reset Button */}
          <div className="flex justify-center">
            <Button variant="outline" onClick={resetTransforms}>
              Resetar Edições
            </Button>
          </div>

          {/* Hidden canvas for generating cropped image */}
          <canvas
            ref={canvasRef}
            style={{ display: 'none' }}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleCropComplete} disabled={!completedCrop}>
            <Download className="h-4 w-4 mr-2" />
            Aplicar e Usar Imagem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 