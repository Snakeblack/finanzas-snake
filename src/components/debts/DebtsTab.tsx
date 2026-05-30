import { useFinanzas } from '../../hooks/useFinanzas';
import { 
	calculateDebtMonthlyPayment, 
	isPaymentPlanDebt, 
	getPaymentPlanOverdueAmount, 
	getPaymentPlanRemainingAmount, 
	getDebtRateLabel,
	getPaymentPlanPaidAmount,
	generateAmortizationSchedule
} from '../../services/financeService';
import { normalizeMonth } from '../../utils/dateUtils';
import { DEFAULT_TAGS } from '../../constants';
import { toNumber } from '../../utils/formatters';
import { Icons } from '../common/Icons';

/**
 * Componente que renderiza la pestaña de Deudas (Préstamos y Fraccionamientos).
 * Permite registrar préstamos clásicos franceses y fraccionamientos manuales tramo a tramo.
 * Muestra el plan de amortización correspondiente y permite marcar cuotas como pagadas.
 */
export function DebtsTab() {
	const {
		debts,
		debtForm,
		setDebtForm,
		handleAddDebt,
		handleDeleteDebt,
		debtFormError,
		accounts,
		userAName,
		userBName,
		selectedMonth,
		selectedDebtSchedule,
		setSelectedDebtSchedule,
		addPaymentPlanTranche,
		removePaymentPlanTranche,
		updatePaymentPlanTranche,
		togglePaymentPlanInstallmentStatus
	} = useFinanzas();

	// Cálculos locales para el fraccionamiento manual en el formulario
	const paymentPlanTotalToPay = Math.abs(toNumber(debtForm.financedAmount)) + Math.abs(toNumber(debtForm.fees));
	const paymentPlanScheduleTotal = debtForm.tranches.reduce(
		(sum, t) => sum + Math.abs(toNumber(t.months)) * Math.abs(toNumber(t.amount)),
		0
	);
	const paymentPlanScheduleDiff = paymentPlanScheduleTotal - paymentPlanTotalToPay;

	return (
		<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
			{/* Formulario */}
			<div className="lg:col-span-4 premium-card rounded-2xl p-6 h-fit">
				<h3 className="font-heading text-lg font-bold text-slate-100 mb-6 flex items-center">
					<span className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg mr-2">
						<Icons.CreditCard className="w-4 h-4" />
					</span>
					Nueva deuda
				</h3>

				<form onSubmit={handleAddDebt} className="space-y-4">
					<div>
						<label htmlFor="debt-desc" className="block text-xs font-medium text-slate-400 mb-1.5">
							Nombre de la Deuda
						</label>
						<input
							id="debt-desc"
							type="text"
							required
							placeholder="Ej. Préstamo de Coche, Tarjeta..."
							value={debtForm.desc}
							onChange={(e) => setDebtForm({ ...debtForm, desc: e.target.value })}
							className="w-full premium-input rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600"
						/>
					</div>

					<div>
						<label className="block text-xs font-medium text-slate-400 mb-1.5">Tipo de deuda</label>
						<div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
							<button
								type="button"
								onClick={() => setDebtForm({ ...debtForm, kind: 'classic' })}
								className={`py-2 rounded-lg text-xs font-semibold transition-all ${debtForm.kind === 'classic' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
							>
								Préstamo TIN/TAE
							</button>
							<button
								type="button"
								onClick={() => setDebtForm({ ...debtForm, kind: 'paymentPlan' })}
								className={`py-2 rounded-lg text-xs font-semibold transition-all ${debtForm.kind === 'paymentPlan' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
							>
								Fraccionamiento manual
							</button>
						</div>
					</div>

					<div>
						<label className="block text-xs font-medium text-slate-400 mb-1.5">¿De quién es la deuda?</label>
						<div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
							<button
								type="button"
								onClick={() => setDebtForm({ ...debtForm, owner: 'userA' })}
								className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
									debtForm.owner === 'userA'
										? 'bg-indigo-600 text-white shadow-md'
										: 'text-slate-400 hover:text-slate-200'
								}`}
							>
								{userAName}
							</button>
							<button
								type="button"
								onClick={() => setDebtForm({ ...debtForm, owner: 'userB' })}
								className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
									debtForm.owner === 'userB'
										? 'bg-indigo-600 text-white shadow-md'
										: 'text-slate-400 hover:text-slate-200'
								}`}
							>
								{userBName}
							</button>
							<button
								type="button"
								onClick={() => setDebtForm({ ...debtForm, owner: 'joint' })}
								className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
									debtForm.owner === 'joint' || !debtForm.owner
										? 'bg-indigo-600 text-white shadow-md'
										: 'text-slate-400 hover:text-slate-200'
								}`}
							>
								Conjunta
							</button>
						</div>
					</div>

					<div>
						<label htmlFor="debt-payment-account" className="block text-xs font-medium text-slate-400 mb-1.5">
							Cuenta para el Pago de la Cuota
						</label>
						<select
							id="debt-payment-account"
							value={debtForm.paymentAccountId}
							onChange={(e) => {
								const accId = e.target.value;
								const acc = accounts.find((a) => a.id === accId);
								setDebtForm({
									...debtForm,
									paymentAccountId: accId,
									owner: acc ? acc.owner : debtForm.owner
								});
							}}
							className="w-full premium-input rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none"
						>
							<option value="">Sin Cuenta (Automático por Propietario)</option>
							{accounts.map((acc) => (
								<option key={acc.id} value={acc.id}>
									{acc.name} ({acc.owner === 'userA' ? userAName : acc.owner === 'userB' ? userBName : 'Compartida'})
								</option>
							))}
						</select>
					</div>

					{debtForm.kind === 'classic' ? (
						<>
							<div>
								<label htmlFor="debt-principal" className="block text-xs font-medium text-slate-400 mb-1.5">
									Capital Solicitado (€)
								</label>
								<input
									id="debt-principal"
									type="number"
									required={debtForm.kind === 'classic'}
									min="1"
									placeholder="Capital inicial"
									value={debtForm.principal}
									onChange={(e) => setDebtForm({ ...debtForm, principal: e.target.value })}
									className="w-full premium-input rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600"
								/>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
								<div>
									<label htmlFor="debt-tin" className="block text-xs font-medium text-slate-400 mb-1.5">
										TIN (%)
									</label>
									<input
										id="debt-tin"
										type="number"
										step="0.01"
										min="0"
										placeholder="Ej. 5.95"
										value={debtForm.tin}
										onChange={(e) => setDebtForm({ ...debtForm, tin: e.target.value })}
										className="w-full premium-input rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none"
									/>
								</div>

								<div>
									<label htmlFor="debt-tae" className="block text-xs font-medium text-slate-400 mb-1.5">
										TAE (%)
									</label>
									<input
										id="debt-tae"
										type="number"
										step="0.01"
										required={debtForm.kind === 'classic'}
										min="0"
										placeholder="Ej. 6.5"
										value={debtForm.tae}
										onChange={(e) => setDebtForm({ ...debtForm, tae: e.target.value })}
										className="w-full premium-input rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none"
									/>
								</div>

								<div>
									<label htmlFor="debt-term" className="block text-xs font-medium text-slate-400 mb-1.5">
										Plazo (Meses)
									</label>
									<input
										id="debt-term"
										type="number"
										required={debtForm.kind === 'classic'}
										min="1"
										placeholder="Ej. 36"
										value={debtForm.termMonths}
										onChange={(e) => setDebtForm({ ...debtForm, termMonths: e.target.value })}
										className="w-full premium-input rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none"
									/>
								</div>
							</div>

							<p className="text-[10px] text-slate-500 -mt-2">
								Si cargás TIN, la cuota y la amortización usan TIN nominal mensual. Si lo dejás vacío, se deriva
								el tipo mensual desde la TAE.
							</p>
						</>
					) : (
						<>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div>
									<label htmlFor="plan-financed" className="block text-xs font-medium text-slate-400 mb-1.5">
										Importe fraccionado (€)
									</label>
									<input
										id="plan-financed"
										type="number"
										required={debtForm.kind === 'paymentPlan'}
										min="0.01"
										step="0.01"
										placeholder="Ej. 1000"
										value={debtForm.financedAmount}
										onChange={(e) => setDebtForm({ ...debtForm, financedAmount: e.target.value })}
										className="w-full premium-input rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none"
									/>
								</div>
								<div>
									<label htmlFor="plan-fees" className="block text-xs font-medium text-slate-400 mb-1.5">
										Comisiones / intereses (€)
									</label>
									<input
										id="plan-fees"
										type="number"
										min="0"
										step="0.01"
										placeholder="Ej. 80"
										value={debtForm.fees}
										onChange={(e) => setDebtForm({ ...debtForm, fees: e.target.value })}
										className="w-full premium-input rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none"
									/>
								</div>
							</div>

							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<label className="block text-xs font-medium text-slate-400">Tramos de pago</label>
									<button
										type="button"
										onClick={addPaymentPlanTranche}
										className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
									>
										+ Agregar tramo
									</button>
								</div>
								{debtForm.tranches.map((tranche, index) => (
									<div key={tranche.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
										<div>
											<label className="block text-[10px] text-slate-500 mb-1">Meses</label>
											<input
												type="number"
												min="1"
												placeholder="Ej. 7"
												value={tranche.months}
												onChange={(e) => updatePaymentPlanTranche(tranche.id, { months: e.target.value })}
												className="w-full premium-input rounded-xl px-3 py-2 text-sm text-slate-100 outline-none"
											/>
										</div>
										<div>
											<label className="block text-[10px] text-slate-500 mb-1">Cuota mensual (€)</label>
											<input
												type="number"
												min="0.01"
												step="0.01"
												placeholder="Ej. 100"
												value={tranche.amount}
												onChange={(e) => updatePaymentPlanTranche(tranche.id, { amount: e.target.value })}
												className="w-full premium-input rounded-xl px-3 py-2 text-sm text-slate-100 outline-none"
											/>
										</div>
										<button
											type="button"
											onClick={() => removePaymentPlanTranche(tranche.id)}
											disabled={debtForm.tranches.length === 1}
											className="px-2 py-2 bg-rose-500/15 hover:bg-rose-500 disabled:opacity-40 text-rose-400 hover:text-white rounded-xl"
											aria-label={`Eliminar tramo ${index + 1}`}
										>
											<Icons.Trash />
										</button>
									</div>
								))}
							</div>

							<div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1">
								<div className="flex justify-between">
									<span className="text-slate-500">Total a pagar:</span>
									<span className="font-semibold text-slate-300">{paymentPlanTotalToPay.toFixed(2)}€</span>
								</div>
								<div className="flex justify-between">
									<span className="text-slate-500">Suma de cuotas:</span>
									<span
										className={
											Math.abs(paymentPlanScheduleDiff) <= 0.01
												? 'font-semibold text-emerald-400'
												: 'font-semibold text-rose-400'
										}
									>
										{paymentPlanScheduleTotal.toFixed(2)}€
									</span>
								</div>
								<p className="text-[10px] text-slate-500">
									La suma de cuotas tiene que coincidir con el total a pagar. Las vencidas no pagadas se arrastran
									al mes activo.
								</p>
							</div>
						</>
					)}

					<div>
						<label htmlFor="debt-date" className="block text-xs font-medium text-slate-400 mb-1.5">
							Fecha de Inicio
						</label>
						<input
							id="debt-date"
							type="month"
							required
							value={debtForm.date}
							onChange={(e) => setDebtForm({ ...debtForm, date: e.target.value })}
							className="w-full premium-input rounded-xl px-4 py-2.5 text-sm text-slate-100 font-mono outline-none"
						/>
					</div>

					<div>
						<label htmlFor="debt-tag" className="block text-xs font-medium text-slate-400 mb-1.5">
							Etiqueta de Deuda
						</label>
						<select
							id="debt-tag"
							value={debtForm.tag}
							onChange={(e) => setDebtForm({ ...debtForm, tag: e.target.value })}
							className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none"
						>
							{DEFAULT_TAGS.debt.map((tag) => (
								<option key={tag} value={tag}>
									{tag}
								</option>
							))}
						</select>
					</div>

					{debtFormError && (
						<div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl">
							{debtFormError}
						</div>
					)}

					<button
						type="submit"
						className="w-full mt-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 hover:shadow-[0_0_15px_rgba(245,158,11,0.4)] text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-md active:scale-95"
					>
						Agregar deuda
					</button>
				</form>
			</div>

			{/* Lista de deudas activas */}
			<div className="lg:col-span-8 space-y-6">
				<div className="premium-card rounded-2xl p-6">
					<h3 className="font-heading text-lg font-bold text-slate-100 mb-6">Listado de deudas existentes</h3>

					{debts.length === 0 ? (
						<p className="text-slate-500 text-sm">No tienes deudas registradas.</p>
					) : (
						<div className="space-y-4">
							{debts.map((d) => {
								const cuota = calculateDebtMonthlyPayment(d, selectedMonth);
								const isPlan = isPaymentPlanDebt(d);
								const overdueAmount = isPlan ? getPaymentPlanOverdueAmount(d, selectedMonth) : 0;
								return (
									<div
										key={d.id}
										className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/60 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 hover:border-indigo-500/20 hover:shadow-[0_0_15px_rgba(99,102,241,0.05)]"
									>
										<div>
											<div className="flex items-center space-x-2">
												<h4 className="font-bold text-slate-100 text-sm">{d.desc}</h4>
												<span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-400 font-bold rounded">
													{d.tag}
												</span>
											</div>
											<p className="text-xs text-slate-400 mt-1">
												{isPlan
													? `Financiado: ${d.financedAmount}€ | Comisiones: ${d.fees}€ | Pendiente: ${getPaymentPlanRemainingAmount(d).toFixed(2)}€`
													: `Capital: ${d.principal}€ | ${getDebtRateLabel(d)} | Plazo: ${d.termMonths} meses`}
											</p>
											<p className="text-[10px] text-slate-500">
												Iniciado en: {normalizeMonth(d.date)}
												{overdueAmount > 0 ? ` · Vencido: ${overdueAmount.toFixed(2)}€` : ''}
											</p>
										</div>
										<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
											<div className="text-left sm:text-right shrink-0">
												<span className="block text-[10px] text-slate-500">
													{isPlan ? 'Exigible este mes' : 'Cuota Mensual'}
												</span>
												<span className="text-base font-extrabold text-amber-500">{cuota.toFixed(2)}€</span>
											</div>

											<div className="flex sm:flex-col gap-1.5 w-full sm:w-auto">
												<button
													onClick={() => setSelectedDebtSchedule(d)}
													className="flex-1 sm:flex-initial px-3 py-2 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/20 text-xs font-semibold rounded-lg transition-colors min-h-[40px] flex items-center justify-center"
												>
													{isPlan ? 'Calendario' : 'Plan Amort.'}
												</button>
												<button
													onClick={() => handleDeleteDebt(d.id)}
													className="flex-1 sm:flex-initial px-3 py-2 bg-rose-500/15 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 text-xs font-semibold rounded-lg transition-colors min-h-[40px] flex items-center justify-center"
												>
													Eliminar
												</button>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>

				{/* Detalle de deuda */}
				{selectedDebtSchedule && (
					<div className="premium-card border-indigo-500/20 rounded-2xl p-6">
						<div className="flex justify-between items-center mb-4">
							<div>
								<h4 className="font-bold text-slate-100 text-sm">
									{isPaymentPlanDebt(selectedDebtSchedule) ? 'Calendario de pagos' : 'Amortización'}:{' '}
									{selectedDebtSchedule.desc}
								</h4>
								<p className="text-xs text-slate-400">
									{isPaymentPlanDebt(selectedDebtSchedule)
										? `Total ${selectedDebtSchedule.totalToPay.toFixed(2)}€ · Pagado ${getPaymentPlanPaidAmount(selectedDebtSchedule).toFixed(2)}€ · Pendiente ${getPaymentPlanRemainingAmount(selectedDebtSchedule).toFixed(2)}€ · Vencido ${getPaymentPlanOverdueAmount(selectedDebtSchedule, selectedMonth).toFixed(2)}€`
										: `${selectedDebtSchedule.termMonths} meses, ${getDebtRateLabel(selectedDebtSchedule)}`}
								</p>
							</div>
							<button
								onClick={() => setSelectedDebtSchedule(null)}
								className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg font-semibold"
							>
								Cerrar
							</button>
						</div>

						<div className="max-h-72 overflow-y-auto border border-slate-800 rounded-lg overflow-x-auto">
							{isPaymentPlanDebt(selectedDebtSchedule) ? (
								<table className="w-full text-left text-xs min-w-[450px]">
									<thead className="bg-slate-950 sticky top-0 border-b border-slate-800">
										<tr className="text-slate-400">
											<th className="p-2">Mes</th>
											<th className="p-2">Cuota</th>
											<th className="p-2">Estado</th>
											<th className="p-2 text-right">Acción</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-800/50 text-slate-300">
										{selectedDebtSchedule.installments.map((installment) => {
											const isOverdue = installment.status === 'pending' && installment.dueMonth < selectedMonth;
											return (
												<tr key={installment.id} className="hover:bg-slate-800/10">
													<td className="p-2 font-mono text-slate-500">{installment.dueMonth}</td>
													<td className="p-2 font-mono">{installment.amount.toFixed(2)}€</td>
													<td className={isOverdue ? 'p-2 text-rose-400 font-semibold' : 'p-2 text-slate-300'}>
														{installment.status === 'paid' ? 'Pagada' : isOverdue ? 'Vencida' : 'Pendiente'}
													</td>
													<td className="p-2 text-right">
														<button
															onClick={() =>
																togglePaymentPlanInstallmentStatus(selectedDebtSchedule.id, installment.id)
															}
															className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-semibold"
														>
															{installment.status === 'paid' ? 'Marcar pendiente' : 'Marcar pagada'}
														</button>
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							) : (
								<table className="w-full text-left text-xs min-w-[500px]">
									<thead className="bg-slate-950 sticky top-0 border-b border-slate-800">
										<tr className="text-slate-400">
											<th className="p-2">Mes</th>
											<th className="p-2">Cuota</th>
											<th className="p-2">Amortización</th>
											<th className="p-2">Intereses</th>
											<th className="p-2 text-right">Pendiente</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-800/50 font-mono text-slate-300">
										{generateAmortizationSchedule(selectedDebtSchedule).map((row) => (
											<tr key={row.month} className="hover:bg-slate-800/10">
												<td className="p-2 text-slate-500">{row.month}</td>
												<td className="p-2">{row.cuota.toFixed(2)}€</td>
												<td className="p-2 text-emerald-400">{row.principalPaid.toFixed(2)}€</td>
												<td className="p-2 text-rose-400">{row.interestPayment.toFixed(2)}€</td>
												<td className="p-2 text-right text-slate-400">{row.remainingPrincipal.toFixed(2)}€</td>
											</tr>
										))}
									</tbody>
								</table>
							)}
						</div>
						{isPaymentPlanDebt(selectedDebtSchedule) && (
							<p className="text-[10px] text-slate-500 mt-3">
								Las cuotas pendientes vencidas se suman al flujo exigible del mes activo hasta que las marques
								como pagadas.
							</p>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
