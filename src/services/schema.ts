import { z } from 'zod';

export const MoneySchema = z.object({
	amount: z.string(),
	currency: z.enum(['EUR', 'USD', 'GBP'])
});

export const TransactionSchema = z.object({
	id: z.string(),
	desc: z.string(),
	money: MoneySchema,
	type: z.enum(['income', 'expense', 'transfer']),
	tag: z.string(),
	date: z.string(),
	recurrence: z.enum(['recurring', 'one-off']),
	owner: z.enum(['userA', 'userB', 'joint']),
	paidBy: z.enum(['userA', 'userB', 'shared']),
	accountId: z.string().optional(),
	fromAccountId: z.string().optional(),
	toAccountId: z.string().optional(),
	originId: z.string().optional()
});

export const ClassicDebtSchema = z.object({
	id: z.string(),
	kind: z.literal('classic'),
	desc: z.string(),
	tag: z.string(),
	date: z.string(),
	owner: z.enum(['userA', 'userB', 'joint']),
	paymentAccountId: z.string().optional(),
	chargeDay: z.number().int().min(1).max(31).optional(),
	recurringMonthlyCosts: z.number().optional(),
	principal: z.number(),
	openingCommission: z.number().optional(),
	tin: z.number().optional(),
	tae: z.number(),
	termMonths: z.number().int().min(1)
});

export const PaymentPlanInstallmentSchema = z.object({
	id: z.string(),
	dueMonth: z.string(),
	amount: z.number(),
	status: z.enum(['paid', 'pending']),
	label: z.string()
});

export const PaymentPlanDebtSchema = z.object({
	id: z.string(),
	kind: z.literal('paymentPlan'),
	desc: z.string(),
	tag: z.string(),
	date: z.string(),
	owner: z.enum(['userA', 'userB', 'joint']),
	paymentAccountId: z.string().optional(),
	chargeDay: z.number().int().min(1).max(31).optional(),
	recurringMonthlyCosts: z.number().optional(),
	financedAmount: z.number(),
	fees: z.number(),
	totalToPay: z.number(),
	installments: z.array(PaymentPlanInstallmentSchema)
});

export const DebtSchema = z.discriminatedUnion('kind', [ClassicDebtSchema, PaymentPlanDebtSchema]);

export const PeriodSchema = z.object({
	month: z.string(),
	openingBalance: z.number(),
	openingBalanceA: z.number().optional(),
	openingBalanceB: z.number().optional(),
	isManualInit: z.boolean().default(false)
});

export const AccountSchema = z.object({
	id: z.string(),
	name: z.string(),
	owner: z.enum(['userA', 'userB', 'joint']),
	initialBalance: z.number()
});

export const ChatMessageSchema = z.object({
	role: z.enum(['user', 'model']),
	content: z.string(),
	timestamp: z.string()
});
