import { describe, it, expect } from 'vitest';
import { toNumber } from '../utils/formatters';

describe('toNumber', () => {
	it('debe retornar el número si la entrada es un número válido', () => {
		expect(toNumber(100)).toBe(100);
		expect(toNumber(0)).toBe(0);
		expect(toNumber(-50)).toBe(-50);
		expect(toNumber(3.14)).toBeCloseTo(3.14);
	});

	it('debe parsear strings numéricas correctamente', () => {
		expect(toNumber('100')).toBe(100);
		expect(toNumber('123.45')).toBeCloseTo(123.45);
		expect(toNumber('-50')).toBe(-50);
		expect(toNumber('0')).toBe(0);
		expect(toNumber('0.001')).toBeCloseTo(0.001);
	});

	it('debe retornar 0 para undefined', () => {
		expect(toNumber(undefined)).toBe(0);
	});

	it('debe retornar 0 para strings no numéricas', () => {
		expect(toNumber('invalido')).toBe(0);
		expect(toNumber('abc')).toBe(0);
		expect(toNumber('12abc')).toBe(12); // parseFloat parsea hasta donde puede
	});

	it('debe retornar 0 para string vacía', () => {
		expect(toNumber('')).toBe(0);
	});

	it('debe retornar 0 para NaN', () => {
		expect(toNumber(NaN)).toBe(0);
	});

	it('debe retornar 0 para Infinity y -Infinity', () => {
		expect(toNumber(Infinity)).toBe(0);
		expect(toNumber(-Infinity)).toBe(0);
	});

	it('debe manejar strings con espacios que parseFloat puede procesar', () => {
		expect(toNumber(' 42 ')).toBe(42);
		expect(toNumber('  ')).toBe(0);
	});
});
