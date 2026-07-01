import { useState, type Dispatch, type SetStateAction } from 'react';
import type { Debt, ConsolidationForm } from '../types';
import { isPaymentPlanDebt } from '../services/financeService';

export interface UseConsolidationResult {
	selectedDebtsForConsolidation: string[];
	setSelectedDebtsForConsolidation: Dispatch<SetStateAction<string[]>>;
	consolidationForm: ConsolidationForm;
	setConsolidationForm: Dispatch<SetStateAction<ConsolidationForm>>;
	toggleDebtSelection: (id: string) => void;
}

/**
 * Hook para encapsular el dominio del simulador de reunificación (consolidación) de deudas.
 * Extraído de `FinanzasContext` (D1).
 */
export const useConsolidation = (debts: Debt[]): UseConsolidationResult => {
	const [selectedDebtsForConsolidation, setSelectedDebtsForConsolidation] = useState<string[]>([]);
	const [consolidationForm, setConsolidationForm] = useState<ConsolidationForm>({
		tae: '5.5',
		termMonths: '36',
		extraCapital: ''
	});

	const toggleDebtSelection = (id: string) => {
		const debt = debts.find((item) => item.id === id);
		if (!debt || isPaymentPlanDebt(debt)) return;

		if (selectedDebtsForConsolidation.includes(id)) {
			setSelectedDebtsForConsolidation(selectedDebtsForConsolidation.filter((itemId) => itemId !== id));
		} else {
			setSelectedDebtsForConsolidation([...selectedDebtsForConsolidation, id]);
		}
	};

	return {
		selectedDebtsForConsolidation,
		setSelectedDebtsForConsolidation,
		consolidationForm,
		setConsolidationForm,
		toggleDebtSelection
	};
};
