import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildFinanceDataPrompt, askGemini } from '../services/geminiService';
import type { PromptContextParams } from '../services/geminiService';
import type { ChatMessage, ClassicDebt, PaymentPlanDebt, Transaction, TagBreakdown } from '../types';

// --- Fixtures ---

const makeDefaultPromptParams = (overrides: Partial<PromptContextParams> = {}): PromptContextParams => ({
	userAName: 'Alice',
	userBName: 'Bob',
	viewMode: 'all',
	selectedMonth: '2026-05',
	totalIncomes: 3000,
	recurringIncomes: 2500,
	oneOffIncomes: 500,
	totalExpenses: 1500,
	recurringExpenses: 1200,
	oneOffExpenses: 300,
	totalMonthlyDebtPayments: 500,
	netMonthlyBalance: 1000,
	jointPaidByA: 200,
	jointPaidByB: 150,
	netOwed: 25,
	tagData: [
		{ tag: 'Alimentación', amount: 400 },
		{ tag: 'Transporte', amount: 100 }
	],
	filteredTransactions: [
		{
			id: 'tx-1', desc: 'Nómina', money: { amount: '2500.00', currency: 'EUR' }, type: 'income',
			tag: 'Sueldo', date: '2026-05-01', recurrence: 'recurring', owner: 'userA'
		} as Transaction,
		{
			id: 'tx-2', desc: 'Netflix', money: { amount: '15.00', currency: 'EUR' }, type: 'expense',
			tag: 'Suscripciones', date: '2026-05-01', recurrence: 'recurring', owner: 'joint'
		} as Transaction
	],
	debts: [],
	filteredDebts: [],
	consolidatedDebtsObjects: [],
	consolidatedPrincipal: 0,
	additionalCapital: 0,
	totalNewPrincipal: 0,
	currentConsolidatedMonthlySum: 0,
	currentTotalInterests: 0,
	newConsolidatedCuota: 0,
	newTotalConsolidatedPayment: 0,
	newConsolidatedInterests: 0,
	consolidationFormTae: '5.5',
	consolidationFormTermMonths: '36',
	...overrides
});

// --- Tests ---

describe('buildFinanceDataPrompt', () => {
	it('debe generar un prompt que contenga los nombres de usuario', () => {
		const prompt = buildFinanceDataPrompt(makeDefaultPromptParams());
		expect(prompt).toContain('Alice');
		expect(prompt).toContain('Bob');
	});

	it('debe incluir la vista activa correcta', () => {
		expect(buildFinanceDataPrompt(makeDefaultPromptParams({ viewMode: 'all' }))).toContain('Conjunta');
		expect(buildFinanceDataPrompt(makeDefaultPromptParams({ viewMode: 'userA' }))).toContain('Individual de Alice');
		expect(buildFinanceDataPrompt(makeDefaultPromptParams({ viewMode: 'userB' }))).toContain('Individual de Bob');
	});

	it('debe incluir datos financieros del mes', () => {
		const prompt = buildFinanceDataPrompt(makeDefaultPromptParams());
		expect(prompt).toContain('3000.00€');
		expect(prompt).toContain('1500.00€');
		expect(prompt).toContain('500.00€');
		expect(prompt).toContain('1000.00€');
	});

	it('debe incluir desglose de ingresos recurrentes vs puntuales', () => {
		const prompt = buildFinanceDataPrompt(makeDefaultPromptParams());
		expect(prompt).toContain('2500.00€');
		expect(prompt).toContain('500.00€');
	});

	it('debe incluir datos de liquidación cuando hay deuda entre usuarios', () => {
		const prompt = buildFinanceDataPrompt(makeDefaultPromptParams({ netOwed: 25 }));
		expect(prompt).toContain('Bob debe a Alice 25.00€');
	});

	it('debe indicar cuentas al día cuando netOwed es 0', () => {
		const prompt = buildFinanceDataPrompt(makeDefaultPromptParams({ netOwed: 0 }));
		expect(prompt).toContain('Cuentas al día');
	});

	it('debe indicar deuda inversa cuando netOwed es negativo', () => {
		const prompt = buildFinanceDataPrompt(makeDefaultPromptParams({ netOwed: -50 }));
		expect(prompt).toContain('Alice debe a Bob 50.00€');
	});

	it('debe incluir desglose por etiquetas', () => {
		const prompt = buildFinanceDataPrompt(makeDefaultPromptParams());
		expect(prompt).toContain('Alimentación: 400.00€');
		expect(prompt).toContain('Transporte: 100.00€');
	});

	it('debe incluir detalle de transacciones con recurrencia', () => {
		const prompt = buildFinanceDataPrompt(makeDefaultPromptParams());
		expect(prompt).toContain('Nómina');
		expect(prompt).toContain('Recurrente');
		expect(prompt).toContain('Netflix');
	});

	it('debe indicar "No hay movimientos" si no hay transacciones', () => {
		const prompt = buildFinanceDataPrompt(makeDefaultPromptParams({ filteredTransactions: [] }));
		expect(prompt).toContain('No hay movimientos registrados');
	});

	it('debe incluir deudas clásicas activas', () => {
		const classicDebt: ClassicDebt = {
			id: 'd1', kind: 'classic', desc: 'Hipoteca Test',
			tag: 'Hipoteca', date: '2026-01', principal: 100000,
			tae: 3, termMonths: 360, owner: 'userA'
		};

		const prompt = buildFinanceDataPrompt(makeDefaultPromptParams({
			debts: [classicDebt],
			filteredDebts: [classicDebt]
		}));
		expect(prompt).toContain('Hipoteca Test');
		expect(prompt).toContain('Préstamo clásico');
		expect(prompt).toContain('Capital: 100000€');
		expect(prompt).toContain('Activa este mes');
	});

	it('debe incluir deudas paymentPlan', () => {
		const ppDebt: PaymentPlanDebt = {
			id: 'd2', kind: 'paymentPlan', desc: 'Fraccionamiento Test',
			tag: 'Test', date: '2026-03', financedAmount: 1200,
			fees: 60, totalToPay: 1260, owner: 'userB',
			installments: [
				{ id: 'i1', dueMonth: '2026-05', amount: 105, status: 'pending', label: 'Cuota 1' }
			]
		};

		const prompt = buildFinanceDataPrompt(makeDefaultPromptParams({
			debts: [ppDebt],
			filteredDebts: [ppDebt]
		}));
		expect(prompt).toContain('Fraccionamiento Test');
		expect(prompt).toContain('Fraccionamiento manual');
		expect(prompt).toContain('1200€');
	});

	it('debe indicar "No hay deudas registradas" si no hay deudas', () => {
		const prompt = buildFinanceDataPrompt(makeDefaultPromptParams({ debts: [] }));
		expect(prompt).toContain('No hay deudas registradas');
	});

	it('debe incluir datos de reunificación cuando hay deudas consolidadas', () => {
		const classicDebt: ClassicDebt = {
			id: 'd1', kind: 'classic', desc: 'Deuda 1',
			tag: 'Test', date: '2026-01', principal: 5000,
			tae: 5, termMonths: 24, owner: 'joint'
		};

		const prompt = buildFinanceDataPrompt(makeDefaultPromptParams({
			consolidatedDebtsObjects: [classicDebt],
			consolidatedPrincipal: 5000,
			additionalCapital: 1000,
			totalNewPrincipal: 6000,
			currentConsolidatedMonthlySum: 220,
			currentTotalInterests: 280,
			newConsolidatedCuota: 180,
			newTotalConsolidatedPayment: 6480,
			newConsolidatedInterests: 480
		}));
		expect(prompt).toContain('5000.00€');
		expect(prompt).toContain('1000.00€');
		expect(prompt).toContain('6000.00€');
	});

	it('debe indicar que no hay simulación si no hay deudas consolidadas', () => {
		const prompt = buildFinanceDataPrompt(makeDefaultPromptParams({ consolidatedDebtsObjects: [] }));
		expect(prompt).toContain('No se ha configurado simulación');
	});

	it('debe marcar deudas futuras con su fecha de inicio', () => {
		const futureDebt: ClassicDebt = {
			id: 'd1', kind: 'classic', desc: 'Deuda Futura',
			tag: 'Test', date: '2027-01', principal: 5000,
			tae: 5, termMonths: 12, owner: 'joint'
		};

		const prompt = buildFinanceDataPrompt(makeDefaultPromptParams({
			debts: [futureDebt],
			filteredDebts: []
		}));
		expect(prompt).toContain('Futura');
		expect(prompt).toContain('2027-01');
	});
});

describe('askGemini', () => {
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it('debe retornar la respuesta del modelo en caso exitoso', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({
				candidates: [{ content: { parts: [{ text: 'Respuesta de prueba' }] } }]
			})
		});

		const result = await askGemini('test-key', [
			{ role: 'user', content: 'Hola', timestamp: '12:00' }
		], 'system prompt');

		expect(result).toBe('Respuesta de prueba');
		expect(globalThis.fetch).toHaveBeenCalledTimes(1);
	});

	it('debe retornar mensaje por defecto si no hay texto en la respuesta', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ candidates: [{ content: { parts: [] } }] })
		});

		const result = await askGemini('test-key', [
			{ role: 'user', content: 'Hola', timestamp: '12:00' }
		], 'system prompt');

		expect(result).toBe('No se ha obtenido respuesta de Gemini.');
	});

	it('debe reintentar en caso de error HTTP y fallar tras 5 intentos', async () => {
		vi.useFakeTimers();

		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 500
		});

		const promise = askGemini('test-key', [
			{ role: 'user', content: 'Hola', timestamp: '12:00' }
		], 'system prompt');

		// Attach rejection handler immediately to prevent unhandled rejection
		let caughtError: Error | null = null;
		promise.catch((err) => { caughtError = err; });

		// Avanzar los timers para los 4 reintentos (delays: 1000, 2000, 4000, 8000ms)
		for (let i = 0; i < 4; i++) {
			await vi.advanceTimersByTimeAsync(16000);
		}

		// Wait for the promise to settle
		try { await promise; } catch { /* expected */ }

		expect(caughtError).not.toBeNull();
		expect(caughtError!.message).toContain('Error tras 5 intentos');
		expect(globalThis.fetch).toHaveBeenCalledTimes(5);

		vi.useRealTimers();
	});

	it('debe reintentar en caso de error de red y fallar tras 5 intentos', async () => {
		vi.useFakeTimers();

		globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

		const promise = askGemini('test-key', [
			{ role: 'user', content: 'Hola', timestamp: '12:00' }
		], 'system prompt');

		// Attach rejection handler immediately to prevent unhandled rejection
		let caughtError: Error | null = null;
		promise.catch((err) => { caughtError = err; });

		for (let i = 0; i < 4; i++) {
			await vi.advanceTimersByTimeAsync(16000);
		}

		// Wait for the promise to settle
		try { await promise; } catch { /* expected */ }

		expect(caughtError).not.toBeNull();
		expect(caughtError!.message).toContain('Error tras 5 intentos');
		expect(globalThis.fetch).toHaveBeenCalledTimes(5);

		vi.useRealTimers();
	});

	it('debe enviar el payload correcto a la API', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({
				candidates: [{ content: { parts: [{ text: 'OK' }] } }]
			})
		});

		const messages: ChatMessage[] = [
			{ role: 'user', content: 'Analiza', timestamp: '10:00' },
			{ role: 'model', content: 'Respuesta previa', timestamp: '10:01' }
		];

		await askGemini('my-key', messages, 'mi prompt de sistema');

		const fetchCall = (globalThis.fetch as any).mock.calls[0];
		const url = fetchCall[0];
		const options = fetchCall[1];
		const body = JSON.parse(options.body);

		expect(url).toContain('key=my-key');
		expect(body.contents).toHaveLength(2);
		expect(body.contents[0].role).toBe('user');
		expect(body.contents[0].parts[0].text).toBe('Analiza');
		expect(body.systemInstruction.parts[0].text).toBe('mi prompt de sistema');
	});

	it('debe tener éxito si el primer intento falla pero el segundo tiene éxito', async () => {
		vi.useFakeTimers();

		let callCount = 0;
		globalThis.fetch = vi.fn().mockImplementation(() => {
			callCount++;
			if (callCount === 1) {
				return Promise.resolve({ ok: false, status: 429 });
			}
			return Promise.resolve({
				ok: true,
				json: () => Promise.resolve({
					candidates: [{ content: { parts: [{ text: 'Éxito en reintento' }] } }]
				})
			});
		});

		const promise = askGemini('test-key', [
			{ role: 'user', content: 'Hola', timestamp: '12:00' }
		], 'prompt');

		// Avanzar el timer para el primer retry (1000ms delay)
		await vi.advanceTimersByTimeAsync(1500);

		const result = await promise;
		expect(result).toBe('Éxito en reintento');
		expect(globalThis.fetch).toHaveBeenCalledTimes(2);

		vi.useRealTimers();
	});
});
