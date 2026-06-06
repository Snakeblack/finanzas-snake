import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	normalizeAmount,
	normalizeDate,
	detectSeparator,
	parseCSV,
	processParsedRows,
	detectDuplicates,
	askGeminiToParseStatement,
	askGeminiToParsePdf
} from '../services/statementImportService';
import { askGemini } from '../services/geminiService';
import type { Transaction } from '../types';

vi.mock('../services/geminiService', () => ({
	askGemini: vi.fn()
}));

describe('statementImportService', () => {
	describe('normalizeAmount', () => {
		it('debe parsear importes con coma decimal y sin miles', () => {
			expect(normalizeAmount('-45,20')).toEqual({ amount: '45.20', type: 'expense' });
			expect(normalizeAmount('1500,75')).toEqual({ amount: '1500.75', type: 'income' });
			expect(normalizeAmount('+12,50')).toEqual({ amount: '12.50', type: 'income' });
		});

		it('debe parsear importes con formato europeo (punto miles, coma decimal)', () => {
			expect(normalizeAmount('-1.234,56 €')).toEqual({ amount: '1234.56', type: 'expense' });
			expect(normalizeAmount('12.345,67')).toEqual({ amount: '12345.67', type: 'income' });
		});

		it('debe parsear importes con formato americano (coma miles, punto decimal)', () => {
			expect(normalizeAmount('-1,234.56')).toEqual({ amount: '1234.56', type: 'expense' });
			expect(normalizeAmount('12,345.67')).toEqual({ amount: '12345.67', type: 'income' });
		});

		it('debe retornar 0.00 para importes inválidos', () => {
			expect(normalizeAmount('abc')).toEqual({ amount: '0.00', type: 'expense' });
		});
	});

	describe('normalizeDate', () => {
		it('debe normalizar fechas DD/MM/YYYY o DD-MM-YYYY', () => {
			expect(normalizeDate('05/06/2026')).toBe('2026-06-05');
			expect(normalizeDate('5-6-2026')).toBe('2026-06-05');
		});

		it('debe normalizar fechas YYYY-MM-DD', () => {
			expect(normalizeDate('2026/06/05')).toBe('2026-06-05');
			expect(normalizeDate('2026-06-05')).toBe('2026-06-05');
		});

		it('debe retornar la fecha actual para valores inválidos', () => {
			const today = new Date().toISOString().substring(0, 10);
			expect(normalizeDate('fecha-invalida')).toBe(today);
		});
	});

	describe('detectSeparator', () => {
		it('debe detectar punto y coma', () => {
			expect(detectSeparator('fecha;concepto;importe\n05/06/2026;Mercadona;-45,20')).toBe(';');
		});

		it('debe detectar coma', () => {
			expect(detectSeparator('fecha,concepto,importe\n05/06/2026,Mercadona,-45.20')).toBe(',');
		});

		it('debe detectar tabulador', () => {
			expect(detectSeparator('fecha\tconcepto\timporte\n05/06/2026\tMercadona\t-45.20')).toBe('\t');
		});
	});

	describe('parseCSV', () => {
		it('debe parsear filas de un CSV estándar', () => {
			const csv = '05/06/2026;Mercadona;-45,20\n06/06/2026;Nómina;1500,00';
			const rows = parseCSV(csv, ';');
			expect(rows).toHaveLength(2);
			expect(rows[0]).toEqual(['05/06/2026', 'Mercadona', '-45,20']);
			expect(rows[1]).toEqual(['06/06/2026', 'Nómina', '1500,00']);
		});

		it('debe respetar comillas dobles y comas/punto y comas dentro de ellas', () => {
			const csv = '05/06/2026;"Mercadona, S.A.";-45,20\n06/06/2026;Nómina;1500,00';
			const rows = parseCSV(csv, ';');
			expect(rows).toHaveLength(2);
			expect(rows[0]).toEqual(['05/06/2026', 'Mercadona, S.A.', '-45,20']);
		});
	});

	describe('processParsedRows', () => {
		it('debe convertir filas en ImportedTransactions', () => {
			const rows = [
				['Fecha', 'Concepto', 'Importe'],
				['05/06/2026', 'Mercadona', '-45,20'],
				['06/06/2026', 'Nómina', '1500,00']
			];
			const txs = processParsedRows(rows, { dateCol: 0, descCol: 1, amountCol: 2, hasHeader: true });
			expect(txs).toHaveLength(2);
			expect(txs[0].date).toBe('2026-06-05');
			expect(txs[0].desc).toBe('Mercadona');
			expect(txs[0].amount).toBe('45.20');
			expect(txs[0].type).toBe('expense');
			expect(txs[0].tag).toBe('Alimentación'); // deducido automáticamente

			expect(txs[1].date).toBe('2026-06-06');
			expect(txs[1].desc).toBe('Nómina');
			expect(txs[1].amount).toBe('1500.00');
			expect(txs[1].type).toBe('income');
			expect(txs[1].tag).toBe('Sueldo');
		});
	});

	describe('detectDuplicates', () => {
		it('debe marcar como duplicados si coinciden importe, fecha e indicio de concepto', () => {
			const imported = [
				{
					id: 'i1',
					date: '2026-06-05',
					desc: 'Mercadona Super',
					amount: '45.20',
					type: 'expense' as const,
					tag: 'Alimentación',
					selected: true,
					isDuplicate: false,
					owner: 'joint' as const,
					paidBy: 'shared' as const
				},
				{
					id: 'i2',
					date: '2026-06-06',
					desc: 'Gimnasio',
					amount: '30.00',
					type: 'expense' as const,
					tag: 'Ocio',
					selected: true,
					isDuplicate: false,
					owner: 'joint' as const,
					paidBy: 'shared' as const
				}
			];

			const existing: Transaction[] = [
				{
					id: 't1',
					desc: 'MERCADONA S.A.',
					money: { amount: '45.20', currency: 'EUR' },
					type: 'expense',
					tag: 'Alimentación',
					date: '2026-06-05',
					owner: 'joint'
				}
			];

			const result = detectDuplicates(imported, existing);
			expect(result[0].isDuplicate).toBe(true);
			expect(result[0].selected).toBe(false); // desmarcado por defecto
			expect(result[1].isDuplicate).toBe(false);
			expect(result[1].selected).toBe(true);
		});
	});

	describe('askGeminiToParseStatement', () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});

		it('debe procesar texto de extracto utilizando Gemini y retornar transacciones', async () => {
			const fakeResponse = `
{
  "transactions": [
    {
      "date": "05/06/2026",
      "desc": "PAGO MERCADONA",
      "amount": "45.20",
      "type": "expense",
      "tag": "Alimentación"
    }
  ]
}
			`;
			vi.mocked(askGemini).mockResolvedValue(fakeResponse);

			const result = await askGeminiToParseStatement('api-key-test', 'Texto de extracto');
			expect(result).toHaveLength(1);
			expect(result[0].desc).toBe('PAGO MERCADONA');
			expect(result[0].amount).toBe('45.20');
			expect(result[0].date).toBe('2026-06-05');
			expect(result[0].type).toBe('expense');
		});

		it('debe limpiar bloques markdown si Gemini los incluye', async () => {
			const fakeResponse = '```json\n{\n  "transactions": []\n}\n```';
			vi.mocked(askGemini).mockResolvedValue(fakeResponse);

			const result = await askGeminiToParseStatement('api-key-test', 'Texto de extracto');
			expect(result).toHaveLength(0);
		});

		it('debe lanzar error si falla el parseo JSON de Gemini', async () => {
			vi.mocked(askGemini).mockResolvedValue('Respuesta no JSON');

			await expect(askGeminiToParseStatement('api-key-test', 'Texto de extracto')).rejects.toThrow(
				'No se pudo procesar el extracto con IA'
			);
		});
	});

	describe('askGeminiToParsePdf', () => {
		it('debe procesar un PDF en base64 enviándolo a Gemini y retornar transacciones', async () => {
			const fakeResponse = {
				ok: true,
				json: async () => ({
					candidates: [
						{
							content: {
								parts: [
									{
										text: JSON.stringify({
											transactions: [
												{
													date: '05/06/2026',
													desc: 'PAGO COMPRA',
													amount: '12.50',
													type: 'expense',
													tag: 'Otros'
												}
											]
										})
									}
								]
							}
						}
					]
				})
			};
			
			const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(fakeResponse as any);
			
			const result = await askGeminiToParsePdf('api-key-test', 'pdf-base64-data');
			expect(result).toHaveLength(1);
			expect(result[0].desc).toBe('PAGO COMPRA');
			expect(result[0].amount).toBe('12.50');
			expect(result[0].type).toBe('expense');
			expect(fetchSpy).toHaveBeenCalled();
			
			fetchSpy.mockRestore();
		});

		it('debe lanzar error si la llamada API retorna error', async () => {
			const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn: any) => {
				fn();
				return 0 as any;
			});
			const fakeResponse = {
				ok: false,
				status: 500
			};
			const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(fakeResponse as any);
			
			await expect(askGeminiToParsePdf('api-key-test', 'pdf-base64-data')).rejects.toThrow(
				'No se pudo procesar el extracto PDF con IA'
			);
			
			fetchSpy.mockRestore();
			setTimeoutSpy.mockRestore();
		});
	});
});
