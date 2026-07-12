import { z } from 'zod';
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
 * Helper para validar y sanitizar cadenas de texto utilizando Zod.
 */
const zString = (fieldName: string, maxLength = 200, required = true, escapeHtml = true) => {
	return z.unknown().superRefine((val, ctx) => {
		if (val === undefined || val === null) {
			if (required) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: `El campo '${fieldName}' es requerido.`
				});
			}
			return;
		}
		if (typeof val !== 'string') {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `El campo '${fieldName}' debe ser una cadena de texto.`
			});
			return;
		}
		const trimmed = val.trim();
		if (required && trimmed.length === 0) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `El campo '${fieldName}' no puede estar vacío.`
			});
			return;
		}
		if (trimmed.length > maxLength) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `El campo '${fieldName}' supera la longitud máxima permitida de ${maxLength} caracteres.`
			});
		}
	}).transform((val) => {
		if (val === undefined || val === null) {
			return '';
		}
		const trimmed = (val as string).trim();
		return escapeHtml ? sanitizeString(trimmed) : trimmed;
	});
};

/**
 * Helper para validar números utilizando Zod.
 */
const zNumber = (fieldName: string, positive = false, integer = false) => {
	return z.unknown().superRefine((val, ctx) => {
		if (val === undefined || val === null || typeof val !== 'number' || Number.isNaN(val)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `El campo '${fieldName}' debe ser un número válido.`
			});
			return;
		}
		if (!Number.isFinite(val)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `El campo '${fieldName}' debe ser un número válido.`
			});
			return;
		}
		if (positive && val < 0) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `El campo '${fieldName}' debe ser mayor o igual a 0.`
			});
		}
		if (integer && !Number.isInteger(val)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `El campo '${fieldName}' debe ser un número entero.`
			});
		}
	}).transform(val => val as number);
};

/**
 * Helper para validar valores booleanos utilizando Zod.
 */
const zBoolean = (fieldName: string) => {
	return z.unknown().superRefine((val, ctx) => {
		if (typeof val !== 'boolean') {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `El campo '${fieldName}' debe ser un valor booleano.`
			});
		}
	}).transform(val => val as boolean);
};

/**
 * Helper para parsear un esquema Zod y lanzar un error estándar con el mensaje de la primera incidencia.
 */
const parseWithZod = <T>(schema: z.Schema<T>, data: unknown): T => {
	const result = schema.safeParse(data);
	if (!result.success) {
		throw new Error(result.error.issues[0].message);
	}
	return result.data;
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

		const AccountItemSchema = z.object({
			id: zString(`${prefix}.id`, 50),
			name: zString(`${prefix}.name`, 100),
			owner: z.string().superRefine((val, ctx) => {
				if (val !== 'userA' && val !== 'userB' && val !== 'joint') {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: `El propietario de la cuenta en ${prefix}.owner debe ser 'userA', 'userB' o 'joint'.`
					});
				}
			}).transform(val => val as 'userA' | 'userB' | 'joint'),
			initialBalance: zNumber(`${prefix}.initialBalance`)
		});

		return parseWithZod(AccountItemSchema, acc) as Account;
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

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const rawTx = tx as Record<string, any>;

		const moneyObj = rawTx.money as Record<string, unknown> | undefined;
		let moneyAmountStr: string;
		let moneyCurrencyStr = 'EUR';
		if (moneyObj) {
			moneyAmountStr = String(moneyObj.amount);
			moneyCurrencyStr = String(moneyObj.currency);
		} else {
			moneyAmountStr = String(rawTx.amount ?? '0');
		}

		const parsedAmount = parseFloat(moneyAmountStr);
		const amountVal = parseWithZod(
			zNumber(`${prefix}.amount`, true),
			Number.isFinite(parsedAmount) ? parsedAmount : 0
		);

		if (moneyCurrencyStr !== 'EUR' && moneyCurrencyStr !== 'USD' && moneyCurrencyStr !== 'GBP') {
			throw new Error(`La divisa en ${prefix}.currency debe ser 'EUR', 'USD' o 'GBP'.`);
		}

		const money = {
			amount: amountVal.toFixed(2),
			currency: moneyCurrencyStr as 'EUR' | 'USD' | 'GBP'
		};

		const TransactionItemSchema = z.object({
			id: zString(`${prefix}.id`, 50),
			desc: zString(`${prefix}.desc`, 150),
			type: z.string().superRefine((val, ctx) => {
				if (val !== 'income' && val !== 'expense' && val !== 'transfer') {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: `El tipo de transacción en ${prefix}.type debe ser 'income', 'expense' o 'transfer'.`
					});
				}
			}).transform(val => val as 'income' | 'expense' | 'transfer'),
			tag: zString(`${prefix}.tag`, 50),
			date: zString(`${prefix}.date`, 10).superRefine((val, ctx) => {
				if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: `El formato de fecha en ${prefix}.date debe ser YYYY-MM-DD.`
					});
				}
			}),
			recurrence: z.string().superRefine((val, ctx) => {
				if (val !== 'recurring' && val !== 'one-off') {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: `La frecuencia de transacción en ${prefix}.recurrence debe ser 'recurring' o 'one-off'.`
					});
				}
			}).transform(val => val as 'recurring' | 'one-off'),
			owner: z.string().superRefine((val, ctx) => {
				if (val !== 'userA' && val !== 'userB' && val !== 'joint') {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: `El propietario en ${prefix}.owner debe ser 'userA', 'userB' o 'joint'.`
					});
				}
			}).transform(val => val as 'userA' | 'userB' | 'joint'),
			paidBy: z.string().superRefine((val, ctx) => {
				if (val !== 'userA' && val !== 'userB' && val !== 'shared') {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: `El campo de pago en ${prefix}.paidBy debe ser 'userA', 'userB' o 'shared'.`
					});
				}
			}).transform(val => val as 'userA' | 'userB' | 'shared'),
			accountId: zString(`${prefix}.accountId`, 50, false).optional(),
			fromAccountId: zString(`${prefix}.fromAccountId`, 50, false).optional(),
			toAccountId: zString(`${prefix}.toAccountId`, 50, false).optional()
		});

		const parsedFields = parseWithZod(TransactionItemSchema, rawTx);

		return {
			...parsedFields,
			money,
			accountId: parsedFields.accountId || undefined,
			fromAccountId: parsedFields.fromAccountId || undefined,
			toAccountId: parsedFields.toAccountId || undefined
		} as Transaction;
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

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const rawDebt = d as Record<string, any>;
		const id = parseWithZod(zString(`${prefix}.id`, 50), rawDebt.id);

		const kind = rawDebt.kind;
		if (kind !== 'classic' && kind !== 'paymentPlan') {
			throw new Error(`El tipo de deuda en ${prefix}.kind debe ser 'classic' o 'paymentPlan'.`);
		}

		const desc = parseWithZod(zString(`${prefix}.desc`, 150), rawDebt.desc);
		const tag = parseWithZod(zString(`${prefix}.tag`, 50), rawDebt.tag);

		const date = parseWithZod(
			zString(`${prefix}.date`, 7).superRefine((val, ctx) => {
				if (!/^\d{4}-\d{2}$/.test(val)) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: `El formato de fecha en ${prefix}.date debe ser YYYY-MM.`
					});
				}
			}),
			rawDebt.date
		);

		const owner = parseWithZod(
			z.string().superRefine((val, ctx) => {
				if (val !== 'userA' && val !== 'userB' && val !== 'joint') {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: `El propietario de la deuda en ${prefix}.owner debe ser 'userA', 'userB' o 'joint'.`
					});
				}
			}).transform(val => val as 'userA' | 'userB' | 'joint'),
			rawDebt.owner
		);

		const paymentAccountId =
			rawDebt.paymentAccountId !== undefined
				? parseWithZod(zString(`${prefix}.paymentAccountId`, 50, false), rawDebt.paymentAccountId)
				: undefined;

		const chargeDay =
			rawDebt.chargeDay !== undefined
				? parseWithZod(zNumber(`${prefix}.chargeDay`, true, true), rawDebt.chargeDay)
				: undefined;

		if (chargeDay !== undefined && (chargeDay < 1 || chargeDay > 31)) {
			throw new Error(`El día de cobro en ${prefix}.chargeDay debe estar entre 1 y 31.`);
		}

		const recurringMonthlyCosts =
			rawDebt.recurringMonthlyCosts !== undefined
				? parseWithZod(zNumber(`${prefix}.recurringMonthlyCosts`, true), rawDebt.recurringMonthlyCosts)
				: undefined;

		const optionalDebtBase = {
			...(paymentAccountId ? { paymentAccountId } : {}),
			...(chargeDay !== undefined ? { chargeDay } : {}),
			...(recurringMonthlyCosts !== undefined ? { recurringMonthlyCosts } : {})
		};

		if (kind === 'classic') {
			const principal = parseWithZod(zNumber(`${prefix}.principal`, true), rawDebt.principal);
			const openingCommission =
				rawDebt.openingCommission !== undefined
					? parseWithZod(zNumber(`${prefix}.openingCommission`, true), rawDebt.openingCommission)
					: undefined;
			const tin =
				rawDebt.tin !== undefined
					? parseWithZod(zNumber(`${prefix}.tin`, true), rawDebt.tin)
					: undefined;
			const tae = parseWithZod(zNumber(`${prefix}.tae`, true), rawDebt.tae);
			const termMonths = parseWithZod(zNumber(`${prefix}.termMonths`, true, true), rawDebt.termMonths);

			return {
				id,
				kind: 'classic',
				desc,
				tag,
				date,
				owner,
				...optionalDebtBase,
				principal,
				...(openingCommission !== undefined ? { openingCommission } : {}),
				...(tin !== undefined ? { tin } : {}),
				tae,
				termMonths
			} as Debt;
		} else {
			const financedAmount = parseWithZod(zNumber(`${prefix}.financedAmount`, true), rawDebt.financedAmount);
			const fees = parseWithZod(zNumber(`${prefix}.fees`, true), rawDebt.fees);
			const totalToPay = parseWithZod(zNumber(`${prefix}.totalToPay`, true), rawDebt.totalToPay);

			if (!Array.isArray(rawDebt.installments)) {
				throw new Error(
					`La deuda de fraccionamiento en ${prefix}.installments debe contener un array de cuotas.`
				);
			}

			const installments = rawDebt.installments.map((inst, instIdx) => {
				const instPrefix = `${prefix}.installments[${instIdx}]`;
				if (typeof inst !== 'object' || inst === null) {
					throw new Error(`La cuota en la posición ${instIdx} de la deuda ${id} es inválida.`);
				}

				const rawInst = inst as Record<string, unknown>;

				const InstallmentSchema = z.object({
					id: zString(`${instPrefix}.id`, 80),
					dueMonth: zString(`${instPrefix}.dueMonth`, 7).superRefine((val, ctx) => {
						if (!/^\d{4}-\d{2}$/.test(val)) {
							ctx.addIssue({
								code: z.ZodIssueCode.custom,
								message: `El formato de cuota en ${instPrefix}.dueMonth debe ser YYYY-MM.`
							});
						}
					}),
					amount: zNumber(`${instPrefix}.amount`, true),
					status: z.string().superRefine((val, ctx) => {
						if (val !== 'paid' && val !== 'pending') {
							ctx.addIssue({
								code: z.ZodIssueCode.custom,
								message: `El estado de cuota en ${instPrefix}.status debe ser 'paid' o 'pending'.`
							});
						}
					}).transform(val => val as 'paid' | 'pending'),
					label: zString(`${instPrefix}.label`, 100)
				});

				return parseWithZod(InstallmentSchema, rawInst);
			});

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
			} as Debt;
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

		const PeriodItemSchema = z.object({
			month: zString(`${prefix}.month`, 7).superRefine((val, ctx) => {
				if (!/^\d{4}-\d{2}$/.test(val)) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: `El formato de mes en ${prefix}.month debe ser YYYY-MM.`
					});
				}
			}),
			openingBalance: zNumber(`${prefix}.openingBalance`),
			openingBalanceA: zNumber(`${prefix}.openingBalanceA`),
			openingBalanceB: zNumber(`${prefix}.openingBalanceB`),
			isManualInit: z.preprocess(
				(val) => (val === undefined ? undefined : val),
				zBoolean(`${prefix}.isManualInit`).optional()
			)
		});

		const parsed = parseWithZod(PeriodItemSchema, rawPeriod);

		return {
			month: parsed.month,
			openingBalance: parsed.openingBalance,
			openingBalanceA: parsed.openingBalanceA,
			openingBalanceB: parsed.openingBalanceB,
			isManualInit: parsed.isManualInit
		} as Period;
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

		const ChatMessageItemSchema = z.object({
			role: z.string().superRefine((val, ctx) => {
				if (val !== 'user' && val !== 'model') {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: `El rol del mensaje en ${prefix}.role debe ser 'user' o 'model'.`
					});
				}
			}).transform(val => val as 'user' | 'model'),
			content: zString(`${prefix}.content`, 10000, true, false),
			timestamp: zString(`${prefix}.timestamp`, 30)
		});

		return parseWithZod(ChatMessageItemSchema, rawMsg) as ChatMessage;
	});
};

const tryParseJSONField = (fieldValue: unknown, fieldName: string): unknown => {
	if (typeof fieldValue === 'string') {
		try {
			return JSON.parse(fieldValue);
		} catch {
			throw new Error(`El campo '${fieldName}' contiene un formato JSON inválido o corrupto.`);
		}
	}
	return fieldValue;
};

/**
 * Valida de forma estricta todo el contenido de una copia de seguridad JSON.
 * Si es válido, devuelve el objeto sanitizado listo para ser guardado.
 */
export const validateAndSanitizeBackup = (parsedJson: unknown): Record<string, unknown> => {
	if (typeof parsedJson !== 'object' || parsedJson === null) {
		throw new Error('La estructura de la copia de seguridad no es un objeto JSON válido.');
	}

	const rawRecord = parsedJson as Record<string, unknown>;
	const validatedBackup: Record<string, unknown> = {};

	// 1. Nombres de usuarios (Opcionales, pero validados si existen)
	if (STORAGE_KEYS.userAName in rawRecord && rawRecord[STORAGE_KEYS.userAName] !== null) {
		validatedBackup[STORAGE_KEYS.userAName] = parseWithZod(
			zString('userAName', 50),
			rawRecord[STORAGE_KEYS.userAName]
		);
	}
	if (STORAGE_KEYS.userBName in rawRecord && rawRecord[STORAGE_KEYS.userBName] !== null) {
		validatedBackup[STORAGE_KEYS.userBName] = parseWithZod(
			zString('userBName', 50),
			rawRecord[STORAGE_KEYS.userBName]
		);
	}

	// 1b. Número de perfiles (Opcional, pero validado si existe)
	if (STORAGE_KEYS.profileCount in rawRecord && rawRecord[STORAGE_KEYS.profileCount] !== null) {
		const count = parseInt(String(rawRecord[STORAGE_KEYS.profileCount]), 10);
		validatedBackup[STORAGE_KEYS.profileCount] = count === 1 || count === 2 ? count : 2;
	}

	// 2. Gemini API Key (Opcional, pero validada si existe)
	if (STORAGE_KEYS.geminiKey in rawRecord && rawRecord[STORAGE_KEYS.geminiKey] !== null) {
		const rawKey = rawRecord[STORAGE_KEYS.geminiKey];
		if (rawKey && typeof rawKey === 'string' && rawKey.trim()) {
			validatedBackup[STORAGE_KEYS.geminiKey] = parseWithZod(
				zString('geminiKey', 150, false),
				rawKey
			);
		} else {
			validatedBackup[STORAGE_KEYS.geminiKey] = '';
		}
	}

	// 3. Cuentas (Obligatorias o opcionales. Validamos si la clave está presente)
	if (STORAGE_KEYS.accounts in rawRecord) {
		const rawAccounts = tryParseJSONField(rawRecord[STORAGE_KEYS.accounts], 'cuentas');
		validatedBackup[STORAGE_KEYS.accounts] = validateAccounts(rawAccounts);
	}

	// 4. Transacciones
	if (STORAGE_KEYS.transactions in rawRecord) {
		const rawTx = tryParseJSONField(rawRecord[STORAGE_KEYS.transactions], 'transacciones');
		validatedBackup[STORAGE_KEYS.transactions] = validateTransactions(rawTx);
	}

	// 5. Deudas
	if (STORAGE_KEYS.debts in rawRecord) {
		const rawDebts = tryParseJSONField(rawRecord[STORAGE_KEYS.debts], 'deudas');
		validatedBackup[STORAGE_KEYS.debts] = validateDebts(rawDebts);
	}

	// 6. Periodos
	if (STORAGE_KEYS.periods in rawRecord) {
		const rawPeriods = tryParseJSONField(rawRecord[STORAGE_KEYS.periods], 'periodos');
		validatedBackup[STORAGE_KEYS.periods] = validatePeriods(rawPeriods);
	}

	// 7. Chat IA
	if (STORAGE_KEYS.aiChat in rawRecord) {
		const rawChat = tryParseJSONField(rawRecord[STORAGE_KEYS.aiChat], 'chat');
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
