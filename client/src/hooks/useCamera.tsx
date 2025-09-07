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
      // Check if camera is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported on this device');
      }

      // Try to access camera
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "environment", // Prefer back camera
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      
      streamRef.current = stream;

      // Create video element to display camera feed
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;

      // Wait for video to be ready
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
        setTimeout(reject, 5000); // Timeout after 5 seconds
      });

      // Create canvas to capture frame
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw current video frame to canvas
      context.drawImage(video, 0, 0);
      
      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create image blob'));
          }
        }, 'image/jpeg', 0.8);
      });

      // Stop camera stream
      stream.getTracks().forEach(track => track.stop());
      
      // Create file from blob
      const file = new File([blob], `receipt-${Date.now()}.jpg`, {
        type: 'image/jpeg'
      });

      return file;
    } catch (error) {
      console.error('Camera capture failed:', error);
      let errorMessage = 'Camera access failed';
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Camera permission denied. Please allow camera access in your browser settings or click "Request Camera Access" in the Settings tab.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera found on this device.';
        } else if (error.name === 'NotSupportedError') {
          errorMessage = 'Camera not supported on this device.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
      return null;
    } finally {
      setIsCapturing(false);
    }
  };

  const selectFromGallery = async (): Promise<File | null> => {
    return new Promise((resolve) => {
      if (!fileInputRef.current) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        // Remove capture attribute to open gallery, not camera
        input.onchange = (e) => {
          const target = e.target as HTMLInputElement;
          const file = target.files?.[0] || null;
          resolve(file);
        };
        input.click();
      } else {
        fileInputRef.current.onchange = (e) => {
          const target = e.target as HTMLInputElement;
          const file = target.files?.[0] || null;
          resolve(file);
        };
        fileInputRef.current.click();
      }
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
