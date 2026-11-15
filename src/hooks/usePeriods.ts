import { useState, type Dispatch, type SetStateAction } from 'react';
import type { Period, Transaction } from '../types';
import { getInitialData } from '../services/storageService';
import { addMonthsToMonth, cloneRecurringForMonth } from '../utils/dateUtils';

export interface UsePeriodsResult {
	periods: Period[];
	setPeriods: Dispatch<SetStateAction<Period[]>>;
	selectedMonth: string;
	setSelectedMonth: Dispatch<SetStateAction<string>>;
	handleCreateNextMonth: (
		transactions: Transaction[],
		setTransactions: Dispatch<SetStateAction<Transaction[]>>
	) => void;
}

/**
 * Hook para encapsular el dominio de períodos contables mensuales y la selección del mes activo.
 * Extraído de `FinanzasContext` (D1).
 */
export const usePeriods = (): UsePeriodsResult => {
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

	const handleCreateNextMonth = (
		transactions: Transaction[],
		setTransactions: Dispatch<SetStateAction<Transaction[]>>
	) => {
		if (periods.length === 0) return;
		const sorted = [...periods].sort((a, b) => a.month.localeCompare(b.month));
		const latestPeriod = sorted[sorted.length - 1];
		const latestMonth = latestPeriod.month;
		const nextMonth = addMonthsToMonth(latestMonth, 1);

		if (periods.some((p) => p.month === nextMonth)) {
			setSelectedMonth(nextMonth);
			return;
		}

		const newPeriod: Period = {
			month: nextMonth,
			openingBalance: 0
		};

		// Copiar movimientos recurrentes del último mes al nuevo, con las series que siguen tras «solo este»
		const cloned = cloneRecurringForMonth(transactions, latestMonth, nextMonth, latestPeriod.skippedRecurring);

		setPeriods([...periods, newPeriod]);
		if (cloned.length > 0) {
			setTransactions((prev) => [...cloned, ...prev]);
		}
		setSelectedMonth(nextMonth);
	};

	return {
		periods,
		setPeriods,
		selectedMonth,
		setSelectedMonth,
		handleCreateNextMonth
	};
};
