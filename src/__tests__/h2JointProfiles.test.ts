import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { SyntheticEvent } from 'react';
import { useAccounts } from '../hooks/useAccounts';
import { useDebts } from '../hooks/useDebts';
import { useFinancialSelectors } from '../hooks/useFinancialSelectors';
import {
	calculateTimelineBalances,
	generatePaymentPlanInstallments,
	getTagBreakdown
} from '../services/financeService';
import { setCryptoKey } from '../services/storageService';
import type { Account, Debt, Period, Transaction } from '../types';

const submit = { preventDefault: () => {} } as unknown as SyntheticEvent<HTMLFormElement>;

const tx = (id: string, extra: Partial<Transaction> = {}): Transaction => ({
	id,
	desc: `Movimiento ${id}`,
	money: { amount: '100.00', currency: 'EUR' },
	type: 'expense',
	tag: 'Hogar',
	date: '2026-11-10',
	recurrence: 'one-off',
	owner: 'joint',
	paidBy: 'userA',
	...extra
});

beforeEach(() => {
	localStorage.clear();
	setCryptoKey(null);
});

describe('Con un perfil, cuentas y deudas quedan a nombre de la persona', () => {
	it('la segunda cuenta que se da de alta no queda conjunta', () => {
		const { result } = renderHook(() => useAccounts(1));

		act(() => result.current.setAccountForm({ name: 'Primera', owner: 'userA', initialBalance: '100' }));
		act(() => result.current.handleAddAccount(submit));
		act(() => result.current.setAccountForm((prev) => ({ ...prev, name: 'Segunda', initialBalance: '50' })));
		act(() => result.current.handleAddAccount(submit));

		const added = result.current.accounts.filter((a) => a.name === 'Primera' || a.name === 'Segunda');
		expect(added.map((a) => a.owner)).toEqual(['userA', 'userA']);
		expect(result.current.accountForm.owner).toBe('userA');
	});

	it('editar una cuenta guardada como conjunta la pasa a la persona', () => {
		const { result } = renderHook(() => useAccounts(1));
		const stored: Account = { id: 'old-joint', name: 'Vieja', owner: 'joint', initialBalance: 0 };

		act(() => result.current.setAccounts([stored]));
		act(() => result.current.handleStartEditAccount(stored));
		act(() => result.current.handleSaveEditAccount(submit));

		expect(result.current.accounts.find((a) => a.id === 'old-joint')?.owner).toBe('userA');
		expect(result.current.accountForm.owner).toBe('userA');
	});

	it('la segunda deuda que se da de alta no queda conjunta', () => {
		const { result } = renderHook(() =>
			useDebts({ initialDebtFormDate: '2026-11', onDebtDeleted: () => {}, profileCount: 1 })
		);
		const fillClassic = (desc: string) =>
			act(() =>
				result.current.setDebtForm((prev) => ({
					...prev,
					kind: 'classic',
					desc,
					principal: '1200',
					tae: '5',
					termMonths: '12'
				}))
			);

		fillClassic('Préstamo 1');
		act(() => result.current.handleAddDebt(submit));
		fillClassic('Préstamo 2');
		act(() => result.current.handleAddDebt(submit));

		expect(result.current.debts.map((d) => d.owner)).toEqual(['userA', 'userA']);
		expect(result.current.debtForm.owner).toBe('userA');
	});

	it('la segunda deuda de un fraccionamiento tampoco queda conjunta', () => {
		const { result } = renderHook(() =>
			useDebts({ initialDebtFormDate: '2026-11', onDebtDeleted: () => {}, profileCount: 1 })
		);
		const fillPlan = (desc: string) =>
			act(() =>
				result.current.setDebtForm((prev) => ({
					...prev,
					kind: 'paymentPlan',
					desc,
					financedAmount: '300',
					fees: '0',
					tranches: [{ id: `t-${desc}`, months: '3', amount: '100' }]
				}))
			);

		fillPlan('Plan 1');
		act(() => result.current.handleAddDebt(submit));
		fillPlan('Plan 2');
		act(() => result.current.handleAddDebt(submit));

		expect(result.current.debts.map((d) => d.owner)).toEqual(['userA', 'userA']);
	});
});

describe('El saldo inicial negativo conserva su signo', () => {
	it('al crear y al editar una cuenta', () => {
		const { result } = renderHook(() => useAccounts(2));

		act(() => result.current.setAccountForm({ name: 'Tarjeta', owner: 'userA', initialBalance: '-250.50' }));
		act(() => result.current.handleAddAccount(submit));
		const card = result.current.accounts.find((a) => a.name === 'Tarjeta');
		expect(card?.initialBalance).toBe(-250.5);

		act(() => result.current.handleStartEditAccount(card as Account));
		act(() => result.current.setAccountForm((prev) => ({ ...prev, initialBalance: '-10' })));
		act(() => result.current.handleSaveEditAccount(submit));
		expect(result.current.accounts.find((a) => a.name === 'Tarjeta')?.initialBalance).toBe(-10);
	});
});

describe('En vista individual cada movimiento y cuota cuenta por la cuenta que mueve', () => {
	const accounts: Account[] = [
		{ id: 'a1', name: 'Nómina A', owner: 'userA', initialBalance: 1000 },
		{ id: 'b1', name: 'Nómina B', owner: 'userB', initialBalance: 500 },
		{ id: 'j1', name: 'Común', owner: 'joint', initialBalance: 400 }
	];
	const periods: Period[] = [{ month: '2026-11', openingBalance: 1900, isManualInit: true }];
	const jointPlanFromA: Debt = {
		id: 'plan',
		kind: 'paymentPlan',
		desc: 'Sofá a plazos',
		financedAmount: 60,
		fees: 0,
		totalToPay: 60,
		installments: generatePaymentPlanInstallments('plan', '2026-11', [{ id: 't1', months: '1', amount: '60' }]),
		tag: 'Hogar',
		date: '2026-11',
		owner: 'joint',
		paymentAccountId: 'a1'
	};
	const transactions: Transaction[] = [
		// Gasto común que adelanta A desde su cuenta
		tx('joint-from-a', { accountId: 'a1' }),
		// Gasto personal de B pagado desde la cuenta común
		tx('b-from-joint', {
			owner: 'userB',
			paidBy: 'shared',
			accountId: 'j1',
			money: { amount: '40.00', currency: 'EUR' }
		}),
		// Ingreso común que entra en la cuenta de B
		tx('joint-income-b', {
			type: 'income',
			paidBy: 'userB',
			accountId: 'b1',
			money: { amount: '30.00', currency: 'EUR' }
		})
	];

	it.each(['userA', 'userB', 'all'] as const)('vista %s: Apertura + Ingresos − Gastos − Deuda = Cierre', (view) => {
		const month = calculateTimelineBalances(periods, transactions, [jointPlanFromA], accounts, view, 2)['2026-11'];

		const reconciled = month.openingBalance + month.incomes - month.expenses - month.debtPayments;
		expect(reconciled).toBeCloseTo(month.closingBalance, 2);
	});

	it('vista de A: el gasto y la cuota que adelanta cuentan enteros; el gasto de B desde la común, a medias', () => {
		const month = calculateTimelineBalances(periods, transactions, [jointPlanFromA], accounts, 'userA', 2)[
			'2026-11'
		];

		expect(month.expenses).toBe(120);
		expect(month.debtPayments).toBe(60);
		expect(month.incomes).toBe(0);
	});

	it('el desglose por etiqueta usa el mismo reparto que el cierre', () => {
		const breakdown = getTagBreakdown(transactions, [jointPlanFromA], '2026-11', 'userA', accounts, 2);

		expect(breakdown.find((b) => b.tag === 'Hogar')?.amount).toBe(180);
	});
});

describe('La liquidación de «Cuentas del mes» convierte la divisa', () => {
	it('suma en EUR los gastos comunes pagados en otra divisa', () => {
		const transactions: Transaction[] = [
			tx('usd', { paidBy: 'userA', money: { amount: '100.00', currency: 'USD' } }),
			tx('eur', { paidBy: 'userB', money: { amount: '50.00', currency: 'EUR' } })
		];
		const { result } = renderHook(() =>
			useFinancialSelectors({
				periods: [{ month: '2026-11', openingBalance: 0, isManualInit: true }],
				transactions,
				debts: [],
				accounts: [],
				viewMode: 'all',
				profileCount: 2,
				selectedMonth: '2026-11',
				selectedDebtsForConsolidation: [],
				consolidationForm: { tae: '', termMonths: '', extraCapital: '' }
			})
		);

		expect(result.current.jointPaidByA).toBe(92);
		expect(result.current.jointPaidByB).toBe(50);
		expect(result.current.netOwed).toBe(21);
	});
});
