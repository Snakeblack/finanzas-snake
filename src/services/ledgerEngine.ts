import Big from 'big.js';
import type { Transaction, Account, CurrencyCode } from '../types';

/**
 * Proyecta los saldos reales de las cuentas procesando secuencialmente el flujo inmutable de transacciones.
 */
export const computeCurrentBalances = (
	accounts: Account[],
	transactions: Transaction[],
	targetCurrency: CurrencyCode = 'EUR'
): Record<string, string> => {
	const balances: Record<string, Big> = {};

	// Inicializar saldos con el balance de apertura de cada cuenta
	accounts.forEach((acc) => {
		balances[acc.id] = new Big(acc.initialBalance.toString());
	});

	// Ordenación cronológica estricta para garantizar consistencia temporal
	const sortedTx = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

	sortedTx.forEach((tx) => {
		if (!tx.money || tx.money.currency !== targetCurrency) return; // Omitir temporalmente descalces de FX o transacciones sin money
		const amt = new Big(tx.money.amount);

		if (tx.type === 'income' && tx.accountId) {
			balances[tx.accountId] = (balances[tx.accountId] || new Big(0)).plus(amt);
		} else if (tx.type === 'expense' && tx.accountId) {
			balances[tx.accountId] = (balances[tx.accountId] || new Big(0)).minus(amt);
		} else if (tx.type === 'transfer' && tx.fromAccountId && tx.toAccountId) {
			balances[tx.fromAccountId] = (balances[tx.fromAccountId] || new Big(0)).minus(amt);
			balances[tx.toAccountId] = (balances[tx.toAccountId] || new Big(0)).plus(amt);
		}
	});

	const result: Record<string, string> = {};
	Object.keys(balances).forEach((id) => {
		result[id] = balances[id].toFixed(2);
	});
	return result;
};
