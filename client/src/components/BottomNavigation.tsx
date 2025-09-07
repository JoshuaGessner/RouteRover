import { Button } from "@/components/ui/button";
import { 
  Home, 
  Route, 
  Receipt, 
  Images, 
  Calendar, 
  Settings 
} from "lucide-react";

type TabType = 'dashboard' | 'tracking' | 'expenses' | 'receipts' | 'schedule' | 'settings';

interface BottomNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function BottomNavigation({ activeTab, onTabChange }: BottomNavigationProps) {
  const tabs = [
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: Home },
    { id: 'tracking' as TabType, label: 'Tracking', icon: Route },
    { id: 'expenses' as TabType, label: 'Expenses', icon: Receipt },
    { id: 'receipts' as TabType, label: 'Receipts', icon: Images },
    { id: 'schedule' as TabType, label: 'Schedule', icon: Calendar },
    { id: 'settings' as TabType, label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50" data-testid="bottom-navigation">
      <div className="flex justify-between px-2 py-1 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <Button
              key={tab.id}
              variant="ghost"
              size="sm"
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center py-2 px-1 h-auto min-w-0 flex-1 ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
              data-testid={`nav-${tab.id}`}
            >
              <Icon className="w-4 h-4 mb-1 flex-shrink-0" />
              <span className={`text-xs ${isActive ? 'font-medium' : ''} truncate max-w-full`}>
                {tab.label}
              </span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
