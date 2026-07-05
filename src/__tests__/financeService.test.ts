import { describe, it, expect } from 'vitest';
import {
	deduceTagFromConcept,
	isClassicDebt,
	isPaymentPlanDebt,
	hasTin,
	getDebtRateLabel,
	getPaymentPlanPaidAmount,
	getPaymentPlanRemainingAmount,
	generatePaymentPlanInstallments,
	getMonthlyRate,
	calculateMonthlyPayment,
	getDebtRateMode,
	getPaymentPlanDueInstallments,
	getPaymentPlanCashflowForMonth,
	getPaymentPlanOverdueAmount,
	getPaymentPlanInstallmentsForMonth,
	calculateDebtMonthlyPayment,
	calculateDebtCashflowForMonth,
	calculateClassicDebtInstallment,
	generateAmortizationSchedule,
	getTransactionOwner,
	getEffectiveAmount,
	calculateTimelineBalances,
	getTagBreakdown,
	sumMoney,
	calculateDebtRemainingPrincipal,
	calculateDebtRemainingInterests,
	calculateClassicDebtRemainingPrincipal,
	calculateClassicDebtRemainingInterests
} from '../services/financeService';
import type { Account, Period, Transaction, ClassicDebt, PaymentPlanDebt } from '../types';

// --- Fixtures reutilizables ---
const classicDebt: ClassicDebt = {
	id: 'debt-classic-1',
	kind: 'classic',
	desc: 'Préstamo Personal',
	tag: 'Préstamo Personal',
	date: '2026-05',
	principal: 10000,
	tae: 5,
	termMonths: 12,
	owner: 'joint'
};

const classicDebtWithTin: ClassicDebt = {
	id: 'debt-classic-tin',
	kind: 'classic',
	desc: 'Hipoteca',
	tag: 'Hipoteca',
	date: '2026-01',
	principal: 150000,
	tin: 2.5,
	tae: 3.0,
	termMonths: 360,
	owner: 'userA'
};

const paymentPlanDebt: PaymentPlanDebt = {
	id: 'debt-pp-1',
	kind: 'paymentPlan',
	desc: 'Fraccionamiento Móvil',
	tag: 'Préstamo Personal',
	date: '2026-03',
	financedAmount: 1200,
	fees: 60,
	totalToPay: 1260,
	owner: 'userB',
	installments: [
		{ id: 'i1', dueMonth: '2026-03', amount: 105, status: 'paid', label: 'Tramo 1 · Cuota 1' },
		{ id: 'i2', dueMonth: '2026-04', amount: 105, status: 'paid', label: 'Tramo 1 · Cuota 2' },
		{ id: 'i3', dueMonth: '2026-05', amount: 105, status: 'pending', label: 'Tramo 1 · Cuota 3' },
		{ id: 'i4', dueMonth: '2026-06', amount: 105, status: 'pending', label: 'Tramo 1 · Cuota 4' },
		{ id: 'i5', dueMonth: '2026-07', amount: 105, status: 'pending', label: 'Tramo 1 · Cuota 5' },
		{ id: 'i6', dueMonth: '2026-08', amount: 105, status: 'pending', label: 'Tramo 1 · Cuota 6' },
		{ id: 'i7', dueMonth: '2026-09', amount: 105, status: 'pending', label: 'Tramo 1 · Cuota 7' },
		{ id: 'i8', dueMonth: '2026-10', amount: 105, status: 'pending', label: 'Tramo 1 · Cuota 8' },
		{ id: 'i9', dueMonth: '2026-11', amount: 105, status: 'pending', label: 'Tramo 1 · Cuota 9' },
		{ id: 'i10', dueMonth: '2026-12', amount: 105, status: 'pending', label: 'Tramo 1 · Cuota 10' },
		{ id: 'i11', dueMonth: '2027-01', amount: 105, status: 'pending', label: 'Tramo 1 · Cuota 11' },
		{ id: 'i12', dueMonth: '2027-02', amount: 105, status: 'pending', label: 'Tramo 1 · Cuota 12' }
	]
};

const defaultAccounts: Account[] = [
	{ id: 'acc-a', name: 'Efectivo A', owner: 'userA', initialBalance: 1000 },
	{ id: 'acc-b', name: 'Efectivo B', owner: 'userB', initialBalance: 500 },
	{ id: 'acc-j', name: 'Común', owner: 'joint', initialBalance: 200 }
];

// --- Tests ---

describe('deduceTagFromConcept', () => {
	it('debe retornar null para concepto vacío', () => {
		expect(deduceTagFromConcept('', 'income')).toBeNull();
		expect(deduceTagFromConcept('   ', 'expense')).toBeNull();
	});

	it('debe deducir etiquetas de ingresos correctamente', () => {
		expect(deduceTagFromConcept('Sueldo de Mayo', 'income')).toBe('Sueldo');
		expect(deduceTagFromConcept('Nómina empresa', 'income')).toBe('Sueldo');
		expect(deduceTagFromConcept('Dividendo de bolsa', 'income')).toBe('Inversiones');
		expect(deduceTagFromConcept('Cripto Bitcoin', 'income')).toBe('Inversiones');
		expect(deduceTagFromConcept('Proyecto freelance', 'income')).toBe('Freelance');
		expect(deduceTagFromConcept('Autónomo trabajo', 'income')).toBe('Freelance');
		expect(deduceTagFromConcept('Bizum cumpleaños', 'income')).toBe('Bizum/Regalo');
		expect(deduceTagFromConcept('Regalo mamá', 'income')).toBe('Bizum/Regalo');
		expect(deduceTagFromConcept('Reembolso Amazon', 'income')).toBe('Reembolso');
		expect(deduceTagFromConcept('Devolucion Zara', 'income')).toBe('Reembolso');
	});

	it('debe deducir etiquetas de gastos correctamente', () => {
		expect(deduceTagFromConcept('Alquiler piso', 'expense')).toBe('Alquiler/Hipoteca');
		expect(deduceTagFromConcept('Hipoteca mes', 'expense')).toBe('Alquiler/Hipoteca');
		expect(deduceTagFromConcept('Mercadona compra', 'expense')).toBe('Alimentación');
		expect(deduceTagFromConcept('Supermercado Lidl', 'expense')).toBe('Alimentación');
		expect(deduceTagFromConcept('Gasolina coche', 'expense')).toBe('Transporte');
		expect(deduceTagFromConcept('Uber trabajo', 'expense')).toBe('Transporte');
		expect(deduceTagFromConcept('Renfe Madrid', 'expense')).toBe('Transporte');
		expect(deduceTagFromConcept('Factura de luz', 'expense')).toBe('Suministros');
		expect(deduceTagFromConcept('Internet fibra', 'expense')).toBe('Suministros');
		expect(deduceTagFromConcept('Iberdrola electricidad', 'expense')).toBe('Suministros');
		expect(deduceTagFromConcept('Cine con amigos', 'expense')).toBe('Ocio/Restauración');
		expect(deduceTagFromConcept('Restaurante italiano', 'expense')).toBe('Ocio/Restauración');
		expect(deduceTagFromConcept('Cañas viernes', 'expense')).toBe('Ocio/Restauración');
		expect(deduceTagFromConcept('Netflix mensual', 'expense')).toBe('Suscripciones');
		expect(deduceTagFromConcept('Spotify premium', 'expense')).toBe('Suscripciones');
		expect(deduceTagFromConcept('Médico dentista', 'expense')).toBe('Salud/Belleza');
		expect(deduceTagFromConcept('Farmacia medicina', 'expense')).toBe('Salud/Belleza');
		expect(deduceTagFromConcept('Curso universidad', 'expense')).toBe('Educación');
		expect(deduceTagFromConcept('Libro de texto', 'expense')).toBe('Educación');
		expect(deduceTagFromConcept('Viaje a Roma', 'expense')).toBe('Viajes');
		expect(deduceTagFromConcept('Hotel booking', 'expense')).toBe('Viajes');
		expect(deduceTagFromConcept('Ropa Zara', 'expense')).toBe('Compras/Ropa');
		expect(deduceTagFromConcept('Nike zapatillas', 'expense')).toBe('Compras/Ropa');
	});

	it('debe deducir etiquetas de traspasos correctamente', () => {
		expect(deduceTagFromConcept('Ahorro mensual', 'transfer')).toBe('Ahorro/Inversión');
		expect(deduceTagFromConcept('Inversión crypto', 'transfer')).toBe('Ahorro/Inversión');
		expect(deduceTagFromConcept('Gasto común pareja', 'transfer')).toBe('Gasto Común');
		expect(deduceTagFromConcept('Compartido juntos', 'transfer')).toBe('Gasto Común');
		expect(deduceTagFromConcept('Ajuste de saldo', 'transfer')).toBe('Ajuste de Saldo');
		expect(deduceTagFromConcept('Cuadrar cuentas', 'transfer')).toBe('Ajuste de Saldo');
	});

	it('debe retornar null si no hay coincidencia', () => {
		expect(deduceTagFromConcept('Concepto genérico', 'income')).toBeNull();
		expect(deduceTagFromConcept('Algo random', 'expense')).toBeNull();
		expect(deduceTagFromConcept('Pago a fulano', 'transfer')).toBeNull();
	});
});

describe('Type Guards de Deudas', () => {
	it('isClassicDebt debe identificar deudas clásicas', () => {
		expect(isClassicDebt(classicDebt)).toBe(true);
		expect(isClassicDebt(paymentPlanDebt)).toBe(false);
	});

	it('isPaymentPlanDebt debe identificar planes de pago', () => {
		expect(isPaymentPlanDebt(paymentPlanDebt)).toBe(true);
		expect(isPaymentPlanDebt(classicDebt)).toBe(false);
	});
});

describe('hasTin y getDebtRateLabel', () => {
	it('hasTin debe retornar true si la deuda tiene TIN > 0', () => {
		expect(hasTin(classicDebtWithTin)).toBe(true);
	});

	it('hasTin debe retornar false si la deuda no tiene TIN', () => {
		expect(hasTin(classicDebt)).toBe(false);
	});

	it('getDebtRateLabel debe mostrar TAE/CER sin TIN', () => {
		expect(getDebtRateLabel(classicDebt)).toBe('TAE/CER 5%');
	});

	it('getDebtRateLabel debe mostrar TIN y TAE/CER con TIN', () => {
		expect(getDebtRateLabel(classicDebtWithTin)).toBe('TIN 2.5% / TAE/CER 3%');
	});
});

describe('PaymentPlan helpers', () => {
	it('getPaymentPlanPaidAmount debe sumar las cuotas pagadas', () => {
		expect(getPaymentPlanPaidAmount(paymentPlanDebt)).toBe(210); // 2 × 105
	});

	it('getPaymentPlanRemainingAmount debe sumar las cuotas pendientes', () => {
		expect(getPaymentPlanRemainingAmount(paymentPlanDebt)).toBe(1050); // 10 × 105
	});

	it('debe retornar 0 si todas están pagadas', () => {
		const allPaid: PaymentPlanDebt = {
			...paymentPlanDebt,
			installments: paymentPlanDebt.installments.map((i) => ({ ...i, status: 'paid' as const }))
		};
		expect(getPaymentPlanRemainingAmount(allPaid)).toBe(0);
		expect(getPaymentPlanPaidAmount(allPaid)).toBe(1260);
	});

	it('debe retornar 0 si no hay installments', () => {
		const empty: PaymentPlanDebt = { ...paymentPlanDebt, installments: [] };
		expect(getPaymentPlanPaidAmount(empty)).toBe(0);
		expect(getPaymentPlanRemainingAmount(empty)).toBe(0);
	});
});

describe('generatePaymentPlanInstallments', () => {
	it('debe generar installments correctas para un solo tramo', () => {
		const result = generatePaymentPlanInstallments('d1', '2026-05', [{ id: 't1', months: '3', amount: '100' }]);
		expect(result).toHaveLength(3);
		expect(result[0].dueMonth).toBe('2026-05');
		expect(result[1].dueMonth).toBe('2026-06');
		expect(result[2].dueMonth).toBe('2026-07');
		expect(result[0].amount).toBe(100);
		expect(result[0].status).toBe('pending');
		expect(result[0].label).toBe('Tramo 1 · Cuota 1');
	});

	it('debe generar installments para múltiples tramos', () => {
		const result = generatePaymentPlanInstallments('d2', '2026-01', [
			{ id: 't1', months: '2', amount: '50' },
			{ id: 't2', months: '3', amount: '80' }
		]);
		expect(result).toHaveLength(5);
		expect(result[0].amount).toBe(50);
		expect(result[0].label).toBe('Tramo 1 · Cuota 1');
		expect(result[1].amount).toBe(50);
		expect(result[2].amount).toBe(80);
		expect(result[2].label).toBe('Tramo 2 · Cuota 1');
		expect(result[4].dueMonth).toBe('2026-05');
	});

	it('debe manejar importes negativos (usa Math.abs)', () => {
		const result = generatePaymentPlanInstallments('d3', '2026-01', [{ id: 't1', months: '1', amount: '-50' }]);
		expect(result[0].amount).toBe(50);
	});

	it('debe retornar vacío si meses es 0', () => {
		const result = generatePaymentPlanInstallments('d4', '2026-01', [{ id: 't1', months: '0', amount: '50' }]);
		expect(result).toHaveLength(0);
	});
});

describe('getMonthlyRate', () => {
	it('debe calcular la tasa mensual en modo TIN', () => {
		const rate = getMonthlyRate(12, 'tin');
		expect(rate).toBeCloseTo(0.01, 5); // 12% / 12 = 1%
	});

	it('debe calcular la tasa mensual en modo TAE', () => {
		const rate = getMonthlyRate(12, 'tae');
		// (1 + 0.12)^(1/12) - 1 ≈ 0.00949
		expect(rate).toBeCloseTo(0.00949, 4);
	});

	it('debe retornar 0 si la tasa es 0', () => {
		expect(getMonthlyRate(0, 'tin')).toBe(0);
		expect(getMonthlyRate(0, 'tae')).toBe(0);
	});

	it('debe retornar 0 si la tasa es negativa', () => {
		expect(getMonthlyRate(-5, 'tin')).toBe(0);
		expect(getMonthlyRate(-5, 'tae')).toBe(0);
	});
});

describe('calculateMonthlyPayment', () => {
	it('debe calcular correctamente con TAE', () => {
		const cuota = calculateMonthlyPayment(10000, 5, 12, 'tae');
		expect(cuota).toBeCloseTo(855.57, 0);
	});

	it('debe calcular correctamente con TIN', () => {
		const cuota = calculateMonthlyPayment(10000, 6, 12, 'tin');
		expect(cuota).toBeCloseTo(860.66, 0);
	});

	it('debe retornar capital / meses si tasa es 0', () => {
		expect(calculateMonthlyPayment(1200, 0, 12)).toBe(100);
	});

	it('debe retornar 0 si capital es 0', () => {
		expect(calculateMonthlyPayment(0, 5, 12)).toBe(0);
	});

	it('debe retornar 0 si meses es 0', () => {
		expect(calculateMonthlyPayment(10000, 5, 0)).toBe(0);
	});

	it('debe usar TAE por defecto', () => {
		const cuota = calculateMonthlyPayment(10000, 5, 12);
		expect(cuota).toBeCloseTo(855.57, 0);
	});
});

describe('getDebtRateMode', () => {
	it('debe retornar tin si la deuda tiene TIN', () => {
		expect(getDebtRateMode(classicDebtWithTin)).toBe('tin');
	});

	it('debe retornar tae si la deuda no tiene TIN', () => {
		expect(getDebtRateMode(classicDebt)).toBe('tae');
	});
});

describe('PaymentPlan due/cashflow/overdue', () => {
	it('getPaymentPlanDueInstallments debe filtrar pendientes hasta el mes dado', () => {
		const due = getPaymentPlanDueInstallments(paymentPlanDebt, '2026-05');
		// i3 (2026-05) es pending y dueMonth <= '2026-05'
		expect(due).toHaveLength(1);
		expect(due[0].id).toBe('i3');
	});

	it('getPaymentPlanDueInstallments debe incluir overdue y current', () => {
		// Simular que hay una cuota overdue
		const debtWithOverdue: PaymentPlanDebt = {
			...paymentPlanDebt,
			installments: paymentPlanDebt.installments.map((i) =>
				i.id === 'i1' ? { ...i, status: 'pending' as const } : i
			)
		};
		const due = getPaymentPlanDueInstallments(debtWithOverdue, '2026-05');
		// i1 (2026-03 pending), i3 (2026-05 pending) = 2
		expect(due).toHaveLength(2);
	});

	it('getPaymentPlanCashflowForMonth debe sumar importes de cuotas exigibles', () => {
		expect(getPaymentPlanCashflowForMonth(paymentPlanDebt, '2026-05')).toBe(105);
		expect(getPaymentPlanCashflowForMonth(paymentPlanDebt, '2026-02')).toBe(0); // antes del inicio
	});

	it('getPaymentPlanOverdueAmount debe sumar cuotas vencidas anteriores al mes', () => {
		// i1 y i2 están paid, así que no hay overdue
		expect(getPaymentPlanOverdueAmount(paymentPlanDebt, '2026-06')).toBe(105); // i3 (2026-05) pendiente, y antes de 2026-06
	});

	it('getPaymentPlanOverdueAmount debe retornar 0 si no hay vencidas', () => {
		expect(getPaymentPlanOverdueAmount(paymentPlanDebt, '2026-03')).toBe(0);
	});
});

describe('getPaymentPlanInstallmentsForMonth / calculateDebtCashflowForMonth', () => {
	it('getPaymentPlanInstallmentsForMonth devuelve solo las cuotas programadas en ese mes exacto', () => {
		const due = getPaymentPlanInstallmentsForMonth(paymentPlanDebt, '2026-05');
		expect(due).toHaveLength(1);
		expect(due[0].id).toBe('i3');
		expect(getPaymentPlanInstallmentsForMonth(paymentPlanDebt, '2026-02')).toHaveLength(0);
	});

	it('calculateDebtCashflowForMonth imputa la cuota del mes + costes recurrentes una sola vez', () => {
		expect(calculateDebtCashflowForMonth(paymentPlanDebt, '2026-05')).toBe(105);
		expect(calculateDebtCashflowForMonth({ ...paymentPlanDebt, recurringMonthlyCosts: 12 }, '2026-05')).toBe(117);
	});

	it('calculateDebtCashflowForMonth devuelve 0 en un mes sin cuota programada (no cuenta vencidos)', () => {
		expect(calculateDebtCashflowForMonth({ ...paymentPlanDebt, recurringMonthlyCosts: 12 }, '2026-02')).toBe(0);
	});

	it('calculateDebtCashflowForMonth para deuda clásica = cuota + costes recurrentes', () => {
		expect(calculateDebtCashflowForMonth(classicDebt, '2026-05')).toBeCloseTo(
			calculateClassicDebtInstallment(classicDebt),
			2
		);
		expect(calculateDebtCashflowForMonth({ ...classicDebt, recurringMonthlyCosts: 25 }, '2026-05')).toBeCloseTo(
			calculateClassicDebtInstallment(classicDebt) + 25,
			2
		);
	});
});

describe('calculateDebtMonthlyPayment', () => {
	it('debe calcular cuota para deuda clásica', () => {
		const cuota = calculateDebtMonthlyPayment(classicDebt, '2026-05');
		expect(cuota).toBeGreaterThan(0);
		expect(cuota).toBeCloseTo(calculateMonthlyPayment(10000, 5, 12, 'tae'), 2);
	});

	it('debe calcular cuota para plan de pagos', () => {
		expect(calculateDebtMonthlyPayment(paymentPlanDebt, '2026-05')).toBe(105);
	});

	it('debe sumar costes recurrentes mensuales a un plan de pagos exigible', () => {
		expect(calculateDebtMonthlyPayment({ ...paymentPlanDebt, recurringMonthlyCosts: 12 }, '2026-05')).toBe(117);
		expect(calculateDebtMonthlyPayment({ ...paymentPlanDebt, recurringMonthlyCosts: 12 }, '2026-02')).toBe(0);
	});

	it('debe sumar costes recurrentes por cada cuota pendiente vencida o exigible', () => {
		const debtWithOverdue: PaymentPlanDebt = {
			...paymentPlanDebt,
			recurringMonthlyCosts: 12,
			installments: paymentPlanDebt.installments.map((installment) =>
				installment.id === 'i1' ? { ...installment, status: 'pending' as const } : installment
			)
		};

		expect(calculateDebtMonthlyPayment(debtWithOverdue, '2026-05')).toBe(234);
	});

	it('debe sumar costes recurrentes mensuales a la cuota clásica exigible', () => {
		const debtWithCosts: ClassicDebt = { ...classicDebt, recurringMonthlyCosts: 25 };
		expect(calculateDebtMonthlyPayment(debtWithCosts, '2026-05')).toBeCloseTo(
			calculateClassicDebtInstallment(debtWithCosts) + 25,
			2
		);
	});
});

describe('generateAmortizationSchedule', () => {
	it('debe generar cuadro completo de amortización', () => {
		const schedule = generateAmortizationSchedule(classicDebt);
		expect(schedule).toHaveLength(12);
		expect(schedule[0].month).toBe(1);
		expect(schedule[0].dueMonth).toBe('2026-05');
		expect(schedule[11].month).toBe(12);
		expect(schedule[11].dueMonth).toBe('2027-04');
		expect(schedule[11].remainingPrincipal).toBeCloseTo(0, 0);
	});

	it('todas las cuotas deben ser iguales (sistema francés)', () => {
		const schedule = generateAmortizationSchedule(classicDebt);
		const cuota = schedule[0].cuota;
		schedule.forEach((row) => {
			expect(row.cuota).toBeCloseTo(cuota, 2);
			expect(row.totalPayment).toBeCloseTo(cuota, 2);
		});
	});

	it('debe funcionar con TIN', () => {
		const schedule = generateAmortizationSchedule(classicDebtWithTin);
		expect(schedule).toHaveLength(360);
		expect(schedule[0].interestPayment).toBeGreaterThan(0);
		expect(schedule[359].remainingPrincipal).toBeCloseTo(0, 0);
	});

	it('debe funcionar sin interés', () => {
		const noInterest: ClassicDebt = { ...classicDebt, tae: 0 };
		const schedule = generateAmortizationSchedule(noInterest);
		expect(schedule).toHaveLength(12);
		schedule.forEach((row) => {
			expect(row.interestPayment).toBe(0);
			expect(row.cuota).toBeCloseTo(10000 / 12, 2);
		});
	});

	it('debe mostrar costes recurrentes como suma de la cuota total sin amortizarlos', () => {
		const schedule = generateAmortizationSchedule({ ...classicDebt, recurringMonthlyCosts: 30 });
		expect(schedule[0].recurringCosts).toBe(30);
		expect(schedule[0].totalPayment).toBeCloseTo(schedule[0].cuota + 30, 2);
		expect(schedule[0].principalPaid + schedule[0].interestPayment).toBeCloseTo(schedule[0].cuota, 2);
	});
});

describe('getTransactionOwner', () => {
	it('debe retornar el owner directo si existe', () => {
		const tx: Transaction = {
			id: 't1',
			desc: 'Test',
			money: { amount: '100.00', currency: 'EUR' },
			type: 'expense',
			tag: 'Test',
			date: '2026-05-01',
			owner: 'userA'
		};
		expect(getTransactionOwner(tx, defaultAccounts)).toBe('userA');
	});

	it('debe resolver a través de accountId si no tiene owner', () => {
		const tx: Transaction = {
			id: 't2',
			desc: 'Test',
			money: { amount: '100.00', currency: 'EUR' },
			type: 'expense',
			tag: 'Test',
			date: '2026-05-01',
			accountId: 'acc-b'
		};
		expect(getTransactionOwner(tx, defaultAccounts)).toBe('userB');
	});

	it('debe retornar joint si no tiene owner ni accountId', () => {
		const tx: Transaction = {
			id: 't3',
			desc: 'Test',
			money: { amount: '100.00', currency: 'EUR' },
			type: 'expense',
			tag: 'Test',
			date: '2026-05-01'
		};
		expect(getTransactionOwner(tx, defaultAccounts)).toBe('joint');
	});

	it('debe retornar joint si el accountId no existe en las cuentas', () => {
		const tx: Transaction = {
			id: 't4',
			desc: 'Test',
			money: { amount: '100.00', currency: 'EUR' },
			type: 'expense',
			tag: 'Test',
			date: '2026-05-01',
			accountId: 'inexistente'
		};
		expect(getTransactionOwner(tx, defaultAccounts)).toBe('joint');
	});
});

describe('getEffectiveAmount', () => {
	const txA: Transaction = {
		id: 't1',
		desc: 'Test',
		money: { amount: '200.00', currency: 'EUR' },
		type: 'expense',
		tag: 'Test',
		date: '2026-05-01',
		owner: 'userA'
	};
	const txB: Transaction = {
		id: 't2',
		desc: 'Test',
		money: { amount: '300.00', currency: 'EUR' },
		type: 'income',
		tag: 'Test',
		date: '2026-05-01',
		owner: 'userB'
	};
	const txJoint: Transaction = {
		id: 't3',
		desc: 'Test',
		money: { amount: '400.00', currency: 'EUR' },
		type: 'expense',
		tag: 'Test',
		date: '2026-05-01',
		owner: 'joint'
	};

	it('vista all: debe retornar el importe completo siempre', () => {
		expect(getEffectiveAmount(txA, 'all', defaultAccounts)).toBe(200);
		expect(getEffectiveAmount(txB, 'all', defaultAccounts)).toBe(300);
		expect(getEffectiveAmount(txJoint, 'all', defaultAccounts)).toBe(400);
	});

	it('vista userA: 100% para userA, 50% para joint, 0% para userB', () => {
		expect(getEffectiveAmount(txA, 'userA', defaultAccounts)).toBe(200);
		expect(getEffectiveAmount(txJoint, 'userA', defaultAccounts)).toBe(200);
		expect(getEffectiveAmount(txB, 'userA', defaultAccounts)).toBe(0);
	});

	it('vista userB: 100% para userB, 50% para joint, 0% para userA', () => {
		expect(getEffectiveAmount(txB, 'userB', defaultAccounts)).toBe(300);
		expect(getEffectiveAmount(txJoint, 'userB', defaultAccounts)).toBe(200);
		expect(getEffectiveAmount(txA, 'userB', defaultAccounts)).toBe(0);
	});

	it('si profileCount es 1: debe retornar 100% de la transacción siempre, ignorando owner y viewMode', () => {
		expect(getEffectiveAmount(txA, 'userA', defaultAccounts, 1)).toBe(200);
		expect(getEffectiveAmount(txJoint, 'userA', defaultAccounts, 1)).toBe(400);
		expect(getEffectiveAmount(txB, 'userA', defaultAccounts, 1)).toBe(300);
	});
});

describe('calculateTimelineBalances', () => {
	it('debe calcular saldos para un mes simple con ingresos y gastos', () => {
		const accounts: Account[] = [
			{ id: 'a1', name: 'A', owner: 'userA', initialBalance: 1000 },
			{ id: 'j1', name: 'J', owner: 'joint', initialBalance: 0 }
		];
		const periods: Period[] = [{ month: '2026-05', openingBalance: 1000 }];
		const txs: Transaction[] = [
			{
				id: 't1',
				desc: 'Nómina',
				money: { amount: '2000.00', currency: 'EUR' },
				type: 'income',
				tag: 'Sueldo',
				date: '2026-05-01',
				owner: 'userA',
				accountId: 'a1'
			},
			{
				id: 't2',
				desc: 'Compra',
				money: { amount: '100.00', currency: 'EUR' },
				type: 'expense',
				tag: 'Alimentación',
				date: '2026-05-05',
				owner: 'joint',
				accountId: 'j1'
			}
		];

		const result = calculateTimelineBalances(periods, txs, [], accounts, 'all');
		expect(result['2026-05']).toBeDefined();
		expect(result['2026-05'].incomes).toBe(2000);
		expect(result['2026-05'].expenses).toBe(100);
		expect(result['2026-05'].openingBalance).toBe(1000);
		expect(result['2026-05'].closingBalance).toBe(2900);
	});

	it('debe convertir transacciones multi-moneda a EUR usando STATIC_EXCHANGE_RATES', () => {
		const accounts: Account[] = [{ id: 'a1', name: 'Cuenta USD', owner: 'userA', initialBalance: 1000 }];
		const periods: Period[] = [{ month: '2026-05', openingBalance: 1000 }];
		const txs: Transaction[] = [
			{
				id: 't1',
				desc: 'Ingreso USD',
				money: { amount: '100.00', currency: 'USD' }, // 100 USD * 0.92 = 92 EUR
				type: 'income',
				tag: 'Otros Ingresos',
				date: '2026-05-01',
				owner: 'userA',
				accountId: 'a1'
			},
			{
				id: 't2',
				desc: 'Gasto GBP',
				money: { amount: '50.00', currency: 'GBP' }, // 50 GBP * 1.16 = 58 EUR
				type: 'expense',
				tag: 'Otros Gastos',
				date: '2026-05-05',
				owner: 'userA',
				accountId: 'a1'
			}
		];

		const result = calculateTimelineBalances(periods, txs, [], accounts, 'all');
		expect(result['2026-05']).toBeDefined();
		expect(result['2026-05'].incomes).toBe(92);
		expect(result['2026-05'].expenses).toBe(58);
		expect(result['2026-05'].openingBalance).toBe(1000);
		expect(result['2026-05'].closingBalance).toBe(1034); // 1000 + 92 - 58 = 1034
	});

	it('debe acumular saldos entre periodos', () => {
		const accounts: Account[] = [{ id: 'a1', name: 'A', owner: 'userA', initialBalance: 500 }];
		const periods: Period[] = [
			{ month: '2026-05', openingBalance: 500 },
			{ month: '2026-06', openingBalance: 0 }
		];
		const txs: Transaction[] = [
			{
				id: 't1',
				desc: 'Ingreso',
				money: { amount: '1000.00', currency: 'EUR' },
				type: 'income',
				tag: 'Sueldo',
				date: '2026-05-01',
				owner: 'userA',
				accountId: 'a1'
			},
			{
				id: 't2',
				desc: 'Gasto',
				money: { amount: '200.00', currency: 'EUR' },
				type: 'expense',
				tag: 'Otros',
				date: '2026-06-01',
				owner: 'userA',
				accountId: 'a1'
			}
		];

		const result = calculateTimelineBalances(periods, txs, [], accounts, 'all');
		expect(result['2026-05'].closingBalance).toBe(1500);
		expect(result['2026-06'].openingBalance).toBe(1500);
		expect(result['2026-06'].closingBalance).toBe(1300);
	});

	it('debe ponderar saldos por vista de usuario', () => {
		const accounts: Account[] = [
			{ id: 'a1', name: 'A', owner: 'userA', initialBalance: 1000 },
			{ id: 'b1', name: 'B', owner: 'userB', initialBalance: 500 },
			{ id: 'j1', name: 'J', owner: 'joint', initialBalance: 200 }
		];
		const periods: Period[] = [{ month: '2026-05', openingBalance: 1700 }];

		const resultAll = calculateTimelineBalances(periods, [], [], accounts, 'all');
		expect(resultAll['2026-05'].openingBalance).toBe(1700);

		const resultA = calculateTimelineBalances(periods, [], [], accounts, 'userA');
		// A owns acc-a (1000) + 50% of joint (100) = 1100
		expect(resultA['2026-05'].openingBalance).toBe(1100);

		const resultB = calculateTimelineBalances(periods, [], [], accounts, 'userB');
		// B owns acc-b (500) + 50% of joint (100) = 600
		expect(resultB['2026-05'].openingBalance).toBe(600);
	});

	it('debe aplicar transferencias correctamente', () => {
		const accounts: Account[] = [
			{ id: 'a1', name: 'A', owner: 'userA', initialBalance: 1000 },
			{ id: 'b1', name: 'B', owner: 'userB', initialBalance: 500 }
		];
		const periods: Period[] = [{ month: '2026-05', openingBalance: 1500 }];
		const txs: Transaction[] = [
			{
				id: 't1',
				desc: 'Traspaso',
				money: { amount: '200.00', currency: 'EUR' },
				type: 'transfer',
				tag: 'Traspaso',
				date: '2026-05-01',
				fromAccountId: 'a1',
				toAccountId: 'b1'
			}
		];

		const result = calculateTimelineBalances(periods, txs, [], accounts, 'all');
		// Transferencia no cambia el total
		expect(result['2026-05'].closingBalance).toBe(1500);
		expect(result['2026-05'].accountBalances['a1']).toBe(800);
		expect(result['2026-05'].accountBalances['b1']).toBe(700);
	});

	it('debe aplicar cuotas de deudas clásicas', () => {
		const accounts: Account[] = [{ id: 'a1', name: 'A', owner: 'joint', initialBalance: 5000 }];
		const periods: Period[] = [{ month: '2026-05', openingBalance: 5000 }];
		const debt: ClassicDebt = {
			id: 'd1',
			kind: 'classic',
			desc: 'Test',
			tag: 'Test',
			date: '2026-05',
			principal: 1200,
			tae: 0,
			termMonths: 12,
			owner: 'joint',
			paymentAccountId: 'a1'
		};

		const result = calculateTimelineBalances(periods, [], [debt], accounts, 'all');
		// Cuota = 1200/12 = 100
		expect(result['2026-05'].debtPayments).toBeCloseTo(100, 2);
		expect(result['2026-05'].accountBalances['a1']).toBeCloseTo(4900, 2);
	});

	it('debe ponderar pagos de deudas por vista de usuario', () => {
		const accounts: Account[] = [{ id: 'a1', name: 'A', owner: 'userA', initialBalance: 5000 }];
		const periods: Period[] = [{ month: '2026-05', openingBalance: 5000 }];
		const debt: ClassicDebt = {
			id: 'd1',
			kind: 'classic',
			desc: 'Test',
			tag: 'Test',
			date: '2026-05',
			principal: 1200,
			tae: 0,
			termMonths: 12,
			owner: 'joint' // joint debt
		};

		const resultA = calculateTimelineBalances(periods, [], [debt], accounts, 'userA');
		// joint debt → pago ponderado al 50% para userA
		expect(resultA['2026-05'].debtPayments).toBeCloseTo(50, 2);

		const resultB = calculateTimelineBalances(periods, [], [debt], accounts, 'userB');
		expect(resultB['2026-05'].debtPayments).toBeCloseTo(50, 2);
	});

	it('debe ignorar deudas fuera de rango', () => {
		const accounts: Account[] = [{ id: 'a1', name: 'A', owner: 'joint', initialBalance: 5000 }];
		const periods: Period[] = [{ month: '2026-05', openingBalance: 5000 }];
		const futureDebt: ClassicDebt = {
			id: 'd1',
			kind: 'classic',
			desc: 'Futura',
			tag: 'Test',
			date: '2027-01',
			principal: 1200,
			tae: 0,
			termMonths: 12,
			owner: 'joint',
			paymentAccountId: 'a1'
		};

		const result = calculateTimelineBalances(periods, [], [futureDebt], accounts, 'all');
		expect(result['2026-05'].debtPayments).toBe(0);
	});

	describe('plan de pagos a lo largo de varios meses (regresión: no acumular vencidos)', () => {
		const pmtAccounts: Account[] = [{ id: 'acc', name: 'Cuenta', owner: 'joint', initialBalance: 1000 }];
		const pmtPeriods: Period[] = [
			{ month: '2026-01', openingBalance: 1000 },
			{ month: '2026-02', openingBalance: 0 },
			{ month: '2026-03', openingBalance: 0 }
		];
		const buildPlan = (overrides: Partial<PaymentPlanDebt> = {}): PaymentPlanDebt => ({
			id: 'pp',
			kind: 'paymentPlan',
			desc: 'Plan',
			tag: 'Préstamo Personal',
			date: '2026-01',
			financedAmount: 300,
			fees: 0,
			totalToPay: 300,
			owner: 'joint',
			paymentAccountId: 'acc',
			installments: [
				{ id: 'p1', dueMonth: '2026-01', amount: 100, status: 'pending', label: 'C1' },
				{ id: 'p2', dueMonth: '2026-02', amount: 100, status: 'pending', label: 'C2' },
				{ id: 'p3', dueMonth: '2026-03', amount: 100, status: 'pending', label: 'C3' }
			],
			...overrides
		});

		it('debe imputar cada cuota una sola vez al saldo acumulado (no re-restar vencidas sin pagar)', () => {
			const result = calculateTimelineBalances(pmtPeriods, [], [buildPlan()], pmtAccounts, 'all');
			expect(result['2026-01'].accountBalances['acc']).toBeCloseTo(900, 2);
			expect(result['2026-02'].accountBalances['acc']).toBeCloseTo(800, 2);
			expect(result['2026-03'].accountBalances['acc']).toBeCloseTo(700, 2);
		});

		it('debe reportar debtPayments con la cuota de ese mes, no el acumulado vencido', () => {
			const result = calculateTimelineBalances(pmtPeriods, [], [buildPlan()], pmtAccounts, 'all');
			expect(result['2026-01'].debtPayments).toBeCloseTo(100, 2);
			expect(result['2026-02'].debtPayments).toBeCloseTo(100, 2);
			expect(result['2026-03'].debtPayments).toBeCloseTo(100, 2);
		});

		it('debe sumar los costes recurrentes una sola vez por mes (no por cuota vencida)', () => {
			const result = calculateTimelineBalances(
				pmtPeriods,
				[],
				[buildPlan({ recurringMonthlyCosts: 10 })],
				pmtAccounts,
				'all'
			);
			expect(result['2026-02'].debtPayments).toBeCloseTo(110, 2);
			expect(result['2026-03'].accountBalances['acc']).toBeCloseTo(1000 - 3 * 110, 2);
		});
	});
});

describe('getTagBreakdown', () => {
	it('debe agrupar gastos por etiqueta', () => {
		const txs: Transaction[] = [
			{
				id: 't1',
				desc: 'Compra 1',
				money: { amount: '50.00', currency: 'EUR' },
				type: 'expense',
				tag: 'Alimentación',
				date: '2026-05-01'
			},
			{
				id: 't2',
				desc: 'Compra 2',
				money: { amount: '30.00', currency: 'EUR' },
				type: 'expense',
				tag: 'Alimentación',
				date: '2026-05-02'
			},
			{
				id: 't3',
				desc: 'Netflix',
				money: { amount: '15.00', currency: 'EUR' },
				type: 'expense',
				tag: 'Suscripciones',
				date: '2026-05-01'
			},
			{
				id: 't4',
				desc: 'Nómina',
				money: { amount: '2000.00', currency: 'EUR' },
				type: 'income',
				tag: 'Sueldo',
				date: '2026-05-01'
			}
		];

		const result = getTagBreakdown(txs, [], '2026-05');
		expect(result).toHaveLength(2); // Solo gastos
		const alimentacion = result.find((r) => r.tag === 'Alimentación');
		expect(alimentacion?.amount).toBe(80);
		const suscripciones = result.find((r) => r.tag === 'Suscripciones');
		expect(suscripciones?.amount).toBe(15);
	});

	it('debe incluir cuotas de deudas en el breakdown', () => {
		const debt: ClassicDebt = {
			id: 'd1',
			kind: 'classic',
			desc: 'Test',
			tag: 'Hipoteca',
			date: '2026-05',
			principal: 1200,
			tae: 0,
			termMonths: 12,
			owner: 'joint'
		};

		const result = getTagBreakdown([], [debt], '2026-05');
		expect(result).toHaveLength(1);
		expect(result[0].tag).toBe('Hipoteca');
		expect(result[0].amount).toBeCloseTo(100, 2);
	});

	it('debe retornar vacío si no hay gastos ni deudas', () => {
		expect(getTagBreakdown([], [], '2026-05')).toHaveLength(0);
	});
});

describe('financeService - Edge Cases de Cobertura', () => {
	it('getEffectiveAmount debe retornar 0 para viewMode inválido', () => {
		const tx: Transaction = {
			id: 't-test',
			desc: 'Test',
			money: { amount: '100.00', currency: 'EUR' },
			type: 'expense',
			tag: 'Otros',
			date: '2026-05-01',
			owner: 'userA'
		};
		expect(getEffectiveAmount(tx, 'invalid' as any, [])).toBe(0);
	});

	it('calculateTimelineBalances debe guardar ingresos sin cuenta asociada en runningUnassignedBalances', () => {
		const accounts: Account[] = [{ id: 'a1', name: 'A', owner: 'userA', initialBalance: 1000 }];
		const periods: Period[] = [{ month: '2026-05', openingBalance: 1000 }];
		const txs: Transaction[] = [
			{
				id: 't1',
				desc: 'Ingreso Sin Cuenta',
				money: { amount: '500.00', currency: 'EUR' },
				type: 'income',
				tag: 'Sueldo',
				date: '2026-05-01',
				owner: 'userA'
			}
		];
		const result = calculateTimelineBalances(periods, txs, [], accounts, 'all');
		expect(result['2026-05'].closingBalance).toBe(1500);
	});

	it('calculateTimelineBalances debe ponderar pagos de deudas según dueños cruzados y vistas de usuario', () => {
		const accounts: Account[] = [{ id: 'a1', name: 'A', owner: 'userA', initialBalance: 5000 }];
		const periods: Period[] = [{ month: '2026-05', openingBalance: 5000 }];
		const debtA: ClassicDebt = {
			id: 'dA',
			kind: 'classic',
			desc: 'Debt A',
			tag: 'Test',
			date: '2026-05',
			principal: 1200,
			tae: 0,
			termMonths: 12,
			owner: 'userA'
		};
		const debtB: ClassicDebt = {
			id: 'dB',
			kind: 'classic',
			desc: 'Debt B',
			tag: 'Test',
			date: '2026-05',
			principal: 2400,
			tae: 0,
			termMonths: 12,
			owner: 'userB'
		};

		// En vista all, ambas deudas pagan cuota completa: 100 + 200 = 300
		const resAll = calculateTimelineBalances(periods, [], [debtA, debtB], accounts, 'all');
		expect(resAll['2026-05'].debtPayments).toBeCloseTo(300, 2);

		// En vista userA, debtA paga 100, debtB paga 0
		const resA = calculateTimelineBalances(periods, [], [debtA, debtB], accounts, 'userA');
		expect(resA['2026-05'].debtPayments).toBeCloseTo(100, 2);

		// En vista userB, debtB paga 200, debtA paga 0
		const resB = calculateTimelineBalances(periods, [], [debtA, debtB], accounts, 'userB');
		expect(resB['2026-05'].debtPayments).toBeCloseTo(200, 2);

		// Con viewMode inválido, paga 0
		const resInv = calculateTimelineBalances(periods, [], [debtA, debtB], accounts, 'invalid' as any);
		expect(resInv['2026-05'].debtPayments).toBe(0);
	});

	it('calculateTimelineBalances debe evitar descuadres de céntimos usando big.js para cálculos acumulativos', () => {
		const accounts: Account[] = [{ id: 'a1', name: 'A', owner: 'userA', initialBalance: 0 }];
		const periods: Period[] = [{ month: '2026-05', openingBalance: 0 }];
		const txs: Transaction[] = [
			{
				id: 't1',
				desc: 'Cent A',
				money: { amount: '0.10', currency: 'EUR' },
				type: 'income',
				tag: 'Ocio',
				date: '2026-05-01',
				accountId: 'a1'
			},
			{
				id: 't2',
				desc: 'Cent B',
				money: { amount: '0.20', currency: 'EUR' },
				type: 'income',
				tag: 'Ocio',
				date: '2026-05-02',
				accountId: 'a1'
			}
		];
		const result = calculateTimelineBalances(periods, txs, [], accounts, 'all');
		expect(result['2026-05'].closingBalance).toBe(0.3);
		expect(result['2026-05'].accountBalances['a1']).toBe(0.3);
	});
});

describe('sumMoney', () => {
	it('debe sumar importes con la misma divisa correctamente', () => {
		const result = sumMoney(
			[
				{ amount: '100.50', currency: 'EUR' },
				{ amount: '50.25', currency: 'EUR' }
			],
			'EUR'
		);
		expect(result).toEqual({ amount: '150.75', currency: 'EUR' });
	});

	it('debe lanzar un error ante discrepancias de divisa', () => {
		expect(() =>
			sumMoney(
				[
					{ amount: '100.50', currency: 'EUR' },
					{ amount: '50.25', currency: 'USD' }
				],
				'EUR'
			)
		).toThrow(/Operación multi-divisa no soportada/);
	});
});

describe('calculateClassicDebtRemainingPrincipal & calculateClassicDebtRemainingInterests', () => {
	const testDebt: ClassicDebt = {
		id: 'test-debt-rem',
		kind: 'classic',
		desc: 'Test Loan',
		tag: 'Préstamo',
		date: '2026-01',
		principal: 12000,
		tae: 12,
		termMonths: 12,
		owner: 'joint'
	};

	it('debe devolver el principal completo si el mes es anterior o igual al de inicio', () => {
		expect(calculateClassicDebtRemainingPrincipal(testDebt, '2025-12')).toBe(12000);
		expect(calculateClassicDebtRemainingPrincipal(testDebt, '2026-01')).toBe(12000);
	});

	it('debe reducir el principal mes a mes según el cuadro de amortización', () => {
		const remainingFeb = calculateClassicDebtRemainingPrincipal(testDebt, '2026-02');
		expect(remainingFeb).toBeLessThan(12000);
		expect(remainingFeb).toBeGreaterThan(10000);

		expect(calculateClassicDebtRemainingPrincipal(testDebt, '2027-01')).toBe(0);
		expect(calculateClassicDebtRemainingPrincipal(testDebt, '2027-06')).toBe(0);
	});

	it('debe calcular los intereses restantes correctamente', () => {
		const totalInterests = calculateClassicDebtRemainingInterests(testDebt, '2026-01');
		expect(totalInterests).toBeGreaterThan(0);

		const interestsFeb = calculateClassicDebtRemainingInterests(testDebt, '2026-02');
		expect(interestsFeb).toBeLessThan(totalInterests);

		expect(calculateClassicDebtRemainingInterests(testDebt, '2027-01')).toBe(0);
	});

	it('debe calcular correctamente a través de la función genérica calculateDebtRemainingPrincipal', () => {
		expect(calculateDebtRemainingPrincipal(testDebt, '2026-01')).toBe(12000);

		const ppDebt: PaymentPlanDebt = {
			id: 'debt-pp-test',
			kind: 'paymentPlan',
			desc: 'Plan',
			tag: 'Préstamo',
			date: '2026-01',
			financedAmount: 1000,
			fees: 0,
			totalToPay: 1000,
			owner: 'joint',
			installments: [
				{ id: 'p1', dueMonth: '2026-01', amount: 500, status: 'paid', label: '1' },
				{ id: 'p2', dueMonth: '2026-02', amount: 500, status: 'pending', label: '2' }
			]
		};
		expect(calculateDebtRemainingPrincipal(ppDebt, '2026-02')).toBe(500);
	});

	it('debe calcular correctamente a través de la función genérica calculateDebtRemainingInterests', () => {
		const totalInterests = calculateDebtRemainingInterests(testDebt, '2026-01');
		expect(totalInterests).toBeGreaterThan(0);

		const ppDebt: PaymentPlanDebt = {
			id: 'debt-pp-test',
			kind: 'paymentPlan',
			desc: 'Plan',
			tag: 'Préstamo',
			date: '2026-01',
			financedAmount: 1000,
			fees: 0,
			totalToPay: 1000,
			owner: 'joint',
			installments: [
				{ id: 'p1', dueMonth: '2026-01', amount: 500, status: 'paid', label: '1' },
				{ id: 'p2', dueMonth: '2026-02', amount: 500, status: 'pending', label: '2' }
			]
		};
		expect(calculateDebtRemainingInterests(ppDebt, '2026-02')).toBe(0);
	});
});
