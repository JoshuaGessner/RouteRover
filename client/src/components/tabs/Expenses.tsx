import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, Camera, Image, Fuel, Utensils, Car, Eye, Edit2, Trash2, X } from "lucide-react";
import { useCamera } from "@/hooks/useCamera";
import { apiRequest } from "@/lib/queryClient";
import type { Expense } from "@shared/schema";

export function ExpensesTab() {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("gas");
  const [merchant, setMerchant] = useState("");
  const [notes, setNotes] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<any>(null);
  const [editMerchant, setEditMerchant] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editExpenseAmount, setEditExpenseAmount] = useState("");
  const [editExpenseCategory, setEditExpenseCategory] = useState("");
  const [editExpenseMerchant, setEditExpenseMerchant] = useState("");
  const [editExpenseNotes, setEditExpenseNotes] = useState("");
  
  const queryClient = useQueryClient();
  const { captureImage, selectFromGallery, isCapturing, error: cameraError } = useCamera();

  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: receipts = [] } = useQuery<any[]>({
    queryKey: ["/api/receipts"],
  });

  const deleteReceiptMutation = useMutation({
    mutationFn: async (receiptId: string) => {
      const response = await fetch(`/api/receipts/${receiptId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Delete failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
    },
  });

  const updateReceiptMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const response = await fetch(`/api/receipts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extractedData: updates }),
      });
      if (!response.ok) throw new Error('Update failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      setEditingReceipt(null);
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: async (expenseData: any) => {
      const response = await apiRequest("POST", "/api/expenses", expenseData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setAmount("");
      setCategory("");
      setMerchant("");
      setNotes("");
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const response = await apiRequest("PATCH", `/api/expenses/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setEditingExpense(null);
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      const response = await apiRequest("DELETE", `/api/expenses/${expenseId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
    },
  });

  const handleSaveExpense = () => {
    if (!amount || !category) return;
    
    createExpenseMutation.mutate({
      amount: parseFloat(amount),
      category,
      merchant: merchant || null,
      notes: notes || null,
      date: new Date().toISOString(),
    });
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setEditExpenseAmount(expense.amount.toString());
    setEditExpenseCategory(expense.category);
    setEditExpenseMerchant(expense.merchant || "");
    setEditExpenseNotes(expense.notes || "");
  };

  const handleUpdateExpense = () => {
    if (!editingExpense || !editExpenseAmount || !editExpenseCategory) return;
    
    updateExpenseMutation.mutate({
      id: editingExpense.id,
      updates: {
        amount: parseFloat(editExpenseAmount),
        category: editExpenseCategory,
        merchant: editExpenseMerchant || null,
        notes: editExpenseNotes || null,
      }
    });
  };

  const handleDeleteExpense = (expenseId: string) => {
    if (confirm('Are you sure you want to delete this expense?')) {
      deleteExpenseMutation.mutate(expenseId);
    }
  };

  const handleCancelEdit = () => {
    setEditingExpense(null);
    setEditExpenseAmount("");
    setEditExpenseCategory("");
    setEditExpenseMerchant("");
    setEditExpenseNotes("");
  };

  const handleCaptureReceipt = async () => {
    try {
      // Check if camera permission is granted, request if not
      if (navigator.permissions) {
        const cameraStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
        if (cameraStatus.state === 'denied') {
          alert('Camera access is denied. Please enable camera permissions in your browser settings to capture receipts.');
          return;
        }
        if (cameraStatus.state === 'prompt') {
          // The camera request will prompt automatically
        }
      }
      
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
    setIsUploading(true);
    setUploadSuccess(false);
    
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      
      const response = await fetch('/api/receipts', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const receiptData = await response.json();
        
        // Pre-fill expense form with extracted OCR data
        if (receiptData.extractedData) {
          if (receiptData.extractedData.amount) {
            setAmount(receiptData.extractedData.amount.toString());
          }
          if (receiptData.extractedData.merchant) {
            setMerchant(receiptData.extractedData.merchant);
          }
        }
        
        queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
        setUploadSuccess(true);
        
        // Clear success message after 5 seconds
        setTimeout(() => setUploadSuccess(false), 5000);
      } else {
        throw new Error('Upload failed');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleEditReceipt = (receipt: any) => {
    setEditingReceipt(receipt);
    setEditMerchant(receipt.extractedData?.merchant || "");
    setEditAmount(receipt.extractedData?.amount?.toString() || "");
  };

  const handleSaveEdit = () => {
    if (editingReceipt) {
      updateReceiptMutation.mutate({
        id: editingReceipt.id,
        updates: {
          ...editingReceipt.extractedData,
          merchant: editMerchant,
          amount: parseFloat(editAmount) || 0,
        },
      });
    }
  };

  const handleDeleteReceipt = (receiptId: string) => {
    if (confirm('Are you sure you want to delete this receipt?')) {
      deleteReceiptMutation.mutate(receiptId);
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
              disabled={!amount || !category || createExpenseMutation.isPending}
              data-testid="save-expense"
            >
              <Save className="w-4 h-4 mr-2" />
              {createExpenseMutation.isPending ? 'Saving...' : 'Save Expense'}
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
                disabled={isCapturing || isUploading}
                data-testid="capture-receipt"
              >
                <Camera className="w-4 h-4 mr-2" />
                {isCapturing ? 'Taking Photo...' : 'Camera'}
              </Button>
              <Button
                variant="secondary"
                disabled={isCapturing || isUploading}
                onClick={handleGallerySelect}
                data-testid="select-from-gallery"
              >
                <Image className="w-4 h-4 mr-2" />
                Gallery
              </Button>
            </div>
            
            {/* Upload Status Messages */}
            {isUploading && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <p className="text-sm text-blue-800 font-medium">Processing receipt...</p>
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  OCR scanning in progress. This may take 15-30 seconds.
                </p>
              </div>
            )}
            
            {uploadSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800 font-medium">✓ Receipt processed successfully!</p>
                <p className="text-xs text-green-600 mt-1">
                  Form has been pre-filled with extracted data. Check the Expenses tab to see your receipt.
                </p>
              </div>
            )}
            
            {cameraError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800 font-medium">Camera Error</p>
                <p className="text-xs text-red-600">{cameraError}</p>
              </div>
            )}
            
            <p className="text-xs text-muted-foreground">
              OCR will automatically extract merchant, date, amount, and tax information
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Recent Receipts */}
      {receipts.length > 0 && (
        <Card data-testid="recent-receipts">
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Recent Receipts</h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {receipts.slice(0, 6).map((receipt: any) => (
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
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="p-1.5"
                        onClick={() => handleEditReceipt(receipt)}
                        data-testid={`edit-receipt-${receipt.id}`}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="p-1.5"
                        onClick={() => handleDeleteReceipt(receipt.id)}
                        data-testid={`delete-receipt-${receipt.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="p-2">
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
                  </div>
                </Card>
              ))}
            </div>
            
            {receipts.length > 6 && (
              <p className="text-sm text-muted-foreground mt-4 text-center">
                Showing 6 of {receipts.length} receipts. View all in the Receipts section.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Receipt Modal */}
      {editingReceipt && (
        <Card className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="edit-receipt-modal">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Receipt</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingReceipt(null)}
                data-testid="close-edit-modal"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Merchant</Label>
                <Input
                  value={editMerchant}
                  onChange={(e) => setEditMerchant(e.target.value)}
                  placeholder="Merchant name"
                  data-testid="edit-merchant-input"
                />
              </div>
              
              <div>
                <Label className="text-sm font-medium mb-2 block">Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  placeholder="0.00"
                  data-testid="edit-amount-input"
                />
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleSaveEdit}
                  disabled={updateReceiptMutation.isPending}
                  className="flex-1"
                  data-testid="save-receipt-edit"
                >
                  {updateReceiptMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setEditingReceipt(null)}
                  className="flex-1"
                  data-testid="cancel-receipt-edit"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Recent Expenses */}
      <Card data-testid="recent-expenses">
        <CardContent className="p-0">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <h3 className="text-lg font-semibold">Recent Expenses</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => window.location.hash = '#expenses'}
              data-testid="view-all-expenses"
            >
              View All
            </Button>
          </div>
          <div className="divide-y divide-border">
            {expenses.slice(0, 5).map((expense) => (
              <div key={expense.id} className="p-4">
                {editingExpense?.id === expense.id ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Amount</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editExpenseAmount}
                          onChange={(e) => setEditExpenseAmount(e.target.value)}
                          placeholder="0.00"
                          data-testid="edit-expense-amount"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Category</Label>
                        <Select value={editExpenseCategory} onValueChange={setEditExpenseCategory}>
                          <SelectTrigger data-testid="edit-expense-category">
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
                        value={editExpenseMerchant}
                        onChange={(e) => setEditExpenseMerchant(e.target.value)}
                        placeholder="Enter merchant name"
                        data-testid="edit-expense-merchant"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Notes</Label>
                      <Textarea
                        value={editExpenseNotes}
                        onChange={(e) => setEditExpenseNotes(e.target.value)}
                        placeholder="Add expense notes..."
                        className="h-20 resize-none"
                        data-testid="edit-expense-notes"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleUpdateExpense}
                        disabled={!editExpenseAmount || !editExpenseCategory || updateExpenseMutation.isPending}
                        className="flex-1"
                        data-testid="save-expense-edit"
                      >
                        {updateExpenseMutation.isPending ? 'Saving...' : 'Save Changes'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleCancelEdit}
                        className="flex-1"
                        data-testid="cancel-expense-edit"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                      {getCategoryIcon(expense.category)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{expense.merchant || 'Unknown Merchant'}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(expense.date).toLocaleDateString()} • {expense.category}
                        {expense.notes && <span> • {expense.notes}</span>}
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
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditExpense(expense)}
                        data-testid={`edit-expense-${expense.id}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="text-destructive hover:text-destructive"
                        data-testid={`delete-expense-${expense.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
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
