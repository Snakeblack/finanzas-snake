import { describe, it, expect } from 'vitest';
import { normalizeMonth, addMonthsToMonth, getValidDateForMonth } from '../utils/dateUtils';

describe('normalizeMonth', () => {
	it('debe extraer YYYY-MM de una fecha completa YYYY-MM-DD', () => {
		expect(normalizeMonth('2026-05-30')).toBe('2026-05');
		expect(normalizeMonth('2026-12-01')).toBe('2026-12');
	});

	it('debe retornar la misma cadena si ya es YYYY-MM', () => {
		expect(normalizeMonth('2026-05')).toBe('2026-05');
	});

	it('debe retornar el mes actual si el valor es undefined', () => {
		const expected = new Date().toISOString().substring(0, 7);
		expect(normalizeMonth(undefined)).toBe(expected);
	});

	it('debe retornar el mes actual si el valor es string vacío', () => {
		const expected = new Date().toISOString().substring(0, 7);
		expect(normalizeMonth('')).toBe(expected);
	});
});

describe('addMonthsToMonth', () => {
	it('debe sumar meses correctamente dentro del mismo año', () => {
		expect(addMonthsToMonth('2026-01', 1)).toBe('2026-02');
		expect(addMonthsToMonth('2026-05', 3)).toBe('2026-08');
	});

	it('debe cruzar el límite de año diciembre→enero', () => {
		expect(addMonthsToMonth('2026-12', 1)).toBe('2027-01');
		expect(addMonthsToMonth('2026-11', 3)).toBe('2027-02');
	});

	it('debe restar meses correctamente cruzando el límite de año', () => {
		expect(addMonthsToMonth('2026-01', -1)).toBe('2025-12');
		expect(addMonthsToMonth('2026-03', -5)).toBe('2025-10');
	});

	it('debe retornar el mismo mes al sumar 0', () => {
		expect(addMonthsToMonth('2026-06', 0)).toBe('2026-06');
	});

	it('debe sumar múltiples años', () => {
		expect(addMonthsToMonth('2026-01', 24)).toBe('2028-01');
		expect(addMonthsToMonth('2026-06', 13)).toBe('2027-07');
	});
});

describe('getValidDateForMonth', () => {
	it('debe retornar la fecha exacta si el día está dentro del rango', () => {
		expect(getValidDateForMonth('2026-05', '15')).toBe('2026-05-15');
		expect(getValidDateForMonth('2026-01', '01')).toBe('2026-01-01');
		expect(getValidDateForMonth('2026-03', '31')).toBe('2026-03-31');
	});

	it('debe clampar al último día del mes si el día preferido lo supera', () => {
		// Mayo tiene 31 días
		expect(getValidDateForMonth('2026-05', '35')).toBe('2026-05-31');
		// Febrero no bisiesto (2026) tiene 28 días
		expect(getValidDateForMonth('2026-02', '30')).toBe('2026-02-28');
		expect(getValidDateForMonth('2026-02', '29')).toBe('2026-02-28');
		// Abril tiene 30 días
		expect(getValidDateForMonth('2026-04', '31')).toBe('2026-04-30');
	});

	it('debe manejar febrero en año bisiesto', () => {
		// 2028 es bisiesto
		expect(getValidDateForMonth('2028-02', '29')).toBe('2028-02-29');
		expect(getValidDateForMonth('2028-02', '30')).toBe('2028-02-29');
	});

	it('debe padear el día a dos dígitos', () => {
		expect(getValidDateForMonth('2026-07', '5')).toBe('2026-07-05');
	});
});
