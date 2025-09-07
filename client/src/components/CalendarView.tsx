import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, momentLocalizer, View } from "react-big-calendar";
import moment from "moment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, TrendingUp, MapPin, DollarSign, Upload, FileUp, BarChart3, PieChart, Activity, Download } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import "react-big-calendar/lib/css/react-big-calendar.css";

// Enhanced color palette for better visual design
const COLORS = {
  primary: '#3b82f6',
  secondary: '#06b6d4',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  trip: '#8b5cf6',
  hotel: '#f97316',
  muted: '#64748b'
};

const localizer = momentLocalizer(moment);

interface ScheduleEntry {
  id: string;
  date: string;
  startAddress: string;
  endAddress: string;
  notes: string;
  calculatedDistance?: number;
  calculatedAmount?: number;
  isHotelStay?: boolean;
  processingStatus: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: ScheduleEntry;
}

export function CalendarView() {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [view, setView] = useState<View>('month');
  const [activeTab, setActiveTab] = useState<'calendar' | 'import'>('calendar');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: scheduleData = [] } = useQuery<ScheduleEntry[]>({
    queryKey: ["/api/schedule"],
  });

  const { data: trips = [] } = useQuery<any[]>({
    queryKey: ["/api/trips"],
  });

  const { data: analytics = {} } = useQuery<{
    totalDistance?: number;
    totalAmount?: number; 
    tripDays?: number;
    avgDailyDistance?: number;
    monthlyTrends?: Array<{
      month: string;
      distance: number;
      amount: number;
      days: number;
      avgDistance: number;
    }>;
  }>({
    queryKey: ["/api/analytics"],
  });

  // Convert schedule entries to calendar events
  const scheduleEvents: CalendarEvent[] = scheduleData.map(entry => ({
    id: entry.id,
    title: `${entry.calculatedDistance?.toFixed(1) || 0} mi - $${entry.calculatedAmount?.toFixed(2) || '0.00'}`,
    start: new Date(entry.date),
    end: new Date(entry.date),
    resource: entry
  }));

  // Convert trip data to calendar events if no schedule data exists
  const tripEvents: CalendarEvent[] = scheduleData.length === 0 ? trips.map(trip => ({
    id: `trip-${trip.id}`,
    title: `${trip.purpose} Trip - ${trip.distance?.toFixed(1) || 0} mi`,
    start: new Date(trip.startTime),
    end: new Date(trip.endTime || trip.startTime),
    resource: {
      id: trip.id,
      date: trip.startTime,
      startAddress: trip.startLocation || 'Unknown',
      endAddress: trip.endLocation || 'Unknown', 
      notes: `${trip.purpose} trip`,
      calculatedDistance: trip.distance,
      calculatedAmount: (trip.distance || 0) * 0.655,
      isHotelStay: false,
      processingStatus: 'completed'
    }
  })) : [];

  // Combine events
  const events = [...scheduleEvents, ...tripEvents];

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    const isHotelStay = event.resource.isHotelStay;
    const isTripEvent = event.id.startsWith('trip-');
    return {
      style: {
        backgroundColor: isHotelStay ? '#f59e0b' : isTripEvent ? '#10b981' : '#3b82f6',
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block'
      }
    };
  };

  // File upload and processing mutations
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('schedule', file);
      const response = await fetch('/api/schedule/import', {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setImportData(data);
    }
  });

  const processMutation = useMutation({
    mutationFn: async (processData: any) => {
      return await apiRequest("POST", "/api/schedule/process", processData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
      setImportData(null);
      setUploadedFile(null);
      setActiveTab('calendar');
    }
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      uploadMutation.mutate(file);
    }
  };

  const handleProcessSchedule = () => {
    if (importData && uploadedFile) {
      // Calculate file hash for redundancy checking
      const reader = new FileReader();
      reader.onload = function(e) {
        const content = e.target?.result as string;
        const hash = btoa(content).substring(0, 32); // Simple hash for demo
        
        processMutation.mutate({
          data: importData.data,
          headerMapping: importData.headerMapping,
          mileageRate: 0.655,
          fileHash: hash,
          fileName: uploadedFile.name
        });
      };
      reader.readAsText(uploadedFile);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as 'calendar' | 'import');
    // Scroll to top when changing tabs
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="w-full max-w-full overflow-hidden" data-testid="calendar-view">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 border-b">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
            <TabsTrigger value="calendar" className="text-sm">Calendar & Analytics</TabsTrigger>
            <TabsTrigger value="import" className="text-sm">Import Schedule</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="calendar" className="p-4 space-y-6 w-full max-w-full overflow-hidden">
          {/* Analytics Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MapPin className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">Total Miles</span>
            </div>
            <div className="mt-3">
              <div className="text-3xl font-bold text-gray-900">
                {analytics?.totalDistance?.toFixed(1) || '0.0'}
                <span className="text-lg text-muted-foreground ml-1">miles</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">Total Expenses</span>
            </div>
            <div className="mt-3">
              <div className="text-3xl font-bold text-gray-900">
                ${analytics?.totalAmount?.toFixed(2) || '0.00'}
              </div>
              <div className="text-xs text-green-600 mt-1">@$0.655/mile</div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <CalendarIcon className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">Trip Days</span>
            </div>
            <div className="mt-3">
              <div className="text-3xl font-bold text-gray-900">
                {analytics?.tripDays || 0}
                <span className="text-lg text-muted-foreground ml-1">days</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-orange-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">Avg Daily Miles</span>
            </div>
            <div className="mt-3">
              <div className="text-3xl font-bold text-gray-900">
                {analytics?.avgDailyDistance?.toFixed(1) || '0.0'}
                <span className="text-lg text-muted-foreground ml-1">mi/day</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Data Visualizations Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Monthly Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics?.monthlyTrends?.slice(0, 6).map((month, idx) => (
                <div key={month.month} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                    <span className="text-sm font-medium">{moment(month.month).format('MMM YYYY')}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{month.distance.toFixed(0)} mi</div>
                    <div className="text-xs text-muted-foreground">${month.amount.toFixed(0)}</div>
                  </div>
                </div>
              )) || (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No travel data available yet. Import your schedule to see trends.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-600" />
              Trip Efficiency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Cost per Mile</span>
                <span className="font-semibold">$0.655</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total API Calls</span>
                <Badge variant="secondary" className="text-xs">
                  {0} calls
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Avg Trip Length</span>
                <span className="font-semibold">
                  {(analytics?.tripDays || 0) > 0 && analytics?.totalDistance ? (analytics.totalDistance / (analytics.tripDays || 1)).toFixed(1) : '0.0'} mi
                </span>
              </div>
              <div className="pt-2 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-green-700">Efficiency Score</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full" 
                        style={{width: `${Math.min(85, 60 + (analytics?.avgDailyDistance || 0) / 10)}%`}}
                      ></div>
                    </div>
                    <span className="text-sm font-semibold text-green-700">
                      {Math.min(85, 60 + Math.round((analytics?.avgDailyDistance || 0) / 10))}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
        <div className="flex gap-2">
          <Button 
            variant={view === 'agenda' ? 'default' : 'outline'} 
            onClick={() => setView('agenda')}
            data-testid="year-view-btn"
          >
            Year
          </Button>
          <Button 
            variant={view === 'month' ? 'default' : 'outline'} 
            onClick={() => setView('month')}
            data-testid="month-view-btn"
          >
            Month
          </Button>
          <Button 
            variant={view === 'week' ? 'default' : 'outline'} 
            onClick={() => setView('week')}
            data-testid="week-view-btn"
          >
            Week
          </Button>
          <Button 
            variant={view === 'day' ? 'default' : 'outline'} 
            onClick={() => setView('day')}
            data-testid="day-view-btn"
          >
            Day
          </Button>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 text-sm w-full">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS.trip}}></div>
              <span>Business Trips</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS.hotel}}></div>
              <span>Hotel Stays</span>
            </div>
            {scheduleData.length === 0 && trips.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>Tracked Routes</span>
              </div>
            )}
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={async () => {
              try {
                console.log('Starting schedule export...');
                const response = await fetch('/api/export/schedule', {
                  method: 'GET',
                  credentials: 'include',
                  headers: {
                    'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                  }
                });
                
                console.log('Export response status:', response.status);
                
                if (!response.ok) {
                  throw new Error(`Export failed with status ${response.status}`);
                }
                
                const blob = await response.blob();
                console.log('Blob created, size:', blob.size, 'type:', blob.type);
                
                if (blob.size === 0) {
                  throw new Error('Received empty file');
                }
                
                // Create download link and trigger immediately
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `route-rover-schedule-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
                
                // Force download by adding to DOM and clicking
                document.body.appendChild(link);
                link.click();
                
                // Clean up immediately
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                
                console.log('Export completed successfully');
              } catch (error) {
                console.error('Export failed:', error);
                alert(`Failed to export schedule data: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            }}
            data-testid="export-schedule"
            className="w-full sm:w-auto"
          >
            <Download className="w-4 h-4 mr-2" />
            Export IRS Report
          </Button>
        </div>
      </div>

      {/* Enhanced Calendar */}
      <Card className="border-0 shadow-lg bg-white w-full overflow-hidden">
        <CardContent className="p-0">
          <div className="h-[600px] w-full rounded-lg overflow-hidden">
            <style>{`
              .rbc-calendar {
                background: white;
                font-family: inherit;
              }
              .rbc-month-view {
                border: none;
              }
              .rbc-header {
                background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                border: none;
                border-bottom: 1px solid #e5e7eb;
                padding: 12px 8px;
                font-weight: 600;
                font-size: 14px;
                color: #374151;
              }
              .rbc-date-cell {
                padding: 8px 12px;
                border: none;
                border-bottom: 1px solid #f1f5f9;
                font-weight: 500;
                color: #6b7280;
              }
              .rbc-today {
                background-color: #eff6ff;
              }
              .rbc-off-range-bg {
                background-color: #f9fafb;
              }
              .rbc-event {
                border-radius: 6px;
                padding: 4px 8px;
                font-size: 12px;
                font-weight: 500;
                border: none;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                transition: all 0.2s ease;
              }
              .rbc-event:hover {
                transform: translateY(-1px);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
              }
              .rbc-selected {
                outline: 2px solid #3b82f6;
                outline-offset: 2px;
              }
            `}</style>
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              view={view}
              onView={(newView: View) => setView(newView)}
              onSelectEvent={handleSelectEvent}
              eventPropGetter={(event) => {
                const isHotel = event.resource?.isHotelStay || event.resource?.notes?.toLowerCase().includes('hotel');
                return {
                  style: {
                    backgroundColor: isHotel ? COLORS.hotel : COLORS.trip,
                    borderColor: isHotel ? '#ea580c' : '#2563eb',
                    color: 'white',
                    borderRadius: '6px',
                    border: 'none',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                    transition: 'all 0.2s ease'
                  }
                };
              }}
              dayPropGetter={(date) => {
                const today = new Date();
                const isToday = date.toDateString() === today.toDateString();
                return {
                  style: {
                    backgroundColor: isToday ? '#eff6ff' : 'transparent',
                  }
                };
              }}
              style={{ height: '100%', width: '100%', maxWidth: '100%' }}
              data-testid="calendar-component"
            />
          </div>
        </CardContent>
      </Card>

      {/* Selected Event Details */}
      {selectedEvent && (
        <Card data-testid="event-details">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Trip Details</h3>
              {selectedEvent.resource.isHotelStay && (
                <Badge variant="secondary">Hotel Stay</Badge>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Date</label>
                <p>{moment(selectedEvent.start).format('MMMM DD, YYYY')}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Distance</label>
                <p>{selectedEvent.resource.calculatedDistance?.toFixed(1) || '0'} miles</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Amount</label>
                <p>${selectedEvent.resource.calculatedAmount?.toFixed(2) || '0.00'}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <Badge variant={selectedEvent.resource.processingStatus === 'calculated' ? 'default' : 'destructive'}>
                  {selectedEvent.resource.processingStatus}
                </Badge>
              </div>
              
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-muted-foreground">Route</label>
                <p className="text-sm">
                  <span className="font-medium">From:</span> {selectedEvent.resource.startAddress}
                  <br />
                  <span className="font-medium">To:</span> {selectedEvent.resource.endAddress}
                </p>
              </div>
              
              {selectedEvent.resource.notes && (
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Notes</label>
                  <p className="text-sm">{selectedEvent.resource.notes}</p>
                </div>
              )}
            </div>
            
            <Button 
              variant="outline" 
              onClick={() => setSelectedEvent(null)}
              className="mt-4"
              data-testid="close-event-details"
            >
              Close
            </Button>
          </CardContent>
        </Card>
      )}
        </TabsContent>
        
        <TabsContent value="import" className="p-4 space-y-6 w-full max-w-full overflow-hidden">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Import Schedule File</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload Excel or CSV files with your schedule data. The system will automatically detect existing data to prevent duplicate processing.
                  </p>
                </div>
                
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <FileUp className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <div>
                    <label htmlFor="schedule-upload" className="cursor-pointer">
                      <Button variant="outline" asChild>
                        <span>
                          <Upload className="w-4 h-4 mr-2" />
                          Choose File
                        </span>
                      </Button>
                    </label>
                    <input
                      id="schedule-upload"
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      className="hidden"
                      data-testid="schedule-file-input"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Supports Excel (.xlsx, .xls) and CSV (.csv) files
                  </p>
                </div>

                {uploadedFile && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="font-medium">File uploaded: {uploadedFile.name}</p>
                  </div>
                )}

                {uploadMutation.isPending && (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">Processing file...</p>
                  </div>
                )}

                {importData && (
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2">File Preview</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Found {importData.totalRows} entries. Review the detected columns:
                      </p>
                      
                      <div className="space-y-2 text-sm">
                        <div><strong>Date Column:</strong> {importData.headerMapping.date || 'Not detected'}</div>
                        <div><strong>Start Address:</strong> {importData.headerMapping.startAddress || 'Not detected'}</div>
                        <div><strong>Notes:</strong> {importData.headerMapping.notes || 'Not detected'}</div>
                      </div>
                      
                      <Button 
                        onClick={handleProcessSchedule}
                        disabled={processMutation.isPending}
                        className="w-full mt-4"
                        data-testid="process-schedule-btn"
                      >
                        {processMutation.isPending ? 'Processing...' : 'Process Schedule Data'}
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}