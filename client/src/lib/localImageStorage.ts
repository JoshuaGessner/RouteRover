/**
 * Local Image Storage Service
 * Uses IndexedDB to store receipt images locally on user's device
 */

interface StoredImage {
  id: string;
  receiptId: string;
  imageData: Blob;
  filename: string;
  uploadDate: Date;
}

class LocalImageStorage {
  private dbName = 'RouteRoverImages';
  private dbVersion = 1;
  private storeName = 'receipt-images';
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store for images
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('receiptId', 'receiptId', { unique: true });
          store.createIndex('uploadDate', 'uploadDate', { unique: false });
        }
      };
    });
  }

  async storeImage(receiptId: string, imageFile: File): Promise<string> {
    if (!this.db) await this.init();
    
    const imageId = `img_${receiptId}`;
    const imageData: StoredImage = {
      id: imageId,
      receiptId,
      imageData: imageFile,
      filename: imageFile.name,
      uploadDate: new Date()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(imageData);
      
      request.onsuccess = () => resolve(imageId);
      request.onerror = () => reject(request.error);
    });
  }

  async getImage(receiptId: string): Promise<Blob | null> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('receiptId');
      const request = index.get(receiptId);
      
      request.onsuccess = () => {
        const result = request.result as StoredImage;
        resolve(result ? result.imageData : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async downloadImage(receiptId: string): Promise<void> {
    const imageData = await this.getImage(receiptId);
    if (!imageData) {
      throw new Error('Image not found in local storage');
    }

    // Create download link
    const url = URL.createObjectURL(imageData);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${receiptId.slice(0, 8)}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async getAllImages(): Promise<StoredImage[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async downloadAllImages(): Promise<void> {
    const images = await this.getAllImages();
    if (images.length === 0) {
      throw new Error('No images found in local storage');
    }

    // Create zip file with all images
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();

    for (const image of images) {
      const filename = `receipt-${image.receiptId.slice(0, 8)}-${image.uploadDate.toISOString().slice(0, 10)}.jpg`;
      zip.file(filename, image.imageData);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipts-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async deleteImage(receiptId: string): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('receiptId');
      const request = index.getKey(receiptId);
      
      request.onsuccess = () => {
        if (request.result) {
          const deleteRequest = store.delete(request.result);
          deleteRequest.onsuccess = () => resolve();
          deleteRequest.onerror = () => reject(deleteRequest.error);
        } else {
          resolve(); // Image not found, consider it deleted
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllImages(): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getStorageInfo(): Promise<{ count: number; estimatedSize: string }> {
    const images = await this.getAllImages();
    let totalSize = 0;
    
    for (const image of images) {
      totalSize += image.imageData.size;
    }
    
    return {
      count: images.length,
      estimatedSize: this.formatBytes(totalSize)
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Export singleton instance
export const localImageStorage = new LocalImageStorage();