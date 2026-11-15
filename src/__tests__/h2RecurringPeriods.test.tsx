import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { FinanzasProvider } from '../context/FinanzasContext';
import type { FinanzasContextType } from '../context/FinanzasContext';
import { useFinanzas } from '../hooks/useFinanzas';
import { STORAGE_KEYS } from '../constants';
import { calculateProjections, calculateTimelineBalances } from '../services/financeService';
import {
	buildFinanceBackupPayload,
	importFinanceBackupPayload,
	readStoredPeriods,
	saveStoredPeriods,
	setCryptoKey,
	type FinanceBackupSnapshot
} from '../services/storageService';
import { IndexedDBProvider } from '../services/db/idbProvider';
import { autoGenerateMissingPeriods, ensurePeriodsForTransactions } from '../utils/dateUtils';
import { validateAndSanitizeBackup } from '../utils/backupValidator';
import type { Account, Period, Transaction } from '../types';

const tx = (id: string, date: string, extra: Partial<Transaction> = {}): Transaction => ({
	id,
	desc: `Movimiento ${id}`,
	money: { amount: '80.00', currency: 'EUR' },
	type: 'expense',
	tag: 'Otros',
	date,
	recurrence: 'one-off',
	owner: 'joint',
	paidBy: 'shared',
	...extra
});

/** Serie mensual: la raíz en el primer mes y un clone `<serie>-<mes>` en cada uno de los siguientes. */
const serie = (id: string, months: string[], extra: Partial<Transaction> = {}): Transaction[] =>
	months.map((month, index) =>
		tx(index === 0 ? id : `${id}-${month}`, `${month}-15`, {
			recurrence: 'recurring',
			...(index === 0 ? {} : { originId: id }),
			...extra
		})
	);

const monthsOf = (periods: Period[]) => periods.map((p) => p.month).sort();
const inMonth = (transactions: Transaction[], month: string) =>
	transactions.filter((t) => t.date.substring(0, 7) === month);

// =====================================================================
// Contexto completo, sembrado con datos guardados
// =====================================================================
let ctxRef: FinanzasContextType;

const Probe = () => {
	const ctx = useFinanzas();
	ctxRef = ctx;
	return <div data-testid="is-initialized">{String(ctx.isInitialized)}</div>;
};

const seed = (periods: Period[], transactions: Transaction[] = []) => {
	localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
	localStorage.setItem(STORAGE_KEYS.periods, JSON.stringify(periods));
	localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
};

const renderSeeded = async () => {
	(globalThis as typeof globalThis & { __resetMockIndexedDBForTests?: () => void }).__resetMockIndexedDBForTests?.();
	localStorage.removeItem('finanzas_v5_unified_idb');
	localStorage.removeItem('finanzas_v4_idb_migrated');
	render(
		<FinanzasProvider>
			<Probe />
		</FinanzasProvider>
	);
	await screen.findByText('true', { selector: '[data-testid="is-initialized"]' });
	return () => ctxRef;
};

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));
	setCryptoKey(null);
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.restoreAllMocks();
	(globalThis as typeof globalThis & { __resetMockIndexedDBForTests?: () => void }).__resetMockIndexedDBForTests?.();
	localStorage.clear();
});

describe('H2-A · los movimientos de meses sin periodo se ven y cuentan', () => {
	it('un movimiento anterior al primer mes crea los meses que faltan y no mueve el saldo del mes configurado', async () => {
		seed([{ month: '2026-05', openingBalance: 1000, isManualInit: true }]);
		const ctx = await renderSeeded();
		const anchorOpening = ctx().timelineBalances['2026-05'].openingBalance;

		await act(async () => {
			ctx().setTransactions((prev) => [
				tx('viejo', '2026-03-10', { type: 'income', money: { amount: '200.00', currency: 'EUR' } }),
				...prev
			]);
		});

		expect(monthsOf(ctx().periods)).toEqual(['2026-03', '2026-04', '2026-05']);
		expect(ctx().timelineBalances['2026-03'].incomes).toBe(200);
		expect(ctx().timelineBalances['2026-05'].openingBalance).toBe(anchorOpening);
		expect(ctx().timelineBalances['2026-03'].openingBalance).toBe(anchorOpening - 200);
		expect(ctx().periods.find((p) => p.month === '2026-05')?.isManualInit).toBe(true);
	});

	it('un movimiento posterior al último mes crea los meses que faltan copiando los recurrentes', async () => {
		seed([{ month: '2026-05', openingBalance: 1000, isManualInit: true }], serie('alquiler', ['2026-05']));
		const ctx = await renderSeeded();

		await act(async () => {
			ctx().setTransactions((prev) => [tx('futuro', '2026-07-02', { money: { amount: '30.00', currency: 'EUR' } }), ...prev]);
		});

		expect(monthsOf(ctx().periods)).toEqual(['2026-05', '2026-06', '2026-07']);
		expect(inMonth(ctx().transactions, '2026-06').map((t) => t.id)).toEqual(['alquiler-2026-06']);
		expect(inMonth(ctx().transactions, '2026-07').map((t) => t.id).sort()).toEqual(['alquiler-2026-07', 'futuro']);
		expect(ctx().timelineBalances['2026-07'].expenses).toBe(110);
	});

	it('los meses anteriores se calculan hacia atrás desde la apertura manual', () => {
		const accounts: Account[] = [{ id: 'acc', name: 'Banco', owner: 'joint', initialBalance: 1000 }];
		const periods: Period[] = [
			{ month: '2026-03', openingBalance: 0 },
			{ month: '2026-04', openingBalance: 0 },
			{ month: '2026-05', openingBalance: 1000, isManualInit: true }
		];
		const transactions = [
			tx('ingreso', '2026-03-10', { type: 'income', money: { amount: '200.00', currency: 'EUR' }, accountId: 'acc' }),
			tx('gasto', '2026-04-10', { money: { amount: '50.00', currency: 'EUR' }, accountId: 'acc' })
		];

		const balances = calculateTimelineBalances(periods, transactions, [], accounts, 'all', 2);

		expect(balances['2026-05'].openingBalance).toBe(1000);
		expect(balances['2026-04'].closingBalance).toBe(1000);
		expect(balances['2026-04'].openingBalance).toBe(1050);
		expect(balances['2026-03'].openingBalance).toBe(850);
	});
});

describe('H2-A · la proyección cuenta cada recurrente una vez', () => {
	it('un recurrente de 100 € repetido seis meses proyecta 100 € al mes', () => {
		const months = ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05'];
		const periods: Period[] = months.map((month, i) => ({ month, openingBalance: 0, isManualInit: i === 0 }));
		const transactions = serie('sueldo', months, { type: 'income', money: { amount: '100.00', currency: 'EUR' } });

		const balances = calculateTimelineBalances(periods, transactions, [], [], 'all', 2);
		const projections = calculateProjections(periods, transactions, [], [], 'all', 2, balances, 3);
		const projected = projections.filter((p) => p.isProjected);

		expect(projected).toHaveLength(3);
		expect(projected.map((p) => p.incomes)).toEqual([100, 100, 100]);
		expect(projected.map((p) => p.assets)).toEqual([700, 800, 900]);
	});

	it('la proyección usa el importe de la serie aunque el último mes tenga una excepción de «solo este»', () => {
		const periods: Period[] = [
			{ month: '2026-04', openingBalance: 0, isManualInit: true },
			{
				month: '2026-05',
				openingBalance: 0,
				skippedRecurring: [tx('luz-2026-05', '2026-05-15', { recurrence: 'recurring', originId: 'luz' })]
			}
		];
		const transactions = [
			tx('luz', '2026-04-15', { recurrence: 'recurring' }),
			tx('luz-2026-05', '2026-05-15', { money: { amount: '140.00', currency: 'EUR' } })
		];

		const balances = calculateTimelineBalances(periods, transactions, [], [], 'all', 2);
		const projected = calculateProjections(periods, transactions, [], [], 'all', 2, balances, 1).filter(
			(p) => p.isProjected
		);

		expect(projected.map((p) => p.expenses)).toEqual([80]);
	});
});

describe('H2-A · «solo este» no corta la serie', () => {
	const twoMonths: Period[] = [
		{ month: '2026-04', openingBalance: 1000, isManualInit: true },
		{ month: '2026-05', openingBalance: 0 }
	];

	it('borrar «solo este» en el último mes: el mes siguiente sigue la serie', async () => {
		seed(twoMonths, serie('alquiler', ['2026-04', '2026-05']));
		const ctx = await renderSeeded();
		vi.spyOn(window, 'confirm').mockReturnValue(false);

		await act(async () => {
			ctx().handleDeleteTransaction('alquiler-2026-05');
		});
		expect(inMonth(ctx().transactions, '2026-05')).toHaveLength(0);

		await act(async () => {
			ctx().handleCreateNextMonth();
		});

		const june = inMonth(ctx().transactions, '2026-06');
		expect(june).toHaveLength(1);
		expect(june[0]).toMatchObject({
			id: 'alquiler-2026-06',
			originId: 'alquiler',
			recurrence: 'recurring',
			money: { amount: '80.00', currency: 'EUR' }
		});
	});

	it('editar «solo este» en el único mes de la serie: el mes siguiente sigue con los datos de antes', async () => {
		seed([{ month: '2026-05', openingBalance: 1000, isManualInit: true }], serie('gimnasio', ['2026-05']));
		const ctx = await renderSeeded();

		await act(async () => {
			ctx().handleStartEditTransaction(ctx().transactions[0]);
		});
		expect(ctx().editScope).toBe('only-this');
		await act(async () => {
			ctx().handleSaveEditTransaction({ preventDefault: () => {} } as never, { ...ctx().editForm, amount: '120' });
		});
		await act(async () => {
			ctx().handleCreateNextMonth();
		});

		expect(inMonth(ctx().transactions, '2026-05')[0]).toMatchObject({
			recurrence: 'one-off',
			money: { amount: '120.00', currency: 'EUR' }
		});
		const june = inMonth(ctx().transactions, '2026-06');
		expect(june).toHaveLength(1);
		expect(june[0]).toMatchObject({
			originId: 'gimnasio',
			recurrence: 'recurring',
			money: { amount: '80.00', currency: 'EUR' }
		});
	});

	it('borrar «este y los siguientes» termina la serie aunque antes se hiciera «solo este»', async () => {
		const months = ['2026-03', '2026-04', '2026-05'];
		seed(
			months.map((month, i) => ({ month, openingBalance: 0, isManualInit: i === 0 })),
			serie('cuota', months)
		);
		const ctx = await renderSeeded();
		const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

		await act(async () => {
			ctx().handleDeleteTransaction('cuota-2026-05');
		});
		confirm.mockReturnValue(true);
		await act(async () => {
			ctx().handleDeleteTransaction('cuota-2026-04');
		});
		await act(async () => {
			ctx().handleCreateNextMonth();
		});

		expect(inMonth(ctx().transactions, '2026-06')).toHaveLength(0);
	});

	it('editar «todos» después de «solo este» cambia también los datos con que sigue la serie', async () => {
		seed(twoMonths, serie('agua', ['2026-04', '2026-05']));
		const ctx = await renderSeeded();
		vi.spyOn(window, 'confirm').mockReturnValue(false);

		await act(async () => {
			ctx().handleDeleteTransaction('agua-2026-05');
		});
		await act(async () => {
			ctx().handleStartEditTransaction(ctx().transactions.find((t) => t.id === 'agua') as Transaction);
		});
		await act(async () => {
			ctx().setEditScope('all');
		});
		await act(async () => {
			ctx().handleSaveEditTransaction({ preventDefault: () => {} } as never, { ...ctx().editForm, amount: '95' });
		});
		await act(async () => {
			ctx().handleCreateNextMonth();
		});

		expect(inMonth(ctx().transactions, '2026-06')[0]).toMatchObject({
			originId: 'agua',
			money: { amount: '95.00', currency: 'EUR' }
		});
	});

	it('al abrir la aplicación en el mes siguiente la serie sigue: la marca se guarda y se relee', async () => {
		const skipped = tx('seguro-2026-05', '2026-05-15', { recurrence: 'recurring', originId: 'seguro' });
		await saveStoredPeriods([
			{ month: '2026-04', openingBalance: 1000, isManualInit: true },
			{ month: '2026-05', openingBalance: 0, skippedRecurring: [skipped] }
		]);
		const stored = await readStoredPeriods([], []);
		expect(stored.find((p) => p.month === '2026-05')?.skippedRecurring).toEqual([skipped]);

		vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
		const generated = autoGenerateMissingPeriods(stored, [tx('seguro', '2026-04-15', { recurrence: 'recurring' })]);

		expect(inMonth(generated.transactions, '2026-06').map((t) => t.id)).toEqual(['seguro-2026-06']);
	});
});

describe('H2-A · periodos guardados por versiones anteriores', () => {
	it('un periodo sin la marca se lee igual que antes', async () => {
		vi.spyOn(IndexedDBProvider.prototype, 'getAllEntities').mockResolvedValue([
			{ month: '2026-05', openingBalance: 100, openingBalanceA: 50, openingBalanceB: 50, isManualInit: true }
		]);

		const stored = await readStoredPeriods([], []);

		expect(stored).toEqual([
			{ month: '2026-05', openingBalance: 100, openingBalanceA: 50, openingBalanceB: 50, isManualInit: true }
		]);
	});

	it('un periodo que necesita migrarse conserva y normaliza sus instancias saltadas', async () => {
		vi.spyOn(IndexedDBProvider.prototype, 'getAllEntities').mockResolvedValue([
			{
				month: '2026-05',
				openingBalance: '100',
				skippedRecurring: [
					{ id: 'seguro-2026-05', desc: 'Seguro', amount: 80, type: 'expense', date: '2026-05-15', recurrence: 'recurring', originId: 'seguro' }
				]
			}
		]);

		const stored = await readStoredPeriods([], []);

		expect(stored[0].openingBalance).toBe(100);
		expect(stored[0].skippedRecurring).toEqual([
			expect.objectContaining({
				id: 'seguro-2026-05',
				originId: 'seguro',
				recurrence: 'recurring',
				owner: 'joint',
				paidBy: 'shared',
				money: { amount: '80.00', currency: 'EUR' }
			})
		]);
	});
});

describe('H2-A · la marca de «solo este» viaja en copia y sincronización', () => {
	const skipped = tx('seguro-2026-05', '2026-05-15', { recurrence: 'recurring', originId: 'seguro' });
	const periods: Period[] = [
		{ month: '2026-04', openingBalance: 1000, isManualInit: true },
		{ month: '2026-05', openingBalance: 0, skippedRecurring: [skipped] }
	];

	it('exportar e importar conserva skippedRecurring', async () => {
		const snapshot: FinanceBackupSnapshot = {
			accounts: [],
			transactions: [tx('seguro', '2026-04-15', { recurrence: 'recurring' })],
			debts: [],
			periods,
			userAName: 'A',
			userBName: 'B',
			geminiApiKey: '',
			chatMessages: [],
			profileCount: 2
		};
		const payload = JSON.parse(JSON.stringify(buildFinanceBackupPayload(snapshot)));
		const imported = await importFinanceBackupPayload(payload);

		expect(imported.periods?.find((p) => p.month === '2026-05')?.skippedRecurring).toEqual([skipped]);
	});

	it('una copia con una instancia saltada inválida se rechaza', () => {
		const payload = {
			[STORAGE_KEYS.backupFormat]: '2',
			[STORAGE_KEYS.periods]: JSON.stringify([
				{ month: '2026-05', openingBalance: 0, openingBalanceA: 0, openingBalanceB: 0, skippedRecurring: [{ id: 'x' }] }
			])
		};

		expect(() => validateAndSanitizeBackup(payload)).toThrow(/skippedRecurring/);
	});

	it('una copia anterior, sin la marca, se sigue importando', () => {
		const validated = validateAndSanitizeBackup({
			[STORAGE_KEYS.backupFormat]: '2',
			[STORAGE_KEYS.periods]: JSON.stringify([
				{ month: '2026-05', openingBalance: 0, openingBalanceA: 0, openingBalanceB: 0 }
			])
		});
		const validatedPeriods = validated[STORAGE_KEYS.periods] as Period[];

		expect(validatedPeriods[0].skippedRecurring).toBeUndefined();
	});
});

describe('H2-A · ensurePeriodsForTransactions', () => {
	it('sin movimientos fuera de rango no cambia nada', () => {
		const periods: Period[] = [{ month: '2026-05', openingBalance: 0, isManualInit: true }];
		const transactions = [tx('a', '2026-05-01')];

		const result = ensurePeriodsForTransactions(periods, transactions);

		expect(result.periods).toBe(periods);
		expect(result.transactions).toBe(transactions);
	});

	it('sin periodos no crea ninguno', () => {
		const result = ensurePeriodsForTransactions([], [tx('a', '2026-05-01')]);

		expect(result.periods).toEqual([]);
	});

	it('al añadir meses por delante sin apertura manual, el antiguo primer mes pasa a serlo', () => {
		const periods: Period[] = [
			{ month: '2026-05', openingBalance: 0 },
			{ month: '2026-06', openingBalance: 0 }
		];

		const result = ensurePeriodsForTransactions(periods, [tx('a', '2026-03-01')]);

		expect(result.periods.map((p) => [p.month, !!p.isManualInit])).toEqual([
			['2026-03', false],
			['2026-04', false],
			['2026-05', true],
			['2026-06', false]
		]);
	});
});
