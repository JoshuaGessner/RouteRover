import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, DollarSign } from "lucide-react";
import type { Trip, Expense } from "@shared/schema";

export function DashboardTab() {
  const { data: trips = [] } = useQuery<Trip[]>({
    queryKey: ["/api/trips"],
  });

  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: activeTrip } = useQuery<Trip | null>({
    queryKey: ["/api/trips/active"],
  });

  // Calculate today's summary
  const today = new Date().toDateString();
  const todayTrips = trips.filter((trip) => 
    new Date(trip.startTime).toDateString() === today
  );
  const todayExpenses = expenses.filter((expense) => 
    new Date(expense.date).toDateString() === today
  );

  const totalMiles = todayTrips.reduce((sum, trip) => sum + (trip.distance || 0), 0);
  const totalExpenses = todayExpenses.reduce((sum, expense) => sum + expense.amount, 0);


  return (
    <div className="p-4 space-y-6" data-testid="dashboard-tab">
      {/* Today's Summary Card */}
      <Card data-testid="todays-summary">
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-4">Today's Summary</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary" data-testid="today-miles">
                {totalMiles.toFixed(1)}
              </div>
              <div className="text-sm text-muted-foreground">Miles</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent" data-testid="today-expenses">
                ${totalExpenses.toFixed(2)}
              </div>
              <div className="text-sm text-muted-foreground">Expenses</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Routes completed:</span>
              <span className="font-medium" data-testid="today-routes">{todayTrips.length}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Trip Card */}
      {activeTrip && (
        <Card data-testid="current-trip">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Current Trip</h3>
              <Badge variant="default" className="bg-accent text-accent-foreground">
                Active
              </Badge>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Started:</span>
                <span className="font-medium">
                  {new Date(activeTrip.startTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Distance:</span>
                <span className="font-medium">{(activeTrip.distance || 0).toFixed(1)} mi</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration:</span>
                <span className="font-medium">
                  {activeTrip.startTime ? 
                    Math.floor((Date.now() - new Date(activeTrip.startTime).getTime()) / 60000) + 'm' 
                    : '0m'
                  }
                </span>
              </div>
            </div>
            <Button 
              variant="destructive" 
              className="w-full mt-4"
              data-testid="stop-trip"
            >
              <Clock className="w-4 h-4 mr-2" />
              Stop Trip
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent Routes */}
      <Card data-testid="recent-routes">
        <CardContent className="p-0">
          <div className="p-6 border-b border-border">
            <h3 className="text-lg font-semibold">Recent Routes</h3>
          </div>
          <div className="divide-y divide-border">
            {trips.slice(0, 3).map((trip) => (
              <div key={trip.id} className="p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    {trip.purpose} Trip
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(trip.startTime).toLocaleDateString()} • {(trip.distance || 0).toFixed(1)} mi
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    {((trip.distance || 0) * 0.655).toFixed(2)}
                  </div>
                  <div className="text-sm text-muted-foreground">Mileage</div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-border space-y-2">
            <Button variant="ghost" className="w-full" data-testid="view-all-routes">
              View All Routes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
