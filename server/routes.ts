import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTripSchema, insertExpenseSchema, insertReceiptSchema, insertScheduleEntrySchema, insertAppSettingsSchema, insertErrorLogSchema } from "@shared/schema";
import multer from "multer";
import { Worker } from "tesseract.js";
import * as XLSX from "xlsx";
import { parse } from "csv-parse/sync";
import fs from "fs";
import path from "path";

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
  const worker = await Tesseract.createWorker();
  await worker.loadLanguage('eng');
  await worker.initialize('eng');
  
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
    if (lowerHeader.includes('date')) {
      mapping.date = header;
    } else if (lowerHeader.includes('start') && (lowerHeader.includes('address') || lowerHeader.includes('location'))) {
      mapping.startAddress = header;
    } else if (lowerHeader.includes('end') && (lowerHeader.includes('address') || lowerHeader.includes('location'))) {
      mapping.endAddress = header;
    } else if (lowerHeader.includes('note') || lowerHeader.includes('comment')) {
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
  // Dummy user for session simulation
  const DEMO_USER_ID = "demo-user-123";
  
  // Trips routes
  app.get("/api/trips", async (req, res) => {
    try {
      const trips = await storage.getTrips(DEMO_USER_ID);
      res.json(trips);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch trips" });
    }
  });

  app.post("/api/trips", async (req, res) => {
    try {
      const validatedData = insertTripSchema.parse({ ...req.body, userId: DEMO_USER_ID });
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
      const activeTrip = await storage.getActiveTrip(DEMO_USER_ID);
      res.json(activeTrip);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active trip" });
    }
  });

  // Expenses routes
  app.get("/api/expenses", async (req, res) => {
    try {
      const expenses = await storage.getExpenses(DEMO_USER_ID);
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  app.post("/api/expenses", async (req, res) => {
    try {
      const validatedData = insertExpenseSchema.parse({ ...req.body, userId: DEMO_USER_ID });
      const expense = await storage.createExpense(validatedData);
      res.json(expense);
    } catch (error) {
      res.status(400).json({ message: "Invalid expense data" });
    }
  });

  // Receipts routes
  app.get("/api/receipts", async (req, res) => {
    try {
      const receipts = await storage.getReceipts(DEMO_USER_ID);
      res.json(receipts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch receipts" });
    }
  });

  app.post("/api/receipts", upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      const { ocrText, extractedData } = await processReceiptOCR(req.file.path);
      
      const receiptData = insertReceiptSchema.parse({
        userId: DEMO_USER_ID,
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
      const entries = await storage.getScheduleEntries(DEMO_USER_ID);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch schedule entries" });
    }
  });

  app.post("/api/schedule/import", upload.single('file'), async (req, res) => {
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
      res.status(500).json({ message: "Failed to parse schedule file" });
    }
  });

  app.post("/api/schedule/process", async (req, res) => {
    try {
      const { data, headerMapping, mileageRate } = req.body;
      
      const userSettings = await storage.getUserSettings(DEMO_USER_ID);
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
            userId: DEMO_USER_ID,
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
            userId: DEMO_USER_ID,
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
            userId: DEMO_USER_ID,
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
      const settings = await storage.getUserSettings(DEMO_USER_ID);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const validatedData = insertAppSettingsSchema.parse({ ...req.body, userId: DEMO_USER_ID });
      const settings = await storage.createOrUpdateSettings(validatedData);
      res.json(settings);
    } catch (error) {
      res.status(400).json({ message: "Invalid settings data" });
    }
  });

  // Error logs route
  app.get("/api/error-logs", async (req, res) => {
    try {
      const logs = await storage.getErrorLogs(DEMO_USER_ID);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch error logs" });
    }
  });

  // Export data route
  app.get("/api/export", async (req, res) => {
    try {
      const trips = await storage.getTrips(DEMO_USER_ID);
      const expenses = await storage.getExpenses(DEMO_USER_ID);
      const receipts = await storage.getReceipts(DEMO_USER_ID);
      const schedule = await storage.getScheduleEntries(DEMO_USER_ID);
      
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

  const httpServer = createServer(app);
  return httpServer;
}
