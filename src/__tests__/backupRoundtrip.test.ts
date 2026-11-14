// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { STORAGE_KEYS } from '../constants';
import {
	buildFinanceBackupPayload,
	importFinanceBackupPayload,
	executeSilentMigrationIfRequired,
	readProfileCount,
	readStoredAccounts,
	readStoredDebts,
	readStoredTransactions,
	readUserNames,
	saveStoredAccounts,
	saveStoredDebts,
	saveStoredTransactions,
	saveUserNames,
	setCryptoKey,
	type FinanceBackupSnapshot
} from '../services/storageService';
import { autoGenerateMissingPeriods } from '../utils/dateUtils';
import { applyImportedBackup } from '../hooks/useBackupSync';
import type { Account, PaymentPlanDebt, Period, Transaction } from '../types';

const TEXTO = `Café & "Té" <3 d'Or`;

const baseTx: Transaction = {
	id: 'serie-1',
	desc: TEXTO,
	money: { amount: '12.50', currency: 'EUR' },
	type: 'expense',
	tag: 'Ocio & Cultura',
	date: '2026-01-15',
	recurrence: 'recurring',
	owner: 'userA',
	paidBy: 'userA',
	accountId: 'acc-a'
};

const accounts: Account[] = [{ id: 'acc-a', name: 'Ahorro & Gastos', owner: 'userA', initialBalance: 100 }];

const debts: PaymentPlanDebt[] = [
	{
		id: 'debt-1',
		kind: 'paymentPlan',
		desc: 'Sofá <oferta>',
		tag: 'Hogar & Jardín',
		date: '2026-01',
		owner: 'userA',
		financedAmount: 100,
		fees: 0,
		totalToPay: 100,
		installments: [{ id: 'inst-1', dueMonth: '2026-02', amount: 100, status: 'pending', label: 'Cuota "1"' }]
	}
];

const periods: Period[] = [
	{ month: '2026-01', openingBalance: 0, openingBalanceA: 0, openingBalanceB: 0, isManualInit: false }
];

const snapshot = (overrides: Partial<FinanceBackupSnapshot> = {}): FinanceBackupSnapshot => ({
	accounts,
	transactions: [baseTx, { ...baseTx, id: 'serie-1-2026-02', date: '2026-02-15', originId: 'serie-1' }],
	debts,
	periods,
	userAName: 'Ana & Cía',
	userBName: 'Bruno',
	geminiApiKey: '',
	chatMessages: [],
	profileCount: 1,
	...overrides
});

/** Simula el viaje real: el archivo o el canal de sincronización transportan JSON. */
const viajar = (payload: unknown): Record<string, unknown> => JSON.parse(JSON.stringify(payload));

const escapar = (str: string): string =>
	str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');

beforeEach(() => {
	localStorage.clear();
	setCryptoKey(null);
	globalThis.__resetMockIndexedDBForTests?.();
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('Ida y vuelta de una copia o sincronización', () => {
	it('conserva el vínculo de serie recurrente, los textos y el número de perfiles', async () => {
		const original = snapshot();

		const imported = await importFinanceBackupPayload(viajar(buildFinanceBackupPayload(original)));

		expect(imported.transactions).toEqual(original.transactions);
		expect(imported.accounts).toEqual(original.accounts);
		expect(imported.debts).toEqual(original.debts);
		expect(imported.userAName).toBe('Ana & Cía');
		expect(imported.profileCount).toBe(1);
		await expect(readStoredTransactions()).resolves.toEqual(original.transactions);
		await expect(readProfileCount()).resolves.toBe(1);
	});

	it('no altera los textos por muchas rondas que se hagan', async () => {
		let current = snapshot();
		for (let ronda = 0; ronda < 3; ronda++) {
			const imported = await importFinanceBackupPayload(viajar(buildFinanceBackupPayload(current)));
			current = snapshot({
				transactions: imported.transactions,
				accounts: imported.accounts,
				debts: imported.debts,
				userAName: imported.userAName
			});
		}

		expect(current.transactions[0].desc).toBe(TEXTO);
		expect(current.accounts[0].name).toBe('Ahorro & Gastos');
		expect(current.userAName).toBe('Ana & Cía');
	});

	it('una copia actual conserva un texto que contiene una entidad escrita a propósito', async () => {
		const literal = { ...baseTx, id: 'literal', desc: 'Apuntes de HTML: &amp; y &lt;' };

		const imported = await importFinanceBackupPayload(
			viajar(buildFinanceBackupPayload(snapshot({ transactions: [literal] })))
		);

		expect(imported.transactions?.[0].desc).toBe('Apuntes de HTML: &amp; y &lt;');
	});
});

describe('Identificadores de los clones de recurrentes', () => {
	it('tras muchos meses siguen acotados, son únicos y la copia se reimporta', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2029-06-15T12:00:00Z'));
		const uuid = '3f2b8c1e-7a4d-4e9b-9c55-0d6a1b2c3d4e';
		const serie = { ...baseTx, id: uuid };

		const generated = autoGenerateMissingPeriods(periods, [serie]);
		vi.useRealTimers();

		const ids = generated.transactions.map((t) => t.id);
		expect(generated.transactions).toHaveLength(42);
		expect(new Set(ids).size).toBe(ids.length);
		expect(Math.max(...ids.map((id) => id.length))).toBe(`${uuid}-2029-06`.length);
		expect(generated.transactions.filter((t) => t.id !== uuid).every((t) => t.originId === uuid)).toBe(true);

		const imported = await importFinanceBackupPayload(
			viajar(
				buildFinanceBackupPayload(
					snapshot({ transactions: generated.transactions, periods: generated.periods })
				)
			)
		);
		expect(imported.transactions).toEqual(generated.transactions);
	});

	it('dos movimientos de la misma serie en un mes no generan clones con el mismo identificador', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-02-15T12:00:00Z'));
		const movido = { ...baseTx, id: 'serie-1-2025-12', date: '2026-01-02', originId: 'serie-1' };

		const generated = autoGenerateMissingPeriods(periods, [baseTx, movido]);

		const ids = generated.transactions.map((t) => t.id);
		expect(ids).toHaveLength(4);
		expect(new Set(ids).size).toBe(4);
	});
});

describe('Copias anteriores (sin marca de formato)', () => {
	const legacyPayload = (transactions: unknown[], extra: Record<string, unknown> = {}) => ({
		[STORAGE_KEYS.transactions]: JSON.stringify(transactions),
		[STORAGE_KEYS.periods]: JSON.stringify(periods),
		...extra
	});

	it('importa los identificadores largos que ya existen y conserva su serie', async () => {
		const longId = `3f2b8c1e-7a4d-4e9b-9c55-0d6a1b2c3d4e${'-2026-01'.repeat(40)}`;
		const tx = { ...baseTx, id: longId, originId: '3f2b8c1e-7a4d-4e9b-9c55-0d6a1b2c3d4e' };

		const imported = await importFinanceBackupPayload(legacyPayload([tx]));

		expect(imported.transactions?.[0].id).toBe(longId);
		expect(imported.transactions?.[0].originId).toBe('3f2b8c1e-7a4d-4e9b-9c55-0d6a1b2c3d4e');
	});

	it('repara los textos que rondas anteriores dejaron escapados', async () => {
		const dañado = { ...baseTx, desc: escapar(escapar(escapar(TEXTO))), tag: escapar('Ocio & Cultura') };

		const imported = await importFinanceBackupPayload(
			legacyPayload([dañado], {
				[STORAGE_KEYS.userAName]: escapar(escapar('Ana & Cía')),
				[STORAGE_KEYS.accounts]: JSON.stringify([{ ...accounts[0], name: escapar('Ahorro & Gastos') }]),
				[STORAGE_KEYS.debts]: JSON.stringify([
					{
						...debts[0],
						desc: escapar('Sofá <oferta>'),
						tag: escapar('Hogar & Jardín'),
						installments: [{ ...debts[0].installments[0], label: escapar('Cuota "1"') }]
					}
				])
			})
		);

		expect(imported.transactions?.[0].desc).toBe(TEXTO);
		expect(imported.transactions?.[0].tag).toBe('Ocio & Cultura');
		expect(imported.userAName).toBe('Ana & Cía');
		expect(imported.accounts?.[0].name).toBe('Ahorro & Gastos');
		expect(imported.debts).toEqual(debts);
	});

	it('un texto escapado que al reparar cabe en el límite no se rechaza por su longitud dañada', async () => {
		const desc = '&'.repeat(100);

		const imported = await importFinanceBackupPayload(legacyPayload([{ ...baseTx, desc: escapar(desc) }]));

		expect(imported.transactions?.[0].desc).toBe(desc);
	});

	it('sin número de perfiles en la copia no informa ninguno', async () => {
		const imported = await importFinanceBackupPayload(legacyPayload([baseTx]));

		expect(imported.profileCount).toBeUndefined();
	});
});

describe('Reparación única de los datos guardados en el dispositivo', () => {
	const sembrarDañados = async () => {
		await saveStoredTransactions([{ ...baseTx, desc: escapar(escapar(TEXTO)), tag: escapar('Ocio & Cultura') }]);
		await saveStoredAccounts([{ ...accounts[0], name: escapar('Ahorro & Gastos') }]);
		await saveStoredDebts([
			{
				...debts[0],
				desc: escapar('Sofá <oferta>'),
				tag: escapar('Hogar & Jardín'),
				installments: [{ ...debts[0].installments[0], label: escapar('Cuota "1"') }]
			}
		]);
		await saveUserNames({ userAName: escapar('Ana & Cía') });
	};

	it('decodifica los textos escapados al arrancar', async () => {
		await sembrarDañados();

		await executeSilentMigrationIfRequired();

		const [tx] = await readStoredTransactions();
		expect(tx.desc).toBe(TEXTO);
		expect(tx.tag).toBe('Ocio & Cultura');
		await expect(readStoredAccounts()).resolves.toEqual(accounts);
		await expect(readStoredDebts()).resolves.toEqual(debts);
		expect((await readUserNames()).userAName).toBe('Ana & Cía');
	});

	it('solo se ejecuta una vez: un texto escrito después con una entidad se conserva', async () => {
		await sembrarDañados();
		await executeSilentMigrationIfRequired();

		await saveStoredTransactions([{ ...baseTx, desc: 'Apuntes: &amp;' }]);
		await executeSilentMigrationIfRequired();

		expect((await readStoredTransactions())[0].desc).toBe('Apuntes: &amp;');
	});
});

describe('Aplicación de lo importado al estado', () => {
	it('aplica el número de perfiles de la copia', () => {
		const setProfileCount = vi.fn();
		const noop = vi.fn();

		applyImportedBackup(
			{ profileCount: 1 },
			{
				setAccounts: noop,
				setTransactions: noop,
				setDebts: noop,
				setPeriods: noop,
				setUserAName: noop,
				setUserBName: noop,
				setGeminiApiKey: noop,
				setChatMessages: noop,
				setSelectedMonth: noop,
				setProfileCount
			}
		);

		expect(setProfileCount).toHaveBeenCalledWith(1);
	});

	it('sin número de perfiles en la copia deja el actual', () => {
		const setProfileCount = vi.fn();
		const noop = vi.fn();

		applyImportedBackup(
			{},
			{
				setAccounts: noop,
				setTransactions: noop,
				setDebts: noop,
				setPeriods: noop,
				setUserAName: noop,
				setUserBName: noop,
				setGeminiApiKey: noop,
				setChatMessages: noop,
				setSelectedMonth: noop,
				setProfileCount
			}
		);

		expect(setProfileCount).not.toHaveBeenCalled();
	});
});
