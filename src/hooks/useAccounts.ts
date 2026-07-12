import { useState, type Dispatch, type SetStateAction, type SyntheticEvent } from 'react';
import type { Account } from '../types';
import { getInitialData } from '../services/storageService';
import { toNumber } from '../utils/formatters';

type AccountForm = { name: string; owner: 'userA' | 'userB' | 'joint'; initialBalance: string };

export interface UseAccountsResult {
	accounts: Account[];
	setAccounts: Dispatch<SetStateAction<Account[]>>;
	editingAccount: Account | null;
	setEditingAccount: Dispatch<SetStateAction<Account | null>>;
	accountForm: AccountForm;
	setAccountForm: Dispatch<SetStateAction<AccountForm>>;
	handleAddAccount: (e: SyntheticEvent<HTMLFormElement>) => void;
	handleSaveEditAccount: (e: SyntheticEvent<HTMLFormElement>) => void;
	handleStartEditAccount: (acc: Account) => void;
}

/**
 * Encapsula el dominio de cuentas: estado (`accounts`, `editingAccount`, `accountForm`) y los
 * handlers puros de alta/edición. Extraído de `FinanzasContext` (D1).
 *
 * Se llama el primero entre los hooks de dominio porque `accounts`/`setAccounts` los consumen
 * useTransactions (lectura) y los appliers de useSecurity/useBackupSync. El borrado de cuenta
 * (`handleDeleteAccount`) atraviesa transacciones y deudas, así que se queda en el contexto como
 * orquestador cross-domain. La persistencia (`saveStoredAccounts`) también sigue en el contexto.
 */
export const useAccounts = (profileCount: 1 | 2 = 2): UseAccountsResult => {
	const isSingle = profileCount === 1;
	const [accounts, setAccounts] = useState<Account[]>(() => getInitialData().accounts);
	const [editingAccount, setEditingAccount] = useState<Account | null>(null);
	const [accountForm, setAccountForm] = useState<AccountForm>({
		name: '',
		owner: isSingle ? 'userA' : 'joint',
		initialBalance: ''
	});

	// Asegurar coherencia si cambia profileCount en caliente
	const [prevProfileCount, setPrevProfileCount] = useState(profileCount);
	if (profileCount !== prevProfileCount) {
		setPrevProfileCount(profileCount);
		if (profileCount === 1) {
			setAccountForm((prev) => ({
				...prev,
				owner: 'userA'
			}));
		}
	}

	const handleAddAccount = (e: SyntheticEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!accountForm.name) return;

		const newAcc: Account = {
			id: Date.now().toString(),
			name: accountForm.name,
			owner: accountForm.owner,
			initialBalance: Math.abs(toNumber(accountForm.initialBalance))
		};

		setAccounts([...accounts, newAcc]);
		setAccountForm({ name: '', owner: 'joint', initialBalance: '' });
	};

	const handleSaveEditAccount = (e: SyntheticEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!editingAccount || !accountForm.name) return;

		const updatedBalance = Math.abs(toNumber(accountForm.initialBalance));
		setAccounts(
			accounts.map((acc) => {
				if (acc.id === editingAccount.id) {
					return {
						...acc,
						name: accountForm.name,
						owner: accountForm.owner,
						initialBalance: updatedBalance
					};
				}
				return acc;
			})
		);

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

	return {
		accounts,
		setAccounts,
		editingAccount,
		setEditingAccount,
		accountForm,
		setAccountForm,
		handleAddAccount,
		handleSaveEditAccount,
		handleStartEditAccount
	};
};
