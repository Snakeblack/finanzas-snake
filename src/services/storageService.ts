import { STORAGE_KEYS, DEFAULT_TAGS } from '../constants';
import type {
	Transaction,
	Debt,
	Period,
	Account,
	ChatMessage,
	TransactionType,
	PaymentPlanInstallment
} from '../types';
import { toNumber, decodeHtmlEntities } from '../utils/formatters';
import { normalizeMonth, addMonthsToMonth } from '../utils/dateUtils';
import { validateAndSanitizeBackup } from '../utils/backupValidator';
import { encryptWithKey, decryptWithKey } from './cryptoService';
import { IndexedDBProvider } from './db/idbProvider';
import {
	TransactionSchema,
	DebtSchema,
	PeriodSchema,
	AccountSchema,
	ChatMessageSchema
} from './schema';

const idb = new IndexedDBProvider();

const UNIFIED_IDB_MIGRATION_FLAG = 'finanzas_v5_unified_idb';
const IDB_CONFIG_KEYS = {
	migrationCompleted: 'migration:unified-idb:v5',
	userAName: 'userAName',
	userBName: 'userBName',
	profileCount: 'profileCount'
} as const;
const DEFAULT_USER_NAMES = {
	userAName: 'Usuario A',
	userBName: 'Usuario B'
} as const;
const FINANCE_BACKUP_KEYS = [
	STORAGE_KEYS.transactions,
	STORAGE_KEYS.debts,
	STORAGE_KEYS.periods,
	STORAGE_KEYS.accounts,
	STORAGE_KEYS.userAName,
	STORAGE_KEYS.userBName,
	STORAGE_KEYS.profileCount,
	STORAGE_KEYS.aiChat,
	STORAGE_KEYS.geminiKey
] as const;

interface UserNames {
	userAName: string;
	userBName: string;
}

export interface FinanceBackupSnapshot {
	accounts: Account[];
	transactions: Transaction[];
	debts: Debt[];
	periods: Period[];
	userAName: string;
	userBName: string;
	geminiApiKey: string;
	chatMessages: ChatMessage[];
	profileCount?: number;
}

export interface ImportedFinanceBackupData {
	accounts?: Account[];
	transactions?: Transaction[];
	debts?: Debt[];
	periods?: Period[];
	userAName?: string;
	userBName?: string;
	geminiApiKey?: string;
	chatMessages?: ChatMessage[];
	selectedMonth?: string;
	profileCount?: number;
}

export type FinanceBackupPayload = Record<string, string | null>;

type UnsafeRecord = Record<string, unknown>;

type ConfigEntity = {
	key: string;
	value?: string;
	ciphertext?: string;
};

// Clave criptográfica activa en memoria (RAM)
let activeCryptoKey: CryptoKey | null = null;

/**
 * Establece la clave criptográfica activa para las operaciones de lectura y escritura.
 */
export const setCryptoKey = (key: CryptoKey | null): void => {
	activeCryptoKey = key;
};

/**
 * Obtiene si hay una clave de cifrado configurada y activa en memoria.
 */
export const hasActiveCryptoKey = (): boolean => {
	return activeCryptoKey !== null;
};

/**
 * Cifra un objeto y retorna su texto cifrado en formato hex.
 */
const encryptData = async (data: unknown): Promise<string> => {
	if (!activeCryptoKey) {
		throw new Error('La base de datos está bloqueada. No hay clave criptográfica activa.');
	}
	const jsonString = JSON.stringify(data);
	return encryptWithKey(jsonString, activeCryptoKey);
};

/**
 * Descifra una cadena cifrada y retorna el objeto parsed correspondiente.
 */
const decryptData = async <T = unknown>(ciphertext: string): Promise<T> => {
	if (!activeCryptoKey) {
		throw new Error('La base de datos está bloqueada. No hay clave criptográfica activa.');
	}
	const decryptedText = await decryptWithKey(ciphertext, activeCryptoKey);
	return JSON.parse(decryptedText) as T;
};

const isConfigEntity = (entity: unknown): entity is ConfigEntity => {
	return typeof entity === 'object' && entity !== null && 'key' in entity;
};

const readConfigValue = async (key: string): Promise<string> => {
	const entity = await idb.getSingleEntity('config', key);
	if (!isConfigEntity(entity)) return '';
	if (entity.ciphertext) {
		if (!activeCryptoKey) return '';
		return decryptWithKey(entity.ciphertext, activeCryptoKey);
	}
	return entity.value || '';
};

const saveConfigValue = async (key: string, value: string, options: { encrypt?: boolean } = {}): Promise<void> => {
	if (options.encrypt !== false && activeCryptoKey && value.trim()) {
		const ciphertext = await encryptWithKey(value, activeCryptoKey);
		await idb.saveSingleEntity('config', { key, ciphertext });
		return;
	}
	await idb.saveSingleEntity('config', { key, value });
};

export const readUserNames = async (): Promise<UserNames> => {
	try {
		const [userAName, userBName] = await Promise.all([
			readConfigValue(IDB_CONFIG_KEYS.userAName),
			readConfigValue(IDB_CONFIG_KEYS.userBName)
		]);
		return {
			userAName: userAName || DEFAULT_USER_NAMES.userAName,
			userBName: userBName || DEFAULT_USER_NAMES.userBName
		};
	} catch (error) {
		console.error('Error reading user names from IndexedDB:', error);
		return DEFAULT_USER_NAMES;
	}
};

const saveUserNamesStrict = async (names: Partial<UserNames>): Promise<void> => {
	const writes: Promise<void>[] = [];
	if (names.userAName !== undefined) {
		writes.push(saveConfigValue(IDB_CONFIG_KEYS.userAName, names.userAName));
	}
	if (names.userBName !== undefined) {
		writes.push(saveConfigValue(IDB_CONFIG_KEYS.userBName, names.userBName));
	}
	await Promise.all(writes);
};

export const saveUserNames = async (names: Partial<UserNames>): Promise<void> => {
	try {
		await saveUserNamesStrict(names);
	} catch (error) {
		console.error('Error saving user names to IndexedDB:', error);
	}
};

export const readProfileCount = async (): Promise<number> => {
	try {
		const val = await readConfigValue(IDB_CONFIG_KEYS.profileCount);
		return val ? parseInt(val, 10) : 2;
	} catch (error) {
		console.error('Error reading profileCount from IndexedDB:', error);
		return 2;
	}
};

export const saveProfileCount = async (count: number): Promise<void> => {
	try {
		await saveConfigValue(IDB_CONFIG_KEYS.profileCount, String(count));
	} catch (error) {
		console.error('Error saving profileCount to IndexedDB:', error);
	}
};

const hasUnifiedIdbMigrationCompleted = async (): Promise<boolean> => {
	try {
		return (await readConfigValue(IDB_CONFIG_KEYS.migrationCompleted)) === 'true';
	} catch (error) {
		console.error('Error reading IndexedDB migration flag:', error);
		return false;
	}
};

const markUnifiedIdbMigrationCompleted = async (): Promise<void> => {
	await saveConfigValue(IDB_CONFIG_KEYS.migrationCompleted, 'true', { encrypt: false });
};

const hasIdbEntities = async (storeName: string): Promise<boolean> => {
	try {
		return (await idb.getAllEntities(storeName)).length > 0;
	} catch (error) {
		console.error(`Error checking IndexedDB store ${storeName}:`, error);
		return false;
	}
};

const hasConfigEntity = async (key: string): Promise<boolean> => {
	try {
		return (await idb.getSingleEntity('config', key)) !== null;
	} catch (error) {
		console.error(`Error checking IndexedDB config ${key}:`, error);
		return false;
	}
};

const getLegacyUserNames = (): UserNames => ({
	userAName:
		(typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEYS.userAName)) || DEFAULT_USER_NAMES.userAName,
	userBName:
		(typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEYS.userBName)) || DEFAULT_USER_NAMES.userBName
});

const migrateLegacyUserNamesToIdb = async (): Promise<void> => {
	if (typeof window === 'undefined') return;
	const legacyUserAName = localStorage.getItem(STORAGE_KEYS.userAName);
	const legacyUserBName = localStorage.getItem(STORAGE_KEYS.userBName);
	if (!legacyUserAName && !legacyUserBName) return;

	const [storedUserAName, storedUserBName] = await Promise.all([
		readConfigValue(IDB_CONFIG_KEYS.userAName),
		readConfigValue(IDB_CONFIG_KEYS.userBName)
	]);

	await saveUserNamesStrict({
		userAName: storedUserAName || legacyUserAName || DEFAULT_USER_NAMES.userAName,
		userBName: storedUserBName || legacyUserBName || DEFAULT_USER_NAMES.userBName
	});
};

const buildDefaultAccounts = (userAName: string, userBName: string, periods: Period[]): Account[] => {
	const sortedPeriods = [...periods].sort((a, b) => a.month.localeCompare(b.month));
	const firstPeriod = sortedPeriods.length > 0 ? sortedPeriods[0] : null;
	const initialBalA = firstPeriod
		? firstPeriod.openingBalanceA !== undefined
			? firstPeriod.openingBalanceA
			: firstPeriod.openingBalance / 2
		: 0;
	const initialBalB = firstPeriod
		? firstPeriod.openingBalanceB !== undefined
			? firstPeriod.openingBalanceB
			: firstPeriod.openingBalance / 2
		: 0;

	return [
		{ id: 'default-a', name: `Efectivo ${userAName}`, owner: 'userA', initialBalance: initialBalA },
		{ id: 'default-b', name: `Efectivo ${userBName}`, owner: 'userB', initialBalance: initialBalB },
		{ id: 'default-joint', name: 'Cuenta Común', owner: 'joint', initialBalance: 0 }
	];
};

const assignDefaultAccountIds = (transactions: Transaction[]): Transaction[] => {
	return transactions.map((transaction) => {
		if (!transaction.accountId && transaction.type !== 'transfer') {
			if (transaction.owner === 'userA') return { ...transaction, accountId: 'default-a' };
			if (transaction.owner === 'userB') return { ...transaction, accountId: 'default-b' };
			return { ...transaction, accountId: 'default-joint' };
		}
		return transaction;
	});
};

/**
 * Marca la limpieza legacy como revisada sin borrar datos de dominio antes de la migración a IndexedDB.
 * La limpieza destructiva de claves legacy se realiza solo después de una migración exitosa.
 */
export const cleanLegacyData = (): void => {
	if (typeof window !== 'undefined' && !localStorage.getItem(STORAGE_KEYS.clearedV2)) {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
	}
};

/**
 * Lee de forma segura un array JSON desde LocalStorage o lo descifra si es necesario.
 */
const readStoredArray = async (primaryKey: string, fallbackKey?: string): Promise<unknown[]> => {
	const read = async (key: string) => {
		try {
			const stored = localStorage.getItem(key);
			if (!stored) return null;

			// Si empieza con { o [ asumimos texto plano
			if (stored.startsWith('[') || stored.startsWith('{')) {
				const parsed = JSON.parse(stored);
				return Array.isArray(parsed) ? parsed : null;
			}

			// En caso contrario, descifrar si hay una clave activa
			if (activeCryptoKey) {
				const decrypted = await decryptData(stored);
				return Array.isArray(decrypted) ? decrypted : null;
			}
			return null;
		} catch {
			return null;
		}
	};

	return (await read(primaryKey)) ?? (fallbackKey ? await read(fallbackKey) : null) ?? [];
};

/**
 * Migra una estructura de transacción sin tipar a un objeto Transaction válido de la v3.
 */
export const migrateTransaction = (rawTransaction: UnsafeRecord, index: number): Transaction => {
	const tx = rawTransaction || {};
	const type: TransactionType =
		tx['type'] === 'income' ? 'income' : tx['type'] === 'transfer' ? 'transfer' : 'expense';

	const rawMoney = tx['money'] && typeof tx['money'] === 'object' ? (tx['money'] as Record<string, unknown>) : null;
	const moneyAmount =
		rawMoney && rawMoney['amount'] !== undefined
			? String(rawMoney['amount'])
			: String(tx['amount'] ?? '0');
	const moneyCurrency = rawMoney && typeof rawMoney['currency'] === 'string' ? rawMoney['currency'] : 'EUR';
	const money = {
		amount: Math.abs(toNumber(moneyAmount)).toFixed(2),
		currency: (moneyCurrency === 'EUR' || moneyCurrency === 'USD' || moneyCurrency === 'GBP'
			? moneyCurrency
			: 'EUR') as 'EUR' | 'USD' | 'GBP'
	};

	return {
		id: String(tx['id'] ?? `tx-${index + 1}`),
		desc: String(tx['desc'] ?? 'Movimiento sin nombre'),
		money,
		type,
		tag: String(
			tx['tag'] ??
				(type === 'transfer'
					? DEFAULT_TAGS.transfer[0]
					: type === 'income'
						? DEFAULT_TAGS.income[0]
						: DEFAULT_TAGS.expense[0])
		),
		date: String(tx['date'] ?? new Date().toISOString().substring(0, 10)).substring(0, 10),
		recurrence: tx['recurrence'] === 'recurring' ? 'recurring' : 'one-off',
		originId: tx['originId'] ? String(tx['originId']) : undefined,
		owner:
			tx['owner'] === 'userA' || tx['owner'] === 'userB' || tx['owner'] === 'joint'
				? (tx['owner'] as 'userA' | 'userB' | 'joint')
				: 'joint',
		paidBy:
			tx['paidBy'] === 'userA' ||
			tx['paidBy'] === 'userB' ||
			tx['paidBy'] === 'shared'
				? (tx['paidBy'] as 'userA' | 'userB' | 'shared')
				: 'shared',
		accountId: tx['accountId'] ? String(tx['accountId']) : undefined,
		fromAccountId: tx['fromAccountId'] ? String(tx['fromAccountId']) : undefined,
		toAccountId: tx['toAccountId'] ? String(tx['toAccountId']) : undefined
	};
};

/**
 * Migra una estructura de deuda sin tipar a un objeto de tipo Debt (clásica o plan de pagos) válido de la v3.
 */
export const migrateDebt = (rawDebt: UnsafeRecord): Debt => {
	const debt = rawDebt || {};
	const id = String(debt['id'] ?? Date.now());
	const desc = String(debt['desc'] ?? 'Deuda sin nombre');
	const tag = String(debt['tag'] ?? DEFAULT_TAGS.debt[0]);
	const date = normalizeMonth(debt['date'] as string);
	const owner =
		debt['owner'] === 'userA' || debt['owner'] === 'userB' || debt['owner'] === 'joint'
			? (debt['owner'] as 'userA' | 'userB' | 'joint')
			: 'joint';
	const paymentAccountId = debt['paymentAccountId'] ? String(debt['paymentAccountId']) : undefined;
	const rawChargeDay = Math.trunc(toNumber(debt['chargeDay']));
	const chargeDay = rawChargeDay >= 1 && rawChargeDay <= 31 ? rawChargeDay : undefined;
	const recurringMonthlyCosts =
		debt['recurringMonthlyCosts'] !== undefined ? Math.abs(toNumber(debt['recurringMonthlyCosts'])) : undefined;
	const optionalDebtBase = {
		...(paymentAccountId ? { paymentAccountId } : {}),
		...(chargeDay !== undefined ? { chargeDay } : {}),
		...(recurringMonthlyCosts !== undefined ? { recurringMonthlyCosts } : {})
	};

	if (debt['kind'] === 'paymentPlan') {
		const rawInstallments = debt['installments'];
		const installments: PaymentPlanInstallment[] = Array.isArray(rawInstallments)
			? rawInstallments.map((inst: unknown, index: number) => {
					const installment = inst as Record<string, unknown>;
					return {
						id: String(installment['id'] ?? `${id}-installment-${index + 1}`),
						dueMonth: normalizeMonth(installment['dueMonth'] as string),
						amount: Math.abs(toNumber(installment['amount'])),
						status: installment['status'] === 'paid' ? 'paid' : 'pending',
						label: String(installment['label'] ?? `Cuota ${index + 1}`)
					};
				})
			: [];
		const financedAmount = Math.abs(toNumber(debt['financedAmount']));
		const fees = Math.abs(toNumber(debt['fees']));
		const totalToPay = Math.abs(toNumber(debt['totalToPay'])) || financedAmount + fees;
		return {
			id,
			kind: 'paymentPlan',
			desc,
			tag,
			date,
			owner,
			...optionalDebtBase,
			financedAmount,
			fees,
			totalToPay,
			installments
		};
	}

	return {
		id,
		kind: 'classic',
		desc,
		tag,
		date,
		owner,
		...optionalDebtBase,
		principal: Math.abs(toNumber(debt['principal'])),
		...(debt['openingCommission'] !== undefined
			? { openingCommission: Math.abs(toNumber(debt['openingCommission'])) }
			: {}),
		...(debt['tin'] !== undefined ? { tin: Math.abs(toNumber(debt['tin'])) } : {}),
		tae: Math.abs(toNumber(debt['tae'])),
		termMonths: Math.max(1, Math.trunc(toNumber(debt['termMonths'])))
	};
};

/**
 * Guarda un array de entidades en lote en un almacén de IndexedDB, limpiándolo primero.
 */
const saveEntitiesToIdbBulk = async <T extends object>(
	storeName: string,
	keyField: keyof T & string,
	entities: T[]
): Promise<void> => {
	if (activeCryptoKey) {
		const encryptedEntities = await Promise.all(
			entities.map(async (entity) => {
				const keyVal = entity[keyField];
				const ciphertext = await encryptData(entity);
				return { [keyField]: keyVal, ciphertext };
			})
		);
		await idb.clearStore(storeName);
		await idb.saveEntitiesBulk(storeName, encryptedEntities);
	} else {
		await idb.clearStore(storeName);
		await idb.saveEntitiesBulk(storeName, entities);
	}
};

const saveStoredTransactionsStrict = async (transactions: Transaction[]): Promise<void> => {
	await saveEntitiesToIdbBulk('transactions', 'id', transactions);
};

const saveStoredDebtsStrict = async (debts: Debt[]): Promise<void> => {
	await saveEntitiesToIdbBulk('debts', 'id', debts);
};

const saveStoredPeriodsStrict = async (periods: Period[]): Promise<void> => {
	await saveEntitiesToIdbBulk('periods', 'month', periods);
};

const saveStoredAccountsStrict = async (accounts: Account[]): Promise<void> => {
	await saveEntitiesToIdbBulk('accounts', 'id', accounts);
};

const saveGeminiApiKeyStrict = async (key: string): Promise<void> => {
	if (activeCryptoKey && key.trim()) {
		const ciphertext = await encryptWithKey(key, activeCryptoKey);
		await idb.saveSingleEntity('config', { key: 'geminiKey', ciphertext });
		return;
	}
	await idb.saveSingleEntity('config', { key: 'geminiKey', value: key });
};

const saveAiChatStrict = async (chat: ChatMessage[]): Promise<void> => {
	if (activeCryptoKey) {
		const ciphertext = await encryptData({ id: 'history', messages: chat });
		await idb.saveSingleEntity('chat', { id: 'history', ciphertext });
		return;
	}
	await idb.saveSingleEntity('chat', { id: 'history', messages: chat });
};

/**
 * Lee todas las entidades de un almacén de IndexedDB y las descifra si están cifradas.
 */
const readEntitiesFromIdb = async (storeName: string): Promise<unknown[]> => {
	const raw = await idb.getAllEntities<{ ciphertext?: string }>(storeName);
	const decrypted = await Promise.all(
		raw.map(async (item) => {
			if (item && typeof item === 'object' && 'ciphertext' in item && typeof item.ciphertext === 'string') {
				if (activeCryptoKey) {
					return await decryptData<unknown>(item.ciphertext);
				}
				return null;
			}
			return item as unknown;
		})
	);
	return decrypted.filter((item): item is unknown => item !== null);
};

/**
 * Realiza una migración única, transparente y transaccional de todas las entidades desde localStorage hacia IndexedDB.
 * Se invoca automáticamente tras el arranque de la aplicación o el descifrado exitoso inicial.
 */
export const executeSilentMigrationIfRequired = async (decryptedTransactions?: Transaction[]): Promise<void> => {
	try {
		await migrateLegacyUserNamesToIdb();
		const migrationUserNames = await readUserNames();

		const idbMigrationCompleted = await hasUnifiedIdbMigrationCompleted();
		const legacyMigrationCompleted = localStorage.getItem(UNIFIED_IDB_MIGRATION_FLAG) === 'true';
		if (idbMigrationCompleted || legacyMigrationCompleted) {
			if (!idbMigrationCompleted && legacyMigrationCompleted) {
				await markUnifiedIdbMigrationCompleted();
			}
			localStorage.removeItem(STORAGE_KEYS.userAName);
			localStorage.removeItem(STORAGE_KEYS.userBName);
			localStorage.removeItem(UNIFIED_IDB_MIGRATION_FLAG);
			return;
		}

		console.info('Iniciando migración unificada de persistencia a IndexedDB (V5)...');

		let rawAccounts = (await readStoredArray(STORAGE_KEYS.accounts)) as Account[];
		const rawTx =
			decryptedTransactions && decryptedTransactions.length > 0
				? decryptedTransactions
				: ((await readStoredArray(STORAGE_KEYS.transactions, 'finanzas_v2_transactions')) as Transaction[]);
		let migratedTx = Array.isArray(rawTx) ? rawTx.map((tx) => migrateTransaction(tx as UnsafeRecord, 0)) : [];
		const rawDebts = (await readStoredArray(STORAGE_KEYS.debts, 'finanzas_v2_debts')) as Debt[];
		const migratedDebts = Array.isArray(rawDebts) ? rawDebts.map(migrateDebt) : [];
		const rawPeriods = (await readStoredArray(STORAGE_KEYS.periods)) as Period[];

		if (
			(!Array.isArray(rawAccounts) || rawAccounts.length === 0) &&
			(migratedTx.length > 0 || migratedDebts.length > 0)
		) {
			rawAccounts = buildDefaultAccounts(migrationUserNames.userAName, migrationUserNames.userBName, rawPeriods);
			migratedTx = assignDefaultAccountIds(migratedTx);
		}

		if (Array.isArray(rawAccounts) && rawAccounts.length > 0 && !(await hasIdbEntities('accounts'))) {
			await saveStoredAccountsStrict(rawAccounts);
		}
		if (migratedTx.length > 0 && !(await hasIdbEntities('transactions'))) {
			await saveStoredTransactionsStrict(migratedTx);
		}
		if (migratedDebts.length > 0 && !(await hasIdbEntities('debts'))) {
			await saveStoredDebtsStrict(migratedDebts);
		}
		if (Array.isArray(rawPeriods) && rawPeriods.length > 0 && !(await hasIdbEntities('periods'))) {
			await saveStoredPeriodsStrict(rawPeriods);
		}

		const storedGemini = localStorage.getItem(STORAGE_KEYS.geminiKey);
		if (storedGemini && !(await hasConfigEntity('geminiKey'))) {
			let geminiKey = '';
			try {
				if (storedGemini.startsWith('{') || storedGemini.startsWith('[') || storedGemini.length < 50) {
					geminiKey = storedGemini;
				} else if (activeCryptoKey) {
					geminiKey = await decryptWithKey(storedGemini, activeCryptoKey);
				}
			} catch (e) {
				console.error('Error al decodificar Gemini key durante migración:', e);
				geminiKey = storedGemini;
			}
			if (geminiKey) {
				await saveGeminiApiKeyStrict(geminiKey);
			}
		}

		const rawChat = (await readStoredArray(STORAGE_KEYS.aiChat)) as ChatMessage[];
		if (Array.isArray(rawChat) && rawChat.length > 0 && !(await hasIdbEntities('chat'))) {
			await saveAiChatStrict(rawChat);
		}

		await markUnifiedIdbMigrationCompleted();
		console.info('Migración unificada a IndexedDB (V5) completada con éxito.');

		localStorage.removeItem(STORAGE_KEYS.transactions);
		localStorage.removeItem(STORAGE_KEYS.debts);
		localStorage.removeItem(STORAGE_KEYS.periods);
		localStorage.removeItem(STORAGE_KEYS.accounts);
		localStorage.removeItem(STORAGE_KEYS.userAName);
		localStorage.removeItem(STORAGE_KEYS.userBName);
		localStorage.removeItem(STORAGE_KEYS.aiChat);
		localStorage.removeItem(STORAGE_KEYS.geminiKey);
		localStorage.removeItem(UNIFIED_IDB_MIGRATION_FLAG);
		localStorage.removeItem('finanzas_v4_idb_migrated');
		localStorage.removeItem('finanzas_v2_transactions');
		localStorage.removeItem('finanzas_v2_debts');
		localStorage.removeItem('finanzas_v2_gemini_key');

		console.info('Limpieza de claves obsoletas de LocalStorage finalizada.');
	} catch (error) {
		console.error('Error crítico no recuperable en el proceso de migración unificada:', error);
	}
};

/**
 * Lee las transacciones desde IndexedDB.
 */
export const readStoredTransactions = async (): Promise<Transaction[]> => {
	try {
		const rawTxs = await readEntitiesFromIdb('transactions');
		return rawTxs.map((item, index) => {
			const parsed = TransactionSchema.safeParse(item);
			if (parsed.success) {
				return parsed.data;
			}
			const migrated = migrateTransaction(item as UnsafeRecord, index);
			return TransactionSchema.parse(migrated);
		});
	} catch (error) {
		console.error('Error reading transactions from IndexedDB:', error);
		return [];
	}
};

/**
 * Guarda las transacciones en IndexedDB.
 */
export const saveStoredTransactions = async (transactions: Transaction[]): Promise<void> => {
	try {
		await saveStoredTransactionsStrict(transactions);
	} catch (error) {
		console.error('Error saving transactions to IndexedDB:', error);
	}
};

/**
 * Lee las deudas desde IndexedDB.
 */
export const readStoredDebts = async (): Promise<Debt[]> => {
	try {
		const rawDebts = await readEntitiesFromIdb('debts');
		return rawDebts.map((item) => {
			const parsed = DebtSchema.safeParse(item);
			if (parsed.success) {
				return parsed.data;
			}
			const migrated = migrateDebt(item as UnsafeRecord);
			return DebtSchema.parse(migrated);
		});
	} catch (error) {
		console.error('Error reading debts from IndexedDB:', error);
		return [];
	}
};

/**
 * Lee deudas sincrónicamente (solo para inicializadores de estado cuando no está cifrado).
 */
export const readStoredDebtsSync = (): Debt[] => {
	if (
		typeof window !== 'undefined' &&
		(localStorage.getItem('finanzas_v3_password_salt') ||
			localStorage.getItem('finanzas_v5_unified_idb') === 'true')
	) {
		return [];
	}
	const stored = localStorage.getItem(STORAGE_KEYS.debts) || localStorage.getItem('finanzas_v2_debts');
	if (!stored) return [];
	try {
		const parsed = JSON.parse(stored);
		return Array.isArray(parsed) ? parsed.map((item) => {
			const validated = DebtSchema.safeParse(item);
			if (validated.success) return validated.data;
			return migrateDebt(item as UnsafeRecord);
		}) : [];
	} catch {
		return [];
	}
};

/**
 * Guarda las deudas en IndexedDB.
 */
export const saveStoredDebts = async (debts: Debt[]): Promise<void> => {
	try {
		await saveStoredDebtsStrict(debts);
	} catch (error) {
		console.error('Error saving debts to IndexedDB:', error);
	}
};

/**
 * Lee los periodos de balance mensual desde IndexedDB o los autogenera si no existen.
 */
export const readStoredPeriods = async (existingTx: Transaction[], existingDebts: Debt[]): Promise<Period[]> => {
	try {
		const periods = await readEntitiesFromIdb('periods');
		if (periods.length > 0) {
			return periods.map((rawPeriod: unknown) => {
				const parsed = PeriodSchema.safeParse(rawPeriod);
				if (parsed.success) {
					return parsed.data;
				}
				const raw = rawPeriod as Record<string, unknown>;
				const openingBalance = toNumber(raw['openingBalance']);
				const periodData = {
					month: normalizeMonth(raw['month'] as string),
					openingBalance,
					openingBalanceA:
						raw['openingBalanceA'] !== undefined
							? toNumber(raw['openingBalanceA'])
							: openingBalance / 2,
					openingBalanceB:
						raw['openingBalanceB'] !== undefined
							? toNumber(raw['openingBalanceB'])
							: openingBalance / 2,
					isManualInit: !!raw['isManualInit']
				};
				return PeriodSchema.parse(periodData);
			});
		}
	} catch (error) {
		console.error('Error reading periods from IndexedDB:', error);
	}

	// Generación bajo demanda en caso de migración sin periodos registrados
	const months = new Set<string>();
	existingTx.forEach((t) => {
		if (t.date) months.add(t.date.substring(0, 7));
	});
	existingDebts.forEach((d) => {
		if (d.date) months.add(normalizeMonth(d.date));
	});

	if (months.size === 0) {
		return [];
	}

	const sortedMonths = Array.from(months).sort();
	const startMonth = sortedMonths[0];
	const currentMonth = new Date().toISOString().substring(0, 7);
	const endMonth =
		sortedMonths[sortedMonths.length - 1] > currentMonth ? sortedMonths[sortedMonths.length - 1] : currentMonth;

	const generatedPeriods: Period[] = [];
	let iterMonth = startMonth;
	while (iterMonth <= endMonth) {
		generatedPeriods.push({
			month: iterMonth,
			openingBalance: 0,
			openingBalanceA: 0,
			openingBalanceB: 0
		});
		iterMonth = addMonthsToMonth(iterMonth, 1);
	}
	return generatedPeriods;
};

/**
 * Guarda los periodos en IndexedDB.
 */
export const saveStoredPeriods = async (periods: Period[]): Promise<void> => {
	try {
		await saveStoredPeriodsStrict(periods);
	} catch (error) {
		console.error('Error saving periods to IndexedDB:', error);
	}
};

/**
 * Inicializa y obtiene los datos almacenados de cuentas, transacciones y períodos contables de forma síncrona.
 * Retorna arrays vacíos si la base de datos está bloqueada (con PIN/contraseña configurado),
 * o si ya ha sido migrada a IndexedDB V5, delegando la carga asíncrona a IndexedDB.
 */
export const getInitialData = (): {
	accounts: Account[];
	transactions: Transaction[];
	periods: Period[];
} => {
	if (
		typeof window !== 'undefined' &&
		(localStorage.getItem('finanzas_v3_password_salt') ||
			localStorage.getItem('finanzas_v5_unified_idb') === 'true')
	) {
		// La base de datos está bloqueada por PIN/Contraseña o ya migrada a IndexedDB V5.
		return {
			accounts: [],
			transactions: [],
			periods: []
		};
	}

	// Carga síncrona original para entornos sin cifrado / primer inicio.
	cleanLegacyData();

	const readStoredTransactionsSync = (): Transaction[] => {
		try {
			const stored = localStorage.getItem(STORAGE_KEYS.transactions);
			if (!stored) return [];
			const parsed = JSON.parse(stored);
			return Array.isArray(parsed) ? parsed.map(migrateTransaction) : [];
		} catch {
			return [];
		}
	};

	const readStoredDebtsSync = (): Debt[] => {
		try {
			const stored = localStorage.getItem(STORAGE_KEYS.debts);
			if (!stored) return [];
			const parsed = JSON.parse(stored);
			return Array.isArray(parsed) ? parsed.map(migrateDebt) : [];
		} catch {
			return [];
		}
	};

	const readStoredPeriodsSync = (existingTx: Transaction[], existingDebts: Debt[]): Period[] => {
		try {
			const stored = localStorage.getItem(STORAGE_KEYS.periods);
			if (stored) {
				const parsed = JSON.parse(stored);
				if (Array.isArray(parsed) && parsed.length > 0) {
					return parsed.map((item: unknown) => {
						const rawPeriod = item as Record<string, unknown>;
						const openingBalance = toNumber(rawPeriod['openingBalance']);
						return {
							month: normalizeMonth(rawPeriod['month'] as string),
							openingBalance,
							openingBalanceA:
								rawPeriod['openingBalanceA'] !== undefined
									? toNumber(rawPeriod['openingBalanceA'])
									: openingBalance / 2,
							openingBalanceB:
								rawPeriod['openingBalanceB'] !== undefined
									? toNumber(rawPeriod['openingBalanceB'])
									: openingBalance / 2,
							isManualInit: !!rawPeriod['isManualInit']
						};
					});
				}
			}
		} catch (error) {
			console.error('Error reading periods from LocalStorage:', error);
		}

		const months = new Set<string>();
		existingTx.forEach((t) => {
			if (t.date) months.add(t.date.substring(0, 7));
		});
		existingDebts.forEach((d) => {
			if (d.date) months.add(normalizeMonth(d.date));
		});

		if (months.size === 0) return [];

		const sortedMonths = Array.from(months).sort();
		const startMonth = sortedMonths[0];
		const currentMonth = new Date().toISOString().substring(0, 7);
		const endMonth =
			sortedMonths[sortedMonths.length - 1] > currentMonth ? sortedMonths[sortedMonths.length - 1] : currentMonth;

		const generatedPeriods: Period[] = [];
		let iterMonth = startMonth;
		while (iterMonth <= endMonth) {
			generatedPeriods.push({
				month: iterMonth,
				openingBalance: 0,
				openingBalanceA: 0,
				openingBalanceB: 0
			});
			iterMonth = addMonthsToMonth(iterMonth, 1);
		}
		return generatedPeriods;
	};

	const rawTransactions = readStoredTransactionsSync();
	const rawDebts = readStoredDebtsSync();
	const rawPeriods = readStoredPeriodsSync(rawTransactions, rawDebts);

	const storedAccounts = localStorage.getItem(STORAGE_KEYS.accounts);
	if (storedAccounts) {
		try {
			const parsed = JSON.parse(storedAccounts);
			if (Array.isArray(parsed) && parsed.length > 0) {
				return {
					accounts: parsed as Account[],
					transactions: rawTransactions,
					periods: rawPeriods
				};
			}
		} catch (error) {
			console.error('Error reading accounts from LocalStorage:', error);
		}
	}

	const legacyUserNames = getLegacyUserNames();
	const migratedAccounts = buildDefaultAccounts(legacyUserNames.userAName, legacyUserNames.userBName, rawPeriods);
	const migratedTransactions = assignDefaultAccountIds(rawTransactions);

	return {
		accounts: migratedAccounts,
		transactions: migratedTransactions,
		periods: rawPeriods
	};
};

/**
 * Lee las cuentas desde IndexedDB.
 */
export const readStoredAccounts = async (): Promise<Account[]> => {
	try {
		const rawAccounts = await readEntitiesFromIdb('accounts');
		return rawAccounts.map((item) => {
			const parsed = AccountSchema.safeParse(item);
			if (parsed.success) {
				return parsed.data;
			}
			const rawAcc = item as Record<string, unknown>;
			const accData = {
				id: String(rawAcc['id'] || ''),
				name: String(rawAcc['name'] || ''),
				owner: (rawAcc['owner'] === 'userA' || rawAcc['owner'] === 'userB' || rawAcc['owner'] === 'joint' ? rawAcc['owner'] : 'joint') as 'userA' | 'userB' | 'joint',
				initialBalance: toNumber(rawAcc['initialBalance'])
			};
			return AccountSchema.parse(accData);
		});
	} catch (error) {
		console.error('Error reading accounts from IndexedDB:', error);
		return [];
	}
};

/**
 * Guarda las cuentas en IndexedDB.
 */
export const saveStoredAccounts = async (accounts: Account[]): Promise<void> => {
	try {
		await saveStoredAccountsStrict(accounts);
	} catch (error) {
		console.error('Error saving accounts to IndexedDB:', error);
	}
};

/**
 * Lee la clave API de Gemini desde IndexedDB (config store, key: 'geminiKey').
 */
export const readGeminiApiKey = async (): Promise<string> => {
	try {
		const entity = await idb.getSingleEntity<{ ciphertext?: string; value?: string }>('config', 'geminiKey');
		if (!entity) return '';
		if ('ciphertext' in entity && typeof entity.ciphertext === 'string') {
			if (activeCryptoKey) {
				return await decryptWithKey(entity.ciphertext, activeCryptoKey);
			}
			return '';
		}
		return entity.value || '';
	} catch (error) {
		console.error('Error reading Gemini API key from IndexedDB:', error);
		return '';
	}
};

/**
 * Lee la clave API de Gemini de forma sincrónica (solo para inicializadores de estado).
 */
export const readGeminiApiKeySync = (): string => {
	if (
		typeof window !== 'undefined' &&
		(localStorage.getItem('finanzas_v3_password_salt') ||
			localStorage.getItem('finanzas_v5_unified_idb') === 'true')
	) {
		return '';
	}
	return localStorage.getItem(STORAGE_KEYS.geminiKey) || '';
};

/**
 * Guarda la clave API de Gemini en IndexedDB (config store, key: 'geminiKey').
 */
export const saveGeminiApiKey = async (key: string): Promise<void> => {
	try {
		await saveGeminiApiKeyStrict(key);
	} catch (error) {
		console.error('Error saving Gemini API key to IndexedDB:', error);
	}
};

/**
 * Lee el historial del chat desde IndexedDB (chat store, id: 'history').
 */
export const readAiChat = async (): Promise<ChatMessage[]> => {
	try {
		const entity = await idb.getSingleEntity<{ ciphertext?: string; messages?: unknown }>('chat', 'history');
		if (!entity) return [];

		let rawMessages: unknown = [];
		if (entity && 'ciphertext' in entity && typeof entity.ciphertext === 'string') {
			if (activeCryptoKey) {
				const decrypted = await decryptData<{ messages?: unknown }>(entity.ciphertext);
				rawMessages = decrypted.messages || [];
			}
		} else if (entity) {
			rawMessages = entity.messages || [];
		}

		if (!Array.isArray(rawMessages)) return [];

		return rawMessages.map((msg) => {
			const parsed = ChatMessageSchema.safeParse(msg);
			const rawMsg = msg as Record<string, unknown>;
			const validMsg = parsed.success ? parsed.data : {
				role: (typeof msg === 'object' && msg !== null && 'role' in msg && msg.role === 'model' ? 'model' : 'user') as 'user' | 'model',
				content: String(rawMsg['content'] || ''),
				timestamp: String(rawMsg['timestamp'] || new Date().toISOString())
			};
			return {
				...validMsg,
				content: decodeHtmlEntities(validMsg.content || '')
			};
		});
	} catch (error) {
		console.error('Error reading AI chat from IndexedDB:', error);
		return [];
	}
};

/**
 * Lee el chat de forma sincrónica (solo para inicializadores de estado).
 */
export const readAiChatSync = (): ChatMessage[] => {
	if (
		typeof window !== 'undefined' &&
		(localStorage.getItem('finanzas_v3_password_salt') ||
			localStorage.getItem('finanzas_v5_unified_idb') === 'true')
	) {
		return [];
	}
	const stored = localStorage.getItem(STORAGE_KEYS.aiChat);
	if (!stored) return [];
	try {
		const parsed = JSON.parse(stored);
		return Array.isArray(parsed)
			? parsed.map((msg: ChatMessage) => ({
					...msg,
					content: decodeHtmlEntities(msg.content || '')
				}))
			: [];
	} catch {
		return [];
	}
};

/**
 * Guarda el historial del chat en IndexedDB (chat store, id: 'history').
 */
export const saveAiChat = async (chat: ChatMessage[]): Promise<void> => {
	try {
		await saveAiChatStrict(chat);
	} catch (error) {
		console.error('Error saving AI chat to IndexedDB:', error);
	}
};

const normalizePeriodsForBackup = (periods: Period[]): Period[] =>
	periods.map((period) => {
		const openingBalance = toNumber(period.openingBalance);
		const normalizedPeriod: Period = {
			month: normalizeMonth(period.month),
			openingBalance,
			openingBalanceA:
				period.openingBalanceA !== undefined ? toNumber(period.openingBalanceA) : openingBalance / 2,
			openingBalanceB:
				period.openingBalanceB !== undefined ? toNumber(period.openingBalanceB) : openingBalance / 2
		};
		if (period.isManualInit !== undefined) {
			normalizedPeriod.isManualInit = !!period.isManualInit;
		}
		return normalizedPeriod;
	});

const removeFinanceDomainLocalStorageKeys = (): void => {
	if (typeof window === 'undefined') return;
	FINANCE_BACKUP_KEYS.forEach((key) => localStorage.removeItem(key));
	localStorage.removeItem('finanzas_v2_transactions');
	localStorage.removeItem('finanzas_v2_debts');
	localStorage.removeItem('finanzas_v2_gemini_key');
};

const filterBackupPayload = (payload: Record<string, unknown>): Record<string, unknown> => {
	const filteredPayload: Record<string, unknown> = {};
	FINANCE_BACKUP_KEYS.forEach((key) => {
		const value = payload[key];
		if (value !== undefined && value !== null) {
			filteredPayload[key] = value;
		}
	});
	return filteredPayload;
};

export const buildFinanceBackupPayload = (snapshot: FinanceBackupSnapshot): FinanceBackupPayload => ({
	[STORAGE_KEYS.transactions]: JSON.stringify(snapshot.transactions),
	[STORAGE_KEYS.debts]: JSON.stringify(snapshot.debts),
	[STORAGE_KEYS.periods]: JSON.stringify(normalizePeriodsForBackup(snapshot.periods)),
	[STORAGE_KEYS.accounts]: JSON.stringify(snapshot.accounts),
	[STORAGE_KEYS.userAName]: snapshot.userAName.trim() || DEFAULT_USER_NAMES.userAName,
	[STORAGE_KEYS.userBName]: snapshot.userBName.trim() || DEFAULT_USER_NAMES.userBName,
	[STORAGE_KEYS.profileCount]: snapshot.profileCount !== undefined ? String(snapshot.profileCount) : '2',
	[STORAGE_KEYS.aiChat]: JSON.stringify(snapshot.chatMessages),
	[STORAGE_KEYS.geminiKey]: snapshot.geminiApiKey.trim() ? snapshot.geminiApiKey : null
});

export const readFinanceBackupPayload = async (): Promise<FinanceBackupPayload> => {
	const [transactions, debts, accounts, userNames, geminiApiKey, chatMessages, profileCount] = await Promise.all([
		readStoredTransactions(),
		readStoredDebts(),
		readStoredAccounts(),
		readUserNames(),
		readGeminiApiKey(),
		readAiChat(),
		readProfileCount()
	]);
	const periods = await readStoredPeriods(transactions, debts);

	return buildFinanceBackupPayload({
		accounts,
		transactions,
		debts,
		periods,
		userAName: userNames.userAName,
		userBName: userNames.userBName,
		geminiApiKey,
		chatMessages,
		profileCount
	});
};

export const importFinanceBackupPayload = async (
	payload: Record<string, unknown>
): Promise<ImportedFinanceBackupData> => {
	const validated = validateAndSanitizeBackup(filterBackupPayload(payload)) as ImportedFinanceBackupData;
	const imported: ImportedFinanceBackupData = {};
	const importedUserNames: Partial<UserNames> = {};

	if (validated[STORAGE_KEYS.userAName] !== undefined) {
		imported.userAName = validated[STORAGE_KEYS.userAName];
		importedUserNames.userAName = imported.userAName;
	}
	if (validated[STORAGE_KEYS.userBName] !== undefined) {
		imported.userBName = validated[STORAGE_KEYS.userBName];
		importedUserNames.userBName = imported.userBName;
	}
	if (Object.keys(importedUserNames).length > 0) {
		await saveUserNamesStrict(importedUserNames);
	}

	if (validated[STORAGE_KEYS.profileCount] !== undefined) {
		imported.profileCount = validated[STORAGE_KEYS.profileCount];
		await saveProfileCount(imported.profileCount);
	}

	if (validated[STORAGE_KEYS.accounts] !== undefined) {
		imported.accounts = validated[STORAGE_KEYS.accounts];
		await saveStoredAccountsStrict(imported.accounts || []);
	}
	if (validated[STORAGE_KEYS.transactions] !== undefined) {
		imported.transactions = validated[STORAGE_KEYS.transactions];
		await saveStoredTransactionsStrict(imported.transactions || []);
	}
	if (validated[STORAGE_KEYS.debts] !== undefined) {
		imported.debts = validated[STORAGE_KEYS.debts];
		await saveStoredDebtsStrict(imported.debts || []);
	}
	if (validated[STORAGE_KEYS.periods] !== undefined) {
		imported.periods = validated[STORAGE_KEYS.periods];
		await saveStoredPeriodsStrict(imported.periods || []);
	} else if (imported.transactions !== undefined && imported.debts !== undefined) {
		const generatedPeriods = await readStoredPeriods(imported.transactions, imported.debts);
		imported.periods = generatedPeriods;
		await saveStoredPeriodsStrict(generatedPeriods);
	}
	if (validated[STORAGE_KEYS.geminiKey] !== undefined) {
		imported.geminiApiKey = validated[STORAGE_KEYS.geminiKey];
		await saveGeminiApiKeyStrict(imported.geminiApiKey || '');
	}
	if (validated[STORAGE_KEYS.aiChat] !== undefined) {
		imported.chatMessages = validated[STORAGE_KEYS.aiChat];
		await saveAiChatStrict(imported.chatMessages || []);
	}

	const activePeriods = imported.periods || [];
	if (activePeriods.length > 0) {
		const sortedPeriods = [...activePeriods].sort((a, b) => a.month.localeCompare(b.month));
		imported.selectedMonth = sortedPeriods[sortedPeriods.length - 1].month;
	}

	removeFinanceDomainLocalStorageKeys();
	return imported;
};
