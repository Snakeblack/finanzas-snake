import { useState, type Dispatch, type SetStateAction, type SyntheticEvent } from 'react';
import type { Debt, DebtForm, InstallmentStatus } from '../types';
import { DEFAULT_TAGS } from '../constants';
import { readStoredDebtsSync } from '../services/storageService';
import { normalizeMonth } from '../utils/dateUtils';
import { toNumber } from '../utils/formatters';
import { generatePaymentPlanInstallments, isPaymentPlanDebt } from '../services/financeService';

interface UseDebtsParams {
	/** Valor inicial de `debtForm.date` (el mes seleccionado al montar). */
	initialDebtFormDate: string;
	/**
	 * Limpieza cross-domain al borrar una deuda: el simulador de reunificación
	 * (estado en el contexto) debe descartar la deuda de su selección.
	 */
	onDebtDeleted: (id: string) => void;
	profileCount?: 1 | 2;
}

export interface UseDebtsResult {
	debts: Debt[];
	setDebts: Dispatch<SetStateAction<Debt[]>>;
	debtForm: DebtForm;
	setDebtForm: Dispatch<SetStateAction<DebtForm>>;
	debtFormError: string;
	setDebtFormError: Dispatch<SetStateAction<string>>;
	selectedDebtSchedule: Debt | null;
	setSelectedDebtSchedule: Dispatch<SetStateAction<Debt | null>>;
	handleAddDebt: (e: SyntheticEvent<HTMLFormElement>) => void;
	handleDeleteDebt: (id: string) => void;
	updatePaymentPlanTranche: (id: string, patch: Partial<{ id: string; months: string; amount: string }>) => void;
	addPaymentPlanTranche: () => void;
	removePaymentPlanTranche: (id: string) => void;
	togglePaymentPlanInstallmentStatus: (debtId: string, installmentId: string) => void;
}

/**
 * Encapsula el dominio de deudas: estado (`debts`, `debtForm`, `debtFormError`,
 * `selectedDebtSchedule`) y sus manejadores de alta/baja y edición de tramos.
 * Extraído de `FinanzasContext` (D1).
 *
 * La persistencia (`saveStoredDebts`) y los cálculos derivados (`filteredDebts`,
 * consolidación) siguen en el contexto, que reusa `debts`/`setDebts` de este hook.
 * El borrado atraviesa el dominio de reunificación: se notifica vía `onDebtDeleted`.
 */
export const useDebts = ({ initialDebtFormDate, onDebtDeleted, profileCount = 2 }: UseDebtsParams): UseDebtsResult => {
	const isSingle = profileCount === 1;
	const [debts, setDebts] = useState<Debt[]>(() => readStoredDebtsSync());
	const [selectedDebtSchedule, setSelectedDebtSchedule] = useState<Debt | null>(null);
	const [debtForm, setDebtForm] = useState<DebtForm>({
		kind: 'classic',
		desc: '',
		principal: '',
		openingCommission: '',
		recurringMonthlyCosts: '',
		financedAmount: '',
		fees: '',
		tin: '',
		tae: '',
		termMonths: '',
		tranches: [{ id: 'initial-tranche', months: '', amount: '' }],
		tag: DEFAULT_TAGS.debt[0],
		date: initialDebtFormDate,
		chargeDay: '',
		owner: isSingle ? 'userA' : 'joint',
		paymentAccountId: ''
	});
	const [debtFormError, setDebtFormError] = useState('');

	// Asegurar coherencia si profileCount cambia en caliente
	const [prevProfileCount, setPrevProfileCount] = useState(profileCount);
	if (profileCount !== prevProfileCount) {
		setPrevProfileCount(profileCount);
		if (profileCount === 1) {
			setDebtForm((prev) => ({
				...prev,
				owner: 'userA'
			}));
		}
	}

	const handleDeleteDebt = (id: string) => {
		setDebts(debts.filter((d) => d.id !== id));
		onDebtDeleted(id);
		if (selectedDebtSchedule?.id === id) {
			setSelectedDebtSchedule(null);
		}
	};

	const handleAddDebt = (e: SyntheticEvent<HTMLFormElement>) => {
		e.preventDefault();
		setDebtFormError('');

		if (!debtForm.desc) return;

		const rawChargeDay = debtForm.chargeDay.trim();
		const chargeDay = rawChargeDay ? Math.trunc(toNumber(rawChargeDay)) : undefined;
		const recurringMonthlyCosts = Math.abs(toNumber(debtForm.recurringMonthlyCosts));
		if (chargeDay !== undefined && (chargeDay < 1 || chargeDay > 31)) {
			setDebtFormError('El día habitual de cobro debe estar entre 1 y 31.');
			return;
		}

		if (debtForm.kind === 'classic') {
			if (!debtForm.principal || !debtForm.tae || !debtForm.termMonths) return;

			const tin = debtForm.tin ? Math.abs(parseFloat(debtForm.tin)) : undefined;
			const newDebt: Debt = {
				id: Date.now().toString(),
				kind: 'classic',
				desc: debtForm.desc,
				principal: Math.abs(parseFloat(debtForm.principal)),
				openingCommission: Math.abs(toNumber(debtForm.openingCommission)),
				recurringMonthlyCosts,
				tin,
				tae: Math.abs(parseFloat(debtForm.tae)),
				termMonths: Math.abs(parseInt(debtForm.termMonths)),
				tag: debtForm.tag,
				date: normalizeMonth(debtForm.date),
				chargeDay,
				owner: debtForm.owner,
				paymentAccountId: debtForm.paymentAccountId || undefined
			};

			setDebts([newDebt, ...debts]);
			setDebtForm({
				...debtForm,
				desc: '',
				principal: '',
				openingCommission: '',
				recurringMonthlyCosts: '',
				tin: '',
				tae: '',
				termMonths: '',
				chargeDay: '',
				owner: 'joint',
				paymentAccountId: ''
			});
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
			chargeDay,
			recurringMonthlyCosts,
			owner: debtForm.owner,
			paymentAccountId: debtForm.paymentAccountId || undefined
		};

		setDebts([newDebt, ...debts]);
		setDebtForm({
			...debtForm,
			desc: '',
			financedAmount: '',
			fees: '',
			recurringMonthlyCosts: '',
			tranches: [{ id: `tranche-${Date.now()}`, months: '', amount: '' }],
			chargeDay: '',
			owner: 'joint',
			paymentAccountId: ''
		});
	};

	const updatePaymentPlanTranche = (id: string, patch: Partial<{ id: string; months: string; amount: string }>) => {
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
						? {
								...installment,
								status: (installment.status === 'paid' ? 'pending' : 'paid') as InstallmentStatus
							}
						: installment
				)
			};
		});
		setDebts(updatedDebts);
		setSelectedDebtSchedule(updatedDebts.find((debt) => debt.id === debtId) ?? null);
	};

	return {
		debts,
		setDebts,
		debtForm,
		setDebtForm,
		debtFormError,
		setDebtFormError,
		selectedDebtSchedule,
		setSelectedDebtSchedule,
		handleAddDebt,
		handleDeleteDebt,
		updatePaymentPlanTranche,
		addPaymentPlanTranche,
		removePaymentPlanTranche,
		togglePaymentPlanInstallmentStatus
	};
};
