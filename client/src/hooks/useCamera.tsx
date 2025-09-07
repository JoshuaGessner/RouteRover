import { useState, useRef } from "react";

export function useCamera() {
  const [isCapturing, setIsCapturing] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const captureImage = async (): Promise<File | null> => {
    setIsCapturing(true);
    
    try {
      // Try to access camera
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "environment" // Prefer back camera
        } 
      });
      
      streamRef.current = stream;

      // Create video element to display camera feed
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;

      // Wait for video to be ready
      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
      });

      // Create canvas to capture frame
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw current video frame to canvas
      context.drawImage(video, 0, 0);
      
      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob!);
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
      return null;
    } finally {
      setIsCapturing(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  return {
    captureImage,
    stopCamera,
    isCapturing,
  };
}
