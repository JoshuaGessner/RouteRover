import {
  users,
  trips,
  expenses,
  receipts,
  scheduleEntries,
  appSettings,
  errorLogs,
  type User,
  type UpsertUser,
  type InsertUser,
  type Trip,
  type InsertTrip,
  type Expense,
  type InsertExpense,
  type Receipt,
  type InsertReceipt,
  type ScheduleEntry,
  type InsertScheduleEntry,
  type AppSettings,
  type InsertAppSettings,
  type ErrorLog,
  type InsertErrorLog,
  type ProcessedFile,
  type InsertProcessedFile,
  processedFiles,
  type InsertApiUsage,
  type ApiUsage,
  apiUsage
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users (for custom authentication)
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Trips
  getTrips(userId: string): Promise<Trip[]>;
  getTrip(id: string): Promise<Trip | undefined>;
  createTrip(trip: InsertTrip): Promise<Trip>;
  updateTrip(id: string, trip: Partial<Trip>): Promise<Trip | undefined>;
  deleteTrip(id: string): Promise<boolean>;
  getActiveTrip(userId: string): Promise<Trip | undefined>;
  
  // Expenses
  getExpenses(userId: string): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: string, expense: Partial<Expense>): Promise<Expense | undefined>;
  deleteExpense(id: string): Promise<boolean>;
  
  // Receipts
  getReceipts(userId: string): Promise<Receipt[]>;
  getReceipt(id: string): Promise<Receipt | undefined>;
  createReceipt(receipt: InsertReceipt): Promise<Receipt>;
  updateReceipt(id: string, receipt: Partial<Receipt>): Promise<Receipt | undefined>;
  deleteReceipt(id: string): Promise<boolean>;
  
  // Schedule Entries
  getScheduleEntries(userId: string): Promise<ScheduleEntry[]>;
  getScheduleEntry(id: string): Promise<ScheduleEntry | undefined>;
  createScheduleEntry(entry: InsertScheduleEntry): Promise<ScheduleEntry>;
  updateScheduleEntry(id: string, entry: Partial<ScheduleEntry>): Promise<ScheduleEntry | undefined>;
  deleteScheduleEntry(id: string): Promise<boolean>;
  
  // App Settings
  getUserSettings(userId: string): Promise<AppSettings | undefined>;
  createOrUpdateSettings(settings: InsertAppSettings): Promise<AppSettings>;
  
  // Error Logs
  getErrorLogs(userId: string): Promise<ErrorLog[]>;
  createErrorLog(log: InsertErrorLog): Promise<ErrorLog>;
  
  // File processing redundancy
  getProcessedFileHash(userId: string, fileHash: string): Promise<ProcessedFile | undefined>;
  createProcessedFile(file: InsertProcessedFile): Promise<ProcessedFile>;
  
  // API Usage tracking
  getApiUsage(userId: string, month?: string): Promise<ApiUsage[]>;
  trackApiCall(usage: InsertApiUsage): Promise<ApiUsage>;
  getMonthlyApiStats(userId: string, month: string): Promise<{totalCalls: number, totalCost: number}>;
}

export class DatabaseStorage implements IStorage {
  // User operations for custom authentication
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    if (!email) return undefined;
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Trips
  async getTrips(userId: string): Promise<Trip[]> {
    return await db.select().from(trips).where(eq(trips.userId, userId));
  }

  async getTrip(id: string): Promise<Trip | undefined> {
    const [trip] = await db.select().from(trips).where(eq(trips.id, id));
    return trip;
  }

  async createTrip(insertTrip: InsertTrip): Promise<Trip> {
    const [trip] = await db.insert(trips).values(insertTrip).returning();
    return trip;
  }

  async updateTrip(id: string, updates: Partial<Trip>): Promise<Trip | undefined> {
    const [trip] = await db
      .update(trips)
      .set(updates)
      .where(eq(trips.id, id))
      .returning();
    return trip;
  }

  async deleteTrip(id: string): Promise<boolean> {
    const result = await db.delete(trips).where(eq(trips.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getActiveTrip(userId: string): Promise<Trip | undefined> {
    const [trip] = await db
      .select()
      .from(trips)
      .where(eq(trips.userId, userId) && eq(trips.isActive, true));
    return trip;
  }

  // Expenses
  async getExpenses(userId: string): Promise<Expense[]> {
    return await db.select().from(expenses).where(eq(expenses.userId, userId));
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    const [expense] = await db.select().from(expenses).where(eq(expenses.id, id));
    return expense;
  }

  async createExpense(insertExpense: InsertExpense): Promise<Expense> {
    const [expense] = await db.insert(expenses).values(insertExpense).returning();
    return expense;
  }

  async updateExpense(id: string, updates: Partial<Expense>): Promise<Expense | undefined> {
    const [expense] = await db
      .update(expenses)
      .set(updates)
      .where(eq(expenses.id, id))
      .returning();
    return expense;
  }

  async deleteExpense(id: string): Promise<boolean> {
    const result = await db.delete(expenses).where(eq(expenses.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Receipts
  async getReceipts(userId: string): Promise<Receipt[]> {
    return await db.select().from(receipts).where(eq(receipts.userId, userId));
  }

  async getReceipt(id: string): Promise<Receipt | undefined> {
    const [receipt] = await db.select().from(receipts).where(eq(receipts.id, id));
    return receipt;
  }

  async createReceipt(insertReceipt: InsertReceipt): Promise<Receipt> {
    const [receipt] = await db.insert(receipts).values(insertReceipt).returning();
    return receipt;
  }

  async updateReceipt(id: string, updates: Partial<Receipt>): Promise<Receipt | undefined> {
    const [receipt] = await db
      .update(receipts)
      .set(updates)
      .where(eq(receipts.id, id))
      .returning();
    return receipt;
  }

  async deleteReceipt(id: string): Promise<boolean> {
    const result = await db.delete(receipts).where(eq(receipts.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Schedule Entries
  async getScheduleEntries(userId: string): Promise<ScheduleEntry[]> {
    return await db.select().from(scheduleEntries).where(eq(scheduleEntries.userId, userId));
  }

  async getScheduleEntry(id: string): Promise<ScheduleEntry | undefined> {
    const [entry] = await db.select().from(scheduleEntries).where(eq(scheduleEntries.id, id));
    return entry;
  }

  async createScheduleEntry(insertEntry: InsertScheduleEntry): Promise<ScheduleEntry> {
    const [entry] = await db.insert(scheduleEntries).values(insertEntry).returning();
    return entry;
  }

  async getScheduleEntryByDate(userId: string, date: Date): Promise<ScheduleEntry | undefined> {
    const [entry] = await db
      .select()
      .from(scheduleEntries)
      .where(and(eq(scheduleEntries.userId, userId), eq(scheduleEntries.date, date)));
    return entry || undefined;
  }

  async updateScheduleEntry(id: string, updates: Partial<ScheduleEntry>): Promise<ScheduleEntry | undefined> {
    const [entry] = await db
      .update(scheduleEntries)
      .set(updates)
      .where(eq(scheduleEntries.id, id))
      .returning();
    return entry;
  }

  async deleteScheduleEntry(id: string): Promise<boolean> {
    const result = await db.delete(scheduleEntries).where(eq(scheduleEntries.id, id));
    return (result.rowCount || 0) > 0;
  }

  // App Settings
  async getUserSettings(userId: string): Promise<AppSettings | undefined> {
    const [settings] = await db.select().from(appSettings).where(eq(appSettings.userId, userId));
    return settings;
  }

  async createOrUpdateSettings(insertSettings: InsertAppSettings): Promise<AppSettings> {
    const existing = await this.getUserSettings(insertSettings.userId!);
    
    if (existing) {
      const [settings] = await db
        .update(appSettings)
        .set(insertSettings)
        .where(eq(appSettings.userId, insertSettings.userId!))
        .returning();
      return settings;
    } else {
      const [settings] = await db.insert(appSettings).values(insertSettings).returning();
      return settings;
    }
  }

  // Error Logs
  async getErrorLogs(userId: string): Promise<ErrorLog[]> {
    return await db.select().from(errorLogs).where(eq(errorLogs.userId, userId));
  }

  async createErrorLog(insertLog: InsertErrorLog): Promise<ErrorLog> {
    const [log] = await db.insert(errorLogs).values(insertLog).returning();
    return log;
  }

  // Processed Files (for redundancy checking)
  async getProcessedFileHash(userId: string, fileHash: string): Promise<ProcessedFile | undefined> {
    const [file] = await db
      .select()
      .from(processedFiles)
      .where(and(eq(processedFiles.userId, userId), eq(processedFiles.fileHash, fileHash)));
    return file || undefined;
  }

  async createProcessedFile(insertFile: InsertProcessedFile): Promise<ProcessedFile> {
    const [file] = await db.insert(processedFiles).values(insertFile).returning();
    return file;
  }

  // API Usage tracking
  async getApiUsage(userId: string, month?: string): Promise<ApiUsage[]> {
    if (month) {
      return await db.select().from(apiUsage).where(and(eq(apiUsage.userId, userId), eq(apiUsage.month, month)));
    }
    return await db.select().from(apiUsage).where(eq(apiUsage.userId, userId));
  }

  async trackApiCall(insertUsage: InsertApiUsage): Promise<ApiUsage> {
    // Check if entry exists for this user/provider/month
    const existing = await db
      .select()
      .from(apiUsage)
      .where(and(
        eq(apiUsage.userId, insertUsage.userId!),
        eq(apiUsage.apiProvider, insertUsage.apiProvider),
        eq(apiUsage.month, insertUsage.month)
      ));

    if (existing.length > 0) {
      // Update existing record
      const [updated] = await db
        .update(apiUsage)
        .set({
          callCount: (existing[0].callCount || 0) + 1,
          lastCalled: insertUsage.lastCalled,
          totalCost: (existing[0].totalCost || 0) + (insertUsage.totalCost || 0)
        })
        .where(eq(apiUsage.id, existing[0].id))
        .returning();
      return updated;
    } else {
      // Create new record
      const [newUsage] = await db.insert(apiUsage).values(insertUsage).returning();
      return newUsage;
    }
  }

  async getMonthlyApiStats(userId: string, month: string): Promise<{totalCalls: number, totalCost: number}> {
    const usage = await this.getApiUsage(userId, month);
    const totalCalls = usage.reduce((sum, u) => sum + (u.callCount || 0), 0);
    const totalCost = usage.reduce((sum, u) => sum + (u.totalCost || 0), 0);
    return { totalCalls, totalCost };
  }
}

// Fallback MemStorage for development/testing
class MemStorage implements IStorage {
  private users: Map<string, User>;
  private trips: Map<string, Trip>;
  private expenses: Map<string, Expense>;
  private receipts: Map<string, Receipt>;
  private scheduleEntries: Map<string, ScheduleEntry>;
  private appSettings: Map<string, AppSettings>;
  private errorLogs: Map<string, ErrorLog>;
  private processedFiles: Map<string, ProcessedFile>;
  private apiUsage: Map<string, ApiUsage>;

  constructor() {
    this.users = new Map();
    this.trips = new Map();
    this.expenses = new Map();
    this.receipts = new Map();
    this.scheduleEntries = new Map();
    this.appSettings = new Map();
    this.errorLogs = new Map();
    this.processedFiles = new Map();
    this.apiUsage = new Map();
  }

  // Users for custom authentication
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    for (const user of Array.from(this.users.values())) {
      if (user.username === username) {
        return user;
      }
    }
    return undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    if (!email) return undefined;
    for (const user of Array.from(this.users.values())) {
      if (user.email === email) {
        return user;
      }
    }
    return undefined;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      id,
      username: userData.username,
      email: userData.email || null,
      password: userData.password,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existing = this.users.get(userData.id!);
    
    if (existing) {
      const updated = { ...existing, ...userData, updatedAt: new Date() };
      this.users.set(userData.id!, updated);
      return updated;
    } else {
      const id = userData.id || randomUUID();
      const user: User = { 
        id, 
        username: userData.username!,
        email: userData.email ?? null,
        password: userData.password!,
        firstName: userData.firstName ?? null,
        lastName: userData.lastName ?? null,
        createdAt: new Date(), 
        updatedAt: new Date() 
      };
      this.users.set(id, user);
      return user;
    }
  }

  // Trips
  async getTrips(userId: string): Promise<Trip[]> {
    return Array.from(this.trips.values()).filter(trip => trip.userId === userId);
  }

  async getTrip(id: string): Promise<Trip | undefined> {
    return this.trips.get(id);
  }

  async createTrip(insertTrip: InsertTrip): Promise<Trip> {
    const id = randomUUID();
    const trip: Trip = { 
      id,
      userId: insertTrip.userId ?? null,
      startLocation: insertTrip.startLocation,
      endLocation: insertTrip.endLocation ?? null,
      startTime: insertTrip.startTime,
      endTime: insertTrip.endTime ?? null,
      distance: insertTrip.distance ?? null,
      purpose: insertTrip.purpose ?? "business",
      notes: insertTrip.notes ?? null,
      isActive: insertTrip.isActive ?? null,
      autoDetected: insertTrip.autoDetected ?? null
    };
    this.trips.set(id, trip);
    return trip;
  }

  async updateTrip(id: string, updates: Partial<Trip>): Promise<Trip | undefined> {
    const existing = this.trips.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.trips.set(id, updated);
    return updated;
  }

  async deleteTrip(id: string): Promise<boolean> {
    return this.trips.delete(id);
  }

  async getActiveTrip(userId: string): Promise<Trip | undefined> {
    return Array.from(this.trips.values()).find(
      trip => trip.userId === userId && trip.isActive === true
    );
  }

  // Expenses
  async getExpenses(userId: string): Promise<Expense[]> {
    return Array.from(this.expenses.values()).filter(expense => expense.userId === userId);
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    return this.expenses.get(id);
  }

  async createExpense(insertExpense: InsertExpense): Promise<Expense> {
    const id = randomUUID();
    const expense: Expense = { 
      id,
      userId: insertExpense.userId ?? null,
      tripId: insertExpense.tripId ?? null,
      amount: insertExpense.amount,
      category: insertExpense.category,
      merchant: insertExpense.merchant ?? null,
      date: insertExpense.date,
      notes: insertExpense.notes ?? null,
      receiptId: insertExpense.receiptId ?? null
    };
    this.expenses.set(id, expense);
    return expense;
  }

  async updateExpense(id: string, updates: Partial<Expense>): Promise<Expense | undefined> {
    const existing = this.expenses.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.expenses.set(id, updated);
    return updated;
  }

  async deleteExpense(id: string): Promise<boolean> {
    return this.expenses.delete(id);
  }

  // Receipts
  async getReceipts(userId: string): Promise<Receipt[]> {
    return Array.from(this.receipts.values()).filter(receipt => receipt.userId === userId);
  }

  async getReceipt(id: string): Promise<Receipt | undefined> {
    return this.receipts.get(id);
  }

  async createReceipt(insertReceipt: InsertReceipt): Promise<Receipt> {
    const id = randomUUID();
    const receipt: Receipt = { 
      id,
      userId: insertReceipt.userId ?? null,
      expenseId: insertReceipt.expenseId ?? null,
      imageUrl: insertReceipt.imageUrl,
      ocrText: insertReceipt.ocrText ?? null,
      extractedData: insertReceipt.extractedData,
      uploadDate: insertReceipt.uploadDate
    };
    this.receipts.set(id, receipt);
    return receipt;
  }

  async updateReceipt(id: string, updates: Partial<Receipt>): Promise<Receipt | undefined> {
    const existing = this.receipts.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.receipts.set(id, updated);
    return updated;
  }

  async deleteReceipt(id: string): Promise<boolean> {
    return this.receipts.delete(id);
  }

  // Schedule Entries
  async getScheduleEntries(userId: string): Promise<ScheduleEntry[]> {
    return Array.from(this.scheduleEntries.values()).filter(entry => entry.userId === userId);
  }

  async getScheduleEntry(id: string): Promise<ScheduleEntry | undefined> {
    return this.scheduleEntries.get(id);
  }

  async createScheduleEntry(insertEntry: InsertScheduleEntry): Promise<ScheduleEntry> {
    const id = randomUUID();
    const entry: ScheduleEntry = { 
      id,
      userId: insertEntry.userId || null,
      date: insertEntry.date,
      startAddress: insertEntry.startAddress,
      endAddress: insertEntry.endAddress,
      notes: insertEntry.notes ?? null,
      calculatedDistance: insertEntry.calculatedDistance ?? null,
      calculatedAmount: insertEntry.calculatedAmount ?? null,
      isHotelStay: insertEntry.isHotelStay ?? null,
      processingStatus: insertEntry.processingStatus ?? null,
      errorMessage: insertEntry.errorMessage ?? null,
      originalData: insertEntry.originalData
    };
    this.scheduleEntries.set(id, entry);
    return entry;
  }

  async updateScheduleEntry(id: string, updates: Partial<ScheduleEntry>): Promise<ScheduleEntry | undefined> {
    const existing = this.scheduleEntries.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.scheduleEntries.set(id, updated);
    return updated;
  }

  async deleteScheduleEntry(id: string): Promise<boolean> {
    return this.scheduleEntries.delete(id);
  }

  // App Settings
  async getUserSettings(userId: string): Promise<AppSettings | undefined> {
    return Array.from(this.appSettings.values()).find(settings => settings.userId === userId);
  }

  async createOrUpdateSettings(insertSettings: InsertAppSettings): Promise<AppSettings> {
    const existing = await this.getUserSettings(insertSettings.userId!);
    
    if (existing) {
      const updated = { ...existing, ...insertSettings };
      this.appSettings.set(existing.id, updated);
      return updated;
    } else {
      const id = randomUUID();
      const settings: AppSettings = { 
        id,
        userId: insertSettings.userId ?? null,
        googleApiKey: insertSettings.googleApiKey ?? null,
        openaiApiKey: insertSettings.openaiApiKey ?? null,
        mileageRate: insertSettings.mileageRate ?? null,
        autoDetectionEnabled: insertSettings.autoDetectionEnabled ?? null,
        detectionSensitivity: insertSettings.detectionSensitivity ?? null,
        darkMode: insertSettings.darkMode ?? null,
        pushNotifications: insertSettings.pushNotifications ?? null,
        autoBackup: insertSettings.autoBackup ?? null,
        defaultStartAddress: insertSettings.defaultStartAddress ?? null,
        defaultEndAddress: insertSettings.defaultEndAddress ?? null
      };
      this.appSettings.set(id, settings);
      return settings;
    }
  }

  // Error Logs
  async getErrorLogs(userId: string): Promise<ErrorLog[]> {
    return Array.from(this.errorLogs.values()).filter(log => log.userId === userId);
  }

  async createErrorLog(insertLog: InsertErrorLog): Promise<ErrorLog> {
    const id = randomUUID();
    const log: ErrorLog = { 
      id,
      userId: insertLog.userId || null,
      errorType: insertLog.errorType,
      errorMessage: insertLog.errorMessage,
      context: insertLog.context,
      timestamp: insertLog.timestamp
    };
    this.errorLogs.set(id, log);
    return log;
  }

  // Processed Files (for redundancy checking)
  async getProcessedFileHash(userId: string, fileHash: string): Promise<ProcessedFile | undefined> {
    const key = `${userId}-${fileHash}`;
    return this.processedFiles.get(key);
  }

  async createProcessedFile(insertFile: InsertProcessedFile): Promise<ProcessedFile> {
    const id = randomUUID();
    const file: ProcessedFile = {
      id,
      userId: insertFile.userId || null,
      fileHash: insertFile.fileHash,
      fileName: insertFile.fileName,
      processedAt: insertFile.processedAt,
      recordCount: insertFile.recordCount || 0
    };
    const key = `${insertFile.userId}-${insertFile.fileHash}`;
    this.processedFiles.set(key, file);
    return file;
  }

  // API Usage tracking
  async getApiUsage(userId: string, month?: string): Promise<ApiUsage[]> {
    const allUsage = Array.from(this.apiUsage.values()).filter(usage => usage.userId === userId);
    if (month) {
      return allUsage.filter(usage => usage.month === month);
    }
    return allUsage;
  }

  async trackApiCall(insertUsage: InsertApiUsage): Promise<ApiUsage> {
    const key = `${insertUsage.userId}-${insertUsage.apiProvider}-${insertUsage.month}`;
    const existing = this.apiUsage.get(key);
    
    if (existing) {
      // Update existing record
      existing.callCount = (existing.callCount || 0) + 1;
      existing.lastCalled = insertUsage.lastCalled;
      existing.totalCost = (existing.totalCost || 0) + (insertUsage.totalCost || 0);
      this.apiUsage.set(key, existing);
      return existing;
    } else {
      // Create new record
      const id = randomUUID();
      const newUsage: ApiUsage = {
        id,
        userId: insertUsage.userId,
        apiProvider: insertUsage.apiProvider,
        endpoint: insertUsage.endpoint,
        callCount: insertUsage.callCount || 1,
        month: insertUsage.month,
        lastCalled: insertUsage.lastCalled,
        totalCost: insertUsage.totalCost || 0
      };
      this.apiUsage.set(key, newUsage);
      return newUsage;
    }
  }

  async getMonthlyApiStats(userId: string, month: string): Promise<{totalCalls: number, totalCost: number}> {
    const usage = await this.getApiUsage(userId, month);
    const totalCalls = usage.reduce((sum, u) => sum + (u.callCount || 0), 0);
    const totalCost = usage.reduce((sum, u) => sum + (u.totalCost || 0), 0);
    return { totalCalls, totalCost };
  }
}

// Use DatabaseStorage in production, MemStorage for fallback
export const storage = process.env.DATABASE_URL ? new DatabaseStorage() : new MemStorage();
