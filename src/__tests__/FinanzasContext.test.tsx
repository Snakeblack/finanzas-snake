import { describe, it, expect } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { FinanzasProvider } from '../context/FinanzasContext';
import { useFinanzas } from '../hooks/useFinanzas';

// Componente helper para interactuar con el contexto durante las pruebas
const TestComponent = () => {
	const {
		userAName,
		accounts,
		transactions,
		periods,
		txForm,
		setTxForm,
		handleAddTransaction,
		handleDeleteTransaction,
		handleCreateNextMonth
	} = useFinanzas();

	return (
		<form onSubmit={handleAddTransaction} data-testid="tx-form">
			<div data-testid="userA">{userAName}</div>
			<div data-testid="accounts-count">{accounts.length}</div>
			<div data-testid="tx-count">{transactions.length}</div>
			<div data-testid="periods-count">{periods.length}</div>
			
			<input 
				data-testid="input-desc"
				value={txForm.desc} 
				onChange={(e) => setTxForm(prev => ({ ...prev, desc: e.target.value }))} 
			/>
			<input 
				data-testid="input-amount"
				value={txForm.amount} 
				onChange={(e) => setTxForm(prev => ({ ...prev, amount: e.target.value }))} 
			/>
			<input 
				data-testid="input-account"
				value={txForm.accountId} 
				onChange={(e) => setTxForm(prev => ({ ...prev, accountId: e.target.value }))} 
			/>

			<button type="submit" data-testid="btn-add-tx">
				Add Tx
			</button>

			<button 
				type="button"
				data-testid="btn-delete-tx"
				onClick={() => {
					if (transactions.length > 0) {
						handleDeleteTransaction(transactions[0].id);
					}
				}}
			>
				Delete Tx
			</button>

			<button 
				type="button"
				data-testid="btn-create-next-month"
				onClick={handleCreateNextMonth}
			>
				Next Month
			</button>
		</form>
	);
};

describe('Integración de FinanzasContext', () => {
	it('debe inicializar el estado financiero por defecto', () => {
		render(
			<FinanzasProvider>
				<TestComponent />
			</FinanzasProvider>
		);

		expect(screen.getByTestId('userA')).toHaveTextContent('Usuario A');
		// Tres cuentas por defecto: Efectivo A, Efectivo B y Cuenta Común
		expect(screen.getByTestId('accounts-count')).toHaveTextContent('3');
		expect(screen.getByTestId('tx-count')).toHaveTextContent('0');
		expect(screen.getByTestId('periods-count')).toHaveTextContent('0');
	});

	it('debe permitir agregar y eliminar transacciones', async () => {
		render(
			<FinanzasProvider>
				<TestComponent />
			</FinanzasProvider>
		);

		// Cambiar inputs
		fireEvent.change(screen.getByTestId('input-desc'), { target: { value: 'Movimiento Test' } });
		fireEvent.change(screen.getByTestId('input-amount'), { target: { value: '150' } });

		const submitForm = screen.getByTestId('tx-form');
		await act(async () => {
			fireEvent.submit(submitForm);
		});

		expect(screen.getByTestId('tx-count')).toHaveTextContent('1');

		const deleteBtn = screen.getByTestId('btn-delete-tx');
		await act(async () => {
			deleteBtn.click();
		});

		expect(screen.getByTestId('tx-count')).toHaveTextContent('0');
	});

	it('debe permitir generar el mes siguiente', async () => {
		// Inicializamos localStorage ANTES de renderizar
		localStorage.setItem('finanzas_v3_cleared_v2', 'true');
		localStorage.setItem('finanzas_v3_periods', JSON.stringify([{ month: '2026-05', openingBalance: 1000 }]));

		render(
			<FinanzasProvider>
				<TestComponent />
			</FinanzasProvider>
		);

		expect(screen.getByTestId('periods-count')).toHaveTextContent('1');

		const nextMonthBtn = screen.getByTestId('btn-create-next-month');
		await act(async () => {
			nextMonthBtn.click();
		});

		expect(screen.getByTestId('periods-count')).toHaveTextContent('2');
	});
});
