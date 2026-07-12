import { useMemo } from 'react';
import type {
	Account,
	Transaction,
	Period,
	Debt,
	ConsolidationForm,
	ClassicDebt,
	TagBreakdown
} from '../types';
import {
	calculateDebtMonthlyPayment,
	calculateMonthlyPayment,
	getPaymentPlanRemainingAmount,
	calculateTimelineBalances,
	getTagBreakdown,
	isClassicDebt,
	getEffectiveAmount,
	calculateDebtRemainingPrincipal,
	calculateDebtRemainingInterests,
	calculateProjections,
	type MonthBalanceData,
	type ProjectedMonthData
} from '../services/financeService';
import { addMonthsToMonth, normalizeMonth } from '../utils/dateUtils';
import { toNumber } from '../utils/formatters';

interface UseFinancialSelectorsParams {
	periods: Period[];
	transactions: Transaction[];
	debts: Debt[];
	accounts: Account[];
	viewMode: 'all' | 'userA' | 'userB';
	profileCount: 1 | 2;
	selectedMonth: string;
	selectedDebtsForConsolidation: string[];
	consolidationForm: ConsolidationForm;
}

export const useFinancialSelectors = ({
	periods,
	transactions,
	debts,
	accounts,
	viewMode,
	profileCount,
	selectedMonth,
	selectedDebtsForConsolidation,
	consolidationForm
}: UseFinancialSelectorsParams) => {
	const timelineBalances = useMemo(() => {
		return calculateTimelineBalances(periods, transactions, debts, accounts, viewMode, profileCount);
	}, [periods, transactions, debts, accounts, viewMode, profileCount]);

	const projections = useMemo(() => {
		return calculateProjections(
			periods,
			transactions,
			debts,
			accounts,
			viewMode,
			profileCount,
			timelineBalances,
			12
		);
	}, [periods, transactions, debts, accounts, viewMode, profileCount, timelineBalances]);

	const activePeriodData = useMemo(() => {
		return timelineBalances[selectedMonth] ?? {
			month: selectedMonth,
			openingBalance: 0,
			incomes: 0,
			expenses: 0,
			debtPayments: 0,
			netBalance: 0,
			closingBalance: 0,
			accountBalances: {}
		};
	}, [timelineBalances, selectedMonth]);

	const totalIncomes = activePeriodData.incomes;
	const totalExpenses = activePeriodData.expenses;
	const totalMonthlyDebtPayments = activePeriodData.debtPayments;
	const netMonthlyBalance = activePeriodData.netBalance;
	const currentOpeningBalance = activePeriodData.openingBalance;
	const currentClosingBalance = activePeriodData.closingBalance;

	const filteredTransactions = useMemo(() => {
		return transactions
			.filter((t) => t.date.substring(0, 7) === selectedMonth)
			.sort((a, b) => {
				const dateCompare = b.date.localeCompare(a.date);
				if (dateCompare !== 0) return dateCompare;
				return transactions.indexOf(a) - transactions.indexOf(b);
			});
	}, [transactions, selectedMonth]);

	const getEffectiveAmountWrapper = (t: Transaction) => getEffectiveAmount(t, viewMode, accounts, profileCount);

	const recurringIncomes = useMemo(() => {
		return filteredTransactions
			.filter((t) => t.type === 'income' && t.recurrence === 'recurring')
			.reduce((sum, t) => sum + getEffectiveAmountWrapper(t), 0);
	}, [filteredTransactions, viewMode, accounts, profileCount]);

	const oneOffIncomes = useMemo(() => {
		return filteredTransactions
			.filter((t) => t.type === 'income' && t.recurrence !== 'recurring')
			.reduce((sum, t) => sum + getEffectiveAmountWrapper(t), 0);
	}, [filteredTransactions, viewMode, accounts, profileCount]);

	const recurringExpenses = useMemo(() => {
		return filteredTransactions
			.filter((t) => t.type === 'expense' && t.recurrence === 'recurring')
			.reduce((sum, t) => sum + getEffectiveAmountWrapper(t), 0);
	}, [filteredTransactions, viewMode, accounts, profileCount]);

	const oneOffExpenses = useMemo(() => {
		return filteredTransactions
			.filter((t) => t.type === 'expense' && t.recurrence !== 'recurring')
			.reduce((sum, t) => sum + getEffectiveAmountWrapper(t), 0);
	}, [filteredTransactions, viewMode, accounts, profileCount]);

	// Deudas activas en el mes seleccionado (excluyendo expiradas y futuras)
	const filteredDebts = useMemo(() => {
		return debts.filter((d) => {
			const start = normalizeMonth(d.date);
			if (start > selectedMonth) return false;
			if (isClassicDebt(d)) {
				const end = addMonthsToMonth(start, d.termMonths - 1);
				return selectedMonth <= end;
			}
			const dueMonths = d.installments.map((i) => normalizeMonth(i.dueMonth));
			const maxDueMonth = dueMonths.length > 0 ? dueMonths.reduce((max, m) => (m > max ? m : max), start) : start;
			return selectedMonth <= maxDueMonth || getPaymentPlanRemainingAmount(d) > 0;
		});
	}, [debts, selectedMonth]);

	// Gastos conjuntos pagados por cada uno (en el mes activo)
	const jointPaidByA = useMemo(() => {
		return filteredTransactions
			.filter((t) => t.type === 'expense' && t.owner === 'joint' && t.paidBy === 'userA')
			.reduce((sum, t) => sum + toNumber(t.money?.amount ?? '0'), 0);
	}, [filteredTransactions]);

	const jointPaidByB = useMemo(() => {
		return filteredTransactions
			.filter((t) => t.type === 'expense' && t.owner === 'joint' && t.paidBy === 'userB')
			.reduce((sum, t) => sum + toNumber(t.money?.amount ?? '0'), 0);
	}, [filteredTransactions]);

	const netOwed = useMemo(() => {
		return (jointPaidByA - jointPaidByB) / 2;
	}, [jointPaidByA, jointPaidByB]);

	// Desglose de etiquetas para este mes
	const tagData = useMemo(() => {
		return getTagBreakdown(
			filteredTransactions,
			filteredDebts,
			selectedMonth,
			viewMode,
			accounts,
			profileCount
		);
	}, [filteredTransactions, filteredDebts, selectedMonth, viewMode, accounts, profileCount]);

	const maxTagAmount = useMemo(() => {
		return tagData.length > 0 ? Math.max(...tagData.map((d) => d.amount)) : 1;
	}, [tagData]);

	// === SIMULACIÓN DE CONSOLIDACIÓN (RESULTADOS) ===
	const consolidatedDebtsObjects = useMemo(() => {
		return debts.filter(
			(d): d is ClassicDebt => isClassicDebt(d) && selectedDebtsForConsolidation.includes(d.id)
		);
	}, [debts, selectedDebtsForConsolidation]);

	const consolidatedPrincipal = useMemo(() => {
		return consolidatedDebtsObjects.reduce((sum, d) => {
			return sum + calculateDebtRemainingPrincipal(d, selectedMonth);
		}, 0);
	}, [consolidatedDebtsObjects, selectedMonth]);

	const additionalCapital = useMemo(() => {
		return toNumber(consolidationForm.extraCapital);
	}, [consolidationForm.extraCapital]);

	const totalNewPrincipal = useMemo(() => {
		return consolidatedPrincipal + additionalCapital;
	}, [consolidatedPrincipal, additionalCapital]);

	const currentConsolidatedMonthlySum = useMemo(() => {
		return consolidatedDebtsObjects.reduce((sum, d) => {
			return sum + calculateDebtMonthlyPayment(d, selectedMonth);
		}, 0);
	}, [consolidatedDebtsObjects, selectedMonth]);

	const currentTotalInterests = useMemo(() => {
		return consolidatedDebtsObjects.reduce((sum, d) => {
			return sum + calculateDebtRemainingInterests(d, selectedMonth);
		}, 0);
	}, [consolidatedDebtsObjects, selectedMonth]);

	const newConsolidatedCuota = useMemo(() => {
		return calculateMonthlyPayment(
			totalNewPrincipal,
			toNumber(consolidationForm.tae),
			Math.trunc(toNumber(consolidationForm.termMonths || '1'))
		);
	}, [totalNewPrincipal, consolidationForm.tae, consolidationForm.termMonths]);

	const newTotalConsolidatedPayment = useMemo(() => {
		return newConsolidatedCuota * Math.trunc(toNumber(consolidationForm.termMonths || '1'));
	}, [newConsolidatedCuota, consolidationForm.termMonths]);

	const newConsolidatedInterests = useMemo(() => {
		return Math.max(0, newTotalConsolidatedPayment - totalNewPrincipal);
	}, [newTotalConsolidatedPayment, totalNewPrincipal]);

	return {
		timelineBalances,
		projections,
		activePeriodData,
		totalIncomes,
		totalExpenses,
		totalMonthlyDebtPayments,
		netMonthlyBalance,
		currentOpeningBalance,
		currentClosingBalance,
		filteredTransactions,
		recurringIncomes,
		oneOffIncomes,
		recurringExpenses,
		oneOffExpenses,
		filteredDebts,
		jointPaidByA,
		jointPaidByB,
		netOwed,
		tagData,
		maxTagAmount,
		consolidatedDebtsObjects,
		consolidatedPrincipal,
		additionalCapital,
		totalNewPrincipal,
		currentConsolidatedMonthlySum,
		currentTotalInterests,
		newConsolidatedCuota,
		newTotalConsolidatedPayment,
		newConsolidatedInterests
	};
};
