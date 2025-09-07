import Tesseract from 'tesseract.js';

export interface ExtractedReceiptData {
  merchant?: string;
  amount?: number;
  date?: string;
  tax?: number;
  items?: string[];
}

export async function extractTextFromImage(imageFile: File): Promise<string> {
  const result = await Tesseract.recognize(imageFile, 'eng', {
    logger: () => {}
  });
  
  return result.data.text;
}

export function parseReceiptData(ocrText: string): ExtractedReceiptData {
  const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const data: ExtractedReceiptData = {};
  
  // Extract merchant name (usually one of the first few lines)
  if (lines.length > 0) {
    // Look for the longest line in the first 3 lines as merchant name
    const potentialMerchants = lines.slice(0, 3);
    data.merchant = potentialMerchants.reduce((a, b) => a.length > b.length ? a : b);
  }
  
  // Extract amounts (look for dollar signs and numbers)
  const amountMatches = ocrText.match(/\$[\d,]+\.?\d{0,2}/g);
  if (amountMatches) {
    const amounts = amountMatches.map(a => parseFloat(a.replace(/[$,]/g, '')));
    data.amount = Math.max(...amounts); // Take the largest amount as the total
  }
  
  // Extract date patterns
  const datePatterns = [
    /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/, // MM/DD/YYYY or MM-DD-YYYY
    /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2}\b/,   // MM/DD/YY
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\b/i, // Month DD, YYYY
  ];
  
  for (const pattern of datePatterns) {
    const dateMatch = ocrText.match(pattern);
    if (dateMatch) {
      data.date = dateMatch[0];
      break;
    }
  }
  
  // Extract tax
  const taxPatterns = [
    /tax.*?\$?([\d,]+\.?\d{0,2})/i,
    /sales tax.*?\$?([\d,]+\.?\d{0,2})/i,
    /hst.*?\$?([\d,]+\.?\d{0,2})/i,
    /vat.*?\$?([\d,]+\.?\d{0,2})/i,
  ];
  
  for (const pattern of taxPatterns) {
    const taxMatch = ocrText.match(pattern);
    if (taxMatch) {
      data.tax = parseFloat(taxMatch[1].replace(/,/g, ''));
      break;
    }
  }
  
  // Extract line items (basic implementation)
  data.items = lines.filter(line => {
    // Look for lines that might be items (contain both text and numbers/prices)
    return line.match(/[a-zA-Z]/) && line.match(/[\d\$]/);
  }).slice(0, 10); // Limit to first 10 items
  
  return data;
}
