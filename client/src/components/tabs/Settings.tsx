import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Eye, EyeOff, Download, FileX, Trash2, ExternalLink } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { apiRequest } from "@/lib/queryClient";

export function SettingsTab() {
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [mileageRate, setMileageRate] = useState("0.655");
  
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
    onSuccess: (data) => {
      if (data) {
        setApiKey(data.googleApiKey || "");
        setMileageRate(data.mileageRate?.toString() || "0.655");
      }
    },
  });

  const { data: errorLogs = [] } = useQuery({
    queryKey: ["/api/error-logs"],
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

  const handleSaveSettings = () => {
    saveSettingsMutation.mutate({
      googleApiKey: apiKey,
      mileageRate: parseFloat(mileageRate),
      darkMode: theme === 'dark',
      autoDetectionEnabled: true,
      pushNotifications: true,
      autoBackup: true,
    });
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
            
            <div className="flex items-center justify-between py-2 border-t border-border">
              <span className="text-sm">API Usage This Month</span>
              <span className="text-sm font-medium">1,247 / 2,500 calls</span>
            </div>
            
            <Progress value={apiUsagePercentage} className="w-full" />
            
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
                  {errorLogs.length} errors
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
