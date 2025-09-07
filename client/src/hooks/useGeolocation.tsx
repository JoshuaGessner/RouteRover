import { useState, useEffect } from "react";

interface GeolocationPosition {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude?: number;
    altitudeAccuracy?: number;
    heading?: number;
    speed?: number;
  };
  timestamp: number;
}

export function useGeolocation() {
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<string>('prompt');

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser");
      setLoading(false);
      return;
    }

    // Check permission status if available
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setPermissionStatus(result.state);
        if (result.state === 'denied') {
          setError("Location access denied. Please enable location permissions in your browser settings.");
          setLoading(false);
          return;
        }
      });
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setPosition(position);
        setError(null);
        setLoading(false);
        setPermissionStatus('granted');
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setError("Location access denied. Please click 'Allow' when prompted or enable location permissions in your browser settings.");
            setPermissionStatus('denied');
            break;
          case error.POSITION_UNAVAILABLE:
            setError("Location information unavailable. Please check your GPS settings.");
            break;
          case error.TIMEOUT:
            setError("Location request timed out. Please try again.");
            break;
          default:
            setError("An unknown error occurred while accessing location.");
            break;
        }
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000, // 30 seconds
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return { position, error, loading, permissionStatus };
}
