import { useFinanzas } from '../../hooks/useFinanzas';
import { 
	calculateDebtMonthlyPayment, 
	isPaymentPlanDebt, 
	getPaymentPlanOverdueAmount, 
	getPaymentPlanRemainingAmount, 
	getDebtRateLabel 
} from '../../services/financeService';
import { normalizeMonth } from '../../utils/dateUtils';

/**
 * Componente que renderiza la pestaña de Resumen General (Dashboard).
 * Muestra el gráfico de barras del flujo mensual, desglose por etiquetas,
 * liquidación de cuentas conjuntas y resumen de deudas activas.
 */
export function OverviewTab() {
	const {
		selectedMonth,
		userAName,
		userBName,
		totalIncomes,
		totalExpenses,
		totalMonthlyDebtPayments,
		netMonthlyBalance,
		tagData,
		maxTagAmount,
		jointPaidByA,
		jointPaidByB,
		netOwed,
		filteredDebts,
		formatAmount
	} = useFinanzas();

	return (
		<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
			{/* Gráfico SVG de Barras de Composición */}
			<div className="lg:col-span-7 premium-card rounded-2xl p-6">
				<h3 className="font-heading text-lg font-bold text-slate-100 mb-6">
					Composición del Flujo Mensual en {selectedMonth}
				</h3>

				<div className="h-64 flex items-end justify-around space-x-4 pt-4 border-b border-slate-800">
					{/* Ingresos */}
					<div className="flex flex-col items-center w-full max-w-[80px] group">
						<div className="text-xs font-bold text-emerald-400 mb-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
							{formatAmount(totalIncomes, { decimals: 0, showSign: true })}
						</div>
						<div
							className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-lg transition-all duration-500 hover:brightness-110"
							style={{
								height: `${Math.min(180, Math.max(8, (totalIncomes / (Math.max(totalIncomes, totalExpenses, totalMonthlyDebtPayments) || 1)) * 180))}px`
							}}
						></div>
						<span className="text-xs text-slate-400 mt-2 truncate w-full text-center">Cobros</span>
					</div>

					{/* Gastos Regulares */}
					<div className="flex flex-col items-center w-full max-w-[80px] group">
						<div className="text-xs font-bold text-rose-400 mb-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
							{formatAmount(-totalExpenses, { decimals: 0 })}
						</div>
						<div
							className="w-full bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-lg transition-all duration-500 hover:brightness-110"
							style={{
								height: `${Math.min(180, Math.max(8, (totalExpenses / (Math.max(totalIncomes, totalExpenses, totalMonthlyDebtPayments) || 1)) * 180))}px`
							}}
						></div>
						<span className="text-xs text-slate-400 mt-2 truncate w-full text-center">G. Comunes</span>
					</div>

					{/* Cuota Deuda */}
					<div className="flex flex-col items-center w-full max-w-[80px] group">
						<div className="text-xs font-bold text-amber-400 mb-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
							{formatAmount(-totalMonthlyDebtPayments, { decimals: 0 })}
						</div>
						<div
							className="w-full bg-gradient-to-t from-amber-600 to-amber-400 rounded-t-lg transition-all duration-500 hover:brightness-110"
							style={{
								height: `${Math.min(180, Math.max(8, (totalMonthlyDebtPayments / (Math.max(totalIncomes, totalExpenses, totalMonthlyDebtPayments) || 1)) * 180))}px`
							}}
						></div>
						<span className="text-xs text-slate-400 mt-2 truncate w-full text-center">Cuota Deuda</span>
					</div>

					{/* Balance Neto */}
					<div className="flex flex-col items-center w-full max-w-[80px] group">
						<div
							className={`text-xs font-bold ${netMonthlyBalance >= 0 ? 'text-indigo-400' : 'text-rose-500'} mb-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity`}
						>
							{formatAmount(netMonthlyBalance, { decimals: 0 })}
						</div>
						<div
							className={`w-full rounded-t-lg transition-all duration-500 hover:brightness-110 ${netMonthlyBalance >= 0 ? 'bg-gradient-to-t from-indigo-600 to-indigo-400' : 'bg-gradient-to-t from-rose-950 to-rose-800'}`}
							style={{
								height: `${Math.min(180, Math.max(8, (Math.abs(netMonthlyBalance) / (Math.max(totalIncomes, totalExpenses, totalMonthlyDebtPayments) || 1)) * 180))}px`
							}}
						></div>
						<span className="text-xs text-slate-400 mt-2 truncate w-full text-center">Neto</span>
					</div>
				</div>

				<div className="flex justify-between items-center mt-6 text-xs text-slate-500">
					<p>* Escala normalizada respecto al flujo mensual máximo.</p>
					<div className="flex space-x-3">
						<span className="flex items-center">
							<span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1"></span> Cobro
						</span>
						<span className="flex items-center">
							<span className="w-2.5 h-2.5 rounded-full bg-rose-500 mr-1"></span> Gasto
						</span>
						<span className="flex items-center">
							<span className="w-2.5 h-2.5 rounded-full bg-amber-500 mr-1"></span> Cuota
						</span>
					</div>
				</div>
			</div>

			{/* Desglose Acumulado por Etiquetas */}
			<div className="lg:col-span-5 premium-card rounded-2xl p-6">
				<h3 className="font-heading text-lg font-bold text-slate-100 mb-6">
					Desglose Acumulado por Etiquetas ({selectedMonth})
				</h3>

				{tagData.length === 0 ? (
					<div className="h-48 flex flex-col items-center justify-center text-slate-500 text-center">
						<p className="text-sm">No hay egresos ni cuotas este mes.</p>
						<p className="text-xs">Usa el menú para añadir datos o cambia de mes.</p>
					</div>
				) : (
					<div className="space-y-4 max-h-[250px] overflow-y-auto pr-2">
						{tagData.map(({ tag, amount }) => {
							const pct = ((amount / (totalExpenses + totalMonthlyDebtPayments)) * 100).toFixed(0);
							return (
								<div key={tag} className="space-y-1">
									<div className="flex justify-between text-xs font-medium text-slate-300">
										<span>{tag}</span>
										<span className="text-slate-400">
											{formatAmount(amount)} ({pct}%)
										</span>
									</div>
									<div className="w-full bg-slate-950/60 h-2.5 rounded-full overflow-hidden border border-white/5">
										<div
											className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full rounded-full transition-all duration-500"
											style={{ width: `${(amount / maxTagAmount) * 100}%` }}
										></div>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Tarjeta: Hacer Cuentas (Liquidación de Gastos Conjuntos) */}
			<div className="lg:col-span-12 premium-card rounded-2xl p-6">
				<h3 className="font-heading text-lg font-bold text-slate-100 mb-2 flex items-center gap-2">
					<svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
						<path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					Cuentas del Mes ({selectedMonth})
				</h3>
				<p className="text-xs text-slate-400 mb-6">
					Desglose de los gastos comunes y quién los ha pagado para cuadrar cuentas a final de mes.
				</p>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
					{/* Columna Usuario A */}
					<div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 backdrop-blur-sm shadow-inner transition-all hover:border-indigo-500/20">
						<div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Gastos comunes pagados por</div>
						<div className="text-xl font-bold text-slate-200">{userAName}</div>
						<div className="text-2xl font-black text-indigo-400 mt-2">{formatAmount(jointPaidByA)}</div>
						<p className="text-[10px] text-slate-500 mt-1">Aportación correspondiente: {formatAmount(jointPaidByA / 2)} por persona</p>
					</div>

					{/* Columna Usuario B */}
					<div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 backdrop-blur-sm shadow-inner transition-all hover:border-indigo-500/20">
						<div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Gastos comunes pagados por</div>
						<div className="text-xl font-bold text-slate-200">{userBName}</div>
						<div className="text-2xl font-black text-indigo-400 mt-2">{formatAmount(jointPaidByB)}</div>
						<p className="text-[10px] text-slate-500 mt-1">Aportación correspondiente: {formatAmount(jointPaidByB / 2)} por persona</p>
					</div>

					{/* Columna Liquidación */}
					<div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 backdrop-blur-sm shadow-inner flex flex-col justify-between transition-all hover:border-indigo-500/20">
						<div>
							<div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Estado de Cuentas</div>
							{netOwed === 0 ? (
								<div className="text-emerald-400 font-bold text-lg mt-2">¡Cuentas al día!</div>
							) : netOwed > 0 ? (
								<div>
									<div className="text-rose-400 font-bold text-lg mt-1">{userBName} debe a {userAName}</div>
									<div className="text-3xl font-black text-rose-400 mt-2">{formatAmount(netOwed)}</div>
								</div>
							) : (
								<div>
									<div className="text-rose-400 font-bold text-lg mt-1">{userAName} debe a {userBName}</div>
									<div className="text-3xl font-black text-rose-400 mt-2">{formatAmount(Math.abs(netOwed))}</div>
								</div>
							)}
						</div>
						<p className="text-[10px] text-slate-500 mt-2">
							Calculado en base a gastos compartidos 50/50 donde uno adelanta el pago.
						</p>
					</div>
				</div>
			</div>

			{/* Resumen de Deudas Activas */}
			<div className="lg:col-span-12 premium-card rounded-2xl p-6">
				<h3 className="font-heading text-lg font-bold text-slate-100 mb-4">Deudas Activas al Mes {selectedMonth}</h3>

				{filteredDebts.length === 0 ? (
					<p className="text-sm text-slate-500">
						No se registran deudas activas iniciadas en o antes de {selectedMonth}.
					</p>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{filteredDebts.map((d) => {
							const cuota = calculateDebtMonthlyPayment(d, selectedMonth);
							const isPlan = isPaymentPlanDebt(d);
							const totalIntereses = isPlan
								? d.fees
								: calculateDebtMonthlyPayment(d, selectedMonth) * d.termMonths - d.principal;
							const overdueAmount = isPlan ? getPaymentPlanOverdueAmount(d, selectedMonth) : 0;
							return (
								<div
									key={d.id}
									className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 hover:border-indigo-500/30 hover:shadow-[0_0_15px_rgba(99,102,241,0.05)] transition-all duration-300"
								>
									<div className="flex justify-between items-start mb-2">
										<span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded">
											{d.tag}
										</span>
										<span className="text-xs text-slate-500 font-mono">{normalizeMonth(d.date)}</span>
									</div>
									<h4 className="font-bold text-slate-200 text-sm mb-1">{d.desc}</h4>
									<div className="grid grid-cols-2 gap-2 my-3 text-xs border-y border-slate-800 py-2">
										<div>
											<span className="text-slate-500 block">{isPlan ? 'Financiado:' : 'Capital Inicial:'}</span>
											<span className="font-semibold text-slate-300">
												{formatAmount(isPlan ? d.financedAmount : d.principal, { decimals: 0 })}
											</span>
										</div>
										<div>
											<span className="text-slate-500 block">
												{isPlan ? 'Comisiones:' : 'Intereses Totales:'}
											</span>
											<span className="font-semibold text-rose-400">
												{formatAmount(totalIntereses)}
											</span>
										</div>
									</div>
									<div className="flex justify-between items-center text-xs mt-2 gap-3">
										<div>
											<span className="text-slate-500 block">
												{isPlan ? 'Tipo / Pendiente:' : 'Plazo / Tipo:'}
											</span>
											<span className="font-semibold text-slate-300">
												{isPlan
													? `Fraccionamiento · ${formatAmount(getPaymentPlanRemainingAmount(d))}`
													: `${d.termMonths}m / ${getDebtRateLabel(d)}`}
											</span>
											{overdueAmount > 0 && (
												<span className="block text-[10px] text-rose-400">
													Vencido: {formatAmount(overdueAmount)}
												</span>
											)}
										</div>
										<div className="text-right">
											<span className="text-slate-500 block">
												{isPlan ? 'Exigible este mes:' : 'Cuota Mensual:'}
											</span>
											<span className="font-bold text-sm text-indigo-400">
												{formatAmount(cuota)}
											</span>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
