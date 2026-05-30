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
		handleCreateNextMonth,
		editForm,
		setEditForm,
		setEditScope,
		handleStartEditTransaction,
		handleSaveEditTransaction
	} = useFinanzas();

	return (
		<div>
			<form onSubmit={handleAddTransaction} data-testid="tx-form">
				<div data-testid="userA">{userAName}</div>
				<div data-testid="accounts-count">{accounts.length}</div>
				<div data-testid="tx-count">{transactions.length}</div>
				<div data-testid="periods-count">{periods.length}</div>
				<div data-testid="txs-list">
					{transactions.map((t) => (
						<div key={t.id} data-testid={`tx-item-${t.id}`} data-desc={t.desc} data-date={t.date} data-recurrence={t.recurrence || 'one-off'}>
							{t.desc} - {t.date} - {t.recurrence}
						</div>
					))}
				</div>
				
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

			<form onSubmit={handleSaveEditTransaction} data-testid="edit-tx-form">
				<button 
					type="button"
					data-testid="btn-start-edit-tx"
					onClick={() => {
						if (transactions.length > 0) {
							handleStartEditTransaction(transactions[0]);
						}
					}}
				>
					Start Edit
				</button>
				<button
					type="button"
					data-testid="btn-set-edit-recurring"
					onClick={() => setEditForm(prev => ({ ...prev, recurrence: 'recurring' }))}
				>
					Set Edit Recurring
				</button>
				<button
					type="button"
					data-testid="btn-set-edit-one-off"
					onClick={() => setEditForm(prev => ({ ...prev, recurrence: 'one-off' }))}
				>
					Set Edit One-Off
				</button>
				<button
					type="button"
					data-testid="btn-set-scope-future"
					onClick={() => setEditScope('future')}
				>
					Set Scope Future
				</button>
				<button
					type="button"
					data-testid="btn-set-scope-all"
					onClick={() => setEditScope('all')}
				>
					Set Scope All
				</button>
				<button type="submit" data-testid="btn-save-edit-tx">
					Save Edit
				</button>
			</form>
		</div>
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

	it('debe permitir cambiar una transacción de puntual a recurrente y propagarla a meses futuros', async () => {
		localStorage.setItem('finanzas_v3_cleared_v2', 'true');
		localStorage.setItem('finanzas_v3_periods', JSON.stringify([{ month: '2026-05', openingBalance: 1000 }]));

		render(
			<FinanzasProvider>
				<TestComponent />
			</FinanzasProvider>
		);

		// Añadir transacción puntual
		fireEvent.change(screen.getByTestId('input-desc'), { target: { value: 'Movimiento Puntual' } });
		fireEvent.change(screen.getByTestId('input-amount'), { target: { value: '50' } });
		const submitForm = screen.getByTestId('tx-form');
		await act(async () => {
			fireEvent.submit(submitForm);
		});

		expect(screen.getByTestId('tx-count')).toHaveTextContent('1');

		// Generar mes siguiente
		const nextMonthBtn = screen.getByTestId('btn-create-next-month');
		await act(async () => {
			nextMonthBtn.click();
		});

		// Debería seguir habiendo 1 transacción (porque es puntual)
		expect(screen.getByTestId('tx-count')).toHaveTextContent('1');

		// Iniciar edición
		const startEditBtn = screen.getByTestId('btn-start-edit-tx');
		await act(async () => {
			startEditBtn.click();
		});

		// Marcar como recurrente en el editForm
		const setEditRecurringBtn = screen.getByTestId('btn-set-edit-recurring');
		await act(async () => {
			setEditRecurringBtn.click();
		});

		// Guardar edición
		const editFormSubmit = screen.getByTestId('edit-tx-form');
		await act(async () => {
			fireEvent.submit(editFormSubmit);
		});

		// Al volverse recurrente y existir 2 periodos (2026-05 y 2026-06), se debe haber clonado al futuro
		expect(screen.getByTestId('tx-count')).toHaveTextContent('2');
	});

	it('debe permitir cambiar una transacción de recurrente a puntual y actualizarla en cascada', async () => {
		localStorage.setItem('finanzas_v3_cleared_v2', 'true');
		localStorage.setItem('finanzas_v3_periods', JSON.stringify([
			{ month: '2026-05', openingBalance: 1000 },
			{ month: '2026-06', openingBalance: 1000 }
		]));
		localStorage.setItem('finanzas_v3_transactions', JSON.stringify([
			{
				id: 'recurring-tx-1',
				desc: 'Movimiento Recurrente',
				amount: 80,
				type: 'expense',
				tag: 'Otros',
				date: '2026-05-15',
				recurrence: 'recurring',
				owner: 'joint',
				paidBy: 'shared',
				accountId: 'default-joint'
			},
			{
				id: 'recurring-tx-1-2026-06',
				desc: 'Movimiento Recurrente',
				amount: 80,
				type: 'expense',
				tag: 'Otros',
				date: '2026-06-15',
				recurrence: 'recurring',
				originId: 'recurring-tx-1',
				owner: 'joint',
				paidBy: 'shared',
				accountId: 'default-joint'
			}
		]));

		render(
			<FinanzasProvider>
				<TestComponent />
			</FinanzasProvider>
		);

		// Debería haber 2 transacciones en total
		expect(screen.getByTestId('tx-count')).toHaveTextContent('2');

		// Iniciar edición
		const startEditBtn = screen.getByTestId('btn-start-edit-tx');
		await act(async () => {
			startEditBtn.click();
		});

		// Marcar como puntual (one-off) en el editForm
		const setEditOneOffBtn = screen.getByTestId('btn-set-edit-one-off');
		await act(async () => {
			setEditOneOffBtn.click();
		});

		// Configurar alcance a 'future'
		const setScopeFutureBtn = screen.getByTestId('btn-set-scope-future');
		await act(async () => {
			setScopeFutureBtn.click();
		});

		// Guardar edición
		const editFormSubmit = screen.getByTestId('edit-tx-form');
		await act(async () => {
			fireEvent.submit(editFormSubmit);
		});

		// Al volverse puntual con alcance 'future', ambas ocurrencias (la actual y la futura)
		// deben pasar a ser 'one-off'.
		const txsList = screen.getByTestId('txs-list');
		const items = txsList.querySelectorAll('[data-testid^="tx-item-"]');
		expect(items).toHaveLength(2);
		
		items.forEach((item) => {
			expect(item.getAttribute('data-recurrence')).toBe('one-off');
		});
	});
});
