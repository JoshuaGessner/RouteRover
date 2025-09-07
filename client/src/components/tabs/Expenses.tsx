import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, Camera, Image, Fuel, Utensils, Car } from "lucide-react";
import { useCamera } from "@/hooks/useCamera";
import { apiRequest } from "@/lib/queryClient";
import type { Expense } from "@shared/schema";

export function ExpensesTab() {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("gas");
  const [merchant, setMerchant] = useState("");
  const [notes, setNotes] = useState("");
  
  const queryClient = useQueryClient();
  const { captureImage, selectFromGallery, isCapturing, error: cameraError } = useCamera();

  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const createExpenseMutation = useMutation({
    mutationFn: async (expenseData: any) => {
      const response = await apiRequest("POST", "/api/expenses", expenseData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setAmount("");
      setMerchant("");
      setNotes("");
    },
  });

  const handleSaveExpense = () => {
    if (!amount || !category) return;
    
    createExpenseMutation.mutate({
      amount: parseFloat(amount),
      category,
      merchant,
      notes,
      date: new Date(),
    });
  };

  const handleCaptureReceipt = async () => {
    try {
      const imageFile = await captureImage();
      if (imageFile) {
        await uploadReceipt(imageFile);
      }
    } catch (error) {
      console.error('Failed to capture receipt:', error);
    }
  };

  const handleGallerySelect = async () => {
    try {
      const imageFile = await selectFromGallery();
      if (imageFile) {
        await uploadReceipt(imageFile);
      }
    } catch (error) {
      console.error('Failed to select from gallery:', error);
    }
  };

  const uploadReceipt = async (imageFile: File) => {
    const formData = new FormData();
    formData.append('image', imageFile);
    
    const response = await fetch('/api/receipts', {
      method: 'POST',
      body: formData,
    });
    
    if (response.ok) {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
    } else {
      throw new Error('Upload failed');
    }
  };

  const getCategoryIcon = (categoryName: string) => {
    switch (categoryName) {
      case 'gas':
        return <Fuel className="w-5 h-5" />;
      case 'meals':
        return <Utensils className="w-5 h-5" />;
      case 'parking':
        return <Car className="w-5 h-5" />;
      default:
        return <div className="w-5 h-5 bg-muted rounded" />;
    }
  };

  return (
    <div className="p-4 space-y-6" data-testid="expenses-tab">
      {/* Quick Expense Entry */}
      <Card data-testid="quick-expense-entry">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">Quick Expense Entry</h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  data-testid="expense-amount"
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger data-testid="expense-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gas">Gas</SelectItem>
                    <SelectItem value="parking">Parking</SelectItem>
                    <SelectItem value="tolls">Tolls</SelectItem>
                    <SelectItem value="meals">Meals</SelectItem>
                    <SelectItem value="lodging">Lodging</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label className="text-sm font-medium mb-2 block">Merchant</Label>
              <Input
                placeholder="Enter merchant name"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                data-testid="expense-merchant"
              />
            </div>
            
            <div>
              <Label className="text-sm font-medium mb-2 block">Notes</Label>
              <Textarea
                placeholder="Add expense notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-20 resize-none"
                data-testid="expense-notes"
              />
            </div>
            
            <Button 
              className="w-full"
              onClick={handleSaveExpense}
              disabled={!amount || createExpenseMutation.isPending}
              data-testid="save-expense"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Expense
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Receipt Capture */}
      <Card data-testid="receipt-capture">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">Receipt Capture</h3>
          
          <div className="text-center space-y-4">
            <div className="w-full h-40 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-muted/50">
              <div className="text-center">
                <Camera className="w-12 h-12 text-muted-foreground mb-2 mx-auto" />
                <p className="text-sm text-muted-foreground">Tap to capture receipt</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={handleCaptureReceipt}
                disabled={isCapturing}
                data-testid="capture-receipt"
              >
                <Camera className="w-4 h-4 mr-2" />
                Camera
              </Button>
              <Button
                variant="secondary"
                disabled={isCapturing}
                onClick={handleGallerySelect}
                data-testid="select-from-gallery"
              >
                <Image className="w-4 h-4 mr-2" />
                Gallery
              </Button>
            </div>
            
            {cameraError && (
              <p className="text-xs text-destructive mb-2">
                Camera Error: {cameraError}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              OCR will automatically extract merchant, date, amount, and tax information
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Recent Expenses */}
      <Card data-testid="recent-expenses">
        <CardContent className="p-0">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <h3 className="text-lg font-semibold">Recent Expenses</h3>
            <Button variant="ghost" size="sm" data-testid="view-all-expenses">
              View All
            </Button>
          </div>
          <div className="divide-y divide-border">
            {expenses.slice(0, 5).map((expense) => (
              <div key={expense.id} className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                  {getCategoryIcon(expense.category)}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{expense.merchant || 'Unknown Merchant'}</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(expense.date).toLocaleDateString()} • {expense.category}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">${expense.amount.toFixed(2)}</div>
                  {expense.receiptId && (
                    <Badge variant="secondary" className="text-xs mt-1">
                      Receipt
                    </Badge>
                  )}
                </div>
              </div>
            ))}
            {expenses.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                No expenses recorded yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
