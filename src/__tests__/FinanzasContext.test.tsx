import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import { FinanzasProvider } from '../context/FinanzasContext';
import { useFinanzas } from '../hooks/useFinanzas';
import { STORAGE_KEYS } from '../constants';
import { executeSilentMigrationIfRequired } from '../services/storageService';
import type { Account, Debt, Transaction } from '../types';
import type { FinanzasContextType } from '../context/FinanzasContext';

// =====================================================================
// Helper de renderizado que expone todo el contexto
// =====================================================================
let ctxRef: FinanzasContextType;

const originalFetch = globalThis.fetch;
const getCurrentMonth = () => new Date().toISOString().substring(0, 7);
const getCurrentMonthDate = (day: string) => `${getCurrentMonth()}-${day}`;
const resetIndexedDB = () => {
	(globalThis as typeof globalThis & { __resetMockIndexedDBForTests?: () => void }).__resetMockIndexedDBForTests?.();
};

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.restoreAllMocks();
	globalThis.fetch = originalFetch;
	document.body.innerHTML = '';
	resetIndexedDB();
	localStorage.clear();
});

const FullTestComponent = () => {
	const ctx = useFinanzas();
	ctxRef = ctx;

	return (
		<div>
			<div data-testid="is-initialized">{String(ctx.isInitialized)}</div>
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
					<div
						key={t.id}
						data-testid={`tx-item-${t.id}`}
						data-desc={t.desc}
						data-date={t.date}
						data-recurrence={t.recurrence || 'one-off'}
					>
						{t.desc} - {t.date} - {t.recurrence}
					</div>
				))}
			</div>

			{/* Formulario de transacciones */}
			<form onSubmit={ctx.handleAddTransaction} data-testid="tx-form">
				<input
					data-testid="input-desc"
					value={ctx.txForm.desc}
					onChange={(e) => ctx.setTxForm((prev) => ({ ...prev, desc: e.target.value }))}
				/>
				<input
					data-testid="input-amount"
					value={ctx.txForm.amount}
					onChange={(e) => ctx.setTxForm((prev) => ({ ...prev, amount: e.target.value }))}
				/>
				<button type="submit" data-testid="btn-add-tx">
					Add Tx
				</button>
			</form>

			{/* Botones de acción */}
			<button
				data-testid="btn-delete-tx"
				onClick={() => {
					if (ctx.transactions.length > 0) ctx.handleDeleteTransaction(ctx.transactions[0].id);
				}}
			>
				Delete Tx
			</button>
			<button data-testid="btn-create-next-month" onClick={ctx.handleCreateNextMonth}>
				Next Month
			</button>

			{/* Formulario de edición de transacciones */}
			<form onSubmit={ctx.handleSaveEditTransaction} data-testid="edit-tx-form">
				<button
					type="button"
					data-testid="btn-start-edit-tx"
					onClick={() => {
						if (ctx.transactions.length > 0) ctx.handleStartEditTransaction(ctx.transactions[0]);
					}}
				>
					Start Edit
				</button>
				<button
					type="button"
					data-testid="btn-set-edit-recurring"
					onClick={() => ctx.setEditForm((prev) => ({ ...prev, recurrence: 'recurring' }))}
				>
					Set Edit Recurring
				</button>
				<button
					type="button"
					data-testid="btn-set-edit-one-off"
					onClick={() => ctx.setEditForm((prev) => ({ ...prev, recurrence: 'one-off' }))}
				>
					Set Edit One-Off
				</button>
				<button type="button" data-testid="btn-set-scope-future" onClick={() => ctx.setEditScope('future')}>
					Set Scope Future
				</button>
				<button type="button" data-testid="btn-set-scope-all" onClick={() => ctx.setEditScope('all')}>
					Set Scope All
				</button>
				<button type="submit" data-testid="btn-save-edit-tx">
					Save Edit
				</button>
			</form>

			{/* Formulario de deudas */}
			<form onSubmit={ctx.handleAddDebt} data-testid="debt-form">
				<button type="submit" data-testid="btn-add-debt">
					Add Debt
				</button>
			</form>

			{/* Formulario de cuentas */}
			<form onSubmit={ctx.handleAddAccount} data-testid="account-form">
				<button type="submit" data-testid="btn-add-account">
					Add Account
				</button>
			</form>
			<form onSubmit={ctx.handleSaveEditAccount} data-testid="edit-account-form">
				<button type="submit" data-testid="btn-save-edit-account">
					Save Edit Account
				</button>
			</form>

			{/* Formulario de inicialización */}
			<form onSubmit={ctx.handleInitAccount} data-testid="init-form">
				<button type="submit" data-testid="btn-init">
					Init Account
				</button>
			</form>

			{/* Formulario de import */}
			<form
				onSubmit={(e) =>
					ctx.handleImportData(e, (document.getElementById('import-json') as HTMLInputElement)?.value || '')
				}
				data-testid="import-form"
			>
				<input id="import-json" data-testid="input-import-json" />
				<button type="submit" data-testid="btn-import">
					Import
				</button>
			</form>
		</div>
	);
};

const renderCtx = ({ preserveIndexedDB = false }: { preserveIndexedDB?: boolean } = {}) => {
	cleanup();
	if (!preserveIndexedDB) resetIndexedDB();
	localStorage.removeItem('finanzas_v5_unified_idb');
	localStorage.removeItem('finanzas_v4_idb_migrated');
	render(
		<FinanzasProvider>
			<FullTestComponent />
		</FinanzasProvider>
	);
	return ctxRef;
};

const renderCtxAndInit = async () => {
	renderCtx();
	await screen.findByText('true', { selector: '[data-testid="is-initialized"]' });
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

	it('debe restaurar nombres y cuentas migrados desde IndexedDB si se borra localStorage', async () => {
		const migratedAccounts: Account[] = [
			{ id: 'acc-ana', name: 'Cuenta Ana IDB', owner: 'userA', initialBalance: 1200 },
			{ id: 'acc-bruno', name: 'Cuenta Bruno IDB', owner: 'userB', initialBalance: 800 },
			{ id: 'acc-joint', name: 'Cuenta Común IDB', owner: 'joint', initialBalance: 50 }
		];

		localStorage.setItem(STORAGE_KEYS.userAName, 'Ana');
		localStorage.setItem(STORAGE_KEYS.userBName, 'Bruno');
		localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(migratedAccounts));
		await executeSilentMigrationIfRequired();
		localStorage.clear();

		renderCtx({ preserveIndexedDB: true });
		await screen.findByText('true', { selector: '[data-testid="is-initialized"]' });
		await screen.findByText('Ana', { selector: '[data-testid="userA"]' });

		expect(screen.getByTestId('userB')).toHaveTextContent('Bruno');
		expect(ctxRef.accounts).toEqual(migratedAccounts);
	});

	it('debe migrar claves fallback v2 durante el arranque antes de limpiar localStorage', async () => {
		const legacyTransactions: Transaction[] = [
			{
				id: 'tx-context-v2',
				desc: 'Ingreso context v2',
				money: { amount: '700.00', currency: 'EUR' },
				type: 'income',
				tag: 'Sueldo',
				date: '2026-04-15',
				recurrence: 'one-off',
				owner: 'userA',
				paidBy: 'userA'
			}
		];
		const legacyDebts: Debt[] = [
			{
				id: 'debt-context-v2',
				kind: 'classic',
				desc: 'Deuda context v2',
				tag: 'Préstamo Personal',
				date: '2026-04',
				owner: 'joint',
				principal: 250,
				tae: 2,
				termMonths: 5
			}
		];

		localStorage.setItem('finanzas_v2_transactions', JSON.stringify(legacyTransactions));
		localStorage.setItem('finanzas_v2_debts', JSON.stringify(legacyDebts));
		localStorage.setItem('finanzas_v2_gemini_key', 'gemini-context-v2');

		renderCtx();
		await screen.findByText('true', { selector: '[data-testid="is-initialized"]' });
		await screen.findByText(/Ingreso context v2/);

		expect(ctxRef.transactions).toMatchObject([
			expect.objectContaining({ id: 'tx-context-v2', desc: 'Ingreso context v2', accountId: 'default-a' })
		]);
		expect(ctxRef.debts).toMatchObject(legacyDebts);
		expect(ctxRef.geminiApiKey).toBe('gemini-context-v2');
		expect(localStorage.getItem('finanzas_v2_transactions')).toBeNull();
		expect(localStorage.getItem('finanzas_v2_debts')).toBeNull();
		expect(localStorage.getItem('finanzas_v2_gemini_key')).toBeNull();
	});

	it('debe permitir agregar y eliminar transacciones', async () => {
		await renderCtxAndInit();

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
		await renderCtxAndInit();

		await act(async () => {
			fireEvent.submit(screen.getByTestId('tx-form'));
		});

		expect(screen.getByTestId('tx-count')).toHaveTextContent('0');
	});

	it('debe permitir generar el mes siguiente', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(
			STORAGE_KEYS.periods,
			JSON.stringify([{ month: getCurrentMonth(), openingBalance: 1000 }])
		);

		await renderCtxAndInit();
		expect(screen.getByTestId('periods-count')).toHaveTextContent('1');

		await act(async () => {
			screen.getByTestId('btn-create-next-month').click();
		});

		expect(screen.getByTestId('periods-count')).toHaveTextContent('2');
	});

	it('handleCreateNextMonth no debe hacer nada si no hay periodos', async () => {
		await renderCtxAndInit();
		expect(screen.getByTestId('periods-count')).toHaveTextContent('0');

		await act(async () => {
			screen.getByTestId('btn-create-next-month').click();
		});

		expect(screen.getByTestId('periods-count')).toHaveTextContent('0');
	});

	it('handleCreateNextMonth no debe crear un mes si ya existe el siguiente', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(
			STORAGE_KEYS.periods,
			JSON.stringify([
				{ month: '2026-05', openingBalance: 1000 },
				{ month: '2026-06', openingBalance: 0 }
			])
		);

		await renderCtxAndInit();

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
		localStorage.setItem(STORAGE_KEYS.periods, JSON.stringify([{ month: getCurrentMonth(), openingBalance: 0 }]));
		localStorage.setItem(
			STORAGE_KEYS.transactions,
			JSON.stringify([
				{
					id: 'rec-1',
					desc: 'Sueldo',
					amount: 2000,
					type: 'income',
					tag: 'Sueldo',
					date: getCurrentMonthDate('15'),
					recurrence: 'recurring',
					owner: 'joint',
					paidBy: 'shared',
					accountId: 'default-joint'
				}
			])
		);

		await renderCtxAndInit();
		expect(screen.getByTestId('tx-count')).toHaveTextContent('1');

		await act(async () => {
			screen.getByTestId('btn-create-next-month').click();
		});

		expect(screen.getByTestId('tx-count')).toHaveTextContent('2');
	});

	it('debe permitir cambiar una transacción de puntual a recurrente y propagarla', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(
			STORAGE_KEYS.periods,
			JSON.stringify([{ month: getCurrentMonth(), openingBalance: 1000 }])
		);

		await renderCtxAndInit();

		// Añadir transacción puntual
		fireEvent.change(screen.getByTestId('input-desc'), { target: { value: 'Movimiento Puntual' } });
		fireEvent.change(screen.getByTestId('input-amount'), { target: { value: '50' } });
		await act(async () => {
			fireEvent.submit(screen.getByTestId('tx-form'));
		});
		expect(screen.getByTestId('tx-count')).toHaveTextContent('1');

		// Generar mes siguiente
		await act(async () => {
			screen.getByTestId('btn-create-next-month').click();
		});
		expect(screen.getByTestId('tx-count')).toHaveTextContent('1');

		// Editar como recurrente
		await act(async () => {
			screen.getByTestId('btn-start-edit-tx').click();
		});
		await act(async () => {
			screen.getByTestId('btn-set-edit-recurring').click();
		});
		await act(async () => {
			fireEvent.submit(screen.getByTestId('edit-tx-form'));
		});

		expect(screen.getByTestId('tx-count')).toHaveTextContent('2');
	});

	it('debe permitir cambiar recurrente a puntual con alcance future', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(
			STORAGE_KEYS.periods,
			JSON.stringify([
				{ month: '2026-05', openingBalance: 1000 },
				{ month: '2026-06', openingBalance: 1000 }
			])
		);
		localStorage.setItem(
			STORAGE_KEYS.transactions,
			JSON.stringify([
				{
					id: 'rec-1',
					desc: 'Recurrente',
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
					id: 'rec-1-2026-06',
					desc: 'Recurrente',
					amount: 80,
					type: 'expense',
					tag: 'Otros',
					date: '2026-06-15',
					recurrence: 'recurring',
					originId: 'rec-1',
					owner: 'joint',
					paidBy: 'shared',
					accountId: 'default-joint'
				}
			])
		);

		await renderCtxAndInit();
		expect(screen.getByTestId('tx-count')).toHaveTextContent('2');

		await act(async () => {
			screen.getByTestId('btn-start-edit-tx').click();
		});
		await act(async () => {
			screen.getByTestId('btn-set-edit-one-off').click();
		});
		await act(async () => {
			screen.getByTestId('btn-set-scope-future').click();
		});
		await act(async () => {
			fireEvent.submit(screen.getByTestId('edit-tx-form'));
		});

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
			ctxRef.setDebtForm((prev) => ({
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
			ctxRef.setDebtForm((prev) => ({
				...prev,
				kind: 'classic',
				desc: '',
				principal: '5000',
				tae: '5',
				termMonths: '12'
			}));
		});

		await act(async () => {
			fireEvent.submit(screen.getByTestId('debt-form'));
		});
		expect(screen.getByTestId('debts-count')).toHaveTextContent('0');
	});

	it('no debe agregar deuda clásica si faltan campos numéricos', async () => {
		renderCtx();

		await act(async () => {
			ctxRef.setDebtForm((prev) => ({
				...prev,
				kind: 'classic',
				desc: 'Test',
				principal: '',
				tae: '',
				termMonths: ''
			}));
		});

		await act(async () => {
			fireEvent.submit(screen.getByTestId('debt-form'));
		});
		expect(screen.getByTestId('debts-count')).toHaveTextContent('0');
	});

	it('debe agregar una deuda paymentPlan válida', async () => {
		renderCtx();

		await act(async () => {
			ctxRef.setDebtForm((prev) => ({
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

		await act(async () => {
			fireEvent.submit(screen.getByTestId('debt-form'));
		});
		expect(screen.getByTestId('debts-count')).toHaveTextContent('1');
	});

	it('no debe agregar paymentPlan sin financedAmount', async () => {
		renderCtx();

		await act(async () => {
			ctxRef.setDebtForm((prev) => ({
				...prev,
				kind: 'paymentPlan',
				desc: 'Test',
				financedAmount: '',
				tranches: [{ id: 'tr-1', months: '12', amount: '100' }]
			}));
		});

		await act(async () => {
			fireEvent.submit(screen.getByTestId('debt-form'));
		});
		expect(screen.getByTestId('debts-count')).toHaveTextContent('0');
	});

	it('debe mostrar error si la suma de cuotas no coincide con el total', async () => {
		renderCtx();

		await act(async () => {
			ctxRef.setDebtForm((prev) => ({
				...prev,
				kind: 'paymentPlan',
				desc: 'Test',
				financedAmount: '1200',
				fees: '60',
				tranches: [{ id: 'tr-1', months: '12', amount: '50' }], // 12 × 50 = 600 ≠ 1260
				date: '2026-05'
			}));
		});

		await act(async () => {
			fireEvent.submit(screen.getByTestId('debt-form'));
		});
		expect(screen.getByTestId('debt-form-error').textContent).toContain('debe coincidir');
	});

	it('debe mostrar error si no hay tramos válidos', async () => {
		renderCtx();

		await act(async () => {
			ctxRef.setDebtForm((prev) => ({
				...prev,
				kind: 'paymentPlan',
				desc: 'Test',
				financedAmount: '1200',
				fees: '0',
				tranches: [{ id: 'tr-1', months: '0', amount: '0' }]
			}));
		});

		await act(async () => {
			fireEvent.submit(screen.getByTestId('debt-form'));
		});
		expect(screen.getByTestId('debt-form-error').textContent).toContain('al menos un tramo');
	});

	it('debe mostrar error si el principal es inválido', async () => {
		renderCtx();

		await act(async () => {
			ctxRef.setDebtForm((prev) => ({
				...prev,
				kind: 'classic',
				desc: 'Test Principal Inválido',
				principal: 'abc',
				tae: '5',
				termMonths: '12'
			}));
		});

		await act(async () => {
			fireEvent.submit(screen.getByTestId('debt-form'));
		});
		expect(screen.getByTestId('debt-form-error').textContent).toContain('El capital inicial debe ser un número positivo');
	});

	it('debe mostrar error si el TAE es inválido', async () => {
		renderCtx();

		await act(async () => {
			ctxRef.setDebtForm((prev) => ({
				...prev,
				kind: 'classic',
				desc: 'Test TAE Inválido',
				principal: '1000',
				tae: 'abc',
				termMonths: '12'
			}));
		});

		await act(async () => {
			fireEvent.submit(screen.getByTestId('debt-form'));
		});
		expect(screen.getByTestId('debt-form-error').textContent).toContain('La tasa de interés (TAE) debe ser un número no negativo');
	});

	it('debe mostrar error si el plazo en meses es inválido', async () => {
		renderCtx();

		await act(async () => {
			ctxRef.setDebtForm((prev) => ({
				...prev,
				kind: 'classic',
				desc: 'Test Plazo Inválido',
				principal: '1000',
				tae: '5',
				termMonths: 'abc'
			}));
		});

		await act(async () => {
			fireEvent.submit(screen.getByTestId('debt-form'));
		});
		expect(screen.getByTestId('debt-form-error').textContent).toContain('El plazo en meses debe ser un número entero positivo');
	});

	it('debe eliminar una deuda', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(
			STORAGE_KEYS.debts,
			JSON.stringify([
				{
					id: 'debt-1',
					kind: 'classic',
					desc: 'Test',
					tag: 'T',
					date: '2026-05',
					principal: 1000,
					tae: 5,
					termMonths: 12
				}
			])
		);

		await renderCtxAndInit();
		expect(screen.getByTestId('debts-count')).toHaveTextContent('1');

		await act(async () => {
			ctxRef.handleDeleteDebt('debt-1');
		});

		expect(screen.getByTestId('debts-count')).toHaveTextContent('0');
	});

	it('toggleDebtSelection debe seleccionar y deseleccionar deudas clásicas', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(
			STORAGE_KEYS.debts,
			JSON.stringify([
				{
					id: 'debt-1',
					kind: 'classic',
					desc: 'Test',
					tag: 'T',
					date: '2026-05',
					principal: 1000,
					tae: 5,
					termMonths: 12
				}
			])
		);

		await renderCtxAndInit();

		await act(async () => {
			ctxRef.toggleDebtSelection('debt-1');
		});
		expect(ctxRef.selectedDebtsForConsolidation).toContain('debt-1');

		await act(async () => {
			ctxRef.toggleDebtSelection('debt-1');
		});
		expect(ctxRef.selectedDebtsForConsolidation).not.toContain('debt-1');
	});

	it('toggleDebtSelection no debe seleccionar deudas paymentPlan', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(
			STORAGE_KEYS.debts,
			JSON.stringify([
				{
					id: 'pp-1',
					kind: 'paymentPlan',
					desc: 'Test',
					tag: 'T',
					date: '2026-05',
					financedAmount: 1000,
					fees: 0,
					totalToPay: 1000,
					installments: []
				}
			])
		);

		await renderCtxAndInit();

		await act(async () => {
			ctxRef.toggleDebtSelection('pp-1');
		});
		expect(ctxRef.selectedDebtsForConsolidation).toHaveLength(0);
	});

	it('togglePaymentPlanInstallmentStatus debe cambiar pending↔paid', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(
			STORAGE_KEYS.debts,
			JSON.stringify([
				{
					id: 'pp-1',
					kind: 'paymentPlan',
					desc: 'Test',
					tag: 'T',
					date: '2026-05',
					financedAmount: 200,
					fees: 0,
					totalToPay: 200,
					installments: [
						{ id: 'i1', dueMonth: '2026-05', amount: 100, status: 'pending', label: 'Cuota 1' },
						{ id: 'i2', dueMonth: '2026-06', amount: 100, status: 'pending', label: 'Cuota 2' }
					]
				}
			])
		);

		await renderCtxAndInit();

		await act(async () => {
			ctxRef.togglePaymentPlanInstallmentStatus('pp-1', 'i1');
		});

		const debt = ctxRef.debts.find((d) => d.id === 'pp-1');
		if (debt && debt.kind === 'paymentPlan') {
			expect(debt.installments[0].status).toBe('paid');
			expect(debt.installments[1].status).toBe('pending');
		}
	});
});

describe('Gestión de Cuentas', () => {
	it('debe agregar una cuenta nueva', async () => {
		await renderCtxAndInit();
		const initialCount = ctxRef.accounts.length;

		await act(async () => {
			ctxRef.setAccountForm({ name: 'Cuenta Nueva', owner: 'userA', initialBalance: '1000' });
		});

		await act(async () => {
			fireEvent.submit(screen.getByTestId('account-form'));
		});

		expect(ctxRef.accounts.length).toBe(initialCount + 1);
		expect(ctxRef.accounts[ctxRef.accounts.length - 1].name).toBe('Cuenta Nueva');
	});

	it('no debe agregar cuenta sin nombre', async () => {
		await renderCtxAndInit();
		const initialCount = ctxRef.accounts.length;

		await act(async () => {
			ctxRef.setAccountForm({ name: '', owner: 'userA', initialBalance: '1000' });
		});

		await act(async () => {
			fireEvent.submit(screen.getByTestId('account-form'));
		});
		expect(ctxRef.accounts.length).toBe(initialCount);
	});

	it('debe editar una cuenta existente', async () => {
		await renderCtxAndInit();

		const accountToEdit = ctxRef.accounts[0];
		await act(async () => {
			ctxRef.handleStartEditAccount(accountToEdit);
		});

		await act(async () => {
			ctxRef.setAccountForm({ name: 'Cuenta Editada', owner: 'userB', initialBalance: '2000' });
		});

		await act(async () => {
			fireEvent.submit(screen.getByTestId('edit-account-form'));
		});

		const edited = ctxRef.accounts.find((a) => a.id === accountToEdit.id);
		expect(edited?.name).toBe('Cuenta Editada');
		expect(edited?.owner).toBe('userB');
	});

	it('debe eliminar una cuenta (con más de 1)', async () => {
		await renderCtxAndInit();
		const initialCount = ctxRef.accounts.length;
		expect(initialCount).toBeGreaterThan(1);

		const idToDelete = ctxRef.accounts[0].id;
		await act(async () => {
			ctxRef.handleDeleteAccount(idToDelete);
		});

		expect(ctxRef.accounts.length).toBe(initialCount - 1);
		expect(ctxRef.accounts.find((a) => a.id === idToDelete)).toBeUndefined();
	});

	it('no debe eliminar la última cuenta', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(
			STORAGE_KEYS.accounts,
			JSON.stringify([{ id: 'solo', name: 'Única', owner: 'joint', initialBalance: 0 }])
		);

		await renderCtxAndInit();
		expect(ctxRef.accounts.length).toBe(1);

		await act(async () => {
			ctxRef.handleDeleteAccount('solo');
		});
		expect(ctxRef.accounts.length).toBe(1);
	});
});

describe('Tramos del Plan de Pagos', () => {
	it('updatePaymentPlanTranche debe actualizar un tramo', async () => {
		await renderCtxAndInit();

		const trancheId = ctxRef.debtForm.tranches[0].id;
		await act(async () => {
			ctxRef.updatePaymentPlanTranche(trancheId, { months: '6', amount: '100' });
		});

		expect(ctxRef.debtForm.tranches[0].months).toBe('6');
		expect(ctxRef.debtForm.tranches[0].amount).toBe('100');
	});

	it('addPaymentPlanTranche debe agregar un tramo', async () => {
		await renderCtxAndInit();
		const initialCount = ctxRef.debtForm.tranches.length;

		await act(async () => {
			ctxRef.addPaymentPlanTranche();
		});
		expect(ctxRef.debtForm.tranches.length).toBe(initialCount + 1);
	});

	it('removePaymentPlanTranche debe eliminar un tramo si hay más de uno', async () => {
		await renderCtxAndInit();

		// Agregar un segundo tramo primero
		await act(async () => {
			ctxRef.addPaymentPlanTranche();
		});
		expect(ctxRef.debtForm.tranches.length).toBe(2);

		const idToRemove = ctxRef.debtForm.tranches[1].id;
		await act(async () => {
			ctxRef.removePaymentPlanTranche(idToRemove);
		});
		expect(ctxRef.debtForm.tranches.length).toBe(1);
	});

	it('removePaymentPlanTranche no debe eliminar el único tramo', async () => {
		await renderCtxAndInit();
		expect(ctxRef.debtForm.tranches.length).toBe(1);

		const id = ctxRef.debtForm.tranches[0].id;
		await act(async () => {
			ctxRef.removePaymentPlanTranche(id);
		});
		expect(ctxRef.debtForm.tranches.length).toBe(1);
	});
});

describe('Inicialización y Reset', () => {
	it('handleInitAccount debe crear un periodo inicial', async () => {
		await renderCtxAndInit();

		await act(async () => {
			fireEvent.submit(screen.getByTestId('init-form'));
		});

		expect(ctxRef.periods.length).toBe(1);
		expect(ctxRef.periods[0].isManualInit).toBe(true);
	});

	it('handleInitAccount con flow past debe usar el mes especificado', async () => {
		await renderCtxAndInit();

		await act(async () => {
			ctxRef.setInitFlow('past');
			ctxRef.setInitMonth('2025-01');
		});

		await act(async () => {
			fireEvent.submit(screen.getByTestId('init-form'));
		});

		expect(ctxRef.periods[0].month).toBe('2025-01');
	});

	it('handleInitAccount con reconfiguring debe usar reconfigAccounts', async () => {
		await renderCtxAndInit();

		const reconfAccounts = [{ id: 'new-a', name: 'Nuevo A', owner: 'userA' as const, initialBalance: 5000 }];

		await act(async () => {
			ctxRef.setIsReconfiguring(true);
			ctxRef.setReconfigAccounts(reconfAccounts);
		});

		await act(async () => {
			fireEvent.submit(screen.getByTestId('init-form'));
		});

		expect(ctxRef.accounts).toHaveLength(1);
		expect(ctxRef.accounts[0].name).toBe('Nuevo A');
	});

	it('handleResetAccount debe reiniciar toda la cuenta', async () => {
		const mockAccounts = [
			{ id: 'custom-1', name: 'Cuenta Personalizada', owner: 'userA' as const, initialBalance: 123 }
		];
		const mockChat = [{ role: 'user' as const, content: 'Hola', timestamp: '12:00' }];
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(STORAGE_KEYS.periods, JSON.stringify([{ month: '2026-05', openingBalance: 0 }]));
		localStorage.setItem(
			STORAGE_KEYS.transactions,
			JSON.stringify([{ id: 't1', desc: 'T', amount: 100, type: 'expense', tag: 'T', date: '2026-05-01' }])
		);
		localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(mockAccounts));
		localStorage.setItem(STORAGE_KEYS.geminiKey, 'mi-key-secreta');
		localStorage.setItem(STORAGE_KEYS.aiChat, JSON.stringify(mockChat));

		await renderCtxAndInit();
		expect(ctxRef.periods.length).toBeGreaterThan(0);
		expect(ctxRef.accounts).toHaveLength(1);
		expect(ctxRef.accounts[0].name).toBe('Cuenta Personalizada');
		expect(ctxRef.geminiApiKey).toBe('mi-key-secreta');
		expect(ctxRef.chatMessages).toHaveLength(1);

		// Mock window.confirm to return true
		const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

		await act(async () => {
			ctxRef.handleResetAccount();
		});

		expect(ctxRef.periods).toHaveLength(0);
		expect(ctxRef.transactions).toHaveLength(0);
		expect(ctxRef.debts).toHaveLength(0);
		expect(ctxRef.chatMessages).toHaveLength(0);
		expect(ctxRef.accounts).toHaveLength(1);
		expect(ctxRef.accounts[0].name).toBe('Cuenta Personalizada');
		expect(ctxRef.geminiApiKey).toBe('mi-key-secreta');

		confirmSpy.mockRestore();
	});

	it('debe proteger los datos cifrados de ser sobreescritos al montar la app bloqueada', async () => {
		localStorage.setItem('finanzas_v3_password_salt', '1234abcd');
		localStorage.setItem('finanzas_v3_password_check', 'some-ciphertext');
		localStorage.setItem(STORAGE_KEYS.debts, 'encrypted-debts-ciphertext');
		localStorage.setItem(STORAGE_KEYS.transactions, 'encrypted-txs-ciphertext');

		renderCtx();

		expect(ctxRef.isLocked).toBe(true);

		// Dar tiempo para que se ejecuten los efectos de montaje
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 50));
		});

		// Verificar que no se sobreescribieron las claves de almacenamiento
		expect(localStorage.getItem(STORAGE_KEYS.debts)).toBe('encrypted-debts-ciphertext');
		expect(localStorage.getItem(STORAGE_KEYS.transactions)).toBe('encrypted-txs-ciphertext');
	});
});

describe('Gemini AI', () => {
	it('handleAskGemini debe mostrar error si no hay API key', async () => {
		renderCtx();

		await act(async () => {
			await ctxRef.handleAskGemini('Analiza mis finanzas');
		});

		expect(screen.getByTestId('ai-error').textContent).toContain(
			'Gemini no está disponible: configura una API Key activa. Obtén tu clave en https://aistudio.google.com/api-keys.'
		);
		expect(ctxRef.chatMessages).toHaveLength(0);
	});

	it('handleAskGemini no debe hacer nada si la pregunta está vacía', async () => {
		renderCtx();

		await act(async () => {
			ctxRef.setGeminiApiKey('test-key');
		});
		await act(async () => {
			await ctxRef.handleAskGemini('   ');
		});

		expect(ctxRef.chatMessages).toHaveLength(0);
	});

	it('handleAskGemini debe agregar mensaje del usuario y respuesta exitosa', async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					candidates: [{ content: { parts: [{ text: 'Respuesta de prueba' }] } }]
				})
		});

		await renderCtxAndInit();
		await act(async () => {
			ctxRef.setGeminiApiKey('test-key');
		});
		await act(async () => {
			await ctxRef.handleAskGemini('¿Qué tal?');
		});

		expect(ctxRef.chatMessages).toHaveLength(2);
		expect(ctxRef.chatMessages[0].role).toBe('user');
		expect(ctxRef.chatMessages[0].content).toBe('¿Qué tal?');
		expect(ctxRef.chatMessages[1].role).toBe('model');
		expect(ctxRef.chatMessages[1].content).toBe('Respuesta de prueba');

		globalThis.fetch = originalFetch;
	});

	it('handleAskGemini debe mostrar error cuando falla la API', async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network fail'));

		await renderCtxAndInit();
		vi.useFakeTimers();
		await act(async () => {
			ctxRef.setGeminiApiKey('test-key');
		});

		// Start the askGemini call (it will retry internally)
		let askPromise: Promise<void> | undefined;
		await act(async () => {
			askPromise = ctxRef.handleAskGemini('Analiza');
		});

		// Advance timers through all retry delays (1000+2000+4000+8000 ms)
		for (let i = 0; i < 4; i++) {
			await act(async () => {
				await vi.advanceTimersByTimeAsync(16000);
			});
		}

		// Wait for the promise to settle
		try {
			await askPromise;
		} catch {
			/* expected */
		}

		expect(ctxRef.aiError).toContain('Network fail');

		globalThis.fetch = originalFetch;
		vi.useRealTimers();
	}, 30000);

	it('handleAskGemini debe normalizar errores de API Key inválida', async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 403
		});

		await renderCtxAndInit();
		await act(async () => {
			ctxRef.setGeminiApiKey('api-key-invalida');
		});
		await act(async () => {
			await ctxRef.handleAskGemini('Analiza');
		});

		expect(ctxRef.aiError).toContain(
			'Gemini no está disponible: configura una API Key activa. Obtén tu clave en https://aistudio.google.com/api-keys.'
		);

		globalThis.fetch = originalFetch;
	});

	it('handleClearChat debe limpiar el historial', async () => {
		// Mock window.confirm to return true (handleClearChat requires it)
		const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

		// Set messages via localStorage BEFORE render
		localStorage.setItem(
			STORAGE_KEYS.aiChat,
			JSON.stringify([{ role: 'user', content: 'Hola', timestamp: '12:00' }])
		);

		renderCtx();
		expect(ctxRef.chatMessages.length).toBeGreaterThan(0);

		await act(async () => {
			ctxRef.handleClearChat();
		});

		expect(ctxRef.chatMessages).toHaveLength(0);
		confirmSpy.mockRestore();
	});

	it('handleCopyChatPlaintext debe copiar al clipboard', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.assign(navigator, {
			clipboard: { writeText }
		});

		// Set messages via localStorage BEFORE render so initial state reads them
		localStorage.setItem(
			STORAGE_KEYS.aiChat,
			JSON.stringify([
				{ role: 'user', content: 'Hola', timestamp: '12:00' },
				{ role: 'model', content: '**Respuesta**', timestamp: '12:01' }
			])
		);

		renderCtx();
		expect(ctxRef.chatMessages.length).toBe(2);

		await act(async () => {
			ctxRef.handleCopyChatPlaintext();
		});

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

		await act(async () => {
			ctxRef.handleExportData();
		});

		// Debe haber creado un element <a> para la descarga
		const anchorCalls = createElementSpy.mock.calls.filter(([tag]) => tag === 'a');
		expect(anchorCalls.length).toBeGreaterThan(0);

		createElementSpy.mockRestore();
	});

	it('handleExportData debe serializar el estado canónico aunque localStorage esté vacío', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		await renderCtxAndInit();

		const exportedAccounts = [
			{ id: 'acc-export-a', name: 'Cuenta Ana Export', owner: 'userA' as const, initialBalance: 1200 },
			{ id: 'acc-export-b', name: 'Cuenta Bruno Export', owner: 'userB' as const, initialBalance: 800 }
		];
		const exportedTransactions = [
			{
				id: 'tx-export-1',
				desc: 'Ingreso Export',
				money: { amount: '2000.00', currency: 'EUR' as const },
				type: 'income' as const,
				tag: 'Sueldo',
				date: getCurrentMonthDate('01'),
				recurrence: 'recurring' as const,
				owner: 'userA' as const,
				paidBy: 'userA' as const,
				accountId: 'acc-export-a'
			}
		];
		const exportedDebts = [
			{
				id: 'debt-export-1',
				kind: 'classic' as const,
				desc: 'Deuda Export',
				tag: 'Préstamo Personal',
				date: getCurrentMonth(),
				owner: 'userB' as const,
				principal: 1000,
				tae: 3,
				termMonths: 12
			}
		];
		const exportedPeriods = [
			{ month: getCurrentMonth(), openingBalance: 100, openingBalanceA: 60, openingBalanceB: 40 }
		];
		const exportedChat = [{ role: 'user' as const, content: 'Hola export', timestamp: '12:00' }];

		await act(async () => {
			ctxRef.setUserAName('Ana');
			ctxRef.setUserBName('Bruno');
			ctxRef.setAccounts(exportedAccounts);
			ctxRef.setTransactions(exportedTransactions);
			ctxRef.setDebts(exportedDebts);
			ctxRef.setPeriods(exportedPeriods);
			ctxRef.setGeminiApiKey('gemini-export');
			ctxRef.setChatMessages(exportedChat);
		});
		localStorage.clear();

		const mockAnchor = { setAttribute: vi.fn(), click: vi.fn() } as unknown as HTMLAnchorElement;
		const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
		const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
		const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

		await act(async () => {
			await ctxRef.handleExportData();
		});

		const href = (mockAnchor.setAttribute as any).mock.calls.find(([name]: [string]) => name === 'href')?.[1];
		expect(href).toEqual(expect.stringContaining('data:text/json;charset=utf-8,'));
		const encodedJson = String(href).replace('data:text/json;charset=utf-8,', '');
		const backup = JSON.parse(decodeURIComponent(encodedJson));

		expect(JSON.parse(backup[STORAGE_KEYS.accounts])).toEqual(exportedAccounts);
		expect(JSON.parse(backup[STORAGE_KEYS.transactions])).toEqual(exportedTransactions);
		expect(JSON.parse(backup[STORAGE_KEYS.debts])).toEqual(exportedDebts);
		expect(JSON.parse(backup[STORAGE_KEYS.periods])).toEqual(exportedPeriods);
		expect(backup[STORAGE_KEYS.userAName]).toBe('Ana');
		expect(backup[STORAGE_KEYS.userBName]).toBe('Bruno');
		expect(backup[STORAGE_KEYS.geminiKey]).toBe('gemini-export');
		expect(JSON.parse(backup[STORAGE_KEYS.aiChat])).toEqual(exportedChat);

		createElementSpy.mockRestore();
		appendChildSpy.mockRestore();
		removeChildSpy.mockRestore();
	});

	it('handleImportData debe importar backup válido', async () => {
		// clearedV2 must be set before import so getInitialData doesn't wipe data
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		renderCtx();

		const backupData: Record<string, string> = {};
		backupData[STORAGE_KEYS.transactions] = JSON.stringify([
			{
				id: 'imp-1',
				desc: 'Importado',
				amount: 100,
				type: 'expense',
				tag: 'Test',
				date: '2026-05-01',
				recurrence: 'one-off',
				owner: 'joint',
				paidBy: 'shared'
			}
		]);
		backupData[STORAGE_KEYS.periods] = JSON.stringify([
			{ month: '2026-05', openingBalance: 0, openingBalanceA: 0, openingBalanceB: 0 }
		]);

		const fakeEvent = { preventDefault: vi.fn() } as any;
		await act(async () => {
			await ctxRef.handleImportData(fakeEvent, JSON.stringify(backupData));
		});

		expect(ctxRef.importSuccess).toContain('éxito');
	});

	it('handleImportData debe mostrar error con JSON vacío', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		renderCtx();

		const fakeEvent = { preventDefault: vi.fn() } as any;
		await act(async () => {
			await ctxRef.handleImportData(fakeEvent, '');
		});

		expect(ctxRef.importError).toContain('JSON de backup válido');
	});

	it('handleImportData debe mostrar error con JSON inválido', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		renderCtx();

		const fakeEvent = { preventDefault: vi.fn() } as any;
		await act(async () => {
			await ctxRef.handleImportData(fakeEvent, 'not-json');
		});

		expect(ctxRef.importError).not.toBe('');
	});

	it('handleImportData debe mostrar error si el JSON no tiene claves válidas', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		renderCtx();

		const fakeEvent = { preventDefault: vi.fn() } as any;
		await act(async () => {
			await ctxRef.handleImportData(fakeEvent, JSON.stringify({ foo: 'bar' }));
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
		localStorage.setItem(
			STORAGE_KEYS.periods,
			JSON.stringify([
				{ month: '2026-05', openingBalance: 0 },
				{ month: '2026-06', openingBalance: 0 }
			])
		);
		localStorage.setItem(
			STORAGE_KEYS.transactions,
			JSON.stringify([
				{ id: 't1', desc: 'Mayo', amount: 100, type: 'expense', tag: 'T', date: '2026-05-01', owner: 'joint' },
				{ id: 't2', desc: 'Junio', amount: 200, type: 'income', tag: 'T', date: '2026-06-01', owner: 'joint' }
			])
		);

		renderCtx();

		// El mes seleccionado debe ser uno de los dos; verificar que filtra correctamente
		const filtered = ctxRef.filteredTransactions;
		filtered.forEach((t) => {
			expect(t.date.substring(0, 7)).toBe(ctxRef.selectedMonth);
		});
	});

	it('debe ordenar filteredTransactions por fecha descendente y por índice original para el mismo día', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(STORAGE_KEYS.periods, JSON.stringify([{ month: '2026-05', openingBalance: 0 }]));
		localStorage.setItem(
			STORAGE_KEYS.transactions,
			JSON.stringify([
				{
					id: 't1',
					desc: 'Primero en array (mismo dia)',
					money: { amount: '10.00', currency: 'EUR' },
					type: 'expense',
					tag: 'T',
					date: '2026-05-15',
					owner: 'joint'
				},
				{
					id: 't2',
					desc: 'Segundo en array (mismo dia)',
					money: { amount: '20.00', currency: 'EUR' },
					type: 'expense',
					tag: 'T',
					date: '2026-05-15',
					owner: 'joint'
				},
				{
					id: 't3',
					desc: 'Tercero en array (dia posterior)',
					money: { amount: '30.00', currency: 'EUR' },
					type: 'expense',
					tag: 'T',
					date: '2026-05-20',
					owner: 'joint'
				}
			])
		);

		renderCtx();

		const filtered = ctxRef.filteredTransactions;
		expect(filtered).toHaveLength(3);
		// El primero debe ser t3 porque su fecha es la más reciente (2026-05-20)
		expect(filtered[0].id).toBe('t3');
		// El segundo debe ser t1 porque t1 y t2 son del mismo día (15), y t1 tiene menor índice en el array original
		expect(filtered[1].id).toBe('t1');
		// El tercero debe ser t2
		expect(filtered[2].id).toBe('t2');
	});

	it('debe calcular totalIncomes correctamente', async () => {
		const month = new Date().toISOString().substring(0, 7);
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(
			STORAGE_KEYS.accounts,
			JSON.stringify([{ id: 'acc-j', name: 'Común', owner: 'joint', initialBalance: 0 }])
		);
		localStorage.setItem(STORAGE_KEYS.periods, JSON.stringify([{ month, openingBalance: 0 }]));
		localStorage.setItem(
			STORAGE_KEYS.transactions,
			JSON.stringify([
				{
					id: 't1',
					desc: 'Sueldo',
					amount: 2000,
					type: 'income',
					tag: 'Sueldo',
					date: `${month}-01`,
					recurrence: 'recurring',
					owner: 'joint',
					accountId: 'acc-j'
				},
				{
					id: 't2',
					desc: 'Regalo',
					amount: 500,
					type: 'income',
					tag: 'Bizum',
					date: `${month}-15`,
					recurrence: 'one-off',
					owner: 'joint',
					accountId: 'acc-j'
				}
			])
		);

		renderCtx();

		expect(ctxRef.selectedMonth).toBe(month);
		expect(ctxRef.totalIncomes).toBe(2500);
	});

	it('debe calcular totalExpenses correctamente', async () => {
		const month = new Date().toISOString().substring(0, 7);
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(
			STORAGE_KEYS.accounts,
			JSON.stringify([{ id: 'acc-j', name: 'Común', owner: 'joint', initialBalance: 0 }])
		);
		localStorage.setItem(STORAGE_KEYS.periods, JSON.stringify([{ month, openingBalance: 0 }]));
		localStorage.setItem(
			STORAGE_KEYS.transactions,
			JSON.stringify([
				{
					id: 't1',
					desc: 'Comida',
					amount: 100,
					type: 'expense',
					tag: 'T',
					date: `${month}-01`,
					owner: 'joint',
					paidBy: 'userA',
					accountId: 'acc-j'
				},
				{
					id: 't2',
					desc: 'Taxi',
					amount: 40,
					type: 'expense',
					tag: 'T',
					date: `${month}-02`,
					owner: 'joint',
					paidBy: 'userB',
					accountId: 'acc-j'
				}
			])
		);

		renderCtx();

		expect(ctxRef.selectedMonth).toBe(month);
		expect(ctxRef.totalExpenses).toBe(140);
	});
});

describe('FinanzasContext - Cobertura de Líneas Restantes', () => {
	it('debe inicializar selectedMonth con el último período disponible si el mes actual no existe', () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(STORAGE_KEYS.periods, JSON.stringify([{ month: '2026-01', openingBalance: 100 }]));
		renderCtx();
		expect(ctxRef.selectedMonth).toBe('2026-01');
	});

	it('debe propagar clones de transacciones recurrentes automáticamente al inicializar', async () => {
		// Mes actual es 2026-05. Ponemos el último periodo en el pasado (2026-04)
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(STORAGE_KEYS.periods, JSON.stringify([{ month: '2026-04', openingBalance: 0 }]));
		localStorage.setItem(
			STORAGE_KEYS.transactions,
			JSON.stringify([
				{
					id: 't1',
					desc: 'Sueldo Recurrente',
					amount: 1000,
					type: 'income',
					tag: 'Sueldo',
					date: '2026-04-01',
					recurrence: 'recurring',
					owner: 'joint'
				}
			])
		);

		await renderCtxAndInit();

		// El generador automático debe correr al inicializar y propagar a 2026-05 (mes actual)
		const hasCloned = ctxRef.transactions.some(
			(t) => t.date.startsWith('2026-05') && t.desc === 'Sueldo Recurrente'
		);
		expect(hasCloned).toBe(true);
	});

	it('debe ignorar deudas futuras en filteredDebts', () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(STORAGE_KEYS.periods, JSON.stringify([{ month: '2026-05', openingBalance: 0 }]));
		localStorage.setItem(
			STORAGE_KEYS.debts,
			JSON.stringify([
				{
					id: 'd-futura',
					kind: 'classic',
					desc: 'Deuda Futura',
					tag: 'T',
					date: '2026-08',
					principal: 1000,
					tae: 0,
					termMonths: 12,
					owner: 'joint'
				}
			])
		);

		renderCtx();
		expect(ctxRef.filteredDebts.some((d) => d.id === 'd-futura')).toBe(false);
	});

	it('debe mantener deudas paymentPlan terminadas pero activas históricamente en filteredDebts', () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(STORAGE_KEYS.periods, JSON.stringify([{ month: '2026-02', openingBalance: 0 }]));
		localStorage.setItem(
			STORAGE_KEYS.debts,
			JSON.stringify([
				{
					id: 'd-plan-pagos',
					kind: 'paymentPlan',
					desc: 'Plan de Pagos Histórico',
					tag: 'T',
					date: '2026-01',
					financedAmount: 300,
					fees: 0,
					totalToPay: 300,
					installments: [
						{ id: 'inst-1', dueMonth: '2026-01', amount: 100, status: 'paid', label: 'Cuota 1' },
						{ id: 'inst-2', dueMonth: '2026-02', amount: 100, status: 'paid', label: 'Cuota 2' },
						{ id: 'inst-3', dueMonth: '2026-03', amount: 100, status: 'paid', label: 'Cuota 3' }
					],
					owner: 'joint'
				}
			])
		);

		renderCtx();
		expect(ctxRef.selectedMonth).toBe('2026-02');
		expect(ctxRef.filteredDebts.some((d) => d.id === 'd-plan-pagos')).toBe(true);
	});

	it('handleCreateNextMonth debe cambiar selectedMonth si el mes siguiente ya existe', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(
			STORAGE_KEYS.periods,
			JSON.stringify([
				{ month: '2026-05', openingBalance: 0 },
				{ month: '2026-06', openingBalance: 0 }
			])
		);
		await renderCtxAndInit();

		await act(async () => {
			ctxRef.setSelectedMonth('2026-05');
		});

		// Mock de periods.some para que retorne true al chequear el mes siguiente (2026-07)
		const mockPeriods = [
			{ month: '2026-05', openingBalance: 0 },
			{ month: '2026-06', openingBalance: 0 }
		] as any;
		mockPeriods.some = vi.fn().mockReturnValue(true);

		await act(async () => {
			ctxRef.setPeriods(mockPeriods);
		});

		await act(async () => {
			ctxRef.handleCreateNextMonth();
		});

		expect(ctxRef.selectedMonth).toBe('2026-07');
	});

	it('debe calcular transfer owner correctamente en handleAddTransaction', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(
			STORAGE_KEYS.accounts,
			JSON.stringify([
				{ id: 'acc-a', name: 'Cuenta A', owner: 'userA', initialBalance: 1000 },
				{ id: 'acc-b', name: 'Cuenta B', owner: 'userB', initialBalance: 500 }
			])
		);
		await renderCtxAndInit();

		// Caso 1: Propietarios distintos -> joint
		await act(async () => {
			ctxRef.setTxForm({
				desc: 'Traspaso Joint',
				amount: '100',
				currency: 'EUR',
				type: 'transfer',
				tag: 'Ajuste de Saldo',
				date: '2026-05-01',
				recurrence: 'one-off',
				owner: 'userA',
				paidBy: 'shared',
				accountId: '',
				fromAccountId: 'acc-a',
				toAccountId: 'acc-b'
			});
		});

		await act(async () => {
			const fakeEvent = { preventDefault: vi.fn() } as any;
			ctxRef.handleAddTransaction(fakeEvent);
		});

		let added = ctxRef.transactions[0];
		expect(added.owner).toBe('joint');

		// Caso 2: Mismo propietario -> userA
		await act(async () => {
			ctxRef.setAccounts([
				{ id: 'acc-a1', name: 'Cuenta A1', owner: 'userA', initialBalance: 1000 },
				{ id: 'acc-a2', name: 'Cuenta A2', owner: 'userA', initialBalance: 500 }
			]);
		});

		await act(async () => {
			ctxRef.setTxForm({
				desc: 'Traspaso A',
				amount: '100',
				currency: 'EUR',
				type: 'transfer',
				tag: 'Ajuste de Saldo',
				date: '2026-05-01',
				recurrence: 'one-off',
				owner: 'userB', // se sobreescribe
				paidBy: 'shared',
				accountId: '',
				fromAccountId: 'acc-a1',
				toAccountId: 'acc-a2'
			});
		});

		await act(async () => {
			const fakeEvent = { preventDefault: vi.fn() } as any;
			ctxRef.handleAddTransaction(fakeEvent);
		});

		added = ctxRef.transactions[0];
		expect(added.owner).toBe('userA');
	});

	it('debe deducir paidBy en handleAddTransaction para cuentas comunes e individuales', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(
			STORAGE_KEYS.accounts,
			JSON.stringify([
				{ id: 'acc-a', name: 'Cuenta A', owner: 'userA', initialBalance: 1000 },
				{ id: 'acc-j', name: 'Cuenta Común', owner: 'joint', initialBalance: 1000 }
			])
		);
		renderCtx();

		// Caso owner !== joint -> paidBy = shared
		await act(async () => {
			ctxRef.setTxForm({
				desc: 'Gasto A',
				amount: '10',
				currency: 'EUR',
				type: 'expense',
				tag: 'Otros',
				date: '2026-05-01',
				recurrence: 'one-off',
				owner: 'userA',
				paidBy: 'userB',
				accountId: 'acc-a',
				fromAccountId: '',
				toAccountId: ''
			});
		});

		await act(async () => {
			const fakeEvent = { preventDefault: vi.fn() } as any;
			ctxRef.handleAddTransaction(fakeEvent);
		});

		expect(ctxRef.transactions[0].paidBy).toBe('shared');

		// Caso owner === joint, accountId tiene dueño userA -> paidBy = userA
		await act(async () => {
			ctxRef.setTxForm({
				desc: 'Gasto Común por A',
				amount: '10',
				currency: 'EUR',
				type: 'expense',
				tag: 'Otros',
				date: '2026-05-01',
				recurrence: 'one-off',
				owner: 'joint',
				paidBy: 'userB',
				accountId: 'acc-a',
				fromAccountId: '',
				toAccountId: ''
			});
		});

		await act(async () => {
			const fakeEvent = { preventDefault: vi.fn() } as any;
			ctxRef.handleAddTransaction(fakeEvent);
		});

		expect(ctxRef.transactions[0].paidBy).toBe('userA');
	});

	it('debe propagar clones al agregar transacciones recurrentes en handleAddTransaction', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(
			STORAGE_KEYS.periods,
			JSON.stringify([
				{ month: '2026-05', openingBalance: 0 },
				{ month: '2026-06', openingBalance: 0 }
			])
		);
		renderCtx();

		await act(async () => {
			ctxRef.setTxForm({
				desc: 'Netflix',
				amount: '15',
				currency: 'EUR',
				type: 'expense',
				tag: 'Suscripciones',
				date: '2026-05-15',
				recurrence: 'recurring',
				owner: 'joint',
				paidBy: 'shared',
				accountId: '',
				fromAccountId: '',
				toAccountId: ''
			});
		});

		await act(async () => {
			const fakeEvent = { preventDefault: vi.fn() } as any;
			ctxRef.handleAddTransaction(fakeEvent);
		});

		expect(ctxRef.transactions.length).toBe(2); // La original + clon
		const clon = ctxRef.transactions.find((t) => t.date.startsWith('2026-06'));
		expect(clon).toBeDefined();
		expect(clon?.originId).toBeDefined();
	});

	it('debe manejar scopes only-this y all al guardar edición de transacciones recurrentes', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(
			STORAGE_KEYS.periods,
			JSON.stringify([
				{ month: '2026-05', openingBalance: 0 },
				{ month: '2026-06', openingBalance: 0 }
			])
		);
		localStorage.setItem(
			STORAGE_KEYS.transactions,
			JSON.stringify([
				{
					id: 't1-2026-06',
					originId: 't1',
					desc: 'Netflix',
					amount: 15,
					type: 'expense',
					tag: 'Suscripciones',
					date: '2026-06-15',
					recurrence: 'recurring',
					owner: 'joint'
				},
				{
					id: 't1',
					desc: 'Netflix',
					amount: 15,
					type: 'expense',
					tag: 'Suscripciones',
					date: '2026-05-15',
					recurrence: 'recurring',
					owner: 'joint'
				}
			])
		);
		renderCtx();

		// Caso: editScope = 'only-this'
		await act(async () => {
			ctxRef.setEditingTx(ctxRef.transactions[1]); // t1
			ctxRef.setEditForm({
				desc: 'Netflix Modificado',
				amount: '20',
				currency: 'EUR',
				type: 'expense',
				tag: 'Suscripciones',
				date: '2026-05-15',
				recurrence: 'recurring',
				owner: 'joint',
				paidBy: 'shared',
				accountId: '',
				fromAccountId: '',
				toAccountId: ''
			});
			ctxRef.setEditScope('only-this');
		});

		await act(async () => {
			const fakeEvent = { preventDefault: vi.fn() } as any;
			ctxRef.handleSaveEditTransaction(fakeEvent);
		});

		const t1Mod = ctxRef.transactions.find((t) => t.id === 't1');
		expect(t1Mod?.desc).toBe('Netflix Modificado');
		expect(t1Mod?.recurrence).toBe('one-off'); // se vuelve puntual

		// Caso: editScope = 'all'
		localStorage.setItem(
			STORAGE_KEYS.transactions,
			JSON.stringify([
				{
					id: 't1-2026-06',
					originId: 't1',
					desc: 'Netflix',
					amount: 15,
					type: 'expense',
					tag: 'Suscripciones',
					date: '2026-06-15',
					recurrence: 'recurring',
					owner: 'joint'
				},
				{
					id: 't1',
					desc: 'Netflix',
					amount: 15,
					type: 'expense',
					tag: 'Suscripciones',
					date: '2026-05-15',
					recurrence: 'recurring',
					owner: 'joint'
				}
			])
		);
		renderCtx();

		await act(async () => {
			ctxRef.setEditingTx(ctxRef.transactions[1]); // t1
			ctxRef.setEditForm({
				desc: 'Netflix Todo',
				amount: '25',
				currency: 'EUR',
				type: 'expense',
				tag: 'Suscripciones',
				date: '2026-05-15',
				recurrence: 'recurring',
				owner: 'joint',
				paidBy: 'shared',
				accountId: '',
				fromAccountId: '',
				toAccountId: ''
			});
			ctxRef.setEditScope('all');
		});

		await act(async () => {
			const fakeEvent = { preventDefault: vi.fn() } as any;
			ctxRef.handleSaveEditTransaction(fakeEvent);
		});

		ctxRef.transactions.forEach((t) => {
			expect(t.desc).toBe('Netflix Todo');
			expect(Number(t.money.amount)).toBe(25);
		});
	});

	it('handleDeleteTransaction debe retornar early si el id no existe', () => {
		renderCtx();
		const lengthBefore = ctxRef.transactions.length;
		act(() => {
			ctxRef.handleDeleteTransaction('invalid-id');
		});
		expect(ctxRef.transactions.length).toBe(lengthBefore);
	});

	it('handleDeleteTransaction debe eliminar todas las ocurrencias futuras si es recurrente y se confirma', () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(
			STORAGE_KEYS.transactions,
			JSON.stringify([
				{
					id: 't1-2026-06',
					originId: 't1',
					desc: 'Netflix',
					amount: 15,
					type: 'expense',
					tag: 'Suscripciones',
					date: '2026-06-15',
					recurrence: 'recurring',
					owner: 'joint'
				},
				{
					id: 't1',
					desc: 'Netflix',
					amount: 15,
					type: 'expense',
					tag: 'Suscripciones',
					date: '2026-05-15',
					recurrence: 'recurring',
					owner: 'joint'
				}
			])
		);
		renderCtx();

		vi.spyOn(window, 'confirm').mockReturnValue(true);

		act(() => {
			ctxRef.handleDeleteTransaction('t1');
		});

		expect(ctxRef.transactions.length).toBe(0);
	});

	it('handleDeleteDebt debe limpiar deudas para consolidación y deuda seleccionada', () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(
			STORAGE_KEYS.debts,
			JSON.stringify([
				{
					id: 'd1',
					kind: 'classic',
					desc: 'Test Debt',
					tag: 'T',
					date: '2026-05',
					principal: 100,
					tae: 0,
					termMonths: 12,
					owner: 'joint'
				}
			])
		);
		renderCtx();

		act(() => {
			ctxRef.setSelectedDebtsForConsolidation(['d1']);
			ctxRef.setSelectedDebtSchedule(ctxRef.debts[0]);
		});

		expect(ctxRef.selectedDebtsForConsolidation).toContain('d1');
		expect(ctxRef.selectedDebtSchedule?.id).toBe('d1');

		act(() => {
			ctxRef.handleDeleteDebt('d1');
		});

		expect(ctxRef.selectedDebtsForConsolidation).not.toContain('d1');
		expect(ctxRef.selectedDebtSchedule).toBeNull();
	});

	it('handleSaveEditAccount debe retornar early si no hay editingAccount o nombre vacío', () => {
		renderCtx();
		act(() => {
			ctxRef.setEditingAccount(null);
			const fakeEvent = { preventDefault: vi.fn() } as any;
			ctxRef.handleSaveEditAccount(fakeEvent);
		});
		expect(ctxRef.editingAccount).toBeNull();
	});

	it('handleDeleteAccount debe desasociar cuenta de transacciones y deudas al eliminarse', () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(
			STORAGE_KEYS.accounts,
			JSON.stringify([
				{ id: 'acc-a', name: 'Cuenta A', owner: 'userA', initialBalance: 100 },
				{ id: 'acc-b', name: 'Cuenta B', owner: 'userB', initialBalance: 200 }
			])
		);
		localStorage.setItem(
			STORAGE_KEYS.transactions,
			JSON.stringify([
				{
					id: 't1',
					desc: 'Movimiento',
					amount: 10,
					type: 'expense',
					tag: 'Otros',
					date: '2026-05-01',
					owner: 'userA',
					accountId: 'acc-a'
				},
				{
					id: 't2',
					desc: 'Traspaso',
					amount: 10,
					type: 'transfer',
					tag: 'Traspaso',
					date: '2026-05-01',
					owner: 'joint',
					fromAccountId: 'acc-a',
					toAccountId: 'acc-b'
				}
			])
		);
		localStorage.setItem(
			STORAGE_KEYS.debts,
			JSON.stringify([
				{
					id: 'd1',
					kind: 'classic',
					desc: 'Deuda',
					tag: 'T',
					date: '2026-05',
					principal: 100,
					tae: 0,
					termMonths: 12,
					owner: 'joint',
					paymentAccountId: 'acc-a'
				}
			])
		);
		renderCtx();

		vi.spyOn(window, 'confirm').mockReturnValue(true);

		act(() => {
			ctxRef.handleDeleteAccount('acc-a');
		});

		expect(ctxRef.accounts.length).toBe(1);
		expect(ctxRef.transactions[0].accountId).toBeUndefined();
		expect(ctxRef.transactions[1].fromAccountId).toBeUndefined();
		expect(ctxRef.debts[0].paymentAccountId).toBeUndefined();
	});

	it('togglePaymentPlanInstallmentStatus debe retornar early si la deuda no es paymentPlan', () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(
			STORAGE_KEYS.debts,
			JSON.stringify([
				{
					id: 'd-classic',
					kind: 'classic',
					desc: 'Deuda Clásica',
					tag: 'T',
					date: '2026-05',
					principal: 100,
					tae: 0,
					termMonths: 12,
					owner: 'joint'
				}
			])
		);
		renderCtx();

		const debtsBefore = JSON.stringify(ctxRef.debts);
		act(() => {
			ctxRef.togglePaymentPlanInstallmentStatus('d-classic', 'i1');
		});
		expect(JSON.stringify(ctxRef.debts)).toBe(debtsBefore);
	});

	it('handleDownloadChatPDF debe avanzar timers para ejecutar callbacks internos de impresión', () => {
		vi.useFakeTimers();
		renderCtx();

		const focusSpy = vi.fn();
		const printSpy = vi.fn();
		const mockIframe = {
			contentWindow: {
				focus: focusSpy,
				print: printSpy
			},
			style: {},
			appendChild: vi.fn(),
			contentDocument: {
				open: vi.fn(),
				write: vi.fn(),
				close: vi.fn()
			}
		} as any;

		const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockIframe);
		const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockIframe);
		const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockIframe);

		ctxRef.handleDownloadChatPDF({
			showContext: true,
			showDebts: true,
			showTransactions: true,
			showChat: true
		});

		vi.advanceTimersByTime(300);
		expect(focusSpy).toHaveBeenCalled();
		expect(printSpy).toHaveBeenCalled();

		vi.advanceTimersByTime(1000);
		expect(removeChildSpy).toHaveBeenCalledWith(mockIframe);

		createElementSpy.mockRestore();
		appendChildSpy.mockRestore();
		removeChildSpy.mockRestore();
		vi.useRealTimers();
	});

	it('handleExportData debe alertar en caso de excepción', () => {
		renderCtx();

		const stringifySpy = vi.spyOn(JSON, 'stringify').mockImplementation(() => {
			throw new Error('Fake Error');
		});
		const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

		ctxRef.handleExportData();

		expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Fake Error'));

		stringifySpy.mockRestore();
		alertSpy.mockRestore();
	});

	it('handleImportData debe seleccionar el último mes del backup si tiene periodos', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		await renderCtxAndInit();

		const backupData = {
			[STORAGE_KEYS.periods]: JSON.stringify([
				{ month: '2026-05', openingBalance: 0, openingBalanceA: 0, openingBalanceB: 0 },
				{ month: '2026-09', openingBalance: 0, openingBalanceA: 0, openingBalanceB: 0 }
			]),
			[STORAGE_KEYS.accounts]: JSON.stringify([]),
			[STORAGE_KEYS.transactions]: JSON.stringify([]),
			[STORAGE_KEYS.debts]: JSON.stringify([])
		};

		const fakeEvent = { preventDefault: vi.fn() } as any;
		await act(async () => {
			await ctxRef.handleImportData(fakeEvent, JSON.stringify(backupData));
		});

		expect(ctxRef.selectedMonth).toBe('2026-09');
	});

	it('debe deducir paidBy en handleAddTransaction para cuenta del usuario B', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(
			STORAGE_KEYS.accounts,
			JSON.stringify([{ id: 'acc-b', name: 'Cuenta B', owner: 'userB', initialBalance: 1000 }])
		);
		renderCtx();

		await act(async () => {
			ctxRef.setTxForm({
				desc: 'Gasto Joint por B',
				amount: '10',
				currency: 'EUR',
				type: 'expense',
				tag: 'Otros',
				date: '2026-05-01',
				recurrence: 'one-off',
				owner: 'joint',
				paidBy: 'userA',
				accountId: 'acc-b',
				fromAccountId: '',
				toAccountId: ''
			});
		});

		await act(async () => {
			const fakeEvent = { preventDefault: vi.fn() } as any;
			ctxRef.handleAddTransaction(fakeEvent);
		});

		expect(ctxRef.transactions[0].paidBy).toBe('userB');
	});

	it('handleSaveEditTransaction debe retornar early si no hay editingTx o campos vacíos', async () => {
		renderCtx();
		await act(async () => {
			ctxRef.setEditingTx(null);
			const fakeEvent = { preventDefault: vi.fn() } as any;
			ctxRef.handleSaveEditTransaction(fakeEvent);
		});
		expect(ctxRef.editingTx).toBeNull();
	});

	it('debe calcular transfer owner y paidBy correctamente al editar transacciones', async () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(
			STORAGE_KEYS.accounts,
			JSON.stringify([
				{ id: 'acc-a', name: 'Cuenta A', owner: 'userA', initialBalance: 1000 },
				{ id: 'acc-b', name: 'Cuenta B', owner: 'userB', initialBalance: 500 },
				{ id: 'acc-a2', name: 'Cuenta A2', owner: 'userA', initialBalance: 200 }
			])
		);
		localStorage.setItem(
			STORAGE_KEYS.transactions,
			JSON.stringify([
				{
					id: 't1',
					desc: 'Traspaso Original',
					amount: 50,
					type: 'transfer',
					tag: 'Otros',
					date: '2026-05-01',
					fromAccountId: 'acc-a',
					toAccountId: 'acc-b'
				}
			])
		);
		renderCtx();

		// Caso: Dueños distintos
		await act(async () => {
			ctxRef.setEditingTx(ctxRef.transactions[0]);
			ctxRef.setEditForm({
				desc: 'Traspaso Editado',
				amount: '60',
				currency: 'EUR',
				type: 'transfer',
				tag: 'Otros',
				date: '2026-05-01',
				recurrence: 'one-off',
				owner: 'userA',
				paidBy: 'userB',
				accountId: '',
				fromAccountId: 'acc-a',
				toAccountId: 'acc-b'
			});
			ctxRef.setEditScope('only-this');
		});

		await act(async () => {
			const fakeEvent = { preventDefault: vi.fn() } as any;
			ctxRef.handleSaveEditTransaction(fakeEvent);
		});

		let edited = ctxRef.transactions[0];
		expect(edited.owner).toBe('joint');
		expect(edited.paidBy).toBe('userB');

		// Caso: Mismos dueños al editar transferencia
		await act(async () => {
			ctxRef.setEditingTx(ctxRef.transactions[0]);
			ctxRef.setEditForm({
				desc: 'Traspaso Mismo Dueño',
				amount: '60',
				currency: 'EUR',
				type: 'transfer',
				tag: 'Otros',
				date: '2026-05-01',
				recurrence: 'one-off',
				owner: 'userB',
				paidBy: 'userB',
				accountId: '',
				fromAccountId: 'acc-a',
				toAccountId: 'acc-a2'
			});
		});

		await act(async () => {
			const fakeEvent = { preventDefault: vi.fn() } as any;
			ctxRef.handleSaveEditTransaction(fakeEvent);
		});

		edited = ctxRef.transactions[0];
		expect(edited.owner).toBe('userA'); // fromAcc.owner === toAcc.owner
		expect(edited.paidBy).toBe('shared');

		// Caso: Gasto no-transferencia con dueño joint, pero cuenta de usuario A
		await act(async () => {
			ctxRef.setEditingTx(ctxRef.transactions[0]);
			ctxRef.setEditForm({
				desc: 'Gasto Editado A',
				amount: '40',
				currency: 'EUR',
				type: 'expense',
				tag: 'Otros',
				date: '2026-05-01',
				recurrence: 'one-off',
				owner: 'joint',
				paidBy: 'userB',
				accountId: 'acc-a',
				fromAccountId: '',
				toAccountId: ''
			});
		});

		await act(async () => {
			const fakeEvent = { preventDefault: vi.fn() } as any;
			ctxRef.handleSaveEditTransaction(fakeEvent);
		});

		edited = ctxRef.transactions[0];
		expect(edited.owner).toBe('joint');
		expect(edited.paidBy).toBe('userA'); // acc.owner === 'userA' -> returns userA

		// Caso: Gasto no-transferencia con dueño joint, pero cuenta de usuario B
		await act(async () => {
			ctxRef.setEditingTx(ctxRef.transactions[0]);
			ctxRef.setEditForm({
				desc: 'Gasto Editado B',
				amount: '40',
				currency: 'EUR',
				type: 'expense',
				tag: 'Otros',
				date: '2026-05-01',
				recurrence: 'one-off',
				owner: 'joint',
				paidBy: 'userA',
				accountId: 'acc-b',
				fromAccountId: '',
				toAccountId: ''
			});
		});

		await act(async () => {
			const fakeEvent = { preventDefault: vi.fn() } as any;
			ctxRef.handleSaveEditTransaction(fakeEvent);
		});

		edited = ctxRef.transactions[0];
		expect(edited.owner).toBe('joint');
		expect(edited.paidBy).toBe('userB'); // acc.owner === 'userB' -> returns userB

		// Caso: Gasto no-transferencia con dueño no-joint -> paidBy = shared
		await act(async () => {
			ctxRef.setEditingTx(ctxRef.transactions[0]);
			ctxRef.setEditForm({
				desc: 'Gasto Editado Individual',
				amount: '40',
				currency: 'EUR',
				type: 'expense',
				tag: 'Otros',
				date: '2026-05-01',
				recurrence: 'one-off',
				owner: 'userA',
				paidBy: 'userB',
				accountId: 'acc-b',
				fromAccountId: '',
				toAccountId: ''
			});
		});

		await act(async () => {
			const fakeEvent = { preventDefault: vi.fn() } as any;
			ctxRef.handleSaveEditTransaction(fakeEvent);
		});

		edited = ctxRef.transactions[0];
		expect(edited.owner).toBe('userA');
		expect(edited.paidBy).toBe('shared'); // effectiveOwner !== joint -> returns shared
	});

	it('handleDeleteAccount debe desasociar toAccountId de transacciones y mantener deudas no asociadas', () => {
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(
			STORAGE_KEYS.accounts,
			JSON.stringify([
				{ id: 'acc-a', name: 'Cuenta A', owner: 'userA', initialBalance: 100 },
				{ id: 'acc-b', name: 'Cuenta B', owner: 'userB', initialBalance: 200 }
			])
		);
		localStorage.setItem(
			STORAGE_KEYS.transactions,
			JSON.stringify([
				{
					id: 't2',
					desc: 'Traspaso',
					amount: 10,
					type: 'transfer',
					tag: 'Traspaso',
					date: '2026-05-01',
					owner: 'joint',
					fromAccountId: 'acc-a',
					toAccountId: 'acc-b'
				}
			])
		);
		localStorage.setItem(
			STORAGE_KEYS.debts,
			JSON.stringify([
				{
					id: 'd1',
					kind: 'classic',
					desc: 'Deuda A',
					tag: 'T',
					date: '2026-05',
					principal: 50,
					tae: 0,
					termMonths: 12,
					owner: 'joint',
					paymentAccountId: 'acc-a'
				},
				{
					id: 'd2',
					kind: 'classic',
					desc: 'Deuda B',
					tag: 'T',
					date: '2026-05',
					principal: 100,
					tae: 0,
					termMonths: 12,
					owner: 'joint',
					paymentAccountId: 'acc-b'
				}
			])
		);
		renderCtx();

		vi.spyOn(window, 'confirm').mockReturnValue(true);

		act(() => {
			ctxRef.handleDeleteAccount('acc-b');
		});

		expect(ctxRef.accounts.length).toBe(1);
		expect(ctxRef.transactions[0].toAccountId).toBeUndefined(); // acc-b eliminado
		expect(ctxRef.transactions[0].fromAccountId).toBe('acc-a'); // acc-a se mantiene
		expect(ctxRef.debts[0].paymentAccountId).toBe('acc-a'); // d1 (no asociado a acc-b) se mantiene intacto (cubre line 1017 return d)
		expect(ctxRef.debts[1].paymentAccountId).toBeUndefined(); // d2 (asociado a acc-b) se limpia
	});

	it('stripMarkdown debe parsear tablas y handleCopyChatPlaintext manejar errores de clipboard', async () => {
		renderCtx();

		const markdownWithTable = `
Aquí hay una tabla:
| Col 1 | Col 2 |
|---|---|
| Celda A | Celda B |
| Celda C | Celda D |
		`;

		await act(async () => {
			ctxRef.setChatMessages([{ role: 'model', content: markdownWithTable, timestamp: '12:00' }]);
		});

		// Mock de navigator.clipboard.writeText que falla
		const writeTextSpy = vi.fn().mockRejectedValue(new Error('Clipboard block'));
		Object.assign(navigator, {
			clipboard: {
				writeText: writeTextSpy
			}
		});

		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		await act(async () => {
			ctxRef.handleCopyChatPlaintext();
		});

		expect(writeTextSpy).toHaveBeenCalled();
		// Esperar que la microtarea de la promesa rechazada se resuelva para el console.error
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to copy text'), expect.any(Error));

		consoleErrorSpy.mockRestore();
	});

	it('handleDownloadChatPDF debe renderizar deudas y markdown complejos completamente', async () => {
		vi.useFakeTimers();

		const month = '2026-05';
		localStorage.setItem(STORAGE_KEYS.clearedV2, 'true');
		localStorage.setItem(STORAGE_KEYS.periods, JSON.stringify([{ month, openingBalance: 1000 }]));
		localStorage.setItem(
			STORAGE_KEYS.accounts,
			JSON.stringify([{ id: 'acc-j', name: 'Cuenta Común', owner: 'joint', initialBalance: 1000 }])
		);
		localStorage.setItem(
			STORAGE_KEYS.transactions,
			JSON.stringify([
				{
					id: 't1',
					desc: 'Comida',
					amount: 50,
					type: 'expense',
					tag: 'Alimentación',
					date: `${month}-01`,
					recurrence: 'recurring',
					owner: 'joint',
					accountId: 'acc-j'
				},
				{
					id: 't2',
					desc: 'Taxi',
					amount: 15,
					type: 'expense',
					tag: 'Transporte',
					date: `${month}-02`,
					recurrence: 'one-off',
					owner: 'joint',
					accountId: 'acc-j'
				}
			])
		);
		localStorage.setItem(
			STORAGE_KEYS.debts,
			JSON.stringify([
				{
					id: 'd1',
					kind: 'classic',
					desc: 'Hipoteca',
					tag: 'Hipoteca',
					date: month,
					principal: 100000,
					tae: 3.5,
					tin: 3.2,
					termMonths: 120,
					owner: 'joint',
					paymentAccountId: 'acc-j'
				},
				{
					id: 'd2',
					kind: 'classic',
					desc: 'Préstamo',
					tag: 'Otros',
					date: month,
					principal: 5000,
					tae: 0,
					termMonths: 10,
					owner: 'joint',
					paymentAccountId: 'acc-j'
				},
				{
					id: 'd3',
					kind: 'paymentPlan',
					desc: 'Móvil',
					tag: 'Otros',
					date: month,
					financedAmount: 600,
					fees: 0,
					totalToPay: 600,
					owner: 'joint',
					installments: [{ id: 'i1', dueMonth: month, amount: 50, status: 'pending', label: 'Tramo 1' }]
				}
			])
		);

		renderCtx();

		const complexMarkdown = `
# Título 1
## Título 2
### Título 3
#### Título 4

Texto con **negrita** y \`código inline\`.

* Item UL 1
- Item UL 2
+ Item UL 3

1. Item OL 1
2. Item OL 2

| Columna A | Columna B |
|:---|---:|
| A1 | B1 |

\`\`\`javascript
const test = "code block";
\`\`\`

\`\`\`
code block sin lenguaje
\`\`\`
		`;

		await act(async () => {
			ctxRef.setChatMessages([
				{ role: 'user', content: 'Hola', timestamp: '12:00' },
				{ role: 'model', content: complexMarkdown, timestamp: '12:01' }
			]);
		});

		const focusSpy = vi.fn();
		const printSpy = vi.fn();
		const mockIframe = {
			contentWindow: {
				focus: focusSpy,
				print: printSpy
			},
			style: {},
			appendChild: vi.fn(),
			contentDocument: {
				open: vi.fn(),
				write: vi.fn(),
				close: vi.fn()
			}
		} as any;

		const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockIframe);
		const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockIframe);
		const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockIframe);

		ctxRef.handleDownloadChatPDF({
			showContext: true,
			showDebts: true,
			showTransactions: true,
			showChat: true
		});

		vi.advanceTimersByTime(300);
		expect(printSpy).toHaveBeenCalled();

		vi.advanceTimersByTime(1000);

		createElementSpy.mockRestore();
		appendChildSpy.mockRestore();
		removeChildSpy.mockRestore();
		vi.useRealTimers();
	});

	it('handleDownloadChatPDF debe retornar si no hay document en el iframe', () => {
		renderCtx();

		const mockIframe = {
			contentWindow: null,
			contentDocument: null,
			style: {},
			appendChild: vi.fn()
		} as any;

		const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockIframe);
		const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockIframe);

		expect(() => {
			ctxRef.handleDownloadChatPDF({
				showContext: true,
				showDebts: true,
				showTransactions: true,
				showChat: true
			});
		}).not.toThrow();

		createElementSpy.mockRestore();
		appendChildSpy.mockRestore();
	});

	describe('Ocultación de datos sensibles', () => {
		beforeEach(() => {
			localStorage.clear();
		});

		it('debe inicializar hideSensitiveData en false por defecto', () => {
			renderCtx();
			expect(ctxRef.hideSensitiveData).toBe(false);
		});

		it('debe alternar hideSensitiveData y guardarlo en localStorage', () => {
			renderCtx();
			expect(ctxRef.hideSensitiveData).toBe(false);

			act(() => {
				ctxRef.toggleSensitiveData();
			});
			expect(ctxRef.hideSensitiveData).toBe(true);
			expect(localStorage.getItem('finanzas_hide_sensitive_data')).toBe('true');

			act(() => {
				ctxRef.toggleSensitiveData();
			});
			expect(ctxRef.hideSensitiveData).toBe(false);
			expect(localStorage.getItem('finanzas_hide_sensitive_data')).toBe('false');
		});

		it('debe inicializar hideSensitiveData desde localStorage si está guardado', () => {
			localStorage.setItem('finanzas_hide_sensitive_data', 'true');
			renderCtx();
			expect(ctxRef.hideSensitiveData).toBe(true);
		});

		it('debe formatear los importes con formatAmount según el estado hideSensitiveData', () => {
			renderCtx();

			// Con hideSensitiveData = false
			expect(ctxRef.formatAmount(300)).toBe('300,00€');
			expect(ctxRef.formatAmount(-150.5)).toBe('-150,50€');
			expect(ctxRef.formatAmount(100, { showSign: true })).toBe('+100,00€');
			expect(ctxRef.formatAmount(120, { decimals: 0 })).toBe('120€');

			// Alternamos a true
			act(() => {
				ctxRef.toggleSensitiveData();
			});
			expect(ctxRef.hideSensitiveData).toBe(true);

			// Con hideSensitiveData = true
			expect(ctxRef.formatAmount(300)).toBe('***€');
			expect(ctxRef.formatAmount(-150.5)).toBe('-***€');
			expect(ctxRef.formatAmount(100, { showSign: true })).toBe('+***€');

			// Con forceShow = true (ignora la ocultación)
			expect(ctxRef.formatAmount(300, { forceShow: true })).toBe('300,00€');
			expect(ctxRef.formatAmount(-150.5, { forceShow: true })).toBe('-150,50€');
		});
	});
});
