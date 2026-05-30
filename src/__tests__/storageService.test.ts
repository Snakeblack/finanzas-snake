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
	saveAiChat,
	setCryptoKey
} from '../services/storageService';
import { deriveKeyFromPassword, generateSalt } from '../services/cryptoService';
import type { Transaction, Debt, Account, ChatMessage, Period } from '../types';

beforeEach(() => {
	localStorage.clear();
	setCryptoKey(null); // Reset key
});

describe('cleanLegacyData', () => {
	it('debe limpiar datos v2 en la primera ejecución', () => {
		localStorage.setItem(STORAGE_KEYS.transactions, '[{"id":"old"}]');
		localStorage.setItem(STORAGE_KEYS.debts, '[{"id":"old-debt"}]');
		localStorage.setItem(STORAGE_KEYS.periods, '[{"month":"2026-01"}]');

		cleanLegacyData();

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
	const mockTransactions: Transaction[] = [{
		id: 'tx-1',
		desc: 'Compra Café',
		amount: 3.5,
		type: 'expense',
		tag: 'Ocio/Restauración',
		date: '2026-05-30',
		recurrence: 'one-off',
		owner: 'userA',
		paidBy: 'userA'
	}];

	describe('Flujo de Texto Plano (Sin Cifrado)', () => {
		it('debe guardar y leer transacciones en texto plano', async () => {
			await saveStoredTransactions(mockTransactions);
			const result = await readStoredTransactions();
			expect(result).toHaveLength(1);
			expect(result[0].desc).toBe('Compra Café');
			
			// Verificar que esté en texto plano en localStorage
			const rawVal = localStorage.getItem(STORAGE_KEYS.transactions);
			expect(rawVal).toContain('Compra Café');
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
			
			// Verificar que el dato en LocalStorage no sea legible (esté cifrado)
			const rawVal = localStorage.getItem(STORAGE_KEYS.transactions);
			expect(rawVal).not.toContain('Compra Café');
			expect(rawVal).toContain(':'); // Formato iv:ciphertext

			// Leer a través de la interfaz transparente
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
			const mockDebts: Debt[] = [{
				id: 'd-1',
				kind: 'classic',
				desc: 'Préstamo',
				tag: 'Hipoteca',
				date: '2026-05',
				owner: 'joint',
				principal: 1000,
				tae: 3,
				termMonths: 12
			}];

			await saveStoredDebts(mockDebts);
			expect(localStorage.getItem(STORAGE_KEYS.debts)).not.toContain('Préstamo');

			const result = await readStoredDebts();
			expect(result).toHaveLength(1);
			expect(result[0].desc).toBe('Préstamo');
		});

		it('debe guardar y leer periodos cifrados', async () => {
			const mockPeriods: Period[] = [{
				month: '2026-05',
				openingBalance: 100,
				openingBalanceA: 50,
				openingBalanceB: 50
			}];

			await saveStoredPeriods(mockPeriods);
			expect(localStorage.getItem(STORAGE_KEYS.periods)).not.toContain('2026-05');

			const result = await readStoredPeriods([], []);
			expect(result).toHaveLength(1);
			expect(result[0].month).toBe('2026-05');
		});

		it('debe guardar y leer la API key de Gemini de forma cifrada', async () => {
			await saveGeminiApiKey('mi-api-key');
			expect(localStorage.getItem(STORAGE_KEYS.geminiKey)).not.toBe('mi-api-key');

			const result = await readGeminiApiKey();
			expect(result).toBe('mi-api-key');
		});

		it('debe guardar y leer el historial de chat cifrado', async () => {
			const mockChat: ChatMessage[] = [{
				role: 'user',
				content: 'Mensaje secreto',
				timestamp: '12:00'
			}];

			await saveAiChat(mockChat);
			expect(localStorage.getItem(STORAGE_KEYS.aiChat)).not.toContain('Mensaje secreto');

			const result = await readAiChat();
			expect(result).toHaveLength(1);
			expect(result[0].content).toBe('Mensaje secreto');
		});
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
