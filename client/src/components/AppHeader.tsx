import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Wifi } from "lucide-react";

export function AppHeader() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="bg-card border-b border-border sticky top-0 z-40" data-testid="app-header">
      <div className="flex items-center justify-between p-4">
        <h1 className="text-xl font-semibold text-foreground">Route Rover</h1>
        <div className="flex items-center gap-3">
          {/* GPS Status Indicator */}
          <div className="flex items-center gap-2" data-testid="gps-status">
            <div className="w-3 h-3 bg-accent rounded-full animate-pulse"></div>
            <span className="text-sm text-muted-foreground">GPS Active</span>
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
