import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff, Download, FileX, Trash2, ExternalLink, Share2, Users, LogOut, Camera, MapPin, Settings, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import type { AppSettings } from "@shared/schema";

export function SettingsTab() {
  const [showApiKey, setShowApiKey] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [mileageRate, setMileageRate] = useState("0.655");
  const [defaultStartAddress, setDefaultStartAddress] = useState("");
  const [defaultEndAddress, setDefaultEndAddress] = useState("");
  const [shareCode, setShareCode] = useState("");
  const [importShareCode, setImportShareCode] = useState("");
  const [cameraPermission, setCameraPermission] = useState<PermissionState | null>(null);
  const [locationPermission, setLocationPermission] = useState<PermissionState | null>(null);
  
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings } = useQuery<AppSettings | null>({
    queryKey: ["/api/settings"],
  });

  // Update form data when settings are loaded - using useEffect instead of render-time logic
  useEffect(() => {
    if (settings) {
      setApiKey(settings.googleApiKey || "");
      setOpenaiApiKey(settings.openaiApiKey || "");
      setMileageRate(settings.mileageRate?.toString() || "0.655");
      setDefaultStartAddress(settings.defaultStartAddress || "");
      setDefaultEndAddress(settings.defaultEndAddress || "");
    }
  }, [settings]);

  // Check permissions on component mount
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        if (navigator.permissions) {
          const cameraStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
          setCameraPermission(cameraStatus.state);
          
          const locationStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          setLocationPermission(locationStatus.state);
          
          // Listen for permission changes
          cameraStatus.addEventListener('change', () => setCameraPermission(cameraStatus.state));
          locationStatus.addEventListener('change', () => setLocationPermission(locationStatus.state));
        }
      } catch (error) {
        console.log('Permission API not supported');
      }
    };
    
    checkPermissions();
  }, []);

  const { data: errorLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/error-logs"],
  });

  const currentMonth = new Date().toISOString().slice(0, 7);
  const { data: apiUsage } = useQuery<{totalCalls: number, totalCost: number, usage: any[], month: string}>({
    queryKey: ["/api/usage", currentMonth],
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (settingsData: any) => {
      const response = await apiRequest("POST", "/api/settings", settingsData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });

  const exportDataMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/export");
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'miletracker-export.json';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    },
  });

  const generateShareCodeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/share/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return await response.json();
    },
    onSuccess: (data) => {
      if (data.shareCode) {
        setShareCode(data.shareCode);
      }
    },
  });

  const importSharedDataMutation = useMutation({
    mutationFn: async (shareCode: string) => {
      const response = await fetch('/api/share/import', {
        method: 'POST',
        body: JSON.stringify({ shareCode }),
        headers: { 'Content-Type': 'application/json' }
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setImportShareCode('');
    },
  });

  const handleSaveSettings = () => {
    saveSettingsMutation.mutate({
      googleApiKey: apiKey,
      openaiApiKey: openaiApiKey,
      mileageRate: parseFloat(mileageRate),
      darkMode: theme === 'dark',
      autoDetectionEnabled: true,
      pushNotifications: true,
      autoBackup: true,
      defaultStartAddress,
      defaultEndAddress,
    });
  };

  const handleGenerateShareCode = () => {
    generateShareCodeMutation.mutate();
  };

  const handleImportSharedData = () => {
    if (importShareCode.trim()) {
      importSharedDataMutation.mutate(importShareCode);
    }
  };

  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Stop the stream immediately since we only need permission
      stream.getTracks().forEach(track => track.stop());
      setCameraPermission('granted');
    } catch (error: any) {
      console.error('Camera permission denied:', error);
      if (error.name === 'NotAllowedError') {
        setCameraPermission('denied');
      } else {
        console.error('Camera access error:', error);
      }
    }
  };

  const requestLocationPermission = async () => {
    try {
      await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve, 
          reject,
          { timeout: 10000, enableHighAccuracy: false, maximumAge: 300000 }
        );
      });
      setLocationPermission('granted');
    } catch (error: any) {
      console.error('Location permission denied:', error);
      if (error.code === 1) { // PERMISSION_DENIED
        setLocationPermission('denied');
      } else {
        console.error('Location access error:', error);
      }
    }
  };

  const getPermissionIcon = (permission: PermissionState | null) => {
    switch (permission) {
      case 'granted':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'denied':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'prompt':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      default:
        return <Settings className="w-5 h-5 text-gray-400" />;
    }
  };

  const getPermissionText = (permission: PermissionState | null) => {
    switch (permission) {
      case 'granted':
        return 'Allowed';
      case 'denied':
        return 'Denied';
      case 'prompt':
        return 'Not requested';
      default:
        return 'Unknown';
    }
  };

  const handleLogout = () => {
    window.location.href = '/api/logout';
  };

  const apiUsagePercentage = 49.88; // Mock data

  return (
    <div className="p-4 space-y-6" data-testid="settings-tab">
      {/* API Configuration */}
      <Card data-testid="api-settings">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">API Configuration</h3>
          
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Google Directions API Key</Label>
              <div className="flex gap-2">
                <Input
                  type={showApiKey ? "text" : "password"}
                  placeholder="Enter API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="flex-1"
                  data-testid="api-key-input"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="px-3"
                  data-testid="toggle-api-key-visibility"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Required for automatic route calculations
              </p>
            </div>
            
            <div>
              <Label className="text-sm font-medium mb-2 block">OpenAI API Key (Optional)</Label>
              <div className="flex gap-2">
                <Input
                  type={showOpenAIKey ? "text" : "password"}
                  placeholder="Enter OpenAI API key for enhanced receipt analysis"
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  className="flex-1"
                  data-testid="openai-api-key-input"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                  className="px-3"
                  data-testid="toggle-openai-key-visibility"
                >
                  {showOpenAIKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Enables advanced AI-powered receipt analysis for better accuracy
              </p>
            </div>
            
            <div className="space-y-3 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">API Usage This Month</span>
                <Badge variant="outline" className="text-xs">
                  {apiUsage ? `${apiUsage.totalCalls} calls` : 'No data'}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Google Directions API</span>
                  <span>{apiUsage ? `$${apiUsage.totalCost.toFixed(3)}` : '$0.000'}</span>
                </div>
                <Progress 
                  value={apiUsage ? Math.min((apiUsage.totalCalls / 40000) * 100, 100) : 0} 
                  className="h-2" 
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Free tier limit: 40,000/month</span>
                  <span>{apiUsage ? `${(40000 - apiUsage.totalCalls).toLocaleString()} remaining` : '40,000 remaining'}</span>
                </div>
              </div>
              
              {apiUsage && apiUsage.totalCalls > 35000 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs text-yellow-800">
                    ⚠️ Approaching API limit. Consider upgrading your Google Cloud plan.
                  </p>
                </div>
              )}
            </div>
            
            <div>
              <Label className="text-sm font-medium mb-2 block">Default Start Address</Label>
              <Input
                type="text"
                placeholder="Your home or office address"
                value={defaultStartAddress}
                onChange={(e) => setDefaultStartAddress(e.target.value)}
                className="w-full"
                data-testid="default-start-address-input"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Default starting point for daily routes
              </p>
            </div>
            
            <div>
              <Label className="text-sm font-medium mb-2 block">Default End Address</Label>
              <Input
                type="text"
                placeholder="Leave blank to use start address"
                value={defaultEndAddress}
                onChange={(e) => setDefaultEndAddress(e.target.value)}
                className="w-full"
                data-testid="default-end-address-input"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Default ending point for daily routes (optional)
              </p>
            </div>

            <Button 
              onClick={handleSaveSettings}
              disabled={saveSettingsMutation.isPending}
              className="w-full"
              data-testid="save-api-settings"
            >
              Save API Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* App Preferences */}
      <Card data-testid="app-preferences">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">App Preferences</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Dark Mode</span>
              <Switch
                checked={theme === 'dark'}
                onCheckedChange={toggleTheme}
                data-testid="dark-mode-toggle"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Push Notifications</span>
              <Switch defaultChecked data-testid="push-notifications-toggle" />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Auto-backup to Cloud</span>
              <Switch defaultChecked data-testid="auto-backup-toggle" />
            </div>
            
            <div>
              <Label className="text-sm font-medium mb-2 block">Default Mileage Rate</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm">$</span>
                <Input
                  type="number"
                  step="0.001"
                  value={mileageRate}
                  onChange={(e) => setMileageRate(e.target.value)}
                  className="flex-1"
                  data-testid="mileage-rate-input"
                />
                <span className="text-sm text-muted-foreground">per mile</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Sharing */}
      <Card data-testid="data-sharing">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold">Data Sharing</h3>
          </div>
          
          <div className="space-y-4">
            <Button 
              onClick={handleGenerateShareCode}
              disabled={generateShareCodeMutation.isPending}
              variant="outline" 
              className="w-full justify-start" 
              data-testid="generate-share-code"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Generate Share Code
            </Button>
            
            {shareCode && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-1">Share Code:</p>
                <p className="text-sm font-mono bg-background p-2 rounded border select-all">{shareCode}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Valid for 24 hours. Share this code with others to let them import your data.
                </p>
              </div>
            )}
            
            <div className="flex gap-2">
              <Input 
                placeholder="Enter share code to import"
                value={importShareCode}
                onChange={(e) => setImportShareCode(e.target.value)}
                data-testid="import-share-code-input"
              />
              <Button 
                onClick={handleImportSharedData}
                disabled={!importShareCode.trim() || importSharedDataMutation.isPending}
                data-testid="import-shared-data"
              >
                Import
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card data-testid="data-management">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">Data Management</h3>
          
          <div className="space-y-4">
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => exportDataMutation.mutate()}
              disabled={exportDataMutation.isPending}
              data-testid="export-data"
            >
              <div className="text-left">
                <div>Export Data</div>
                <p className="text-xs text-muted-foreground">Download all your data as JSON</p>
              </div>
              <Download className="w-4 h-4" />
            </Button>
            
            <Button
              variant="outline"
              className="w-full justify-between"
              data-testid="view-error-log"
            >
              <div className="text-left">
                <div>View Error Log</div>
                <p className="text-xs text-muted-foreground">Check processing errors and issues</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="text-xs">
                  {Array.isArray(errorLogs) ? errorLogs.length : 0} errors
                </Badge>
                <ExternalLink className="w-4 h-4" />
              </div>
            </Button>
            
            <Button
              variant="destructive"
              className="w-full justify-between"
              data-testid="clear-all-data"
            >
              <div className="text-left">
                <div>Clear All Data</div>
                <p className="text-xs text-muted-foreground">Permanently delete all app data</p>
              </div>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* App Permissions */}
      <Card data-testid="app-permissions">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <Settings className="w-4 h-4 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold">App Permissions</h3>
          </div>

          <div className="space-y-4">
            {/* Camera Permission */}
            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div className="flex items-center gap-3">
                <Camera className="w-5 h-5 text-gray-600" />
                <div>
                  <p className="font-medium">Camera Access</p>
                  <p className="text-xs text-muted-foreground">Required for receipt capture</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getPermissionIcon(cameraPermission)}
                <span className="text-sm font-medium">{getPermissionText(cameraPermission)}</span>
              </div>
            </div>

            {cameraPermission !== 'granted' && (
              <div className="ml-8 -mt-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={requestCameraPermission}
                  className="text-xs"
                  data-testid="request-camera-permission"
                >
                  Request Camera Access
                </Button>
              </div>
            )}

            {/* Location Permission */}
            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-gray-600" />
                <div>
                  <p className="font-medium">Location Access</p>
                  <p className="text-xs text-muted-foreground">Required for automatic trip tracking</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getPermissionIcon(locationPermission)}
                <span className="text-sm font-medium">{getPermissionText(locationPermission)}</span>
              </div>
            </div>

            {locationPermission !== 'granted' && (
              <div className="ml-8 -mt-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={requestLocationPermission}
                  className="text-xs"
                  data-testid="request-location-permission"
                >
                  Request Location Access
                </Button>
              </div>
            )}

            {/* Permission Help */}
            {(cameraPermission === 'denied' || locationPermission === 'denied') && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-yellow-800">
                    <p className="font-medium mb-1">Permissions Denied</p>
                    <p>To enable denied permissions, click the lock icon in your browser's address bar and change the permission settings, then refresh the page.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* User Account */}
      <Card data-testid="user-account">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">Account</h3>
          </div>

          {user && (
            <div className="p-3 bg-muted rounded-lg mb-4">
              <p className="text-sm font-medium">Signed in as:</p>
              <p className="text-sm text-muted-foreground">
                {(user as any).email || (user as any).firstName || (user as any).username || 'User'}
              </p>
            </div>
          )}

          <Button 
            onClick={handleLogout}
            variant="destructive" 
            className="w-full" 
            data-testid="logout-button"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </CardContent>
      </Card>

      {/* About */}
      <Card data-testid="about-section">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">About</h3>
          
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Version</span>
              <span className="font-medium">2.1.4</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Build</span>
              <span className="font-medium">240315</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Developer</span>
              <span className="font-medium">MileTracker Inc.</span>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-border space-y-2">
            <Button variant="ghost" className="w-full" data-testid="privacy-policy">
              Privacy Policy
            </Button>
            <Button variant="ghost" className="w-full" data-testid="terms-of-service">
              Terms of Service
            </Button>
            <Button variant="ghost" className="w-full" data-testid="contact-support">
              Contact Support
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}