import { describe, it, expect } from 'vitest';
import { bytesToHex, hexToBytes } from '../utils/hexEncoding';

describe('bytesToHex', () => {
	it('convierte bytes a hex con padding de dos dígitos', () => {
		expect(bytesToHex(new Uint8Array([0, 15, 16, 255]))).toBe('000f10ff');
	});

	it('devuelve cadena vacía para un array vacío', () => {
		expect(bytesToHex(new Uint8Array([]))).toBe('');
	});
});

describe('hexToBytes', () => {
	it('reconstruye los bytes desde el hex', () => {
		expect(Array.from(hexToBytes('000f10ff'))).toEqual([0, 15, 16, 255]);
	});

	it('devuelve un array vacío para cadena vacía', () => {
		expect(Array.from(hexToBytes(''))).toEqual([]);
	});
});

describe('bytesToHex + hexToBytes (round-trip)', () => {
	it('es reversible para un salt arbitrario', () => {
		const salt = new Uint8Array([1, 2, 3, 200, 201, 16, 0, 255, 128, 64]);
		expect(Array.from(hexToBytes(bytesToHex(salt)))).toEqual(Array.from(salt));
	});
});
