import { describe, expect, it } from 'vitest';
import { parseOpeningBalanceInput } from '../utils/openingBalance';

describe('parseOpeningBalanceInput', () => {
	it('debe tratar entradas vacías como cero', () => {
		expect(parseOpeningBalanceInput('')).toBe(0);
		expect(parseOpeningBalanceInput('   ')).toBe(0);
	});

	it('debe conservar valores numéricos válidos y rechazar valores inválidos', () => {
		expect(parseOpeningBalanceInput('123.45')).toBe(123.45);
		expect(parseOpeningBalanceInput(50)).toBe(50);
		expect(parseOpeningBalanceInput('abc')).toBeNaN();
	});
});
