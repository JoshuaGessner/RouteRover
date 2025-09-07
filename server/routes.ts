import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { insertTripSchema, insertExpenseSchema, insertReceiptSchema, insertScheduleEntrySchema, insertAppSettingsSchema, insertErrorLogSchema } from "@shared/schema";
import multer from "multer";
import Tesseract from "tesseract.js";
import XLSX from "xlsx";
import { parse } from "csv-parse/sync";
import fs from "fs";
import path from "path";

// Extend Request interface for multer
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

const upload = multer({ 
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Google Directions API integration
async function calculateRoute(startAddress: string, endAddress: string, apiKey: string) {
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(startAddress)}&destination=${encodeURIComponent(endAddress)}&key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === "OK" && data.routes.length > 0) {
      const route = data.routes[0];
      const leg = route.legs[0];
      return {
        distance: leg.distance.value / 1609.34, // Convert meters to miles
        duration: leg.duration.value, // seconds
        startAddress: leg.start_address,
        endAddress: leg.end_address
      };
    } else {
      throw new Error(`Google Directions API error: ${data.status}`);
    }
  } catch (error) {
    throw new Error(`Failed to calculate route: ${error}`);
  }
}

// OCR processing
async function processReceiptOCR(imagePath: string) {
  const worker = await Tesseract.createWorker('eng');
  
  const { data: { text } } = await worker.recognize(imagePath);
  await worker.terminate();
  
  // Extract structured data from OCR text
  const extractedData = extractReceiptData(text);
  
  return {
    ocrText: text,
    extractedData
  };
}

function extractReceiptData(text: string) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  const data: any = {};
  
  // Extract amount (look for dollar signs and numbers)
  const amountMatch = text.match(/\$[\d,]+\.?\d{0,2}/g);
  if (amountMatch) {
    const amounts = amountMatch.map(a => parseFloat(a.replace(/[$,]/g, '')));
    data.amount = Math.max(...amounts); // Take the largest amount as the total
  }
  
  // Extract date
  const dateMatch = text.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/);
  if (dateMatch) {
    data.date = dateMatch[0];
  }
  
  // Extract merchant (usually one of the first few lines)
  if (lines.length > 0) {
    data.merchant = lines[0];
  }
  
  // Look for tax
  const taxMatch = text.match(/tax.*?\$?([\d,]+\.?\d{0,2})/i);
  if (taxMatch) {
    data.tax = parseFloat(taxMatch[1].replace(/,/g, ''));
  }
  
  return data;
}

// File parsing utilities
function parseScheduleFile(filePath: string, fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  
  if (ext === '.csv') {
    const content = fs.readFileSync(filePath, 'utf-8');
    return parse(content, { columns: true, skip_empty_lines: true });
  } else if (ext === '.xlsx' || ext === '.xls') {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(worksheet);
  } else if (ext === '.txt') {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Simple tab/comma separated parsing
    const headers = lines[0].split(/\t|,/).map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = line.split(/\t|,/).map(v => v.trim());
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      return obj;
    });
  }
  
  throw new Error('Unsupported file format');
}

function detectHeaders(data: any[]) {
  if (data.length === 0) return {};
  
  const firstRow = data[0];
  const headers = Object.keys(firstRow);
  
  const mapping: any = {};
  
  headers.forEach(header => {
    const lowerHeader = header.toLowerCase();
    
    // Date detection
    if (lowerHeader.includes('date') || lowerHeader.includes('day')) {
      mapping.date = header;
    }
    // Start address detection - more flexible patterns
    else if (
      (lowerHeader.includes('start') && (lowerHeader.includes('address') || lowerHeader.includes('location') || lowerHeader.includes('from'))) ||
      lowerHeader.includes('origin') ||
      lowerHeader.includes('departure') ||
      (lowerHeader.includes('from') && (lowerHeader.includes('address') || lowerHeader.includes('location'))) ||
      lowerHeader === 'start' ||
      lowerHeader === 'from'
    ) {
      mapping.startAddress = header;
    }
    // End address detection - more flexible patterns  
    else if (
      (lowerHeader.includes('end') && (lowerHeader.includes('address') || lowerHeader.includes('location') || lowerHeader.includes('to'))) ||
      lowerHeader.includes('destination') ||
      lowerHeader.includes('arrival') ||
      (lowerHeader.includes('to') && (lowerHeader.includes('address') || lowerHeader.includes('location'))) ||
      lowerHeader === 'end' ||
      lowerHeader === 'to' ||
      lowerHeader === 'destination'
    ) {
      mapping.endAddress = header;
    }
    // Generic address fields if no start/end found yet
    else if (!mapping.startAddress && (lowerHeader.includes('address') || lowerHeader.includes('location'))) {
      mapping.startAddress = header;
    }
    // Notes detection
    else if (lowerHeader.includes('note') || lowerHeader.includes('comment') || lowerHeader.includes('description')) {
      mapping.notes = header;
    }
  });
  
  return mapping;
}

function detectHotelStay(notes: string): boolean {
  if (!notes) return false;
  const lowerNotes = notes.toLowerCase();
  return lowerNotes.includes('hotel') || lowerNotes.includes('motel') || lowerNotes.includes('stay') || lowerNotes.includes('lodging');
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Helper function to get current user ID
  const getCurrentUserId = (req: any): string => {
    // Try multiple ways to get user ID for better compatibility
    if (req.user?.claims?.sub) {
      return req.user.claims.sub;
    }
    if (req.user?.id) {
      return req.user.id;
    }
    // If no user session, throw error instead of fallback
    throw new Error("User not authenticated - no valid user session found");
  };
  
  // Trips routes
  app.get("/api/trips", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const trips = await storage.getTrips(userId);
      res.json(trips);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch trips" });
    }
  });

  app.post("/api/trips", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const validatedData = insertTripSchema.parse({ ...req.body, userId });
      const trip = await storage.createTrip(validatedData);
      res.json(trip);
    } catch (error) {
      res.status(400).json({ message: "Invalid trip data" });
    }
  });

  app.patch("/api/trips/:id", async (req, res) => {
    try {
      const trip = await storage.updateTrip(req.params.id, req.body);
      if (!trip) {
        return res.status(404).json({ message: "Trip not found" });
      }
      res.json(trip);
    } catch (error) {
      res.status(500).json({ message: "Failed to update trip" });
    }
  });

  app.get("/api/trips/active", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const activeTrip = await storage.getActiveTrip(userId);
      res.json(activeTrip);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active trip" });
    }
  });

  // Expenses routes
  app.get("/api/expenses", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const expenses = await storage.getExpenses(userId);
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  app.post("/api/expenses", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const validatedData = insertExpenseSchema.parse({ ...req.body, userId });
      const expense = await storage.createExpense(validatedData);
      res.json(expense);
    } catch (error) {
      res.status(400).json({ message: "Invalid expense data" });
    }
  });

  // Receipts routes
  app.get("/api/receipts", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const receipts = await storage.getReceipts(userId);
      res.json(receipts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch receipts" });
    }
  });

  app.post("/api/receipts", upload.single('image'), async (req: MulterRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      const { ocrText, extractedData } = await processReceiptOCR(req.file.path);
      const userId = getCurrentUserId(req);
      
      const receiptData = insertReceiptSchema.parse({
        userId,
        imageUrl: `/uploads/${req.file.filename}`,
        ocrText,
        extractedData,
        uploadDate: new Date()
      });

      const receipt = await storage.createReceipt(receiptData);
      
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      
      res.json(receipt);
    } catch (error) {
      res.status(500).json({ message: "Failed to process receipt" });
    }
  });

  // Schedule routes
  app.get("/api/schedule", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const entries = await storage.getScheduleEntries(userId);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch schedule entries" });
    }
  });

  app.post("/api/schedule/import", upload.single('file'), async (req: MulterRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file provided" });
      }

      const parsedData = parseScheduleFile(req.file.path, req.file.originalname);
      const headerMapping = detectHeaders(parsedData);
      
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      
      res.json({
        data: parsedData,
        headerMapping,
        totalRows: parsedData.length
      });
    } catch (error) {
      console.error("Schedule import error:", error);
      // Clean up uploaded file if it exists
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanup) {
          console.error("Failed to cleanup file:", cleanup);
        }
      }
      res.status(500).json({ message: `Failed to parse schedule file: ${error.message}` });
    }
  });

  app.post("/api/schedule/process", async (req, res) => {
    try {
      const { data, headerMapping, mileageRate } = req.body;
      const userId = getCurrentUserId(req);
      
      const userSettings = await storage.getUserSettings(userId);
      const apiKey = userSettings?.googleApiKey;
      
      if (!apiKey) {
        return res.status(400).json({ message: "Google API key not configured" });
      }

      const results = [];
      
      for (const row of data) {
        try {
          const startAddress = row[headerMapping.startAddress];
          const endAddress = row[headerMapping.endAddress];
          const date = new Date(row[headerMapping.date]);
          const notes = row[headerMapping.notes] || '';
          
          const routeInfo = await calculateRoute(startAddress, endAddress, apiKey);
          const isHotelStay = detectHotelStay(notes);
          const calculatedAmount = routeInfo.distance * (mileageRate || 0.655);
          
          const entry = await storage.createScheduleEntry({
            userId,
            date,
            startAddress: routeInfo.startAddress,
            endAddress: routeInfo.endAddress,
            notes,
            calculatedDistance: routeInfo.distance,
            calculatedAmount,
            isHotelStay,
            processingStatus: 'calculated',
            originalData: row
          });
          
          results.push(entry);
        } catch (error) {
          const errorEntry = await storage.createScheduleEntry({
            userId,
            date: new Date(row[headerMapping.date]),
            startAddress: row[headerMapping.startAddress],
            endAddress: row[headerMapping.endAddress],
            notes: row[headerMapping.notes] || '',
            processingStatus: 'error',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            originalData: row
          });
          
          results.push(errorEntry);
          
          // Log error
          await storage.createErrorLog({
            userId,
            errorType: 'route_calculation',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            context: { startAddress: row[headerMapping.startAddress], endAddress: row[headerMapping.endAddress] },
            timestamp: new Date()
          });
        }
      }
      
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Failed to process schedule" });
    }
  });

  // Settings routes
  app.get("/api/settings", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const settings = await storage.getUserSettings(userId);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const validatedData = insertAppSettingsSchema.parse({ ...req.body, userId });
      const settings = await storage.createOrUpdateSettings(validatedData);
      res.json(settings);
    } catch (error) {
      res.status(400).json({ message: "Invalid settings data" });
    }
  });

  // Error logs route
  app.get("/api/error-logs", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const logs = await storage.getErrorLogs(userId);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch error logs" });
    }
  });

  // Export data route
  app.get("/api/export", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const trips = await storage.getTrips(userId);
      const expenses = await storage.getExpenses(userId);
      const receipts = await storage.getReceipts(userId);
      const schedule = await storage.getScheduleEntries(userId);
      
      const exportData = {
        trips,
        expenses,
        receipts,
        schedule,
        exportDate: new Date()
      };
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="miletracker-export.json"');
      res.json(exportData);
    } catch (error) {
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  // Data sharing routes
  app.post('/api/share/generate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const shareCode = 'SHARE' + Math.random().toString(36).substring(2, 15).toUpperCase();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      // Store share code with user data (simplified - in production use proper storage)
      res.json({ shareCode, expiresAt });
    } catch (error) {
      console.error('Error generating share code:', error);
      res.status(500).json({ message: 'Failed to generate share code' });
    }
  });

  app.post('/api/share/import', isAuthenticated, async (req: any, res) => {
    try {
      const { shareCode } = req.body;
      const userId = req.user.claims.sub;
      
      // In production, validate the share code and import shared data
      // For now, just return success
      res.json({ message: 'Data imported successfully', imported: 0 });
    } catch (error) {
      console.error('Error importing shared data:', error);
      res.status(500).json({ message: 'Failed to import shared data' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
