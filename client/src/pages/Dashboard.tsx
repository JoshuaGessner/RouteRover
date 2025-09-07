import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { BottomNavigation } from "@/components/BottomNavigation";
import { DashboardTab } from "@/components/tabs/Dashboard";
import { TrackingTab } from "@/components/tabs/Tracking";
import { ExpensesTab } from "@/components/tabs/Expenses";
import { ReceiptsTab } from "@/components/tabs/Receipts";
import { ScheduleTab } from "@/components/tabs/Schedule";
import { SettingsTab } from "@/components/tabs/Settings";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MapPin, Receipt, FileUp, Camera } from "lucide-react";

type TabType = 'dashboard' | 'tracking' | 'expenses' | 'receipts' | 'schedule' | 'settings';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardTab />;
      case 'tracking':
        return <TrackingTab />;
      case 'expenses':
        return <ExpensesTab />;
      case 'receipts':
        return <ReceiptsTab />;
      case 'schedule':
        return <ScheduleTab />;
      case 'settings':
        return <SettingsTab />;
      default:
        return <DashboardTab />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      
      <main className="pb-20">
        {renderActiveTab()}
      </main>

      {/* Floating Action Button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            size="lg"
            className="fixed bottom-20 right-4 w-14 h-14 rounded-full shadow-lg z-50"
            data-testid="fab-quick-action"
          >
            <Plus className="w-6 h-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="mb-2">
          <DropdownMenuItem
            onClick={() => setActiveTab('tracking')}
            data-testid="fab-start-trip"
          >
            <MapPin className="w-4 h-4 mr-2" />
            Start Trip
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setActiveTab('expenses')}
            data-testid="fab-add-expense"
          >
            <Receipt className="w-4 h-4 mr-2" />
            Add Expense
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setActiveTab('receipts')}
            data-testid="fab-scan-receipt"
          >
            <Camera className="w-4 h-4 mr-2" />
            Scan Receipt
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setActiveTab('schedule')}
            data-testid="fab-import-schedule"
          >
            <FileUp className="w-4 h-4 mr-2" />
            Import Schedule
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
