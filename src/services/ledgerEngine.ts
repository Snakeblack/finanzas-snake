import Big from 'big.js';
import type { Transaction, Account, CurrencyCode } from '../types';

/**
 * Tasas de cambio estáticas para la conversión multi-moneda (D5).
 */
export const STATIC_EXCHANGE_RATES: Record<CurrencyCode, Record<CurrencyCode, number>> = {
	EUR: { EUR: 1.0, USD: 1.09, GBP: 0.86 },
	USD: { EUR: 0.92, USD: 1.0, GBP: 0.79 },
	GBP: { EUR: 1.16, USD: 1.27, GBP: 1.0 }
};

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
		if (!tx.money) return;

		const amt = new Big(tx.money.amount);
		let amtInTarget = amt;

		// D5: Convertir divisa si es diferente a targetCurrency
		if (tx.money.currency !== targetCurrency) {
			const rate = STATIC_EXCHANGE_RATES[tx.money.currency]?.[targetCurrency];
			if (rate === undefined) return; // Ignorar si no hay tasa de conversión disponible
			amtInTarget = amt.times(rate);
		}

		if (tx.type === 'income' && tx.accountId) {
			balances[tx.accountId] = (balances[tx.accountId] || new Big(0)).plus(amtInTarget);
		} else if (tx.type === 'expense' && tx.accountId) {
			balances[tx.accountId] = (balances[tx.accountId] || new Big(0)).minus(amtInTarget);
		} else if (tx.type === 'transfer' && tx.fromAccountId && tx.toAccountId) {
			balances[tx.fromAccountId] = (balances[tx.fromAccountId] || new Big(0)).minus(amtInTarget);
			balances[tx.toAccountId] = (balances[tx.toAccountId] || new Big(0)).plus(amtInTarget);
		}
	});

	const result: Record<string, string> = {};
	Object.keys(balances).forEach((id) => {
		result[id] = balances[id].toFixed(2);
	});
	return result;
};
