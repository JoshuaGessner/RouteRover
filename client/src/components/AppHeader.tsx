import { useTheme } from "@/components/ThemeProvider";
import { useGeolocation } from "@/hooks/useGeolocation";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Wifi } from "lucide-react";

export function AppHeader() {
  const { theme, toggleTheme } = useTheme();
  const { position, error, loading, permissionStatus } = useGeolocation();

  const getGPSStatus = () => {
    if (loading) {
      return { text: "GPS Loading", color: "bg-yellow-500", animate: "animate-pulse" };
    }
    if (error || permissionStatus === 'denied') {
      return { text: "GPS Denied", color: "bg-red-500", animate: "" };
    }
    if (position && permissionStatus === 'granted') {
      return { text: "GPS Active", color: "bg-green-500", animate: "animate-pulse" };
    }
    return { text: "GPS Inactive", color: "bg-gray-400", animate: "" };
  };

  const gpsStatus = getGPSStatus();

  return (
    <header className="bg-card border-b border-border sticky top-0 z-40" data-testid="app-header">
      <div className="flex items-center justify-between p-4">
        <h1 className="text-xl font-semibold text-foreground">Route Rover</h1>
        <div className="flex items-center gap-3">
          {/* GPS Status Indicator */}
          <div className="flex items-center gap-2" data-testid="gps-status">
            <div className={`w-3 h-3 ${gpsStatus.color} rounded-full ${gpsStatus.animate}`}></div>
            <span className="text-sm text-muted-foreground">{gpsStatus.text}</span>
          </div>
          {/* Theme Toggle */}
          <Button
            variant="secondary"
            size="sm"
            onClick={toggleTheme}
            className="p-2"
            data-testid="theme-toggle"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
