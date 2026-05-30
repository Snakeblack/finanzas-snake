import { STORAGE_KEYS } from '../constants';
import type { Account, Transaction, Debt, Period, ChatMessage } from '../types';

/**
 * Escapa los caracteres HTML básicos de una cadena para mitigar XSS.
 */
export const sanitizeString = (str: string): string => {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
};

/**
 * Valida un campo de texto simple y lo sanitiza.
 */
const validateAndSanitizeText = (val: unknown, fieldName: string, maxLength = 200, required = true): string => {
	if (val === undefined || val === null) {
		if (required) {
			throw new Error(`El campo '${fieldName}' es requerido.`);
		}
		return '';
	}
	if (typeof val !== 'string') {
		throw new Error(`El campo '${fieldName}' debe ser una cadena de texto.`);
	}
	const trimmed = val.trim();
	if (required && trimmed.length === 0) {
		throw new Error(`El campo '${fieldName}' no puede estar vacío.`);
	}
	if (trimmed.length > maxLength) {
		throw new Error(`El campo '${fieldName}' supera la longitud máxima permitida de ${maxLength} caracteres.`);
	}
	return sanitizeString(trimmed);
};

/**
 * Valida un número.
 */
const validateNumber = (val: unknown, fieldName: string, positive = false, integer = false): number => {
	if (val === undefined || val === null || typeof val !== 'number' || Number.isNaN(val)) {
		throw new Error(`El campo '${fieldName}' debe ser un número válido.`);
	}
	if (positive && val < 0) {
		throw new Error(`El campo '${fieldName}' debe ser mayor o igual a 0.`);
	}
	if (integer && !Number.isInteger(val)) {
		throw new Error(`El campo '${fieldName}' debe ser un número entero.`);
	}
	return val;
};

/**
 * Valida un valor booleano.
 */
const validateBoolean = (val: unknown, fieldName: string): boolean => {
	if (typeof val !== 'boolean') {
		throw new Error(`El campo '${fieldName}' debe ser un valor booleano.`);
	}
	return val;
};

/**
 * Valida y sanitiza una lista de cuentas.
 */
const validateAccounts = (accounts: unknown): Account[] => {
	if (!Array.isArray(accounts)) {
		throw new Error("El campo de cuentas ('accounts') debe ser un array.");
	}

	return accounts.map((acc, index) => {
		const prefix = `accounts[${index}]`;
		if (typeof acc !== 'object' || acc === null) {
			throw new Error(`La cuenta en la posición ${index} es inválida.`);
		}

		const rawAcc = acc as Record<string, unknown>;
		const id = validateAndSanitizeText(rawAcc.id, `${prefix}.id`, 50);
		const name = validateAndSanitizeText(rawAcc.name, `${prefix}.name`, 100);
		
		const owner = rawAcc.owner;
		if (owner !== 'userA' && owner !== 'userB' && owner !== 'joint') {
			throw new Error(`El propietario de la cuenta en ${prefix}.owner debe ser 'userA', 'userB' o 'joint'.`);
		}

		const initialBalance = validateNumber(rawAcc.initialBalance, `${prefix}.initialBalance`);

		return { id, name, owner, initialBalance };
	});
};

/**
 * Valida y sanitiza una lista de transacciones.
 */
const validateTransactions = (transactions: unknown): Transaction[] => {
	if (!Array.isArray(transactions)) {
		throw new Error("El campo de transacciones ('transactions') debe ser un array.");
	}

	return transactions.map((tx, index) => {
		const prefix = `transactions[${index}]`;
		if (typeof tx !== 'object' || tx === null) {
			throw new Error(`La transacción en la posición ${index} es inválida.`);
		}

		const rawTx = tx as Record<string, unknown>;
		const id = validateAndSanitizeText(rawTx.id, `${prefix}.id`, 50);
		const desc = validateAndSanitizeText(rawTx.desc, `${prefix}.desc`, 150);
		const amount = validateNumber(rawTx.amount, `${prefix}.amount`, true);

		const type = rawTx.type;
		if (type !== 'income' && type !== 'expense' && type !== 'transfer') {
			throw new Error(`El tipo de transacción en ${prefix}.type debe ser 'income', 'expense' o 'transfer'.`);
		}

		const tag = validateAndSanitizeText(rawTx.tag, `${prefix}.tag`, 50);
		
		const date = validateAndSanitizeText(rawTx.date, `${prefix}.date`, 10);
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			throw new Error(`El formato de fecha en ${prefix}.date debe ser YYYY-MM-DD.`);
		}

		const recurrence = rawTx.recurrence;
		if (recurrence !== 'recurring' && recurrence !== 'one-off') {
			throw new Error(`La frecuencia de transacción en ${prefix}.recurrence debe ser 'recurring' o 'one-off'.`);
		}

		const owner = rawTx.owner;
		if (owner !== 'userA' && owner !== 'userB' && owner !== 'joint') {
			throw new Error(`El propietario en ${prefix}.owner debe ser 'userA', 'userB' o 'joint'.`);
		}

		const paidBy = rawTx.paidBy;
		if (paidBy !== 'userA' && paidBy !== 'userB' && paidBy !== 'shared') {
			throw new Error(`El campo de pago en ${prefix}.paidBy debe ser 'userA', 'userB' o 'shared'.`);
		}

		const accountId = rawTx.accountId !== undefined ? validateAndSanitizeText(rawTx.accountId, `${prefix}.accountId`, 50, false) : undefined;
		const fromAccountId = rawTx.fromAccountId !== undefined ? validateAndSanitizeText(rawTx.fromAccountId, `${prefix}.fromAccountId`, 50, false) : undefined;
		const toAccountId = rawTx.toAccountId !== undefined ? validateAndSanitizeText(rawTx.toAccountId, `${prefix}.toAccountId`, 50, false) : undefined;

		return {
			id,
			desc,
			amount,
			type,
			tag,
			date,
			recurrence,
			owner,
			paidBy,
			accountId: accountId || undefined,
			fromAccountId: fromAccountId || undefined,
			toAccountId: toAccountId || undefined
		};
	});
};

/**
 * Valida y sanitiza una lista de deudas.
 */
const validateDebts = (debts: unknown): Debt[] => {
	if (!Array.isArray(debts)) {
		throw new Error("El campo de deudas ('debts') debe ser un array.");
	}

	return debts.map((d, index) => {
		const prefix = `debts[${index}]`;
		if (typeof d !== 'object' || d === null) {
			throw new Error(`La deuda en la posición ${index} es inválida.`);
		}

		const rawDebt = d as Record<string, unknown>;
		const id = validateAndSanitizeText(rawDebt.id, `${prefix}.id`, 50);
		
		const kind = rawDebt.kind;
		if (kind !== 'classic' && kind !== 'paymentPlan') {
			throw new Error(`El tipo de deuda en ${prefix}.kind debe ser 'classic' o 'paymentPlan'.`);
		}

		const desc = validateAndSanitizeText(rawDebt.desc, `${prefix}.desc`, 150);
		const tag = validateAndSanitizeText(rawDebt.tag, `${prefix}.tag`, 50);
		
		const date = validateAndSanitizeText(rawDebt.date, `${prefix}.date`, 7);
		if (!/^\d{4}-\d{2}$/.test(date)) {
			throw new Error(`El formato de fecha en ${prefix}.date debe ser YYYY-MM.`);
		}

		const owner = rawDebt.owner;
		if (owner !== 'userA' && owner !== 'userB' && owner !== 'joint') {
			throw new Error(`El propietario de la deuda en ${prefix}.owner debe ser 'userA', 'userB' o 'joint'.`);
		}

		const paymentAccountId = rawDebt.paymentAccountId !== undefined ? validateAndSanitizeText(rawDebt.paymentAccountId, `${prefix}.paymentAccountId`, 50, false) : undefined;

		if (kind === 'classic') {
			const principal = validateNumber(rawDebt.principal, `${prefix}.principal`, true);
			const tin = rawDebt.tin !== undefined ? validateNumber(rawDebt.tin, `${prefix}.tin`, true) : undefined;
			const tae = validateNumber(rawDebt.tae, `${prefix}.tae`, true);
			const termMonths = validateNumber(rawDebt.termMonths, `${prefix}.termMonths`, true, true);

			return {
				id,
				kind: 'classic',
				desc,
				tag,
				date,
				owner,
				paymentAccountId: paymentAccountId || undefined,
				principal,
				tin,
				tae,
				termMonths
			};
		} else {
			const financedAmount = validateNumber(rawDebt.financedAmount, `${prefix}.financedAmount`, true);
			const fees = validateNumber(rawDebt.fees, `${prefix}.fees`, true);
			const totalToPay = validateNumber(rawDebt.totalToPay, `${prefix}.totalToPay`, true);
			
			if (!Array.isArray(rawDebt.installments)) {
				throw new Error(`La deuda de fraccionamiento en ${prefix}.installments debe contener un array de cuotas.`);
			}

			const installments = rawDebt.installments.map((inst, instIdx) => {
				const instPrefix = `${prefix}.installments[${instIdx}]`;
				if (typeof inst !== 'object' || inst === null) {
					throw new Error(`La cuota en la posición ${instIdx} de la deuda ${id} es inválida.`);
				}

				const rawInst = inst as Record<string, unknown>;
				const instId = validateAndSanitizeText(rawInst.id, `${instPrefix}.id`, 80);
				
				const dueMonth = validateAndSanitizeText(rawInst.dueMonth, `${instPrefix}.dueMonth`, 7);
				if (!/^\d{4}-\d{2}$/.test(dueMonth)) {
					throw new Error(`El formato de cuota en ${instPrefix}.dueMonth debe ser YYYY-MM.`);
				}

				const amount = validateNumber(rawInst.amount, `${instPrefix}.amount`, true);

				const status = rawInst.status;
				if (status !== 'paid' && status !== 'pending') {
					throw new Error(`El estado de cuota en ${instPrefix}.status debe ser 'paid' o 'pending'.`);
				}

				const label = validateAndSanitizeText(rawInst.label, `${instPrefix}.label`, 100);

				return {
					id: instId,
					dueMonth,
					amount,
					status,
					label
				};
			});

			return {
				id,
				kind: 'paymentPlan',
				desc,
				tag,
				date,
				owner,
				paymentAccountId: paymentAccountId || undefined,
				financedAmount,
				fees,
				totalToPay,
				installments
			};
		}
	});
};

/**
 * Valida y sanitiza una lista de períodos contables.
 */
const validatePeriods = (periods: unknown): Period[] => {
	if (!Array.isArray(periods)) {
		throw new Error("El campo de períodos ('periods') debe ser un array.");
	}

	return periods.map((p, index) => {
		const prefix = `periods[${index}]`;
		if (typeof p !== 'object' || p === null) {
			throw new Error(`El período en la posición ${index} es inválido.`);
		}

		const rawPeriod = p as Record<string, unknown>;
		
		const month = validateAndSanitizeText(rawPeriod.month, `${prefix}.month`, 7);
		if (!/^\d{4}-\d{2}$/.test(month)) {
			throw new Error(`El formato de mes en ${prefix}.month debe ser YYYY-MM.`);
		}

		const openingBalance = validateNumber(rawPeriod.openingBalance, `${prefix}.openingBalance`);
		const openingBalanceA = validateNumber(rawPeriod.openingBalanceA, `${prefix}.openingBalanceA`);
		const openingBalanceB = validateNumber(rawPeriod.openingBalanceB, `${prefix}.openingBalanceB`);
		const isManualInit = rawPeriod.isManualInit !== undefined ? validateBoolean(rawPeriod.isManualInit, `${prefix}.isManualInit`) : undefined;

		return {
			month,
			openingBalance,
			openingBalanceA,
			openingBalanceB,
			isManualInit
		};
	});
};

/**
 * Valida y sanitiza el historial de chat de IA.
 */
const validateAiChat = (chat: unknown): ChatMessage[] => {
	if (chat === undefined || chat === null) return [];
	if (!Array.isArray(chat)) {
		throw new Error("El historial de chat ('aiChat') debe ser un array.");
	}

	return chat.map((msg, index) => {
		const prefix = `aiChat[${index}]`;
		if (typeof msg !== 'object' || msg === null) {
			throw new Error(`El mensaje del chat en la posición ${index} es inválido.`);
		}

		const rawMsg = msg as Record<string, unknown>;
		
		const role = rawMsg.role;
		if (role !== 'user' && role !== 'model') {
			throw new Error(`El rol del mensaje en ${prefix}.role debe ser 'user' o 'model'.`);
		}

		const content = validateAndSanitizeText(rawMsg.content, `${prefix}.content`, 10000); // Permitimos un texto de chat más largo
		const timestamp = validateAndSanitizeText(rawMsg.timestamp, `${prefix}.timestamp`, 30);

		return {
			role,
			content,
			timestamp
		};
	});
};

/**
 * Valida de forma estricta todo el contenido de una copia de seguridad JSON.
 * Si es válido, devuelve el objeto sanitizado listo para ser guardado.
 */
export const validateAndSanitizeBackup = (parsedJson: any): Record<string, any> => {
	if (typeof parsedJson !== 'object' || parsedJson === null) {
		throw new Error('La estructura de la copia de seguridad no es un objeto JSON válido.');
	}

	const validatedBackup: Record<string, any> = {};

	// 1. Nombres de usuarios (Opcionales, pero validados si existen)
	if (STORAGE_KEYS.userAName in parsedJson && parsedJson[STORAGE_KEYS.userAName] !== null) {
		validatedBackup[STORAGE_KEYS.userAName] = validateAndSanitizeText(
			parsedJson[STORAGE_KEYS.userAName],
			'userAName',
			50
		);
	}
	if (STORAGE_KEYS.userBName in parsedJson && parsedJson[STORAGE_KEYS.userBName] !== null) {
		validatedBackup[STORAGE_KEYS.userBName] = validateAndSanitizeText(
			parsedJson[STORAGE_KEYS.userBName],
			'userBName',
			50
		);
	}

	// 2. Gemini API Key (Opcional, pero validada si existe)
	if (STORAGE_KEYS.geminiKey in parsedJson && parsedJson[STORAGE_KEYS.geminiKey] !== null) {
		const rawKey = parsedJson[STORAGE_KEYS.geminiKey];
		if (rawKey && typeof rawKey === 'string' && rawKey.trim()) {
			validatedBackup[STORAGE_KEYS.geminiKey] = validateAndSanitizeText(rawKey, 'geminiKey', 150, false);
		} else {
			validatedBackup[STORAGE_KEYS.geminiKey] = '';
		}
	}

	// 3. Cuentas (Obligatorias o opcionales. Validamos si la clave está presente)
	if (STORAGE_KEYS.accounts in parsedJson) {
		const rawAccounts = typeof parsedJson[STORAGE_KEYS.accounts] === 'string'
			? JSON.parse(parsedJson[STORAGE_KEYS.accounts])
			: parsedJson[STORAGE_KEYS.accounts];
		validatedBackup[STORAGE_KEYS.accounts] = validateAccounts(rawAccounts);
	}

	// 4. Transacciones
	if (STORAGE_KEYS.transactions in parsedJson) {
		const rawTx = typeof parsedJson[STORAGE_KEYS.transactions] === 'string'
			? JSON.parse(parsedJson[STORAGE_KEYS.transactions])
			: parsedJson[STORAGE_KEYS.transactions];
		validatedBackup[STORAGE_KEYS.transactions] = validateTransactions(rawTx);
	}

	// 5. Deudas
	if (STORAGE_KEYS.debts in parsedJson) {
		const rawDebts = typeof parsedJson[STORAGE_KEYS.debts] === 'string'
			? JSON.parse(parsedJson[STORAGE_KEYS.debts])
			: parsedJson[STORAGE_KEYS.debts];
		validatedBackup[STORAGE_KEYS.debts] = validateDebts(rawDebts);
	}

	// 6. Periodos
	if (STORAGE_KEYS.periods in parsedJson) {
		const rawPeriods = typeof parsedJson[STORAGE_KEYS.periods] === 'string'
			? JSON.parse(parsedJson[STORAGE_KEYS.periods])
			: parsedJson[STORAGE_KEYS.periods];
		validatedBackup[STORAGE_KEYS.periods] = validatePeriods(rawPeriods);
	}

	// 7. Chat IA
	if (STORAGE_KEYS.aiChat in parsedJson) {
		const rawChat = typeof parsedJson[STORAGE_KEYS.aiChat] === 'string'
			? JSON.parse(parsedJson[STORAGE_KEYS.aiChat])
			: parsedJson[STORAGE_KEYS.aiChat];
		validatedBackup[STORAGE_KEYS.aiChat] = validateAiChat(rawChat);
	}

	const hasFinancialData = 
		STORAGE_KEYS.accounts in validatedBackup ||
		STORAGE_KEYS.transactions in validatedBackup ||
		STORAGE_KEYS.debts in validatedBackup ||
		STORAGE_KEYS.periods in validatedBackup;

	if (!hasFinancialData) {
		throw new Error('El archivo no parece un backup válido o no contiene información financiera.');
	}

	return validatedBackup;
};
