import type { NumericInput } from '../types';

/**
 * Convierte una entrada numérica (número o string) a un número flotante de JavaScript válido.
 * Si no es válido o es indefinido, retorna 0.
 * 
 * @param value Valor numérico de entrada (string o número)
 * @returns Número flotante válido o 0
 */
export const toNumber = (value: NumericInput | undefined): number => {
	const parsed = typeof value === 'number' ? value : parseFloat(value ?? '');
	return Number.isFinite(parsed) ? parsed : 0;
};
