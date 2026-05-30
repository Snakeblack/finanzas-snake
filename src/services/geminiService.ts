import type { ChatMessage, Debt, Transaction, TagBreakdown } from '../types';
import { calculateDebtMonthlyPayment, getPaymentPlanRemainingAmount, getPaymentPlanOverdueAmount, isClassicDebt, getDebtRateLabel } from './financeService';

/**
 * Parámetros requeridos para construir el prompt de contexto financiero.
 */
export type PromptContextParams = {
	userAName: string;
	userBName: string;
	viewMode: 'all' | 'userA' | 'userB';
	selectedMonth: string;
	totalIncomes: number;
	recurringIncomes: number;
	oneOffIncomes: number;
	totalExpenses: number;
	recurringExpenses: number;
	oneOffExpenses: number;
	totalMonthlyDebtPayments: number;
	netMonthlyBalance: number;
	jointPaidByA: number;
	jointPaidByB: number;
	netOwed: number;
	tagData: TagBreakdown[];
	filteredTransactions: Transaction[];
	debts: Debt[];
	filteredDebts: Debt[];
	consolidatedDebtsObjects: Debt[];
	consolidatedPrincipal: number;
	additionalCapital: number;
	totalNewPrincipal: number;
	currentConsolidatedMonthlySum: number;
	currentTotalInterests: number;
	newConsolidatedCuota: number;
	newTotalConsolidatedPayment: number;
	newConsolidatedInterests: number;
	consolidationFormTae: string;
	consolidationFormTermMonths: string;
};

/**
 * Construye el prompt de sistema detallado con el contexto financiero consolidado.
 */
export const buildFinanceDataPrompt = (params: PromptContextParams): string => {
	const vistaActiva = params.viewMode === 'all' 
		? 'Conjunta' 
		: params.viewMode === 'userA' 
			? `Individual de ${params.userAName}` 
			: `Individual de ${params.viewMode === 'userB' ? params.userBName : ''}`;

	const liquidacionText = params.netOwed === 0 
		? 'Cuentas al día' 
		: params.netOwed > 0 
			? `${params.userBName} debe a ${params.userAName} ${params.netOwed.toFixed(2)}€` 
			: `${params.userAName} debe a ${params.userBName} ${Math.abs(params.netOwed).toFixed(2)}€`;

	const tagBreakdownText = params.tagData.map((t) => `- ${t.tag}: ${t.amount.toFixed(2)}€`).join('\n');

	const transactionsText = params.filteredTransactions.length > 0
		? params.filteredTransactions.map((t) => `- Concepto: "${t.desc}", Importe: ${t.amount.toFixed(2)}€, Tipo: ${t.type}, Frecuencia: ${t.recurrence === 'recurring' ? 'Recurrente' : 'Puntual/Único'}, Etiqueta/Categoría actual: "${t.tag}", Propietario: ${t.owner}`).join('\n')
		: 'No hay movimientos registrados para este mes.';

	const describeDebtForPrompt = (debt: Debt) => {
		const ownerLabel = debt.owner === 'userA' ? params.userAName : debt.owner === 'userB' ? params.userBName : 'Conjunta';
		if (isClassicDebt(debt)) {
			return `- ${debt.desc} (Propietario: ${ownerLabel}, Fecha Inicio: ${debt.date}): Préstamo clásico. Capital: ${debt.principal}€, ${getDebtRateLabel(debt)}, Plazo: ${debt.termMonths} meses, Cuota: ${calculateDebtMonthlyPayment(debt, params.selectedMonth).toFixed(2)}€`;
		}

		return `- ${debt.desc} (Propietario: ${ownerLabel}, Fecha Inicio: ${debt.date}): Fraccionamiento manual. Importe financiado: ${debt.financedAmount}€, comisiones/intereses: ${debt.fees}€, total pactado: ${debt.totalToPay}€, pendiente: ${getPaymentPlanRemainingAmount(debt).toFixed(2)}€, vencido a ${params.selectedMonth}: ${getPaymentPlanOverdueAmount(debt, params.selectedMonth).toFixed(2)}€, flujo exigible este mes: ${calculateDebtMonthlyPayment(debt, params.selectedMonth).toFixed(2)}€`;
	};

	const debtsText = params.debts.length > 0 
		? params.debts.map((d) => {
				const isActive = params.filteredDebts.some((fd) => fd.id === d.id);
				const isFuture = d.date > params.selectedMonth;
				const status = isActive ? 'Activa este mes' : isFuture ? `Futura (empieza en ${d.date})` : 'Finalizada o inactiva en este mes';
				return `${describeDebtForPrompt(d)} [Estado en ${params.selectedMonth}: ${status}]`;
			}).join('\n')
		: 'No hay deudas registradas.';

	const consolidationText = params.consolidatedDebtsObjects.length > 0
		? `
        - Uniendo ${params.consolidatedDebtsObjects.length} préstamos clásicos por capital conjunto de ${params.consolidatedPrincipal.toFixed(2)}€.
        - Capital adicional / nuevo dinero solicitado: ${params.additionalCapital.toFixed(2)}€.
        - Capital total del nuevo préstamo simulado: ${params.totalNewPrincipal.toFixed(2)}€.
        - Cuotas individuales sumadas: ${params.currentConsolidatedMonthlySum.toFixed(2)}€/mes (Intereses acumulados actuales: ${params.currentTotalInterests.toFixed(2)}€).
        - Propuesta nueva reunificada: Plazo de ${params.consolidationFormTermMonths} meses con un TAE de ${params.consolidationFormTae}%.
        - Nueva cuota resultante: ${params.newConsolidatedCuota.toFixed(2)}€/mes (Nuevos intereses totales: ${params.newConsolidatedInterests.toFixed(2)}€).
      `
		: 'No se ha configurado simulación de reunificación de deudas actualmente.';

	return `
      Eres un analista financiero experto. Analiza el flujo de caja, balance neto, listado detallado de movimientos (inspecciona los conceptos/descripciones de las transacciones para deducir/corregir si alguna categoría/etiqueta es incorrecta o sugerir mejores agrupaciones) y deudas (tanto activas como futuras, prestando especial atención a préstamos o fraccionamientos que empiecen en meses futuros). Ofrece una respuesta directa, concisa y altamente práctica. Utiliza un formato limpio (negritas, viñetas) y da siempre una crítica rigurosa de los riesgos ocultos en plazos de deudas.
 
      CRUCIAL SOBRE RECURRENCIA: Distingue claramente entre ingresos/gastos recurrentes (mensuales/habituales) y puntuales/extraordinarios (one-off, como cancelaciones de deudas puntuales, compras de una sola vez, etc.). Al proyectar el flujo de caja de meses futuros o evaluar la salud financiera a largo plazo, NO asumas que los gastos o ingresos puntuales/extraordinarios se repetirán en los siguientes periodos. Basa tus recomendaciones de ahorro y presupuesto sobre la base de ingresos y gastos recurrentes.

      Contexto financiero mensual actual de la aplicación (para dos usuarios conjuntos):

      - Nombres de los Usuarios: ${params.userAName} y ${params.userBName}
      - Vista activa analizada: ${vistaActiva}
      - Mes Analizado: ${params.selectedMonth}
      - Total Ingresos (en esta vista): ${params.totalIncomes.toFixed(2)}€ (Ingresos Recurrentes: ${params.recurringIncomes.toFixed(2)}€, Ingresos Puntuales: ${params.oneOffIncomes.toFixed(2)}€)
      - Total Gastos (en esta vista, excluyendo cuotas de deudas): ${params.totalExpenses.toFixed(2)}€ (Gastos Recurrentes: ${params.recurringExpenses.toFixed(2)}€, Gastos Puntuales: ${params.oneOffExpenses.toFixed(2)}€)
      - Cuota Total Deudas Actuales (en esta vista): ${params.totalMonthlyDebtPayments.toFixed(2)}€
      - Balance Neto Mensual Disponible (en esta vista): ${params.netMonthlyBalance.toFixed(2)}€

      Estado de Cuentas Conjuntas para el mes:
      - Gastos conjuntos pagados por ${params.userAName}: ${params.jointPaidByA.toFixed(2)}€
      - Gastos conjuntos pagados por ${params.userBName}: ${params.jointPaidByB.toFixed(2)}€
      - Liquidación: ${liquidacionText}

      Lista de Gastos Agrupados por Etiqueta (en esta vista):
      ${tagBreakdownText}

      Listado Detallado de Movimientos (Ingresos y Gastos) de este mes:
      ${transactionsText}

      Deudas Registradas (Activas, futuras o pasadas):
      ${debtsText}

      Simulación de Reunificación Actual con Ampliación de Capital:
      ${consolidationText}
    `;
};

/**
 * Envía una consulta a la API de Gemini con una estrategia de reintento exponencial (hasta 5 intentos).
 * 
 * @param apiKey Clave API de Gemini
 * @param chatMessages Historial de mensajes de la conversación
 * @param financePrompt Prompt del sistema con contexto financiero actualizado
 * @returns Respuesta del modelo en texto plano
 */
export const askGemini = async (
	apiKey: string,
	chatMessages: ChatMessage[],
	financePrompt: string
): Promise<string> => {
	const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

	const payload = {
		contents: chatMessages.map((msg) => ({
			role: msg.role,
			parts: [{ text: msg.content }]
		})),
		systemInstruction: {
			parts: [
				{
					text: financePrompt
				}
			]
		}
	};

	let delay = 1000;

	for (let attempt = 1; attempt <= 5; attempt++) {
		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!response.ok) {
				throw new Error(`Error de comunicación con Gemini (Código HTTP ${response.status})`);
			}
			const data = await response.json();
			return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No se ha obtenido respuesta de Gemini.';
		} catch (error: any) {
			if (attempt === 5) {
				throw new Error(`Error tras 5 intentos: ${error.message}`);
			}
			await new Promise((resolve) => setTimeout(resolve, delay));
			delay *= 2;
		}
	}

	throw new Error('Error desconocido en la llamada a Gemini.');
};
