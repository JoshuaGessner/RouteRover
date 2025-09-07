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
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border" data-testid="bottom-navigation">
      <div className="flex justify-around py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <Button
              key={tab.id}
              variant="ghost"
              size="sm"
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center py-2 px-4 h-auto ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
              data-testid={`nav-${tab.id}`}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className={`text-xs ${isActive ? 'font-medium' : ''}`}>
                {tab.label}
              </span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
