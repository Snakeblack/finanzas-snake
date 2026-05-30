import { describe, it, expect } from 'vitest';
import { 
	deduceTagFromConcept, 
	calculateMonthlyPayment, 
	generateAmortizationSchedule, 
	calculateTimelineBalances, 
	isClassicDebt, 
	isPaymentPlanDebt 
} from '../services/financeService';
import { toNumber } from '../utils/formatters';
import { normalizeMonth, addMonthsToMonth, getValidDateForMonth } from '../utils/dateUtils';
import type { Account, Period, Transaction, Debt } from '../types';

describe('Utilidades de Fechas y Formateadores', () => {
	it('toNumber debe convertir entradas de forma segura', () => {
		expect(toNumber(100)).toBe(100);
		expect(toNumber('123.45')).toBe(123.45);
		expect(toNumber(undefined)).toBe(0);
		expect(toNumber('invalido')).toBe(0);
	});

	it('normalizeMonth debe normalizar a formato YYYY-MM', () => {
		expect(normalizeMonth('2026-05-30')).toBe('2026-05');
		expect(normalizeMonth(undefined)).toBe(new Date().toISOString().substring(0, 7));
	});

	it('addMonthsToMonth debe sumar meses correctamente', () => {
		expect(addMonthsToMonth('2026-05', 1)).toBe('2026-06');
		expect(addMonthsToMonth('2026-12', 1)).toBe('2027-01');
		expect(addMonthsToMonth('2026-01', -1)).toBe('2025-12');
	});

	it('getValidDateForMonth debe retornar una fecha válida ajustada', () => {
		expect(getValidDateForMonth('2026-05', '15')).toBe('2026-05-15');
		// Mayo tiene 31 días
		expect(getValidDateForMonth('2026-05', '35')).toBe('2026-05-31');
		// Febrero 2026 tiene 28 días
		expect(getValidDateForMonth('2026-02', '30')).toBe('2026-02-28');
	});
});

describe('Lógica Financiera y Categorización', () => {
	it('deduceTagFromConcept debe inferir categorías correctas', () => {
		expect(deduceTagFromConcept('Sueldo de Mayo', 'income')).toBe('Sueldo');
		expect(deduceTagFromConcept('dividendo de bolsa', 'income')).toBe('Inversiones');
		expect(deduceTagFromConcept('Compra en Mercadona', 'expense')).toBe('Alimentación');
		expect(deduceTagFromConcept('Uber al trabajo', 'expense')).toBe('Transporte');
		expect(deduceTagFromConcept('Pago de Netflix', 'expense')).toBe('Suscripciones');
		expect(deduceTagFromConcept('Inversión en hucha', 'transfer')).toBe('Ahorro/Inversión');
	});

	it('calculateMonthlyPayment debe calcular cuotas de préstamos según sistema francés', () => {
		// Capital de 10000€, TAE de 5%, 12 meses
		const cuota = calculateMonthlyPayment(10000, 5, 12, 'tae');
		expect(cuota).toBeCloseTo(855.57, 2);

		// Sin interés
		const cuotaSinInteres = calculateMonthlyPayment(1200, 0, 12);
		expect(cuotaSinInteres).toBe(100);
	});

	it('generateAmortizationSchedule debe generar cuadro detallado', () => {
		const classic: Debt = {
			id: 'debt-1',
			kind: 'classic',
			desc: 'Préstamo Test',
			tag: 'Préstamo Personal',
			date: '2026-05',
			principal: 5000,
			tae: 6,
			termMonths: 6,
			owner: 'joint'
		};

		if (isClassicDebt(classic)) {
			const schedule = generateAmortizationSchedule(classic);
			expect(schedule).toHaveLength(6);
			expect(schedule[0].month).toBe(1);
			expect(schedule[5].remainingPrincipal).toBeCloseTo(0, 2);
		} else {
			throw new Error('Debería ser classic');
		}
	});
});

describe('Motor Contable de Línea Temporal', () => {
	it('calculateTimelineBalances debe acumular y ponderar los saldos correctamente', () => {
		const accounts: Account[] = [
			{ id: 'default-a', name: 'Efectivo A', owner: 'userA', initialBalance: 1000 },
			{ id: 'default-b', name: 'Efectivo B', owner: 'userB', initialBalance: 500 },
			{ id: 'default-joint', name: 'Común', owner: 'joint', initialBalance: 0 }
		];

		const periods: Period[] = [
			{ month: '2026-05', openingBalance: 1500 }
		];

		const transactions: Transaction[] = [
			// Ingreso en cuenta de User A
			{
				id: 'tx-1',
				desc: 'Nómina',
				amount: 2000,
				type: 'income',
				tag: 'Sueldo',
				date: '2026-05-01',
				owner: 'userA',
				accountId: 'default-a'
			},
			// Gasto conjunto pagado por A
			{
				id: 'tx-2',
				desc: 'Supermercado',
				amount: 100,
				type: 'expense',
				tag: 'Alimentación',
				date: '2026-05-05',
				owner: 'joint',
				paidBy: 'userA',
				accountId: 'default-joint'
			}
		];

		const debts: Debt[] = [];

		// Vista de User A
		// Apertura: 1000 (A) + 0 (joint * 0.5) = 1000
		// Ingresos A: 2000 (100% de A)
		// Gastos A: 50 (50% de joint)
		// Saldo final A en cuenta A: 1000 + 2000 = 3000
		// Saldo final A en cuenta joint: -100 = -100 (conjunto), ponderado al 50% = -50
		// Balance neto esperado para A: 2000 - 50 = 1950
		const balancesA = calculateTimelineBalances(periods, transactions, debts, accounts, 'userA');
		
		expect(balancesA['2026-05']).toBeDefined();
		expect(balancesA['2026-05'].openingBalance).toBe(1000);
		expect(balancesA['2026-05'].incomes).toBe(2000);
		expect(balancesA['2026-05'].expenses).toBe(50);
		expect(balancesA['2026-05'].netBalance).toBe(1950);
		expect(balancesA['2026-05'].closingBalance).toBe(2950);
	});
});
