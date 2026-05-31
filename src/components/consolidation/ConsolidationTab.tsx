import { useFinanzas } from '../../hooks/useFinanzas';
import { 
	calculateDebtMonthlyPayment, 
	isPaymentPlanDebt, 
	getDebtRateLabel, 
	getPaymentPlanRemainingAmount 
} from '../../services/financeService';

/**
 * Componente que renderiza la pestaña de Reunificación de Deudas (Simulador).
 * Permite seleccionar deudas existentes y simular la unificación en un nuevo préstamo,
 * visualizando la nueva cuota y comparando la carga de intereses.
 */
export function ConsolidationTab() {
	const {
		debts,
		selectedMonth,
		selectedDebtsForConsolidation,
		toggleDebtSelection,
		consolidationForm,
		setConsolidationForm,
		consolidatedPrincipal,
		additionalCapital,
		totalNewPrincipal,
		newConsolidatedCuota,
		currentConsolidatedMonthlySum,
		currentTotalInterests,
		newConsolidatedInterests,
		formatAmount
	} = useFinanzas();

	return (
		<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
			{/* Paso 1: Seleccionar Deudas */}
			<div className="lg:col-span-6 premium-card rounded-2xl p-6">
				<h3 className="text-lg font-semibold text-slate-200 mb-4">Paso 1: Selecciona las Deudas a Unificar</h3>
				<p className="text-xs text-slate-400 mb-6">
					Marca aquellas pequeñas deudas o deudas activas que te gustaría liquidar mediante un único préstamo
					unificado.
				</p>

				{debts.length === 0 ? (
					<p className="text-sm text-slate-500 py-6">No hay deudas registradas en la aplicación.</p>
				) : (
					<div className="space-y-3">
						{debts.map((d) => {
							const cuota = calculateDebtMonthlyPayment(d, selectedMonth);
							const isPlan = isPaymentPlanDebt(d);
							const isChecked = !isPlan && selectedDebtsForConsolidation.includes(d.id);
							return (
								<div
									key={d.id}
									onClick={() => toggleDebtSelection(d.id)}
									className={`p-4 rounded-xl border transition-all flex items-center justify-between ${
										isPlan
											? 'glass-panel opacity-40 cursor-not-allowed'
											: isChecked
												? 'bg-indigo-500/10 border-indigo-500/80 cursor-pointer shadow-[0_0_15px_rgba(99,102,241,0.12)]'
												: 'glass-panel hover:border-slate-700/60 cursor-pointer'
									}`}
								>
									<div className="flex items-center space-x-3">
										<input
											type="checkbox"
											checked={isChecked}
											disabled={isPlan}
											onChange={() => {}} // Se maneja con el onClick del div principal
											className="w-4 h-4 rounded border-slate-800 text-indigo-600 focus:ring-0 bg-slate-900/60"
										/>
										<div>
											<h4 className="font-bold text-slate-200 text-sm">{d.desc}</h4>
											<p className="text-xs text-slate-400">
												{isPlan
													? `Fraccionamiento: pendiente ${formatAmount(getPaymentPlanRemainingAmount(d))} · no se reunifica automáticamente`
													: `Capital: ${formatAmount(d.principal)} | ${getDebtRateLabel(d)}`}
											</p>
										</div>
									</div>
									<div className="text-right">
										<span className="block text-[10px] text-slate-500">{isPlan ? 'Exigible' : 'Cuota'}</span>
										<span className="text-sm font-bold text-slate-350">
											{formatAmount(cuota)}{isPlan ? '' : '/mes'}
										</span>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Paso 2: Propuesta Nueva Deuda */}
			<div className="lg:col-span-6 space-y-6">
				{/* Parámetros del préstamo consolidado */}
				<div className="premium-card rounded-2xl p-6">
					<h3 className="text-lg font-semibold text-slate-200 mb-4">Paso 2: Parámetros del Préstamo Unificado</h3>

					<div className="space-y-4">
						<div className="grid grid-cols-2 gap-4">
							<div>
								<label htmlFor="new-tae" className="block text-xs font-medium text-slate-400 mb-1.5">
									Nuevo TAE Propuesto (%)
								</label>
								<input
									id="new-tae"
									type="number"
									step="0.01"
									value={consolidationForm.tae}
									onChange={(e) => setConsolidationForm({ ...consolidationForm, tae: e.target.value })}
									className="w-full premium-input focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none font-mono"
								/>
							</div>
							<div>
								<label htmlFor="new-term" className="block text-xs font-medium text-slate-400 mb-1.5">
									Nuevo Plazo (Meses)
								</label>
								<input
									id="new-term"
									type="number"
									value={consolidationForm.termMonths}
									onChange={(e) => setConsolidationForm({ ...consolidationForm, termMonths: e.target.value })}
									className="w-full premium-input focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none font-mono"
								/>
							</div>
						</div>

						{/* Input de Capital Adicional */}
						<div>
							<label htmlFor="extra-capital" className="block text-xs font-medium text-slate-400 mb-1.5">
								Capital Adicional Requerido (€){' '}
								<span className="text-slate-500">(Opcional para x cosa / compra nueva)</span>
							</label>
							<input
								id="extra-capital"
								type="number"
								min="0"
								placeholder="Ej. 500 para un nuevo proyecto"
								value={consolidationForm.extraCapital}
								onChange={(e) => setConsolidationForm({ ...consolidationForm, extraCapital: e.target.value })}
								className="w-full premium-input focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none font-mono"
							/>
						</div>
					</div>
				</div>

				{/* Comparativa Analítica */}
				{selectedDebtsForConsolidation.length > 0 && (
					<div className="premium-card border-indigo-500/20 rounded-2xl p-6 space-y-4">
						<h3 className="text-lg font-bold text-slate-100">Resultado de la Reunificación</h3>

						<div className="grid grid-cols-2 gap-4">
							<div className="p-4 rounded-xl glass-panel">
								<span className="text-xs text-slate-500 block">Estructura del Capital</span>
								<div className="space-y-1 mt-1 font-mono text-xs">
									<span className="text-sm block text-slate-300">
										Deuda actual: {formatAmount(consolidatedPrincipal)}
									</span>
									{additionalCapital > 0 && (
										<span className="text-xs block text-indigo-400 font-semibold">
											+ Nuevo capital: {formatAmount(additionalCapital)}
										</span>
									)}
									<div className="border-t border-slate-800 pt-1 mt-1">
										<span className="text-sm font-bold text-slate-150">
											Préstamo Total: {formatAmount(totalNewPrincipal)}
										</span>
									</div>
								</div>
							</div>

							<div className="p-4 rounded-xl glass-panel flex flex-col justify-between">
								<div>
									<span className="text-xs text-slate-500 block">Nueva Cuota Mensual</span>
									<span className="text-xl font-black text-indigo-400 font-mono">
										{formatAmount(newConsolidatedCuota)}/mes
									</span>
								</div>
								<span className="block text-[10px] text-emerald-400 mt-2 font-medium">
									{newConsolidatedCuota < currentConsolidatedMonthlySum
										? `Ahorras ${formatAmount(currentConsolidatedMonthlySum - newConsolidatedCuota)}/mes respecto a deudas previas`
										: 'La cuota mensual aumenta'}
								</span>
							</div>
						</div>

						{/* Diferencial de intereses (Crítica Financiera) */}
						<div className="glass-panel p-4 rounded-xl space-y-2 text-sm">
							<div className="flex justify-between">
								<span className="text-slate-400">Intereses Totales Actuales:</span>
								<span className="font-semibold text-slate-300 font-mono">{formatAmount(currentTotalInterests)}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-slate-400">Intereses Préstamo Unificado (incl. nuevo dinero):</span>
								<span className="font-semibold text-slate-300 font-mono">{formatAmount(newConsolidatedInterests)}</span>
							</div>
							<div className="border-t border-slate-800/60 pt-2 flex justify-between font-bold">
								<span className="text-slate-300">Diferencial de Interés Neto:</span>
								<span
									className={`font-mono ${
										newConsolidatedInterests > currentTotalInterests ? 'text-rose-400' : 'text-emerald-400'
									}`}
								>
									{formatAmount(newConsolidatedInterests - currentTotalInterests)}
									{newConsolidatedInterests > currentTotalInterests
										? ' (Mayor coste financiero)'
										: ' (Menor coste financiero)'}
								</span>
							</div>
						</div>

						<div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-300 leading-relaxed">
							<span className="font-bold">⚠️ Análisis Técnico:</span> Alargar los plazos reduce tu asfixia de caja
							actual. Sin embargo, al añadir **
							{additionalCapital > 0 ? `${additionalCapital}€ de capital adicional` : 'capital nuevo'}**,
							incrementas la base de cálculo del préstamo, lo cual incrementa exponencialmente los intereses
							pagados a largo plazo. Utiliza el módulo de **Asesor Gemini** para que realice un estudio automático
							de esta simulación.
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
