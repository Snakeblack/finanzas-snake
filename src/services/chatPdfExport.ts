import type { Account, Debt, Transaction, ChatMessage, TagBreakdown } from '../types';
import { calculateDebtMonthlyPayment, getDebtRateLabel, isClassicDebt } from './financeService';
import { toNumber } from '../utils/formatters';
import { convertMarkdownToHtml } from '../utils/markdownToHtml';

/** Secciones que el usuario decide incluir en el PDF exportable del asesor. */
export interface ChatPdfOptions {
	showContext: boolean;
	showDebts: boolean;
	showTransactions: boolean;
	showChat: boolean;
}

/**
 * Snapshot tipado e inmutable con todo lo que el PDF necesita: estado de dominio
 * (cuentas, deudas, transacciones, chat) más las métricas ya derivadas por el contexto.
 * Mantenerlo plano permite que `buildChatPdfHtml` sea puro y testeable sin React ni DOM.
 */
export interface ChatPdfSnapshot {
	viewMode: 'all' | 'userA' | 'userB';
	userAName: string;
	userBName: string;
	selectedMonth: string;
	netOwed: number;
	accounts: Account[];
	accountBalances: Record<string, number>;
	debts: Debt[];
	filteredDebts: Debt[];
	filteredTransactions: Transaction[];
	chatMessages: ChatMessage[];
	tagData: TagBreakdown[];
	totalIncomes: number;
	recurringIncomes: number;
	oneOffIncomes: number;
	totalExpenses: number;
	recurringExpenses: number;
	oneOffExpenses: number;
	totalMonthlyDebtPayments: number;
	netMonthlyBalance: number;
	currentOpeningBalance: number;
	currentClosingBalance: number;
}

const escapeHtml = (str: string): string => {
	if (!str) return '';
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
};

/**
 * Construye el documento HTML completo del reporte y su título (usado como nombre de
 * archivo al imprimir). Función pura: idénticas entradas ⇒ idéntica salida.
 *
 * @param now permite inyectar la fecha para tests deterministas; por defecto, el momento actual.
 */
export const buildChatPdfHtml = (
	snapshot: ChatPdfSnapshot,
	options: ChatPdfOptions,
	now: Date = new Date()
): { html: string; pdfTitle: string } => {
	const {
		viewMode,
		userAName,
		userBName,
		selectedMonth,
		netOwed,
		accounts,
		accountBalances,
		debts,
		filteredDebts,
		filteredTransactions,
		chatMessages,
		tagData,
		totalIncomes,
		recurringIncomes,
		oneOffIncomes,
		totalExpenses,
		recurringExpenses,
		oneOffExpenses,
		totalMonthlyDebtPayments,
		netMonthlyBalance,
		currentOpeningBalance,
		currentClosingBalance
	} = snapshot;

	const yyyy = now.getFullYear();
	const mm = String(now.getMonth() + 1).padStart(2, '0');
	const dd = String(now.getDate()).padStart(2, '0');
	const hh = String(now.getHours()).padStart(2, '0');
	const min = String(now.getMinutes()).padStart(2, '0');
	const ss = String(now.getSeconds()).padStart(2, '0');
	const pdfTitle = `${yyyy}${mm}${dd}-${hh}${min}${ss}-finanzaspro`;

	const dateStr = now.toLocaleDateString('es-ES', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});

	const vistaActiva =
		viewMode === 'all'
			? 'Conjunta'
			: viewMode === 'userA'
				? `Individual de ${escapeHtml(userAName)}`
				: `Individual de ${escapeHtml(userBName)}`;

	const liquidacionText =
		netOwed === 0
			? 'Cuentas al día'
			: netOwed > 0
				? `${escapeHtml(userBName)} debe a ${escapeHtml(userAName)} ${netOwed.toFixed(2)}€`
				: `${escapeHtml(userAName)} debe a ${escapeHtml(userBName)} ${Math.abs(netOwed).toFixed(2)}€`;

	const accountsListHtml = accounts
		.map((acc) => {
			const bal = accountBalances?.[acc.id] ?? acc.initialBalance;
			const ownerLabel = acc.owner === 'userA' ? userAName : acc.owner === 'userB' ? userBName : 'Conjunta';
			return `
				<tr>
					<td>${escapeHtml(acc.name)}</td>
					<td>${escapeHtml(ownerLabel)}</td>
					<td style="text-align: right; font-weight: bold; color: ${bal >= 0 ? '#10b981' : '#ef4444'}">${bal.toFixed(2)}€</td>
				</tr>
			`;
		})
		.join('');

	const debtsListHtml =
		debts.length > 0
			? debts
					.map((d) => {
						const ownerLabel =
							d.owner === 'userA' ? userAName : d.owner === 'userB' ? userBName : 'Conjunta';
						const cuota = calculateDebtMonthlyPayment(d, selectedMonth);
						const isActive = filteredDebts.some((fd) => fd.id === d.id);
						const isFuture = d.date > selectedMonth;
						const statusLabel = isActive
							? 'Activa este mes'
							: isFuture
								? `Futura (empieza en ${d.date})`
								: 'Inactiva';

						let details: string;
						const chargeDayLabel = d.chargeDay ? `, Cobro día ${d.chargeDay}` : '';
						if (isClassicDebt(d)) {
							const openingLabel = d.openingCommission ? `, Apertura: ${d.openingCommission}€` : '';
							const recurringLabel = d.recurringMonthlyCosts
								? `, Costes/seguros: ${d.recurringMonthlyCosts}€/mes`
								: '';
							details = `Capital: ${d.principal}€, ${getDebtRateLabel(d)}, Plazo: ${d.termMonths} meses${openingLabel}${recurringLabel}${chargeDayLabel}`;
						} else {
							details = `Financiado: ${d.financedAmount}€, Comisiones: ${d.fees}€, Total: ${d.totalToPay}€${chargeDayLabel}`;
						}

						return `
				<tr>
					<td><strong>${escapeHtml(d.desc)}</strong><br/><small style="color: #64748b;">${escapeHtml(details)}</small></td>
					<td>${escapeHtml(ownerLabel)}</td>
					<td>${escapeHtml(statusLabel)}</td>
					<td style="text-align: right; font-weight: bold; color: #f59e0b;">${cuota.toFixed(2)}€</td>
				</tr>
			`;
					})
					.join('')
			: '<tr><td colspan="4" style="text-align: center; color: #94a3b8;">No hay deudas registradas</td></tr>';

	const transactionsListHtml =
		filteredTransactions.length > 0
			? filteredTransactions
					.map((t) => {
						const ownerLabel =
							t.owner === 'userA' ? userAName : t.owner === 'userB' ? userBName : 'Conjunta';
						return `
				<tr>
					<td>${escapeHtml(t.desc)}</td>
					<td><span style="background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 10px;">${escapeHtml(t.tag)}</span></td>
					<td>${t.recurrence === 'recurring' ? 'Recurrente' : 'Puntual'}</td>
					<td>${escapeHtml(ownerLabel)}</td>
					<td style="text-align: right; font-weight: bold; color: ${t.type === 'income' ? '#10b981' : '#ef4444'}">
						${t.type === 'income' ? '+' : '-'}${toNumber(t.money?.amount ?? '0').toFixed(2)}€
					</td>
				</tr>
			`;
					})
					.join('')
			: '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">No hay movimientos este mes</td></tr>';

	const messagesHtml = chatMessages
		.map((msg) => {
			const isUser = msg.role === 'user';
			const sender = isUser ? 'Tú' : 'Asesor Gemini';
			const bubbleClass = isUser ? 'message-user' : 'message-model';
			const contentHtml = isUser
				? `<div style="white-space: pre-wrap;">${escapeHtml(msg.content)}</div>`
				: convertMarkdownToHtml(msg.content);

			return `
				<div class="message-bubble ${bubbleClass}">
					<div class="message-meta">${escapeHtml(sender)} (${escapeHtml(msg.timestamp)})</div>
					<div>${contentHtml}</div>
				</div>
			`;
		})
		.join('');

	const tagBreakdownHtml = tagData
		.map(
			(t) => `
			<tr>
				<td>${escapeHtml(t.tag)}</td>
				<td style="text-align: right; font-weight: bold;">${t.amount.toFixed(2)}€</td>
			</tr>
		`
		)
		.join('');

	const htmlSections: string[] = [];

	if (options.showContext) {
		htmlSections.push(`
				<div class="section-title">Contexto Financiero de la Vista</div>
				<div class="metrics-grid">
					<div class="metric-card">
						<div class="metric-label">Ingresos Totales</div>
						<div class="metric-value" style="color: #10b981;">+${totalIncomes.toFixed(2)}€</div>
						<div class="metric-sub">
							Recurrentes: +${recurringIncomes.toFixed(2)}€<br/>
							Puntuales: +${oneOffIncomes.toFixed(2)}€
						</div>
					</div>
					<div class="metric-card">
						<div class="metric-label">Gastos Totales</div>
						<div class="metric-value" style="color: #ef4444;">-${totalExpenses.toFixed(2)}€</div>
						<div class="metric-sub">
							Recurrentes: -${recurringExpenses.toFixed(2)}€<br/>
							Puntuales: -${oneOffExpenses.toFixed(2)}€
						</div>
					</div>
					<div class="metric-card">
						<div class="metric-label">Cuota Deudas</div>
						<div class="metric-value" style="color: #f59e0b;">-${totalMonthlyDebtPayments.toFixed(2)}€</div>
						<div class="metric-sub">
							Deudas activas: ${filteredDebts.length} de ${debts.length}
						</div>
					</div>
					<div class="metric-card" style="border-color: #4f46e5;">
						<div class="metric-label">Balance Neto Disponible</div>
						<div class="metric-value" style="color: ${netMonthlyBalance >= 0 ? '#4f46e5' : '#ef4444'};">
							${netMonthlyBalance.toFixed(2)}€
						</div>
						<div class="metric-sub">
							Apertura: ${currentOpeningBalance.toFixed(2)}€<br/>
							Cierre: ${currentClosingBalance.toFixed(2)}€
						</div>
					</div>
				</div>

				<div class="split-grid">
					<div>
						<div style="font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
							Saldos de Cuentas (Cierre de Mes)
						</div>
						<div class="table-container">
							<table class="table">
								<thead>
									<tr>
										<th>Cuenta</th>
										<th>Propietario</th>
										<th style="text-align: right;">Saldo</th>
									</tr>
								</thead>
								<tbody>
									${accountsListHtml}
								</tbody>
							</table>
						</div>
					</div>
					<div>
						<div style="font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
							Distribución de Gastos por Etiqueta
						</div>
						<div class="table-container">
							<table class="table">
								<thead>
									<tr>
										<th>Categoría / Etiqueta</th>
										<th style="text-align: right;">Importe</th>
									</tr>
								</thead>
								<tbody>
									${tagBreakdownHtml.length > 0 ? tagBreakdownHtml : '<tr><td colspan="2" style="text-align: center; color: #94a3b8;">Sin gastos registrados</td></tr>'}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			`);
	}

	if (options.showDebts) {
		htmlSections.push(`
				<div class="section-title">Registro de Deudas del Mes</div>
				<div class="table-container" style="margin-bottom: 24px;">
					<table class="table">
						<thead>
							<tr>
								<th>Descripción</th>
								<th>Propietario</th>
								<th>Estado</th>
								<th style="text-align: right;">Cuota este Mes</th>
							</tr>
						</thead>
						<tbody>
							${debtsListHtml}
						</tbody>
					</table>
				</div>
			`);
	}

	if (options.showTransactions) {
		htmlSections.push(`
				<div class="section-title">Movimientos Detallados del Mes</div>
				<div class="table-container" style="margin-bottom: 24px;">
					<table class="table">
						<thead>
							<tr>
								<th>Concepto</th>
								<th>Categoría</th>
								<th>Frecuencia</th>
								<th>Propietario</th>
								<th style="text-align: right;">Importe</th>
							</tr>
						</thead>
						<tbody>
							${transactionsListHtml}
						</tbody>
					</table>
				</div>
			`);
	}

	if (options.showChat) {
		htmlSections.push(`
				<div class="section-title">Historial de Conversación con el Asesor</div>
				<div class="chat-history">
					${messagesHtml}
				</div>
			`);
	}

	const bodyContent = htmlSections.join('\n<div class="page-break"></div>\n');

	const html = `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<title>${pdfTitle}</title>
				<style>
					body {
						font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
						color: #334155;
						background-color: #ffffff;
						margin: 0;
						padding: 40px;
						line-height: 1.5;
					}
					.header {
						border-bottom: 2px solid #e2e8f0;
						padding-bottom: 16px;
						margin-bottom: 24px;
					}
					.header-top {
						display: flex;
						justify-content: space-between;
						align-items: flex-start;
					}
					.header h1 {
						margin: 0;
						font-size: 26px;
						color: #4f46e5;
						font-weight: 800;
						letter-spacing: -0.5px;
					}
					.header p {
						margin: 4px 0 0 0;
						font-size: 12px;
						color: #64748b;
					}
					.report-info {
						display: flex;
						justify-content: space-between;
						margin-top: 16px;
						font-size: 11px;
						color: #475569;
						background-color: #f8fafc;
						padding: 10px 16px;
						border-radius: 8px;
						border: 1px solid #e2e8f0;
					}
					.section-title {
						font-size: 11px;
						font-weight: 800;
						color: #0f172a;
						border-bottom: 2px solid #f1f5f9;
						padding-bottom: 6px;
						margin-top: 28px;
						margin-bottom: 16px;
						text-transform: uppercase;
						letter-spacing: 0.75px;
					}
					.metrics-grid {
						display: grid;
						grid-template-columns: repeat(4, 1fr);
						gap: 16px;
						margin-bottom: 24px;
					}
					.metric-card {
						border: 1px solid #e2e8f0;
						border-radius: 12px;
						padding: 16px;
						background-color: #f8fafc;
						box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
					}
					.metric-label {
						font-size: 10px;
						font-weight: 700;
						color: #64748b;
						text-transform: uppercase;
						letter-spacing: 0.5px;
					}
					.metric-value {
						font-size: 18px;
						font-weight: 800;
						margin-top: 6px;
					}
					.metric-sub {
						font-size: 9px;
						color: #94a3b8;
						margin-top: 4px;
						line-height: 1.4;
					}
					.split-grid {
						display: grid;
						grid-template-columns: 1fr 1fr;
						gap: 24px;
						margin-bottom: 24px;
					}
					.table-container {
						border: 1px solid #e2e8f0;
						border-radius: 12px;
						overflow: hidden;
						box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
					}
					.table {
						width: 100%;
						border-collapse: collapse;
						font-size: 11px;
						text-align: left;
					}
					.table th {
						background-color: #f8fafc;
						color: #475569;
						font-weight: 700;
						padding: 8px 12px;
						border-bottom: 1px solid #e2e8f0;
						text-transform: uppercase;
						font-size: 9px;
						letter-spacing: 0.5px;
					}
					.table td {
						padding: 8px 12px;
						border-bottom: 1px solid #f1f5f9;
						color: #334155;
					}
					.table tr:last-child td {
						border-bottom: none;
					}
					.table tr:nth-child(even) td {
						background-color: #fdfdfd;
					}
					.message-bubble {
						margin-bottom: 20px;
						padding: 16px 20px;
						border-radius: 16px;
						font-size: 13px;
						line-height: 1.6;
						box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.02);
					}
					.message-user {
						background-color: #e0e7ff;
						border-left: 5px solid #4f46e5;
						color: #1e1b4b;
					}
					.message-model {
						background-color: #f8fafc;
						border: 1px solid #e2e8f0;
						border-left: 5px solid #64748b;
						color: #334155;
					}
					.message-meta {
						font-size: 10px;
						color: #64748b;
						margin-bottom: 8px;
						font-weight: 700;
						text-transform: uppercase;
						letter-spacing: 0.5px;
					}
					.page-break {
						page-break-before: always;
					}

					@media print {
						body {
							padding: 20px;
						}
						.metric-card {
							background-color: #f8fafc !important;
							-webkit-print-color-adjust: exact;
							print-color-adjust: exact;
							box-shadow: none !important;
							border: 1px solid #cbd5e1 !important;
						}
						.message-bubble {
							-webkit-print-color-adjust: exact;
							print-color-adjust: exact;
							box-shadow: none !important;
							border: 1px solid #e2e8f0 !important;
						}
						.message-user {
							background-color: #e0e7ff !important;
							border-left: 5px solid #4f46e5 !important;
						}
						.message-model {
							background-color: #f8fafc !important;
							border-left: 5px solid #64748b !important;
						}
					}
				</style>
			</head>
			<body>
				<div class="header">
					<div class="header-top">
						<div>
							<h1>FinanzasPro</h1>
							<p>Reporte de Análisis y Asesoría Financiera IA</p>
						</div>
						<div style="text-align: right;">
							<span style="background-color: #4f46e5; color: white; padding: 4px 10px; border-radius: 20px; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
								Asesor Gemini
							</span>
						</div>
					</div>
					<div class="report-info">
						<div><strong>Mes analizado:</strong> ${selectedMonth}</div>
						<div><strong>Vista activa:</strong> ${vistaActiva}</div>
						<div><strong>Liquidación:</strong> ${liquidacionText}</div>
						<div><strong>Generado el:</strong> ${dateStr}</div>
					</div>
				</div>

				${bodyContent || '<p style="text-align: center; color: #64748b; margin-top: 40px; font-style: italic;">Ninguna sección seleccionada para exportar.</p>'}

				<div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center; font-size: 10px; color: #94a3b8;">
					Generado automáticamente por FinanzasPro con tecnología Gemini 3.5.
				</div>
			</body>
			</html>
		`;

	return { html, pdfTitle };
};
