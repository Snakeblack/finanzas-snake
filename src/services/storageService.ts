import { STORAGE_KEYS, DEFAULT_TAGS } from '../constants';
import type { Transaction, Debt, Period, Account, ChatMessage, TransactionType, PaymentPlanInstallment } from '../types';
import { toNumber, decodeHtmlEntities } from '../utils/formatters';
import { normalizeMonth, addMonthsToMonth } from '../utils/dateUtils';
import { encryptWithKey, decryptWithKey } from './cryptoService';

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
const encryptData = async (data: any): Promise<string> => {
	if (!activeCryptoKey) {
		throw new Error('La base de datos está bloqueada. No hay clave criptográfica activa.');
	}
	const jsonString = JSON.stringify(data);
	return encryptWithKey(jsonString, activeCryptoKey);
};

/**
 * Descifra una cadena cifrada y retorna el objeto parsed correspondiente.
 */
const decryptData = async (ciphertext: string): Promise<any> => {
	if (!activeCryptoKey) {
		throw new Error('La base de datos está bloqueada. No hay clave criptográfica activa.');
	}
	const decryptedText = await decryptWithKey(ciphertext, activeCryptoKey);
	return JSON.parse(decryptedText);
};

/**
 * Realiza la limpieza inicial de las claves obsoletas de la base de datos v2 si es necesario.
 */
export const cleanLegacyData = (): void => {
	if (typeof window !== 'undefined' && !localStorage.getItem(STORAGE_KEYS.clearedV2)) {
		localStorage.removeItem(STORAGE_KEYS.transactions);
		localStorage.removeItem(STORAGE_KEYS.debts);
		localStorage.removeItem(STORAGE_KEYS.periods);
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
export const migrateTransaction = (rawTransaction: any, index: number): Transaction => {
	const type: TransactionType = 
		rawTransaction?.type === 'income' ? 'income' : 
		rawTransaction?.type === 'transfer' ? 'transfer' : 'expense';
	return {
		id: String(rawTransaction?.id ?? `tx-${index + 1}`),
		desc: String(rawTransaction?.desc ?? 'Movimiento sin nombre'),
		amount: Math.abs(toNumber(rawTransaction?.amount)),
		type,
		tag: String(rawTransaction?.tag ?? (type === 'transfer' ? DEFAULT_TAGS.transfer[0] : (type === 'income' ? DEFAULT_TAGS.income[0] : DEFAULT_TAGS.expense[0]))),
		date: String(rawTransaction?.date ?? new Date().toISOString().substring(0, 10)).substring(0, 10),
		recurrence: rawTransaction?.recurrence === 'recurring' ? 'recurring' : 'one-off',
		originId: rawTransaction?.originId ? String(rawTransaction.originId) : undefined,
		owner: rawTransaction?.owner === 'userA' || rawTransaction?.owner === 'userB' || rawTransaction?.owner === 'joint' ? rawTransaction.owner : 'joint',
		paidBy: rawTransaction?.paidBy === 'userA' || rawTransaction?.paidBy === 'userB' || rawTransaction?.paidBy === 'shared' ? rawTransaction.paidBy : 'shared',
		accountId: rawTransaction?.accountId ? String(rawTransaction.accountId) : undefined,
		fromAccountId: rawTransaction?.fromAccountId ? String(rawTransaction.fromAccountId) : undefined,
		toAccountId: rawTransaction?.toAccountId ? String(rawTransaction.toAccountId) : undefined
	};
};

/**
 * Migra una estructura de deuda sin tipar a un objeto de tipo Debt (clásica o plan de pagos) válido de la v3.
 */
export const migrateDebt = (rawDebt: any): Debt => {
	const id = String(rawDebt?.id ?? Date.now());
	const desc = String(rawDebt?.desc ?? 'Deuda sin nombre');
	const tag = String(rawDebt?.tag ?? DEFAULT_TAGS.debt[0]);
	const date = normalizeMonth(rawDebt?.date);
	const owner = rawDebt?.owner === 'userA' || rawDebt?.owner === 'userB' || rawDebt?.owner === 'joint' ? rawDebt.owner : 'joint';
	const paymentAccountId = rawDebt?.paymentAccountId ? String(rawDebt.paymentAccountId) : undefined;

	if (rawDebt?.kind === 'paymentPlan') {
		const installments: PaymentPlanInstallment[] = Array.isArray(rawDebt.installments)
			? rawDebt.installments.map((installment: any, index: number) => ({
					id: String(installment?.id ?? `${id}-installment-${index + 1}`),
					dueMonth: normalizeMonth(installment?.dueMonth),
					amount: Math.abs(toNumber(installment?.amount)),
					status: installment?.status === 'paid' ? 'paid' : 'pending',
					label: String(installment?.label ?? `Cuota ${index + 1}`)
				}))
			: [];
		const financedAmount = Math.abs(toNumber(rawDebt.financedAmount));
		const fees = Math.abs(toNumber(rawDebt.fees));
		const totalToPay = Math.abs(toNumber(rawDebt.totalToPay)) || financedAmount + fees;
		return {
			id,
			kind: 'paymentPlan',
			desc,
			tag,
			date,
			owner,
			paymentAccountId,
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
		paymentAccountId,
		principal: Math.abs(toNumber(rawDebt?.principal)),
		tin: rawDebt?.tin === undefined ? undefined : Math.abs(toNumber(rawDebt.tin)),
		tae: Math.abs(toNumber(rawDebt?.tae)),
		termMonths: Math.max(1, Math.trunc(toNumber(rawDebt?.termMonths)))
	};
};

/**
 * Lee las transacciones desde LocalStorage migrándolas si es necesario.
 */
export const readStoredTransactions = async (): Promise<Transaction[]> => {
	const rawArray = await readStoredArray(STORAGE_KEYS.transactions, 'finanzas_v2_transactions');
	return rawArray.map(migrateTransaction);
};

/**
 * Guarda las transacciones en LocalStorage.
 */
export const saveStoredTransactions = async (transactions: Transaction[]): Promise<void> => {
	if (activeCryptoKey) {
		const encrypted = await encryptData(transactions);
		localStorage.setItem(STORAGE_KEYS.transactions, encrypted);
	} else {
		localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
	}
};

/**
 * Lee las deudas desde LocalStorage migrándolas si es necesario.
 */
export const readStoredDebts = async (): Promise<Debt[]> => {
	const rawArray = await readStoredArray(STORAGE_KEYS.debts, 'finanzas_v2_debts');
	return rawArray.map(migrateDebt);
};

/**
 * Lee deudas sincrónicamente (solo para inicializadores de estado cuando no está cifrado).
 */
export const readStoredDebtsSync = (): Debt[] => {
	if (typeof window !== 'undefined' && localStorage.getItem('finanzas_v3_password_salt')) {
		return [];
	}
	const stored = localStorage.getItem(STORAGE_KEYS.debts) || localStorage.getItem('finanzas_v2_debts');
	if (!stored) return [];
	try {
		const parsed = JSON.parse(stored);
		return Array.isArray(parsed) ? parsed.map(migrateDebt) : [];
	} catch {
		return [];
	}
};

/**
 * Guarda las deudas en LocalStorage.
 */
export const saveStoredDebts = async (debts: Debt[]): Promise<void> => {
	if (activeCryptoKey) {
		const encrypted = await encryptData(debts);
		localStorage.setItem(STORAGE_KEYS.debts, encrypted);
	} else {
		localStorage.setItem(STORAGE_KEYS.debts, JSON.stringify(debts));
	}
};

/**
 * Lee los periodos de balance mensual desde LocalStorage o los autogenera si no existen.
 */
export const readStoredPeriods = async (existingTx: Transaction[], existingDebts: Debt[]): Promise<Period[]> => {
	try {
		const stored = localStorage.getItem(STORAGE_KEYS.periods);
		if (stored) {
			let parsed: any = null;
			if (stored.startsWith('[') || stored.startsWith('{')) {
				parsed = JSON.parse(stored);
			} else if (activeCryptoKey) {
				parsed = await decryptData(stored);
			}

			if (Array.isArray(parsed) && parsed.length > 0) {
				return parsed.map((rawPeriod: any) => {
					const openingBalance = toNumber(rawPeriod?.openingBalance);
					return {
						month: normalizeMonth(rawPeriod?.month),
						openingBalance,
						openingBalanceA: rawPeriod?.openingBalanceA !== undefined ? toNumber(rawPeriod.openingBalanceA) : openingBalance / 2,
						openingBalanceB: rawPeriod?.openingBalanceB !== undefined ? toNumber(rawPeriod.openingBalanceB) : openingBalance / 2,
						isManualInit: !!rawPeriod?.isManualInit
					};
				});
			}
		}
	} catch {}

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
	const endMonth = sortedMonths[sortedMonths.length - 1] > currentMonth ? sortedMonths[sortedMonths.length - 1] : currentMonth;

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
 * Guarda los periodos en LocalStorage.
 */
export const saveStoredPeriods = async (periods: Period[]): Promise<void> => {
	if (activeCryptoKey) {
		const encrypted = await encryptData(periods);
		localStorage.setItem(STORAGE_KEYS.periods, encrypted);
	} else {
		localStorage.setItem(STORAGE_KEYS.periods, JSON.stringify(periods));
	}
};

/**
 * Inicializa y obtiene los datos almacenados de cuentas, transacciones y períodos contables de forma síncrona.
 * Retorna arrays vacíos si la base de datos está bloqueada (con PIN/contraseña configurado),
 * delegando la carga asíncrona al momento en que el usuario introduzca su PIN.
 */
export const getInitialData = (): {
	accounts: Account[];
	transactions: Transaction[];
	periods: Period[];
} => {
	if (typeof window !== 'undefined' && localStorage.getItem('finanzas_v3_password_salt')) {
		// La base de datos está bloqueada por PIN/Contraseña.
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
					return parsed.map((rawPeriod: any) => {
						const openingBalance = toNumber(rawPeriod?.openingBalance);
						return {
							month: normalizeMonth(rawPeriod?.month),
							openingBalance,
							openingBalanceA: rawPeriod?.openingBalanceA !== undefined ? toNumber(rawPeriod.openingBalanceA) : openingBalance / 2,
							openingBalanceB: rawPeriod?.openingBalanceB !== undefined ? toNumber(rawPeriod.openingBalanceB) : openingBalance / 2,
							isManualInit: !!rawPeriod?.isManualInit
						};
					});
				}
			}
		} catch {}

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
		const endMonth = sortedMonths[sortedMonths.length - 1] > currentMonth ? sortedMonths[sortedMonths.length - 1] : currentMonth;

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
		} catch {}
	}

	const userAName = (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEYS.userAName)) || 'Usuario A';
	const userBName = (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEYS.userBName)) || 'Usuario B';

	const sortedPeriods = [...rawPeriods].sort((a, b) => a.month.localeCompare(b.month));
	const firstPeriod = sortedPeriods.length > 0 ? sortedPeriods[0] : null;
	const initialBalA = firstPeriod ? (firstPeriod.openingBalanceA !== undefined ? firstPeriod.openingBalanceA : firstPeriod.openingBalance / 2) : 0;
	const initialBalB = firstPeriod ? (firstPeriod.openingBalanceB !== undefined ? firstPeriod.openingBalanceB : firstPeriod.openingBalance / 2) : 0;

	const migratedAccounts: Account[] = [
		{ id: 'default-a', name: `Efectivo ${userAName}`, owner: 'userA', initialBalance: initialBalA },
		{ id: 'default-b', name: `Efectivo ${userBName}`, owner: 'userB', initialBalance: initialBalB },
		{ id: 'default-joint', name: 'Cuenta Común', owner: 'joint', initialBalance: 0 }
	];

	const migratedTransactions = rawTransactions.map(t => {
		if (!t.accountId && t.type !== 'transfer') {
			if (t.owner === 'userA') return { ...t, accountId: 'default-a' };
			if (t.owner === 'userB') return { ...t, accountId: 'default-b' };
			return { ...t, accountId: 'default-joint' };
		}
		return t;
	});

	if (typeof window !== 'undefined') {
		localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(migratedAccounts));
		localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(migratedTransactions));
	}

	return {
		accounts: migratedAccounts,
		transactions: migratedTransactions,
		periods: rawPeriods
	};
};

/**
 * Lee las cuentas desde LocalStorage.
 */
export const readStoredAccounts = async (): Promise<Account[]> => {
	const rawArray = await readStoredArray(STORAGE_KEYS.accounts);
	return rawArray as Account[];
};

/**
 * Guarda las cuentas en LocalStorage.
 */
export const saveStoredAccounts = async (accounts: Account[]): Promise<void> => {
	if (activeCryptoKey) {
		const encrypted = await encryptData(accounts);
		localStorage.setItem(STORAGE_KEYS.accounts, encrypted);
	} else {
		localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(accounts));
	}
};

/**
 * Lee la clave API de Gemini desde LocalStorage.
 */
export const readGeminiApiKey = async (): Promise<string> => {
	const stored = localStorage.getItem(STORAGE_KEYS.geminiKey);
	if (!stored) return '';
	try {
		if (stored.startsWith('{') || stored.startsWith('[') || stored.length < 50) {
			// No cifrada o muy corta para ser cifrado AES-GCM hex
			return stored;
		}
		if (activeCryptoKey) {
			return await decryptWithKey(stored, activeCryptoKey);
		}
		return '';
	} catch {
		return stored; // Fallback a plano por si acaso
	}
};

/**
 * Lee la clave API de Gemini de forma sincrónica (solo para inicializadores de estado).
 */
export const readGeminiApiKeySync = (): string => {
	if (typeof window !== 'undefined' && localStorage.getItem('finanzas_v3_password_salt')) {
		return '';
	}
	return localStorage.getItem(STORAGE_KEYS.geminiKey) || '';
};

/**
 * Guarda la clave API de Gemini en LocalStorage.
 */
export const saveGeminiApiKey = async (key: string): Promise<void> => {
	if (activeCryptoKey && key.trim()) {
		const encrypted = await encryptWithKey(key, activeCryptoKey);
		localStorage.setItem(STORAGE_KEYS.geminiKey, encrypted);
	} else {
		localStorage.setItem(STORAGE_KEYS.geminiKey, key);
	}
};

/**
 * Lee el historial del chat desde LocalStorage.
 */
export const readAiChat = async (): Promise<ChatMessage[]> => {
	const rawArray = await readStoredArray(STORAGE_KEYS.aiChat);
	return (rawArray as ChatMessage[]).map((msg) => ({
		...msg,
		content: decodeHtmlEntities(msg.content || '')
	}));
};

/**
 * Lee el chat de forma sincrónica (solo para inicializadores de estado).
 */
export const readAiChatSync = (): ChatMessage[] => {
	if (typeof window !== 'undefined' && localStorage.getItem('finanzas_v3_password_salt')) {
		return [];
	}
	const stored = localStorage.getItem(STORAGE_KEYS.aiChat);
	if (!stored) return [];
	try {
		const parsed = JSON.parse(stored);
		return Array.isArray(parsed)
			? parsed.map((msg: any) => ({
					...msg,
					content: decodeHtmlEntities(msg.content || '')
				}))
			: [];
	} catch {
		return [];
	}
};

/**
 * Guarda el historial del chat en LocalStorage.
 */
export const saveAiChat = async (chat: ChatMessage[]): Promise<void> => {
	if (activeCryptoKey) {
		const encrypted = await encryptData(chat);
		localStorage.setItem(STORAGE_KEYS.aiChat, encrypted);
	} else {
		localStorage.setItem(STORAGE_KEYS.aiChat, JSON.stringify(chat));
	}
};
