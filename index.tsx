import { useState, useEffect, Fragment, type SyntheticEvent, type ReactNode } from 'react';

// === CONSTANTES Y VALORES POR DEFECTO ===
const DEFAULT_TAGS = {
	income: ['Sueldo', 'Inversiones', 'Freelance', 'Bizum/Regalo', 'Reembolso', 'Otros Ingresos'],
	expense: ['Alquiler/Hipoteca', 'Alimentación', 'Transporte', 'Suministros', 'Ocio/Restauración', 'Suscripciones', 'Salud/Belleza', 'Educación', 'Viajes', 'Compras/Ropa', 'Otros Gastos'],
	transfer: ['Traspaso', 'Ahorro/Inversión', 'Gasto Común', 'Ajuste de Saldo', 'Otros Traspasos'],
	debt: ['Hipoteca', 'Préstamo Coche', 'Tarjeta de Crédito', 'Préstamo Personal', 'Otros Préstamos']
} as const;

const STORAGE_KEYS = {
	transactions: 'finanzas_v3_transactions',
	debts: 'finanzas_v3_debts',
	periods: 'finanzas_v3_periods',
	geminiKey: 'finanzas_v2_gemini_key',
	aiChat: 'finanzas_v3_ai_chat'
} as const;

// Limpieza de base de datos de una sola vez para arrancar limpio y desde cero
if (typeof window !== 'undefined' && !localStorage.getItem('finanzas_v3_cleared_v2')) {
	localStorage.removeItem(STORAGE_KEYS.transactions);
	localStorage.removeItem(STORAGE_KEYS.debts);
	localStorage.removeItem(STORAGE_KEYS.periods);
	localStorage.setItem('finanzas_v3_cleared_v2', 'true');
}

const LEGACY_DATA_KEYS = ['finanzas_v2_transactions', 'finanzas_v2_debts'] as const;

type TransactionType = 'income' | 'expense' | 'transfer';
type ActiveTab = 'overview' | 'transactions' | 'debts' | 'consolidation' | 'ai' | 'accounts';
type NumericInput = number | string;
type RateMode = 'tae' | 'tin';
type DebtKind = 'classic' | 'paymentPlan';
type InstallmentStatus = 'pending' | 'paid';
type TransactionRecurrence = 'one-off' | 'recurring';

type ChatMessage = {
	role: 'user' | 'model';
	content: string;
	timestamp: string;
};

type Account = {
	id: string;
	name: string;
	owner: 'userA' | 'userB' | 'joint';
	initialBalance: number;
};

type Period = {
	month: string;
	openingBalance: number;
	openingBalanceA?: number;
	openingBalanceB?: number;
	isManualInit?: boolean;
};

type Transaction = {
	id: string;
	desc: string;
	amount: number;
	type: TransactionType;
	tag: string;
	date: string;
	recurrence?: TransactionRecurrence;
	originId?: string;
	owner?: 'userA' | 'userB' | 'joint';
	paidBy?: 'userA' | 'userB' | 'shared';
	accountId?: string;
	fromAccountId?: string;
	toAccountId?: string;
};

type DebtBase = {
	id: string;
	kind: DebtKind;
	desc: string;
	tag: string;
	date: string;
	owner?: 'userA' | 'userB' | 'joint';
	paymentAccountId?: string;
};

type ClassicDebt = DebtBase & {
	kind: 'classic';
	principal: number;
	tin?: number;
	tae: number;
	termMonths: number;
};

type PaymentPlanInstallment = {
	id: string;
	dueMonth: string;
	amount: number;
	status: InstallmentStatus;
	label: string;
};

type PaymentPlanDebt = DebtBase & {
	kind: 'paymentPlan';
	financedAmount: number;
	fees: number;
	totalToPay: number;
	installments: PaymentPlanInstallment[];
};

type Debt = ClassicDebt | PaymentPlanDebt;

type TxForm = {
	desc: string;
	amount: string;
	type: TransactionType;
	tag: string;
	date: string;
	recurrence?: TransactionRecurrence;
	owner: 'userA' | 'userB' | 'joint';
	paidBy: 'userA' | 'userB' | 'shared';
	accountId: string;
	fromAccountId: string;
	toAccountId: string;
};

type PaymentPlanTrancheForm = {
	id: string;
	months: string;
	amount: string;
};

type DebtForm = {
	kind: DebtKind;
	desc: string;
	principal: string;
	financedAmount: string;
	fees: string;
	tin: string;
	tae: string;
	termMonths: string;
	tranches: PaymentPlanTrancheForm[];
	tag: string;
	date: string;
	owner: 'userA' | 'userB' | 'joint';
	paymentAccountId: string;
};

type ConsolidationForm = {
	tae: string;
	termMonths: string;
	extraCapital: string;
};

type DebtScheduleSelection = Debt;

type AmortizationRow = {
	month: number;
	cuota: number;
	principalPaid: number;
	interestPayment: number;
	remainingPrincipal: number;
};

type TagBreakdown = {
	tag: string;
	amount: number;
};

const toNumber = (value: NumericInput | undefined) => {
	const parsed = typeof value === 'number' ? value : parseFloat(value ?? '');
	return Number.isFinite(parsed) ? parsed : 0;
};

const deduceTagFromConcept = (concept: string, type: TransactionType): string | null => {
	const lower = concept.toLowerCase().trim();
	if (!lower) return null;

	if (type === 'income') {
		if (lower.includes('sueldo') || lower.includes('nómina') || lower.includes('nomina') || lower.includes('salary') || lower.includes('empresa')) return 'Sueldo';
		if (lower.includes('inversion') || lower.includes('dividend') || lower.includes('interes') || lower.includes('cripto') || lower.includes('crypto')) return 'Inversiones';
		if (lower.includes('freelance') || lower.includes('proyecto') || lower.includes('autónomo') || lower.includes('curro')) return 'Freelance';
		if (lower.includes('bizum') || lower.includes('regalo') || lower.includes('donación')) return 'Bizum/Regalo';
		if (lower.includes('reembolso') || lower.includes('devolucion') || lower.includes('refund')) return 'Reembolso';
	} else if (type === 'expense') {
		if (lower.includes('alquiler') || lower.includes('hipoteca') || lower.includes('rent') || lower.includes('comunidad')) return 'Alquiler/Hipoteca';
		if (lower.includes('mercadona') || lower.includes('carrefour') || lower.includes('lidl') || lower.includes('dia') || lower.includes('supermercado') || lower.includes('comida') || lower.includes('alimentacion') || lower.includes('compra') || lower.includes('alcampo') || lower.includes('ahorramas') || lower.includes('fruta') || lower.includes('panadería')) return 'Alimentación';
		if (lower.includes('gasolina') || lower.includes('uber') || lower.includes('cabify') || lower.includes('metro') || lower.includes('bus') || lower.includes('tren') || lower.includes('taxi') || lower.includes('peaje') || lower.includes('parking') || lower.includes('renfe')) return 'Transporte';
		if (lower.includes('luz') || lower.includes('agua') || lower.includes('gas') || lower.includes('internet') || lower.includes('telefono') || lower.includes('móvil') || lower.includes('fibra') || lower.includes('electricidad') || lower.includes('iberdrola') || lower.includes('endesa') || lower.includes('naturgy')) return 'Suministros';
		if (lower.includes('cine') || lower.includes('restaurante') || lower.includes('bar') || lower.includes('ocio') || lower.includes('fiesta') || lower.includes('concierto') || lower.includes('cerveza') || lower.includes('cafe') || lower.includes('burger') || lower.includes('pizza') || lower.includes('cañas') || lower.includes('copas') || lower.includes('pub')) return 'Ocio/Restauración';
		if (lower.includes('netflix') || lower.includes('spotify') || lower.includes('prime') || lower.includes('suscripcion') || lower.includes('hbo') || lower.includes('disney') || lower.includes('youtube premium')) return 'Suscripciones';
		if (lower.includes('medico') || lower.includes('farmacia') || lower.includes('salud') || lower.includes('dentista') || lower.includes('optica') || lower.includes('doctor') || lower.includes('clinica')) return 'Salud/Belleza';
		if (lower.includes('colegio') || lower.includes('universidad') || lower.includes('curso') || lower.includes('academia') || lower.includes('libro') || lower.includes('estudio') || lower.includes('educacion')) return 'Educación';
		if (lower.includes('viaje') || lower.includes('vuelo') || lower.includes('hotel') || lower.includes('booking') || lower.includes('vacaciones') || lower.includes('airbnb') || lower.includes('avion')) return 'Viajes';
		if (lower.includes('ropa') || lower.includes('zara') || lower.includes('hm ') || lower.includes('nike') || lower.includes('amazon') || lower.includes('tienda') || lower.includes('shopping') || lower.includes('compras')) return 'Compras/Ropa';
	} else if (type === 'transfer') {
		if (lower.includes('ahorro') || lower.includes('hucha') || lower.includes('inversion') || lower.includes('crypto') || lower.includes('cripto') || lower.includes('deposito')) return 'Ahorro/Inversión';
		if (lower.includes('comun') || lower.includes('compartido') || lower.includes('juntos') || lower.includes('pareja') || lower.includes('casa')) return 'Gasto Común';
		if (lower.includes('ajuste') || lower.includes('correccion') || lower.includes('cuadrar') || lower.includes('saldo')) return 'Ajuste de Saldo';
	}
	return null;
};

const normalizeMonth = (value?: string) => {
	return value?.substring(0, 7) || new Date().toISOString().substring(0, 7);
};

const addMonthsToMonth = (month: string, monthsToAdd: number) => {
	const [year, monthIndex] = normalizeMonth(month).split('-').map(Number);
	const date = new Date(year, monthIndex - 1 + monthsToAdd, 1);
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const getValidDateForMonth = (monthStr: string, preferredDayStr: string) => {
	const [year, monthIndex] = monthStr.split('-').map(Number);
	const preferredDay = parseInt(preferredDayStr, 10);
	const lastDayOfMonth = new Date(year, monthIndex, 0).getDate();
	const clampedDay = Math.min(preferredDay, lastDayOfMonth);
	const dayStr = String(clampedDay).padStart(2, '0');
	return `${monthStr}-${dayStr}`;
};

const isClassicDebt = (debt: Debt): debt is ClassicDebt => debt.kind === 'classic';
const isPaymentPlanDebt = (debt: Debt): debt is PaymentPlanDebt => debt.kind === 'paymentPlan';
const hasTin = (debt: ClassicDebt) => toNumber(debt.tin) > 0;

const getDebtRateLabel = (debt: ClassicDebt) => {
	return hasTin(debt) ? `TIN ${toNumber(debt.tin)}% / TAE ${debt.tae}%` : `TAE ${debt.tae}%`;
};

const getPaymentPlanPaidAmount = (debt: PaymentPlanDebt) => {
	return debt.installments
		.filter((installment) => installment.status === 'paid')
		.reduce((sum, item) => sum + item.amount, 0);
};

const getPaymentPlanRemainingAmount = (debt: PaymentPlanDebt) => {
	return debt.installments
		.filter((installment) => installment.status === 'pending')
		.reduce((sum, item) => sum + item.amount, 0);
};

const migrateDebt = (rawDebt: any): Debt => {
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

const generatePaymentPlanInstallments = (
	debtId: string,
	startMonth: string,
	tranches: PaymentPlanTrancheForm[]
): PaymentPlanInstallment[] => {
	let offset = 0;
	let installmentNumber = 1;
	const installments: PaymentPlanInstallment[] = [];

	tranches.forEach((tranche, trancheIndex) => {
		const months = Math.trunc(toNumber(tranche.months));
		const amount = Math.abs(toNumber(tranche.amount));
		for (let monthIndex = 0; monthIndex < months; monthIndex++) {
			installments.push({
				id: `${debtId}-installment-${installmentNumber}`,
				dueMonth: addMonthsToMonth(startMonth, offset),
				amount,
				status: 'pending',
				label: `Tramo ${trancheIndex + 1} · Cuota ${monthIndex + 1}`
			});
			offset += 1;
			installmentNumber += 1;
		}
	});

	return installments;
};

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

const migrateTransaction = (rawTransaction: any, index: number): Transaction => {
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

const readStoredTransactions = () => {
	return readStoredArray(STORAGE_KEYS.transactions, 'finanzas_v2_transactions').map(migrateTransaction);
};

const readStoredDebts = () => {
	return readStoredArray(STORAGE_KEYS.debts, 'finanzas_v2_debts').map(migrateDebt);
};

const readStoredPeriods = (existingTx: Transaction[], existingDebts: Debt[]): Period[] => {
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

	// Migración: si hay movimientos/deudas pero no periodos en localStorage, se generan bajo demanda
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


// === COMPONENTES DE ICONOS SVG ===
const Icons = {
	TrendingUp: () => (
		<svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
			<path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
		</svg>
	),
	TrendingDown: () => (
		<svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
			<path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
		</svg>
	),
	CreditCard: () => (
		<svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
			/>
		</svg>
	),
	Scale: () => (
		<svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
			/>
		</svg>
	),
	Trash: () => (
		<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
			/>
		</svg>
	),
	Plus: () => (
		<svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
			<path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
		</svg>
	),
	Info: () => (
		<svg
			className="w-4 h-4 text-slate-400 inline cursor-help"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			strokeWidth={2}
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
			/>
		</svg>
	),
	Sparkles: () => (
		<svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
			/>
		</svg>
	),
	Lock: () => (
		<svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
			/>
		</svg>
	),
	Edit: () => (
		<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
			/>
		</svg>
	)
};

const getInitialData = () => {
	const rawTransactions = readStoredTransactions();
	const rawDebts = readStoredDebts();
	const rawPeriods = readStoredPeriods(rawTransactions, rawDebts);

	const storedAccounts = localStorage.getItem('finanzas_v3_accounts');
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

	// No accounts exist, migrate.
	const userAName = (typeof window !== 'undefined' && localStorage.getItem('finanzas_v3_userA_name')) || 'Usuario A';
	const userBName = (typeof window !== 'undefined' && localStorage.getItem('finanzas_v3_userB_name')) || 'Usuario B';

	const sortedPeriods = [...rawPeriods].sort((a, b) => a.month.localeCompare(b.month));
	const firstPeriod = sortedPeriods.length > 0 ? sortedPeriods[0] : null;
	const initialBalA = firstPeriod ? (firstPeriod.openingBalanceA !== undefined ? firstPeriod.openingBalanceA : firstPeriod.openingBalance / 2) : 0;
	const initialBalB = firstPeriod ? (firstPeriod.openingBalanceB !== undefined ? firstPeriod.openingBalanceB : firstPeriod.openingBalance / 2) : 0;

	const migratedAccounts: Account[] = [
		{ id: 'default-a', name: `Efectivo ${userAName}`, owner: 'userA', initialBalance: initialBalA },
		{ id: 'default-b', name: `Efectivo ${userBName}`, owner: 'userB', initialBalance: initialBalB },
		{ id: 'default-joint', name: 'Cuenta Común', owner: 'joint', initialBalance: 0 }
	];

	// Map old transactions to these new default accounts
	const migratedTransactions = rawTransactions.map(t => {
		if (!t.accountId && t.type !== 'transfer') {
			if (t.owner === 'userA') return { ...t, accountId: 'default-a' };
			if (t.owner === 'userB') return { ...t, accountId: 'default-b' };
			return { ...t, accountId: 'default-joint' };
		}
		return t;
	});

	if (typeof window !== 'undefined') {
		localStorage.setItem('finanzas_v3_accounts', JSON.stringify(migratedAccounts));
		localStorage.setItem('finanzas_v3_transactions', JSON.stringify(migratedTransactions));
	}

	return {
		accounts: migratedAccounts,
		transactions: migratedTransactions,
		periods: rawPeriods
	};
};

function renderInlineCode(text: string, key: string): ReactNode[] {
	const codeParts = text.split(/(`.*?`)/g);
	return codeParts.map((part, cIdx) => {
		if (part.startsWith('`') && part.endsWith('`')) {
			const codeText = part.slice(1, -1);
			return (
				<code key={`${key}-${cIdx}`} className="bg-slate-900 border border-slate-800 text-indigo-300 px-1.5 py-0.5 rounded font-mono text-xs mx-0.5 font-semibold">
					{codeText}
				</code>
			);
		}
		return <span key={`${key}-${cIdx}`}>{part}</span>;
	});
}

function renderInlineMarkdown(text: string): ReactNode[] {
	const boldParts = text.split(/(\*\*.*?\*\*)/g);
	return boldParts.flatMap((part, bIdx) => {
		if (part.startsWith('**') && part.endsWith('**')) {
			const boldText = part.slice(2, -2);
			return renderInlineCode(boldText, `bold-${bIdx}`);
		}
		return renderInlineCode(part, `text-${bIdx}`);
	});
}

function MarkdownRenderer({ text }: { text: string }) {
	const parts = text.split(/(```[\s\S]*?```)/g);

	return (
		<div className="space-y-3">
			{parts.map((part, index) => {
				if (part.startsWith('```')) {
					const lines = part.split('\n');
					let language = 'text';
					let code = part;
					if (lines[0].startsWith('```')) {
						language = lines[0].replace('```', '').trim() || 'text';
						code = lines.slice(1, -1).join('\n');
					}
					return (
						<pre key={index} className="bg-slate-900 border border-slate-800 p-4 rounded-xl font-mono text-xs overflow-x-auto text-slate-200 my-2">
							{language !== 'text' && <span className="block text-[10px] text-slate-500 uppercase tracking-widest mb-2 font-sans font-bold">{language}</span>}
							<code>{code}</code>
						</pre>
					);
				} else {
					const lines = part.split('\n');
					const renderedElements: ReactNode[] = [];
					let listItems: string[] = [];
					let listType: 'ol' | 'ul' | null = null;

					const flushList = (key: number) => {
						if (listItems.length > 0) {
							if (listType === 'ul') {
								renderedElements.push(
									<ul key={`ul-${key}`} className="list-disc list-inside pl-4 space-y-1.5 my-2 text-slate-300">
										{listItems.map((item, idx) => (
											<li key={idx}>{renderInlineMarkdown(item)}</li>
										))}
									</ul>
								);
							} else if (listType === 'ol') {
								renderedElements.push(
									<ol key={`ol-${key}`} className="list-decimal list-inside pl-4 space-y-1.5 my-2 text-slate-300">
										{listItems.map((item, idx) => (
											<li key={idx}>{renderInlineMarkdown(item)}</li>
										))}
									</ol>
								);
							}
							listItems = [];
							listType = null;
						}
					};

					for (let i = 0; i < lines.length; i++) {
						const line = lines[i];
						const trimmedLine = line.trim();

						if (trimmedLine === '') {
							flushList(i);
							continue;
						}

						const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
						if (headerMatch) {
							flushList(i);
							const level = headerMatch[1].length;
							const content = headerMatch[2];
							const headerClasses = 
								level === 1 ? 'text-lg font-black text-white mt-3 mb-1.5' :
								level === 2 ? 'text-base font-extrabold text-slate-200 mt-3 mb-1.5' :
								level === 3 ? 'text-sm font-bold text-slate-200 mt-2 mb-1' :
								'text-xs font-bold text-slate-300 mt-2 mb-1';
							
							renderedElements.push(
								level === 1 ? <h3 key={i} className={headerClasses}>{renderInlineMarkdown(content)}</h3> :
								level === 2 ? <h4 key={i} className={headerClasses}>{renderInlineMarkdown(content)}</h4> :
								level === 3 ? <h5 key={i} className={headerClasses}>{renderInlineMarkdown(content)}</h5> :
								<h6 key={i} className={headerClasses}>{renderInlineMarkdown(content)}</h6>
							);
							continue;
						}

						const ulMatch = line.match(/^[\*\-\+]\s+(.*)$/);
						if (ulMatch) {
							if (listType !== 'ul') {
								flushList(i);
								listType = 'ul';
							}
							listItems.push(ulMatch[1]);
							continue;
						}

						const olMatch = line.match(/^\d+\.\s+(.*)$/);
						if (olMatch) {
							if (listType !== 'ol') {
								flushList(i);
								listType = 'ol';
							}
							listItems.push(olMatch[1]);
							continue;
						}

						flushList(i);
						renderedElements.push(
							<p key={i} className="my-1.5 text-slate-300 leading-relaxed text-sm">
								{renderInlineMarkdown(line)}
							</p>
						);
					}
					flushList(lines.length);
					return <Fragment key={index}>{renderedElements}</Fragment>;
				}
			})}
		</div>
	);
}

export default function App() {
	const currentMonthString = new Date().toISOString().substring(0, 7); // "YYYY-MM"

	// === ESTADOS GLOBALES ===
	const [userAName, setUserAName] = useState(() => localStorage.getItem('finanzas_v3_userA_name') || 'Usuario A');
	const [userBName, setUserBName] = useState(() => localStorage.getItem('finanzas_v3_userB_name') || 'Usuario B');
	const [viewMode, setViewMode] = useState<'all' | 'userA' | 'userB'>('all');

	const [accounts, setAccounts] = useState<Account[]>(() => getInitialData().accounts);

	// Estados de Edición de Transacción
	const [editingTx, setEditingTx] = useState<Transaction | null>(null);
	const [editForm, setEditForm] = useState<TxForm>({
		desc: '',
		amount: '',
		type: 'expense',
		tag: DEFAULT_TAGS.expense[0],
		date: `${currentMonthString}-01`,
		recurrence: 'one-off',
		owner: 'joint',
		paidBy: 'shared',
		accountId: '',
		fromAccountId: '',
		toAccountId: ''
	});
	const [editScope, setEditScope] = useState<'only-this' | 'future' | 'all'>('only-this');

	const [periods, setPeriods] = useState<Period[]>(() => getInitialData().periods);

	const [selectedMonth, setSelectedMonth] = useState(() => {
		const currentMonth = new Date().toISOString().substring(0, 7);
		const storedPeriods = getInitialData().periods;
		if (storedPeriods.length > 0) {
			const exists = storedPeriods.some((p) => p.month === currentMonth);
			if (exists) return currentMonth;
			return storedPeriods[storedPeriods.length - 1].month;
		}
		return currentMonth;
	});

	const [transactions, setTransactions] = useState<Transaction[]>(() => getInitialData().transactions);

	const [debts, setDebts] = useState<Debt[]>(readStoredDebts);

	const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
	const [selectedDebtSchedule, setSelectedDebtSchedule] = useState<DebtScheduleSelection | null>(null);

	// Formularios
	const [txForm, setTxForm] = useState<TxForm>({
		desc: '',
		amount: '',
		type: 'expense',
		tag: DEFAULT_TAGS.expense[0],
		date: `${selectedMonth}-01`,
		recurrence: 'one-off',
		owner: 'joint',
		paidBy: 'shared',
		accountId: '',
		fromAccountId: '',
		toAccountId: ''
	});
	const [debtForm, setDebtForm] = useState<DebtForm>({
		kind: 'classic',
		desc: '',
		principal: '',
		financedAmount: '',
		fees: '',
		tin: '',
		tae: '',
		termMonths: '',
		tranches: [{ id: 'initial-tranche', months: '', amount: '' }],
		tag: DEFAULT_TAGS.debt[0],
		date: selectedMonth,
		owner: 'joint',
		paymentAccountId: ''
	});
	const [debtFormError, setDebtFormError] = useState('');

	// Estados de gestión de Cuentas
	const [editingAccount, setEditingAccount] = useState<Account | null>(null);
	const [accountForm, setAccountForm] = useState({
		name: '',
		owner: 'joint' as 'userA' | 'userB' | 'joint',
		initialBalance: ''
	});

	// Formularios de inicialización/reconfiguración
	const [initFlow, setInitFlow] = useState<'past' | 'current'>('current');
	const [initMonth, setInitMonth] = useState(currentMonthString);
	const [initBalance, setInitBalance] = useState('0');
	const [initBalanceA, setInitBalanceA] = useState('0');
	const [initBalanceB, setInitBalanceB] = useState('0');
	const [isReconfiguring, setIsReconfiguring] = useState(false);
	const [reconfigAccounts, setReconfigAccounts] = useState<Account[]>([]);

	// === SIMULADOR DE REUNIFICACIÓN ===
	const [selectedDebtsForConsolidation, setSelectedDebtsForConsolidation] = useState<string[]>([]);
	const [consolidationForm, setConsolidationForm] = useState<ConsolidationForm>({
		tae: '5.5',
		termMonths: '36',
		extraCapital: ''
	});

	// === INTEGRACIÓN GEMINI AI ===
	const [geminiApiKey, setGeminiApiKey] = useState(() => {
		return localStorage.getItem(STORAGE_KEYS.geminiKey) || '';
	});
	const [customQuestion, setCustomQuestion] = useState('');
	const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
		try {
			const stored = localStorage.getItem(STORAGE_KEYS.aiChat);
			return stored ? JSON.parse(stored) : [];
		} catch {
			return [];
		}
	});
	const [aiLoading, setAiLoading] = useState(false);
	const [aiError, setAiError] = useState('');

	// Sincronización LocalStorage
	useEffect(() => {
		LEGACY_DATA_KEYS.forEach((key) => localStorage.removeItem(key));
	}, []);

	useEffect(() => {
		localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
	}, [transactions]);

	useEffect(() => {
		localStorage.setItem(STORAGE_KEYS.debts, JSON.stringify(debts));
	}, [debts]);

	useEffect(() => {
		localStorage.setItem(STORAGE_KEYS.periods, JSON.stringify(periods));
	}, [periods]);

	useEffect(() => {
		localStorage.setItem(STORAGE_KEYS.geminiKey, geminiApiKey);
	}, [geminiApiKey]);

	useEffect(() => {
		localStorage.setItem(STORAGE_KEYS.aiChat, JSON.stringify(chatMessages));
	}, [chatMessages]);

	useEffect(() => {
		localStorage.setItem('finanzas_v3_userA_name', userAName);
	}, [userAName]);

	useEffect(() => {
		localStorage.setItem('finanzas_v3_userB_name', userBName);
	}, [userBName]);

	useEffect(() => {
		localStorage.setItem('finanzas_v3_accounts', JSON.stringify(accounts));
	}, [accounts]);

	useEffect(() => {
		if (accounts.length > 0) {
			const firstJoint = accounts.find((a) => a.owner === 'joint')?.id || accounts[0].id;
			setTxForm((prev) => ({
				...prev,
				accountId: prev.accountId && accounts.some((a) => a.id === prev.accountId) ? prev.accountId : firstJoint,
				fromAccountId: prev.fromAccountId && accounts.some((a) => a.id === prev.fromAccountId) ? prev.fromAccountId : accounts[0].id,
				toAccountId: prev.toAccountId && accounts.some((a) => a.id === prev.toAccountId) ? prev.toAccountId : (accounts[1]?.id || accounts[0].id)
			}));
		}
	}, [accounts]);

	// Auto-generación de periodos faltantes si el mes actual es posterior al último registrado
	useEffect(() => {
		if (periods.length === 0) return;
		const sorted = [...periods].sort((a, b) => a.month.localeCompare(b.month));
		const latestMonth = sorted[sorted.length - 1].month;
		const currentMonth = new Date().toISOString().substring(0, 7);

		if (currentMonth > latestMonth) {
			const updatedPeriods = [...periods];
			let newTransactions = [...transactions];
			let iter = latestMonth;
			while (iter < currentMonth) {
				const prevMonth = iter;
				iter = addMonthsToMonth(iter, 1);
				updatedPeriods.push({
					month: iter,
					openingBalance: 0
				});

				// Copiar movimientos recurrentes del mes previo al nuevo mes iterado
				const recurringTxsInPrev = newTransactions.filter(
					(t) => t.date.substring(0, 7) === prevMonth && t.recurrence === 'recurring'
				);
				const cloned = recurringTxsInPrev.map((t) => ({
					...t,
					id: `${t.id}-${iter}`,
					date: getValidDateForMonth(iter, t.date.substring(8, 10)),
					originId: t.originId || t.id
				}));
				newTransactions = [...cloned, ...newTransactions];
			}
			setPeriods(updatedPeriods);
			setTransactions(newTransactions);
		}
	}, [periods, transactions]);

	// === CÁLCULOS FINANCIEROS (SISTEMA FRANCÉS - TIN / TAE) ===
	const getMonthlyRate = (annualRate: NumericInput, mode: RateMode) => {
		const r = toNumber(annualRate) / 100;
		if (r <= 0) return 0;
		return mode === 'tin' ? r / 12 : (1 + r) ** (1 / 12) - 1;
	};

	const calculateMonthlyPayment = (
		principal: NumericInput,
		annualRate: NumericInput,
		months: NumericInput,
		mode: RateMode = 'tae'
	): number => {
		const p = toNumber(principal);
		const m = Math.trunc(toNumber(months));
		const monthlyRate = getMonthlyRate(annualRate, mode);

		if (!p || !m || m <= 0) return 0;
		if (monthlyRate === 0) return p / m;
		const payment = p * (monthlyRate / (1 - (1 + monthlyRate) ** -m));
		return Number.isNaN(payment) ? 0 : payment;
	};

	const getDebtRateMode = (debt: ClassicDebt): RateMode => (hasTin(debt) ? 'tin' : 'tae');

	const getPaymentPlanDueInstallments = (debt: PaymentPlanDebt, month: string) => {
		return debt.installments.filter(
			(installment) => installment.status === 'pending' && normalizeMonth(installment.dueMonth) <= month
		);
	};

	const getPaymentPlanCashflowForMonth = (debt: PaymentPlanDebt, month: string) => {
		return getPaymentPlanDueInstallments(debt, month).reduce((sum, installment) => sum + installment.amount, 0);
	};

	const getPaymentPlanOverdueAmount = (debt: PaymentPlanDebt, month: string) => {
		return debt.installments
			.filter((installment) => installment.status === 'pending' && normalizeMonth(installment.dueMonth) < month)
			.reduce((sum, installment) => sum + installment.amount, 0);
	};

	const calculateDebtMonthlyPayment = (debt: Debt, month = selectedMonth) => {
		if (isPaymentPlanDebt(debt)) {
			return getPaymentPlanCashflowForMonth(debt, month);
		}

		return calculateMonthlyPayment(
			debt.principal,
			hasTin(debt) ? toNumber(debt.tin) : debt.tae,
			debt.termMonths,
			getDebtRateMode(debt)
		);
	};

	const generateAmortizationSchedule = (debt: ClassicDebt): AmortizationRow[] => {
		const p = toNumber(debt.principal);
		const m = Math.trunc(toNumber(debt.termMonths));
		const monthlyRate = getMonthlyRate(hasTin(debt) ? toNumber(debt.tin) : debt.tae, getDebtRateMode(debt));
		const cuota = calculateDebtMonthlyPayment(debt);

		let remainingPrincipal = p;
		const schedule: AmortizationRow[] = [];

		for (let i = 1; i <= m; i++) {
			const interestPayment = remainingPrincipal * monthlyRate;
			const principalPaid = cuota - interestPayment;
			remainingPrincipal = Math.max(0, remainingPrincipal - principalPaid);

			schedule.push({
				month: i,
				cuota,
				principalPaid,
				interestPayment,
				remainingPrincipal
			});
		}
		return schedule;
	};

	// === FILTRADO POR MES Y LÍNEA DE TIEMPO (BALANCES ACUMULADOS) ===
	type MonthBalanceData = {
		month: string;
		openingBalance: number;
		incomes: number;
		expenses: number;
		debtPayments: number;
		netBalance: number;
		closingBalance: number;
		accountBalances: Record<string, number>;
	};

	const sortedPeriods = [...periods].sort((a, b) => a.month.localeCompare(b.month));

	const getTransactionOwner = (t: Transaction) => {
		if (t.owner) return t.owner;
		if (t.accountId) {
			const acc = accounts.find((a) => a.id === t.accountId);
			if (acc) return acc.owner;
		}
		return 'joint';
	};

	const getEffectiveAmount = (t: Transaction) => {
		const owner = getTransactionOwner(t);
		if (viewMode === 'all') return toNumber(t.amount);
		if (viewMode === 'userA') {
			if (owner === 'userA') return toNumber(t.amount);
			if (owner === 'joint') return toNumber(t.amount) * 0.5;
			return 0;
		}
		if (viewMode === 'userB') {
			if (owner === 'userB') return toNumber(t.amount);
			if (owner === 'joint') return toNumber(t.amount) * 0.5;
			return 0;
		}
		return 0;
	};
	
	const timelineBalances: Record<string, MonthBalanceData> = {};

	// Running balances that propagate across periods
	const runningAccountBalances: Record<string, number> = {};
	accounts.forEach((acc) => {
		runningAccountBalances[acc.id] = acc.initialBalance;
	});

	const runningUnassignedBalances: Record<'userA' | 'userB' | 'joint', number> = {
		userA: 0,
		userB: 0,
		joint: 0
	};

	sortedPeriods.forEach((period, idx) => {
		const m = period.month;

		// 1. Capture opening balance of this month
		const openingAccBalances = { ...runningAccountBalances };
		const openingUnassigned = { ...runningUnassignedBalances };

		// 2. Process all transactions of this month
		const mTx = transactions.filter((t) => t.date.substring(0, 7) === m);

		mTx.forEach((t) => {
			const amount = toNumber(t.amount);
			if (t.type === 'income') {
				if (t.accountId && runningAccountBalances[t.accountId] !== undefined) {
					runningAccountBalances[t.accountId] += amount;
				} else {
					runningUnassignedBalances[t.owner || 'joint'] += amount;
				}
			} else if (t.type === 'expense') {
				if (t.accountId && runningAccountBalances[t.accountId] !== undefined) {
					runningAccountBalances[t.accountId] -= amount;
				} else {
					runningUnassignedBalances[t.owner || 'joint'] -= amount;
				}
			} else if (t.type === 'transfer') {
				if (t.fromAccountId && runningAccountBalances[t.fromAccountId] !== undefined) {
					runningAccountBalances[t.fromAccountId] -= amount;
				}
				if (t.toAccountId && runningAccountBalances[t.toAccountId] !== undefined) {
					runningAccountBalances[t.toAccountId] += amount;
				}
			}
		});

		// 3. Process all debt payments of this month
		debts.forEach((d) => {
			const dStart = normalizeMonth(d.date);
			let rawPayment = 0;
			if (isPaymentPlanDebt(d)) {
				if (dStart <= m) {
					rawPayment = calculateDebtMonthlyPayment(d, m);
				}
			} else {
				const dEnd = addMonthsToMonth(dStart, d.termMonths - 1);
				if (m >= dStart && m <= dEnd) {
					rawPayment = calculateDebtMonthlyPayment(d, m);
				}
			}

			if (rawPayment > 0) {
				if (d.paymentAccountId && runningAccountBalances[d.paymentAccountId] !== undefined) {
					runningAccountBalances[d.paymentAccountId] -= rawPayment;
				} else {
					// Fallback to first account of this owner, or unassigned
					const fallbackAcc = accounts.find((a) => a.owner === d.owner);
					if (fallbackAcc) {
						runningAccountBalances[fallbackAcc.id] -= rawPayment;
					} else {
						runningUnassignedBalances[d.owner || 'joint'] -= rawPayment;
					}
				}
			}
		});

		// 4. Helper to calculate balances for the current viewMode
		const getModeBalance = (
			accBals: Record<string, number>,
			unassignedBals: Record<'userA' | 'userB' | 'joint', number>
		) => {
			let total = 0;
			accounts.forEach((acc) => {
				const bal = accBals[acc.id] ?? 0;
				if (viewMode === 'all') {
					total += bal;
				} else if (viewMode === 'userA') {
					if (acc.owner === 'userA') total += bal;
					else if (acc.owner === 'joint') total += bal * 0.5;
				} else if (viewMode === 'userB') {
					if (acc.owner === 'userB') total += bal;
					else if (acc.owner === 'joint') total += bal * 0.5;
				}
			});

			if (viewMode === 'all') {
				total += unassignedBals.userA + unassignedBals.userB + unassignedBals.joint;
			} else if (viewMode === 'userA') {
				total += unassignedBals.userA + unassignedBals.joint * 0.5;
			} else if (viewMode === 'userB') {
				total += unassignedBals.userB + unassignedBals.joint * 0.5;
			}
			return total;
		};

		// 5. Calculate summary fields for viewMode
		const openingBalance = getModeBalance(openingAccBalances, openingUnassigned);
		const closingBalance = getModeBalance(runningAccountBalances, runningUnassignedBalances);

		const incomes = mTx
			.filter((t) => t.type === 'income')
			.reduce((sum, t) => sum + getEffectiveAmount(t), 0);
		const expenses = mTx
			.filter((t) => t.type === 'expense')
			.reduce((sum, t) => sum + getEffectiveAmount(t), 0);

		const getEffectiveDebtPayment = (d: Debt, rawPayment: number) => {
			const owner = d.owner ?? 'joint';
			if (viewMode === 'all') return rawPayment;
			if (viewMode === 'userA') {
				if (owner === 'userA') return rawPayment;
				if (owner === 'joint') return rawPayment * 0.5;
				return 0;
			}
			if (viewMode === 'userB') {
				if (owner === 'userB') return rawPayment;
				if (owner === 'joint') return rawPayment * 0.5;
				return 0;
			}
			return 0;
		};

		const debtPayments = debts.reduce((sum, d) => {
			const dStart = normalizeMonth(d.date);
			let rawPayment = 0;
			if (isPaymentPlanDebt(d)) {
				if (dStart <= m) {
					rawPayment = calculateDebtMonthlyPayment(d, m);
				}
			} else {
				const dEnd = addMonthsToMonth(dStart, d.termMonths - 1);
				if (m >= dStart && m <= dEnd) {
					rawPayment = calculateDebtMonthlyPayment(d, m);
				}
			}
			return sum + getEffectiveDebtPayment(d, rawPayment);
		}, 0);

		// Net balance representing the actual month cash change for view mode
		const netBalance = closingBalance - openingBalance;

		timelineBalances[m] = {
			month: m,
			openingBalance,
			incomes,
			expenses,
			debtPayments,
			netBalance,
			closingBalance,
			accountBalances: { ...runningAccountBalances }
		};
	});

	const activePeriodData = timelineBalances[selectedMonth] ?? {
		month: selectedMonth,
		openingBalance: 0,
		incomes: 0,
		expenses: 0,
		debtPayments: 0,
		netBalance: 0,
		closingBalance: 0
	};

	const totalIncomes = activePeriodData.incomes;
	const totalExpenses = activePeriodData.expenses;
	const totalMonthlyDebtPayments = activePeriodData.debtPayments;
	const netMonthlyBalance = activePeriodData.netBalance;
	const currentOpeningBalance = activePeriodData.openingBalance;
	const currentClosingBalance = activePeriodData.closingBalance;

	const filteredTransactions = transactions.filter((t) => t.date.substring(0, 7) === selectedMonth);

	const recurringIncomes = filteredTransactions
		.filter((t) => t.type === 'income' && t.recurrence === 'recurring')
		.reduce((sum, t) => sum + getEffectiveAmount(t), 0);

	const oneOffIncomes = filteredTransactions
		.filter((t) => t.type === 'income' && t.recurrence !== 'recurring')
		.reduce((sum, t) => sum + getEffectiveAmount(t), 0);

	const recurringExpenses = filteredTransactions
		.filter((t) => t.type === 'expense' && t.recurrence === 'recurring')
		.reduce((sum, t) => sum + getEffectiveAmount(t), 0);

	const oneOffExpenses = filteredTransactions
		.filter((t) => t.type === 'expense' && t.recurrence !== 'recurring')
		.reduce((sum, t) => sum + getEffectiveAmount(t), 0);

	// Deudas activas en el mes seleccionado (excluyendo expiradas y futuras)
	const filteredDebts = debts.filter((d) => {
		const start = normalizeMonth(d.date);
		if (start > selectedMonth) return false;
		if (isClassicDebt(d)) {
			const end = addMonthsToMonth(start, d.termMonths - 1);
			return selectedMonth <= end;
		}
		// Para planes de pago, siguen activas si queda saldo pendiente o hay vencimientos
		return getPaymentPlanRemainingAmount(d) > 0 || getPaymentPlanOverdueAmount(d, selectedMonth) > 0;
	});

	// Gastos conjuntos pagados por cada uno (en el mes activo)
	const jointPaidByA = filteredTransactions
		.filter((t) => t.type === 'expense' && t.owner === 'joint' && t.paidBy === 'userA')
		.reduce((sum, t) => sum + toNumber(t.amount), 0);

	const jointPaidByB = filteredTransactions
		.filter((t) => t.type === 'expense' && t.owner === 'joint' && t.paidBy === 'userB')
		.reduce((sum, t) => sum + toNumber(t.amount), 0);

	const netOwed = (jointPaidByA - jointPaidByB) / 2;

	// === GESTORES DE ACCIONES ===
	const handleInitAccount = (e: SyntheticEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (isReconfiguring) {
			setAccounts(reconfigAccounts);
		}
		
		const totalBalance = (isReconfiguring ? reconfigAccounts : accounts).reduce((sum, a) => sum + (a.initialBalance || 0), 0);

		const targetMonth = initFlow === 'current' ? new Date().toISOString().substring(0, 7) : initMonth;
		const newPeriod: Period = {
			month: targetMonth,
			openingBalance: totalBalance,
			isManualInit: true
		};
		setPeriods([newPeriod]);
		setSelectedMonth(targetMonth);
		setIsReconfiguring(false);
	};

	const handleResetAccount = () => {
		if (window.confirm('¿Estás seguro de que querés reiniciar toda la cuenta? Se borrarán todas las transacciones, deudas y períodos.')) {
			setPeriods([]);
			setTransactions([]);
			setDebts([]);
			setAccounts([
				{ id: 'default-a', name: `Efectivo ${userAName}`, owner: 'userA', initialBalance: 0 },
				{ id: 'default-b', name: `Efectivo ${userBName}`, owner: 'userB', initialBalance: 0 },
				{ id: 'default-joint', name: 'Cuenta Común', owner: 'joint', initialBalance: 0 }
			]);
			setSelectedMonth(new Date().toISOString().substring(0, 7));
			setIsReconfiguring(false);
		}
	};

	const handleCreateNextMonth = () => {
		if (periods.length === 0) return;
		const sorted = [...periods].sort((a, b) => a.month.localeCompare(b.month));
		const latestMonth = sorted[sorted.length - 1].month;
		const nextMonth = addMonthsToMonth(latestMonth, 1);
		
		if (periods.some((p) => p.month === nextMonth)) {
			setSelectedMonth(nextMonth);
			return;
		}

		const newPeriod: Period = {
			month: nextMonth,
			openingBalance: 0
		};

		// Copiar movimientos recurrentes del último mes al nuevo
		const recurringTxsInLatest = transactions.filter(
			(t) => t.date.substring(0, 7) === latestMonth && t.recurrence === 'recurring'
		);
		const cloned = recurringTxsInLatest.map((t) => ({
			...t,
			id: `${t.id}-${nextMonth}`,
			date: getValidDateForMonth(nextMonth, t.date.substring(8, 10)),
			originId: t.originId || t.id
		}));

		setPeriods([...periods, newPeriod]);
		if (cloned.length > 0) {
			setTransactions((prev) => [...cloned, ...prev]);
		}
		setSelectedMonth(nextMonth);
	};

	const handleAddTransaction = (e: SyntheticEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!txForm.desc || !txForm.amount) return;

		const getTransferOwner = (fromId?: string, toId?: string) => {
			const fromAcc = accounts.find((a) => a.id === fromId);
			const toAcc = accounts.find((a) => a.id === toId);
			if (fromAcc && toAcc) {
				if (fromAcc.owner === toAcc.owner) return fromAcc.owner;
			}
			return 'joint';
		};

		const getEffectiveOwner = () => {
			if (txForm.type === 'transfer') {
				return getTransferOwner(txForm.fromAccountId, txForm.toAccountId);
			}
			return txForm.owner;
		};

		const getEffectivePaidBy = (effectiveOwner: 'userA' | 'userB' | 'joint') => {
			if (effectiveOwner !== 'joint') {
				return 'shared';
			}
			if (txForm.type !== 'transfer' && txForm.accountId) {
				const acc = accounts.find((a) => a.id === txForm.accountId);
				if (acc) {
					if (acc.owner === 'userA') return 'userA';
					if (acc.owner === 'userB') return 'userB';
					return 'shared';
				}
			}
			return txForm.paidBy;
		};

		const newTxId = Date.now().toString();
		const effectiveOwner = getEffectiveOwner();
		const effectivePaidBy = getEffectivePaidBy(effectiveOwner);
		const newTx: Transaction = {
			id: newTxId,
			desc: txForm.desc,
			amount: Math.abs(parseFloat(txForm.amount)),
			type: txForm.type,
			tag: txForm.tag,
			date: txForm.date,
			recurrence: txForm.recurrence || 'one-off',
			owner: effectiveOwner,
			paidBy: effectivePaidBy,
			accountId: txForm.type !== 'transfer' && txForm.accountId ? txForm.accountId : undefined,
			fromAccountId: txForm.type === 'transfer' ? txForm.fromAccountId : undefined,
			toAccountId: txForm.type === 'transfer' ? txForm.toAccountId : undefined
		};

		let newTransactions = [newTx, ...transactions];

		// Si es recurrente, propagar a todos los meses futuros que ya existan en periods
		if (newTx.recurrence === 'recurring') {
			const currentMonth = newTx.date.substring(0, 7);
			const dayPart = newTx.date.substring(8, 10);
			const futureMonths = periods
				.map((p) => p.month)
				.filter((m) => m > currentMonth)
				.sort();

			const propagatedClones: Transaction[] = [];
			futureMonths.forEach((m) => {
				const cloneId = `${newTxId}-${m}`;
				propagatedClones.push({
					...newTx,
					id: cloneId,
					date: getValidDateForMonth(m, dayPart),
					originId: newTxId
				});
			});
			newTransactions = [...propagatedClones, ...newTransactions];
		}

		setTransactions(newTransactions);
		// Mantener la fecha del filtro actual para usabilidad
		setTxForm({
			...txForm,
			desc: '',
			amount: '',
			recurrence: 'one-off'
		});
	};

	const handleStartEditTransaction = (tx: Transaction) => {
		setEditingTx(tx);
		setEditForm({
			desc: tx.desc,
			amount: String(tx.amount),
			type: tx.type,
			tag: tx.tag,
			date: tx.date,
			recurrence: tx.recurrence || 'one-off',
			owner: tx.owner || 'joint',
			paidBy: tx.paidBy || 'shared',
			accountId: tx.accountId || '',
			fromAccountId: tx.fromAccountId || (accounts[0]?.id || ''),
			toAccountId: tx.toAccountId || (accounts[1]?.id || accounts[0]?.id || '')
		});
		setEditScope('only-this');
	};

	const handleSaveEditTransaction = (e: SyntheticEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!editingTx || !editForm.desc || !editForm.amount) return;

		const updatedAmount = Math.abs(parseFloat(editForm.amount));
		const rootId = editingTx.originId || editingTx.id;
		const currentMonth = editingTx.date.substring(0, 7);

		const getTransferOwner = (fromId?: string, toId?: string) => {
			const fromAcc = accounts.find((a) => a.id === fromId);
			const toAcc = accounts.find((a) => a.id === toId);
			if (fromAcc && toAcc) {
				if (fromAcc.owner === toAcc.owner) return fromAcc.owner;
			}
			return 'joint';
		};

		const getEffectiveOwner = () => {
			if (editForm.type === 'transfer') {
				return getTransferOwner(editForm.fromAccountId, editForm.toAccountId);
			}
			return editForm.owner;
		};

		const getEffectivePaidBy = (effectiveOwner: 'userA' | 'userB' | 'joint') => {
			if (effectiveOwner !== 'joint') {
				return 'shared';
			}
			if (editForm.type !== 'transfer' && editForm.accountId) {
				const acc = accounts.find((a) => a.id === editForm.accountId);
				if (acc) {
					if (acc.owner === 'userA') return 'userA';
					if (acc.owner === 'userB') return 'userB';
					return 'shared';
				}
			}
			return editForm.paidBy;
		};

		const effectiveOwner = getEffectiveOwner();
		const effectivePaidBy = getEffectivePaidBy(effectiveOwner);
		const updatedFields = {
			desc: editForm.desc,
			type: editForm.type,
			tag: editForm.tag,
			owner: effectiveOwner,
			paidBy: effectivePaidBy,
			accountId: editForm.type !== 'transfer' && editForm.accountId ? editForm.accountId : undefined,
			fromAccountId: editForm.type === 'transfer' ? editForm.fromAccountId : undefined,
			toAccountId: editForm.type === 'transfer' ? editForm.toAccountId : undefined
		};

		setTransactions((prev) =>
			prev.map((t) => {
				const isTarget = t.id === editingTx.id;
				
				if (editingTx.recurrence === 'recurring') {
					if (editScope === 'only-this') {
						if (isTarget) {
							// Se desvincula de la recurrencia convirtiéndose en puntual
							return {
								...t,
								...updatedFields,
								amount: updatedAmount,
								date: editForm.date,
								recurrence: 'one-off',
								originId: undefined
							};
						}
					} else if (editScope === 'future') {
						const isFutureOccurrence =
							t.id === editingTx.id ||
							(t.originId === rootId && t.date.substring(0, 7) >= currentMonth);
						if (isFutureOccurrence) {
							// Se actualiza el importe y campos pero manteniendo la recurrencia
							return {
								...t,
								...updatedFields,
								amount: updatedAmount,
								date: t.id === editingTx.id ? editForm.date : t.date
							};
						}
					} else if (editScope === 'all') {
						const isAnyOccurrence = t.id === rootId || t.originId === rootId;
						if (isAnyOccurrence) {
							return {
								...t,
								...updatedFields,
								amount: updatedAmount,
								date: t.id === editingTx.id ? editForm.date : t.date
							};
						}
					}
				} else {
					// Movimiento no recurrente puntual
					if (isTarget) {
						return {
							...t,
							...updatedFields,
							amount: updatedAmount,
							date: editForm.date,
							recurrence: editForm.recurrence || 'one-off'
						};
					}
				}
				return t;
			})
		);

		setEditingTx(null);
	};

	const handleAddDebt = (e: SyntheticEvent<HTMLFormElement>) => {
		e.preventDefault();
		setDebtFormError('');

		if (!debtForm.desc) return;

		if (debtForm.kind === 'classic') {
			if (!debtForm.principal || !debtForm.tae || !debtForm.termMonths) return;

			const tin = debtForm.tin ? Math.abs(parseFloat(debtForm.tin)) : undefined;
			const newDebt: Debt = {
				id: Date.now().toString(),
				kind: 'classic',
				desc: debtForm.desc,
				principal: Math.abs(parseFloat(debtForm.principal)),
				tin,
				tae: Math.abs(parseFloat(debtForm.tae)),
				termMonths: Math.abs(parseInt(debtForm.termMonths)),
				tag: debtForm.tag,
				date: normalizeMonth(debtForm.date),
				owner: debtForm.owner,
				paymentAccountId: debtForm.paymentAccountId || undefined
			};

			setDebts([newDebt, ...debts]);
			setDebtForm({ ...debtForm, desc: '', principal: '', tin: '', tae: '', termMonths: '', owner: 'joint', paymentAccountId: '' });
			return;
		}

		if (!debtForm.financedAmount) return;

		const validTranches = debtForm.tranches.filter(
			(tranche) => toNumber(tranche.months) > 0 && toNumber(tranche.amount) > 0
		);
		if (validTranches.length === 0) {
			setDebtFormError('Agregá al menos un tramo con meses e importe mensual.');
			return;
		}

		const financedAmount = Math.abs(toNumber(debtForm.financedAmount));
		const fees = Math.abs(toNumber(debtForm.fees));
		const totalToPay = financedAmount + fees;
		const scheduleTotal = validTranches.reduce(
			(sum, tranche) => sum + Math.trunc(toNumber(tranche.months)) * Math.abs(toNumber(tranche.amount)),
			0
		);

		if (Math.abs(scheduleTotal - totalToPay) > 0.01) {
			setDebtFormError(
				`La suma de cuotas (${scheduleTotal.toFixed(2)}€) debe coincidir con el total a pagar (${totalToPay.toFixed(2)}€).`
			);
			return;
		}

		const id = Date.now().toString();
		const newDebt: Debt = {
			id,
			kind: 'paymentPlan',
			desc: debtForm.desc,
			financedAmount,
			fees,
			totalToPay,
			installments: generatePaymentPlanInstallments(id, normalizeMonth(debtForm.date), validTranches),
			tag: debtForm.tag,
			date: normalizeMonth(debtForm.date),
			owner: debtForm.owner,
			paymentAccountId: debtForm.paymentAccountId || undefined
		};

		setDebts([newDebt, ...debts]);
		setDebtForm({
			...debtForm,
			desc: '',
			financedAmount: '',
			fees: '',
			tranches: [{ id: `tranche-${Date.now()}`, months: '', amount: '' }],
			owner: 'joint',
			paymentAccountId: ''
		});
	};

	const handleDeleteTransaction = (id: string) => {
		const targetTx = transactions.find((t) => t.id === id);
		if (!targetTx) return;

		if (targetTx.recurrence === 'recurring') {
			const deleteFuture = window.confirm(
				'Este es un movimiento recurrente. ¿Querés eliminarlo también de los meses futuros?'
			);
			if (deleteFuture) {
				const rootId = targetTx.originId || targetTx.id;
				const currentMonth = targetTx.date.substring(0, 7);
				setTransactions(
					transactions.filter(
						(t) =>
							t.id !== id &&
							!(t.date.substring(0, 7) >= currentMonth && (t.id === rootId || t.originId === rootId))
					)
				);
				return;
			}
		}

		setTransactions(transactions.filter((t) => t.id !== id));
	};

	const handleDeleteDebt = (id: string) => {
		setDebts(debts.filter((d) => d.id !== id));
		setSelectedDebtsForConsolidation(selectedDebtsForConsolidation.filter((itemId) => itemId !== id));
		if (selectedDebtSchedule?.id === id) {
			setSelectedDebtSchedule(null);
		}
	};

	const handleAddAccount = (e: SyntheticEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!accountForm.name) return;

		const newAcc: Account = {
			id: Date.now().toString(),
			name: accountForm.name,
			owner: accountForm.owner,
			initialBalance: Math.abs(parseFloat(accountForm.initialBalance) || 0)
		};

		setAccounts([...accounts, newAcc]);
		setAccountForm({ name: '', owner: 'joint', initialBalance: '' });
	};

	const handleSaveEditAccount = (e: SyntheticEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!editingAccount || !accountForm.name) return;

		const updatedBalance = Math.abs(parseFloat(accountForm.initialBalance) || 0);
		setAccounts(accounts.map((acc) => {
			if (acc.id === editingAccount.id) {
				return {
					...acc,
					name: accountForm.name,
					owner: accountForm.owner,
					initialBalance: updatedBalance
				};
			}
			return acc;
		}));

		setEditingAccount(null);
		setAccountForm({ name: '', owner: 'joint', initialBalance: '' });
	};

	const handleStartEditAccount = (acc: Account) => {
		setEditingAccount(acc);
		setAccountForm({
			name: acc.name,
			owner: acc.owner,
			initialBalance: String(acc.initialBalance)
		});
	};

	const handleDeleteAccount = (id: string) => {
		if (accounts.length <= 1) {
			window.alert('Debe haber al menos una cuenta en el sistema.');
			return;
		}
		if (window.confirm('¿Estás seguro de que quieres eliminar esta cuenta? Los movimientos y deudas vinculados a ella pasarán a estar sin cuenta asociada.')) {
			setAccounts(accounts.filter((a) => a.id !== id));
			
			setTransactions((prev) =>
				prev.map((t) => {
					const updated = { ...t };
					if (t.accountId === id) updated.accountId = undefined;
					if (t.fromAccountId === id) updated.fromAccountId = undefined;
					if (t.toAccountId === id) updated.toAccountId = undefined;
					return updated;
				})
			);

			setDebts((prev) =>
				prev.map((d) => {
					if (d.paymentAccountId === id) {
						return { ...d, paymentAccountId: undefined };
					}
					return d;
				})
			);
		}
	};

	const toggleDebtSelection = (id: string) => {
		const debt = debts.find((item) => item.id === id);
		if (!debt || isPaymentPlanDebt(debt)) return;

		if (selectedDebtsForConsolidation.includes(id)) {
			setSelectedDebtsForConsolidation(selectedDebtsForConsolidation.filter((itemId) => itemId !== id));
		} else {
			setSelectedDebtsForConsolidation([...selectedDebtsForConsolidation, id]);
		}
	};

	const updatePaymentPlanTranche = (id: string, patch: Partial<PaymentPlanTrancheForm>) => {
		setDebtForm((prev) => ({
			...prev,
			tranches: prev.tranches.map((tranche) => (tranche.id === id ? { ...tranche, ...patch } : tranche))
		}));
	};

	const addPaymentPlanTranche = () => {
		setDebtForm((prev) => ({
			...prev,
			tranches: [...prev.tranches, { id: `tranche-${Date.now()}`, months: '', amount: '' }]
		}));
	};

	const removePaymentPlanTranche = (id: string) => {
		setDebtForm((prev) => ({
			...prev,
			tranches: prev.tranches.length > 1 ? prev.tranches.filter((tranche) => tranche.id !== id) : prev.tranches
		}));
	};

	const togglePaymentPlanInstallmentStatus = (debtId: string, installmentId: string) => {
		const updatedDebts: Debt[] = debts.map((debt) => {
			if (!isPaymentPlanDebt(debt) || debt.id !== debtId) return debt;
			return {
				...debt,
				installments: debt.installments.map((installment) =>
					installment.id === installmentId
						? { ...installment, status: (installment.status === 'paid' ? 'pending' : 'paid') as InstallmentStatus }
						: installment
				)
			};
		});
		setDebts(updatedDebts);
		setSelectedDebtSchedule(updatedDebts.find((debt) => debt.id === debtId) ?? null);
	};

	// Desglose de etiquetas para este mes
	const getTagBreakdown = (): TagBreakdown[] => {
		const breakdown: Record<string, number> = {};
		filteredTransactions.forEach((t) => {
			if (t.type === 'expense') {
				breakdown[t.tag] = (breakdown[t.tag] || 0) + toNumber(t.amount);
			}
		});
		filteredDebts.forEach((d) => {
			const cuota = calculateDebtMonthlyPayment(d);
			breakdown[d.tag] = (breakdown[d.tag] || 0) + cuota;
		});
		return Object.entries(breakdown).map(([tag, amount]) => ({ tag, amount }));
	};

	const tagData = getTagBreakdown();
	const maxTagAmount = tagData.length > 0 ? Math.max(...tagData.map((d) => d.amount)) : 1;

	// === SIMULACIÓN DE CONSOLIDACIÓN (RESULTADOS) ===
	const consolidatedDebtsObjects = debts.filter(
		(d): d is ClassicDebt => isClassicDebt(d) && selectedDebtsForConsolidation.includes(d.id)
	);
	const consolidatedPrincipal = consolidatedDebtsObjects.reduce((sum, d) => sum + d.principal, 0);

	const additionalCapital = toNumber(consolidationForm.extraCapital);
	const totalNewPrincipal = consolidatedPrincipal + additionalCapital;

	const currentConsolidatedMonthlySum = consolidatedDebtsObjects.reduce((sum, d) => {
		return sum + calculateDebtMonthlyPayment(d);
	}, 0);

	const currentTotalInterests = consolidatedDebtsObjects.reduce((sum, d) => {
		const cuota = calculateDebtMonthlyPayment(d);
		return sum + (cuota * d.termMonths - d.principal);
	}, 0);

	const newConsolidatedCuota = calculateMonthlyPayment(
		totalNewPrincipal,
		toNumber(consolidationForm.tae),
		Math.trunc(toNumber(consolidationForm.termMonths || '1'))
	);

	const newTotalConsolidatedPayment = newConsolidatedCuota * Math.trunc(toNumber(consolidationForm.termMonths || '1'));
	const newConsolidatedInterests = Math.max(0, newTotalConsolidatedPayment - totalNewPrincipal);

	const describeDebtForPrompt = (debt: Debt) => {
		const ownerLabel = debt.owner === 'userA' ? userAName : debt.owner === 'userB' ? userBName : 'Conjunta';
		if (isClassicDebt(debt)) {
			return `- ${debt.desc} (Propietario: ${ownerLabel}, Fecha Inicio: ${debt.date}): Préstamo clásico. Capital: ${debt.principal}€, ${getDebtRateLabel(debt)}, Plazo: ${debt.termMonths} meses, Cuota: ${calculateDebtMonthlyPayment(debt).toFixed(2)}€`;
		}

		return `- ${debt.desc} (Propietario: ${ownerLabel}, Fecha Inicio: ${debt.date}): Fraccionamiento manual. Importe financiado: ${debt.financedAmount}€, comisiones/intereses: ${debt.fees}€, total pactado: ${debt.totalToPay}€, pendiente: ${getPaymentPlanRemainingAmount(debt).toFixed(2)}€, vencido a ${selectedMonth}: ${getPaymentPlanOverdueAmount(debt, selectedMonth).toFixed(2)}€, flujo exigible este mes: ${calculateDebtMonthlyPayment(debt).toFixed(2)}€`;
	};

	// === INTEGRACIÓN CON GEMINI ===
	const handleAskGemini = async (questionText: string) => {
		if (!geminiApiKey) {
			setAiError('Por favor, introduce tu API Key de Gemini en el apartado correspondiente.');
			return;
		}
		if (!questionText.trim()) return;

		setAiLoading(true);
		setAiError('');

		const userMsg: ChatMessage = {
			role: 'user',
			content: questionText,
			timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
		};
		const updatedMessages = [...chatMessages, userMsg];
		setChatMessages(updatedMessages);
		setCustomQuestion('');

		const activeKey = geminiApiKey;
		const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${activeKey}`;

		const financeDataPrompt = `
      Eres un analista financiero experto. Analiza el flujo de caja, balance neto, listado detallado de movimientos (inspecciona los conceptos/descripciones de las transacciones para deducir/corregir si alguna categoría/etiqueta es incorrecta o sugerir mejores agrupaciones) y deudas (tanto activas como futuras, prestando especial atención a préstamos o fraccionamientos que empiecen en meses futuros). Ofrece una respuesta directa, concisa y altamente práctica. Utiliza un formato limpio (negritas, viñetas) y da siempre una crítica rigurosa de los riesgos ocultos en plazos de deudas.

      CRUCIAL SOBRE RECURRENCIA: Distingue claramente entre ingresos/gastos recurrentes (mensuales/habituales) y puntuales/extraordinarios (one-off, como cancelaciones de deudas puntuales, compras de una sola vez, etc.). Al proyectar el flujo de caja de meses futuros o evaluar la salud financiera a largo plazo, NO asumas que los gastos o ingresos puntuales/extraordinarios se repetirán en los siguientes periodos. Basa tus recomendaciones de ahorro y presupuesto sobre la base de ingresos y gastos recurrentes.

      Contexto financiero mensual actual de la aplicación (para dos usuarios conjuntos):

      - Nombres de los Usuarios: ${userAName} y ${userBName}
      - Vista activa analizada: ${viewMode === 'all' ? 'Conjunta' : viewMode === 'userA' ? `Individual de ${userAName}` : `Individual de ${viewMode === 'userB' ? userBName : ''}`}
      - Mes Analizado: ${selectedMonth}
      - Total Ingresos (en esta vista): ${totalIncomes.toFixed(2)}€ (Ingresos Recurrentes: ${recurringIncomes.toFixed(2)}€, Ingresos Puntuales: ${oneOffIncomes.toFixed(2)}€)
      - Total Gastos (en esta vista, excluyendo cuotas de deudas): ${totalExpenses.toFixed(2)}€ (Gastos Recurrentes: ${recurringExpenses.toFixed(2)}€, Gastos Puntuales: ${oneOffExpenses.toFixed(2)}€)
      - Cuota Total Deudas Actuales (en esta vista): ${totalMonthlyDebtPayments.toFixed(2)}€
      - Balance Neto Mensual Disponible (en esta vista): ${netMonthlyBalance.toFixed(2)}€

      Estado de Cuentas Conjuntas para el mes:
      - Gastos conjuntos pagados por ${userAName}: ${jointPaidByA.toFixed(2)}€
      - Gastos conjuntos pagados por ${userBName}: ${jointPaidByB.toFixed(2)}€
      - Liquidación: ${netOwed === 0 ? 'Cuentas al día' : netOwed > 0 ? `${userBName} debe a ${userAName} ${netOwed.toFixed(2)}€` : `${userAName} debe a ${userBName} ${Math.abs(netOwed).toFixed(2)}€`}

      Lista de Gastos Agrupados por Etiqueta (en esta vista):
      ${tagData.map((t) => `- ${t.tag}: ${t.amount.toFixed(2)}€`).join('\n')}

      Listado Detallado de Movimientos (Ingresos y Gastos) de este mes:
      ${filteredTransactions.length > 0
        ? filteredTransactions.map((t) => `- Concepto: "${t.desc}", Importe: ${t.amount.toFixed(2)}€, Tipo: ${t.type}, Frecuencia: ${t.recurrence === 'recurring' ? 'Recurrente' : 'Puntual/Único'}, Etiqueta/Categoría actual: "${t.tag}", Propietario: ${t.owner}`).join('\n')
        : 'No hay movimientos registrados para este mes.'
      }

      Deudas Registradas (Activas, futuras o pasadas):
      ${debts.length > 0 
        ? debts.map((d) => {
            const isActive = filteredDebts.some((fd) => fd.id === d.id);
            const isFuture = d.date > selectedMonth;
            const status = isActive ? 'Activa este mes' : isFuture ? `Futura (empieza en ${d.date})` : 'Finalizada o inactiva en este mes';
            return `${describeDebtForPrompt(d)} [Estado en ${selectedMonth}: ${status}]`;
          }).join('\n')
        : 'No hay deudas registradas.'
      }

      Simulación de Reunificación Actual con Ampliación de Capital:
      ${
				consolidatedDebtsObjects.length > 0
					? `
        - Uniendo ${consolidatedDebtsObjects.length} préstamos clásicos por capital conjunto de ${consolidatedPrincipal.toFixed(2)}€.
        - Capital adicional / nuevo dinero solicitado: ${additionalCapital.toFixed(2)}€.
        - Capital total del nuevo préstamo simulado: ${totalNewPrincipal.toFixed(2)}€.
        - Cuotas individuales sumadas: ${currentConsolidatedMonthlySum.toFixed(2)}€/mes (Intereses acumulados actuales: ${currentTotalInterests.toFixed(2)}€).
        - Propuesta nueva reunificada: Plazo de ${consolidationForm.termMonths} meses con un TAE de ${consolidationForm.tae}%.
        - Nueva cuota resultante: ${newConsolidatedCuota.toFixed(2)}€/mes (Nuevos intereses totales: ${newConsolidatedInterests.toFixed(2)}€).
      `
					: 'No se ha configurado simulación de reunificación de deudas actualmente.'
			}
    `;

		const payload = {
			contents: updatedMessages.map((msg) => ({
				role: msg.role,
				parts: [{ text: msg.content }]
			})),
			systemInstruction: {
				parts: [
					{
						text: financeDataPrompt
					}
				]
			}
		};

		let delay = 1000;
		let success = false;
		let fetchedText = '';

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
				fetchedText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No se ha obtenido respuesta de Gemini.';
				success = true;
				break;
			} catch (error: any) {
				if (attempt === 5) {
					setAiError(`Error tras 5 intentos: ${error.message}`);
					setAiLoading(false);
					return;
				}
				await new Promise((resolve) => setTimeout(resolve, delay));
				delay *= 2;
			}
		}

		if (success) {
			const aiMsg: ChatMessage = {
				role: 'model',
				content: fetchedText,
				timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
			};
			setChatMessages((prev) => [...prev, aiMsg]);
			setAiLoading(false);
		}
	};

	const handleClearChat = () => {
		if (window.confirm('¿Seguro que quieres borrar el historial de la conversación?')) {
			setChatMessages([]);
			localStorage.removeItem(STORAGE_KEYS.aiChat);
		}
	};

	const paymentPlanTotalToPay = Math.abs(toNumber(debtForm.financedAmount)) + Math.abs(toNumber(debtForm.fees));
	const paymentPlanScheduleTotal = debtForm.tranches.reduce(
		(sum, tranche) => sum + Math.trunc(toNumber(tranche.months)) * Math.abs(toNumber(tranche.amount)),
		0
	);
	const paymentPlanScheduleDiff = paymentPlanScheduleTotal - paymentPlanTotalToPay;

	return (
		<div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-indigo-500 selection:text-white">
			{/* HEADER DE LA APP */}
			<header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-30">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
					<div className="flex items-center space-x-3">
						<div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
							<span className="font-black text-white text-lg">%</span>
						</div>
						<div>
							<h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
								FinanzasPro
							</h1>
							<p className="text-xs text-slate-500">Gestor de Flujo de Caja, Préstamos y Fraccionamientos</p>
						</div>
					</div>

					{/* Selector de Pestañas Principal */}
					<nav className="hidden md:flex bg-slate-800/60 p-1 rounded-xl border border-slate-700/50">
						<button
							onClick={() => {
								setActiveTab('overview');
								setSelectedDebtSchedule(null);
							}}
							className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
								activeTab === 'overview' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
							}`}
						>
							Resumen General
						</button>
						<button
							onClick={() => {
								setActiveTab('transactions');
								setSelectedDebtSchedule(null);
							}}
							className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
								activeTab === 'transactions' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
							}`}
						>
							Gastos y Cobros
						</button>
						<button
							onClick={() => {
								setActiveTab('debts');
								setSelectedDebtSchedule(null);
							}}
							className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
								activeTab === 'debts' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
							}`}
						>
							Deudas
						</button>
						<button
							onClick={() => {
								setActiveTab('accounts');
								setSelectedDebtSchedule(null);
							}}
							className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
								activeTab === 'accounts' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
							}`}
						>
							Cuentas
						</button>
						<button
							onClick={() => {
								setActiveTab('consolidation');
								setSelectedDebtSchedule(null);
							}}
							className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
								activeTab === 'consolidation' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
							}`}
						>
							Reunificación
						</button>
						<button
							onClick={() => {
								setActiveTab('ai');
								setSelectedDebtSchedule(null);
							}}
							className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
								activeTab === 'ai' ? 'bg-slate-700 text-indigo-300 shadow-sm' : 'text-slate-400 hover:text-white'
							}`}
						>
							<Icons.Sparkles /> Asesor Gemini
						</button>
					</nav>

				</div>
			</header>

			{/* MENÚ MÓVIL RESPONSIVO */}
			<div className="md:hidden flex justify-around bg-slate-900 border-b border-slate-800 p-2 text-xs">
				<button
					onClick={() => setActiveTab('overview')}
					className={`p-2 rounded ${activeTab === 'overview' ? 'text-indigo-400 font-bold' : 'text-slate-400'}`}
				>
					Resumen
				</button>
				<button
					onClick={() => setActiveTab('transactions')}
					className={`p-2 rounded ${activeTab === 'transactions' ? 'text-indigo-400 font-bold' : 'text-slate-400'}`}
				>
					Movs
				</button>
				<button
					onClick={() => setActiveTab('debts')}
					className={`p-2 rounded ${activeTab === 'debts' ? 'text-indigo-400 font-bold' : 'text-slate-400'}`}
				>
					Deudas
				</button>
				<button
					onClick={() => setActiveTab('accounts')}
					className={`p-2 rounded ${activeTab === 'accounts' ? 'text-indigo-400 font-bold' : 'text-slate-400'}`}
				>
					Cuentas
				</button>
				<button
					onClick={() => setActiveTab('consolidation')}
					className={`p-2 rounded ${activeTab === 'consolidation' ? 'text-indigo-400 font-bold' : 'text-slate-400'}`}
				>
					Reunificar
				</button>
				<button
					onClick={() => setActiveTab('ai')}
					className={`p-2 rounded flex items-center gap-1 ${activeTab === 'ai' ? 'text-indigo-400 font-bold' : 'text-slate-400'}`}
				>
					<Icons.Sparkles /> IA
				</button>
			</div>

			{/* CUERPO PRINCIPAL */}
			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{periods.length === 0 ? (
					<div className="max-w-md mx-auto my-12 bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-3xl p-8 shadow-2xl">
						<div className="text-center mb-8">
							<div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
								<span className="font-black text-white text-2xl">%</span>
							</div>
							<h2 className="text-2xl font-black bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
								Bienvenido a FinanzasPro
							</h2>
							<p className="text-xs text-slate-400 mt-2 leading-relaxed">
								Establecé el inicio de tu cronología y balance para comenzar a planificar tus finanzas.
							</p>
						</div>

						<form onSubmit={handleInitAccount} className="space-y-6">
							<div>
								<label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Flujo de Inicio</label>
								<div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
									<button
										type="button"
										onClick={() => {
											setInitFlow('current');
											setInitMonth(currentMonthString);
										}}
										className={`py-2.5 rounded-lg text-xs font-bold transition-all ${
											initFlow === 'current'
												? 'bg-indigo-600 text-white shadow-md'
												: 'text-slate-400 hover:text-slate-200'
										}`}
									>
										Mes en Curso
									</button>
									<button
										type="button"
										onClick={() => setInitFlow('past')}
										className={`py-2.5 rounded-lg text-xs font-bold transition-all ${
											initFlow === 'past'
												? 'bg-indigo-600 text-white shadow-md'
												: 'text-slate-400 hover:text-slate-200'
										}`}
									>
										Registrar desde el Pasado
									</button>
								</div>
							</div>

							{initFlow === 'past' ? (
								<div>
									<label htmlFor="init-month-input" className="block text-xs font-medium text-slate-400 mb-1.5">
										Seleccionar Mes de Partida
									</label>
									<input
										id="init-month-input"
										type="month"
										required
										max={currentMonthString}
										value={initMonth}
										onChange={(e) => setInitMonth(e.target.value)}
										className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 font-mono outline-none"
									/>
									<p className="text-[10px] text-slate-500 mt-1">
										Vas a poder ingresar transacciones históricas desde este mes seleccionado.
									</p>
								</div>
							) : (
								<div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400">
									<span className="font-semibold text-slate-300">Mes Activo de Inicio:</span> {currentMonthString}
									<p className="text-[10px] text-slate-500 mt-1">
										La cronología arranca directamente en el mes actual del calendario.
									</p>
								</div>
							)}

							<div className="space-y-4 border-t border-slate-800/80 pt-4">
								<h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Perfiles de Usuario</h3>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<label htmlFor="user-a-name-input" className="block text-[11px] font-medium text-slate-500 mb-1">Nombre {userAName || 'Usuario A'}</label>
										<input
											id="user-a-name-input"
											type="text"
											required
											value={userAName}
											onChange={(e) => setUserAName(e.target.value)}
											className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
										/>
									</div>
									<div>
										<label htmlFor="user-b-name-input" className="block text-[11px] font-medium text-slate-500 mb-1">Nombre {userBName || 'Usuario B'}</label>
										<input
											id="user-b-name-input"
											type="text"
											required
											value={userBName}
											onChange={(e) => setUserBName(e.target.value)}
											className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
										/>
									</div>
								</div>
							</div>

							<div className="space-y-4 border-t border-slate-800/80 pt-4">
								<h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Balances de Apertura (€)</h3>
								<div className="space-y-3">
									{accounts.map((acc, index) => (
										<div key={acc.id} className="flex flex-col">
											<label htmlFor={`init-balance-welcome-${acc.id}`} className="block text-[11px] font-medium text-slate-500 mb-1">
												Saldo inicial: {acc.name} ({acc.owner === 'userA' ? userAName : acc.owner === 'userB' ? userBName : 'Compartida'})
											</label>
											<input
												id={`init-balance-welcome-${acc.id}`}
												type="number"
												step="0.01"
												required
												min="0"
												placeholder="0.00"
												value={acc.initialBalance || ''}
												onChange={(e) => {
													const val = parseFloat(e.target.value) || 0;
													setAccounts((prev) =>
														prev.map((a, i) => (i === index ? { ...a, initialBalance: val } : a))
													);
												}}
												className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs text-slate-100 outline-none"
											/>
										</div>
									))}
								</div>
								<div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs flex justify-between items-center text-slate-400">
									<span>Total Conjunto:</span>
									<span className="font-bold text-slate-200 text-sm">
										{accounts.reduce((sum, a) => sum + (a.initialBalance || 0), 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
									</span>
								</div>
							</div>

							<button
								type="submit"
								className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-lg active:scale-95"
							>
								Inicializar Planificación
							</button>
						</form>
					</div>
				) : (
					<>
						{/* BARRA DE CONTROL DE TIEMPO Y BALANCE */}
						<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 p-4 bg-slate-900 border border-slate-800 rounded-2xl">
							<div className="flex flex-wrap items-center gap-2">
								<span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Mes Activo:</span>
								<select
									id="global-month-selector"
									value={selectedMonth}
									onChange={(e) => {
										setSelectedMonth(e.target.value);
										setTxForm((prev) => ({ ...prev, date: `${e.target.value}-01` }));
										setDebtForm((prev) => ({ ...prev, date: e.target.value }));
									}}
									className="bg-slate-950 text-slate-100 border border-slate-850 rounded-lg px-3 py-1.5 text-xs font-mono font-bold outline-none focus:border-indigo-500"
								>
									{[...periods]
										.sort((a, b) => a.month.localeCompare(b.month))
										.map((p) => (
											<option key={p.month} value={p.month}>
												{p.month}
											</option>
										))}
								</select>
								<button
									onClick={handleCreateNextMonth}
									className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-all flex items-center shadow-md shadow-indigo-600/10 active:scale-95"
									title="Crear mes siguiente bajo demanda"
								>
									<Icons.Plus /> <span>Siguiente Mes</span>
								</button>
							</div>

							<div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 self-center">
								<button
									onClick={() => setViewMode('all')}
									className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
										viewMode === 'all'
											? 'bg-indigo-600 text-white shadow-md'
											: 'text-slate-400 hover:text-slate-200'
									}`}
								>
									Conjunto
								</button>
								<button
									onClick={() => setViewMode('userA')}
									className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
										viewMode === 'userA'
											? 'bg-indigo-600 text-white shadow-md'
											: 'text-slate-400 hover:text-slate-200'
									}`}
								>
									{userAName}
								</button>
								<button
									onClick={() => setViewMode('userB')}
									className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
										viewMode === 'userB'
											? 'bg-indigo-600 text-white shadow-md'
											: 'text-slate-400 hover:text-slate-200'
									}`}
								>
									{userBName}
								</button>
							</div>

							<div>
								<button
									onClick={() => {
										const sorted = [...periods].sort((a, b) => a.month.localeCompare(b.month));
										if (sorted.length > 0) {
											setInitMonth(sorted[0].month);
											setInitFlow(sorted[0].month === currentMonthString ? 'current' : 'past');
										}
										setReconfigAccounts(accounts.map((acc) => ({ ...acc })));
										setIsReconfiguring(true);
									}}
									className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-750 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
								>
									<svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
										<path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
										<path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
									</svg>
									<span>Reconfigurar Cuenta</span>
								</button>
							</div>
						</div>

						{/* INDICADORES FINANCIEROS MENSUALES */}
				<section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
					{/* Tarjeta: Saldo de Apertura */}
					<div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 transition-all hover:border-slate-700">
						<div className="flex items-center justify-between mb-4">
							<span className="text-sm font-medium text-slate-400">Apertura ({selectedMonth})</span>
							<div className="p-2 bg-indigo-500/10 rounded-lg">
								<svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
									<path strokeLinecap="round" strokeLinejoin="round" d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20" />
								</svg>
							</div>
						</div>
						<div className="text-3xl font-bold text-slate-200">
							{currentOpeningBalance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
						</div>
						<p className="text-xs text-slate-500 mt-1">Saldo inicial del periodo</p>
					</div>

					{/* Tarjeta: Cobros / Ingresos */}
					<div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 transition-all hover:border-slate-700">
						<div className="flex items-center justify-between mb-4">
							<span className="text-sm font-medium text-slate-400">Ingresos ({selectedMonth})</span>
							<div className="p-2 bg-emerald-500/10 rounded-lg">
								<Icons.TrendingUp />
							</div>
						</div>
						<div className="text-3xl font-bold text-emerald-400">
							+{totalIncomes.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
						</div>
						<p className="text-xs text-slate-500 mt-1">
							{oneOffIncomes > 0 ? (
								`Recurrentes: +${recurringIncomes.toFixed(2)}€ | Puntuales: +${oneOffIncomes.toFixed(2)}€`
							) : (
								'Registrados para este mes'
							)}
						</p>
					</div>

					{/* Tarjeta: Gastos de Flujo Diario */}
					<div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 transition-all hover:border-slate-700">
						<div className="flex items-center justify-between mb-4">
							<span className="text-sm font-medium text-slate-400">Gastos del Mes ({selectedMonth})</span>
							<div className="p-2 bg-rose-500/10 rounded-lg">
								<Icons.TrendingDown />
							</div>
						</div>
						<div className="text-3xl font-bold text-rose-400">
							-{totalExpenses.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
						</div>
						<p className="text-xs text-slate-500 mt-1">
							{oneOffExpenses > 0 ? (
								`Recurrentes: -${recurringExpenses.toFixed(2)}€ | Puntuales: -${oneOffExpenses.toFixed(2)}€`
							) : (
								'Sin contar amortización de deudas'
							)}
						</p>
					</div>

					{/* Tarjeta: Amortización de Deudas (TIN / TAE) */}
					<div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 transition-all hover:border-slate-700">
						<div className="flex items-center justify-between mb-4">
							<div className="flex items-center space-x-1">
								<span className="text-sm font-medium text-slate-400">Pagos de Deuda</span>
								<span title="Préstamos: cuota calculada con TIN/TAE. Fraccionamientos: cuotas pendientes vencidas o exigibles hasta el mes activo.">
									<Icons.Info />
								</span>
							</div>
							<div className="p-2 bg-amber-500/10 rounded-lg">
								<Icons.CreditCard />
							</div>
						</div>
						<div className="text-3xl font-bold text-amber-500">
							-{totalMonthlyDebtPayments.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
						</div>
						<p className="text-xs text-slate-500 mt-1">Incluye cuotas activas y vencidas</p>
					</div>

					{/* Tarjeta: Saldo al Cierre (Acumulado) */}
					<div className={`bg-slate-900 border rounded-2xl p-6 transition-all hover:border-indigo-500/30 shadow-md ${currentClosingBalance >= 0 ? 'border-slate-800 hover:border-indigo-500/50' : 'border-rose-900/50 hover:border-rose-800'}`}>
						<div className="flex items-center justify-between mb-4">
							<span className="text-sm font-medium text-slate-300">Cierre ({selectedMonth})</span>
							<div className="p-2 bg-indigo-500/10 rounded-lg">
								<Icons.Scale />
							</div>
						</div>
						<div className={`text-3xl font-black ${currentClosingBalance >= 0 ? 'text-indigo-400' : 'text-rose-500'}`}>
							{currentClosingBalance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
						</div>
						<p className="text-xs text-slate-400 mt-1">
							{currentClosingBalance >= 0 ? 'Saldo neto acumulado positivo' : 'Déficit acumulado al cierre'}
						</p>
					</div>
				</section>

				{/* CONTENIDOS DE PESTAÑAS */}

				{/* 1. RESUMEN GENERAL (DASHBOARD) */}
				{activeTab === 'overview' && (
					<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
						{/* Gráfico SVG de Barras de Composición */}
						<div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6">
							<h3 className="text-lg font-semibold text-slate-200 mb-6">
								Composición del Flujo Mensual en {selectedMonth}
							</h3>

							<div className="h-64 flex items-end justify-around space-x-4 pt-4 border-b border-slate-800">
								{/* Ingresos */}
								<div className="flex flex-col items-center w-full max-w-[80px] group">
									<div className="text-xs font-bold text-emerald-400 mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
										{totalIncomes.toFixed(0)}€
									</div>
									<div
										className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-lg transition-all duration-500 hover:brightness-110"
										style={{
											height: `${Math.min(180, Math.max(8, (totalIncomes / (Math.max(totalIncomes, totalExpenses, totalMonthlyDebtPayments) || 1)) * 180))}px`
										}}
									></div>
									<span className="text-xs text-slate-400 mt-2 truncate w-full text-center">Cobros</span>
								</div>

								{/* Gastos Regulares */}
								<div className="flex flex-col items-center w-full max-w-[80px] group">
									<div className="text-xs font-bold text-rose-400 mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
										{totalExpenses.toFixed(0)}€
									</div>
									<div
										className="w-full bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-lg transition-all duration-500 hover:brightness-110"
										style={{
											height: `${Math.min(180, Math.max(8, (totalExpenses / (Math.max(totalIncomes, totalExpenses, totalMonthlyDebtPayments) || 1)) * 180))}px`
										}}
									></div>
									<span className="text-xs text-slate-400 mt-2 truncate w-full text-center">G. Comunes</span>
								</div>

								{/* Cuota Deuda */}
								<div className="flex flex-col items-center w-full max-w-[80px] group">
									<div className="text-xs font-bold text-amber-400 mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
										{totalMonthlyDebtPayments.toFixed(0)}€
									</div>
									<div
										className="w-full bg-gradient-to-t from-amber-600 to-amber-400 rounded-t-lg transition-all duration-500 hover:brightness-110"
										style={{
											height: `${Math.min(180, Math.max(8, (totalMonthlyDebtPayments / (Math.max(totalIncomes, totalExpenses, totalMonthlyDebtPayments) || 1)) * 180))}px`
										}}
									></div>
									<span className="text-xs text-slate-400 mt-2 truncate w-full text-center">Cuota Deuda</span>
								</div>

								{/* Balance Neto */}
								<div className="flex flex-col items-center w-full max-w-[80px] group">
									<div
										className={`text-xs font-bold ${netMonthlyBalance >= 0 ? 'text-indigo-400' : 'text-rose-500'} mb-2 opacity-0 group-hover:opacity-100 transition-opacity`}
									>
										{netMonthlyBalance.toFixed(0)}€
									</div>
									<div
										className={`w-full rounded-t-lg transition-all duration-500 hover:brightness-110 ${netMonthlyBalance >= 0 ? 'bg-gradient-to-t from-indigo-600 to-indigo-400' : 'bg-gradient-to-t from-rose-950 to-rose-800'}`}
										style={{
											height: `${Math.min(180, Math.max(8, (Math.abs(netMonthlyBalance) / (Math.max(totalIncomes, totalExpenses, totalMonthlyDebtPayments) || 1)) * 180))}px`
										}}
									></div>
									<span className="text-xs text-slate-400 mt-2 truncate w-full text-center">Neto</span>
								</div>
							</div>

							<div className="flex justify-between items-center mt-6 text-xs text-slate-500">
								<p>* Escala normalizada respecto al flujo mensual máximo.</p>
								<div className="flex space-x-3">
									<span className="flex items-center">
										<span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1"></span> Cobro
									</span>
									<span className="flex items-center">
										<span className="w-2.5 h-2.5 rounded-full bg-rose-500 mr-1"></span> Gasto
									</span>
									<span className="flex items-center">
										<span className="w-2.5 h-2.5 rounded-full bg-amber-500 mr-1"></span> Cuota
									</span>
								</div>
							</div>
						</div>

						{/* Desglose Acumulado por Etiquetas */}
						<div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6">
							<h3 className="text-lg font-semibold text-slate-200 mb-6">
								Desglose Acumulado por Etiquetas ({selectedMonth})
							</h3>

							{tagData.length === 0 ? (
								<div className="h-48 flex flex-col items-center justify-center text-slate-500 text-center">
									<p className="text-sm">No hay egresos ni cuotas este mes.</p>
									<p className="text-xs">Usa el menú para añadir datos o cambia de mes.</p>
								</div>
							) : (
								<div className="space-y-4 max-h-[250px] overflow-y-auto pr-2">
									{tagData.map(({ tag, amount }) => {
										const pct = ((amount / (totalExpenses + totalMonthlyDebtPayments)) * 100).toFixed(0);
										return (
											<div key={tag} className="space-y-1">
												<div className="flex justify-between text-xs font-medium text-slate-300">
													<span>{tag}</span>
													<span className="text-slate-400">
														{amount.toFixed(2)}€ ({pct}%)
													</span>
												</div>
												<div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
													<div
														className="bg-indigo-500 h-full rounded-full transition-all duration-500"
														style={{ width: `${(amount / maxTagAmount) * 100}%` }}
													></div>
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>

						{/* Tarjeta: Hacer Cuentas (Liquidación de Gastos Conjuntos) */}
						<div className="lg:col-span-12 bg-slate-900 border border-slate-800 rounded-2xl p-6">
							<h3 className="text-lg font-semibold text-slate-200 mb-2 flex items-center gap-2">
								<svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
									<path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								Cuentas del Mes ({selectedMonth})
							</h3>
							<p className="text-xs text-slate-400 mb-6">
								Desglose de los gastos comunes y quién los ha pagado para cuadrar cuentas a final de mes.
							</p>

							<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
								{/* Columna Usuario A */}
								<div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
									<div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Gastos comunes pagados por</div>
									<div className="text-xl font-bold text-slate-200">{userAName}</div>
									<div className="text-2xl font-black text-indigo-400 mt-2">{jointPaidByA.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€</div>
									<p className="text-[10px] text-slate-500 mt-1">Aportación correspondiente: {(jointPaidByA / 2).toLocaleString('es-ES', { minimumFractionDigits: 2 })}€ por persona</p>
								</div>

								{/* Columna Usuario B */}
								<div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
									<div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Gastos comunes pagados por</div>
									<div className="text-xl font-bold text-slate-200">{userBName}</div>
									<div className="text-2xl font-black text-indigo-400 mt-2">{jointPaidByB.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€</div>
									<p className="text-[10px] text-slate-500 mt-1">Aportación correspondiente: {(jointPaidByB / 2).toLocaleString('es-ES', { minimumFractionDigits: 2 })}€ por persona</p>
								</div>

								{/* Columna Liquidación */}
								<div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
									<div>
										<div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Estado de Cuentas</div>
										{netOwed === 0 ? (
											<div className="text-emerald-400 font-bold text-lg mt-2">¡Cuentas al día!</div>
										) : netOwed > 0 ? (
											<div>
												<div className="text-rose-400 font-bold text-lg mt-1">{userBName} debe a {userAName}</div>
												<div className="text-3xl font-black text-rose-400 mt-2">{netOwed.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€</div>
											</div>
										) : (
											<div>
												<div className="text-rose-400 font-bold text-lg mt-1">{userAName} debe a {userBName}</div>
												<div className="text-3xl font-black text-rose-400 mt-2">{Math.abs(netOwed).toLocaleString('es-ES', { minimumFractionDigits: 2 })}€</div>
											</div>
										)}
									</div>
									<p className="text-[10px] text-slate-500 mt-2">
										Calculado en base a gastos compartidos 50/50 donde uno adelanta el pago.
									</p>
								</div>
							</div>
						</div>

						{/* Resumen de Deudas Activas */}
						<div className="lg:col-span-12 bg-slate-900 border border-slate-800 rounded-2xl p-6">
							<h3 className="text-lg font-semibold text-slate-200 mb-4">Deudas Activas al Mes {selectedMonth}</h3>

							{filteredDebts.length === 0 ? (
								<p className="text-sm text-slate-500">
									No se registran deudas activas iniciadas en o antes de {selectedMonth}.
								</p>
							) : (
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
									{filteredDebts.map((d) => {
										const cuota = calculateDebtMonthlyPayment(d);
										const isPlan = isPaymentPlanDebt(d);
										const totalIntereses = isPlan
											? d.fees
											: calculateDebtMonthlyPayment(d) * d.termMonths - d.principal;
										const overdueAmount = isPlan ? getPaymentPlanOverdueAmount(d, selectedMonth) : 0;
										return (
											<div
												key={d.id}
												className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 hover:border-indigo-500/30 transition-all"
											>
												<div className="flex justify-between items-start mb-2">
													<span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded">
														{d.tag}
													</span>
													<span className="text-xs text-slate-500 font-mono">{normalizeMonth(d.date)}</span>
												</div>
												<h4 className="font-bold text-slate-200 text-sm mb-1">{d.desc}</h4>
												<div className="grid grid-cols-2 gap-2 my-3 text-xs border-y border-slate-800 py-2">
													<div>
														<span className="text-slate-500 block">{isPlan ? 'Financiado:' : 'Capital Inicial:'}</span>
														<span className="font-semibold text-slate-300">
															{(isPlan ? d.financedAmount : d.principal).toLocaleString('es-ES')}€
														</span>
													</div>
													<div>
														<span className="text-slate-500 block">
															{isPlan ? 'Comisiones:' : 'Intereses Totales:'}
														</span>
														<span className="font-semibold text-rose-400">
															{totalIntereses.toLocaleString('es-ES', { maximumFractionDigits: 2 })}€
														</span>
													</div>
												</div>
												<div className="flex justify-between items-center text-xs mt-2 gap-3">
													<div>
														<span className="text-slate-500 block">
															{isPlan ? 'Tipo / Pendiente:' : 'Plazo / Tipo:'}
														</span>
														<span className="font-semibold text-slate-300">
															{isPlan
																? `Fraccionamiento · ${getPaymentPlanRemainingAmount(d).toFixed(2)}€`
																: `${d.termMonths}m / ${getDebtRateLabel(d)}`}
														</span>
														{overdueAmount > 0 && (
															<span className="block text-[10px] text-rose-400">
																Vencido: {overdueAmount.toFixed(2)}€
															</span>
														)}
													</div>
													<div className="text-right">
														<span className="text-slate-500 block">
															{isPlan ? 'Exigible este mes:' : 'Cuota Mensual:'}
														</span>
														<span className="font-bold text-sm text-indigo-400">
															{cuota.toLocaleString('es-ES', { maximumFractionDigits: 2 })}€
														</span>
													</div>
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>
					</div>
				)}

				{/* 2. TRANSACCIONES (GASTOS Y COBROS REGULARES) */}
				{activeTab === 'transactions' && (
					<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
						{/* Formulario */}
						<div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 h-fit">
							<h3 className="text-lg font-semibold text-slate-200 mb-6 flex items-center">
								<span className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg mr-2">
									<Icons.Plus />
								</span>
								Nueva Transacción
							</h3>

							<form onSubmit={handleAddTransaction} className="space-y-4">
								<div>
									<label className="block text-xs font-medium text-slate-400 mb-1.5">Tipo de Movimiento</label>
									<div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
										<button
											type="button"
											onClick={() => setTxForm({ ...txForm, type: 'expense', tag: DEFAULT_TAGS.expense[0] })}
											className={`py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
												txForm.type === 'expense'
													? 'bg-rose-500 text-white shadow-md'
													: 'text-slate-400 hover:text-slate-200'
											}`}
										>
											Gasto
										</button>
										<button
											type="button"
											onClick={() => setTxForm({ ...txForm, type: 'income', tag: DEFAULT_TAGS.income[0] })}
											className={`py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
												txForm.type === 'income'
													? 'bg-emerald-500 text-white shadow-md'
													: 'text-slate-400 hover:text-slate-200'
											}`}
										>
											Cobro
										</button>
										<button
											type="button"
											onClick={() => setTxForm({ ...txForm, type: 'transfer', tag: DEFAULT_TAGS.transfer[0] })}
											className={`py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
												txForm.type === 'transfer'
													? 'bg-sky-500 text-white shadow-md'
													: 'text-slate-400 hover:text-slate-200'
											}`}
										>
											Traspaso
										</button>
									</div>
								</div>

								<div>
									<label className="block text-xs font-medium text-slate-400 mb-1.5">Recurrencia</label>
									<div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
										<button
											type="button"
											onClick={() => setTxForm({ ...txForm, recurrence: 'one-off' })}
											className={`py-2 rounded-lg text-xs font-semibold transition-all ${
												txForm.recurrence === 'one-off' || !txForm.recurrence
													? 'bg-indigo-600 text-white shadow-md'
													: 'text-slate-400 hover:text-slate-200'
											}`}
										>
											Puntual
										</button>
										<button
											type="button"
											onClick={() => setTxForm({ ...txForm, recurrence: 'recurring' })}
											className={`py-2 rounded-lg text-xs font-semibold transition-all ${
												txForm.recurrence === 'recurring'
													? 'bg-indigo-600 text-white shadow-md'
													: 'text-slate-400 hover:text-slate-200'
											}`}
										>
											Recurrente
										</button>
									</div>
									<p className="text-[10px] text-slate-500 mt-1">
										Los movimientos recurrentes se añadirán automáticamente a los meses siguientes.
									</p>
								</div>

								<div>
									<label htmlFor="tx-desc" className="block text-xs font-medium text-slate-400 mb-1.5">
										Concepto
									</label>
									<input
										id="tx-desc"
										type="text"
										required
										placeholder="Ej. Nómina, Compra semanal..."
										value={txForm.desc}
										onChange={(e) => {
											const desc = e.target.value;
											const deduced = deduceTagFromConcept(desc, txForm.type);
											setTxForm((prev) => ({
												...prev,
												desc,
												tag: deduced || prev.tag
											}));
										}}
										className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-600"
									/>
								</div>

								<div>
									<label htmlFor="tx-amount" className="block text-xs font-medium text-slate-400 mb-1.5">
										Importe (€)
									</label>
									<input
										id="tx-amount"
										type="number"
										step="0.01"
										required
										min="0.01"
										placeholder="0.00"
										value={txForm.amount}
										onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
										className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-600"
									/>
								</div>

								<div>
									<label htmlFor="tx-date" className="block text-xs font-medium text-slate-400 mb-1.5">
										Fecha del Movimiento
									</label>
									<input
										id="tx-date"
										type="date"
										required
										value={txForm.date}
										onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
										className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 font-mono outline-none"
									/>
								</div>

								{txForm.type === 'transfer' ? (
									<>
										<div>
											<label htmlFor="tx-from-account" className="block text-xs font-medium text-slate-400 mb-1.5">
												Cuenta de Origen
											</label>
											<select
												id="tx-from-account"
												value={txForm.fromAccountId}
												onChange={(e) => setTxForm({ ...txForm, fromAccountId: e.target.value })}
												className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none transition-all"
											>
												{accounts.map((acc) => (
													<option key={acc.id} value={acc.id}>
														{acc.name} ({acc.owner === 'userA' ? userAName : acc.owner === 'userB' ? userBName : 'Compartida'})
													</option>
												))}
											</select>
										</div>

										<div>
											<label htmlFor="tx-to-account" className="block text-xs font-medium text-slate-400 mb-1.5">
												Cuenta de Destino
											</label>
											<select
												id="tx-to-account"
												value={txForm.toAccountId}
												onChange={(e) => setTxForm({ ...txForm, toAccountId: e.target.value })}
												className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none transition-all"
											>
												{accounts.filter((acc) => acc.id !== txForm.fromAccountId).map((acc) => (
													<option key={acc.id} value={acc.id}>
														{acc.name} ({acc.owner === 'userA' ? userAName : acc.owner === 'userB' ? userBName : 'Compartida'})
													</option>
												))}
											</select>
										</div>
									</>
								) : (
									<>
										<div>
											<label htmlFor="tx-account" className="block text-xs font-medium text-slate-400 mb-1.5">
												Cuenta Asociada
											</label>
											<select
												id="tx-account"
												value={txForm.accountId}
												onChange={(e) => {
													const accId = e.target.value;
													const acc = accounts.find((a) => a.id === accId);
													setTxForm({
														...txForm,
														accountId: accId,
														owner: acc ? acc.owner : txForm.owner
													});
												}}
												className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none transition-all"
											>
												<option value="">Sin Cuenta (Manual)</option>
												{accounts.map((acc) => (
													<option key={acc.id} value={acc.id}>
														{acc.name} ({acc.owner === 'userA' ? userAName : acc.owner === 'userB' ? userBName : 'Compartida'})
													</option>
												))}
											</select>
										</div>

										<div>
											<label className="block text-xs font-medium text-slate-400 mb-1.5">¿De quién es?</label>
											<div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
												<button
													type="button"
													onClick={() => setTxForm({ ...txForm, owner: 'userA' })}
													className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
														txForm.owner === 'userA'
															? 'bg-indigo-600 text-white shadow-md'
															: 'text-slate-400 hover:text-slate-200'
													}`}
												>
													{userAName}
												</button>
												<button
													type="button"
													onClick={() => setTxForm({ ...txForm, owner: 'userB' })}
													className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
														txForm.owner === 'userB'
															? 'bg-indigo-600 text-white shadow-md'
															: 'text-slate-400 hover:text-slate-200'
													}`}
												>
													{userBName}
												</button>
												<button
													type="button"
													onClick={() => setTxForm({ ...txForm, owner: 'joint' })}
													className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
														txForm.owner === 'joint' || !txForm.owner
															? 'bg-indigo-600 text-white shadow-md'
															: 'text-slate-400 hover:text-slate-200'
													}`}
												>
													Conjunto
												</button>
											</div>
										</div>

										{!txForm.accountId && txForm.owner === 'joint' && txForm.type === 'expense' && (
											<div>
												<label className="block text-xs font-medium text-slate-400 mb-1.5">Pagado por</label>
												<div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
													<button
														type="button"
														onClick={() => setTxForm({ ...txForm, paidBy: 'userA' })}
														className={`py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
															txForm.paidBy === 'userA'
																? 'bg-slate-750 text-white shadow-md'
																: 'text-slate-400 hover:text-slate-200'
														}`}
													>
														{userAName}
													</button>
													<button
														type="button"
														onClick={() => setTxForm({ ...txForm, paidBy: 'userB' })}
														className={`py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
															txForm.paidBy === 'userB'
																? 'bg-slate-750 text-white shadow-md'
																: 'text-slate-400 hover:text-slate-200'
														}`}
													>
														{userBName}
													</button>
													<button
														type="button"
														onClick={() => setTxForm({ ...txForm, paidBy: 'shared' })}
														className={`py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
															txForm.paidBy === 'shared' || !txForm.paidBy
																? 'bg-slate-750 text-white shadow-md'
																: 'text-slate-400 hover:text-slate-200'
														}`}
													>
														Cuenta Común
													</button>
												</div>
											</div>
										)}
									</>
								)}

								<div>
									<label htmlFor="tx-tag" className="block text-xs font-medium text-slate-400 mb-1.5">
										Etiqueta
									</label>
									<input
										id="tx-tag"
										list="tx-tags-list"
										value={txForm.tag}
										onChange={(e) => setTxForm({ ...txForm, tag: e.target.value })}
										placeholder="Elige o escribe una etiqueta"
										className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none transition-all"
									/>
									<datalist id="tx-tags-list">
										{DEFAULT_TAGS[txForm.type].map((tag) => (
											<option key={tag} value={tag} />
										))}
									</datalist>
								</div>

								<button
									type="submit"
									className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-lg active:scale-95"
								>
									Agregar Transacción
								</button>
							</form>
						</div>

						{/* Listado de Historial */}
						<div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-6">
							<h3 className="text-lg font-semibold text-slate-200 mb-6">Historial para el mes {selectedMonth}</h3>

							{filteredTransactions.length === 0 ? (
								<div className="text-center py-12 text-slate-500">
									<p className="text-sm">No hay transacciones registradas este mes.</p>
									<p className="text-xs">Usa el formulario para añadir cobros o gastos corrientes.</p>
								</div>
							) : (
								<div className="overflow-x-auto">
									<table className="w-full text-left border-collapse">
										<thead>
											<tr className="border-b border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
												<th className="pb-3 pl-2">Fecha</th>
												<th className="pb-3">Concepto</th>
												<th className="pb-3">Propietario</th>
												<th className="pb-3">Etiqueta</th>
												<th className="pb-3 text-right">Importe</th>
												<th className="pb-3 text-center">Acciones</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-slate-800/60 text-sm">
											{filteredTransactions.map((t) => (
												<tr key={t.id} className="hover:bg-slate-800/20 transition-colors">
													<td className="py-3.5 pl-2 text-slate-400 font-mono text-xs">{t.date}</td>
													<td className="py-3.5 font-medium text-slate-200">
														<div className="flex flex-col">
															<div className="flex items-center space-x-2">
																<span>{t.desc}</span>
																{t.recurrence === 'recurring' && (
																	<span 
																		title="Movimiento Recurrente"
																		className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
																	>
																		<svg className="w-3 h-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
																			<path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5" />
																		</svg>
																		Recurrente
																	</span>
																)}
															</div>
															{t.type === 'transfer' ? (
																<div className="text-[10px] text-slate-500 font-mono mt-0.5">
																	{accounts.find((a) => a.id === t.fromAccountId)?.name || 'Sin origen'} ➔ {accounts.find((a) => a.id === t.toAccountId)?.name || 'Sin destino'}
																</div>
															) : (
																t.accountId && (
																	<div className="text-[10px] text-slate-500 font-mono mt-0.5">
																		Cuenta: {accounts.find((a) => a.id === t.accountId)?.name || 'Desconocida'}
																	</div>
																)
															)}
														</div>
													</td>
													<td className="py-3.5">
														{t.type === 'transfer' ? (
															<span className="inline-block px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-bold">
																Traspaso
															</span>
														) : (
															<span
																className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
																	t.owner === 'userA'
																		? 'bg-indigo-500/15 text-indigo-400'
																		: t.owner === 'userB'
																			? 'bg-violet-500/15 text-violet-400'
																			: 'bg-emerald-500/15 text-emerald-400'
																}`}
															>
																{t.owner === 'userA'
																	? userAName
																	: t.owner === 'userB'
																		? userBName
																		: 'Conjunto'}
																{t.owner === 'joint' && t.type === 'expense' && ` (${t.paidBy === 'userA' ? userAName : t.paidBy === 'userB' ? userBName : 'Común'})`}
															</span>
														)}
													</td>
													<td className="py-3.5">
														<span
															className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
																t.type === 'income'
																	? 'bg-emerald-500/10 text-emerald-400'
																	: t.type === 'transfer'
																		? 'bg-sky-500/10 text-sky-400'
																		: 'bg-rose-500/10 text-rose-400'
															}`}
														>
															{t.tag}
														</span>
													</td>
													<td className="py-3.5 text-right">
														{(() => {
															if (t.type === 'transfer') {
																const getWeight = (owner: 'userA' | 'userB' | 'joint') => {
																	if (viewMode === 'all') return 1;
																	if (viewMode === 'userA') {
																		if (owner === 'userA') return 1;
																		if (owner === 'joint') return 0.5;
																		return 0;
																	}
																	if (viewMode === 'userB') {
																		if (owner === 'userB') return 1;
																		if (owner === 'joint') return 0.5;
																		return 0;
																	}
																	return 0;
																};
																const fromAcc = accounts.find((a) => a.id === t.fromAccountId);
																const toAcc = accounts.find((a) => a.id === t.toAccountId);
																if (fromAcc && toAcc) {
																	const toW = getWeight(toAcc.owner);
																	const fromW = getWeight(fromAcc.owner);
																	const netChange = (toW - fromW) * t.amount;
																	if (netChange > 0.001) {
																		return <span className="text-emerald-400 font-bold">+{t.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€</span>;
																	} else if (netChange < -0.001) {
																		return <span className="text-rose-400 font-bold">-{t.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€</span>;
																	}
																}
																return <span className="text-sky-400 font-bold">{t.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€</span>;
															}
															return (
																<span className={`font-bold ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
																	{t.type === 'income' ? '+' : '-'}
																	{t.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
																</span>
															);
														})()}
													</td>
													<td className="py-3.5 text-center">
														<button
															onClick={() => handleStartEditTransaction(t)}
															className="text-slate-500 hover:text-indigo-400 p-1.5 rounded-lg transition-colors mr-1"
															title="Editar transacción"
														>
															<Icons.Edit />
														</button>
														<button
															onClick={() => handleDeleteTransaction(t.id)}
															className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg transition-colors"
															title="Eliminar transacción"
														>
															<Icons.Trash />
														</button>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)}
						</div>
					</div>
				)}

				{/* 3. DEUDAS (GESTIÓN DE PRÉSTAMOS Y FRACCIONAMIENTOS) */}
				{activeTab === 'debts' && (
					<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
						{/* Formulario */}
						<div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 h-fit">
							<h3 className="text-lg font-semibold text-slate-200 mb-6 flex items-center">
								<span className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg mr-2">
									<Icons.CreditCard />
								</span>
								Nueva deuda
							</h3>

							<form onSubmit={handleAddDebt} className="space-y-4">
								<div>
									<label htmlFor="debt-desc" className="block text-xs font-medium text-slate-400 mb-1.5">
										Nombre de la Deuda
									</label>
									<input
										id="debt-desc"
										type="text"
										required
										placeholder="Ej. Préstamo de Coche, Tarjeta..."
										value={debtForm.desc}
										onChange={(e) => setDebtForm({ ...debtForm, desc: e.target.value })}
										className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-600"
									/>
								</div>

								<div>
									<label className="block text-xs font-medium text-slate-400 mb-1.5">Tipo de deuda</label>
									<div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
										<button
											type="button"
											onClick={() => setDebtForm({ ...debtForm, kind: 'classic' })}
											className={`py-2 rounded-lg text-xs font-semibold transition-all ${debtForm.kind === 'classic' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
										>
											Préstamo TIN/TAE
										</button>
										<button
											type="button"
											onClick={() => setDebtForm({ ...debtForm, kind: 'paymentPlan' })}
											className={`py-2 rounded-lg text-xs font-semibold transition-all ${debtForm.kind === 'paymentPlan' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
										>
											Fraccionamiento manual
										</button>
									</div>
								</div>

								<div>
									<label className="block text-xs font-medium text-slate-400 mb-1.5">¿De quién es la deuda?</label>
									<div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
										<button
											type="button"
											onClick={() => setDebtForm({ ...debtForm, owner: 'userA' })}
											className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
												debtForm.owner === 'userA'
													? 'bg-indigo-600 text-white shadow-md'
													: 'text-slate-400 hover:text-slate-200'
											}`}
										>
											{userAName}
										</button>
										<button
											type="button"
											onClick={() => setDebtForm({ ...debtForm, owner: 'userB' })}
											className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
												debtForm.owner === 'userB'
													? 'bg-indigo-600 text-white shadow-md'
													: 'text-slate-400 hover:text-slate-200'
											}`}
										>
											{userBName}
										</button>
										<button
											type="button"
											onClick={() => setDebtForm({ ...debtForm, owner: 'joint' })}
											className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
												debtForm.owner === 'joint' || !debtForm.owner
													? 'bg-indigo-600 text-white shadow-md'
													: 'text-slate-400 hover:text-slate-200'
											}`}
										>
											Conjunta
										</button>
									</div>
								</div>

								<div>
									<label htmlFor="debt-payment-account" className="block text-xs font-medium text-slate-400 mb-1.5">
										Cuenta para el Pago de la Cuota
									</label>
									<select
										id="debt-payment-account"
										value={debtForm.paymentAccountId}
										onChange={(e) => {
											const accId = e.target.value;
											const acc = accounts.find((a) => a.id === accId);
											setDebtForm({
												...debtForm,
												paymentAccountId: accId,
												owner: acc ? acc.owner : debtForm.owner
											});
										}}
										className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none transition-all"
									>
										<option value="">Sin Cuenta (Automático por Propietario)</option>
										{accounts.map((acc) => (
											<option key={acc.id} value={acc.id}>
												{acc.name} ({acc.owner === 'userA' ? userAName : acc.owner === 'userB' ? userBName : 'Compartida'})
											</option>
										))}
									</select>
								</div>

								{debtForm.kind === 'classic' ? (
									<>
										<div>
											<label htmlFor="debt-principal" className="block text-xs font-medium text-slate-400 mb-1.5">
												Capital Solicitado (€)
											</label>
											<input
												id="debt-principal"
												type="number"
												required={debtForm.kind === 'classic'}
												min="1"
												placeholder="Capital inicial"
												value={debtForm.principal}
												onChange={(e) => setDebtForm({ ...debtForm, principal: e.target.value })}
												className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-600"
											/>
										</div>

										<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
											<div>
												<label htmlFor="debt-tin" className="block text-xs font-medium text-slate-400 mb-1.5">
													TIN (%)
												</label>
												<input
													id="debt-tin"
													type="number"
													step="0.01"
													min="0"
													placeholder="Ej. 5.95"
													value={debtForm.tin}
													onChange={(e) => setDebtForm({ ...debtForm, tin: e.target.value })}
													className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none"
												/>
											</div>

											<div>
												<label htmlFor="debt-tae" className="block text-xs font-medium text-slate-400 mb-1.5">
													TAE (%)
												</label>
												<input
													id="debt-tae"
													type="number"
													step="0.01"
													required={debtForm.kind === 'classic'}
													min="0"
													placeholder="Ej. 6.5"
													value={debtForm.tae}
													onChange={(e) => setDebtForm({ ...debtForm, tae: e.target.value })}
													className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none"
												/>
											</div>

											<div>
												<label htmlFor="debt-term" className="block text-xs font-medium text-slate-400 mb-1.5">
													Plazo (Meses)
												</label>
												<input
													id="debt-term"
													type="number"
													required={debtForm.kind === 'classic'}
													min="1"
													placeholder="Ej. 36"
													value={debtForm.termMonths}
													onChange={(e) => setDebtForm({ ...debtForm, termMonths: e.target.value })}
													className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none"
												/>
											</div>
										</div>

										<p className="text-[10px] text-slate-500 -mt-2">
											Si cargás TIN, la cuota y la amortización usan TIN nominal mensual. Si lo dejás vacío, se deriva
											el tipo mensual desde la TAE.
										</p>
									</>
								) : (
									<>
										<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
											<div>
												<label htmlFor="plan-financed" className="block text-xs font-medium text-slate-400 mb-1.5">
													Importe fraccionado (€)
												</label>
												<input
													id="plan-financed"
													type="number"
													required={debtForm.kind === 'paymentPlan'}
													min="0.01"
													step="0.01"
													placeholder="Ej. 1000"
													value={debtForm.financedAmount}
													onChange={(e) => setDebtForm({ ...debtForm, financedAmount: e.target.value })}
													className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none"
												/>
											</div>
											<div>
												<label htmlFor="plan-fees" className="block text-xs font-medium text-slate-400 mb-1.5">
													Comisiones / intereses (€)
												</label>
												<input
													id="plan-fees"
													type="number"
													min="0"
													step="0.01"
													placeholder="Ej. 80"
													value={debtForm.fees}
													onChange={(e) => setDebtForm({ ...debtForm, fees: e.target.value })}
													className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none"
												/>
											</div>
										</div>

										<div className="space-y-2">
											<div className="flex items-center justify-between">
												<label className="block text-xs font-medium text-slate-400">Tramos de pago</label>
												<button
													type="button"
													onClick={addPaymentPlanTranche}
													className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
												>
													+ Agregar tramo
												</button>
											</div>
											{debtForm.tranches.map((tranche, index) => (
												<div key={tranche.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
													<div>
														<label className="block text-[10px] text-slate-500 mb-1">Meses</label>
														<input
															type="number"
															min="1"
															placeholder="Ej. 7"
															value={tranche.months}
															onChange={(e) => updatePaymentPlanTranche(tranche.id, { months: e.target.value })}
															className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-slate-100 outline-none"
														/>
													</div>
													<div>
														<label className="block text-[10px] text-slate-500 mb-1">Cuota mensual (€)</label>
														<input
															type="number"
															min="0.01"
															step="0.01"
															placeholder="Ej. 100"
															value={tranche.amount}
															onChange={(e) => updatePaymentPlanTranche(tranche.id, { amount: e.target.value })}
															className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-slate-100 outline-none"
														/>
													</div>
													<button
														type="button"
														onClick={() => removePaymentPlanTranche(tranche.id)}
														disabled={debtForm.tranches.length === 1}
														className="px-2 py-2 bg-rose-500/15 hover:bg-rose-500 disabled:opacity-40 text-rose-400 hover:text-white rounded-xl"
														aria-label={`Eliminar tramo ${index + 1}`}
													>
														<Icons.Trash />
													</button>
												</div>
											))}
										</div>

										<div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1">
											<div className="flex justify-between">
												<span className="text-slate-500">Total a pagar:</span>
												<span className="font-semibold text-slate-300">{paymentPlanTotalToPay.toFixed(2)}€</span>
											</div>
											<div className="flex justify-between">
												<span className="text-slate-500">Suma de cuotas:</span>
												<span
													className={
														Math.abs(paymentPlanScheduleDiff) <= 0.01
															? 'font-semibold text-emerald-400'
															: 'font-semibold text-rose-400'
													}
												>
													{paymentPlanScheduleTotal.toFixed(2)}€
												</span>
											</div>
											<p className="text-[10px] text-slate-500">
												La suma de cuotas tiene que coincidir con el total a pagar. Las vencidas no pagadas se arrastran
												al mes activo.
											</p>
										</div>
									</>
								)}

								<div>
									<label htmlFor="debt-date" className="block text-xs font-medium text-slate-400 mb-1.5">
										Fecha de Inicio
									</label>
									<input
										id="debt-date"
										type="month"
										required
										value={debtForm.date}
										onChange={(e) => setDebtForm({ ...debtForm, date: e.target.value })}
										className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 font-mono outline-none"
									/>
								</div>

								<div>
									<label htmlFor="debt-tag" className="block text-xs font-medium text-slate-400 mb-1.5">
										Etiqueta de Deuda
									</label>
									<select
										id="debt-tag"
										value={debtForm.tag}
										onChange={(e) => setDebtForm({ ...debtForm, tag: e.target.value })}
										className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none"
									>
										{DEFAULT_TAGS.debt.map((tag) => (
											<option key={tag} value={tag}>
												{tag}
											</option>
										))}
									</select>
								</div>

								{debtFormError && (
									<div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl">
										{debtFormError}
									</div>
								)}

								<button
									type="submit"
									className="w-full mt-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-lg active:scale-95"
								>
									Agregar deuda
								</button>
							</form>
						</div>

						{/* Lista de deudas activas */}
						<div className="lg:col-span-8 space-y-6">
							<div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
								<h3 className="text-lg font-semibold text-slate-200 mb-6">Listado de deudas existentes</h3>

								{debts.length === 0 ? (
									<p className="text-slate-500 text-sm">No tienes deudas registradas.</p>
								) : (
									<div className="space-y-4">
										{debts.map((d) => {
											const cuota = calculateDebtMonthlyPayment(d);
											const isPlan = isPaymentPlanDebt(d);
											const overdueAmount = isPlan ? getPaymentPlanOverdueAmount(d, selectedMonth) : 0;
											return (
												<div
													key={d.id}
													className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
												>
													<div>
														<div className="flex items-center space-x-2">
															<h4 className="font-bold text-slate-100 text-sm">{d.desc}</h4>
															<span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-400 font-bold rounded">
																{d.tag}
															</span>
														</div>
														<p className="text-xs text-slate-400 mt-1">
															{isPlan
																? `Financiado: ${d.financedAmount}€ | Comisiones: ${d.fees}€ | Pendiente: ${getPaymentPlanRemainingAmount(d).toFixed(2)}€`
																: `Capital: ${d.principal}€ | ${getDebtRateLabel(d)} | Plazo: ${d.termMonths} meses`}
														</p>
														<p className="text-[10px] text-slate-500">
															Iniciado en: {normalizeMonth(d.date)}
															{overdueAmount > 0 ? ` · Vencido: ${overdueAmount.toFixed(2)}€` : ''}
														</p>
													</div>

													<div className="flex items-center space-x-3">
														<div className="text-right">
															<span className="block text-[10px] text-slate-500">
																{isPlan ? 'Exigible este mes' : 'Cuota Mensual'}
															</span>
															<span className="text-base font-extrabold text-amber-500">{cuota.toFixed(2)}€</span>
														</div>

														<div className="flex flex-col space-y-1">
															<button
																onClick={() => setSelectedDebtSchedule(d)}
																className="px-2.5 py-1 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/20 text-xs font-semibold rounded"
															>
																{isPlan ? 'Calendario' : 'Plan Amort.'}
															</button>
															<button
																onClick={() => handleDeleteDebt(d.id)}
																className="px-2.5 py-1 bg-rose-500/15 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 text-xs font-semibold rounded"
															>
																Eliminar
															</button>
														</div>
													</div>
												</div>
											);
										})}
									</div>
								)}
							</div>

							{/* Detalle de deuda */}
							{selectedDebtSchedule && (
								<div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-6">
									<div className="flex justify-between items-center mb-4">
										<div>
											<h4 className="font-bold text-slate-100 text-sm">
												{isPaymentPlanDebt(selectedDebtSchedule) ? 'Calendario de pagos' : 'Amortización'}:{' '}
												{selectedDebtSchedule.desc}
											</h4>
											<p className="text-xs text-slate-400">
												{isPaymentPlanDebt(selectedDebtSchedule)
													? `Total ${selectedDebtSchedule.totalToPay.toFixed(2)}€ · Pagado ${getPaymentPlanPaidAmount(selectedDebtSchedule).toFixed(2)}€ · Pendiente ${getPaymentPlanRemainingAmount(selectedDebtSchedule).toFixed(2)}€ · Vencido ${getPaymentPlanOverdueAmount(selectedDebtSchedule, selectedMonth).toFixed(2)}€`
													: `${selectedDebtSchedule.termMonths} meses, ${getDebtRateLabel(selectedDebtSchedule)}`}
											</p>
										</div>
										<button
											onClick={() => setSelectedDebtSchedule(null)}
											className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded"
										>
											Cerrar
										</button>
									</div>

									<div className="max-h-72 overflow-y-auto border border-slate-800 rounded-lg">
										{isPaymentPlanDebt(selectedDebtSchedule) ? (
											<table className="w-full text-left text-xs">
												<thead className="bg-slate-950 sticky top-0 border-b border-slate-800">
													<tr className="text-slate-400">
														<th className="p-2">Mes</th>
														<th className="p-2">Cuota</th>
														<th className="p-2">Estado</th>
														<th className="p-2 text-right">Acción</th>
													</tr>
												</thead>
												<tbody className="divide-y divide-slate-800/50 text-slate-300">
													{selectedDebtSchedule.installments.map((installment) => {
														const isOverdue = installment.status === 'pending' && installment.dueMonth < selectedMonth;
														return (
															<tr key={installment.id} className="hover:bg-slate-800/10">
																<td className="p-2 font-mono text-slate-500">{installment.dueMonth}</td>
																<td className="p-2 font-mono">{installment.amount.toFixed(2)}€</td>
																<td className={isOverdue ? 'p-2 text-rose-400 font-semibold' : 'p-2 text-slate-300'}>
																	{installment.status === 'paid' ? 'Pagada' : isOverdue ? 'Vencida' : 'Pendiente'}
																</td>
																<td className="p-2 text-right">
																	<button
																		onClick={() =>
																			togglePaymentPlanInstallmentStatus(selectedDebtSchedule.id, installment.id)
																		}
																		className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-semibold"
																	>
																		{installment.status === 'paid' ? 'Marcar pendiente' : 'Marcar pagada'}
																	</button>
																</td>
															</tr>
														);
													})}
												</tbody>
											</table>
										) : (
											<table className="w-full text-left text-xs">
												<thead className="bg-slate-950 sticky top-0 border-b border-slate-800">
													<tr className="text-slate-400">
														<th className="p-2">Mes</th>
														<th className="p-2">Cuota</th>
														<th className="p-2">Amortización</th>
														<th className="p-2">Intereses</th>
														<th className="p-2 text-right">Pendiente</th>
													</tr>
												</thead>
												<tbody className="divide-y divide-slate-800/50 font-mono text-slate-300">
													{generateAmortizationSchedule(selectedDebtSchedule).map((row) => (
														<tr key={row.month} className="hover:bg-slate-800/10">
															<td className="p-2 text-slate-500">{row.month}</td>
															<td className="p-2">{row.cuota.toFixed(2)}€</td>
															<td className="p-2 text-emerald-400">{row.principalPaid.toFixed(2)}€</td>
															<td className="p-2 text-rose-400">{row.interestPayment.toFixed(2)}€</td>
															<td className="p-2 text-right text-slate-400">{row.remainingPrincipal.toFixed(2)}€</td>
														</tr>
													))}
												</tbody>
											</table>
										)}
									</div>
									{isPaymentPlanDebt(selectedDebtSchedule) && (
										<p className="text-[10px] text-slate-500 mt-3">
											Las cuotas pendientes vencidas se suman al flujo exigible del mes activo hasta que las marques
											como pagadas.
										</p>
									)}
								</div>
							)}
						</div>
					</div>
				)}

				{/* 4. REUNIFICACIÓN DE DEUDAS (SIMULADOR) */}
				{activeTab === 'consolidation' && (
					<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
						{/* Paso 1: Seleccionar Deudas */}
						<div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-6">
							<h3 className="text-lg font-semibold text-slate-200 mb-4">Paso 1: Selecciona las Deudas a Unificar</h3>
							<p className="text-xs text-slate-400 mb-6">
								Marca aquellas pequeñas deudas o deudas activas que te gustaría liquidar mediante un único préstamo
								unificado.
							</p>

							{debts.length === 0 ? (
								<p className="text-sm text-slate-500 py-6">No hay deudas registradas en la aplicación.</p>
							) : (
								<div className="space-y-3">
									{debts.map((d) => {
										const cuota = calculateDebtMonthlyPayment(d);
										const isPlan = isPaymentPlanDebt(d);
										const isChecked = !isPlan && selectedDebtsForConsolidation.includes(d.id);
										return (
											<div
												key={d.id}
												onClick={() => toggleDebtSelection(d.id)}
												className={`p-4 rounded-xl border transition-all flex items-center justify-between ${
													isPlan
														? 'bg-slate-950 border-slate-800 opacity-60 cursor-not-allowed'
														: isChecked
															? 'bg-indigo-500/10 border-indigo-500 cursor-pointer'
															: 'bg-slate-950 border-slate-800 hover:border-slate-700 cursor-pointer'
												}`}
											>
												<div className="flex items-center space-x-3">
													<input
														type="checkbox"
														checked={isChecked}
														disabled={isPlan}
														onChange={() => {}} // Se maneja con el onClick del div principal
														className="w-4 h-4 rounded border-slate-800 text-indigo-600 focus:ring-0 bg-slate-900"
													/>
													<div>
														<h4 className="font-bold text-slate-200 text-sm">{d.desc}</h4>
														<p className="text-xs text-slate-400">
															{isPlan
																? `Fraccionamiento: pendiente ${getPaymentPlanRemainingAmount(d).toFixed(2)}€ · no se reunifica automáticamente`
																: `Capital: ${d.principal}€ | ${getDebtRateLabel(d)}`}
														</p>
													</div>
												</div>
												<div className="text-right">
													<span className="block text-[10px] text-slate-500">{isPlan ? 'Exigible' : 'Cuota'}</span>
													<span className="text-sm font-bold text-slate-300">
														{cuota.toFixed(2)}€{isPlan ? '' : '/mes'}
													</span>
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>

						{/* Paso 2: Propuesta Nueva Deuda */}
						<div className="lg:col-span-6 space-y-6">
							{/* Parámetros del préstamo consolidado */}
							<div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
								<h3 className="text-lg font-semibold text-slate-200 mb-4">Paso 2: Parámetros del Préstamo Unificado</h3>

								<div className="space-y-4">
									<div className="grid grid-cols-2 gap-4">
										<div>
											<label htmlFor="new-tae" className="block text-xs font-medium text-slate-400 mb-1.5">
												Nuevo TAE Propuesto (%)
											</label>
											<input
												id="new-tae"
												type="number"
												step="0.01"
												value={consolidationForm.tae}
												onChange={(e) => setConsolidationForm({ ...consolidationForm, tae: e.target.value })}
												className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none"
											/>
										</div>
										<div>
											<label htmlFor="new-term" className="block text-xs font-medium text-slate-400 mb-1.5">
												Nuevo Plazo (Meses)
											</label>
											<input
												id="new-term"
												type="number"
												value={consolidationForm.termMonths}
												onChange={(e) => setConsolidationForm({ ...consolidationForm, termMonths: e.target.value })}
												className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none"
											/>
										</div>
									</div>

									{/* Input de Capital Adicional */}
									<div>
										<label htmlFor="extra-capital" className="block text-xs font-medium text-slate-400 mb-1.5">
											Capital Adicional Requerido (€){' '}
											<span className="text-slate-500">(Opcional para x cosa / compra nueva)</span>
										</label>
										<input
											id="extra-capital"
											type="number"
											min="0"
											placeholder="Ej. 500 para un nuevo proyecto"
											value={consolidationForm.extraCapital}
											onChange={(e) => setConsolidationForm({ ...consolidationForm, extraCapital: e.target.value })}
											className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none"
										/>
									</div>
								</div>
							</div>

							{/* Comparativa Analítica */}
							{selectedDebtsForConsolidation.length > 0 && (
								<div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-6 space-y-4">
									<h3 className="text-lg font-bold text-slate-100">Resultado de la Reunificación</h3>

									<div className="grid grid-cols-2 gap-4">
										<div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
											<span className="text-xs text-slate-500 block">Estructura del Capital</span>
											<div className="space-y-1 mt-1">
												<span className="text-sm block text-slate-300">
													Deuda actual: {consolidatedPrincipal.toLocaleString()}€
												</span>
												{additionalCapital > 0 && (
													<span className="text-xs block text-indigo-400 font-semibold">
														+ Nuevo capital: {additionalCapital.toLocaleString()}€
													</span>
												)}
												<div className="border-t border-slate-800 pt-1 mt-1">
													<span className="text-base font-black text-slate-100">
														Préstamo Total: {totalNewPrincipal.toLocaleString()}€
													</span>
												</div>
											</div>
										</div>

										<div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
											<div>
												<span className="text-xs text-slate-500 block">Nueva Cuota Mensual</span>
												<span className="text-xl font-black text-indigo-400">
													{newConsolidatedCuota.toFixed(2)}€/mes
												</span>
											</div>
											<span className="block text-[10px] text-emerald-400 mt-2">
												{newConsolidatedCuota < currentConsolidatedMonthlySum
													? `Ahorras ${(currentConsolidatedMonthlySum - newConsolidatedCuota).toFixed(2)}€/mes respecto a deudas previas`
													: 'La cuota mensual aumenta'}
											</span>
										</div>
									</div>

									{/* Diferencial de intereses (Crítica Financiera) */}
									<div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-sm">
										<div className="flex justify-between">
											<span className="text-slate-400">Intereses Totales Actuales:</span>
											<span className="font-semibold text-slate-300">{currentTotalInterests.toFixed(2)}€</span>
										</div>
										<div className="flex justify-between">
											<span className="text-slate-400">Intereses Préstamo Unificado (incl. nuevo dinero):</span>
											<span className="font-semibold text-slate-300">{newConsolidatedInterests.toFixed(2)}€</span>
										</div>
										<div className="border-t border-slate-800 pt-2 flex justify-between font-bold">
											<span className="text-slate-300">Diferencial de Interés Neto:</span>
											<span
												className={
													newConsolidatedInterests > currentTotalInterests ? 'text-rose-400' : 'text-emerald-400'
												}
											>
												{(newConsolidatedInterests - currentTotalInterests).toFixed(2)}€
												{newConsolidatedInterests > currentTotalInterests
													? ' (Mayor coste financiero)'
													: ' (Menor coste financiero)'}
											</span>
										</div>
									</div>

									<div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-300 leading-relaxed">
										<span className="font-bold">⚠️ Análisis Técnico:</span> Alargar los plazos reduce tu asfixia de caja
										actual. Sin embargo, al añadir **
										{additionalCapital > 0 ? `${additionalCapital}€ de capital adicional` : 'capital nuevo'}**,
										incrementas la base de cálculo del préstamo, lo cual incrementa exponencialmente los intereses
										pagados a largo plazo. Utiliza el módulo de **Asesor Gemini** para que realice un estudio automático
										de esta simulación.
									</div>
								</div>
							)}
						</div>
					</div>
				)}
				{/* 5. GESTIÓN DE CUENTAS (CONFIGURACIÓN) */}
				{activeTab === 'accounts' && (
					<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
						{/* Listado de Cuentas */}
						<div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-6">
							<h3 className="text-lg font-semibold text-slate-200 mb-2 flex items-center gap-2">
								<svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
									<path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
								</svg>
								Cuentas Configuradas
							</h3>
							<p className="text-xs text-slate-400 mb-6">
								Tus cuentas financieras activas. Los saldos de apertura de la cronología se calculan en base a sus saldos iniciales.
							</p>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{accounts.map((acc) => {
									const closingBal = timelineBalances[selectedMonth]?.accountBalances[acc.id] ?? acc.initialBalance;
									return (
										<div
											key={acc.id}
											className="bg-slate-950 p-5 rounded-xl border border-slate-800/80 hover:border-indigo-500/30 transition-all flex flex-col justify-between"
										>
											<div>
												<div className="flex justify-between items-start mb-2">
													<h4 className="font-bold text-slate-100 text-sm truncate max-w-[150px]">{acc.name}</h4>
													<span
														className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${
															acc.owner === 'userA'
																? 'bg-indigo-500/15 text-indigo-400'
																: acc.owner === 'userB'
																	? 'bg-violet-500/15 text-violet-400'
																	: 'bg-emerald-500/15 text-emerald-400'
														}`}
													>
														{acc.owner === 'userA'
															? userAName
															: acc.owner === 'userB'
																? userBName
																: 'Compartida'}
													</span>
												</div>
												<div className="text-xs text-slate-500 font-mono mt-1 space-y-1">
													<div>Saldo Inicial: {acc.initialBalance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€</div>
												</div>
											</div>

											<div className="mt-4 pt-4 border-t border-slate-900/60 flex items-center justify-between">
												<div>
													<span className="block text-[10px] text-slate-500">Saldo en {selectedMonth}:</span>
													<span className={`text-sm font-extrabold ${closingBal >= 0 ? 'text-indigo-400' : 'text-rose-500'}`}>
														{closingBal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
													</span>
												</div>
												<div className="flex space-x-1.5">
													<button
														onClick={() => handleStartEditAccount(acc)}
														className="text-slate-500 hover:text-indigo-400 p-1.5 rounded-lg transition-colors border border-slate-850 bg-slate-900"
														title="Editar cuenta"
													>
														<Icons.Edit />
													</button>
													<button
														onClick={() => handleDeleteAccount(acc.id)}
														className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg transition-colors border border-slate-850 bg-slate-900"
														title="Eliminar cuenta"
													>
														<Icons.Trash />
													</button>
												</div>
											</div>
										</div>
									);
								})}
							</div>
						</div>

						{/* Formulario de Alta/Edición */}
						<div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 h-fit">
							<h3 className="text-lg font-semibold text-slate-200 mb-6 flex items-center">
								<span className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg mr-2">
									{editingAccount ? <Icons.Edit /> : <Icons.Plus />}
								</span>
								{editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta'}
							</h3>

							<form onSubmit={editingAccount ? handleSaveEditAccount : handleAddAccount} className="space-y-4">
								<div>
									<label htmlFor="acc-name" className="block text-xs font-medium text-slate-400 mb-1.5">
										Nombre de la Cuenta
									</label>
									<input
										id="acc-name"
										type="text"
										required
										placeholder="Ej. Nómina La Caixa, Cuenta Ahorros..."
										value={accountForm.name}
										onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
										className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-600"
									/>
								</div>

								<div>
									<label className="block text-xs font-medium text-slate-400 mb-1.5">Propietario / Tipo</label>
									<div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
										<button
											type="button"
											onClick={() => setAccountForm({ ...accountForm, owner: 'userA' })}
											className={`py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
												accountForm.owner === 'userA'
													? 'bg-indigo-600 text-white shadow-md'
													: 'text-slate-400 hover:text-slate-200'
											}`}
										>
											{userAName}
										</button>
										<button
											type="button"
											onClick={() => setAccountForm({ ...accountForm, owner: 'userB' })}
											className={`py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
												accountForm.owner === 'userB'
													? 'bg-indigo-600 text-white shadow-md'
													: 'text-slate-400 hover:text-slate-200'
											}`}
										>
											{userBName}
										</button>
										<button
											type="button"
											onClick={() => setAccountForm({ ...accountForm, owner: 'joint' })}
											className={`py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
												accountForm.owner === 'joint'
													? 'bg-indigo-600 text-white shadow-md'
													: 'text-slate-400 hover:text-slate-200'
											}`}
										>
											Compartida
										</button>
									</div>
								</div>

								<div>
									<label htmlFor="acc-balance" className="block text-xs font-medium text-slate-400 mb-1.5">
										Saldo Inicial (€)
									</label>
									<input
										id="acc-balance"
										type="number"
										step="0.01"
										required
										min="0"
										placeholder="0.00"
										value={accountForm.initialBalance}
										onChange={(e) => setAccountForm({ ...accountForm, initialBalance: e.target.value })}
										className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none transition-all"
									/>
								</div>

								<div className="flex gap-2 pt-2">
									<button
										type="submit"
										className={`font-semibold py-2.5 rounded-xl text-sm transition-all shadow-lg active:scale-95 ${editingAccount ? 'w-1/2 bg-indigo-600 hover:bg-indigo-500 text-white' : 'w-full bg-indigo-600 hover:bg-indigo-500 text-white'}`}
									>
										{editingAccount ? 'Guardar' : 'Agregar Cuenta'}
									</button>
									{editingAccount && (
										<button
											type="button"
											onClick={() => {
												setEditingAccount(null);
												setAccountForm({ name: '', owner: 'joint', initialBalance: '' });
											}}
											className="w-1/2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold py-2.5 rounded-xl text-xs transition-all"
										>
											Cancelar
										</button>
									)}
								</div>
							</form>
						</div>
					</div>
				)}

				{/* 5. ASESOR GEMINI AI */}
				{activeTab === 'ai' && (
					<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
						{/* Panel de Configuración e Información Lateral */}
						<div className="lg:col-span-4 space-y-6">
							{/* Configuración de API Key */}
							<div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
								<h3 className="text-base font-bold text-slate-200 mb-2 flex items-center">
									<span className="p-1 bg-slate-800 rounded mr-2">
										<Icons.Lock />
									</span>
									Credenciales de Gemini
								</h3>
								<p className="text-xs text-slate-400 mb-4">
									Introduce tu API Key de Google Gemini para habilitar el motor de análisis y recibir consejos
									estructurados en tiempo real.
								</p>

								<div className="space-y-3">
									<input
										type="password"
										placeholder="Al pegar tu AI_KEY se guardará localmente"
										value={geminiApiKey}
										onChange={(e) => setGeminiApiKey(e.target.value)}
										className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2 text-sm text-slate-100 font-mono outline-none"
									/>
									{geminiApiKey ? (
										<span className="text-[10px] text-emerald-400 font-semibold block">
											✓ API Key configurada localmente.
										</span>
									) : (
										<span className="text-[10px] text-amber-500 font-semibold block">
											⚠ Falta la API Key para procesar consultas.
										</span>
									)}
								</div>
							</div>

							{/* Resumen del Contexto Financiero del Mes */}
							<div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
								<h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
									<svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
										<path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
									</svg>
									Contexto del Mes ({selectedMonth})
								</h3>
								<p className="text-xs text-slate-400 leading-relaxed">
									Los siguientes datos son incluidos automáticamente en la consulta de fondo para contextualizar la conversación:
								</p>
								<div className="space-y-2 text-xs border-t border-slate-800 pt-3">
									<div className="flex justify-between">
										<span className="text-slate-500">Ingresos Totales:</span>
										<span className="font-semibold text-emerald-400">
											{totalIncomes.toFixed(2)}€
											{oneOffIncomes > 0 && ` (Puntual: ${oneOffIncomes.toFixed(2)}€)`}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-slate-500">Gastos Totales:</span>
										<span className="font-semibold text-rose-400">
											-{totalExpenses.toFixed(2)}€
											{oneOffExpenses > 0 && ` (Puntual: -${oneOffExpenses.toFixed(2)}€)`}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-slate-500">Pagos de Deudas:</span>
										<span className="font-semibold text-amber-500">-{totalMonthlyDebtPayments.toFixed(2)}€</span>
									</div>
									<div className="flex justify-between border-t border-slate-850 pt-2 font-semibold">
										<span className="text-slate-400">Balance Neto:</span>
										<span className={netMonthlyBalance >= 0 ? 'text-indigo-400' : 'text-rose-500'}>
											{netMonthlyBalance.toFixed(2)}€
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-slate-500">Deudas Registradas:</span>
										<span className="font-semibold text-slate-300">{debts.length}</span>
									</div>
								</div>
							</div>

							{/* Acciones Adicionales */}
							{chatMessages.length > 0 && (
								<div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
									<h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3">Opciones de Conversación</h3>
									<button
										onClick={handleClearChat}
										className="w-full py-2 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/30 hover:border-rose-900/50 text-rose-400 hover:text-rose-350 font-semibold rounded-xl text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
									>
										<Icons.Trash />
										<span>Borrar Historial</span>
									</button>
								</div>
							)}
						</div>

						{/* Ventana de Chat */}
						<div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl h-[550px] flex flex-col overflow-hidden">
							{/* Cabecera del Chat */}
							<div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
								<div>
									<h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
										<Icons.Sparkles />
										Asesor Gemini
									</h3>
									<p className="text-[10px] text-slate-500">
										Análisis financiero avanzado en base a tus movimientos y deudas
									</p>
								</div>
								<span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/25">
									Contexto Activo
								</span>
							</div>

							{/* Cuerpo del Chat */}
							{chatMessages.length === 0 ? (
								<div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-4">
									<div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 shadow-md">
										<Icons.Sparkles />
									</div>
									<div>
										<p className="text-sm font-bold text-slate-350">Comienza a planificar tu mes</p>
										<p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
											Pregúntame sobre tu balance del mes, recomendaciones de ahorro, o el impacto de tus deudas y simulaciones.
										</p>
									</div>
									<div className="flex flex-wrap gap-2 justify-center max-w-md pt-2">
										{[
											'¿Cómo está mi salud financiera este mes?',
											'¿Tengo deudas con alto coste de intereses?',
											'¿Cómo puedo recortar gastos comunes?',
											'Analiza la reunificación de deudas propuesta.'
										].map((q) => (
											<button
												key={q}
												onClick={() => {
													setCustomQuestion(q);
													handleAskGemini(q);
												}}
												disabled={aiLoading}
												className="px-3 py-1.5 bg-slate-950 border border-slate-800 hover:border-indigo-500/30 text-slate-300 hover:text-white rounded-lg text-[11px] font-medium transition-all text-left shadow-sm active:scale-95"
											>
												{q}
											</button>
										))}
									</div>
								</div>
							) : (
								<div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/20">
									{chatMessages.map((msg, idx) => (
										<div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
											<div className="flex items-center space-x-1.5 mb-1.5">
												<span className="text-[10px] text-slate-400 font-bold">
													{msg.role === 'user' ? 'Tú' : 'Asesor Gemini'}
												</span>
												<span className="text-[9px] text-slate-650 font-mono">({msg.timestamp})</span>
											</div>
											<div
												className={`p-3.5 rounded-2xl text-sm leading-relaxed max-w-[85%] ${
													msg.role === 'user'
														? 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-600/10'
														: 'bg-slate-900 border border-slate-800 text-slate-350 rounded-tl-none shadow-sm'
												}`}
											>
												{msg.role === 'user' ? (
													<div className="whitespace-pre-wrap">{msg.content}</div>
												) : (
													<MarkdownRenderer text={msg.content} />
												)}
											</div>
										</div>
									))}
									{aiLoading && (
										<div className="flex flex-col items-start">
											<div className="flex items-center space-x-1.5 mb-1.5">
												<span className="text-[10px] text-slate-400 font-bold">Asesor Gemini</span>
												<span className="text-[9px] text-indigo-400 animate-pulse font-medium">escribiendo...</span>
											</div>
											<div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl rounded-tl-none text-sm text-slate-400 shadow-md flex items-center space-x-2">
												<svg className="animate-spin h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24">
													<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
													<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
												</svg>
												<span className="animate-pulse">Analizando flujo de caja...</span>
											</div>
										</div>
									)}
									{aiError && (
										<div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-450 text-xs rounded-xl">
											{aiError}
										</div>
									)}
								</div>
							)}

							{/* Formulario de Input al pie */}
							<form
								onSubmit={(e) => {
									e.preventDefault();
									handleAskGemini(customQuestion);
								}}
								className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2 items-end"
							>
								<textarea
									rows={1}
									value={customQuestion}
									onChange={(e) => setCustomQuestion(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter' && !e.shiftKey) {
											e.preventDefault();
											handleAskGemini(customQuestion);
										}
									}}
									placeholder={geminiApiKey ? "Escribe tu consulta sobre finanzas..." : "Configura tu API Key para empezar"}
									disabled={!geminiApiKey}
									className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none resize-none placeholder:text-slate-650 max-h-24 overflow-y-auto disabled:opacity-40 disabled:cursor-not-allowed"
								/>
								<button
									type="submit"
									disabled={aiLoading || !customQuestion.trim() || !geminiApiKey}
									className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-md shadow-indigo-600/10"
								>
									<Icons.Sparkles />
									<span className="hidden sm:inline">Enviar</span>
								</button>
							</form>
						</div>
					</div>
				)}
					</>
				)}
				{/* MODAL DE RECONFIGURACIÓN DE CUENTA */}
				{isReconfiguring && (
					<div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
						<div 
							className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 relative"
							onClick={(e) => e.stopPropagation()}
						>
							<button 
								onClick={() => setIsReconfiguring(false)}
								className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 transition-colors"
								aria-label="Cerrar modal"
							>
								<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
									<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>

							<div className="text-center">
								<div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
									<svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
										<path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
										<path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
									</svg>
								</div>
								<h2 className="text-xl font-bold text-slate-100">Configurar Cuenta</h2>
								<p className="text-xs text-slate-400 mt-1">
									Modificá el saldo de apertura, cambiá el mes de inicio o reiniciá la cuenta.
								</p>
							</div>

							<form onSubmit={handleInitAccount} className="space-y-4">
								<div>
									<label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Flujo de Inicio</label>
									<div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
										<button
											type="button"
											onClick={() => {
												setInitFlow('current');
												setInitMonth(currentMonthString);
											}}
											className={`py-2 rounded-lg text-xs font-bold transition-all ${
												initFlow === 'current'
													? 'bg-indigo-600 text-white shadow-md'
													: 'text-slate-400 hover:text-slate-200'
											}`}
										>
											Mes en Curso
										</button>
										<button
											type="button"
											onClick={() => setInitFlow('past')}
											className={`py-2 rounded-lg text-xs font-bold transition-all ${
												initFlow === 'past'
													? 'bg-indigo-600 text-white shadow-md'
													: 'text-slate-400 hover:text-slate-200'
											}`}
										>
											Desde el Pasado
										</button>
									</div>
								</div>

								{initFlow === 'past' ? (
									<div>
										<label htmlFor="modal-init-month" className="block text-xs font-medium text-slate-400 mb-1">
											Mes de Partida
										</label>
										<input
											id="modal-init-month"
											type="month"
											required
											max={currentMonthString}
											value={initMonth}
											onChange={(e) => setInitMonth(e.target.value)}
											className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-slate-100 font-mono outline-none"
										/>
									</div>
								) : (
									<div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400">
										<span className="font-semibold text-slate-300">Mes Activo de Inicio:</span> {currentMonthString}
									</div>
								)}

								<div className="space-y-4 border-t border-slate-800/80 pt-4">
									<h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Perfiles de Usuario</h3>
									<div className="grid grid-cols-2 gap-4">
										<div>
											<label htmlFor="modal-user-a-name" className="block text-[11px] font-medium text-slate-500 mb-1">Nombre {userAName || 'Usuario A'}</label>
											<input
												id="modal-user-a-name"
												type="text"
												required
												value={userAName}
												onChange={(e) => setUserAName(e.target.value)}
												className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
											/>
										</div>
										<div>
											<label htmlFor="modal-user-b-name" className="block text-[11px] font-medium text-slate-500 mb-1">Nombre {userBName || 'Usuario B'}</label>
											<input
												id="modal-user-b-name"
												type="text"
												required
												value={userBName}
												onChange={(e) => setUserBName(e.target.value)}
												className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
											/>
										</div>
									</div>
								</div>

								<div className="space-y-4 border-t border-slate-800/80 pt-4">
									<h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Balances de Apertura (€)</h3>
									<div className="space-y-3">
										{reconfigAccounts.map((acc, index) => (
											<div key={acc.id} className="flex flex-col">
												<label htmlFor={`init-balance-modal-${acc.id}`} className="block text-[11px] font-medium text-slate-500 mb-1">
													Saldo inicial: {acc.name} ({acc.owner === 'userA' ? userAName : acc.owner === 'userB' ? userBName : 'Compartida'})
												</label>
												<input
													id={`init-balance-modal-${acc.id}`}
													type="number"
													step="0.01"
													required
													min="0"
													value={acc.initialBalance}
													onChange={(e) => {
														const val = parseFloat(e.target.value) || 0;
														setReconfigAccounts((prev) =>
															prev.map((a, i) => (i === index ? { ...a, initialBalance: val } : a))
														);
													}}
													className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs text-slate-100 outline-none"
												/>
											</div>
										))}
									</div>
									<div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs flex justify-between items-center text-slate-400">
										<span>Total Conjunto:</span>
										<span className="font-bold text-slate-200 text-sm">
											{reconfigAccounts.reduce((sum, a) => sum + (a.initialBalance || 0), 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
										</span>
									</div>
								</div>

								<div className="flex gap-2 pt-2">
									<button
										type="submit"
										className="w-1/2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold py-2.5 rounded-xl text-xs transition-all active:scale-95 shadow-md shadow-indigo-600/10"
									>
										Guardar
									</button>
									<button
										type="button"
										onClick={() => setIsReconfiguring(false)}
										className="w-1/2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold py-2.5 rounded-xl text-xs transition-all"
									>
										Cancelar
									</button>
								</div>

								<div className="border-t border-slate-800/80 pt-4 mt-2">
									<button
										type="button"
										onClick={handleResetAccount}
										className="w-full bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/30 text-rose-400 hover:text-rose-350 font-bold py-2 rounded-xl text-xs transition-all active:scale-95"
									>
										Reiniciar Base de Datos
									</button>
								</div>
							</form>
						</div>
					</div>
				)}

				{/* MODAL DE EDICIÓN DE TRANSACCIÓN */}
				{editingTx && (
					<div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
						<div 
							className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 relative"
							onClick={(e) => e.stopPropagation()}
						>
							<button 
								onClick={() => setEditingTx(null)}
								className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 transition-colors"
								aria-label="Cerrar modal"
							>
								<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
									<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>

							<div className="text-center">
								<div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
									<Icons.Edit />
								</div>
								<h2 className="text-xl font-bold text-slate-100">Editar Transacción</h2>
								<p className="text-xs text-slate-400 mt-1">
									Modifica los valores del movimiento seleccionado.
								</p>
							</div>

							<form onSubmit={handleSaveEditTransaction} className="space-y-4">
								<div>
									<label className="block text-xs font-medium text-slate-400 mb-1.5">Tipo de Movimiento</label>
									<div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
										<button
											type="button"
											onClick={() => setEditForm({ ...editForm, type: 'expense', tag: DEFAULT_TAGS.expense[0] })}
											className={`py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
												editForm.type === 'expense'
													? 'bg-rose-500 text-white shadow-md'
													: 'text-slate-400 hover:text-slate-200'
											}`}
										>
											Gasto
										</button>
										<button
											type="button"
											onClick={() => setEditForm({ ...editForm, type: 'income', tag: DEFAULT_TAGS.income[0] })}
											className={`py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
												editForm.type === 'income'
													? 'bg-emerald-500 text-white shadow-md'
													: 'text-slate-400 hover:text-slate-200'
											}`}
										>
											Cobro
										</button>
										<button
											type="button"
											onClick={() => setEditForm({ ...editForm, type: 'transfer', tag: DEFAULT_TAGS.transfer[0] })}
											className={`py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
												editForm.type === 'transfer'
													? 'bg-sky-500 text-white shadow-md'
													: 'text-slate-400 hover:text-slate-200'
											}`}
										>
											Traspaso
										</button>
									</div>
								</div>

								<div>
									<label htmlFor="edit-desc" className="block text-xs font-medium text-slate-400 mb-1.5">
										Concepto
									</label>
									<input
										id="edit-desc"
										type="text"
										required
										value={editForm.desc}
										onChange={(e) => {
											const desc = e.target.value;
											const deduced = deduceTagFromConcept(desc, editForm.type);
											setEditForm((prev) => ({
												...prev,
												desc,
												tag: deduced || prev.tag
											}));
										}}
										className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600"
									/>
								</div>

								<div>
									<label htmlFor="edit-amount" className="block text-xs font-medium text-slate-400 mb-1.5">
										Importe (€)
									</label>
									<input
										id="edit-amount"
										type="number"
										step="0.01"
										required
										min="0.01"
										value={editForm.amount}
										onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
										className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none"
									/>
								</div>

								<div>
									<label htmlFor="edit-date" className="block text-xs font-medium text-slate-400 mb-1.5">
										Fecha
									</label>
									<input
										id="edit-date"
										type="date"
										required
										value={editForm.date}
										onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
										className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 font-mono outline-none"
									/>
								</div>

								{editForm.type === 'transfer' ? (
									<>
										<div>
											<label htmlFor="edit-from-account" className="block text-xs font-medium text-slate-400 mb-1.5">
												Cuenta de Origen
											</label>
											<select
												id="edit-from-account"
												value={editForm.fromAccountId}
												onChange={(e) => setEditForm({ ...editForm, fromAccountId: e.target.value })}
												className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none transition-all"
											>
												{accounts.map((acc) => (
													<option key={acc.id} value={acc.id}>
														{acc.name} ({acc.owner === 'userA' ? userAName : acc.owner === 'userB' ? userBName : 'Compartida'})
													</option>
												))}
											</select>
										</div>

										<div>
											<label htmlFor="edit-to-account" className="block text-xs font-medium text-slate-400 mb-1.5">
												Cuenta de Destino
											</label>
											<select
												id="edit-to-account"
												value={editForm.toAccountId}
												onChange={(e) => setEditForm({ ...editForm, toAccountId: e.target.value })}
												className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none transition-all"
											>
												{accounts.filter((acc) => acc.id !== editForm.fromAccountId).map((acc) => (
													<option key={acc.id} value={acc.id}>
														{acc.name} ({acc.owner === 'userA' ? userAName : acc.owner === 'userB' ? userBName : 'Compartida'})
													</option>
												))}
											</select>
										</div>
									</>
								) : (
									<>
										<div>
											<label htmlFor="edit-account" className="block text-xs font-medium text-slate-400 mb-1.5">
												Cuenta Asociada
											</label>
											<select
												id="edit-account"
												value={editForm.accountId}
												onChange={(e) => {
													const accId = e.target.value;
													const acc = accounts.find((a) => a.id === accId);
													setEditForm({
														...editForm,
														accountId: accId,
														owner: acc ? acc.owner : editForm.owner
													});
												}}
												className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none transition-all"
											>
												<option value="">Sin Cuenta (Manual)</option>
												{accounts.map((acc) => (
													<option key={acc.id} value={acc.id}>
														{acc.name} ({acc.owner === 'userA' ? userAName : acc.owner === 'userB' ? userBName : 'Compartida'})
													</option>
												))}
											</select>
										</div>

										<div>
											<label className="block text-xs font-medium text-slate-400 mb-1.5">¿De quién es?</label>
											<div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
												<button
													type="button"
													onClick={() => setEditForm({ ...editForm, owner: 'userA' })}
													className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
														editForm.owner === 'userA'
															? 'bg-indigo-600 text-white shadow-md'
															: 'text-slate-400 hover:text-slate-200'
													}`}
												>
													{userAName}
												</button>
												<button
													type="button"
													onClick={() => setEditForm({ ...editForm, owner: 'userB' })}
													className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
														editForm.owner === 'userB'
															? 'bg-indigo-600 text-white shadow-md'
															: 'text-slate-400 hover:text-slate-200'
													}`}
												>
													{userBName}
												</button>
												<button
													type="button"
													onClick={() => setEditForm({ ...editForm, owner: 'joint' })}
													className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
														editForm.owner === 'joint'
															? 'bg-indigo-600 text-white shadow-md'
															: 'text-slate-400 hover:text-slate-200'
													}`}
												>
													Conjunto
												</button>
											</div>
										</div>

										{!editForm.accountId && editForm.owner === 'joint' && editForm.type === 'expense' && (
											<div>
												<label className="block text-xs font-medium text-slate-400 mb-1.5">Pagado por</label>
												<div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
													<button
														type="button"
														onClick={() => setEditForm({ ...editForm, paidBy: 'userA' })}
														className={`py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
															editForm.paidBy === 'userA'
																? 'bg-slate-750 text-white shadow-md'
																: 'text-slate-400 hover:text-slate-200'
														}`}
													>
														{userAName}
													</button>
													<button
														type="button"
														onClick={() => setEditForm({ ...editForm, paidBy: 'userB' })}
														className={`py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
															editForm.paidBy === 'userB'
																? 'bg-slate-750 text-white shadow-md'
																: 'text-slate-400 hover:text-slate-200'
														}`}
													>
														{userBName}
													</button>
													<button
														type="button"
														onClick={() => setEditForm({ ...editForm, paidBy: 'shared' })}
														className={`py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
															editForm.paidBy === 'shared'
																? 'bg-slate-750 text-white shadow-md'
																: 'text-slate-400 hover:text-slate-200'
														}`}
													>
														Común
													</button>
												</div>
											</div>
										)}
									</>
								)}

								<div>
									<label htmlFor="edit-tag" className="block text-xs font-medium text-slate-400 mb-1.5">
										Etiqueta
									</label>
									<input
										id="edit-tag"
										list="edit-tags-list"
										value={editForm.tag}
										onChange={(e) => setEditForm({ ...editForm, tag: e.target.value })}
										placeholder="Elige o escribe una etiqueta"
										className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none"
									/>
									<datalist id="edit-tags-list">
										{DEFAULT_TAGS[editForm.type].map((tag) => (
											<option key={tag} value={tag} />
										))}
									</datalist>
								</div>

								{/* Rango de Edición para recurrentes */}
								{editingTx.recurrence === 'recurring' && (
									<div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
										<label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
											Alcance del cambio recurrente
										</label>
										<div className="space-y-2">
											<label className="flex items-center space-x-3 text-xs text-slate-300 cursor-pointer">
												<input
													type="radio"
													name="editScope"
													value="only-this"
													checked={editScope === 'only-this'}
													onChange={() => setEditScope('only-this')}
													className="w-4 h-4 rounded-full border-slate-850 text-indigo-600 focus:ring-0 bg-slate-900"
												/>
												<span>Solo este mes ({selectedMonth})</span>
											</label>
											<label className="flex items-center space-x-3 text-xs text-slate-300 cursor-pointer">
												<input
													type="radio"
													name="editScope"
													value="future"
													checked={editScope === 'future'}
													onChange={() => setEditScope('future')}
													className="w-4 h-4 rounded-full border-slate-850 text-indigo-600 focus:ring-0 bg-slate-900"
												/>
												<span>Este y todos los meses futuros</span>
											</label>
											<label className="flex items-center space-x-3 text-xs text-slate-300 cursor-pointer">
												<input
													type="radio"
													name="editScope"
													value="all"
													checked={editScope === 'all'}
													onChange={() => setEditScope('all')}
													className="w-4 h-4 rounded-full border-slate-850 text-indigo-600 focus:ring-0 bg-slate-900"
												/>
												<span>Toda la serie (pasado y futuro)</span>
											</label>
										</div>
									</div>
								)}

								<div className="flex gap-2 pt-2">
									<button
										type="submit"
										className="w-1/2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold py-2.5 rounded-xl text-xs transition-all active:scale-95 shadow-md shadow-indigo-600/10"
									>
										Guardar
									</button>
									<button
										type="button"
										onClick={() => setEditingTx(null)}
										className="w-1/2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold py-2.5 rounded-xl text-xs transition-all"
									>
										Cancelar
									</button>
								</div>
							</form>
						</div>
					</div>
				)}
			</main>

			{/* FOOTER */}
			<footer className="border-t border-slate-900 bg-slate-950 py-8 mt-12 text-slate-600 text-center text-xs">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-2">
					<p>FinanzasPro © {new Date().getFullYear()} - Herramienta de Planificación Financiera Profesional.</p>
					<p className="text-[10px] text-slate-700">
						Construido bajo SOLID y buenas prácticas. Soporte para pnpm en entornos de desarrollo.
					</p>
				</div>
			</footer>
		</div>
	);
}
