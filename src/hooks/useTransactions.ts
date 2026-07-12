import { useState, type Dispatch, type SetStateAction, type SyntheticEvent } from 'react';
import type { Account, Period, Transaction, TxForm, TransactionRecurrence } from '../types';
import { DEFAULT_TAGS } from '../constants';
import { getInitialData } from '../services/storageService';
import { getValidDateForMonth } from '../utils/dateUtils';

interface UseTransactionsParams {
	/** Valor inicial de `editForm.date` (mes actual al montar, `YYYY-MM`). */
	currentMonthString: string;
	/** Valor inicial de `txForm.date` (mes seleccionado al montar, `YYYY-MM`). */
	initialSelectedMonth: string;
	/** Cuentas vigentes: las leen los handlers (owner/paidBy efectivos) y el sync de `txForm`. */
	accounts: Account[];
	/** Periodos vigentes: los handlers propagan recurrencias a los meses futuros existentes. */
	periods: Period[];
	profileCount?: 1 | 2;
}

export interface UseTransactionsResult {
	transactions: Transaction[];
	setTransactions: Dispatch<SetStateAction<Transaction[]>>;
	txForm: TxForm;
	setTxForm: Dispatch<SetStateAction<TxForm>>;
	editingTx: Transaction | null;
	setEditingTx: Dispatch<SetStateAction<Transaction | null>>;
	editForm: TxForm;
	setEditForm: Dispatch<SetStateAction<TxForm>>;
	editScope: 'only-this' | 'future' | 'all';
	setEditScope: Dispatch<SetStateAction<'only-this' | 'future' | 'all'>>;
	handleAddTransaction: (e: SyntheticEvent<HTMLFormElement>, customForm?: TxForm) => void;
	handleStartEditTransaction: (tx: Transaction) => void;
	handleSaveEditTransaction: (e: SyntheticEvent<HTMLFormElement>, customForm?: TxForm) => void;
	handleDeleteTransaction: (id: string) => void;
}

/**
 * Encapsula el dominio de transacciones: estado (`transactions`, `txForm`, `editingTx`,
 * `editForm`, `editScope`) y sus manejadores de alta/edición/baja, incluida la propagación
 * de recurrentes a los meses futuros. Extraído de `FinanzasContext` (D1).
 *
 * Los handlers leen `accounts` y `periods` (que siguen en el contexto) a nivel de evento, así
 * que se reciben como params. La persistencia (`saveStoredTransactions`) y los derivados
 * (`filteredTransactions`, totales) siguen en el contexto, que reusa `transactions`/`setTransactions`.
 */
export const useTransactions = ({
	currentMonthString,
	initialSelectedMonth,
	accounts,
	periods,
	profileCount = 2
}: UseTransactionsParams): UseTransactionsResult => {
	const isSingle = profileCount === 1;
	const [transactions, setTransactions] = useState<Transaction[]>(() => getInitialData().transactions);
	const [editingTx, setEditingTx] = useState<Transaction | null>(null);
	const [editForm, setEditForm] = useState<TxForm>({
		desc: '',
		amount: '',
		currency: 'EUR',
		type: 'expense',
		tag: DEFAULT_TAGS.expense[0],
		date: `${currentMonthString}-01`,
		recurrence: 'one-off',
		owner: isSingle ? 'userA' : 'joint',
		paidBy: isSingle ? 'userA' : 'shared',
		accountId: '',
		fromAccountId: '',
		toAccountId: ''
	});
	const [editScope, setEditScope] = useState<'only-this' | 'future' | 'all'>('only-this');
	const [txForm, setTxForm] = useState<TxForm>({
		desc: '',
		amount: '',
		currency: 'EUR',
		type: 'expense',
		tag: DEFAULT_TAGS.expense[0],
		date: `${initialSelectedMonth}-01`,
		recurrence: 'one-off',
		owner: isSingle ? 'userA' : 'joint',
		paidBy: isSingle ? 'userA' : 'shared',
		accountId: '',
		fromAccountId: '',
		toAccountId: ''
	});

	// Asegurar coherencia si profileCount cambia en caliente
	const [prevProfileCount, setPrevProfileCount] = useState(profileCount);
	if (profileCount !== prevProfileCount) {
		setPrevProfileCount(profileCount);
		if (profileCount === 1) {
			setTxForm((prev) => ({
				...prev,
				owner: 'userA',
				paidBy: 'userA'
			}));
			setEditForm((prev) => ({
				...prev,
				owner: 'userA',
				paidBy: 'userA'
			}));
		}
	}

	// Mantiene las cuentas referenciadas por `txForm` válidas cuando cambia el set de cuentas.
	const [prevAccounts, setPrevAccounts] = useState(accounts);
	if (accounts !== prevAccounts) {
		setPrevAccounts(accounts);
		if (accounts.length > 0) {
			const firstJoint = accounts.find((a) => a.owner === 'joint')?.id || accounts[0].id;
			setTxForm((prev) => ({
				...prev,
				accountId:
					prev.accountId && accounts.some((a) => a.id === prev.accountId) ? prev.accountId : firstJoint,
				fromAccountId:
					prev.fromAccountId && accounts.some((a) => a.id === prev.fromAccountId)
						? prev.fromAccountId
						: accounts[0].id,
				toAccountId:
					prev.toAccountId && accounts.some((a) => a.id === prev.toAccountId)
						? prev.toAccountId
						: accounts[1]?.id || accounts[0].id
			}));
		}
	}

	const handleAddTransaction = (e: SyntheticEvent<HTMLFormElement>, customForm?: TxForm) => {
		e.preventDefault();
		const formToUse = customForm || txForm;
		if (!formToUse.desc || !formToUse.amount) return;

		const amountVal = parseFloat(formToUse.amount);
		if (isNaN(amountVal) || amountVal <= 0) return;

		const getTransferOwner = (fromId?: string, toId?: string) => {
			const fromAcc = accounts.find((a) => a.id === fromId);
			const toAcc = accounts.find((a) => a.id === toId);
			if (fromAcc && toAcc) {
				if (fromAcc.owner === toAcc.owner) return fromAcc.owner;
			}
			return 'joint';
		};

		const getEffectiveOwner = () => {
			if (formToUse.type === 'transfer') {
				return getTransferOwner(formToUse.fromAccountId, formToUse.toAccountId);
			}
			return formToUse.owner;
		};

		const getEffectivePaidBy = (effectiveOwner: 'userA' | 'userB' | 'joint') => {
			if (effectiveOwner !== 'joint') {
				return 'shared';
			}
			if (formToUse.type !== 'transfer' && formToUse.accountId) {
				const acc = accounts.find((a) => a.id === formToUse.accountId);
				if (acc) {
					if (acc.owner === 'userA') return 'userA';
					if (acc.owner === 'userB') return 'userB';
					return 'shared';
				}
			}
			return formToUse.paidBy;
		};

		const newTxId = Date.now().toString();
		const effectiveOwner = getEffectiveOwner();
		const effectivePaidBy = getEffectivePaidBy(effectiveOwner);
		const newTx: Transaction = {
			id: newTxId,
			desc: formToUse.desc,
			money: {
				amount: Math.abs(parseFloat(formToUse.amount)).toFixed(2),
				currency: formToUse.currency || 'EUR'
			},
			type: formToUse.type,
			tag: formToUse.tag,
			date: formToUse.date,
			recurrence: formToUse.recurrence || 'one-off',
			owner: effectiveOwner,
			paidBy: effectivePaidBy,
			accountId: formToUse.type !== 'transfer' && formToUse.accountId ? formToUse.accountId : undefined,
			fromAccountId: formToUse.type === 'transfer' ? formToUse.fromAccountId : undefined,
			toAccountId: formToUse.type === 'transfer' ? formToUse.toAccountId : undefined
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
			amount: tx.money?.amount ?? '0',
			currency: tx.money?.currency ?? 'EUR',
			type: tx.type,
			tag: tx.tag,
			date: tx.date,
			recurrence: tx.recurrence || 'one-off',
			owner: tx.owner || 'joint',
			paidBy: tx.paidBy || 'shared',
			accountId: tx.accountId || '',
			fromAccountId: tx.fromAccountId || accounts[0]?.id || '',
			toAccountId: tx.toAccountId || accounts[1]?.id || accounts[0]?.id || ''
		});
		setEditScope('only-this');
	};

	const handleSaveEditTransaction = (e: SyntheticEvent<HTMLFormElement>, customForm?: TxForm) => {
		e.preventDefault();
		const formToUse = customForm || editForm;
		if (!editingTx || !formToUse.desc || !formToUse.amount) return;

		const updatedAmount = Math.abs(parseFloat(formToUse.amount));
		if (isNaN(updatedAmount) || updatedAmount <= 0) return;
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
			if (formToUse.type === 'transfer') {
				return getTransferOwner(formToUse.fromAccountId, formToUse.toAccountId);
			}
			return formToUse.owner;
		};

		const getEffectivePaidBy = (effectiveOwner: 'userA' | 'userB' | 'joint') => {
			if (effectiveOwner !== 'joint') {
				return 'shared';
			}
			if (formToUse.type !== 'transfer' && formToUse.accountId) {
				const acc = accounts.find((a) => a.id === formToUse.accountId);
				if (acc) {
					if (acc.owner === 'userA') return 'userA';
					if (acc.owner === 'userB') return 'userB';
					return 'shared';
				}
			}
			return formToUse.paidBy;
		};

		const effectiveOwner = getEffectiveOwner();
		const effectivePaidBy = getEffectivePaidBy(effectiveOwner);
		const updatedFields = {
			desc: formToUse.desc,
			type: formToUse.type,
			tag: formToUse.tag,
			owner: effectiveOwner,
			paidBy: effectivePaidBy,
			accountId: formToUse.type !== 'transfer' && formToUse.accountId ? formToUse.accountId : undefined,
			fromAccountId: formToUse.type === 'transfer' ? formToUse.fromAccountId : undefined,
			toAccountId: formToUse.type === 'transfer' ? formToUse.toAccountId : undefined
		};

		const wasOneOff = editingTx.recurrence !== 'recurring';
		const isNowRecurring = formToUse.recurrence === 'recurring';

		setTransactions((prev) => {
			let updatedTxs = prev.map((t): Transaction => {
				const isTarget = t.id === editingTx.id;

				if (editingTx.recurrence === 'recurring') {
					if (editScope === 'only-this') {
						if (isTarget) {
							return {
								...t,
								...updatedFields,
								money: {
									amount: updatedAmount.toFixed(2),
									currency: formToUse.currency || 'EUR'
								},
								date: formToUse.date,
								recurrence: 'one-off',
								originId: undefined
							};
						}
					} else if (editScope === 'future') {
						const isFutureOccurrence =
							t.id === editingTx.id || (t.originId === rootId && t.date.substring(0, 7) >= currentMonth);
						if (isFutureOccurrence) {
							const targetRecurrence: TransactionRecurrence = formToUse.recurrence || 'one-off';
							return {
								...t,
								...updatedFields,
								money: {
									amount: updatedAmount.toFixed(2),
									currency: formToUse.currency || 'EUR'
								},
								date: t.id === editingTx.id ? formToUse.date : t.date,
								recurrence: targetRecurrence,
								originId: targetRecurrence === 'recurring' ? t.originId : undefined
							};
						}
					} else if (editScope === 'all') {
						const isAnyOccurrence = t.id === rootId || t.originId === rootId;
						if (isAnyOccurrence) {
							const targetRecurrence: TransactionRecurrence = formToUse.recurrence || 'one-off';
							return {
								...t,
								...updatedFields,
								money: {
									amount: updatedAmount.toFixed(2),
									currency: formToUse.currency || 'EUR'
								},
								date: t.id === editingTx.id ? formToUse.date : t.date,
								recurrence: targetRecurrence,
								originId: targetRecurrence === 'recurring' ? t.originId : undefined
							};
						}
					}
				} else {
					if (isTarget) {
						return {
							...t,
							...updatedFields,
							money: {
								amount: updatedAmount.toFixed(2),
								currency: formToUse.currency || 'EUR'
							},
							date: formToUse.date,
							recurrence: (formToUse.recurrence || 'one-off') as TransactionRecurrence
						};
					}
				}
				return t;
			});

			if (wasOneOff && isNowRecurring) {
				const currentMonth = formToUse.date.substring(0, 7);
				const dayPart = formToUse.date.substring(8, 10);
				const futureMonths = periods
					.map((p) => p.month)
					.filter((m) => m > currentMonth)
					.sort();

				const propagatedClones: Transaction[] = [];
				futureMonths.forEach((m) => {
					const cloneId = `${editingTx.id}-${m}`;
					if (!updatedTxs.some((t) => t.id === cloneId)) {
						propagatedClones.push({
							...editingTx,
							...updatedFields,
							money: {
								amount: updatedAmount.toFixed(2),
								currency: formToUse.currency || 'EUR'
							},
							id: cloneId,
							date: getValidDateForMonth(m, dayPart),
							recurrence: 'recurring',
							originId: editingTx.id
						});
					}
				});
				updatedTxs = [...propagatedClones, ...updatedTxs];
			}

			return updatedTxs;
		});

		setEditingTx(null);
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

	return {
		transactions,
		setTransactions,
		txForm,
		setTxForm,
		editingTx,
		setEditingTx,
		editForm,
		setEditForm,
		editScope,
		setEditScope,
		handleAddTransaction,
		handleStartEditTransaction,
		handleSaveEditTransaction,
		handleDeleteTransaction
	};
};
