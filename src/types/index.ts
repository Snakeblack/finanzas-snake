/**
 * Tipos de transacciones financieras soportados.
 */
export type TransactionType = 'income' | 'expense' | 'transfer';

/**
 * Pestañas o secciones activas de la interfaz de usuario.
 */
export type ActiveTab = 'overview' | 'transactions' | 'debts' | 'consolidation' | 'ai' | 'accounts';

/**
 * Representa valores numéricos de entrada que pueden ser números o strings en los formularios.
 */
export type NumericInput = number | string;

/**
 * Modos de tasa de interés anual soportados para préstamos.
 */
export type RateMode = 'tae' | 'tin';

/**
 * Tipos de deudas soportadas: clásicas (préstamos franceses) y planes de pago (fraccionamientos manuales).
 */
export type DebtKind = 'classic' | 'paymentPlan';

/**
 * Estado de pago de una cuota de un plan de pagos.
 */
export type InstallmentStatus = 'pending' | 'paid';

/**
 * Frecuencia o recurrencia de una transacción.
 */
export type TransactionRecurrence = 'one-off' | 'recurring';

/**
 * Estructura de un mensaje en el historial del chat del Asesor Gemini.
 */
export type ChatMessage = {
	role: 'user' | 'model';
	content: string;
	timestamp: string;
};

/**
 * Estructura de una cuenta bancaria o de efectivo de los usuarios.
 */
export type Account = {
	id: string;
	name: string;
	owner: 'userA' | 'userB' | 'joint';
	initialBalance: number;
};

/**
 * Representa el saldo de apertura de un mes/periodo contable determinado.
 */
export type Period = {
	month: string;
	openingBalance: number;
	openingBalanceA?: number;
	openingBalanceB?: number;
	isManualInit?: boolean;
};

export type CurrencyCode = 'EUR' | 'USD' | 'GBP';

export type Money = {
	readonly amount: string; // Serializado estrictamente como string para preservar precisión en el almacenamiento
	readonly currency: CurrencyCode;
};

/**
 * Estructura de una transacción financiera (ingreso, gasto, traspaso).
 */
export type Transaction = {
	readonly id: string;
	readonly desc: string;
	readonly money: Money; // Refactor de campo numérico plano a Value Object
	readonly type: TransactionType;
	readonly tag: string;
	readonly date: string; // Formato YYYY-MM-DD
	readonly recurrence?: TransactionRecurrence;
	readonly originId?: string; // ID de la transacción original para elementos recurrentes propagados
	readonly owner?: 'userA' | 'userB' | 'joint';
	readonly paidBy?: 'userA' | 'userB' | 'shared';
	readonly accountId?: string;
	readonly fromAccountId?: string;
	readonly toAccountId?: string;
};

/**
 * Atributos comunes compartidos por cualquier tipo de deuda registrada.
 */
export type DebtBase = {
	id: string;
	kind: DebtKind;
	desc: string;
	tag: string;
	date: string; // Mes de inicio en formato YYYY-MM
	owner?: 'userA' | 'userB' | 'joint';
	paymentAccountId?: string;
	chargeDay?: number; // Día habitual de cobro de la cuota (1-31)
	recurringMonthlyCosts?: number; // Costes recurrentes/seguros vinculados a la cuota
};

/**
 * Deuda con amortización bajo el sistema francés tradicional (TIN / TAE).
 */
export type ClassicDebt = DebtBase & {
	kind: 'classic';
	principal: number; // Capital inicial solicitado
	openingCommission?: number; // Comisión de apertura opcional
	tin?: number; // Tasa de Interés Nominal anual (opcional)
	tae: number; // Tasa Anual Equivalente / Coste Efectivo Real informado
	termMonths: number; // Plazo en meses
};

/**
 * Una cuota individual de un plan de pagos manual/fraccionamiento.
 */
export type PaymentPlanInstallment = {
	id: string;
	dueMonth: string; // Mes de vencimiento (YYYY-MM)
	amount: number; // Importe de la cuota
	status: InstallmentStatus;
	label: string; // Nombre descriptivo (ej: "Tramo 1 · Cuota 2")
};

/**
 * Deuda estructurada en un plan de pagos manual (fraccionamiento con tramos/comisiones).
 */
export type PaymentPlanDebt = DebtBase & {
	kind: 'paymentPlan';
	financedAmount: number; // Importe financiado neto
	fees: number; // Comisiones o intereses adicionales sumados
	totalToPay: number; // Total a pagar acumulado (capital + comisiones)
	installments: PaymentPlanInstallment[];
};

/**
 * Unión de tipos para representar cualquier deuda registrada.
 */
export type Debt = ClassicDebt | PaymentPlanDebt;

/**
 * Formulario para creación/edición de transacciones.
 */
export type TxForm = {
	desc: string;
	amount: string;
	currency: CurrencyCode;
	type: TransactionType;
	tag: string;
	date: string;
	recurrence?: TransactionRecurrence;
	owner: 'userA' | 'userB' | 'joint';
	paidBy: 'userA' | 'userB' | 'shared';
	accountId: string;
	fromAccountId: string;
	toAccountId: string;
};

/**
 * Estructura de un tramo de cuotas dentro del formulario de planes de pago.
 */
export type PaymentPlanTrancheForm = {
	id: string;
	months: string;
	amount: string;
};

/**
 * Formulario para creación de deudas de cualquier tipo.
 */
export type DebtForm = {
	kind: DebtKind;
	desc: string;
	principal: string;
	openingCommission: string;
	recurringMonthlyCosts: string;
	financedAmount: string;
	fees: string;
	tin: string;
	tae: string;
	termMonths: string;
	tranches: PaymentPlanTrancheForm[];
	tag: string;
	date: string;
	chargeDay: string;
	owner: 'userA' | 'userB' | 'joint';
	paymentAccountId: string;
};

/**
 * Formulario de simulación de reunificación de deudas.
 */
export type ConsolidationForm = {
	tae: string;
	termMonths: string;
	extraCapital: string;
};

/**
 * Estructura de selección para visualización de tablas de amortización.
 */
export type DebtScheduleSelection = Debt;

/**
 * Fila en el cuadro de amortización calculado de un préstamo.
 */
export type AmortizationRow = {
	month: number;
	dueMonth: string;
	cuota: number;
	recurringCosts: number;
	totalPayment: number;
	principalPaid: number;
	interestPayment: number;
	remainingPrincipal: number;
};

/**
 * Representa el total agrupado acumulado por etiqueta/categoría de gasto.
 */
export type TagBreakdown = {
	tag: string;
	amount: number;
};

/**
 * Representa una transacción parseada y lista para ser previsualizada antes de importar.
 */
export type ImportedTransaction = {
	readonly id: string;
	date: string;
	desc: string;
	amount: string; // Valor absoluto como string para money.amount
	type: TransactionType;
	tag: string;
	selected: boolean;
	isDuplicate: boolean;
	owner: 'userA' | 'userB' | 'joint';
	paidBy: 'userA' | 'userB' | 'shared';
	originalType?: TransactionType;
	fromAccountId?: string;
	toAccountId?: string;
};
