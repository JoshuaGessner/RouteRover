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
  type InsertErrorLog
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
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
    return result.rowCount > 0;
  }

  async getActiveTrip(userId: string): Promise<Trip | undefined> {
    const [trip] = await db
      .select()
      .from(trips)
      .where(eq(trips.userId, userId))
      .where(eq(trips.isActive, true));
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
    return result.rowCount > 0;
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
    return result.rowCount > 0;
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
    return result.rowCount > 0;
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

  constructor() {
    this.users = new Map();
    this.trips = new Map();
    this.expenses = new Map();
    this.receipts = new Map();
    this.scheduleEntries = new Map();
    this.appSettings = new Map();
    this.errorLogs = new Map();
  }

  // Users for Replit Auth
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existing = this.users.get(userData.id!);
    
    if (existing) {
      const updated = { ...existing, ...userData, updatedAt: new Date() };
      this.users.set(userData.id!, updated);
      return updated;
    } else {
      const id = userData.id || randomUUID();
      const user: User = { ...userData, id, createdAt: new Date(), updatedAt: new Date() };
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
    const trip: Trip = { ...insertTrip, id };
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
    const expense: Expense = { ...insertExpense, id };
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
    const receipt: Receipt = { ...insertReceipt, id };
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
    const entry: ScheduleEntry = { ...insertEntry, id };
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
      const settings: AppSettings = { ...insertSettings, id };
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
    const log: ErrorLog = { ...insertLog, id };
    this.errorLogs.set(id, log);
    return log;
  }
}

// Use DatabaseStorage in production, MemStorage for fallback
export const storage = process.env.DATABASE_URL ? new DatabaseStorage() : new MemStorage();
