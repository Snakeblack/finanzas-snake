import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { STORAGE_KEYS } from '../constants';
import {
	cleanLegacyData,
	migrateTransaction,
	migrateDebt,
	readStoredTransactions,
	saveStoredTransactions,
	readStoredDebts,
	saveStoredDebts,
	readStoredPeriods,
	saveStoredPeriods,
	getInitialData,
	saveStoredAccounts,
	readStoredAccounts,
	executeSilentMigrationIfRequired,
	readGeminiApiKey,
	saveGeminiApiKey,
	readAiChat,
	saveAiChat,
	readUserNames,
	saveUserNames,
	buildFinanceBackupPayload,
	readFinanceBackupPayload,
	importFinanceBackupPayload,
	setCryptoKey
} from '../services/storageService';
import { deriveKeyFromPassword, generateSalt } from '../services/cryptoService';
import { IndexedDBProvider } from '../services/db/idbProvider';
import type { Transaction, Debt, Account, ChatMessage, Period } from '../types';

beforeEach(() => {
	localStorage.clear();
	setCryptoKey(null); // Reset key
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('cleanLegacyData', () => {
	it('debe marcar la limpieza legacy sin borrar datos v3 pendientes de migración', () => {
		localStorage.setItem(STORAGE_KEYS.transactions, '[{"id":"old"}]');
		localStorage.setItem(STORAGE_KEYS.debts, '[{"id":"old-debt"}]');
		localStorage.setItem(STORAGE_KEYS.periods, '[{"month":"2026-01"}]');

		cleanLegacyData();

		expect(localStorage.getItem(STORAGE_KEYS.transactions)).toBe('[{"id":"old"}]');
		expect(localStorage.getItem(STORAGE_KEYS.debts)).toBe('[{"id":"old-debt"}]');
		expect(localStorage.getItem(STORAGE_KEYS.periods)).toBe('[{"month":"2026-01"}]');
		expect(localStorage.getItem(STORAGE_KEYS.clearedV2)).toBe('true');
	});

	it('no debe limpiar datos si ya se ejecutó antes', () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(STORAGE_KEYS.transactions, '[{"id":"keep"}]');

		cleanLegacyData();

		expect(localStorage.getItem(STORAGE_KEYS.transactions)).toBe('[{"id":"keep"}]');
	});
});

describe('migrateTransaction', () => {
	it('debe migrar una transacción válida completa', () => {
		const raw = {
			id: 'tx-1',
			desc: 'Nómina',
			money: { amount: '2000.00', currency: 'EUR' },
			type: 'income',
			tag: 'Sueldo',
			date: '2026-05-01',
			recurrence: 'recurring',
			owner: 'userA',
			paidBy: 'userA',
			accountId: 'acc-1'
		};

		const result = migrateTransaction(raw, 0);
		expect(result.id).toBe('tx-1');
		expect(result.desc).toBe('Nómina');
		expect(result.money.amount).toBe('2000.00');
		expect(result.money.currency).toBe('EUR');
		expect(result.type).toBe('income');
		expect(result.tag).toBe('Sueldo');
		expect(result.date).toBe('2026-05-01');
		expect(result.recurrence).toBe('recurring');
		expect(result.owner).toBe('userA');
		expect(result.paidBy).toBe('userA');
		expect(result.accountId).toBe('acc-1');
	});

	it('debe aplicar valores por defecto para campos faltantes', () => {
		const result = migrateTransaction({}, 5);
		expect(result.id).toBe('tx-6');
		expect(result.desc).toBe('Movimiento sin nombre');
		expect(result.money.amount).toBe('0.00');
		expect(result.money.currency).toBe('EUR');
		expect(result.type).toBe('expense');
		expect(result.recurrence).toBe('one-off');
		expect(result.owner).toBe('joint');
		expect(result.paidBy).toBe('shared');
	});

	it('debe migrar null/undefined como entrada', () => {
		const result = migrateTransaction(null, 0);
		expect(result.type).toBe('expense');
		expect(result.desc).toBe('Movimiento sin nombre');
	});

	it('debe usar Math.abs para el amount', () => {
		const result = migrateTransaction({ amount: -500 }, 0);
		expect(result.money.amount).toBe('500.00');
	});

	it('debe truncar la fecha a 10 caracteres', () => {
		const result = migrateTransaction({ date: '2026-05-01T12:00:00Z' }, 0);
		expect(result.date).toBe('2026-05-01');
	});

	it('debe identificar correctamente los tipos de transacción', () => {
		expect(migrateTransaction({ type: 'income' }, 0).type).toBe('income');
		expect(migrateTransaction({ type: 'transfer' }, 0).type).toBe('transfer');
		expect(migrateTransaction({ type: 'expense' }, 0).type).toBe('expense');
		expect(migrateTransaction({ type: 'invalid' }, 0).type).toBe('expense');
	});
});

describe('migrateDebt', () => {
	it('debe migrar una deuda clásica válida', () => {
		const raw = {
			id: 'd-1',
			kind: 'classic',
			desc: 'Hipoteca',
			tag: 'Hipoteca',
			date: '2026-01',
			principal: 150000,
			tin: 2.5,
			tae: 3.0,
			termMonths: 360,
			owner: 'userA'
		};

		const result = migrateDebt(raw);
		expect(result.kind).toBe('classic');
		if (result.kind === 'classic') {
			expect(result.principal).toBe(150000);
			expect(result.tin).toBe(2.5);
			expect(result.tae).toBe(3.0);
			expect(result.termMonths).toBe(360);
		}
	});

	it('debe migrar una deuda paymentPlan válida', () => {
		const raw = {
			kind: 'paymentPlan',
			desc: 'Fraccionamiento',
			financedAmount: 1200,
			fees: 60,
			totalToPay: 1260,
			installments: [
				{ id: 'i1', dueMonth: '2026-05', amount: 105, status: 'pending', label: 'Cuota 1' },
				{ id: 'i2', dueMonth: '2026-06', amount: 105, status: 'paid', label: 'Cuota 2' }
			]
		};

		const result = migrateDebt(raw);
		expect(result.kind).toBe('paymentPlan');
		if (result.kind === 'paymentPlan') {
			expect(result.financedAmount).toBe(1200);
			expect(result.fees).toBe(60);
			expect(result.totalToPay).toBe(1260);
			expect(result.installments).toHaveLength(2);
			expect(result.installments[0].status).toBe('pending');
			expect(result.installments[1].status).toBe('paid');
		}
	});
});

describe('Operaciones de Almacenamiento (Plano vs Cifrado)', () => {
	const mockTransactions: Transaction[] = [
		{
			id: 'tx-1',
			desc: 'Compra Café',
			money: { amount: '3.50', currency: 'EUR' },
			type: 'expense',
			tag: 'Ocio/Restauración',
			date: '2026-05-30',
			recurrence: 'one-off',
			owner: 'userA',
			paidBy: 'userA'
		}
	];

	describe('Flujo de Texto Plano (Sin Cifrado)', () => {
		it('debe guardar y leer transacciones en texto plano', async () => {
			await saveStoredTransactions(mockTransactions);
			const result = await readStoredTransactions();
			expect(result).toHaveLength(1);
			expect(result[0].desc).toBe('Compra Café');
		});

		it('debe retornar vacío si no hay datos', async () => {
			const result = await readStoredTransactions();
			expect(result).toHaveLength(0);
		});

		it('debe retornar vacío si el JSON es inválido', async () => {
			localStorage.setItem(STORAGE_KEYS.transactions, 'invalid-json');
			const result = await readStoredTransactions();
			expect(result).toHaveLength(0);
		});
	});

	describe('Flujo de Cifrado Activo (AES-GCM)', () => {
		let testKey: CryptoKey;

		beforeEach(async () => {
			const salt = generateSalt();
			testKey = await deriveKeyFromPassword('mi-pin', salt);
			setCryptoKey(testKey);
		});

		it('debe cifrar al guardar y descifrar al leer de forma transparente', async () => {
			await saveStoredTransactions(mockTransactions);

			// Leer a través de la interfaz transparente con llave
			const result = await readStoredTransactions();
			expect(result).toHaveLength(1);
			expect(result[0].desc).toBe('Compra Café');
		});

		it('debe retornar vacío si la base de datos está bloqueada (sin llave)', async () => {
			await saveStoredTransactions(mockTransactions);

			// Wipiamos la llave (bloqueamos la app)
			setCryptoKey(null);

			const result = await readStoredTransactions();
			expect(result).toHaveLength(0); // Devuelve vacío ya que no puede descifrar
		});

		it('debe guardar y leer deudas cifradas', async () => {
			const mockDebts: Debt[] = [
				{
					id: 'd-1',
					kind: 'classic',
					desc: 'Préstamo',
					tag: 'Hipoteca',
					date: '2026-05',
					owner: 'joint',
					principal: 1000,
					tae: 3,
					termMonths: 12
				}
			];

			await saveStoredDebts(mockDebts);
			const result = await readStoredDebts();
			expect(result).toHaveLength(1);
			expect(result[0].desc).toBe('Préstamo');
		});

		it('debe guardar y leer periodos cifrados', async () => {
			const mockPeriods: Period[] = [
				{
					month: '2026-05',
					openingBalance: 100,
					openingBalanceA: 50,
					openingBalanceB: 50
				}
			];

			await saveStoredPeriods(mockPeriods);
			const result = await readStoredPeriods([], []);
			expect(result).toHaveLength(1);
			expect(result[0].month).toBe('2026-05');
		});

		it('debe guardar y leer la API key de Gemini de forma cifrada', async () => {
			await saveGeminiApiKey('mi-api-key');
			const result = await readGeminiApiKey();
			expect(result).toBe('mi-api-key');
		});

		it('debe guardar y leer el historial de chat cifrado', async () => {
			const mockChat: ChatMessage[] = [
				{
					role: 'user',
					content: 'Mensaje secreto',
					timestamp: '12:00'
				}
			];

			await saveAiChat(mockChat);
			const result = await readAiChat();
			expect(result).toHaveLength(1);
			expect(result[0].content).toBe('Mensaje secreto');
		});
	});
});

describe('Migración unificada IndexedDB', () => {
	it('no debe sobrescribir cuentas ya migradas cuando se borra localStorage y falta el flag legacy', async () => {
		const migratedAccounts: Account[] = [
			{ id: 'acc-ana', name: 'Cuenta Ana IDB', owner: 'userA', initialBalance: 1200 },
			{ id: 'acc-bruno', name: 'Cuenta Bruno IDB', owner: 'userB', initialBalance: 800 },
			{ id: 'acc-joint', name: 'Cuenta Común IDB', owner: 'joint', initialBalance: 50 }
		];

		await saveStoredAccounts(migratedAccounts);
		localStorage.clear();

		getInitialData();
		await executeSilentMigrationIfRequired();

		await expect(readStoredAccounts()).resolves.toEqual(migratedAccounts);
		expect(localStorage.getItem(STORAGE_KEYS.accounts)).toBeNull();
	});

	it('debe importar datos v3 de localStorage aunque falte el marcador de limpieza legacy', async () => {
		const legacyAccounts: Account[] = [
			{ id: 'acc-a', name: 'Cuenta Ana Legacy', owner: 'userA', initialBalance: 1500 },
			{ id: 'acc-b', name: 'Cuenta Bruno Legacy', owner: 'userB', initialBalance: 500 }
		];
		const legacyTransactions: Transaction[] = [
			{
				id: 'tx-v3-1',
				desc: 'Ingreso legacy v3',
				money: { amount: '2100.00', currency: 'EUR' },
				type: 'income',
				tag: 'Sueldo',
				date: '2026-05-01',
				recurrence: 'one-off',
				owner: 'userA',
				paidBy: 'userA',
				accountId: 'acc-a'
			}
		];
		const legacyDebts: Debt[] = [
			{
				id: 'debt-v3-1',
				kind: 'classic',
				desc: 'Deuda legacy v3',
				tag: 'Préstamo Personal',
				date: '2026-05',
				owner: 'userB',
				paymentAccountId: 'acc-b',
				principal: 1000,
				tae: 3,
				termMonths: 12
			}
		];
		const legacyPeriods: Period[] = [
			{ month: '2026-05', openingBalance: 2000, openingBalanceA: 1500, openingBalanceB: 500 }
		];

		localStorage.setItem(STORAGE_KEYS.userAName, 'Ana');
		localStorage.setItem(STORAGE_KEYS.userBName, 'Bruno');
		localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(legacyAccounts));
		localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(legacyTransactions));
		localStorage.setItem(STORAGE_KEYS.debts, JSON.stringify(legacyDebts));
		localStorage.setItem(STORAGE_KEYS.periods, JSON.stringify(legacyPeriods));

		const startupData = getInitialData();
		await executeSilentMigrationIfRequired();

		expect(startupData.transactions).toHaveLength(1);
		expect(startupData.periods).toHaveLength(1);
		await expect(readStoredAccounts()).resolves.toEqual(legacyAccounts);
		await expect(readStoredTransactions()).resolves.toMatchObject(legacyTransactions);
		await expect(readStoredDebts()).resolves.toMatchObject(legacyDebts);
		await expect(readStoredPeriods(legacyTransactions, legacyDebts)).resolves.toEqual([
			{ ...legacyPeriods[0], isManualInit: false }
		]);
		await expect(readUserNames()).resolves.toEqual({ userAName: 'Ana', userBName: 'Bruno' });
		expect(localStorage.getItem(STORAGE_KEYS.transactions)).toBeNull();
		expect(localStorage.getItem(STORAGE_KEYS.debts)).toBeNull();
		expect(localStorage.getItem(STORAGE_KEYS.periods)).toBeNull();
	});

	it('debe conservar localStorage y permitir reintento si falla una escritura IDB durante la migración', async () => {
		const legacyAccounts: Account[] = [
			{ id: 'acc-fail', name: 'Cuenta Legacy', owner: 'joint', initialBalance: 100 }
		];
		const legacyTransactions: Transaction[] = [
			{
				id: 'tx-fail',
				desc: 'Movimiento pendiente de migrar',
				money: { amount: '42.00', currency: 'EUR' },
				type: 'expense',
				tag: 'Otros Gastos',
				date: '2026-05-10',
				recurrence: 'one-off',
				owner: 'joint',
				paidBy: 'shared',
				accountId: 'acc-fail'
			}
		];
		const originalSaveEntitiesBulk = IndexedDBProvider.prototype.saveEntitiesBulk;
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const saveSpy = vi.spyOn(IndexedDBProvider.prototype, 'saveEntitiesBulk').mockImplementation(function (
			this: IndexedDBProvider,
			storeName: string,
			entities: unknown[]
		) {
			if (storeName === 'transactions') {
				return Promise.reject(new Error('idb transactions write failed'));
			}
			return originalSaveEntitiesBulk.call(this, storeName, entities);
		});

		localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(legacyAccounts));
		localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(legacyTransactions));

		await executeSilentMigrationIfRequired();

		expect(localStorage.getItem(STORAGE_KEYS.accounts)).toBe(JSON.stringify(legacyAccounts));
		expect(localStorage.getItem(STORAGE_KEYS.transactions)).toBe(JSON.stringify(legacyTransactions));
		await expect(readStoredTransactions()).resolves.toEqual([]);

		saveSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		await executeSilentMigrationIfRequired();

		await expect(readStoredTransactions()).resolves.toEqual(legacyTransactions);
		expect(localStorage.getItem(STORAGE_KEYS.transactions)).toBeNull();
	});

	it('debe importar datos v2 fallback sin borrarlos antes de la migración', async () => {
		const legacyTransactions: Transaction[] = [
			{
				id: 'tx-v2-1',
				desc: 'Ingreso legacy v2',
				money: { amount: '900.00', currency: 'EUR' },
				type: 'income',
				tag: 'Sueldo',
				date: '2026-04-01',
				recurrence: 'one-off',
				owner: 'userA',
				paidBy: 'userA'
			}
		];
		const legacyDebts: Debt[] = [
			{
				id: 'debt-v2-1',
				kind: 'classic',
				desc: 'Deuda legacy v2',
				tag: 'Préstamo Personal',
				date: '2026-04',
				owner: 'joint',
				principal: 300,
				tae: 2,
				termMonths: 6
			}
		];

		localStorage.setItem('finanzas_v2_transactions', JSON.stringify(legacyTransactions));
		localStorage.setItem('finanzas_v2_debts', JSON.stringify(legacyDebts));
		localStorage.setItem('finanzas_v2_gemini_key', 'gemini-v2');

		getInitialData();
		await executeSilentMigrationIfRequired();

		await expect(readStoredTransactions()).resolves.toMatchObject([
			expect.objectContaining({ id: 'tx-v2-1', desc: 'Ingreso legacy v2', accountId: 'default-a' })
		]);
		await expect(readStoredDebts()).resolves.toMatchObject(legacyDebts);
		await expect(readGeminiApiKey()).resolves.toBe('gemini-v2');
		expect(localStorage.getItem('finanzas_v2_transactions')).toBeNull();
		expect(localStorage.getItem('finanzas_v2_debts')).toBeNull();
		expect(localStorage.getItem('finanzas_v2_gemini_key')).toBeNull();
	});
});

describe('Payload canónico de backup/sync', () => {
	const canonicalAccounts: Account[] = [
		{ id: 'acc-a', name: 'Cuenta Ana', owner: 'userA', initialBalance: 1200 },
		{ id: 'acc-b', name: 'Cuenta Bruno', owner: 'userB', initialBalance: 800 }
	];
	const canonicalTransactions: Transaction[] = [
		{
			id: 'tx-sync-1',
			desc: 'Ingreso IDB',
			money: { amount: '2500.00', currency: 'EUR' },
			type: 'income',
			tag: 'Sueldo',
			date: '2026-05-01',
			recurrence: 'recurring',
			owner: 'userA',
			paidBy: 'userA',
			accountId: 'acc-a'
		}
	];
	const canonicalDebts: Debt[] = [
		{
			id: 'debt-sync-1',
			kind: 'classic',
			desc: 'Préstamo IDB',
			tag: 'Préstamo Personal',
			date: '2026-05',
			owner: 'userB',
			paymentAccountId: 'acc-b',
			principal: 1000,
			tae: 3,
			termMonths: 12
		}
	];
	const canonicalPeriods: Period[] = [
		{ month: '2026-05', openingBalance: 100, openingBalanceA: 60, openingBalanceB: 40 }
	];
	const canonicalPeriodsFromStorage: Period[] = [
		{ month: '2026-05', openingBalance: 100, openingBalanceA: 60, openingBalanceB: 40, isManualInit: false }
	];
	const canonicalChat: ChatMessage[] = [{ role: 'user', content: 'Hola IDB', timestamp: '12:00' }];

	it('debe exportar datos financieros desde IndexedDB aunque localStorage esté vacío', async () => {
		await saveStoredAccounts(canonicalAccounts);
		await saveStoredTransactions(canonicalTransactions);
		await saveStoredDebts(canonicalDebts);
		await saveStoredPeriods(canonicalPeriods);
		await saveUserNames({ userAName: 'Ana', userBName: 'Bruno' });
		await saveGeminiApiKey('gemini-idb');
		await saveAiChat(canonicalChat);
		localStorage.clear();

		const payload = await readFinanceBackupPayload();

		expect(JSON.parse(payload[STORAGE_KEYS.accounts] ?? '[]')).toEqual(canonicalAccounts);
		expect(JSON.parse(payload[STORAGE_KEYS.transactions] ?? '[]')).toEqual(canonicalTransactions);
		expect(JSON.parse(payload[STORAGE_KEYS.debts] ?? '[]')).toEqual(canonicalDebts);
		expect(JSON.parse(payload[STORAGE_KEYS.periods] ?? '[]')).toEqual(canonicalPeriodsFromStorage);
		expect(payload[STORAGE_KEYS.userAName]).toBe('Ana');
		expect(payload[STORAGE_KEYS.userBName]).toBe('Bruno');
		expect(payload[STORAGE_KEYS.geminiKey]).toBe('gemini-idb');
		expect(JSON.parse(payload[STORAGE_KEYS.aiChat] ?? '[]')).toEqual(canonicalChat);
		expect(localStorage.getItem(STORAGE_KEYS.accounts)).toBeNull();
	});

	it('debe importar payload de sync en IndexedDB sin escribir claves de dominio a localStorage', async () => {
		const payload = buildFinanceBackupPayload({
			accounts: canonicalAccounts,
			transactions: canonicalTransactions,
			debts: canonicalDebts,
			periods: canonicalPeriods,
			userAName: 'Ana',
			userBName: 'Bruno',
			geminiApiKey: 'gemini-idb',
			chatMessages: canonicalChat
		});

		const imported = await importFinanceBackupPayload(payload);

		await expect(readStoredAccounts()).resolves.toEqual(canonicalAccounts);
		await expect(readStoredTransactions()).resolves.toEqual(canonicalTransactions);
		await expect(readStoredDebts()).resolves.toEqual(canonicalDebts);
		await expect(readStoredPeriods(canonicalTransactions, canonicalDebts)).resolves.toEqual(
			canonicalPeriodsFromStorage
		);
		await expect(readUserNames()).resolves.toEqual({ userAName: 'Ana', userBName: 'Bruno' });
		await expect(readGeminiApiKey()).resolves.toBe('gemini-idb');
		await expect(readAiChat()).resolves.toEqual(canonicalChat);
		expect(imported.accounts).toEqual(canonicalAccounts);

		const domainKeys = [
			STORAGE_KEYS.accounts,
			STORAGE_KEYS.transactions,
			STORAGE_KEYS.debts,
			STORAGE_KEYS.periods,
			STORAGE_KEYS.userAName,
			STORAGE_KEYS.userBName,
			STORAGE_KEYS.geminiKey,
			STORAGE_KEYS.aiChat
		];
		domainKeys.forEach((key) => expect(localStorage.getItem(key)).toBeNull());
	});

	it('debe abortar importación y conservar localStorage si falla la persistencia en IndexedDB', async () => {
		const payload = buildFinanceBackupPayload({
			accounts: canonicalAccounts,
			transactions: canonicalTransactions,
			debts: canonicalDebts,
			periods: canonicalPeriods,
			userAName: 'Ana',
			userBName: 'Bruno',
			geminiApiKey: 'gemini-idb',
			chatMessages: canonicalChat
		});
		const existingLegacyTransactions = '[{"id":"legacy-still-present"}]';
		const existingLegacyAccounts = JSON.stringify(canonicalAccounts);
		const originalSaveEntitiesBulk = IndexedDBProvider.prototype.saveEntitiesBulk;
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		vi.spyOn(IndexedDBProvider.prototype, 'saveEntitiesBulk').mockImplementation(function (
			this: IndexedDBProvider,
			storeName: string,
			entities: unknown[]
		) {
			if (storeName === 'transactions') {
				return Promise.reject(new Error('idb import transactions write failed'));
			}
			return originalSaveEntitiesBulk.call(this, storeName, entities);
		});

		localStorage.setItem(STORAGE_KEYS.transactions, existingLegacyTransactions);
		localStorage.setItem(STORAGE_KEYS.accounts, existingLegacyAccounts);

		await expect(importFinanceBackupPayload(payload)).rejects.toThrow('idb import transactions write failed');
		expect(localStorage.getItem(STORAGE_KEYS.transactions)).toBe(existingLegacyTransactions);
		expect(localStorage.getItem(STORAGE_KEYS.accounts)).toBe(existingLegacyAccounts);
	});
});

describe('getInitialData', () => {
	it('debe retornar datos vacíos si hay un PIN configurado en LocalStorage (base de datos bloqueada)', () => {
		localStorage.setItem('finanzas_v3_password_salt', 'somesalt');
		const result = getInitialData();
		expect(result.accounts).toHaveLength(0);
		expect(result.transactions).toHaveLength(0);
	});

	it('debe crear cuentas predeterminadas si no hay PIN ni cuentas guardadas', () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		const result = getInitialData();
		expect(result.accounts).toHaveLength(3); // default-a, default-b, default-joint
	});
});
