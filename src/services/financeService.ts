import Big from 'big.js';
import type {
	Transaction,
	Debt,
	ClassicDebt,
	PaymentPlanDebt,
	PaymentPlanInstallment,
	PaymentPlanTrancheForm,
	AmortizationRow,
	Account,
	Period,
	TransactionType,
	NumericInput,
	RateMode,
	TagBreakdown,
	Money,
	CurrencyCode
} from '../types';
import { toNumber } from '../utils/formatters';
import { normalizeMonth, addMonthsToMonth } from '../utils/dateUtils';

/**
 * Agrega una colección de objetos Money asegurando consistencia de divisa.
 */
export const sumMoney = (values: Money[], targetCurrency: CurrencyCode): Money => {
	const total = values.reduce((acc, curr) => {
		if (curr.currency !== targetCurrency) {
			throw new Error(
				`Operación multi-divisa no soportada sin estrategia FX explícita: ${curr.currency} a ${targetCurrency}`
			);
		}
		return acc.plus(new Big(curr.amount));
	}, new Big('0.00'));

	return {
		amount: total.toFixed(2),
		currency: targetCurrency
	};
};

/**
 * Deduce automáticamente la etiqueta apropiada basándose en las palabras clave del concepto.
 */
export const deduceTagFromConcept = (concept: string, type: TransactionType): string | null => {
	const lower = concept.toLowerCase().trim();
	if (!lower) return null;

	if (type === 'income') {
		if (
			lower.includes('sueldo') ||
			lower.includes('nómina') ||
			lower.includes('nomina') ||
			lower.includes('salary') ||
			lower.includes('empresa')
		)
			return 'Sueldo';
		if (
			lower.includes('inversion') ||
			lower.includes('dividend') ||
			lower.includes('interes') ||
			lower.includes('cripto') ||
			lower.includes('crypto')
		)
			return 'Inversiones';
		if (
			lower.includes('freelance') ||
			lower.includes('proyecto') ||
			lower.includes('autónomo') ||
			lower.includes('curro')
		)
			return 'Freelance';
		if (lower.includes('bizum') || lower.includes('regalo') || lower.includes('donación')) return 'Bizum/Regalo';
		if (lower.includes('reembolso') || lower.includes('devolucion') || lower.includes('refund')) return 'Reembolso';
	} else if (type === 'expense') {
		if (
			lower.includes('alquiler') ||
			lower.includes('hipoteca') ||
			lower.includes('rent') ||
			lower.includes('comunidad')
		)
			return 'Alquiler/Hipoteca';
		if (
			lower.includes('mercadona') ||
			lower.includes('carrefour') ||
			lower.includes('lidl') ||
			lower.includes('dia') ||
			lower.includes('supermercado') ||
			lower.includes('comida') ||
			lower.includes('alimentacion') ||
			lower.includes('compra') ||
			lower.includes('alcampo') ||
			lower.includes('ahorramas') ||
			lower.includes('fruta') ||
			lower.includes('panadería')
		)
			return 'Alimentación';
		if (
			lower.includes('gasolina') ||
			lower.includes('uber') ||
			lower.includes('cabify') ||
			lower.includes('metro') ||
			lower.includes('bus') ||
			lower.includes('tren') ||
			lower.includes('taxi') ||
			lower.includes('peaje') ||
			lower.includes('parking') ||
			lower.includes('renfe')
		)
			return 'Transporte';
		if (
			lower.includes('luz') ||
			lower.includes('agua') ||
			lower.includes('gas') ||
			lower.includes('internet') ||
			lower.includes('telefono') ||
			lower.includes('móvil') ||
			lower.includes('fibra') ||
			lower.includes('electricidad') ||
			lower.includes('iberdrola') ||
			lower.includes('endesa') ||
			lower.includes('naturgy')
		)
			return 'Suministros';
		if (
			lower.includes('cine') ||
			lower.includes('restaurante') ||
			lower.includes('bar') ||
			lower.includes('ocio') ||
			lower.includes('fiesta') ||
			lower.includes('concierto') ||
			lower.includes('cerveza') ||
			lower.includes('cafe') ||
			lower.includes('burger') ||
			lower.includes('pizza') ||
			lower.includes('cañas') ||
			lower.includes('copas') ||
			lower.includes('pub')
		)
			return 'Ocio/Restauración';
		if (
			lower.includes('netflix') ||
			lower.includes('spotify') ||
			lower.includes('prime') ||
			lower.includes('suscripcion') ||
			lower.includes('hbo') ||
			lower.includes('disney') ||
			lower.includes('youtube premium')
		)
			return 'Suscripciones';
		if (
			lower.includes('medico') ||
			lower.includes('farmacia') ||
			lower.includes('salud') ||
			lower.includes('dentista') ||
			lower.includes('optica') ||
			lower.includes('doctor') ||
			lower.includes('clinica')
		)
			return 'Salud/Belleza';
		if (
			lower.includes('colegio') ||
			lower.includes('universidad') ||
			lower.includes('curso') ||
			lower.includes('academia') ||
			lower.includes('libro') ||
			lower.includes('estudio') ||
			lower.includes('educacion')
		)
			return 'Educación';
		if (
			lower.includes('viaje') ||
			lower.includes('vuelo') ||
			lower.includes('hotel') ||
			lower.includes('booking') ||
			lower.includes('vacaciones') ||
			lower.includes('airbnb') ||
			lower.includes('avion')
		)
			return 'Viajes';
		if (
			lower.includes('ropa') ||
			lower.includes('zara') ||
			lower.includes('hm ') ||
			lower.includes('nike') ||
			lower.includes('amazon') ||
			lower.includes('tienda') ||
			lower.includes('shopping') ||
			lower.includes('compras')
		)
			return 'Compras/Ropa';
	} else if (type === 'transfer') {
		if (
			lower.includes('ahorro') ||
			lower.includes('hucha') ||
			lower.includes('inversion') ||
			lower.includes('crypto') ||
			lower.includes('cripto') ||
			lower.includes('deposito')
		)
			return 'Ahorro/Inversión';
		if (
			lower.includes('comun') ||
			lower.includes('compartido') ||
			lower.includes('juntos') ||
			lower.includes('pareja') ||
			lower.includes('casa')
		)
			return 'Gasto Común';
		if (
			lower.includes('ajuste') ||
			lower.includes('correccion') ||
			lower.includes('cuadrar') ||
			lower.includes('saldo')
		)
			return 'Ajuste de Saldo';
	}
	return null;
};

export const isClassicDebt = (debt: Debt): debt is ClassicDebt => debt.kind === 'classic';
export const isPaymentPlanDebt = (debt: Debt): debt is PaymentPlanDebt => debt.kind === 'paymentPlan';
export const hasTin = (debt: ClassicDebt): boolean => toNumber(debt.tin) > 0;

export const getDebtRateLabel = (debt: ClassicDebt): string => {
	return hasTin(debt) ? `TIN ${toNumber(debt.tin)}% / TAE/CER ${debt.tae}%` : `TAE/CER ${debt.tae}%`;
};

export const getPaymentPlanPaidAmount = (debt: PaymentPlanDebt): number => {
	return debt.installments
		.filter((installment) => installment.status === 'paid')
		.reduce((sum, item) => sum + item.amount, 0);
};

export const getPaymentPlanRemainingAmount = (debt: PaymentPlanDebt): number => {
	return debt.installments
		.filter((installment) => installment.status === 'pending')
		.reduce((sum, item) => sum + item.amount, 0);
};

export const generatePaymentPlanInstallments = (
	debtId: string,
	startMonth: string,
	tranches: PaymentPlanTrancheForm[]
): PaymentPlanInstallment[] => {
	let offset = 0;
	let installmentNumber = 1;
	const installments: PaymentPlanInstallment[] = [];

	tranches.forEach((tranche, trancheIndex) => {
		const months = Math.trunc(toNumber(tranche.months));
		const amount = Math.abs(toNumber(tranche.amount));
		for (let monthIndex = 0; monthIndex < months; monthIndex++) {
			installments.push({
				id: `${debtId}-installment-${installmentNumber}`,
				dueMonth: addMonthsToMonth(startMonth, offset),
				amount,
				status: 'pending',
				label: `Tramo ${trancheIndex + 1} · Cuota ${monthIndex + 1}`
			});
			offset += 1;
			installmentNumber += 1;
		}
	});

	return installments;
};

/**
 * Obtiene la tasa de interés mensual a partir de la tasa anual.
 */
export const getMonthlyRate = (annualRate: NumericInput, mode: RateMode): number => {
	const r = toNumber(annualRate) / 100;
	if (r <= 0) return 0;
	return mode === 'tin' ? r / 12 : (1 + r) ** (1 / 12) - 1;
};

/**
 * Calcula la cuota mensual de amortización bajo el sistema francés tradicional.
 */
export const calculateMonthlyPayment = (
	principal: NumericInput,
	annualRate: NumericInput,
	months: NumericInput,
	mode: RateMode = 'tae'
): number => {
	const p = toNumber(principal);
	const m = Math.trunc(toNumber(months));
	const monthlyRate = getMonthlyRate(annualRate, mode);

	if (!p || !m || m <= 0) return 0;
	if (monthlyRate === 0) return p / m;
	const payment = p * (monthlyRate / (1 - (1 + monthlyRate) ** -m));
	return Number.isNaN(payment) ? 0 : payment;
};

export const getDebtRateMode = (debt: ClassicDebt): RateMode => (hasTin(debt) ? 'tin' : 'tae');

export const getDebtRecurringMonthlyCosts = (debt: Debt): number => {
	return Math.max(0, toNumber(debt.recurringMonthlyCosts));
};

export const calculateClassicDebtInstallment = (debt: ClassicDebt): number => {
	return calculateMonthlyPayment(
		debt.principal,
		hasTin(debt) ? toNumber(debt.tin) : debt.tae,
		debt.termMonths,
		getDebtRateMode(debt)
	);
};

export const getPaymentPlanDueInstallments = (debt: PaymentPlanDebt, month: string): PaymentPlanInstallment[] => {
	return debt.installments.filter(
		(installment) => installment.status === 'pending' && normalizeMonth(installment.dueMonth) <= month
	);
};

export const getPaymentPlanCashflowForMonth = (debt: PaymentPlanDebt, month: string): number => {
	return getPaymentPlanDueInstallments(debt, month).reduce((sum, installment) => sum + installment.amount, 0);
};

export const getPaymentPlanOverdueAmount = (debt: PaymentPlanDebt, month: string): number => {
	return debt.installments
		.filter((installment) => installment.status === 'pending' && normalizeMonth(installment.dueMonth) < month)
		.reduce((sum, installment) => sum + installment.amount, 0);
};

/**
 * Calcula la cuota exigible para una deuda determinada en un mes contable dado.
 */
export const calculateDebtBaseMonthlyPayment = (debt: Debt, month: string): number => {
	if (isPaymentPlanDebt(debt)) {
		return getPaymentPlanCashflowForMonth(debt, month);
	}

	return calculateClassicDebtInstallment(debt);
};

export const calculateDebtMonthlyPayment = (debt: Debt, month: string): number => {
	const recurringCosts = getDebtRecurringMonthlyCosts(debt);
	if (isPaymentPlanDebt(debt)) {
		const dueInstallments = getPaymentPlanDueInstallments(debt, month);
		return dueInstallments.reduce((sum, installment) => sum + installment.amount + recurringCosts, 0);
	}

	const installment = calculateClassicDebtInstallment(debt);
	if (installment <= 0) return 0;
	return installment + recurringCosts;
};

/**
 * Cuotas de un plan de pagos **programadas en un mes contable exacto** (no acumula vencidos).
 */
export const getPaymentPlanInstallmentsForMonth = (debt: PaymentPlanDebt, month: string): PaymentPlanInstallment[] =>
	debt.installments.filter((installment) => normalizeMonth(installment.dueMonth) === month);

/**
 * Flujo de caja imputable a un mes contable concreto.
 *
 * A diferencia de `calculateDebtMonthlyPayment` —que devuelve el total exigible para *ponerse al
 * día*, sumando todo lo vencido hasta el mes y un coste recurrente por cuota vencida—, esta función
 * imputa solo la cuota **programada en ese mes** más los costes recurrentes **una vez**. Es la que
 * usa el motor de saldos acumulativo (`calculateTimelineBalances`): aplicar el catch-up mes a mes
 * sobre un saldo que se arrastra re-restaría las cuotas vencidas en cada período.
 */
export const calculateDebtCashflowForMonth = (debt: Debt, month: string): number => {
	const recurringCosts = getDebtRecurringMonthlyCosts(debt);
	if (isPaymentPlanDebt(debt)) {
		const scheduled = getPaymentPlanInstallmentsForMonth(debt, month);
		if (scheduled.length === 0) return 0;
		return scheduled.reduce((sum, installment) => sum + installment.amount, 0) + recurringCosts;
	}

	const installment = calculateClassicDebtInstallment(debt);
	if (installment <= 0) return 0;
	return installment + recurringCosts;
};

/**
 * Genera el cuadro de amortización completo de un préstamo francés.
 */
export const generateAmortizationSchedule = (debt: ClassicDebt): AmortizationRow[] => {
	const p = toNumber(debt.principal);
	const m = Math.trunc(toNumber(debt.termMonths));
	const monthlyRate = getMonthlyRate(hasTin(debt) ? toNumber(debt.tin) : debt.tae, getDebtRateMode(debt));
	const cuota = calculateClassicDebtInstallment(debt); // El cálculo de cuota base es constante para un mes de inicio
	const recurringCosts = getDebtRecurringMonthlyCosts(debt);

	let remainingPrincipal = p;
	const schedule: AmortizationRow[] = [];

	for (let i = 1; i <= m; i++) {
		const interestPayment = remainingPrincipal * monthlyRate;
		const principalPaid = cuota - interestPayment;
		remainingPrincipal = Math.max(0, remainingPrincipal - principalPaid);

		schedule.push({
			month: i,
			dueMonth: addMonthsToMonth(debt.date, i - 1),
			cuota,
			recurringCosts,
			totalPayment: cuota + recurringCosts,
			principalPaid,
			interestPayment,
			remainingPrincipal
		});
	}
	return schedule;
};

/**
 * Obtiene el propietario efectivo de una transacción resolviéndolo a partir del id de cuenta.
 */
export const getTransactionOwner = (t: Transaction, accounts: Account[]): 'userA' | 'userB' | 'joint' => {
	if (t.owner) return t.owner;
	if (t.accountId) {
		const acc = accounts.find((a) => a.id === t.accountId);
		if (acc) return acc.owner;
	}
	return 'joint';
};

/**
 * Calcula el importe ponderado de una transacción de acuerdo a la vista activa del usuario.
 */
export const getEffectiveAmount = (
	t: Transaction,
	viewMode: 'all' | 'userA' | 'userB',
	accounts: Account[],
	profileCount: number = 2
): number => {
	if (!t.money) return 0;
	const amt = new Big(t.money.amount);
	if (profileCount === 1) return toNumber(amt.toString());
	const owner = getTransactionOwner(t, accounts);
	if (viewMode === 'all') return toNumber(amt.toString());
	if (viewMode === 'userA') {
		if (owner === 'userA') return toNumber(amt.toString());
		if (owner === 'joint') return toNumber(amt.times(0.5).toString());
		return 0;
	}
	if (viewMode === 'userB') {
		if (owner === 'userB') return toNumber(amt.toString());
		if (owner === 'joint') return toNumber(amt.times(0.5).toString());
		return 0;
	}
	return 0;
};

/**
 * Estructura de balances calculados para un mes contable determinado.
 */
export type MonthBalanceData = {
	month: string;
	openingBalance: number;
	incomes: number;
	expenses: number;
	debtPayments: number;
	netBalance: number;
	closingBalance: number;
	accountBalances: Record<string, number>;
};

/**
 * Ejecuta el motor contable acumulativo sobre la línea temporal.
 * Propaga los saldos acumulados de las cuentas mes a mes, aplicando los ingresos, gastos y cuotas de deudas.
 */
export const calculateTimelineBalances = (
	periods: Period[],
	transactions: Transaction[],
	debts: Debt[],
	accounts: Account[],
	viewMode: 'all' | 'userA' | 'userB',
	profileCount: number = 2
): Record<string, MonthBalanceData> => {
	const timelineBalances: Record<string, MonthBalanceData> = {};
	const sortedPeriods = [...periods].sort((a, b) => a.month.localeCompare(b.month));

	// Saldos de cuentas que se arrastran y propagan acumulativamente periodo a periodo
	const runningAccountBalances: Record<string, number> = {};
	accounts.forEach((acc) => {
		runningAccountBalances[acc.id] = acc.initialBalance;
	});

	// Saldos contables sin cuenta asignada (efectivo libre o transacciones sin id de cuenta)
	const runningUnassignedBalances: Record<'userA' | 'userB' | 'joint', number> = {
		userA: 0,
		userB: 0,
		joint: 0
	};

	sortedPeriods.forEach((period) => {
		const m = period.month;

		// Capturar saldos de apertura al iniciar este mes
		const openingAccBalances = { ...runningAccountBalances };
		const openingUnassigned = { ...runningUnassignedBalances };

		// Filtrar movimientos del mes activo
		const mTx = transactions.filter((t) => t.date.substring(0, 7) === m);

		// Aplicar movimientos del mes sobre saldos correspondientes
		mTx.forEach((t) => {
			const amount = toNumber(t.money?.amount ?? '0');
			if (t.type === 'income') {
				if (t.accountId && runningAccountBalances[t.accountId] !== undefined) {
					runningAccountBalances[t.accountId] += amount;
				} else {
					runningUnassignedBalances[t.owner || 'joint'] += amount;
				}
			} else if (t.type === 'expense') {
				if (t.accountId && runningAccountBalances[t.accountId] !== undefined) {
					runningAccountBalances[t.accountId] -= amount;
				} else {
					runningUnassignedBalances[t.owner || 'joint'] -= amount;
				}
			} else if (t.type === 'transfer') {
				if (t.fromAccountId && runningAccountBalances[t.fromAccountId] !== undefined) {
					runningAccountBalances[t.fromAccountId] -= amount;
				}
				if (t.toAccountId && runningAccountBalances[t.toAccountId] !== undefined) {
					runningAccountBalances[t.toAccountId] += amount;
				}
			}
		});

		// Aplicar pagos de deudas (cuotas del mes) sobre saldos correspondientes
		debts.forEach((d) => {
			const dStart = normalizeMonth(d.date);
			let rawPayment = 0;
			if (isPaymentPlanDebt(d)) {
				if (dStart <= m) {
					rawPayment = calculateDebtCashflowForMonth(d, m);
				}
			} else {
				const dEnd = addMonthsToMonth(dStart, d.termMonths - 1);
				if (m >= dStart && m <= dEnd) {
					rawPayment = calculateDebtCashflowForMonth(d, m);
				}
			}

			if (rawPayment > 0) {
				if (d.paymentAccountId && runningAccountBalances[d.paymentAccountId] !== undefined) {
					runningAccountBalances[d.paymentAccountId] -= rawPayment;
				} else {
					// Caída a cuenta del propietario correspondiente, o no asignado libre
					const fallbackAcc = accounts.find((a) => a.owner === d.owner);
					if (fallbackAcc) {
						runningAccountBalances[fallbackAcc.id] -= rawPayment;
					} else {
						runningUnassignedBalances[d.owner || 'joint'] -= rawPayment;
					}
				}
			}
		});

		// Función interna auxiliar para ponderar la vista activa
		const getModeBalance = (
			accBals: Record<string, number>,
			unassignedBals: Record<'userA' | 'userB' | 'joint', number>
		) => {
			if (profileCount === 1) {
				let total = 0;
				accounts.forEach((acc) => {
					total += accBals[acc.id] ?? 0;
				});
				total += unassignedBals.userA + unassignedBals.userB + unassignedBals.joint;
				return total;
			}
			let total = 0;
			accounts.forEach((acc) => {
				const bal = accBals[acc.id] ?? 0;
				if (viewMode === 'all') {
					total += bal;
				} else if (viewMode === 'userA') {
					if (acc.owner === 'userA') total += bal;
					else if (acc.owner === 'joint') total += bal * 0.5;
				} else if (viewMode === 'userB') {
					if (acc.owner === 'userB') total += bal;
					else if (acc.owner === 'joint') total += bal * 0.5;
				}
			});

			if (viewMode === 'all') {
				total += unassignedBals.userA + unassignedBals.userB + unassignedBals.joint;
			} else if (viewMode === 'userA') {
				total += unassignedBals.userA + unassignedBals.joint * 0.5;
			} else if (viewMode === 'userB') {
				total += unassignedBals.userB + unassignedBals.joint * 0.5;
			}
			return total;
		};

		// Ponderar saldos iniciales y finales de acuerdo con la vista
		const openingBalance = getModeBalance(openingAccBalances, openingUnassigned);
		const closingBalance = getModeBalance(runningAccountBalances, runningUnassignedBalances);

		// Calcular ingresos y gastos ponderados según la vista activa
		const incomes = mTx
			.filter((t) => t.type === 'income')
			.reduce((sum, t) => sum + getEffectiveAmount(t, viewMode, accounts, profileCount), 0);
		const expenses = mTx
			.filter((t) => t.type === 'expense')
			.reduce((sum, t) => sum + getEffectiveAmount(t, viewMode, accounts, profileCount), 0);

		// Ponderar el pago de deudas según la vista
		const getEffectiveDebtPayment = (d: Debt, rawPay: number) => {
			if (profileCount === 1) return rawPay;
			const owner = d.owner ?? 'joint';
			if (viewMode === 'all') return rawPay;
			if (viewMode === 'userA') {
				if (owner === 'userA') return rawPay;
				if (owner === 'joint') return rawPay * 0.5;
				return 0;
			}
			if (viewMode === 'userB') {
				if (owner === 'userB') return rawPay;
				if (owner === 'joint') return rawPay * 0.5;
				return 0;
			}
			return 0;
		};

		const debtPayments = debts.reduce((sum, d) => {
			const dStart = normalizeMonth(d.date);
			let rawPay = 0;
			if (isPaymentPlanDebt(d)) {
				if (dStart <= m) {
					rawPay = calculateDebtCashflowForMonth(d, m);
				}
			} else {
				const dEnd = addMonthsToMonth(dStart, d.termMonths - 1);
				if (m >= dStart && m <= dEnd) {
					rawPay = calculateDebtCashflowForMonth(d, m);
				}
			}
			return sum + getEffectiveDebtPayment(d, rawPay);
		}, 0);

		// Balance neto contable del mes activo
		const netBalance = closingBalance - openingBalance;

		// Registrar balance del mes
		timelineBalances[m] = {
			month: m,
			openingBalance,
			incomes,
			expenses,
			debtPayments,
			netBalance,
			closingBalance,
			accountBalances: { ...runningAccountBalances }
		};
	});

	return timelineBalances;
};

/**
 * Calcula el desglose consolidado de gastos agrupados por etiqueta/categoría.
 */
export const getTagBreakdown = (
	filteredTransactions: Transaction[],
	filteredDebts: Debt[],
	month: string
): TagBreakdown[] => {
	const breakdown: Record<string, number> = {};

	filteredTransactions.forEach((t) => {
		if (t.type === 'expense') {
			breakdown[t.tag] = (breakdown[t.tag] || 0) + toNumber(t.money?.amount ?? '0');
		}
	});

	filteredDebts.forEach((d) => {
		const cuota = calculateDebtMonthlyPayment(d, month);
		breakdown[d.tag] = (breakdown[d.tag] || 0) + cuota;
	});

	return Object.entries(breakdown).map(([tag, amount]) => ({ tag, amount }));
};
