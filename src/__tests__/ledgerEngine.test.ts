import { describe, it, expect } from 'vitest';
import { computeCurrentBalances } from '../services/ledgerEngine';
import type { Account, Transaction } from '../types';

describe('ledgerEngine - computeCurrentBalances', () => {
	const mockAccounts: Account[] = [{ id: 'acc1', name: 'Cuenta EUR', owner: 'userA', initialBalance: 1000.0 }];

	it('debe acumular correctamente transacciones en la divisa objetivo', () => {
		const transactions: Transaction[] = [
			{
				id: 'tx1',
				desc: 'Nómina',
				type: 'income',
				accountId: 'acc1',
				date: '2026-05-01',
				money: { amount: '1500.00', currency: 'EUR' },
				tag: 'Sueldo'
			},
			{
				id: 'tx2',
				desc: 'Compra Supermercado',
				type: 'expense',
				accountId: 'acc1',
				date: '2026-05-02',
				money: { amount: '50.50', currency: 'EUR' },
				tag: 'Alimentación'
			}
		];

		const balances = computeCurrentBalances(mockAccounts, transactions, 'EUR');
		// 1000 + 1500 - 50.50 = 2449.50
		expect(balances['acc1']).toBe('2449.50');
	});

	it('debe convertir transacciones en USD a EUR usando tasas estáticas cuando la divisa objetivo es EUR', () => {
		const transactions: Transaction[] = [
			{
				id: 'tx1',
				desc: 'Freelance USD',
				type: 'income',
				accountId: 'acc1',
				date: '2026-05-01',
				money: { amount: '100.00', currency: 'USD' },
				tag: 'Freelance'
			}
		];

		const balances = computeCurrentBalances(mockAccounts, transactions, 'EUR');
		// USD -> EUR tasa = 0.92
		// 1000 + 100 * 0.92 = 1092.00
		expect(balances['acc1']).toBe('1092.00');
	});

	it('debe realizar transferencias entre cuentas correctamente convirtiendo importes si es necesario', () => {
		const accounts: Account[] = [
			{ id: 'acc1', name: 'Cuenta A', owner: 'userA', initialBalance: 500.0 },
			{ id: 'acc2', name: 'Cuenta B', owner: 'userB', initialBalance: 200.0 }
		];

		const transactions: Transaction[] = [
			{
				id: 'tx1',
				desc: 'Transferencia interna en USD',
				type: 'transfer',
				fromAccountId: 'acc1',
				toAccountId: 'acc2',
				date: '2026-05-01',
				money: { amount: '50.00', currency: 'USD' },
				tag: 'Traspaso'
			}
		];

		const balances = computeCurrentBalances(accounts, transactions, 'EUR');
		// USD -> EUR tasa = 0.92, 50 USD = 46.00 EUR
		// acc1: 500 - 46 = 454.00
		// acc2: 200 + 46 = 246.00
		expect(balances['acc1']).toBe('454.00');
		expect(balances['acc2']).toBe('246.00');
	});
});
