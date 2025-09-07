import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, momentLocalizer, View } from "react-big-calendar";
import moment from "moment";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, TrendingUp, MapPin, DollarSign, Upload, FileUp } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import "react-big-calendar/lib/css/react-big-calendar.css";

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
      if (!response.ok) throw new Error('Upload failed');
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
    if (importData) {
      processMutation.mutate({
        data: importData.data,
        headerMapping: importData.headerMapping,
        mileageRate: 0.655
      });
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
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium">Total Miles</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {analytics?.totalDistance?.toFixed(1) || '0.0'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium">Total Expenses</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              ${analytics?.totalAmount?.toFixed(2) || '0.00'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium">Trip Days</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {analytics?.tripDays || 0}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-medium">Avg Daily Miles</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {analytics?.avgDailyDistance?.toFixed(1) || '0.0'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* View Controls */}
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

      {/* Calendar */}
      <Card>
        <CardContent className="p-6">
          <div style={{ height: '600px' }}>
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              view={view}
              onView={(newView: View) => setView(newView)}
              onSelectEvent={handleSelectEvent}
              eventPropGetter={eventStyleGetter}
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