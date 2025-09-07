import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Play, Wifi, Signal } from "lucide-react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { apiRequest } from "@/lib/queryClient";
import type { Trip } from "@shared/schema";

export function TrackingTab() {
  const [autoDetection, setAutoDetection] = useState(true);
  const [sensitivity, setSensitivity] = useState([3]);
  const [tripPurpose, setTripPurpose] = useState("business");
  const [notes, setNotes] = useState("");
  
  const queryClient = useQueryClient();
  const { position, error: gpsError, loading: gpsLoading, permissionStatus } = useGeolocation();

  const { data: activeTrip } = useQuery<Trip | null>({
    queryKey: ["/api/trips/active"],
  });

  const startTripMutation = useMutation({
    mutationFn: async (tripData: any) => {
      const response = await apiRequest("POST", "/api/trips", tripData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips/active"] });
    },
  });

  const stopTripMutation = useMutation({
    mutationFn: async (tripId: string) => {
      const response = await apiRequest("PATCH", `/api/trips/${tripId}`, {
        endTime: new Date(),
        isActive: false,
        endLocation: position ? {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        } : null,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips/active"] });
    },
  });

  const handleStartTrip = () => {
    if (!position) return;
    
    startTripMutation.mutate({
      startLocation: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      },
      startTime: new Date(),
      purpose: tripPurpose,
      notes,
      autoDetected: false,
    });
  };

  const handleStopTrip = () => {
    if (activeTrip) {
      stopTripMutation.mutate(activeTrip.id);
    }
  };

  return (
    <div className="p-4 space-y-6" data-testid="tracking-tab">
      {/* Auto-Detection Settings */}
      <Card data-testid="auto-detection-card">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Auto Detection</h3>
            <Switch
              checked={autoDetection}
              onCheckedChange={setAutoDetection}
              data-testid="auto-detection-toggle"
            />
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Automatically detect when you start and stop driving
          </p>
          
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Sensitivity</Label>
              <Slider
                value={sensitivity}
                onValueChange={setSensitivity}
                max={5}
                min={1}
                step={1}
                className="w-full"
                data-testid="sensitivity-slider"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Low</span>
                <span>Medium</span>
                <span>High</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Minimum trip distance</span>
              <span className="text-sm font-medium">0.5 miles</span>
            </div>
            
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Minimum trip duration</span>
              <span className="text-sm font-medium">2 minutes</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manual Trip Controls */}
      <Card data-testid="manual-trip-controls">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">Manual Trip Control</h3>
          
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Trip Purpose</Label>
              <Select value={tripPurpose} onValueChange={setTripPurpose}>
                <SelectTrigger data-testid="trip-purpose-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="medical">Medical</SelectItem>
                  <SelectItem value="charity">Charity</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-sm font-medium mb-2 block">Notes (Optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add trip notes..."
                className="h-20 resize-none"
                data-testid="trip-notes"
              />
            </div>
            
            {activeTrip ? (
              <Button 
                variant="destructive"
                className="w-full"
                onClick={handleStopTrip}
                disabled={stopTripMutation.isPending}
                data-testid="stop-manual-trip"
              >
                <Play className="w-4 h-4 mr-2 rotate-90" />
                Stop Trip
              </Button>
            ) : (
              <Button 
                className="w-full"
                onClick={handleStartTrip}
                disabled={!position || startTripMutation.isPending}
                data-testid="start-manual-trip"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Manual Trip
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* GPS Status */}
      <Card data-testid="gps-status-card">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">GPS Status</h3>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Signal Strength</span>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className={`w-1 h-4 rounded ${position ? 'bg-accent' : 'bg-muted'}`}></div>
                  <div className={`w-1 h-4 rounded ${position ? 'bg-accent' : 'bg-muted'}`}></div>
                  <div className={`w-1 h-4 rounded ${position ? 'bg-accent' : 'bg-muted'}`}></div>
                  <div className={`w-1 h-3 rounded ${position ? 'bg-accent' : 'bg-muted'}`}></div>
                </div>
                <span className="text-sm font-medium">
                  {position ? 'Strong' : 'Weak'}
                </span>
              </div>
            </div>
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">Accuracy</span>
              <span className="font-medium">
                {position ? `±${position.coords.accuracy?.toFixed(0)} meters` : 'N/A'}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Update</span>
              <span className="font-medium">
                {position ? 'Just now' : 'Never'}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={position ? "default" : "destructive"}>
                <Wifi className="w-3 h-3 mr-1" />
                {position ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>

            {permissionStatus === 'denied' && (
              <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                <div className="font-medium mb-2">Location Permission Required</div>
                <p className="text-xs">To use GPS tracking, please enable location permissions in your browser settings and refresh the page.</p>
              </div>
            )}

            {permissionStatus === 'prompt' && !gpsError && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm">
                <div className="font-medium mb-2">Location Access Needed</div>
                <p className="text-xs">Please allow location access when prompted to enable GPS tracking.</p>
              </div>
            )}

            {gpsError && permissionStatus !== 'denied' && (
              <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                GPS Error: {gpsError}
              </div>
            )}

            {gpsLoading && permissionStatus === 'granted' && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm">
                Getting GPS location...
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
