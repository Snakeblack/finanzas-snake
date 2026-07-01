import type { Transaction } from '../../types';

export class IndexedDBProvider {
	private dbName = 'FinanzasProDB_v4';
	private version = 2;

	public initDB(): Promise<IDBDatabase> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, this.version);

			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains('transactions')) {
					db.createObjectStore('transactions', { keyPath: 'id' });
				}
				if (!db.objectStoreNames.contains('accounts')) {
					db.createObjectStore('accounts', { keyPath: 'id' });
				}
				if (!db.objectStoreNames.contains('debts')) {
					db.createObjectStore('debts', { keyPath: 'id' });
				}
				if (!db.objectStoreNames.contains('periods')) {
					db.createObjectStore('periods', { keyPath: 'month' });
				}
				if (!db.objectStoreNames.contains('chat')) {
					db.createObjectStore('chat', { keyPath: 'id' });
				}
				if (!db.objectStoreNames.contains('config')) {
					db.createObjectStore('config', { keyPath: 'key' });
				}
			};

			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	async saveEntitiesBulk<T>(storeName: string, entities: T[]): Promise<void> {
		const db = await this.initDB();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(storeName, 'readwrite');
			const store = transaction.objectStore(storeName);

			entities.forEach((entity) => store.put(entity));

			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);
		});
	}

	async getAllEntities<T = unknown>(storeName: string): Promise<T[]> {
		const db = await this.initDB();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(storeName, 'readonly');
			const request = transaction.objectStore(storeName).getAll();

			request.onsuccess = () => resolve(request.result as T[]);
			request.onerror = () => reject(request.error);
		});
	}

	async clearStore(storeName: string): Promise<void> {
		const db = await this.initDB();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(storeName, 'readwrite');
			const store = transaction.objectStore(storeName);
			const request = store.clear();

			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}

	async saveSingleEntity<T>(storeName: string, entity: T): Promise<void> {
		const db = await this.initDB();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(storeName, 'readwrite');
			const store = transaction.objectStore(storeName);
			const request = store.put(entity);

			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}

	async getSingleEntity<T = unknown>(storeName: string, key: string): Promise<T | null> {
		const db = await this.initDB();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(storeName, 'readonly');
			const store = transaction.objectStore(storeName);
			const request = store.get(key);

			request.onsuccess = () => resolve((request.result as T) || null);
			request.onerror = () => reject(request.error);
		});
	}

	async saveTransactionsBulk(txs: Transaction[]): Promise<void> {
		return this.saveEntitiesBulk('transactions', txs);
	}

	async getAllTransactions(): Promise<Transaction[]> {
		return this.getAllEntities<Transaction>('transactions');
	}

	async clearTransactions(): Promise<void> {
		return this.clearStore('transactions');
	}
}
