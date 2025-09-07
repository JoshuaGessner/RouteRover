import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { BottomNavigation } from "@/components/BottomNavigation";
import { DashboardTab } from "@/components/tabs/Dashboard";
import { TrackingTab } from "@/components/tabs/Tracking";
import { ExpensesTab } from "@/components/tabs/Expenses";
import { SettingsTab } from "@/components/tabs/Settings";
import { CalendarView } from "@/components/CalendarView";

type TabType = 'dashboard' | 'tracking' | 'expenses' | 'schedules' | 'settings';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  const handleTabChange = (newTab: TabType) => {
    setActiveTab(newTab);
    // Scroll to top when changing main tabs
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardTab />;
      case 'tracking':
        return <TrackingTab />;
      case 'expenses':
        return <ExpensesTab />;
      case 'schedules':
        return <CalendarView />;
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


      <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  );
}
