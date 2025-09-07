import { useState, useRef } from "react";

export function useCamera() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const captureImage = async (): Promise<File | null> => {
    setIsCapturing(true);
    setError(null);
    
    try {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment'; // Opens camera app for taking photos
        
        input.onchange = (e) => {
          const target = e.target as HTMLInputElement;
          const file = target.files?.[0] || null;
          setIsCapturing(false);
          resolve(file);
        };
        
        // Handle cancel case
        input.oncancel = () => {
          setIsCapturing(false);
          resolve(null);
        };
        
        input.click();
      });
    } catch (error) {
      console.error('Camera capture failed:', error);
      setError('Failed to open camera. Please try again.');
      setIsCapturing(false);
      return null;
    }
  };

  const selectFromGallery = async (): Promise<File | null> => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      // No capture attribute - opens gallery/file picker
      input.onchange = (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0] || null;
        resolve(file);
      };
      
      input.oncancel = () => {
        resolve(null);
      };
      
      input.click();
    });
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  return {
    captureImage,
    selectFromGallery,
    stopCamera,
    isCapturing,
    error,
  };
}
