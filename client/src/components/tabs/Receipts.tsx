import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Eye } from "lucide-react";

export function ReceiptsTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { data: receipts = [] } = useQuery({
    queryKey: ["/api/receipts"],
  });

  const filteredReceipts = receipts.filter((receipt: any) => {
    const matchesSearch = !searchTerm || 
      receipt.ocrText?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      receipt.extractedData?.merchant?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDate = dateFilter === "all" || (() => {
      const receiptDate = new Date(receipt.uploadDate);
      const today = new Date();
      
      switch (dateFilter) {
        case "today":
          return receiptDate.toDateString() === today.toDateString();
        case "week":
          const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          return receiptDate >= weekAgo;
        case "month":
          const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
          return receiptDate >= monthAgo;
        default:
          return true;
      }
    })();
    
    return matchesSearch && matchesDate;
  });

  return (
    <div className="p-4 space-y-6" data-testid="receipts-tab">
      {/* Search and Filter */}
      <Card data-testid="receipt-search-filter">
        <CardContent className="pt-4">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search receipts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="receipt-search"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger data-testid="date-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger data-testid="category-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="gas">Gas</SelectItem>
                  <SelectItem value="parking">Parking</SelectItem>
                  <SelectItem value="meals">Meals</SelectItem>
                  <SelectItem value="lodging">Lodging</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Receipt Gallery */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Receipt Gallery</h3>
          <span className="text-sm text-muted-foreground" data-testid="receipt-count">
            {filteredReceipts.length} receipts
          </span>
        </div>
        
        {filteredReceipts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" data-testid="receipt-grid">
            {filteredReceipts.map((receipt: any) => (
              <Card key={receipt.id} className="overflow-hidden shadow-sm">
                <div className="aspect-[3/4] bg-muted relative">
                  {receipt.imageUrl ? (
                    <img 
                      src={receipt.imageUrl} 
                      alt="Receipt scan" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-muted-foreground text-xs">No Image</div>
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute top-2 right-2 p-2"
                    data-testid={`view-receipt-${receipt.id}`}
                  >
                    <Eye className="w-3 h-3" />
                  </Button>
                </div>
                <CardContent className="p-2">
                  <div className="text-xs font-medium truncate">
                    {receipt.extractedData?.merchant || 'Unknown Merchant'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ${receipt.extractedData?.amount?.toFixed(2) || '0.00'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(receipt.uploadDate).toLocaleDateString()}
                  </div>
                  {receipt.extractedData && (
                    <Badge variant="secondary" className="text-xs mt-1">
                      OCR Processed
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-muted-foreground mb-4">
              {searchTerm || dateFilter !== "all" || categoryFilter !== "all" 
                ? "No receipts match your filters" 
                : "No receipts uploaded yet"
              }
            </div>
            {(!searchTerm && dateFilter === "all" && categoryFilter === "all") && (
              <Button variant="outline" data-testid="upload-first-receipt">
                Upload Your First Receipt
              </Button>
            )}
          </div>
        )}
        
        {filteredReceipts.length > 0 && (
          <Button 
            variant="outline" 
            className="w-full" 
            data-testid="load-more-receipts"
          >
            Load More Receipts
          </Button>
        )}
      </div>
    </div>
  );
}
