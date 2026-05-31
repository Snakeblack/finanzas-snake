import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';

// Mock de window.print
if (typeof window !== 'undefined') {
	window.print = vi.fn();
}

// Mock de window.confirm
if (typeof window !== 'undefined') {
	window.confirm = vi.fn(() => true);
}

// Mock de window.alert
if (typeof window !== 'undefined') {
	window.alert = vi.fn();
}

// Almacén de base de datos en memoria para pruebas de IndexedDB
let mockDbStore: Record<string, any[]> = {};

class MockIDBRequest {
	result: any = null;
	error: any = null;
	private _onsuccess: any = null;
	private _onerror: any = null;

	get onsuccess() {
		return this._onsuccess;
	}
	set onsuccess(cb) {
		this._onsuccess = cb;
		if (cb) {
			cb({ target: this });
		}
	}

	get onerror() {
		return this._onerror;
	}
	set onerror(cb) {
		this._onerror = cb;
	}
}

class MockIDBTransaction {
	private _oncomplete: any = null;
	onerror: any = null;

	get oncomplete() {
		return this._oncomplete;
	}
	set oncomplete(cb) {
		this._oncomplete = cb;
		if (cb) {
			cb();
		}
	}

	objectStore(name: string) {
		return {
			put: (item: any) => {
				const req = new MockIDBRequest();
				if (!mockDbStore[name]) mockDbStore[name] = [];
				const keyPath = name === 'periods' ? 'month' : (name === 'config' ? 'key' : 'id');
				const index = mockDbStore[name].findIndex((x: any) => x[keyPath] === item[keyPath]);
				if (index > -1) {
					mockDbStore[name][index] = item;
				} else {
					mockDbStore[name].push(item);
				}
				req.result = item[keyPath];
				return req;
			},
			get: (key: any) => {
				const req = new MockIDBRequest();
				const store = mockDbStore[name] || [];
				const keyPath = name === 'periods' ? 'month' : (name === 'config' ? 'key' : 'id');
				req.result = store.find((x: any) => x[keyPath] === key) || null;
				return req;
			},
			getAll: () => {
				const req = new MockIDBRequest();
				req.result = mockDbStore[name] || [];
				return req;
			},
			clear: () => {
				const req = new MockIDBRequest();
				mockDbStore[name] = [];
				req.result = undefined;
				return req;
			}
		};
	}
}

const mockIndexedDB = {
	open: (name: string, version: number) => {
		const req = new MockIDBRequest();
		const db = {
			objectStoreNames: {
				contains: (n: string) => true
			},
			transaction: (storeNames: any, mode: any) => {
				return new MockIDBTransaction();
			}
		};
		req.result = db;
		return req;
	}
};

globalThis.indexedDB = mockIndexedDB as any;

// Limpiar localStorage y base de datos antes de cada prueba para evitar interferencias
beforeEach(() => {
	localStorage.clear();
	mockDbStore = {};
});
