import { STORAGE_KEYS, DEFAULT_TAGS } from '../constants';
import type { Transaction, Debt, Period, Account, ChatMessage, TransactionType, PaymentPlanInstallment } from '../types';
import { toNumber } from '../utils/formatters';
import { normalizeMonth, addMonthsToMonth } from '../utils/dateUtils';

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
 * Lee de forma segura un array JSON desde LocalStorage.
 * 
 * @param primaryKey Clave principal de almacenamiento
 * @param fallbackKey Clave secundaria en caso de no existir la principal
 * @returns Array deserializado o array vacío en caso de error o inexistencia
 */
const readStoredArray = (primaryKey: string, fallbackKey?: string): unknown[] => {
	const read = (key: string) => {
		try {
			const stored = localStorage.getItem(key);
			if (!stored) return null;
			const parsed = JSON.parse(stored);
			return Array.isArray(parsed) ? parsed : null;
		} catch {
			return null;
		}
	};

	return read(primaryKey) ?? (fallbackKey ? read(fallbackKey) : null) ?? [];
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
export const readStoredTransactions = (): Transaction[] => {
	return readStoredArray(STORAGE_KEYS.transactions, 'finanzas_v2_transactions').map(migrateTransaction);
};

/**
 * Guarda las transacciones en LocalStorage.
 */
export const saveStoredTransactions = (transactions: Transaction[]): void => {
	localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
};

/**
 * Lee las deudas desde LocalStorage migrándolas si es necesario.
 */
export const readStoredDebts = (): Debt[] => {
	return readStoredArray(STORAGE_KEYS.debts, 'finanzas_v2_debts').map(migrateDebt);
};

/**
 * Guarda las deudas en LocalStorage.
 */
export const saveStoredDebts = (debts: Debt[]): void => {
	localStorage.setItem(STORAGE_KEYS.debts, JSON.stringify(debts));
};

/**
 * Lee los periodos de balance mensual desde LocalStorage o los autogenera si no existen.
 */
export const readStoredPeriods = (existingTx: Transaction[], existingDebts: Debt[]): Period[] => {
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
export const saveStoredPeriods = (periods: Period[]): void => {
	localStorage.setItem(STORAGE_KEYS.periods, JSON.stringify(periods));
};

/**
 * Inicializa y obtiene los datos almacenados de cuentas, transacciones y períodos contables.
 * Realiza la migración de cuentas y transacciones si no existen cuentas previas.
 */
export const getInitialData = (): {
	accounts: Account[];
	transactions: Transaction[];
	periods: Period[];
} => {
	cleanLegacyData();
	const rawTransactions = readStoredTransactions();
	const rawDebts = readStoredDebts();
	const rawPeriods = readStoredPeriods(rawTransactions, rawDebts);

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

	// Migración si no hay cuentas existentes
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

	// Asociar las transacciones antiguas a estas nuevas cuentas por defecto
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
 * Guarda las cuentas en LocalStorage.
 */
export const saveStoredAccounts = (accounts: Account[]): void => {
	localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(accounts));
};

/**
 * Lee la clave API de Gemini desde LocalStorage.
 */
export const readGeminiApiKey = (): string => {
	return localStorage.getItem(STORAGE_KEYS.geminiKey) || '';
};

/**
 * Guarda la clave API de Gemini en LocalStorage.
 */
export const saveGeminiApiKey = (key: string): void => {
	localStorage.setItem(STORAGE_KEYS.geminiKey, key);
};

/**
 * Lee el historial del chat desde LocalStorage.
 */
export const readAiChat = (): ChatMessage[] => {
	try {
		const stored = localStorage.getItem(STORAGE_KEYS.aiChat);
		return stored ? JSON.parse(stored) : [];
	} catch {
		return [];
	}
};

/**
 * Guarda el historial del chat en LocalStorage.
 */
export const saveAiChat = (chat: ChatMessage[]): void => {
	localStorage.setItem(STORAGE_KEYS.aiChat, JSON.stringify(chat));
};
