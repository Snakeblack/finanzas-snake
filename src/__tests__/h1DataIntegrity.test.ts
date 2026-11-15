// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	buildFinanceBackupPayload,
	importFinanceBackupPayload,
	readStoredAccounts,
	readStoredPeriods,
	readStoredTransactions,
	saveStoredAccounts,
	saveStoredPeriods,
	saveStoredTransactions,
	setCryptoKey,
	type FinanceBackupSnapshot
} from '../services/storageService';
import { autoGenerateMissingPeriods, cloneRecurringForMonth, reconfigurePeriods } from '../utils/dateUtils';
import { moveWithinDay, sortForDisplay } from '../utils/transactionOrder';
import { validateAndSanitizeBackup } from '../utils/backupValidator';
import { STORAGE_KEYS } from '../constants';
import type { Account, Period, Transaction } from '../types';

const tx = (id: string, date: string, extra: Partial<Transaction> = {}): Transaction => ({
	id,
	desc: `Movimiento ${id}`,
	money: { amount: '10.00', currency: 'EUR' },
	type: 'expense',
	tag: 'Otros',
	date,
	recurrence: 'one-off',
	owner: 'userA',
	paidBy: 'userA',
	...extra
});

beforeEach(() => {
	localStorage.clear();
	setCryptoKey(null);
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('«Configurar cuenta» conserva los periodos', () => {
	const periods: Period[] = [
		{ month: '2026-08', openingBalance: 100, isManualInit: true },
		{ month: '2026-09', openingBalance: 0 },
		{ month: '2026-10', openingBalance: 0 },
		{ month: '2026-11', openingBalance: 0 }
	];

	it('sin cambiar el mes de inicio mantiene todos los meses y solo actualiza la apertura', () => {
		const result = reconfigurePeriods(periods, '2026-08', 250);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.periods.map((p) => p.month)).toEqual(['2026-08', '2026-09', '2026-10', '2026-11']);
		expect(result.periods[0]).toEqual({ month: '2026-08', openingBalance: 250, isManualInit: true });
	});

	it('tras reconfigurar y recargar no se duplican los recurrentes', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-11-15T12:00:00Z'));
		const alquiler = tx('alquiler', '2026-08-01', { recurrence: 'recurring' });
		const transactions = [
			alquiler,
			...['2026-09', '2026-10', '2026-11'].map((month) =>
				tx(`alquiler-${month}`, `${month}-01`, { recurrence: 'recurring', originId: 'alquiler' })
			)
		];

		const result = reconfigurePeriods(periods, '2026-08', 250);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const reloaded = autoGenerateMissingPeriods(result.periods, transactions);

		expect(reloaded.transactions).toHaveLength(4);
		expect(reloaded.periods).toHaveLength(4);
	});

	it('rechaza un mes de inicio posterior al primero existente y no cambia nada', () => {
		const result = reconfigurePeriods(periods, '2026-10', 250);

		expect(result).toEqual({ ok: false, reason: 'earlier-periods-exist', firstMonth: '2026-08' });
	});

	it('con un mes de inicio anterior añade meses vacíos y mueve la apertura manual', () => {
		const result = reconfigurePeriods(periods, '2026-06', 250);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.periods.map((p) => p.month)).toEqual([
			'2026-06',
			'2026-07',
			'2026-08',
			'2026-09',
			'2026-10',
			'2026-11'
		]);
		expect(result.periods[0]).toEqual({ month: '2026-06', openingBalance: 250, isManualInit: true });
		expect(result.periods[1]).toEqual({ month: '2026-07', openingBalance: 0 });
		expect(result.periods.filter((p) => p.isManualInit)).toHaveLength(1);
		expect(result.periods[2].openingBalance).toBe(0);
	});

	it('sin periodos previos crea el primero', () => {
		const result = reconfigurePeriods([], '2026-11', 50);

		expect(result).toEqual({
			ok: true,
			periods: [{ month: '2026-11', openingBalance: 50, isManualInit: true }]
		});
	});
});

describe('cuentas y periodos se guardan en una sola operación', () => {
	/** Un valor que IndexedDB no puede clonar: la escritura falla después de haber empezado. */
	const noClonable = () => undefined;

	it('un fallo al guardar periodos deja los periodos anteriores', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const anteriores: Period[] = [
			{ month: '2026-10', openingBalance: 100, isManualInit: true },
			{ month: '2026-11', openingBalance: 0, isManualInit: false }
		];
		await saveStoredPeriods(anteriores);

		const rotos = [{ month: '2026-12', openingBalance: 0, extra: noClonable }] as unknown as Period[];
		await expect(saveStoredPeriods(rotos)).rejects.toThrow();

		expect((await readStoredPeriods([], [])).map((p) => p.month).sort()).toEqual(['2026-10', '2026-11']);
	});

	it('un fallo al guardar cuentas deja las cuentas anteriores', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const anteriores: Account[] = [{ id: 'acc-a', name: 'Principal', owner: 'userA', initialBalance: 100 }];
		await saveStoredAccounts(anteriores);

		const rotas = [
			{ id: 'acc-b', name: 'Rota', owner: 'userA', initialBalance: 0, extra: noClonable }
		] as unknown as Account[];
		await expect(saveStoredAccounts(rotas)).rejects.toThrow();

		expect((await readStoredAccounts()).map((a) => a.id)).toEqual(['acc-a']);
	});

	it('guardar sustituye la colección: lo que ya no está desaparece', async () => {
		await saveStoredPeriods([
			{ month: '2026-10', openingBalance: 100, isManualInit: true },
			{ month: '2026-11', openingBalance: 0, isManualInit: false }
		]);
		await saveStoredPeriods([{ month: '2026-11', openingBalance: 5, isManualInit: true }]);

		expect(await readStoredPeriods([], [])).toEqual([
			expect.objectContaining({ month: '2026-11', openingBalance: 5, isManualInit: true })
		]);
	});
});

describe('el orden manual de movimientos se guarda', () => {
	const delDia = [tx('a', '2026-11-10'), tx('b', '2026-11-10'), tx('c', '2026-11-10')];
	const otroDia = tx('z', '2026-11-12');

	it('arrastrar dentro del mismo día cambia el orden mostrado', () => {
		const moved = moveWithinDay([otroDia, ...delDia], 'c', 'a');

		expect(sortForDisplay(moved).map((t) => t.id)).toEqual(['z', 'c', 'a', 'b']);
		expect(moved.find((t) => t.id === 'z')?.sortIndex).toBeUndefined();
	});

	it('arrastrar entre días distintos no cambia nada', () => {
		const transactions = [otroDia, ...delDia];

		expect(moveWithinDay(transactions, 'z', 'a')).toBe(transactions);
	});

	it('el orden elegido sobrevive a guardar y recargar', async () => {
		const initial = [otroDia, ...delDia];
		await saveStoredTransactions(initial);
		await readStoredTransactions();

		await saveStoredTransactions(moveWithinDay(initial, 'c', 'a'));
		const reloaded = await readStoredTransactions();

		expect(sortForDisplay(reloaded).map((t) => t.id)).toEqual(['z', 'c', 'a', 'b']);
	});

	it('un movimiento nuevo del mismo día aparece antes que los ya ordenados', () => {
		const moved = moveWithinDay(delDia, 'c', 'a');

		expect(sortForDisplay([tx('nuevo', '2026-11-10'), ...moved]).map((t) => t.id)).toEqual([
			'nuevo',
			'c',
			'a',
			'b'
		]);
	});

	it('el clon de un recurrente en otro mes no hereda el orden manual', () => {
		const recurrente = tx('r', '2026-11-10', { recurrence: 'recurring', sortIndex: 2 });

		const [clon] = cloneRecurringForMonth([recurrente], '2026-11', '2026-12');

		expect(clon.sortIndex).toBeUndefined();
	});

	it('el orden viaja en la copia y en la sincronización', async () => {
		const moved = moveWithinDay(delDia, 'c', 'a');
		const snapshot: FinanceBackupSnapshot = {
			accounts: [{ id: 'acc-a', name: 'Principal', owner: 'userA', initialBalance: 0 }],
			transactions: moved,
			debts: [],
			periods: [{ month: '2026-11', openingBalance: 0, isManualInit: true }],
			userAName: 'Ana',
			userBName: 'Bruno',
			geminiApiKey: '',
			chatMessages: [],
			profileCount: 1
		};

		const payload = JSON.parse(JSON.stringify(buildFinanceBackupPayload(snapshot)));
		const imported = await importFinanceBackupPayload(payload);

		expect(sortForDisplay(imported.transactions ?? []).map((t) => t.id)).toEqual(['c', 'a', 'b']);
	});

	it('una copia anterior, sin orden, se sigue importando', () => {
		const validated = validateAndSanitizeBackup({
			[STORAGE_KEYS.backupFormat]: '2',
			[STORAGE_KEYS.transactions]: JSON.stringify(delDia)
		});
		const transactions = validated[STORAGE_KEYS.transactions] as Transaction[];

		expect(transactions).toHaveLength(3);
		expect(transactions.every((t) => t.sortIndex === undefined)).toBe(true);
	});

	it('una copia con un orden inválido se rechaza', () => {
		const payload = {
			[STORAGE_KEYS.backupFormat]: '2',
			[STORAGE_KEYS.transactions]: JSON.stringify([{ ...delDia[0], sortIndex: -1.5 }])
		};

		expect(() => validateAndSanitizeBackup(payload)).toThrow(/sortIndex/);
	});
});
