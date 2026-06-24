import {
	Account,
	ImportedTransaction,
	ImportedTransactionPossibleDuplicate,
	Transaction,
	TransactionType
} from '../types';
import { deduceTagFromConcept } from './financeService';
import { askGemini, createGeminiApiKeyUnavailableError, isGeminiApiKeyError } from './geminiService';
import { DEFAULT_TAGS } from '../constants';

interface PrepareImportedTransactionsOptions {
	transactions: ImportedTransaction[];
	accountId: string;
	sourceName: string;
	accountOwner: 'userA' | 'userB' | 'joint';
}

interface PdfAccountContext {
	accountName?: string;
}

interface GeminiTransactionPayload {
	date?: unknown;
	desc?: unknown;
	amount?: unknown;
	type?: unknown;
	tag?: unknown;
	balance?: unknown;
	fromAccountId?: unknown;
	toAccountId?: unknown;
}

const EXTERNAL_TRANSFER_TAG = 'Transferencia externa';
const RECEIVED_TRANSFER_TERMS = ['recibida', 'recibido', 'de tercero', 'abono'];
const SENT_TRANSFER_TERMS = [
	'realizada',
	'realizado',
	'enviada',
	'enviado',
	'emitida',
	'emitido',
	'a cuenta',
	'bizum enviado'
];
const POSSIBLE_DUPLICATE_DATE_WINDOW_DAYS = 3;
const POSSIBLE_DUPLICATE_REASON = 'concepto similar, mismo importe y fecha cercana';
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const normalizeFingerprintPart = (value: string): string =>
	value
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();

const createStableHash = (value: string): string => {
	let hash = 5381;
	for (let index = 0; index < value.length; index++) {
		hash = (hash * 33) ^ value.charCodeAt(index);
	}

	return (hash >>> 0).toString(36);
};

const createImportFingerprint = (tx: ImportedTransaction, accountId: string): string => {
	const fingerprintParts = [
		tx.date,
		tx.amount,
		tx.type,
		accountId,
		normalizeFingerprintPart(tx.desc),
		normalizeFingerprintPart(tx.sourceName || '')
	];

	return `import-${createStableHash(fingerprintParts.join('|'))}`;
};

const hasAnyToken = (value: string, tokens: string[]): boolean => tokens.some((token) => value.includes(token));

const getConceptTokens = (value: string): string[] =>
	normalizeFingerprintPart(value)
		.split(' ')
		.filter((token) => token.length >= 4);

const hasSimilarConcept = (firstConcept: string, secondConcept: string): boolean => {
	const firstTokens = new Set(getConceptTokens(firstConcept));
	const secondTokens = getConceptTokens(secondConcept);
	if (firstTokens.size === 0 || secondTokens.length === 0) {
		return false;
	}

	return secondTokens.filter((token) => firstTokens.has(token)).length >= 1;
};

const getDateDistanceDays = (firstDate: string, secondDate: string): number | undefined => {
	const firstTime = Date.parse(`${firstDate}T00:00:00Z`);
	const secondTime = Date.parse(`${secondDate}T00:00:00Z`);
	if (Number.isNaN(firstTime) || Number.isNaN(secondTime)) {
		return undefined;
	}

	return Math.abs(Math.round((firstTime - secondTime) / MILLISECONDS_PER_DAY));
};

const hasTransferEvidence = (tx: ImportedTransaction): boolean => {
	if (tx.type === 'transfer') {
		return true;
	}

	const searchableText = normalizeFingerprintPart(`${tx.desc} ${tx.tag}`);
	const hasStrongTransferTerm = hasAnyToken(searchableText, [
		'transferencia',
		'transfer',
		'traspaso',
		'cbu',
		'cvu',
		'sepa',
		'iban'
	]);
	const hasDirectionalTerm = hasAnyToken(searchableText, ['envio', 'enviado', 'enviada', 'recibido', 'recibida']);
	const hasAccountTerm = hasAnyToken(searchableText, ['cuenta', 'account']);

	return hasStrongTransferTerm || (hasDirectionalTerm && hasAccountTerm);
};

const isBankTransferLike = hasTransferEvidence;

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

// Gemini puede devolver importes/saldos como número JSON (sin comillas) pese al prompt.
// asString los descartaría a '' (importándolos como 0,00); aquí los preservamos como string.
const asNumericString = (value: unknown): string =>
	typeof value === 'number' && Number.isFinite(value) ? String(value) : asString(value);

const hasConfirmedInternalTransferEndpoints = (
	tx: Pick<ImportedTransaction, 'fromAccountId' | 'toAccountId'>
): boolean => Boolean(tx.fromAccountId && tx.toAccountId);

const classifyUnconfirmedTransfer = (desc: string, amountType: TransactionType): TransactionType => {
	const searchableText = normalizeFingerprintPart(desc);

	if (hasAnyToken(searchableText, RECEIVED_TRANSFER_TERMS)) {
		return 'income';
	}

	if (hasAnyToken(searchableText, SENT_TRANSFER_TERMS)) {
		return 'expense';
	}

	return amountType === 'transfer' ? 'expense' : amountType;
};

const parseGeminiTransactionType = (rawType: string, amountType: TransactionType): TransactionType => {
	if (rawType === 'income' || rawType === 'expense' || rawType === 'transfer') {
		return rawType;
	}

	return amountType;
};

const getFallbackTag = (type: TransactionType): string => {
	if (type === 'income') {
		return 'Otros Ingresos';
	}

	if (type === 'transfer') {
		return 'Otros Traspasos';
	}

	return 'Otros Gastos';
};

const normalizeUnconfirmedTransfer = (tx: ImportedTransaction): ImportedTransaction => {
	if (tx.type !== 'transfer' || hasConfirmedInternalTransferEndpoints(tx)) {
		return tx;
	}

	return {
		...tx,
		type: classifyUnconfirmedTransfer(tx.desc, tx.originalType || tx.type),
		tag: EXTERNAL_TRANSFER_TAG,
		transferCorrelationId: undefined,
		fromAccountId: undefined,
		toAccountId: undefined
	};
};

const createImportedTransactionFromGemini = (
	payload: GeminiTransactionPayload,
	index: number,
	idPrefix: string
): ImportedTransaction => {
	const desc = asString(payload.desc) || 'Transacción sin concepto';
	const normalizedAmount = normalizeAmount(asNumericString(payload.amount) || '0');
	const fromAccountId = asString(payload.fromAccountId) || undefined;
	const toAccountId = asString(payload.toAccountId) || undefined;
	const parsedType = parseGeminiTransactionType(asString(payload.type), normalizedAmount.type);
	const normalizedType =
		parsedType === 'transfer' && !(fromAccountId && toAccountId)
			? classifyUnconfirmedTransfer(desc, normalizedAmount.type)
			: parsedType;
	const isExternalTransfer = parsedType === 'transfer' && normalizedType !== 'transfer';
	const allowedTags = DEFAULT_TAGS[normalizedType] as readonly string[];
	const rawTag = asString(payload.tag);
	const tag = isExternalTransfer
		? EXTERNAL_TRANSFER_TAG
		: allowedTags.includes(rawTag)
			? rawTag
			: getFallbackTag(normalizedType);
	const balance = normalizeBalance(asNumericString(payload.balance));

	return {
		id: `${idPrefix}-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
		date: normalizeDate(asString(payload.date)),
		desc,
		amount: normalizedAmount.amount,
		type: normalizedType,
		tag,
		selected: true,
		isDuplicate: false,
		owner: 'joint',
		paidBy: 'shared',
		originalType: parsedType,
		fromAccountId: normalizedType === 'transfer' ? fromAccountId : undefined,
		toAccountId: normalizedType === 'transfer' ? toAccountId : undefined,
		balance
	};
};

const getTransferCorrelationId = (expense: ImportedTransaction, income: ImportedTransaction): string => {
	const parts = [
		expense.date,
		expense.amount,
		expense.accountId || '',
		income.accountId || '',
		expense.importFingerprint || expense.id,
		income.importFingerprint || income.id
	];
	return `transfer-${createStableHash(parts.join('|'))}`;
};

/**
 * Normaliza un importe en formato string a un valor numérico decimal absoluto (string)
 * y deduce su tipo (expense/income) según si es negativo o positivo.
 */
export function normalizeAmount(val: string): { amount: string; type: TransactionType } {
	let clean = val.replace(/[€$\s]/g, '').trim();
	const isNegative = clean.startsWith('-');
	clean = clean.replace(/-|\+/g, '');

	if (clean.includes(',') && clean.includes('.')) {
		const commaIndex = clean.indexOf(',');
		const dotIndex = clean.indexOf('.');
		if (commaIndex > dotIndex) {
			// Formato europeo: 1.234,56
			clean = clean.replace(/\./g, '').replace(',', '.');
		} else {
			// Formato americano: 1,234.56
			clean = clean.replace(/,/g, '');
		}
	} else if (clean.includes(',')) {
		// Formato decimal con coma: 45,20
		clean = clean.replace(',', '.');
	}

	const num = parseFloat(clean);
	if (isNaN(num)) {
		return { amount: '0.00', type: 'expense' };
	}

	return {
		amount: num.toFixed(2),
		type: isNegative ? 'expense' : 'income'
	};
}

/**
 * Normaliza un saldo de cuenta en formato string a un valor numérico decimal (string),
 * preservando el signo negativo en caso de saldos deudores (sobregiros).
 */
export function normalizeBalance(val: string): string | undefined {
	if (!val) return undefined;
	let clean = val.replace(/[€$\s]/g, '').trim();
	const isNegative = clean.startsWith('-');
	clean = clean.replace(/-|\+/g, '');

	if (clean.includes(',') && clean.includes('.')) {
		const commaIndex = clean.indexOf(',');
		const dotIndex = clean.indexOf('.');
		if (commaIndex > dotIndex) {
			clean = clean.replace(/\./g, '').replace(',', '.');
		} else {
			clean = clean.replace(/,/g, '');
		}
	} else if (clean.includes(',')) {
		clean = clean.replace(',', '.');
	}

	const num = parseFloat(clean);
	if (isNaN(num)) {
		return undefined;
	}

	return (isNegative ? -num : num).toFixed(2);
}

/**
 * Normaliza fechas en formatos DD/MM/YYYY o YYYY-MM-DD al estándar YYYY-MM-DD.
 */
export function normalizeDate(val: string): string {
	const clean = val.trim();
	const dmyMatch = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
	if (dmyMatch) {
		const [_, d, m, y] = dmyMatch;
		return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
	}
	const ymdMatch = clean.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
	if (ymdMatch) {
		const [_, y, m, d] = ymdMatch;
		return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
	}
	return new Date().toISOString().substring(0, 10);
}

/**
 * Detecta el separador de columnas del CSV basándose en la primera línea.
 */
export function detectSeparator(text: string): string {
	const firstLine = text.split(/\r?\n/)[0] || '';
	const semicolons = (firstLine.match(/;/g) || []).length;
	const commas = (firstLine.match(/,/g) || []).length;
	const tabs = (firstLine.match(/\t/g) || []).length;

	if (semicolons > commas && semicolons > tabs) return ';';
	if (tabs > semicolons && tabs > commas) return '\t';
	return ',';
}

/**
 * Parsea un texto CSV teniendo en cuenta comillas dobles y saltos de línea dentro de campos.
 */
export function parseCSV(text: string, separator: string = ';'): string[][] {
	const lines: string[][] = [];
	let currentRow: string[] = [];
	let currentField = '';
	let insideQuotes = false;

	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		const nextChar = text[i + 1];

		if (insideQuotes) {
			if (char === '"') {
				if (nextChar === '"') {
					currentField += '"';
					i++;
				} else {
					insideQuotes = false;
				}
			} else {
				currentField += char;
			}
		} else {
			if (char === '"') {
				insideQuotes = true;
			} else if (char === separator) {
				currentRow.push(currentField.trim());
				currentField = '';
			} else if (char === '\r' || char === '\n') {
				currentRow.push(currentField.trim());
				if (currentRow.some((field) => field !== '')) {
					lines.push(currentRow);
				}
				currentRow = [];
				currentField = '';
				if (char === '\r' && nextChar === '\n') {
					i++;
				}
			} else {
				currentField += char;
			}
		}
	}

	if (currentField || currentRow.length > 0) {
		currentRow.push(currentField.trim());
		if (currentRow.some((field) => field !== '')) {
			lines.push(currentRow);
		}
	}

	return lines;
}

/**
 * Plantillas preconfiguradas para los bancos más habituales.
 */
export const BANK_TEMPLATES = {
	bbva: {
		name: 'BBVA (operaciones)',
		dateCol: 0,
		descCol: 2,
		amountCol: 3,
		balanceCol: 5,
		hasHeader: true,
		separator: ';'
	},
	santander: { name: 'Santander', dateCol: 0, descCol: 3, amountCol: 5, hasHeader: true, separator: ';' },
	caixabank: { name: 'CaixaBank', dateCol: 0, descCol: 2, amountCol: 3, hasHeader: true, separator: ';' },
	revolut: { name: 'Revolut', dateCol: 2, descCol: 1, amountCol: 3, hasHeader: true, separator: ',' },
	generic: {
		name: 'Estándar (Fecha, Concepto, Importe)',
		dateCol: 0,
		descCol: 1,
		amountCol: 2,
		hasHeader: true,
		separator: ','
	}
};

/**
 * Procesa las filas parseadas de un CSV y genera objetos ImportedTransaction.
 */
export function processParsedRows(
	rows: string[][],
	options: { dateCol: number; descCol: number; amountCol: number; balanceCol?: number; hasHeader: boolean }
): ImportedTransaction[] {
	const startIndex = options.hasHeader ? 1 : 0;
	const txs: ImportedTransaction[] = [];

	for (let i = startIndex; i < rows.length; i++) {
		const row = rows[i];
		if (row.length <= Math.max(options.dateCol, options.descCol, options.amountCol)) {
			continue;
		}

		const dateRaw = row[options.dateCol];
		const descRaw = row[options.descCol];
		const amountRaw = row[options.amountCol];
		const balanceRaw =
			options.balanceCol !== undefined && options.balanceCol !== -1 && row.length > options.balanceCol
				? row[options.balanceCol]
				: undefined;

		if (!dateRaw || !descRaw || !amountRaw) continue;

		const date = normalizeDate(dateRaw);
		const { amount, type } = normalizeAmount(amountRaw);
		const desc = descRaw.trim();
		const fallbackTag =
			type === 'income' ? 'Otros Ingresos' : type === 'transfer' ? 'Otros Traspasos' : 'Otros Gastos';
		const tag = deduceTagFromConcept(desc, type) || fallbackTag;
		const balance = normalizeBalance(balanceRaw || '');

		const rowId = `imported-row-${createStableHash([date, desc, amount, type, i.toString()].join('|'))}`;

		txs.push({
			id: rowId,
			date,
			desc,
			amount,
			type,
			tag,
			selected: true,
			isDuplicate: false,
			owner: 'joint',
			paidBy: 'shared',
			originalType: type,
			balance
		});
	}

	return txs;
}

export function prepareImportedTransactions(options: PrepareImportedTransactionsOptions): ImportedTransaction[] {
	const paidBy: 'userA' | 'userB' | 'shared' =
		options.accountOwner === 'userA' ? 'userA' : options.accountOwner === 'userB' ? 'userB' : 'shared';

	return options.transactions.map((tx) => {
		const enrichedTx = {
			...tx,
			accountId: options.accountId,
			sourceName: options.sourceName,
			owner: options.accountOwner,
			paidBy,
			originalType: tx.originalType || tx.type
		};
		const importFingerprint = createImportFingerprint(enrichedTx, options.accountId);

		return {
			...enrichedTx,
			id: importFingerprint,
			importFingerprint
		};
	});
}

export function correlateInternalTransfers(importedTxs: ImportedTransaction[]): ImportedTransaction[] {
	const matchedIds = new Set<string>();
	const transfersById = new Map<string, ImportedTransaction>();

	for (const expense of importedTxs.filter((tx) => tx.type === 'expense')) {
		const matches = importedTxs.filter(
			(income) =>
				income.type === 'income' &&
				income.date === expense.date &&
				income.amount === expense.amount &&
				income.accountId !== expense.accountId
		);

		if (matches.length !== 1) {
			continue;
		}

		const [income] = matches;
		const inverseMatches = importedTxs.filter(
			(candidate) =>
				candidate.type === 'expense' &&
				candidate.date === income.date &&
				candidate.amount === income.amount &&
				candidate.accountId !== income.accountId
		);

		if (inverseMatches.length !== 1 || matchedIds.has(expense.id) || matchedIds.has(income.id)) {
			continue;
		}

		if (!hasTransferEvidence(expense) || !hasTransferEvidence(income)) {
			continue;
		}

		const transferCorrelationId = getTransferCorrelationId(expense, income);
		matchedIds.add(expense.id);
		matchedIds.add(income.id);
		transfersById.set(expense.id, {
			...expense,
			type: 'transfer',
			tag: 'Traspaso',
			transferCorrelationId,
			fromAccountId: expense.accountId,
			toAccountId: income.accountId
		});
		transfersById.set(income.id, {
			...income,
			type: 'transfer',
			tag: 'Traspaso',
			transferCorrelationId,
			fromAccountId: expense.accountId,
			toAccountId: income.accountId
		});
	}

	return importedTxs.map((tx) => {
		const transferTx = transfersById.get(tx.id);
		if (transferTx) {
			return transferTx;
		}

		if (isBankTransferLike(tx) && tx.type !== 'transfer') {
			return { ...tx, tag: EXTERNAL_TRANSFER_TAG };
		}

		return tx;
	});
}

export function formatImportedTransactionsForPersistence(
	importedTxs: ImportedTransaction[],
	accounts: Account[] = []
): Transaction[] {
	const persistedTransferIds = new Set<string>();
	const selectedTxs = importedTxs.filter((tx) => tx.selected && !tx.isDuplicate);
	const transactions: Transaction[] = [];

	for (const tx of selectedTxs) {
		if (tx.type === 'transfer' && tx.transferCorrelationId) {
			if (persistedTransferIds.has(tx.transferCorrelationId)) {
				continue;
			}

			persistedTransferIds.add(tx.transferCorrelationId);
			transactions.push(formatInternalTransfer(tx, accounts));
			continue;
		}

		if (tx.type === 'transfer' && (!tx.fromAccountId || !tx.toAccountId)) {
			transactions.push(formatRegularImportedTransaction(normalizeUnconfirmedTransfer(tx), accounts));
			continue;
		}

		transactions.push(formatRegularImportedTransaction(tx, accounts));
	}

	return transactions;
}

function formatInternalTransfer(tx: ImportedTransaction, accounts: Account[]): Transaction {
	return {
		id: tx.transferCorrelationId || tx.importFingerprint || tx.id,
		desc: tx.desc,
		money: { amount: tx.amount, currency: 'EUR' },
		type: 'transfer',
		tag: 'Traspaso',
		date: tx.date,
		recurrence: 'one-off',
		owner: getTransferOwner(accounts, tx.fromAccountId, tx.toAccountId),
		accountId: undefined,
		fromAccountId: tx.fromAccountId,
		toAccountId: tx.toAccountId
	};
}

function formatRegularImportedTransaction(tx: ImportedTransaction, accounts: Account[]): Transaction {
	return {
		id: tx.importFingerprint || tx.id,
		desc: tx.desc,
		money: { amount: tx.amount, currency: 'EUR' },
		type: tx.type,
		tag: tx.tag,
		date: tx.date,
		recurrence: 'one-off',
		owner: tx.owner,
		paidBy: tx.paidBy,
		accountId: tx.type === 'transfer' ? undefined : tx.accountId,
		fromAccountId: tx.type === 'transfer' ? tx.fromAccountId : undefined,
		toAccountId: tx.type === 'transfer' ? tx.toAccountId : undefined
	};
}

function getTransferOwner(
	accounts: Account[],
	fromAccountId?: string,
	toAccountId?: string
): 'userA' | 'userB' | 'joint' {
	const fromAccount = accounts.find((account) => account.id === fromAccountId);
	const toAccount = accounts.find((account) => account.id === toAccountId);

	if (fromAccount && toAccount && fromAccount.owner === toAccount.owner) {
		return fromAccount.owner;
	}

	return 'joint';
}

/**
 * Identifica posibles duplicaciones comparando fecha, importe y concepto.
 */
export function detectDuplicates(
	importedTxs: ImportedTransaction[],
	existingTxs: Transaction[]
): ImportedTransaction[] {
	const seenFingerprints = new Set<string>();

	return importedTxs.map((imported) => {
		const fingerprint = imported.importFingerprint || createImportFingerprint(imported, imported.accountId || '');
		const duplicateInBatch = seenFingerprints.has(fingerprint);
		seenFingerprints.add(fingerprint);

		let possibleDuplicate: ImportedTransactionPossibleDuplicate | undefined;
		const isDuplicate = existingTxs.some((existing) => {
			const existingAmount = existing.money?.amount ? parseFloat(existing.money.amount) : 0;
			const importedAmount = parseFloat(imported.amount);

			const sameAmount = Math.abs(existingAmount - importedAmount) < 0.001;
			const sameType = existing.type === imported.type;
			const sameDate = existing.date === imported.date;
			const sameAccount = hasMatchingAccountEvidence(existing, imported);
			const sameFingerprint = Boolean(imported.importFingerprint && existing.id === imported.importFingerprint);
			const sameTransferCorrelation = Boolean(
				imported.transferCorrelationId && existing.id === imported.transferCorrelationId
			);

			const desc1 = existing.desc.toLowerCase().trim();
			const desc2 = imported.desc.toLowerCase().trim();
			let sameDesc = desc1 === desc2 || desc1.includes(desc2) || desc2.includes(desc1);

			if (!sameDesc) {
				const words1 = desc1.split(/[^a-záéíóúüñ0-9]+/i).filter((w) => w.length >= 4);
				const words2 = desc2.split(/[^a-záéíóúüñ0-9]+/i).filter((w) => w.length >= 4);
				if (words1.length > 0 && words2.length > 0) {
					sameDesc = words1.some((w) => words2.includes(w));
				}
			}

			if (
				(sameFingerprint && sameDate && sameAmount && sameAccount) ||
				(sameTransferCorrelation && sameDate && sameAmount)
			) {
				return true;
			}

			if (isManualTransferDuplicate(existing, imported, { sameAmount, sameDate, sameDesc, sameFingerprint })) {
				return true;
			}

			const isExactDuplicate =
				sameType && sameAmount && sameDate && sameDesc && (!imported.accountId || sameAccount);
			if (isExactDuplicate) {
				return true;
			}

			if (!possibleDuplicate) {
				possibleDuplicate = getPossibleDuplicateMatch(existing, imported, {
					sameAmount,
					sameType,
					sameAccount
				});
			}

			return false;
		});
		const duplicate = duplicateInBatch || isDuplicate;

		return {
			...imported,
			isDuplicate: duplicate,
			selected: !duplicate,
			possibleDuplicate: duplicate ? undefined : possibleDuplicate
		};
	});
}

function getPossibleDuplicateMatch(
	existing: Transaction,
	imported: ImportedTransaction,
	match: { sameAmount: boolean; sameType: boolean; sameAccount: boolean }
): ImportedTransactionPossibleDuplicate | undefined {
	if (!match.sameAmount || !match.sameType || (imported.accountId && !match.sameAccount)) {
		return undefined;
	}

	const dateDistanceDays = getDateDistanceDays(existing.date, imported.date);
	if (dateDistanceDays === undefined || dateDistanceDays > POSSIBLE_DUPLICATE_DATE_WINDOW_DAYS) {
		return undefined;
	}

	if (!hasSimilarConcept(existing.desc, imported.desc)) {
		return undefined;
	}

	return {
		existingTransactionId: existing.id,
		existingDate: existing.date,
		dateDistanceDays,
		reason: POSSIBLE_DUPLICATE_REASON
	};
}

function hasMatchingAccountEvidence(existing: Transaction, imported: ImportedTransaction): boolean {
	const sameRegularAccount = Boolean(
		existing.accountId && imported.accountId && existing.accountId === imported.accountId
	);
	const sameFromAccount = Boolean(
		existing.fromAccountId && imported.fromAccountId && existing.fromAccountId === imported.fromAccountId
	);
	const sameToAccount = Boolean(
		existing.toAccountId && imported.toAccountId && existing.toAccountId === imported.toAccountId
	);

	return sameRegularAccount || sameFromAccount || sameToAccount;
}

function isManualTransferDuplicate(
	existing: Transaction,
	imported: ImportedTransaction,
	match: { sameAmount: boolean; sameDate: boolean; sameDesc: boolean; sameFingerprint: boolean }
): boolean {
	if (existing.type !== 'transfer' || imported.type === 'transfer') {
		return false;
	}

	if (!match.sameAmount || !match.sameDate || !hasTransferEvidence(imported)) {
		return false;
	}

	const matchesTransferSide =
		(imported.type === 'expense' && existing.fromAccountId === imported.accountId) ||
		(imported.type === 'income' && existing.toAccountId === imported.accountId);
	if (!matchesTransferSide) {
		return false;
	}

	return match.sameFingerprint || match.sameDesc;
}

/**
 * Llama a la API de Gemini para procesar un extracto bancario en texto plano.
 */
export async function askGeminiToParseStatement(apiKey: string, statementText: string): Promise<ImportedTransaction[]> {
	const systemInstruction = `
Actúas como un extractor de datos bancarios estructurados en formato JSON. Tu objetivo es procesar el texto de un extracto o movimientos de cuenta bancaria y devolver estrictamente un JSON válido que contiene un array de objetos con las transacciones detectadas.

El JSON de salida debe tener el siguiente formato exacto:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "desc": "Concepto de la transacción",
      "amount": "123.45", 
      "type": "expense" | "income" | "transfer",
      "tag": "Categoría sugerida",
      "balance": "1234.56"
    }
  ]
}

Reglas estrictas:
1. Extrae cada movimiento del texto de entrada.
2. La fecha debe formatearse estrictamente como YYYY-MM-DD. Si no se especifica el año en el texto, asume el año actual (2026).
3. La descripción/concepto debe limpiarse de códigos innecesarios si es posible, dejando un nombre claro (ej. "MERCADONA" en lugar de "MERCADONA S.A. 2043").
4. El importe (amount) debe ser un string con el valor absoluto decimal positivo (ej: "45.20" en lugar de "-45,20"). No incluyas símbolos de moneda (€, $, etc.).
5. El tipo de transacción (type) debe ser:
   - "expense" si es un gasto, cargo, compra, débito, transferencia emitida, etc.
   - "income" si es un ingreso, abono, nómina, Bizum, etc.
   - "transfer" si es un traspaso entre cuentas, hucha, ahorro, etc.
6. La etiqueta (tag) sugerida debe ser una de las categorías estándar de la aplicación:
   - Para gastos (expense): "Alquiler/Hipoteca", "Alimentación", "Transporte", "Suministros", "Ocio/Restauración", "Suscripciones", "Salud/Belleza", "Educación", "Viajes", "Compras/Ropa", "Otros Gastos"
   - Para ingresos (income): "Sueldo", "Inversiones", "Freelance", "Bizum/Regalo", "Reembolso", "Otros Ingresos"
   - Para traspasos (transfer): "Traspaso", "Ahorro/Inversión", "Gasto Común", "Ajuste de Saldo", "Otros Traspasos"
7. Extrae balance solo si existe en una columna visible Saldo/Balance de esa misma fila. NUNCA calcules, recomputes, infieras ni reconstruyas balance usando importes, movimientos previos o saldos anteriores. Debe ser un string con el valor decimal conservando el signo si es negativo (ej. "1024.50" o "-50.20"), sin símbolos de moneda (€, $, etc.). Si una fila no tiene un Saldo/Balance visible, omite balance o devuélvelo como null.
8. Retorna ÚNICAMENTE el bloque JSON. No incluyas texto explicativo, ni bloques de código markdown \`\`\`json ... \`\`\`. Devuelve el JSON puro directamente.
`;

	const chatMessages = [
		{
			role: 'user' as const,
			content: `Procesa este texto y extrae las transacciones:\n\n${statementText}`,
			timestamp: new Date().toISOString()
		}
	];

	let resultText = '';
	try {
		resultText = await askGemini(apiKey, chatMessages, systemInstruction);
	} catch (error: unknown) {
		if (isGeminiApiKeyError(error)) {
			throw createGeminiApiKeyUnavailableError();
		}

		throw error;
	}

	let cleanText = resultText.trim();
	if (cleanText.startsWith('```json')) {
		cleanText = cleanText.substring(7);
	} else if (cleanText.startsWith('```')) {
		cleanText = cleanText.substring(3);
	}
	if (cleanText.endsWith('```')) {
		cleanText = cleanText.substring(0, cleanText.length - 3);
	}
	cleanText = cleanText.trim();

	try {
		const parsed = JSON.parse(cleanText);
		if (!parsed.transactions || !Array.isArray(parsed.transactions)) {
			throw new Error("Formato de respuesta inválido de Gemini: falta la clave 'transactions'");
		}

		return (parsed.transactions as GeminiTransactionPayload[]).map((tx, index) =>
			createImportedTransactionFromGemini(tx, index, 'imported-ai')
		);
	} catch (err: unknown) {
		console.error('Error al parsear el JSON de Gemini:', err, 'Texto recibido:', resultText);
		throw new Error(
			'No se pudo procesar el extracto con IA. Asegúrate de que el texto contiene movimientos válidos y que tu API Key es correcta.'
		);
	}
}

/**
 * Llama a la API de Gemini para procesar un extracto bancario en formato PDF.
 */
export async function askGeminiToParsePdf(
	apiKey: string,
	pdfBase64: string,
	accountContext: PdfAccountContext = {}
): Promise<ImportedTransaction[]> {
	try {
		if (!apiKey.trim()) {
			throw createGeminiApiKeyUnavailableError();
		}

		const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
		const accountInstruction = accountContext.accountName
			? `\nContexto de cuenta asignada por el usuario: el PDF pertenece a la cuenta "${accountContext.accountName}". Usa este dato solo como contexto para interpretar cargos, abonos y traspasos; no lo devuelvas como campo JSON.`
			: '';

		const systemInstruction = `
Actúas como un extractor de datos bancarios estructurados en formato JSON. Tu objetivo es procesar el archivo PDF del extracto o movimientos de cuenta bancaria y devolver estrictamente un JSON válido que contiene un array de objetos con las transacciones detectadas.
${accountInstruction}

El JSON de salida debe tener el siguiente formato exacto:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "desc": "Concepto de la transacción",
      "amount": "123.45", 
      "type": "expense" | "income" | "transfer",
      "tag": "Categoría sugerida",
      "balance": "1234.56"
    }
  ]
}

Reglas estrictas:
1. Extrae cada movimiento del archivo PDF.
2. La fecha debe formatearse estrictamente como YYYY-MM-DD. Si no se especifica el año en el documento, asume el año actual (2026).
3. La descripción/concepto debe limpiarse de códigos innecesarios si es posible, dejando un nombre claro (ej. "MERCADONA" en lugar de "MERCADONA S.A. 2043").
4. El importe (amount) debe ser un string con el valor absoluto decimal positivo (ej: "45.20" en lugar de "-45,20"). No incluyas símbolos de moneda (€, $, etc.).
5. El tipo de transacción (type) debe ser:
   - "expense" si es un gasto, cargo, compra, débito, transferencia emitida, etc.
   - "income" si es un ingreso, abono, nómina, Bizum, etc.
   - "transfer" si es un traspaso entre cuentas, hucha, ahorro, etc.
6. La etiqueta (tag) sugerida debe ser una de las categorías estándar de la aplicación:
   - Para gastos (expense): "Alquiler/Hipoteca", "Alimentación", "Transporte", "Suministros", "Ocio/Restauración", "Suscripciones", "Salud/Belleza", "Educación", "Viajes", "Compras/Ropa", "Otros Gastos"
   - Para ingresos (income): "Sueldo", "Inversiones", "Freelance", "Bizum/Regalo", "Reembolso", "Otros Ingresos"
   - Para traspasos (transfer): "Traspaso", "Ahorro/Inversión", "Gasto Común", "Ajuste de Saldo", "Otros Traspasos"
7. En PDFs tipo tabla visual/OCR con columnas Fecha, Concepto, Importe y Saldo, extrae balance solo desde la columna visible Saldo/Balance de esa misma fila. NUNCA calcules, recomputes, infieras ni reconstruyas balance usando importes, movimientos previos o saldos anteriores. Debe ser un string con el valor decimal conservando el signo si es negativo (ej. "1024.50" o "-50.20"), sin símbolos de moneda (€, $, etc.). Si una fila no tiene un Saldo/Balance visible, omite balance o devuélvelo como null.
8. Retorna ÚNICAMENTE el bloque JSON. No incluyas texto explicativo, ni bloques de código markdown \`\`\`json ... \`\`\`. Devuelve el JSON puro directamente.
`;

		const payload = {
			contents: [
				{
					role: 'user',
					parts: [
						{
							inlineData: {
								mimeType: 'application/pdf',
								data: pdfBase64
							}
						},
						{
							text: 'Procesa este extracto bancario PDF y extrae todas las transacciones.'
						}
					]
				}
			],
			systemInstruction: {
				parts: [
					{
						text: systemInstruction
					}
				]
			}
		};

		let delay = 1000;
		let resultText = '';

		for (let attempt = 1; attempt <= 5; attempt++) {
			try {
				const response = await fetch(url, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
				if (!response.ok) {
					throw new Error(`Error de comunicación con Gemini (Código HTTP ${response.status})`);
				}
				const data = await response.json();
				resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
				break;
			} catch (error: unknown) {
				if (isGeminiApiKeyError(error)) {
					throw createGeminiApiKeyUnavailableError();
				}

				if (attempt === 5) {
					const message = error instanceof Error ? error.message : 'Error desconocido';
					throw new Error(`Error tras 5 intentos al parsear PDF con IA: ${message}`);
				}
				await new Promise((resolve) => setTimeout(resolve, delay));
				delay *= 2;
			}
		}

		if (!resultText) {
			throw new Error('No se ha obtenido respuesta de Gemini al procesar el PDF.');
		}

		let cleanText = resultText.trim();
		if (cleanText.startsWith('```json')) {
			cleanText = cleanText.substring(7);
		} else if (cleanText.startsWith('```')) {
			cleanText = cleanText.substring(3);
		}
		if (cleanText.endsWith('```')) {
			cleanText = cleanText.substring(0, cleanText.length - 3);
		}
		cleanText = cleanText.trim();

		const parsed = JSON.parse(cleanText);
		if (!parsed.transactions || !Array.isArray(parsed.transactions)) {
			throw new Error("Formato de respuesta inválido de Gemini: falta la clave 'transactions'");
		}

		return (parsed.transactions as GeminiTransactionPayload[]).map((tx, index) =>
			createImportedTransactionFromGemini(tx, index, 'imported-pdf')
		);
	} catch (err: unknown) {
		if (isGeminiApiKeyError(err)) {
			throw createGeminiApiKeyUnavailableError();
		}

		console.error('Error al procesar extracto PDF con Gemini:', err);
		throw new Error(
			'No se pudo procesar el extracto PDF con IA. Asegúrate de que el documento es válido y tu API Key es correcta.'
		);
	}
}
