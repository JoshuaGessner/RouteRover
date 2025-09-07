import * as XLSX from 'xlsx';

export interface ParsedScheduleData {
  data: Record<string, any>[];
  headers: string[];
  detectedMapping: HeaderMapping;
}

export interface HeaderMapping {
  date?: string;
  startAddress?: string;
  endAddress?: string;
  notes?: string;
}

export function parseCSV(csvText: string): Record<string, any>[] {
  const lines = csvText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  if (lines.length === 0) return [];
  
  const headers = parseCSVLine(lines[0]);
  const data: Record<string, any>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, any> = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    data.push(row);
  }
  
  return data;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

export function parseExcel(file: File): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        resolve(jsonData as Record<string, any>[]);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read Excel file'));
    reader.readAsArrayBuffer(file);
  });
}

export function parseTXT(txtContent: string): Record<string, any>[] {
  const lines = txtContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  if (lines.length === 0) return [];
  
  // Try to detect delimiter (tab or comma)
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';
  
  const headers = firstLine.split(delimiter).map(h => h.trim());
  const data: Record<string, any>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim());
    const row: Record<string, any> = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    data.push(row);
  }
  
  return data;
}

export function detectHeaders(data: Record<string, any>[]): HeaderMapping {
  if (data.length === 0) return {};
  
  const headers = Object.keys(data[0]);
  const mapping: HeaderMapping = {};
  
  headers.forEach(header => {
    const lowerHeader = header.toLowerCase();
    
    if (lowerHeader.includes('date') || lowerHeader.includes('day')) {
      mapping.date = header;
    } else if (lowerHeader.includes('start') && (lowerHeader.includes('address') || lowerHeader.includes('location') || lowerHeader.includes('from'))) {
      mapping.startAddress = header;
    } else if (lowerHeader.includes('end') && (lowerHeader.includes('address') || lowerHeader.includes('location') || lowerHeader.includes('to'))) {
      mapping.endAddress = header;
    } else if (lowerHeader.includes('note') || lowerHeader.includes('comment') || lowerHeader.includes('description')) {
      mapping.notes = header;
    }
  });
  
  return mapping;
}

export function detectHotelStay(notes: string): boolean {
  if (!notes) return false;
  
  const lowerNotes = notes.toLowerCase();
  const hotelKeywords = ['hotel', 'motel', 'inn', 'lodge', 'resort', 'stay', 'overnight', 'lodging', 'accommodation'];
  
  return hotelKeywords.some(keyword => lowerNotes.includes(keyword));
}

export function cleanAddress(address: string): string {
  // Basic address cleaning - remove extra spaces, fix common typos
  return address
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/,\s*,/g, ',') // Remove duplicate commas
    .replace(/\s*,\s*/g, ', ') // Normalize comma spacing
    .replace(/\b(st|street)\b/gi, 'Street') // Normalize street abbreviations
    .replace(/\b(ave|avenue)\b/gi, 'Avenue')
    .replace(/\b(blvd|boulevard)\b/gi, 'Boulevard')
    .replace(/\b(rd|road)\b/gi, 'Road')
    .replace(/\b(dr|drive)\b/gi, 'Drive')
    .trim();
}
