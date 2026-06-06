import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	normalizeAmount,
	normalizeDate,
	detectSeparator,
	parseCSV,
	processParsedRows,
	detectDuplicates,
	prepareImportedTransactions,
	correlateInternalTransfers,
	formatImportedTransactionsForPersistence,
	askGeminiToParseStatement,
	askGeminiToParsePdf
} from '../services/statementImportService';
import { askGemini } from '../services/geminiService';
import type { ImportedTransaction, Transaction } from '../types';

vi.mock('../services/geminiService', () => ({
	askGemini: vi.fn()
}));

const createImportedFixture = (overrides: Partial<ImportedTransaction> & { accountId?: string } = {}): ImportedTransaction => ({
	id: overrides.id ?? 'imported-fixture',
	date: overrides.date ?? '2026-06-05',
	desc: overrides.desc ?? 'Transferencia entre cuentas',
	amount: overrides.amount ?? '250.00',
	type: overrides.type ?? 'expense',
	tag: overrides.tag ?? 'Otros Gastos',
	selected: overrides.selected ?? true,
	isDuplicate: overrides.isDuplicate ?? false,
	owner: overrides.owner ?? 'joint',
	paidBy: overrides.paidBy ?? 'shared',
	originalType: overrides.originalType ?? overrides.type ?? 'expense',
	accountId: overrides.accountId,
	fromAccountId: overrides.fromAccountId,
	toAccountId: overrides.toAccountId,
	importFingerprint: overrides.importFingerprint,
	sourceName: overrides.sourceName,
	transferCorrelationId: overrides.transferCorrelationId
});

const createPreparedFixture = (overrides: Partial<ImportedTransaction> & { accountId: string }): ImportedTransaction => {
	const [prepared] = prepareImportedTransactions({
		transactions: [createImportedFixture(overrides)],
		accountId: overrides.accountId,
		sourceName: overrides.sourceName ?? `${overrides.accountId}.csv`,
		accountOwner: overrides.owner ?? 'joint'
	});

	return prepared;
};

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

		it('debe crear el mismo importFingerprint para el mismo CSV importado dos veces en la misma cuenta', () => {
			const rows = [
				['Fecha', 'Concepto', 'Importe'],
				['05/06/2026', 'Transferencia recibida', '250,00']
			];
			const parsed = processParsedRows(rows, { dateCol: 0, descCol: 1, amountCol: 2, hasHeader: true });

			const firstImport = prepareImportedTransactions({
				transactions: parsed,
				accountId: 'account-a',
				sourceName: 'extracto.csv',
				accountOwner: 'joint'
			});
			const secondImport = prepareImportedTransactions({
				transactions: parsed,
				accountId: 'account-a',
				sourceName: 'extracto.csv',
				accountOwner: 'joint'
			});

			expect(firstImport[0].importFingerprint).toBe(secondImport[0].importFingerprint);
			expect(firstImport[0].id).toBe(secondImport[0].id);
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

		it('debe marcar duplicados por fingerprint, fecha, importe y cuenta', () => {
			const imported = prepareImportedTransactions({
				transactions: [createImportedFixture({ id: 'random-id', desc: 'Mercadona Super', amount: '45.20', type: 'expense' })],
				accountId: 'checking',
				sourceName: 'checking.csv',
				accountOwner: 'joint'
			});
			const existing: Transaction[] = [
				{
					id: imported[0].importFingerprint!,
					desc: 'Mercadona Super',
					money: { amount: '45.20', currency: 'EUR' },
					type: 'expense',
					tag: 'Alimentación',
					date: '2026-06-05',
					owner: 'joint',
					accountId: 'checking'
				}
			];

			const result = detectDuplicates(imported, existing);

			expect(result[0].isDuplicate).toBe(true);
			expect(result[0].selected).toBe(false);
		});

		it('debe detectar como duplicado un traspaso manual reimportado desde su fila original', () => {
			const [imported] = prepareImportedTransactions({
				transactions: [createImportedFixture({ id: 'csv-row-1', desc: 'Traspaso hucha', amount: '150.00', type: 'income' })],
				accountId: 'savings',
				sourceName: 'extracto.csv',
				accountOwner: 'userB'
			});
			const existing: Transaction[] = [
				{
					id: imported.importFingerprint!,
					desc: 'Traspaso hucha',
					money: { amount: '150.00', currency: 'EUR' },
					type: 'transfer',
					tag: 'Traspaso',
					date: imported.date,
					owner: 'joint',
					fromAccountId: 'checking',
					toAccountId: 'savings'
				}
			];

			const result = detectDuplicates([imported], existing);

			expect(result[0].isDuplicate).toBe(true);
			expect(result[0].selected).toBe(false);
		});

		it('no debe marcar como duplicado un movimiento regular igual en otra cuenta', () => {
			const imported = prepareImportedTransactions({
				transactions: [createImportedFixture({ id: 'csv-row-2', desc: 'Mercadona Super', amount: '45.20', type: 'expense' })],
				accountId: 'credit-card',
				sourceName: 'credit-card.csv',
				accountOwner: 'joint'
			});
			const existing: Transaction[] = [
				{
					id: 'checking-existing-transaction',
					desc: 'Mercadona Super',
					money: { amount: '45.20', currency: 'EUR' },
					type: 'expense',
					tag: 'Alimentación',
					date: imported[0].date,
					owner: 'joint',
					accountId: 'checking'
				}
			];

			const result = detectDuplicates(imported, existing);

			expect(result[0].isDuplicate).toBe(false);
			expect(result[0].selected).toBe(true);
		});
	});

	describe('correlateInternalTransfers', () => {
		it('debe correlacionar gasto e ingreso de mismo día e importe en cuentas distintas', () => {
			const result = correlateInternalTransfers([
				createPreparedFixture({ id: 'out', type: 'expense', accountId: 'account-a', desc: 'Transferencia enviada' }),
				createPreparedFixture({ id: 'in', type: 'income', accountId: 'account-b', desc: 'Transferencia recibida' })
			]);

			expect(result[0].type).toBe('transfer');
			expect(result[0].transferCorrelationId).toBe(result[1].transferCorrelationId);
			expect(result[0].fromAccountId).toBe('account-a');
			expect(result[0].toAccountId).toBe('account-b');
		});

		it('no debe correlacionar movimientos comunes aunque coincidan fecha e importe', () => {
			const result = correlateInternalTransfers([
				createPreparedFixture({ id: 'salary', type: 'income', accountId: 'account-a', desc: 'Nómina empresa', tag: 'Sueldo' }),
				createPreparedFixture({ id: 'expense', type: 'expense', accountId: 'account-b', desc: 'Compra supermercado', tag: 'Alimentación' })
			]);

			expect(result).toHaveLength(2);
			expect(result[0]).toMatchObject({ type: 'income', transferCorrelationId: undefined });
			expect(result[1]).toMatchObject({ type: 'expense', transferCorrelationId: undefined });
		});

		it('no debe correlacionar movimientos de la misma cuenta', () => {
			const result = correlateInternalTransfers([
				createPreparedFixture({ id: 'out', type: 'expense', accountId: 'account-a' }),
				createPreparedFixture({ id: 'in', type: 'income', accountId: 'account-a' })
			]);

			expect(result.every((tx) => tx.transferCorrelationId === undefined)).toBe(true);
			expect(result.every((tx) => tx.type !== 'transfer')).toBe(true);
		});

		it('no debe auto-correlacionar cuando hay múltiples matches posibles', () => {
			const result = correlateInternalTransfers([
				createPreparedFixture({ id: 'out', type: 'expense', accountId: 'account-a' }),
				createPreparedFixture({ id: 'in-a', type: 'income', accountId: 'account-b' }),
				createPreparedFixture({ id: 'in-b', type: 'income', accountId: 'account-c' })
			]);

			expect(result.every((tx) => tx.transferCorrelationId === undefined)).toBe(true);
			expect(result.every((tx) => tx.type !== 'transfer')).toBe(true);
		});

		it('debe mantener transferencias no correlacionadas como gasto o ingreso externo', () => {
			const result = correlateInternalTransfers([
				createPreparedFixture({ id: 'out', type: 'expense', accountId: 'account-a', desc: 'Transferencia SEPA a tercero' })
			]);

			expect(result[0].type).toBe('expense');
			expect(result[0].tag).toBe('Transferencia externa');
			expect(result[0].transferCorrelationId).toBeUndefined();
		});
	});

		describe('formatImportedTransactionsForPersistence', () => {
		it('debe persistir una transacción preparada de texto IA con la cuenta seleccionada', () => {
			const [prepared] = prepareImportedTransactions({
				transactions: [createImportedFixture({ id: 'ai-row-1', desc: 'PAGO MERCADONA', amount: '45.20', type: 'expense' })],
				accountId: 'checking',
				sourceName: 'Texto pegado (IA)',
				accountOwner: 'userA'
			});

			const result = formatImportedTransactionsForPersistence([prepared], []);

			expect(result[0]).toMatchObject({
				type: 'expense',
				accountId: 'checking',
				owner: 'userA',
				paidBy: 'userA'
			});
		});

		it('debe persistir una correlación interna como una sola Transaction con cuenta origen y destino', () => {
			const correlated = correlateInternalTransfers([
				createPreparedFixture({ id: 'out', type: 'expense', accountId: 'account-a' }),
				createPreparedFixture({ id: 'in', type: 'income', accountId: 'account-b' })
			]);

			const result = formatImportedTransactionsForPersistence(correlated, []);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				type: 'transfer',
				fromAccountId: 'account-a',
				toAccountId: 'account-b',
				accountId: undefined,
				money: { amount: '250.00', currency: 'EUR' }
			});
		});

		it('no vuelve a persistir una transferencia interna correlacionada ya importada', () => {
			const correlated = correlateInternalTransfers([
				createPreparedFixture({ id: 'out', type: 'expense', accountId: 'account-a', desc: 'Transferencia enviada' }),
				createPreparedFixture({ id: 'in', type: 'income', accountId: 'account-b', desc: 'Transferencia recibida' })
			]);
			const existing: Transaction[] = [
				{
					id: correlated[0].transferCorrelationId!,
					desc: correlated[0].desc,
					money: { amount: correlated[0].amount, currency: 'EUR' },
					type: 'transfer',
					tag: 'Traspaso',
					date: correlated[0].date,
					owner: 'joint',
					fromAccountId: 'account-a',
					toAccountId: 'account-b'
				}
			];

			const checked = detectDuplicates(correlated, existing);
			const result = formatImportedTransactionsForPersistence(checked, []);

			expect(result).toHaveLength(0);
		});

		it('debe persistir dos traspasos internos opuestos del mismo día e importe como dos movimientos', () => {
			const correlated = correlateInternalTransfers([
				createPreparedFixture({ id: 'out-001', type: 'expense', accountId: 'account-a', desc: 'Transferencia enviada operacion 001' }),
				createPreparedFixture({ id: 'in-001', type: 'income', accountId: 'account-b', desc: 'Transferencia recibida operacion 001' }),
				createPreparedFixture({ id: 'out-002', type: 'expense', accountId: 'account-b', desc: 'Transferencia enviada operacion 002' }),
				createPreparedFixture({ id: 'in-002', type: 'income', accountId: 'account-a', desc: 'Transferencia recibida operacion 002' })
			]);

			const result = formatImportedTransactionsForPersistence(correlated, []);

			expect(result).toHaveLength(2);
			expect(result.map((tx) => tx.id)).toHaveLength(new Set(result.map((tx) => tx.id)).size);
			expect(result).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ type: 'transfer', fromAccountId: 'account-a', toAccountId: 'account-b' }),
					expect.objectContaining({ type: 'transfer', fromAccountId: 'account-b', toAccountId: 'account-a' })
				])
			);
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
			
			const result = await askGeminiToParsePdf('api-key-test', 'pdf-base64-data', { accountName: 'Cuenta nómina' });
			expect(result).toHaveLength(1);
			expect(result[0].desc).toBe('PAGO COMPRA');
			expect(result[0].amount).toBe('12.50');
			expect(result[0].type).toBe('expense');
			expect(fetchSpy).toHaveBeenCalled();
			expect(JSON.stringify(fetchSpy.mock.calls[0][1]?.body)).toContain('Cuenta nómina');
			
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
