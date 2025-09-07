import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, momentLocalizer, View } from "react-big-calendar";
import moment from "moment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, TrendingUp, MapPin, DollarSign, Upload, FileUp, BarChart3, PieChart, Activity } from "lucide-react";
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

  const { data: analytics = {} } = useQuery<{
    totalDistance?: number;
    totalAmount?: number; 
    tripDays?: number;
    avgDailyDistance?: number;
  }>({
    queryKey: ["/api/analytics"],
  });

  // Convert schedule entries to calendar events
  const events: CalendarEvent[] = scheduleData.map(entry => ({
    id: entry.id,
    title: `${entry.calculatedDistance?.toFixed(1) || 0} mi - $${entry.calculatedAmount?.toFixed(2) || '0.00'}`,
    start: new Date(entry.date),
    end: new Date(entry.date),
    resource: entry
  }));

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    const isHotelStay = event.resource.isHotelStay;
    return {
      style: {
        backgroundColor: isHotelStay ? '#f59e0b' : '#3b82f6',
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

  return (
    <div className="p-4 space-y-6" data-testid="calendar-view">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'calendar' | 'import')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="calendar">Calendar & Analytics</TabsTrigger>
          <TabsTrigger value="import">Import Schedule</TabsTrigger>
        </TabsList>
        
        <TabsContent value="calendar" className="space-y-6">
          {/* Analytics Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  {analytics?.apiCallsMade || 0} calls
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Avg Trip Length</span>
                <span className="font-semibold">
                  {analytics?.tripDays > 0 ? (analytics.totalDistance / analytics.tripDays).toFixed(1) : '0.0'} mi
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
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
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
        
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS.trip}}></div>
            <span>Business Trips</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS.hotel}}></div>
            <span>Hotel Stays</span>
          </div>
        </div>
      </div>

      {/* Enhanced Calendar */}
      <Card className="border-0 shadow-lg bg-white">
        <CardContent className="p-0">
          <div style={{ height: '600px' }} className="rounded-lg overflow-hidden">
            <style jsx>{`
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
              style={{ height: '100%' }}
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
        
        <TabsContent value="import" className="space-y-6">
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