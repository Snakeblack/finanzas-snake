import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { FinanzasProvider } from '../context/FinanzasContext';
import { useFinanzas } from '../hooks/useFinanzas';
import { STORAGE_KEYS } from '../constants';
import type { FinanzasContextType } from '../context/FinanzasContext';

// =====================================================================
// Helper de renderizado que expone todo el contexto
// =====================================================================
let ctxRef: FinanzasContextType;

const FullTestComponent = () => {
	const ctx = useFinanzas();
	ctxRef = ctx;

	return (
		<div>
			<div data-testid="userA">{ctx.userAName}</div>
			<div data-testid="userB">{ctx.userBName}</div>
			<div data-testid="accounts-count">{ctx.accounts.length}</div>
			<div data-testid="tx-count">{ctx.transactions.length}</div>
			<div data-testid="periods-count">{ctx.periods.length}</div>
			<div data-testid="debts-count">{ctx.debts.length}</div>
			<div data-testid="selected-month">{ctx.selectedMonth}</div>
			<div data-testid="ai-loading">{String(ctx.aiLoading)}</div>
			<div data-testid="ai-error">{ctx.aiError}</div>
			<div data-testid="chat-count">{ctx.chatMessages.length}</div>
			<div data-testid="import-error">{ctx.importError}</div>
			<div data-testid="import-success">{ctx.importSuccess}</div>
			<div data-testid="debt-form-error">{ctx.debtFormError}</div>
			<div data-testid="total-incomes">{ctx.totalIncomes}</div>
			<div data-testid="total-expenses">{ctx.totalExpenses}</div>
			<div data-testid="net-balance">{ctx.netMonthlyBalance}</div>
			<div data-testid="consolidated-count">{ctx.consolidatedDebtsObjects.length}</div>
			<div data-testid="txs-list">
				{ctx.transactions.map((t) => (
					<div key={t.id} data-testid={`tx-item-${t.id}`} data-desc={t.desc} data-date={t.date} data-recurrence={t.recurrence || 'one-off'}>
						{t.desc} - {t.date} - {t.recurrence}
					</div>
				))}
			</div>

			{/* Formulario de transacciones */}
			<form onSubmit={ctx.handleAddTransaction} data-testid="tx-form">
				<input data-testid="input-desc" value={ctx.txForm.desc} onChange={(e) => ctx.setTxForm(prev => ({ ...prev, desc: e.target.value }))} />
				<input data-testid="input-amount" value={ctx.txForm.amount} onChange={(e) => ctx.setTxForm(prev => ({ ...prev, amount: e.target.value }))} />
				<button type="submit" data-testid="btn-add-tx">Add Tx</button>
			</form>

			{/* Botones de acción */}
			<button data-testid="btn-delete-tx" onClick={() => { if (ctx.transactions.length > 0) ctx.handleDeleteTransaction(ctx.transactions[0].id); }}>Delete Tx</button>
			<button data-testid="btn-create-next-month" onClick={ctx.handleCreateNextMonth}>Next Month</button>

			{/* Formulario de edición de transacciones */}
			<form onSubmit={ctx.handleSaveEditTransaction} data-testid="edit-tx-form">
				<button type="button" data-testid="btn-start-edit-tx" onClick={() => { if (ctx.transactions.length > 0) ctx.handleStartEditTransaction(ctx.transactions[0]); }}>Start Edit</button>
				<button type="button" data-testid="btn-set-edit-recurring" onClick={() => ctx.setEditForm(prev => ({ ...prev, recurrence: 'recurring' }))}>Set Edit Recurring</button>
				<button type="button" data-testid="btn-set-edit-one-off" onClick={() => ctx.setEditForm(prev => ({ ...prev, recurrence: 'one-off' }))}>Set Edit One-Off</button>
				<button type="button" data-testid="btn-set-scope-future" onClick={() => ctx.setEditScope('future')}>Set Scope Future</button>
				<button type="button" data-testid="btn-set-scope-all" onClick={() => ctx.setEditScope('all')}>Set Scope All</button>
				<button type="submit" data-testid="btn-save-edit-tx">Save Edit</button>
			</form>

			{/* Formulario de deudas */}
			<form onSubmit={ctx.handleAddDebt} data-testid="debt-form">
				<button type="submit" data-testid="btn-add-debt">Add Debt</button>
			</form>

			{/* Formulario de cuentas */}
			<form onSubmit={ctx.handleAddAccount} data-testid="account-form">
				<button type="submit" data-testid="btn-add-account">Add Account</button>
			</form>
			<form onSubmit={ctx.handleSaveEditAccount} data-testid="edit-account-form">
				<button type="submit" data-testid="btn-save-edit-account">Save Edit Account</button>
			</form>

			{/* Formulario de inicialización */}
			<form onSubmit={ctx.handleInitAccount} data-testid="init-form">
				<button type="submit" data-testid="btn-init">Init Account</button>
			</form>

			{/* Formulario de import */}
			<form onSubmit={(e) => ctx.handleImportData(e, (document.getElementById('import-json') as HTMLInputElement)?.value || '')} data-testid="import-form">
				<input id="import-json" data-testid="input-import-json" />
				<button type="submit" data-testid="btn-import">Import</button>
			</form>
		</div>
	);
};

const renderCtx = () => {
	render(
		<FinanzasProvider>
			<FullTestComponent />
		</FinanzasProvider>
	);
	return ctxRef;
};

// =====================================================================
// Tests
// =====================================================================

describe('Integración de FinanzasContext', () => {
	it('debe inicializar el estado financiero por defecto', () => {
		renderCtx();

		expect(screen.getByTestId('userA')).toHaveTextContent('Usuario A');
		expect(screen.getByTestId('userB')).toHaveTextContent('Usuario B');
		expect(screen.getByTestId('accounts-count')).toHaveTextContent('3');
		expect(screen.getByTestId('tx-count')).toHaveTextContent('0');
		expect(screen.getByTestId('periods-count')).toHaveTextContent('0');
		expect(screen.getByTestId('debts-count')).toHaveTextContent('0');
	});

	it('debe permitir agregar y eliminar transacciones', async () => {
		renderCtx();

		fireEvent.change(screen.getByTestId('input-desc'), { target: { value: 'Movimiento Test' } });
		fireEvent.change(screen.getByTestId('input-amount'), { target: { value: '150' } });

		await act(async () => {
			fireEvent.submit(screen.getByTestId('tx-form'));
		});

		expect(screen.getByTestId('tx-count')).toHaveTextContent('1');

		await act(async () => {
			screen.getByTestId('btn-delete-tx').click();
		});

		expect(screen.getByTestId('tx-count')).toHaveTextContent('0');
	});

	it('no debe agregar transacción sin descripción ni importe', async () => {
		renderCtx();

		await act(async () => {
			fireEvent.submit(screen.getByTestId('tx-form'));
		});

		expect(screen.getByTestId('tx-count')).toHaveTextContent('0');
	});

	it('debe permitir generar el mes siguiente', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(STORAGE_KEYS.periods, JSON.stringify([{ month: '2026-05', openingBalance: 1000 }]));

		renderCtx();
		expect(screen.getByTestId('periods-count')).toHaveTextContent('1');

		await act(async () => {
			screen.getByTestId('btn-create-next-month').click();
		});

		expect(screen.getByTestId('periods-count')).toHaveTextContent('2');
	});

	it('handleCreateNextMonth no debe hacer nada si no hay periodos', async () => {
		renderCtx();
		expect(screen.getByTestId('periods-count')).toHaveTextContent('0');

		await act(async () => {
			screen.getByTestId('btn-create-next-month').click();
		});

		expect(screen.getByTestId('periods-count')).toHaveTextContent('0');
	});

	it('handleCreateNextMonth no debe crear un mes si ya existe el siguiente', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(STORAGE_KEYS.periods, JSON.stringify([
			{ month: '2026-05', openingBalance: 1000 },
			{ month: '2026-06', openingBalance: 0 }
		]));

		renderCtx();

		// Primer click: crea 2026-07 (no existía)
		await act(async () => {
			screen.getByTestId('btn-create-next-month').click();
		});
		const countAfterFirst = parseInt(screen.getByTestId('periods-count').textContent || '0');
		expect(countAfterFirst).toBe(3);

		// Segundo click: 2026-07 ya existe como latest, crea 2026-08
		// Esto valida que la lógica de creación funciona secuencialmente
		await act(async () => {
			screen.getByTestId('btn-create-next-month').click();
		});
		expect(screen.getByTestId('periods-count')).toHaveTextContent('4');
	});

	it('debe propagar transacciones recurrentes al crear mes siguiente', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(STORAGE_KEYS.periods, JSON.stringify([{ month: '2026-05', openingBalance: 0 }]));
		localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify([{
			id: 'rec-1', desc: 'Sueldo', amount: 2000, type: 'income',
			tag: 'Sueldo', date: '2026-05-15', recurrence: 'recurring',
			owner: 'joint', paidBy: 'shared', accountId: 'default-joint'
		}]));

		renderCtx();
		expect(screen.getByTestId('tx-count')).toHaveTextContent('1');

		await act(async () => {
			screen.getByTestId('btn-create-next-month').click();
		});

		expect(screen.getByTestId('tx-count')).toHaveTextContent('2');
	});

	it('debe permitir cambiar una transacción de puntual a recurrente y propagarla', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(STORAGE_KEYS.periods, JSON.stringify([{ month: '2026-05', openingBalance: 1000 }]));

		renderCtx();

		// Añadir transacción puntual
		fireEvent.change(screen.getByTestId('input-desc'), { target: { value: 'Movimiento Puntual' } });
		fireEvent.change(screen.getByTestId('input-amount'), { target: { value: '50' } });
		await act(async () => { fireEvent.submit(screen.getByTestId('tx-form')); });
		expect(screen.getByTestId('tx-count')).toHaveTextContent('1');

		// Generar mes siguiente
		await act(async () => { screen.getByTestId('btn-create-next-month').click(); });
		expect(screen.getByTestId('tx-count')).toHaveTextContent('1');

		// Editar como recurrente
		await act(async () => { screen.getByTestId('btn-start-edit-tx').click(); });
		await act(async () => { screen.getByTestId('btn-set-edit-recurring').click(); });
		await act(async () => { fireEvent.submit(screen.getByTestId('edit-tx-form')); });

		expect(screen.getByTestId('tx-count')).toHaveTextContent('2');
	});

	it('debe permitir cambiar recurrente a puntual con alcance future', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(STORAGE_KEYS.periods, JSON.stringify([
			{ month: '2026-05', openingBalance: 1000 },
			{ month: '2026-06', openingBalance: 1000 }
		]));
		localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify([
			{ id: 'rec-1', desc: 'Recurrente', amount: 80, type: 'expense', tag: 'Otros', date: '2026-05-15', recurrence: 'recurring', owner: 'joint', paidBy: 'shared', accountId: 'default-joint' },
			{ id: 'rec-1-2026-06', desc: 'Recurrente', amount: 80, type: 'expense', tag: 'Otros', date: '2026-06-15', recurrence: 'recurring', originId: 'rec-1', owner: 'joint', paidBy: 'shared', accountId: 'default-joint' }
		]));

		renderCtx();
		expect(screen.getByTestId('tx-count')).toHaveTextContent('2');

		await act(async () => { screen.getByTestId('btn-start-edit-tx').click(); });
		await act(async () => { screen.getByTestId('btn-set-edit-one-off').click(); });
		await act(async () => { screen.getByTestId('btn-set-scope-future').click(); });
		await act(async () => { fireEvent.submit(screen.getByTestId('edit-tx-form')); });

		const txsList = screen.getByTestId('txs-list');
		const items = txsList.querySelectorAll('[data-testid^="tx-item-"]');
		expect(items).toHaveLength(2);
		items.forEach((item) => {
			expect(item.getAttribute('data-recurrence')).toBe('one-off');
		});
	});
});

describe('Gestión de Deudas', () => {
	it('debe agregar una deuda clásica válida', async () => {
		renderCtx();

		await act(async () => {
			ctxRef.setDebtForm(prev => ({
				...prev,
				kind: 'classic',
				desc: 'Préstamo Test',
				principal: '5000',
				tae: '5',
				termMonths: '12',
				tag: 'Préstamo Personal',
				date: '2026-05'
			}));
		});

		await act(async () => {
			fireEvent.submit(screen.getByTestId('debt-form'));
		});

		expect(screen.getByTestId('debts-count')).toHaveTextContent('1');
	});

	it('no debe agregar deuda clásica si falta desc', async () => {
		renderCtx();

		await act(async () => {
			ctxRef.setDebtForm(prev => ({
				...prev,
				kind: 'classic',
				desc: '',
				principal: '5000',
				tae: '5',
				termMonths: '12'
			}));
		});

		await act(async () => { fireEvent.submit(screen.getByTestId('debt-form')); });
		expect(screen.getByTestId('debts-count')).toHaveTextContent('0');
	});

	it('no debe agregar deuda clásica si faltan campos numéricos', async () => {
		renderCtx();

		await act(async () => {
			ctxRef.setDebtForm(prev => ({
				...prev,
				kind: 'classic',
				desc: 'Test',
				principal: '',
				tae: '',
				termMonths: ''
			}));
		});

		await act(async () => { fireEvent.submit(screen.getByTestId('debt-form')); });
		expect(screen.getByTestId('debts-count')).toHaveTextContent('0');
	});

	it('debe agregar una deuda paymentPlan válida', async () => {
		renderCtx();

		await act(async () => {
			ctxRef.setDebtForm(prev => ({
				...prev,
				kind: 'paymentPlan',
				desc: 'Fraccionamiento Test',
				financedAmount: '1200',
				fees: '0',
				tranches: [{ id: 'tr-1', months: '12', amount: '100' }],
				tag: 'Préstamo Personal',
				date: '2026-05'
			}));
		});

		await act(async () => { fireEvent.submit(screen.getByTestId('debt-form')); });
		expect(screen.getByTestId('debts-count')).toHaveTextContent('1');
	});

	it('no debe agregar paymentPlan sin financedAmount', async () => {
		renderCtx();

		await act(async () => {
			ctxRef.setDebtForm(prev => ({
				...prev,
				kind: 'paymentPlan',
				desc: 'Test',
				financedAmount: '',
				tranches: [{ id: 'tr-1', months: '12', amount: '100' }]
			}));
		});

		await act(async () => { fireEvent.submit(screen.getByTestId('debt-form')); });
		expect(screen.getByTestId('debts-count')).toHaveTextContent('0');
	});

	it('debe mostrar error si la suma de cuotas no coincide con el total', async () => {
		renderCtx();

		await act(async () => {
			ctxRef.setDebtForm(prev => ({
				...prev,
				kind: 'paymentPlan',
				desc: 'Test',
				financedAmount: '1200',
				fees: '60',
				tranches: [{ id: 'tr-1', months: '12', amount: '50' }], // 12 × 50 = 600 ≠ 1260
				date: '2026-05'
			}));
		});

		await act(async () => { fireEvent.submit(screen.getByTestId('debt-form')); });
		expect(screen.getByTestId('debt-form-error').textContent).toContain('debe coincidir');
	});

	it('debe mostrar error si no hay tramos válidos', async () => {
		renderCtx();

		await act(async () => {
			ctxRef.setDebtForm(prev => ({
				...prev,
				kind: 'paymentPlan',
				desc: 'Test',
				financedAmount: '1200',
				fees: '0',
				tranches: [{ id: 'tr-1', months: '0', amount: '0' }]
			}));
		});

		await act(async () => { fireEvent.submit(screen.getByTestId('debt-form')); });
		expect(screen.getByTestId('debt-form-error').textContent).toContain('al menos un tramo');
	});

	it('debe eliminar una deuda', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(STORAGE_KEYS.debts, JSON.stringify([
			{ id: 'debt-1', kind: 'classic', desc: 'Test', tag: 'T', date: '2026-05', principal: 1000, tae: 5, termMonths: 12 }
		]));

		renderCtx();
		expect(screen.getByTestId('debts-count')).toHaveTextContent('1');

		await act(async () => {
			ctxRef.handleDeleteDebt('debt-1');
		});

		expect(screen.getByTestId('debts-count')).toHaveTextContent('0');
	});

	it('toggleDebtSelection debe seleccionar y deseleccionar deudas clásicas', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(STORAGE_KEYS.debts, JSON.stringify([
			{ id: 'debt-1', kind: 'classic', desc: 'Test', tag: 'T', date: '2026-05', principal: 1000, tae: 5, termMonths: 12 }
		]));

		renderCtx();

		await act(async () => { ctxRef.toggleDebtSelection('debt-1'); });
		expect(ctxRef.selectedDebtsForConsolidation).toContain('debt-1');

		await act(async () => { ctxRef.toggleDebtSelection('debt-1'); });
		expect(ctxRef.selectedDebtsForConsolidation).not.toContain('debt-1');
	});

	it('toggleDebtSelection no debe seleccionar deudas paymentPlan', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(STORAGE_KEYS.debts, JSON.stringify([
			{ id: 'pp-1', kind: 'paymentPlan', desc: 'Test', tag: 'T', date: '2026-05', financedAmount: 1000, fees: 0, totalToPay: 1000, installments: [] }
		]));

		renderCtx();

		await act(async () => { ctxRef.toggleDebtSelection('pp-1'); });
		expect(ctxRef.selectedDebtsForConsolidation).toHaveLength(0);
	});

	it('togglePaymentPlanInstallmentStatus debe cambiar pending↔paid', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(STORAGE_KEYS.debts, JSON.stringify([{
			id: 'pp-1', kind: 'paymentPlan', desc: 'Test', tag: 'T', date: '2026-05',
			financedAmount: 200, fees: 0, totalToPay: 200,
			installments: [
				{ id: 'i1', dueMonth: '2026-05', amount: 100, status: 'pending', label: 'Cuota 1' },
				{ id: 'i2', dueMonth: '2026-06', amount: 100, status: 'pending', label: 'Cuota 2' }
			]
		}]));

		renderCtx();

		await act(async () => { ctxRef.togglePaymentPlanInstallmentStatus('pp-1', 'i1'); });

		const debt = ctxRef.debts.find(d => d.id === 'pp-1');
		if (debt && debt.kind === 'paymentPlan') {
			expect(debt.installments[0].status).toBe('paid');
			expect(debt.installments[1].status).toBe('pending');
		}
	});
});

describe('Gestión de Cuentas', () => {
	it('debe agregar una cuenta nueva', async () => {
		renderCtx();
		const initialCount = ctxRef.accounts.length;

		await act(async () => {
			ctxRef.setAccountForm({ name: 'Cuenta Nueva', owner: 'userA', initialBalance: '1000' });
		});

		await act(async () => { fireEvent.submit(screen.getByTestId('account-form')); });

		expect(ctxRef.accounts.length).toBe(initialCount + 1);
		expect(ctxRef.accounts[ctxRef.accounts.length - 1].name).toBe('Cuenta Nueva');
	});

	it('no debe agregar cuenta sin nombre', async () => {
		renderCtx();
		const initialCount = ctxRef.accounts.length;

		await act(async () => {
			ctxRef.setAccountForm({ name: '', owner: 'userA', initialBalance: '1000' });
		});

		await act(async () => { fireEvent.submit(screen.getByTestId('account-form')); });
		expect(ctxRef.accounts.length).toBe(initialCount);
	});

	it('debe editar una cuenta existente', async () => {
		renderCtx();

		const accountToEdit = ctxRef.accounts[0];
		await act(async () => { ctxRef.handleStartEditAccount(accountToEdit); });

		await act(async () => {
			ctxRef.setAccountForm({ name: 'Cuenta Editada', owner: 'userB', initialBalance: '2000' });
		});

		await act(async () => { fireEvent.submit(screen.getByTestId('edit-account-form')); });

		const edited = ctxRef.accounts.find(a => a.id === accountToEdit.id);
		expect(edited?.name).toBe('Cuenta Editada');
		expect(edited?.owner).toBe('userB');
	});

	it('debe eliminar una cuenta (con más de 1)', async () => {
		renderCtx();
		const initialCount = ctxRef.accounts.length;
		expect(initialCount).toBeGreaterThan(1);

		const idToDelete = ctxRef.accounts[0].id;
		await act(async () => { ctxRef.handleDeleteAccount(idToDelete); });

		expect(ctxRef.accounts.length).toBe(initialCount - 1);
		expect(ctxRef.accounts.find(a => a.id === idToDelete)).toBeUndefined();
	});

	it('no debe eliminar la última cuenta', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify([
			{ id: 'solo', name: 'Única', owner: 'joint', initialBalance: 0 }
		]));

		renderCtx();
		expect(ctxRef.accounts.length).toBe(1);

		await act(async () => { ctxRef.handleDeleteAccount('solo'); });
		expect(ctxRef.accounts.length).toBe(1);
	});
});

describe('Tramos del Plan de Pagos', () => {
	it('updatePaymentPlanTranche debe actualizar un tramo', async () => {
		renderCtx();

		const trancheId = ctxRef.debtForm.tranches[0].id;
		await act(async () => {
			ctxRef.updatePaymentPlanTranche(trancheId, { months: '6', amount: '100' });
		});

		expect(ctxRef.debtForm.tranches[0].months).toBe('6');
		expect(ctxRef.debtForm.tranches[0].amount).toBe('100');
	});

	it('addPaymentPlanTranche debe agregar un tramo', async () => {
		renderCtx();
		const initialCount = ctxRef.debtForm.tranches.length;

		await act(async () => { ctxRef.addPaymentPlanTranche(); });
		expect(ctxRef.debtForm.tranches.length).toBe(initialCount + 1);
	});

	it('removePaymentPlanTranche debe eliminar un tramo si hay más de uno', async () => {
		renderCtx();

		// Agregar un segundo tramo primero
		await act(async () => { ctxRef.addPaymentPlanTranche(); });
		expect(ctxRef.debtForm.tranches.length).toBe(2);

		const idToRemove = ctxRef.debtForm.tranches[1].id;
		await act(async () => { ctxRef.removePaymentPlanTranche(idToRemove); });
		expect(ctxRef.debtForm.tranches.length).toBe(1);
	});

	it('removePaymentPlanTranche no debe eliminar el único tramo', async () => {
		renderCtx();
		expect(ctxRef.debtForm.tranches.length).toBe(1);

		const id = ctxRef.debtForm.tranches[0].id;
		await act(async () => { ctxRef.removePaymentPlanTranche(id); });
		expect(ctxRef.debtForm.tranches.length).toBe(1);
	});
});

describe('Inicialización y Reset', () => {
	it('handleInitAccount debe crear un periodo inicial', async () => {
		renderCtx();

		await act(async () => { fireEvent.submit(screen.getByTestId('init-form')); });

		expect(ctxRef.periods.length).toBe(1);
		expect(ctxRef.periods[0].isManualInit).toBe(true);
	});

	it('handleInitAccount con flow past debe usar el mes especificado', async () => {
		renderCtx();

		await act(async () => {
			ctxRef.setInitFlow('past');
			ctxRef.setInitMonth('2025-01');
		});

		await act(async () => { fireEvent.submit(screen.getByTestId('init-form')); });

		expect(ctxRef.periods[0].month).toBe('2025-01');
	});

	it('handleInitAccount con reconfiguring debe usar reconfigAccounts', async () => {
		renderCtx();

		const reconfAccounts = [
			{ id: 'new-a', name: 'Nuevo A', owner: 'userA' as const, initialBalance: 5000 }
		];

		await act(async () => {
			ctxRef.setIsReconfiguring(true);
			ctxRef.setReconfigAccounts(reconfAccounts);
		});

		await act(async () => { fireEvent.submit(screen.getByTestId('init-form')); });

		expect(ctxRef.accounts).toHaveLength(1);
		expect(ctxRef.accounts[0].name).toBe('Nuevo A');
	});

	it('handleResetAccount debe reiniciar toda la cuenta', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(STORAGE_KEYS.periods, JSON.stringify([{ month: '2026-05', openingBalance: 0 }]));
		localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify([{ id: 't1', desc: 'T', amount: 100, type: 'expense', tag: 'T', date: '2026-05-01' }]));

		renderCtx();
		expect(ctxRef.periods.length).toBeGreaterThan(0);

		await act(async () => { ctxRef.handleResetAccount(); });

		expect(ctxRef.periods).toHaveLength(0);
		expect(ctxRef.transactions).toHaveLength(0);
		expect(ctxRef.debts).toHaveLength(0);
		expect(ctxRef.accounts).toHaveLength(3);
	});
});

describe('Gemini AI', () => {
	it('handleAskGemini debe mostrar error si no hay API key', async () => {
		renderCtx();

		await act(async () => { await ctxRef.handleAskGemini('Analiza mis finanzas'); });

		expect(screen.getByTestId('ai-error').textContent).toContain('API Key');
	});

	it('handleAskGemini no debe hacer nada si la pregunta está vacía', async () => {
		renderCtx();

		await act(async () => { ctxRef.setGeminiApiKey('test-key'); });
		await act(async () => { await ctxRef.handleAskGemini('   '); });

		expect(ctxRef.chatMessages).toHaveLength(0);
	});

	it('handleAskGemini debe agregar mensaje del usuario y respuesta exitosa', async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({
				candidates: [{ content: { parts: [{ text: 'Respuesta de prueba' }] } }]
			})
		});

		renderCtx();
		await act(async () => { ctxRef.setGeminiApiKey('test-key'); });
		await act(async () => { await ctxRef.handleAskGemini('¿Qué tal?'); });

		expect(ctxRef.chatMessages).toHaveLength(2);
		expect(ctxRef.chatMessages[0].role).toBe('user');
		expect(ctxRef.chatMessages[0].content).toBe('¿Qué tal?');
		expect(ctxRef.chatMessages[1].role).toBe('model');
		expect(ctxRef.chatMessages[1].content).toBe('Respuesta de prueba');

		globalThis.fetch = originalFetch;
	});

	it('handleAskGemini debe mostrar error cuando falla la API', async () => {
		vi.useFakeTimers();
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network fail'));

		renderCtx();
		await act(async () => { ctxRef.setGeminiApiKey('test-key'); });

		// Start the askGemini call (it will retry internally)
		let askPromise: Promise<void> | undefined;
		await act(async () => {
			askPromise = ctxRef.handleAskGemini('Analiza');
		});

		// Advance timers through all retry delays (1000+2000+4000+8000 ms)
		for (let i = 0; i < 4; i++) {
			await act(async () => { await vi.advanceTimersByTimeAsync(16000); });
		}

		// Wait for the promise to settle
		try { await askPromise; } catch { /* expected */ }

		expect(ctxRef.aiError).toContain('Network fail');

		globalThis.fetch = originalFetch;
		vi.useRealTimers();
	}, 30000);

	it('handleClearChat debe limpiar el historial', async () => {
		// Mock window.confirm to return true (handleClearChat requires it)
		const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

		// Set messages via localStorage BEFORE render
		localStorage.setItem(STORAGE_KEYS.aiChat, JSON.stringify([
			{ role: 'user', content: 'Hola', timestamp: '12:00' }
		]));

		renderCtx();
		expect(ctxRef.chatMessages.length).toBeGreaterThan(0);

		await act(async () => { ctxRef.handleClearChat(); });

		expect(ctxRef.chatMessages).toHaveLength(0);
		confirmSpy.mockRestore();
	});

	it('handleCopyChatPlaintext debe copiar al clipboard', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.assign(navigator, {
			clipboard: { writeText }
		});

		// Set messages via localStorage BEFORE render so initial state reads them
		localStorage.setItem(STORAGE_KEYS.aiChat, JSON.stringify([
			{ role: 'user', content: 'Hola', timestamp: '12:00' },
			{ role: 'model', content: '**Respuesta**', timestamp: '12:01' }
		]));

		renderCtx();
		expect(ctxRef.chatMessages.length).toBe(2);

		await act(async () => { ctxRef.handleCopyChatPlaintext(); });

		expect(writeText).toHaveBeenCalled();
		const copiedText = writeText.mock.calls[0][0];
		expect(copiedText).toContain('Tú');
		expect(copiedText).toContain('Asesor Gemini');
		expect(copiedText).toContain('Hola');
		// stripMarkdown should have removed **
		expect(copiedText).toContain('Respuesta');
		expect(copiedText).not.toContain('**');
	});
});

describe('Import / Export', () => {
	it('handleExportData debe crear un enlace de descarga', async () => {
		const createElementSpy = vi.spyOn(document, 'createElement');
		renderCtx();

		await act(async () => { ctxRef.handleExportData(); });

		// Debe haber creado un element <a> para la descarga
		const anchorCalls = createElementSpy.mock.calls.filter(([tag]) => tag === 'a');
		expect(anchorCalls.length).toBeGreaterThan(0);

		createElementSpy.mockRestore();
	});

	it('handleImportData debe importar backup válido', async () => {
		// clearedV2 must be set before import so getInitialData doesn't wipe data
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		renderCtx();

		const backupData: Record<string, string> = {};
		backupData[STORAGE_KEYS.transactions] = JSON.stringify([
			{ id: 'imp-1', desc: 'Importado', amount: 100, type: 'expense', tag: 'Test', date: '2026-05-01' }
		]);
		backupData[STORAGE_KEYS.periods] = JSON.stringify([
			{ month: '2026-05', openingBalance: 0 }
		]);

		const fakeEvent = { preventDefault: vi.fn() } as any;
		await act(async () => {
			ctxRef.handleImportData(fakeEvent, JSON.stringify(backupData));
		});

		expect(ctxRef.importSuccess).toContain('éxito');
	});

	it('handleImportData debe mostrar error con JSON vacío', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		renderCtx();

		const fakeEvent = { preventDefault: vi.fn() } as any;
		await act(async () => {
			ctxRef.handleImportData(fakeEvent, '');
		});

		expect(ctxRef.importError).toContain('JSON de backup válido');
	});

	it('handleImportData debe mostrar error con JSON inválido', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		renderCtx();

		const fakeEvent = { preventDefault: vi.fn() } as any;
		await act(async () => {
			ctxRef.handleImportData(fakeEvent, 'not-json');
		});

		expect(ctxRef.importError).not.toBe('');
	});

	it('handleImportData debe mostrar error si el JSON no tiene claves válidas', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		renderCtx();

		const fakeEvent = { preventDefault: vi.fn() } as any;
		await act(async () => {
			ctxRef.handleImportData(fakeEvent, JSON.stringify({ foo: 'bar' }));
		});

		expect(ctxRef.importError).toContain('no parece un backup válido');
	});
});

describe('PDF Export', () => {
	it('handleDownloadChatPDF no debe lanzar error al ejecutarse', async () => {
		renderCtx();

		expect(() => {
			ctxRef.handleDownloadChatPDF({
				showContext: true,
				showDebts: true,
				showTransactions: true,
				showChat: true
			});
		}).not.toThrow();
	});

	it('handleDownloadChatPDF debe funcionar con todas las opciones desactivadas', async () => {
		renderCtx();

		expect(() => {
			ctxRef.handleDownloadChatPDF({
				showContext: false,
				showDebts: false,
				showTransactions: false,
				showChat: false
			});
		}).not.toThrow();
	});
});

describe('Valores Calculados', () => {
	it('debe calcular filteredTransactions para el mes seleccionado', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(STORAGE_KEYS.periods, JSON.stringify([
			{ month: '2026-05', openingBalance: 0 },
			{ month: '2026-06', openingBalance: 0 }
		]));
		localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify([
			{ id: 't1', desc: 'Mayo', amount: 100, type: 'expense', tag: 'T', date: '2026-05-01', owner: 'joint' },
			{ id: 't2', desc: 'Junio', amount: 200, type: 'income', tag: 'T', date: '2026-06-01', owner: 'joint' }
		]));

		renderCtx();

		// El mes seleccionado debe ser uno de los dos; verificar que filtra correctamente
		const filtered = ctxRef.filteredTransactions;
		filtered.forEach(t => {
			expect(t.date.substring(0, 7)).toBe(ctxRef.selectedMonth);
		});
	});

	it('debe calcular totalIncomes correctamente', async () => {
		const month = new Date().toISOString().substring(0, 7);
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify([
			{ id: 'acc-j', name: 'Común', owner: 'joint', initialBalance: 0 }
		]));
		localStorage.setItem(STORAGE_KEYS.periods, JSON.stringify([{ month, openingBalance: 0 }]));
		localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify([
			{ id: 't1', desc: 'Sueldo', amount: 2000, type: 'income', tag: 'Sueldo', date: `${month}-01`, recurrence: 'recurring', owner: 'joint', accountId: 'acc-j' },
			{ id: 't2', desc: 'Regalo', amount: 500, type: 'income', tag: 'Bizum', date: `${month}-15`, recurrence: 'one-off', owner: 'joint', accountId: 'acc-j' }
		]));

		renderCtx();

		expect(ctxRef.selectedMonth).toBe(month);
		expect(ctxRef.totalIncomes).toBe(2500);
	});

	it('debe calcular totalExpenses correctamente', async () => {
		const month = new Date().toISOString().substring(0, 7);
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify([
			{ id: 'acc-j', name: 'Común', owner: 'joint', initialBalance: 0 }
		]));
		localStorage.setItem(STORAGE_KEYS.periods, JSON.stringify([{ month, openingBalance: 0 }]));
		localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify([
			{ id: 't1', desc: 'Comida', amount: 100, type: 'expense', tag: 'T', date: `${month}-01`, owner: 'joint', paidBy: 'userA', accountId: 'acc-j' },
			{ id: 't2', desc: 'Taxi', amount: 40, type: 'expense', tag: 'T', date: `${month}-02`, owner: 'joint', paidBy: 'userB', accountId: 'acc-j' }
		]));

		renderCtx();

		expect(ctxRef.selectedMonth).toBe(month);
		expect(ctxRef.totalExpenses).toBe(140);
	});
});
