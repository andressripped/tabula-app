const DB_NAME = 'tabula_vector_db';
const DB_VERSION = 1;
const STORE_NAME = 'embeddings';

export interface PageEmbeddings {
  pageId: string;
  titleEmbedding: number[] | null;
  blocksEmbeddings: Record<string, number[]>; // blockId -> embedding vector
  updatedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'pageId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getPageEmbeddings(pageId: string): Promise<PageEmbeddings | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(transaction.objectStoreNames[0]);
      const request = store.get(pageId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get page embeddings from IndexedDB:', error);
    return null;
  }
}

export async function savePageEmbeddings(embeddings: PageEmbeddings): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(transaction.objectStoreNames[0]);
      const request = store.put(embeddings);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to save page embeddings to IndexedDB:', error);
  }
}

export async function deletePageEmbeddings(pageId: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(transaction.objectStoreNames[0]);
      const request = store.delete(pageId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to delete page embeddings from IndexedDB:', error);
  }
}

export async function clearAllEmbeddings(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(transaction.objectStoreNames[0]);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to clear embeddings database:', error);
  }
}
