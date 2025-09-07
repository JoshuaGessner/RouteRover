import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, Table, CheckCircle, AlertCircle, Bed, MapPin } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { ScheduleEntry, AppSettings } from "@shared/schema";

export function ScheduleTab() {
  const [file, setFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);

  const queryClient = useQueryClient();

  const { data: scheduleEntries = [] } = useQuery<ScheduleEntry[]>({
    queryKey: ["/api/schedule"],
  });

  const { data: settings } = useQuery<AppSettings | null>({
    queryKey: ["/api/settings"],
  });

  const importMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/schedule/import", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Import failed");
      return response.json();
    },
    onSuccess: (data) => {
      setImportData(data);
    },
  });

  const processMutation = useMutation({
    mutationFn: async (processData: any) => {
      const response = await apiRequest("POST", "/api/schedule/process", processData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      setImportData(null);
      setFile(null);
      setProcessing(false);
      setProcessProgress(0);
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const formData = new FormData();
      formData.append('file', selectedFile);
      importMutation.mutate(formData);
    }
  };

  const handleProcessSchedule = () => {
    if (!importData) return;
    
    setProcessing(true);
    
    // Simulate processing progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setProcessProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
      }
    }, 200);

    processMutation.mutate({
      data: importData.data,
      headerMapping: importData.headerMapping,
      mileageRate: settings?.mileageRate || 0.655,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'calculated':
        return <CheckCircle className="w-4 h-4 text-accent" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return <div className="w-4 h-4 bg-muted rounded-full" />;
    }
  };

  const getStatusBadge = (entry: any) => {
    if (entry.isHotelStay) {
      return <Badge variant="secondary" className="bg-accent/10 text-accent">Hotel Stay</Badge>;
    }
    if (entry.processingStatus === 'calculated') {
      return <Badge variant="secondary" className="bg-accent/10 text-accent">Calculated</Badge>;
    }
    if (entry.processingStatus === 'error') {
      return <Badge variant="destructive">Error</Badge>;
    }
    return <Badge variant="outline">Pending</Badge>;
  };

  return (
    <div className="p-4 space-y-6" data-testid="schedule-tab">
      {/* File Import */}
      <Card data-testid="file-import">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">Import Schedule</h3>
          
          <div className="space-y-4">
            <div className="w-full h-32 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-muted/50 relative">
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.txt"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                data-testid="file-input"
              />
              <div className="text-center">
                <Upload className="w-8 h-8 text-muted-foreground mb-2 mx-auto" />
                <p className="text-sm text-muted-foreground">Drop CSV, Excel, or TXT files here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-3 border border-border rounded-lg">
                <FileText className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                <div className="text-xs font-medium">CSV</div>
              </div>
              <div className="text-center p-3 border border-border rounded-lg">
                <Table className="w-6 h-6 text-green-600 mx-auto mb-1" />
                <div className="text-xs font-medium">Excel</div>
              </div>
              <div className="text-center p-3 border border-border rounded-lg">
                <FileText className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                <div className="text-xs font-medium">TXT</div>
              </div>
            </div>

            {file && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm font-medium">{file.name}</div>
                <div className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Processing Status */}
      {(importData || processing) && (
        <Card data-testid="processing-status">
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Processing Status</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Header Detection</span>
                <CheckCircle className="w-5 h-5 text-accent" />
              </div>
              
              {processing && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">Route Calculations</span>
                    <span className="text-sm text-muted-foreground">
                      {processProgress}%
                    </span>
                  </div>
                  <Progress value={processProgress} className="w-full" />
                </div>
              )}
              
              {importData && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Detected Columns:</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(importData.headerMapping).map(([key, value]: [string, any]) => (
                      <Badge key={key} variant="secondary" className="bg-primary/10 text-primary">
                        {key}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {importData.totalRows} rows detected
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule Preview */}
      <Card data-testid="schedule-preview">
        <CardContent className="p-0">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <h3 className="text-lg font-semibold">Schedule Preview</h3>
            {importData && !processing && (
              <Button 
                onClick={handleProcessSchedule}
                disabled={processMutation.isPending}
                data-testid="process-schedule"
              >
                Process Schedule
              </Button>
            )}
          </div>
          <div className="divide-y divide-border">
            {scheduleEntries.length > 0 ? (
              scheduleEntries.slice(0, 10).map((entry) => (
                <div key={entry.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">
                      {new Date(entry.date).toLocaleDateString()}
                    </span>
                    {getStatusBadge(entry)}
                  </div>
                  <div className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                    {entry.isHotelStay ? (
                      <Bed className="w-4 h-4" />
                    ) : (
                      <MapPin className="w-4 h-4" />
                    )}
                    {entry.startAddress} → {entry.endAddress}
                  </div>
                  {entry.processingStatus === 'calculated' && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Distance: {entry.calculatedDistance?.toFixed(1)} mi
                      </span>
                      <span className="font-medium">
                        ${entry.calculatedAmount?.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {entry.processingStatus === 'error' && (
                    <div className="text-xs text-destructive mt-1">
                      Error: {entry.errorMessage}
                    </div>
                  )}
                  {entry.notes && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Note: {entry.notes}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                No schedule entries yet. Import a file to get started.
              </div>
            )}
          </div>
          {scheduleEntries.length > 0 && (
            <div className="p-4 border-t border-border">
              <Button 
                variant="outline" 
                className="w-full"
                data-testid="save-schedule"
              >
                Save Processed Schedule
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
