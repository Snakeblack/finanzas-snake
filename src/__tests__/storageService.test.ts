import { describe, it, expect, beforeEach } from 'vitest';
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
	readGeminiApiKey,
	saveGeminiApiKey,
	readAiChat,
	saveAiChat
} from '../services/storageService';
import type { Transaction, Debt, Account, ChatMessage, Period } from '../types';

beforeEach(() => {
	localStorage.clear();
});

describe('cleanLegacyData', () => {
	it('debe limpiar datos v2 en la primera ejecución', () => {
		localStorage.setItem(STORAGE_KEYS.transactions, '[{"id":"old"}]');
		localStorage.setItem(STORAGE_KEYS.debts, '[{"id":"old-debt"}]');
		localStorage.setItem(STORAGE_KEYS.periods, '[{"month":"2026-01"}]');

		cleanLegacyData();

		// Debe haber limpiado todo y marcado la flag
		expect(localStorage.getItem(STORAGE_KEYS.transactions)).toBeNull();
		expect(localStorage.getItem(STORAGE_KEYS.debts)).toBeNull();
		expect(localStorage.getItem(STORAGE_KEYS.periods)).toBeNull();
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
			amount: 2000,
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
		expect(result.amount).toBe(2000);
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
		expect(result.amount).toBe(0);
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
		expect(result.amount).toBe(500);
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

	it('debe preservar originId si existe', () => {
		const result = migrateTransaction({ originId: 'root-1' }, 0);
		expect(result.originId).toBe('root-1');
	});

	it('debe preservar fromAccountId y toAccountId', () => {
		const result = migrateTransaction({
			fromAccountId: 'from-1',
			toAccountId: 'to-1',
			type: 'transfer'
		}, 0);
		expect(result.fromAccountId).toBe('from-1');
		expect(result.toAccountId).toBe('to-1');
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

	it('debe aplicar valores por defecto para deuda clásica incompleta', () => {
		const result = migrateDebt({});
		expect(result.kind).toBe('classic');
		expect(result.desc).toBe('Deuda sin nombre');
		expect(result.owner).toBe('joint');
		if (result.kind === 'classic') {
			expect(result.principal).toBe(0);
			expect(result.tae).toBe(0);
			expect(result.termMonths).toBe(1);
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

	it('debe calcular totalToPay si no se provee', () => {
		const raw = {
			kind: 'paymentPlan',
			desc: 'Test',
			financedAmount: 1000,
			fees: 50,
			installments: []
		};

		const result = migrateDebt(raw);
		if (result.kind === 'paymentPlan') {
			expect(result.totalToPay).toBe(1050);
		}
	});

	it('debe usar Math.abs para valores numéricos', () => {
		const result = migrateDebt({
			principal: -5000,
			tae: -3,
			termMonths: 12
		});
		if (result.kind === 'classic') {
			expect(result.principal).toBe(5000);
			expect(result.tae).toBe(3);
			expect(result.termMonths).toBe(12);
		}
	});

	it('debe garantizar termMonths mínimo de 1', () => {
		const result = migrateDebt({ termMonths: 0 });
		if (result.kind === 'classic') {
			expect(result.termMonths).toBe(1);
		}
	});

	it('debe manejar installments inválidos en paymentPlan', () => {
		const result = migrateDebt({
			kind: 'paymentPlan',
			installments: 'no-array'
		});
		if (result.kind === 'paymentPlan') {
			expect(result.installments).toHaveLength(0);
		}
	});

	it('debe preservar paymentAccountId', () => {
		const result = migrateDebt({ paymentAccountId: 'acc-1' });
		expect(result.paymentAccountId).toBe('acc-1');
	});
});

describe('readStoredTransactions / saveStoredTransactions', () => {
	it('debe guardar y leer transacciones correctamente (roundtrip)', () => {
		const txs: Transaction[] = [{
			id: 'tx-1', desc: 'Test', amount: 100, type: 'expense',
			tag: 'Test', date: '2026-05-01', owner: 'joint'
		}];

		saveStoredTransactions(txs);
		const result = readStoredTransactions();
		expect(result).toHaveLength(1);
		expect(result[0].desc).toBe('Test');
	});

	it('debe retornar vacío si no hay datos', () => {
		expect(readStoredTransactions()).toHaveLength(0);
	});

	it('debe retornar vacío si hay JSON inválido', () => {
		localStorage.setItem(STORAGE_KEYS.transactions, 'not-json');
		expect(readStoredTransactions()).toHaveLength(0);
	});

	it('debe retornar vacío si el dato no es un array', () => {
		localStorage.setItem(STORAGE_KEYS.transactions, '{"key": "value"}');
		expect(readStoredTransactions()).toHaveLength(0);
	});
});

describe('readStoredDebts / saveStoredDebts', () => {
	it('debe guardar y leer deudas correctamente (roundtrip)', () => {
		const debts: Debt[] = [{
			id: 'd1', kind: 'classic', desc: 'Test', tag: 'Test',
			date: '2026-05', principal: 1000, tae: 5, termMonths: 12,
			owner: 'joint'
		}];

		saveStoredDebts(debts);
		const result = readStoredDebts();
		expect(result).toHaveLength(1);
		expect(result[0].desc).toBe('Test');
	});

	it('debe retornar vacío si no hay datos', () => {
		expect(readStoredDebts()).toHaveLength(0);
	});
});

describe('readStoredPeriods / saveStoredPeriods', () => {
	it('debe guardar y leer periodos correctamente (roundtrip)', () => {
		const periods: Period[] = [
			{ month: '2026-05', openingBalance: 1000, openingBalanceA: 500, openingBalanceB: 500 }
		];

		saveStoredPeriods(periods);
		const result = readStoredPeriods([], []);
		expect(result).toHaveLength(1);
		expect(result[0].month).toBe('2026-05');
		expect(result[0].openingBalance).toBe(1000);
	});

	it('debe retornar vacío si no hay datos ni transacciones ni deudas', () => {
		expect(readStoredPeriods([], [])).toHaveLength(0);
	});

	it('debe autogenerar periodos basándose en las transacciones', () => {
		const txs: Transaction[] = [
			{ id: 't1', desc: 'Test', amount: 100, type: 'expense', tag: 'T', date: '2026-03-01' },
			{ id: 't2', desc: 'Test', amount: 100, type: 'income', tag: 'T', date: '2026-05-01' }
		];

		const result = readStoredPeriods(txs, []);
		// Debe generar periodos desde 2026-03 hasta al menos el mes actual
		expect(result.length).toBeGreaterThanOrEqual(3);
		expect(result[0].month).toBe('2026-03');
		expect(result[0].openingBalance).toBe(0);
	});

	it('debe calcular openingBalanceA/B como mitad si no existen', () => {
		localStorage.setItem(STORAGE_KEYS.periods, JSON.stringify([
			{ month: '2026-05', openingBalance: 2000 }
		]));

		const result = readStoredPeriods([], []);
		expect(result[0].openingBalanceA).toBe(1000);
		expect(result[0].openingBalanceB).toBe(1000);
	});

	it('debe manejar JSON inválido en periods', () => {
		localStorage.setItem(STORAGE_KEYS.periods, 'not-json');
		expect(readStoredPeriods([], [])).toHaveLength(0);
	});

	it('debe manejar array vacío en periods stored', () => {
		localStorage.setItem(STORAGE_KEYS.periods, '[]');
		expect(readStoredPeriods([], [])).toHaveLength(0);
	});

	it('debe autogenerar periodos basándose en las deudas', () => {
		const debts: Debt[] = [{
			id: 'd1', kind: 'classic', desc: 'Test', tag: 'T',
			date: '2026-02', principal: 1000, tae: 5, termMonths: 6, owner: 'joint'
		}];

		const result = readStoredPeriods([], debts);
		expect(result.length).toBeGreaterThanOrEqual(1);
		expect(result[0].month).toBe('2026-02');
	});
});

describe('getInitialData', () => {
	it('debe crear cuentas por defecto si no hay cuentas guardadas', () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		const data = getInitialData();

		expect(data.accounts).toHaveLength(3);
		expect(data.accounts[0].owner).toBe('userA');
		expect(data.accounts[1].owner).toBe('userB');
		expect(data.accounts[2].owner).toBe('joint');
	});

	it('debe usar cuentas guardadas si existen', () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		const customAccounts: Account[] = [
			{ id: 'custom-1', name: 'Mi Cuenta', owner: 'userA', initialBalance: 5000 }
		];
		localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(customAccounts));

		const data = getInitialData();
		expect(data.accounts).toHaveLength(1);
		expect(data.accounts[0].name).toBe('Mi Cuenta');
	});

	it('debe usar nombres de usuario personalizados', () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(STORAGE_KEYS.userAName, 'Alice');
		localStorage.setItem(STORAGE_KEYS.userBName, 'Bob');

		const data = getInitialData();
		expect(data.accounts[0].name).toContain('Alice');
		expect(data.accounts[1].name).toContain('Bob');
	});

	it('debe migrar transacciones sin accountId a cuentas por defecto', () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify([
			{ id: 'tx-1', desc: 'Test A', amount: 100, type: 'expense', tag: 'T', date: '2026-05-01', owner: 'userA' },
			{ id: 'tx-2', desc: 'Test B', amount: 200, type: 'income', tag: 'T', date: '2026-05-01', owner: 'userB' },
			{ id: 'tx-3', desc: 'Test J', amount: 300, type: 'expense', tag: 'T', date: '2026-05-01', owner: 'joint' }
		]));

		const data = getInitialData();
		const txA = data.transactions.find(t => t.desc === 'Test A');
		const txB = data.transactions.find(t => t.desc === 'Test B');
		const txJ = data.transactions.find(t => t.desc === 'Test J');

		expect(txA?.accountId).toBe('default-a');
		expect(txB?.accountId).toBe('default-b');
		expect(txJ?.accountId).toBe('default-joint');
	});

	it('debe preservar accountId si la transacción ya lo tiene', () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify([
			{ id: 'tx-1', desc: 'Test', amount: 100, type: 'expense', tag: 'T', date: '2026-05-01', owner: 'userA', accountId: 'existing-acc' }
		]));

		const data = getInitialData();
		expect(data.transactions[0].accountId).toBe('existing-acc');
	});

	it('no debe migrar transacciones de tipo transfer', () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify([
			{ id: 'tx-1', desc: 'Transfer', amount: 100, type: 'transfer', tag: 'T', date: '2026-05-01', owner: 'userA' }
		]));

		const data = getInitialData();
		expect(data.transactions[0].accountId).toBeUndefined();
	});

	it('debe manejar JSON inválido en cuentas', () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(STORAGE_KEYS.accounts, 'not-json');

		const data = getInitialData();
		expect(data.accounts).toHaveLength(3); // defaults
	});

	it('debe manejar array vacío en cuentas guardadas', () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(STORAGE_KEYS.accounts, '[]');

		const data = getInitialData();
		expect(data.accounts).toHaveLength(3); // defaults
	});

	it('debe usar saldos de apertura del primer periodo para initialBalance', () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(STORAGE_KEYS.periods, JSON.stringify([
			{ month: '2026-05', openingBalance: 3000, openingBalanceA: 1500, openingBalanceB: 1500 }
		]));

		const data = getInitialData();
		const accA = data.accounts.find(a => a.owner === 'userA');
		const accB = data.accounts.find(a => a.owner === 'userB');
		expect(accA?.initialBalance).toBe(1500);
		expect(accB?.initialBalance).toBe(1500);
	});
});

describe('saveStoredAccounts', () => {
	it('debe guardar cuentas en localStorage', () => {
		const accounts: Account[] = [
			{ id: 'a1', name: 'Test', owner: 'userA', initialBalance: 100 }
		];
		saveStoredAccounts(accounts);
		expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.accounts)!)).toHaveLength(1);
	});
});

describe('Gemini API Key storage', () => {
	it('debe guardar y leer la API key', () => {
		saveGeminiApiKey('test-key-123');
		expect(readGeminiApiKey()).toBe('test-key-123');
	});

	it('debe retornar vacío si no hay key', () => {
		expect(readGeminiApiKey()).toBe('');
	});
});

describe('AI Chat storage', () => {
	it('debe guardar y leer el chat', () => {
		const chat: ChatMessage[] = [
			{ role: 'user', content: 'Hola', timestamp: '12:00' },
			{ role: 'model', content: 'Respuesta', timestamp: '12:01' }
		];
		saveAiChat(chat);
		const result = readAiChat();
		expect(result).toHaveLength(2);
		expect(result[0].content).toBe('Hola');
	});

	it('debe retornar vacío si no hay chat', () => {
		expect(readAiChat()).toHaveLength(0);
	});

	it('debe retornar vacío si hay JSON inválido', () => {
		localStorage.setItem(STORAGE_KEYS.aiChat, 'not-json');
		expect(readAiChat()).toHaveLength(0);
	});
});
