import { useEffect, useMemo, useRef, useState } from 'react';
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
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const formatScheduleMonth = (month: string): string => {
	return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(
		new Date(`${normalizeMonth(month)}-01T00:00:00`)
	);
};

const getCurrentLocalMonth = (): string => {
	const today = new Date();
	return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
};

const getScheduleRowClassName = (month: string, currentMonth: string): string => {
	const isCurrentMonth = month === currentMonth;
	const isPastMonth = month < currentMonth;
	return [
		'hover:bg-muted/40 transition-colors scroll-mt-12',
		isCurrentMonth ? 'bg-muted/80 ring-1 ring-inset ring-border font-medium' : '',
		isPastMonth ? 'opacity-45' : ''
	]
		.filter(Boolean)
		.join(' ');
};

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
		togglePaymentPlanInstallmentStatus,
		formatAmount,
		profileCount
	} = useFinanzas();

	// Cálculos locales para el fraccionamiento manual en el formulario
	const paymentPlanTotalToPay = Math.abs(toNumber(debtForm.financedAmount)) + Math.abs(toNumber(debtForm.fees));
	const paymentPlanScheduleTotal = debtForm.tranches.reduce(
		(sum, t) => sum + Math.abs(toNumber(t.months)) * Math.abs(toNumber(t.amount)),
		0
	);
	const paymentPlanScheduleDiff = paymentPlanScheduleTotal - paymentPlanTotalToPay;

	const [isMobileFormOpen, setIsMobileFormOpen] = useState(false);
	const currentCalendarMonth = getCurrentLocalMonth();
	const currentMonthRowRef = useRef<HTMLTableRowElement | null>(null);
	const classicAmortizationSchedule = useMemo(() => {
		if (!selectedDebtSchedule || isPaymentPlanDebt(selectedDebtSchedule)) return [];
		return generateAmortizationSchedule(selectedDebtSchedule);
	}, [selectedDebtSchedule]);
	const hasRecurringCostsInSchedule = classicAmortizationSchedule.some((row) => row.recurringCosts > 0);

	useEffect(() => {
		currentMonthRowRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
	}, [selectedDebtSchedule?.id, currentCalendarMonth]);

	const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		handleAddDebt(e);
		setIsMobileFormOpen(false);
	};

	return (
		<div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 gap-6">
			{/* Botón para desplegar formulario en móvil */}
			<div className="lg:hidden shrink-0">
				<button
					type="button"
					onClick={() => setIsMobileFormOpen(!isMobileFormOpen)}
					className="w-full flex items-center justify-center gap-2 bg-card hover:bg-muted border border-border text-foreground px-4 py-3 rounded-xl text-sm font-semibold transition-all shadow-sm active:scale-[0.98]"
				>
					{isMobileFormOpen ? (
						<>
							<svg
								className="w-4 h-4 text-rose-500"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2}
							>
								<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
							<span>Ocultar Formulario</span>
						</>
					) : (
						<>
							<Icons.Plus className="w-4 h-4 text-foreground mr-0" />
							<span>Nueva Deuda</span>
						</>
					)}
				</button>
			</div>

			{/* Formulario */}
			<div
				className={`${isMobileFormOpen ? 'block' : 'hidden'} lg:block lg:col-span-4 premium-card rounded-2xl p-5 lg:p-6 h-fit lg:max-h-full lg:overflow-y-auto shrink-0 lg:shrink`}
			>
				<h3 className="font-heading text-base font-bold text-foreground mb-5 pb-3.5 border-b border-border flex items-center tracking-tight">
					<span className="p-1.5 bg-muted text-foreground rounded-lg mr-2 border border-border/60">
						<Icons.CreditCard className="w-3.5 h-3.5" />
					</span>
					Nueva deuda
				</h3>

				<form onSubmit={handleFormSubmit} className="space-y-3.5">
					<div>
						<label htmlFor="debt-desc" className="block text-xs font-medium text-muted-foreground mb-1.5">
							Nombre de la Deuda
						</label>
						<Input
							id="debt-desc"
							type="text"
							required
							placeholder="Ej. Préstamo de Coche, Tarjeta..."
							value={debtForm.desc}
							onChange={(e) => setDebtForm({ ...debtForm, desc: e.target.value })}
						/>
					</div>

					<div>
						<label className="block text-xs font-medium text-muted-foreground mb-1.5">Tipo de deuda</label>
						<div className="grid grid-cols-2 gap-1.5 p-1 bg-muted/70 rounded-xl border border-border">
							<button
								type="button"
								onClick={() => setDebtForm({ ...debtForm, kind: 'classic' })}
								className={`py-2 rounded-lg text-xs font-semibold transition-all ${debtForm.kind === 'classic' ? 'bg-card text-foreground shadow-sm font-semibold border border-border/60' : 'text-muted-foreground hover:text-foreground'}`}
							>
								Préstamo TIN/TAE/CER
							</button>
							<button
								type="button"
								onClick={() => setDebtForm({ ...debtForm, kind: 'paymentPlan' })}
								className={`py-2 rounded-lg text-xs font-semibold transition-all ${debtForm.kind === 'paymentPlan' ? 'bg-card text-foreground shadow-sm font-semibold border border-border/60' : 'text-muted-foreground hover:text-foreground'}`}
							>
								Fraccionamiento manual
							</button>
						</div>
					</div>

					{profileCount === 2 && (
						<div>
							<label className="block text-xs font-medium text-muted-foreground mb-1.5">
								¿De quién es la deuda?
							</label>
							<div className="grid grid-cols-3 gap-1.5 p-1 bg-muted/70 rounded-xl border border-border">
								<button
									type="button"
									onClick={() => setDebtForm({ ...debtForm, owner: 'userA' })}
									className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
										debtForm.owner === 'userA'
											? 'bg-card text-foreground shadow-sm font-semibold border border-border/60'
											: 'text-muted-foreground hover:text-foreground'
									}`}
								>
									{userAName}
								</button>
								<button
									type="button"
									onClick={() => setDebtForm({ ...debtForm, owner: 'userB' })}
									className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
										debtForm.owner === 'userB'
											? 'bg-card text-foreground shadow-sm font-semibold border border-border/60'
											: 'text-muted-foreground hover:text-foreground'
									}`}
								>
									{userBName}
								</button>
								<button
									type="button"
									onClick={() => setDebtForm({ ...debtForm, owner: 'joint' })}
									className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
										debtForm.owner === 'joint' || !debtForm.owner
											? 'bg-card text-foreground shadow-sm font-semibold border border-border/60'
											: 'text-muted-foreground hover:text-foreground'
									}`}
								>
									Conjunta
								</button>
							</div>
						</div>
					)}

					<div>
						<label
							htmlFor="debt-payment-account"
							className="block text-xs font-medium text-muted-foreground mb-1.5"
						>
							Cuenta para el Pago de la Cuota
						</label>
						<Select
							value={debtForm.paymentAccountId || 'none'}
							onValueChange={(val) => {
								const accId = val === 'none' ? '' : val;
								const acc = accounts.find((a) => a.id === accId);
								setDebtForm({
									...debtForm,
									paymentAccountId: accId,
									owner: acc ? acc.owner : debtForm.owner
								});
							}}
						>
							<SelectTrigger id="debt-payment-account">
								<SelectValue placeholder="Selecciona cuenta para el pago" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">Sin Cuenta (Automático por Propietario)</SelectItem>
								{accounts.map((acc) => (
									<SelectItem key={acc.id} value={acc.id}>
										{acc.name}
										{profileCount === 2 &&
											` (${
												acc.owner === 'userA'
													? userAName
													: acc.owner === 'userB'
														? userBName
														: 'Compartida'
											})`}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{debtForm.kind === 'classic' ? (
						<>
							<div>
								<label
									htmlFor="debt-principal"
									className="block text-xs font-medium text-muted-foreground mb-1.5"
								>
									Capital Solicitado (€)
								</label>
								<Input
									id="debt-principal"
									type="number"
									required={debtForm.kind === 'classic'}
									min="1"
									placeholder="Capital inicial"
									value={debtForm.principal}
									onChange={(e) => setDebtForm({ ...debtForm, principal: e.target.value })}
									className="font-mono"
								/>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<div>
									<label
										htmlFor="debt-opening-commission"
										className="block text-xs font-medium text-muted-foreground mb-1.5"
									>
										Comisión de apertura (€)
										<span className="text-muted-foreground/70"> (opcional)</span>
									</label>
									<Input
										id="debt-opening-commission"
										type="number"
										step="0.01"
										min="0"
										placeholder="0"
										value={debtForm.openingCommission}
										onChange={(e) =>
											setDebtForm({ ...debtForm, openingCommission: e.target.value })
										}
										className="font-mono"
									/>
								</div>

								<div>
									<label
										htmlFor="debt-recurring-costs"
										className="block text-xs font-medium text-muted-foreground mb-1.5"
									>
										Costes recurrentes / seguros (€ al mes)
										<span className="text-muted-foreground/70"> (opcional)</span>
									</label>
									<Input
										id="debt-recurring-costs"
										type="number"
										step="0.01"
										min="0"
										placeholder="0"
										value={debtForm.recurringMonthlyCosts}
										onChange={(e) =>
											setDebtForm({ ...debtForm, recurringMonthlyCosts: e.target.value })
										}
										className="font-mono"
									/>
								</div>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
								<div>
									<label
										htmlFor="debt-tin"
										className="block text-xs font-medium text-muted-foreground mb-1.5"
									>
										TIN (%)
									</label>
									<Input
										id="debt-tin"
										type="number"
										step="0.01"
										min="0"
										placeholder="5.95"
										value={debtForm.tin}
										onChange={(e) => setDebtForm({ ...debtForm, tin: e.target.value })}
										className="font-mono"
									/>
								</div>

								<div>
									<label
										htmlFor="debt-tae"
										className="block text-xs font-medium text-muted-foreground mb-1.5"
									>
										TAE/CER (%)
									</label>
									<Input
										id="debt-tae"
										type="number"
										step="0.01"
										required={debtForm.kind === 'classic'}
										min="0"
										placeholder="6.5"
										value={debtForm.tae}
										onChange={(e) => setDebtForm({ ...debtForm, tae: e.target.value })}
										className="font-mono"
									/>
								</div>

								<div>
									<label
										htmlFor="debt-term"
										className="block text-xs font-medium text-muted-foreground mb-1.5"
									>
										Plazo (Meses)
									</label>
									<Input
										id="debt-term"
										type="number"
										required={debtForm.kind === 'classic'}
										min="1"
										placeholder="36"
										value={debtForm.termMonths}
										onChange={(e) => setDebtForm({ ...debtForm, termMonths: e.target.value })}
										className="font-mono"
									/>
								</div>
							</div>

							<p className="text-[10px] text-muted-foreground -mt-1">
								Si cargás TIN, la cuota y la amortización usan TIN nominal mensual. Si lo dejás vacío,
								se deriva el tipo mensual desde TAE/CER. La comisión queda como coste inicial y los
								costes/seguros se suman a la cuota mensual.
							</p>
						</>
					) : (
						<>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<div>
									<label
										htmlFor="plan-financed"
										className="block text-xs font-medium text-muted-foreground mb-1.5"
									>
										Importe fraccionado (€)
									</label>
									<Input
										id="plan-financed"
										type="number"
										required={debtForm.kind === 'paymentPlan'}
										min="0.01"
										step="0.01"
										placeholder="Ej. 1000"
										value={debtForm.financedAmount}
										onChange={(e) => setDebtForm({ ...debtForm, financedAmount: e.target.value })}
										className="font-mono"
									/>
								</div>
								<div>
									<label
										htmlFor="plan-fees"
										className="block text-xs font-medium text-muted-foreground mb-1.5"
									>
										Comisiones / intereses (€)
									</label>
									<Input
										id="plan-fees"
										type="number"
										min="0"
										step="0.01"
										placeholder="Ej. 80"
										value={debtForm.fees}
										onChange={(e) => setDebtForm({ ...debtForm, fees: e.target.value })}
										className="font-mono"
									/>
								</div>
							</div>

							<div>
								<label
									htmlFor="plan-recurring-costs"
									className="block text-xs font-medium text-muted-foreground mb-1.5"
								>
									Costes recurrentes / seguros (€ al mes)
									<span className="text-muted-foreground/70"> (opcional)</span>
								</label>
								<Input
									id="plan-recurring-costs"
									type="number"
									step="0.01"
									min="0"
									placeholder="0"
									value={debtForm.recurringMonthlyCosts}
									onChange={(e) =>
										setDebtForm({ ...debtForm, recurringMonthlyCosts: e.target.value })
									}
									className="font-mono"
								/>
							</div>

							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<label className="block text-xs font-medium text-muted-foreground">Tramos de pago</label>
									<button
										type="button"
										onClick={addPaymentPlanTranche}
										className="text-xs text-foreground hover:underline font-medium"
									>
										+ Agregar tramo
									</button>
								</div>
								{debtForm.tranches.map((tranche, index) => (
									<div key={tranche.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
										<div>
											<label className="block text-[10px] text-muted-foreground mb-1">Meses</label>
											<Input
												type="number"
												min="1"
												placeholder="Ej. 7"
												value={tranche.months}
												onChange={(e) =>
													updatePaymentPlanTranche(tranche.id, { months: e.target.value })
												}
												className="px-3 py-2 font-mono"
											/>
										</div>
										<div>
											<label className="block text-[10px] text-muted-foreground mb-1">
												Cuota mensual (€)
											</label>
											<Input
												type="number"
												min="0.01"
												step="0.01"
												placeholder="Ej. 100"
												value={tranche.amount}
												onChange={(e) =>
													updatePaymentPlanTranche(tranche.id, { amount: e.target.value })
												}
												className="px-3 py-2 font-mono"
											/>
										</div>
										<button
											type="button"
											onClick={() => removePaymentPlanTranche(tranche.id)}
											disabled={debtForm.tranches.length === 1}
											className="px-2 py-2.5 bg-rose-500/15 hover:bg-rose-500 disabled:opacity-40 text-rose-600 dark:text-rose-400 hover:text-white rounded-xl transition-colors"
											aria-label={`Eliminar tramo ${index + 1}`}
										>
											<Icons.Trash />
										</button>
									</div>
								))}
							</div>

							<div className="p-3 bg-muted/60 border border-border rounded-xl text-xs space-y-1">
								<div className="flex justify-between">
									<span className="text-muted-foreground">Total a pagar:</span>
									<span className="font-semibold font-mono tabular-nums text-foreground">
										{paymentPlanTotalToPay.toFixed(2)}€
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Suma de cuotas:</span>
									<span
										className={`font-semibold font-mono tabular-nums ${
											Math.abs(paymentPlanScheduleDiff) <= 0.01
												? 'text-emerald-600 dark:text-emerald-400'
												: 'text-rose-600 dark:text-rose-400'
										}`}
									>
										{paymentPlanScheduleTotal.toFixed(2)}€
									</span>
								</div>
								<p className="text-[10px] text-muted-foreground">
									La suma de cuotas tiene que coincidir con el total a pagar. Las vencidas no pagadas
									se arrastran al mes activo.
								</p>
							</div>
						</>
					)}

					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
						<div>
							<label htmlFor="debt-date" className="block text-xs font-medium text-muted-foreground mb-1.5">
								Fecha de Inicio
							</label>
							<Input
								id="debt-date"
								type="month"
								required
								value={debtForm.date}
								onChange={(e) => setDebtForm({ ...debtForm, date: e.target.value })}
								className="font-mono"
							/>
						</div>

						<div>
							<label
								htmlFor="debt-charge-day"
								className="block text-xs font-medium text-muted-foreground mb-1.5"
							>
								Día habitual de cobro
								<span className="text-muted-foreground/70"> (opcional)</span>
							</label>
							<Input
								id="debt-charge-day"
								type="number"
								min="1"
								max="31"
								placeholder="Ej. 5"
								value={debtForm.chargeDay}
								onChange={(e) => setDebtForm({ ...debtForm, chargeDay: e.target.value })}
								className="font-mono"
							/>
						</div>
					</div>

					<div>
						<label htmlFor="debt-tag" className="block text-xs font-medium text-muted-foreground mb-1.5">
							Etiqueta de Deuda
						</label>
						<Select value={debtForm.tag} onValueChange={(val) => setDebtForm({ ...debtForm, tag: val })}>
							<SelectTrigger id="debt-tag">
								<SelectValue placeholder="Selecciona etiqueta" />
							</SelectTrigger>
							<SelectContent>
								{DEFAULT_TAGS.debt.map((tag) => (
									<SelectItem key={tag} value={tag}>
										{tag}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{debtFormError && (
						<div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl">
							{debtFormError}
						</div>
					)}

					<div className="flex gap-2 pt-1">
						<button
							type="submit"
							className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 rounded-xl text-sm transition-all active:scale-[0.98]"
						>
							Agregar deuda
						</button>
						<button
							type="button"
							onClick={() => setIsMobileFormOpen(false)}
							className="lg:hidden flex-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold py-2.5 rounded-xl text-sm transition-all border border-border active:scale-[0.98]"
						>
							Cancelar
						</button>
					</div>
				</form>
			</div>

			{/* Lista de deudas activas */}
			<div className="lg:col-span-8 space-y-6">
				<div className="premium-card rounded-2xl p-5 lg:p-6">
					<div className="flex items-center justify-between gap-2 mb-5 pb-3.5 border-b border-border">
						<h3 className="font-heading text-base font-bold text-foreground tracking-tight">
							Listado de deudas existentes
						</h3>
						<span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-muted text-muted-foreground border border-border">
							{debts.length}
						</span>
					</div>

					{debts.length === 0 ? (
						<div className="text-center py-10 border border-dashed border-border rounded-xl">
							<p className="text-muted-foreground text-sm">No tienes deudas registradas.</p>
						</div>
					) : (
						<div className="space-y-3.5">
							{debts.map((d) => {
								const cuota = calculateDebtMonthlyPayment(d, selectedMonth);
								const isPlan = isPaymentPlanDebt(d);
								const overdueAmount = isPlan ? getPaymentPlanOverdueAmount(d, selectedMonth) : 0;
								const isSelected = selectedDebtSchedule?.id === d.id;
								return (
									<div
										key={d.id}
										className={`p-4 rounded-xl bg-card border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 ${
											isSelected
												? 'border-foreground/40 bg-muted/40 shadow-sm'
												: 'border-border hover:border-border/80'
										}`}
									>
										<div className="space-y-1">
											<div className="flex items-center space-x-2">
												<h4 className="font-bold text-foreground text-sm">{d.desc}</h4>
												<span className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground border border-border font-semibold rounded">
													{d.tag}
												</span>
											</div>
											<p className="text-xs text-muted-foreground">
												{isPlan
													? `Financiado: ${formatAmount(d.financedAmount)} | Comisiones: ${formatAmount(d.fees)} | Pendiente: ${formatAmount(getPaymentPlanRemainingAmount(d))}${d.recurringMonthlyCosts ? ` | Costes/seguros: ${formatAmount(d.recurringMonthlyCosts)}/mes` : ''}`
													: `Capital: ${formatAmount(d.principal)} | ${getDebtRateLabel(d)} | Plazo: ${d.termMonths} meses${d.openingCommission ? ` | Apertura: ${formatAmount(d.openingCommission)}` : ''}${d.recurringMonthlyCosts ? ` | Costes/seguros: ${formatAmount(d.recurringMonthlyCosts)}/mes` : ''}`}
											</p>
											<p className="text-[10px] text-muted-foreground font-mono">
												Iniciado en: {normalizeMonth(d.date)}
												{d.chargeDay ? ` · Cobro día ${d.chargeDay}` : ''}
												{overdueAmount > 0 ? ` · Vencido: ${formatAmount(overdueAmount)}` : ''}
											</p>
										</div>
										<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
											<div className="text-left sm:text-right shrink-0">
												<span className="block text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
													{isPlan ? 'Exigible este mes' : 'Cuota Mensual'}
												</span>
												<span className="text-base font-extrabold font-mono tabular-nums text-amber-600 dark:text-amber-400">
													{formatAmount(cuota)}
												</span>
											</div>

											<div className="flex sm:flex-col gap-1.5 w-full sm:w-auto">
												<button
													onClick={() => setSelectedDebtSchedule(d)}
													className="flex-1 sm:flex-initial px-3 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border text-xs font-semibold rounded-lg transition-colors min-h-[38px] flex items-center justify-center"
												>
													{isPlan ? 'Calendario' : 'Plan Amort.'}
												</button>
												<button
													onClick={() => handleDeleteDebt(d.id)}
													className="flex-1 sm:flex-initial px-3 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 text-xs font-semibold rounded-lg transition-colors min-h-[38px] flex items-center justify-center"
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
					<div className="premium-card rounded-2xl p-5 lg:p-6">
						<div className="flex justify-between items-center mb-4 pb-3 border-b border-border gap-3">
							<div>
								<h4 className="font-bold text-foreground text-sm">
									{isPaymentPlanDebt(selectedDebtSchedule) ? 'Calendario de pagos' : 'Amortización'}:{' '}
									{selectedDebtSchedule.desc}
								</h4>
								<p className="text-xs text-muted-foreground mt-0.5">
									{isPaymentPlanDebt(selectedDebtSchedule)
										? `Total ${formatAmount(selectedDebtSchedule.totalToPay)} · Pagado ${formatAmount(getPaymentPlanPaidAmount(selectedDebtSchedule))} · Pendiente ${formatAmount(getPaymentPlanRemainingAmount(selectedDebtSchedule))} · Vencido ${formatAmount(getPaymentPlanOverdueAmount(selectedDebtSchedule, selectedMonth))}${selectedDebtSchedule.recurringMonthlyCosts ? ` · Costes/seguros ${formatAmount(selectedDebtSchedule.recurringMonthlyCosts)}/mes` : ''}${selectedDebtSchedule.chargeDay ? ` · Cobro día ${selectedDebtSchedule.chargeDay}` : ''}`
										: `${selectedDebtSchedule.termMonths} meses, ${getDebtRateLabel(selectedDebtSchedule)}${selectedDebtSchedule.openingCommission ? ` · Apertura ${formatAmount(selectedDebtSchedule.openingCommission)}` : ''}${selectedDebtSchedule.recurringMonthlyCosts ? ` · Costes/seguros ${formatAmount(selectedDebtSchedule.recurringMonthlyCosts)}/mes` : ''}${selectedDebtSchedule.chargeDay ? ` · Cobro día ${selectedDebtSchedule.chargeDay}` : ''}`}
								</p>
							</div>
							<button
								onClick={() => setSelectedDebtSchedule(null)}
								className="text-xs bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border px-3 py-1.5 rounded-lg font-semibold shrink-0 transition-colors"
							>
								Cerrar
							</button>
						</div>

						<div className="max-h-72 overflow-y-auto border border-border rounded-xl overflow-x-auto">
							{isPaymentPlanDebt(selectedDebtSchedule) ? (
								<table className="w-full text-left text-xs min-w-[500px]">
									<thead className="bg-muted/95 backdrop-blur-sm sticky top-0 border-b border-border z-10">
										<tr className="text-muted-foreground font-semibold">
											<th className="p-2.5">Mes</th>
											<th className="p-2.5">Cuota</th>
											{toNumber(selectedDebtSchedule.recurringMonthlyCosts) > 0 && (
												<th className="p-2.5">Costes/seguros</th>
											)}
											<th className="p-2.5">Estado</th>
											<th className="p-2.5 text-right">Acción</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border text-foreground">
										{selectedDebtSchedule.installments.map((installment) => {
											const isOverdue =
												installment.status === 'pending' &&
												installment.dueMonth < selectedMonth;
											const isCurrentRow = installment.dueMonth === currentCalendarMonth;
											const recurringCosts = toNumber(selectedDebtSchedule.recurringMonthlyCosts);
											return (
												<tr
													key={installment.id}
													ref={isCurrentRow ? currentMonthRowRef : null}
													className={getScheduleRowClassName(
														installment.dueMonth,
														currentCalendarMonth
													)}
												>
													<td className="p-2.5 text-muted-foreground">
														<span className="font-mono capitalize">
															{formatScheduleMonth(installment.dueMonth)}
														</span>
														{isCurrentRow && (
															<span className="ml-2 rounded-full bg-muted border border-border px-2 py-0.5 text-[10px] font-medium text-foreground">
																Actual
															</span>
														)}
													</td>
													<td className="p-2.5 font-mono tabular-nums">
														{formatAmount(installment.amount + recurringCosts)}
													</td>
													{recurringCosts > 0 && (
														<td className="p-2.5 font-mono tabular-nums text-sky-600 dark:text-sky-400">
															{formatAmount(recurringCosts)}
														</td>
													)}
													<td
														className={
															isOverdue
																? 'p-2.5 text-rose-600 dark:text-rose-400 font-semibold'
																: 'p-2.5 text-foreground'
														}
													>
														{installment.status === 'paid'
															? 'Pagada'
															: isOverdue
																? 'Vencida'
																: 'Pendiente'}
													</td>
													<td className="p-2.5 text-right">
														<button
															onClick={() =>
																togglePaymentPlanInstallmentStatus(
																	selectedDebtSchedule.id,
																	installment.id
																)
															}
															className="px-2.5 py-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border rounded-md text-[10px] font-semibold transition-colors"
														>
															{installment.status === 'paid'
																? 'Marcar pendiente'
																: 'Marcar pagada'}
														</button>
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							) : (
								<table className="w-full text-left text-xs min-w-[620px]">
									<thead className="bg-muted/95 backdrop-blur-sm sticky top-0 border-b border-border z-10">
										<tr className="text-muted-foreground font-semibold">
											<th className="p-2.5">Mes</th>
											<th className="p-2.5">Cuota</th>
											{hasRecurringCostsInSchedule && <th className="p-2.5">Costes/seguros</th>}
											<th className="p-2.5">Amortización</th>
											<th className="p-2.5">Intereses</th>
											<th className="p-2.5 text-right">Pendiente</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border font-mono tabular-nums text-foreground">
										{classicAmortizationSchedule.map((row) => {
											const isCurrentRow = row.dueMonth === currentCalendarMonth;
											return (
												<tr
													key={row.month}
													ref={isCurrentRow ? currentMonthRowRef : null}
													className={getScheduleRowClassName(
														row.dueMonth,
														currentCalendarMonth
													)}
												>
													<td className="p-2.5 text-muted-foreground">
														<span className="capitalize">
															{formatScheduleMonth(row.dueMonth)}
														</span>
														{isCurrentRow && (
															<span className="ml-2 rounded-full bg-muted border border-border px-2 py-0.5 text-[10px] font-medium text-foreground">
																Actual
															</span>
														)}
													</td>
													<td className="p-2.5">{formatAmount(row.totalPayment)}</td>
													{hasRecurringCostsInSchedule && (
														<td className="p-2.5 text-sky-600 dark:text-sky-400">
															{formatAmount(row.recurringCosts)}
														</td>
													)}
													<td className="p-2.5 text-emerald-600 dark:text-emerald-400">
														{formatAmount(row.principalPaid)}
													</td>
													<td className="p-2.5 text-rose-600 dark:text-rose-400">
														{formatAmount(row.interestPayment)}
													</td>
													<td className="p-2.5 text-right text-muted-foreground">
														{formatAmount(row.remainingPrincipal)}
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							)}
						</div>
						{isPaymentPlanDebt(selectedDebtSchedule) && (
							<p className="text-[10px] text-muted-foreground mt-3">
								Las cuotas pendientes vencidas se suman al flujo exigible del mes activo hasta que las
								marques como pagadas.
							</p>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
