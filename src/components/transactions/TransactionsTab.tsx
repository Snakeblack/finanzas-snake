import { useState } from 'react';
import { useFinanzas } from '../../hooks/useFinanzas';
import { deduceTagFromConcept } from '../../services/financeService';
import { DEFAULT_TAGS } from '../../constants';
import { Icons } from '../common/Icons';

/**
 * Componente que renderiza la pestaña de Transacciones.
 * Permite dar de alta ingresos, gastos y traspasos, y muestra el
 * historial detallado del mes seleccionado.
 */
export function TransactionsTab() {
	const {
		txForm,
		setTxForm,
		handleAddTransaction,
		accounts,
		userAName,
		userBName,
		filteredTransactions,
		handleStartEditTransaction,
		handleDeleteTransaction,
		viewMode,
		selectedMonth,
		formatAmount
	} = useFinanzas();

	const [isMobileFormOpen, setIsMobileFormOpen] = useState(false);

	const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		handleAddTransaction(e);
		setIsMobileFormOpen(false);
	};

	return (
		<div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:gap-8">
			{/* Botón para desplegar formulario en móvil */}
			<div className="lg:hidden shrink-0">
				<button
					type="button"
					onClick={() => setIsMobileFormOpen(!isMobileFormOpen)}
					className="w-full flex items-center justify-center gap-2 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/60 text-slate-200 hover:text-white px-4 py-3 rounded-xl text-sm font-semibold transition-all shadow-sm active:scale-[0.98]"
				>
					{isMobileFormOpen ? (
						<>
							<svg className="w-4 h-4 text-rose-450" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
								<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
							<span>Ocultar Formulario</span>
						</>
					) : (
						<>
							<Icons.Plus className="w-4 h-4 text-indigo-400 mr-0" />
							<span>Nueva Transacción</span>
						</>
					)}
				</button>
			</div>

			{/* Formulario */}
			<div className={`${isMobileFormOpen ? 'block' : 'hidden'} lg:block lg:col-span-4 premium-card rounded-2xl p-6 h-fit lg:max-h-full lg:overflow-y-auto shrink-0 lg:shrink`}>
				<h3 className="font-heading text-lg font-bold text-slate-100 mb-6 flex items-center">
					<span className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg mr-2">
						<Icons.Plus className="w-4 h-4" />
					</span>
					Nueva Transacción
				</h3>

				<form onSubmit={handleFormSubmit} className="space-y-4">
					<div>
						<label className="block text-xs font-medium text-slate-400 mb-1.5">Tipo de Movimiento</label>
						<div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
							<button
								type="button"
								onClick={() => setTxForm({ ...txForm, type: 'expense', tag: DEFAULT_TAGS.expense[0] })}
								className={`py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
									txForm.type === 'expense'
										? 'bg-rose-500 text-white shadow-md'
										: 'text-slate-400 hover:text-slate-200'
								}`}
							>
								Gasto
							</button>
							<button
								type="button"
								onClick={() => setTxForm({ ...txForm, type: 'income', tag: DEFAULT_TAGS.income[0] })}
								className={`py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
									txForm.type === 'income'
										? 'bg-emerald-500 text-white shadow-md'
										: 'text-slate-400 hover:text-slate-200'
								}`}
							>
								Ingreso
							</button>
							<button
								type="button"
								onClick={() => setTxForm({ ...txForm, type: 'transfer', tag: DEFAULT_TAGS.transfer[0] })}
								className={`py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
									txForm.type === 'transfer'
										? 'bg-sky-500 text-white shadow-md'
										: 'text-slate-400 hover:text-slate-200'
								}`}
							>
								Traspaso
							</button>
						</div>
					</div>

					<div>
						<label className="block text-xs font-medium text-slate-400 mb-1.5">Recurrencia</label>
						<div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
							<button
								type="button"
								onClick={() => setTxForm({ ...txForm, recurrence: 'one-off' })}
								className={`py-2 rounded-lg text-xs font-semibold transition-all ${
									txForm.recurrence === 'one-off' || !txForm.recurrence
										? 'bg-indigo-600 text-white shadow-md'
										: 'text-slate-400 hover:text-slate-200'
								}`}
							>
								Puntual
							</button>
							<button
								type="button"
								onClick={() => setTxForm({ ...txForm, recurrence: 'recurring' })}
								className={`py-2 rounded-lg text-xs font-semibold transition-all ${
									txForm.recurrence === 'recurring'
										? 'bg-indigo-600 text-white shadow-md'
										: 'text-slate-400 hover:text-slate-200'
								}`}
							>
								Recurrente
							</button>
						</div>
						<p className="text-[10px] text-slate-500 mt-1">
							Los movimientos recurrentes se añadirán automáticamente a los meses siguientes.
						</p>
					</div>

					<div>
						<label htmlFor="tx-desc" className="block text-xs font-medium text-slate-400 mb-1.5">
							Concepto
						</label>
						<input
							id="tx-desc"
							type="text"
							required
							placeholder="Ej. Nómina, Compra semanal..."
							value={txForm.desc}
							onChange={(e) => {
								const desc = e.target.value;
								const deduced = deduceTagFromConcept(desc, txForm.type);
								setTxForm((prev) => ({
									...prev,
									desc,
									tag: deduced || prev.tag
								}));
							}}
							className="w-full premium-input rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600"
						/>
					</div>

					<div>
						<label htmlFor="tx-amount" className="block text-xs font-medium text-slate-400 mb-1.5">
							Importe (€)
						</label>
						<input
							id="tx-amount"
							type="number"
							step="0.01"
							required
							min="0.01"
							placeholder="0.00"
							value={txForm.amount}
							onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
							className="w-full premium-input rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600"
						/>
					</div>

					<div>
						<label htmlFor="tx-date" className="block text-xs font-medium text-slate-400 mb-1.5">
							Fecha del Movimiento
						</label>
						<input
							id="tx-date"
							type="date"
							required
							value={txForm.date}
							onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
							className="w-full premium-input rounded-xl px-4 py-2.5 text-sm text-slate-100 font-mono outline-none"
						/>
					</div>

					{txForm.type === 'transfer' ? (
						<>
							<div>
								<label htmlFor="tx-from-account" className="block text-xs font-medium text-slate-400 mb-1.5">
									Cuenta de Origen
								</label>
								<select
									id="tx-from-account"
									value={txForm.fromAccountId}
									onChange={(e) => setTxForm({ ...txForm, fromAccountId: e.target.value })}
									className="w-full premium-input rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none"
								>
									{accounts.map((acc) => (
										<option key={acc.id} value={acc.id}>
											{acc.name} ({acc.owner === 'userA' ? userAName : acc.owner === 'userB' ? userBName : 'Compartida'})
										</option>
									))}
								</select>
							</div>

							<div>
								<label htmlFor="tx-to-account" className="block text-xs font-medium text-slate-400 mb-1.5">
									Cuenta de Destino
								</label>
								<select
									id="tx-to-account"
									value={txForm.toAccountId}
									onChange={(e) => setTxForm({ ...txForm, toAccountId: e.target.value })}
									className="w-full premium-input rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none"
								>
									{accounts.filter((acc) => acc.id !== txForm.fromAccountId).map((acc) => (
										<option key={acc.id} value={acc.id}>
											{acc.name} ({acc.owner === 'userA' ? userAName : acc.owner === 'userB' ? userBName : 'Compartida'})
										</option>
									))}
								</select>
							</div>
						</>
					) : (
						<>
							<div>
								<label htmlFor="tx-account" className="block text-xs font-medium text-slate-400 mb-1.5">
									Cuenta Asociada
								</label>
								<select
									id="tx-account"
									value={txForm.accountId}
									onChange={(e) => {
										const accId = e.target.value;
										const acc = accounts.find((a) => a.id === accId);
										setTxForm({
											...txForm,
											accountId: accId,
											owner: acc ? acc.owner : txForm.owner
										});
									}}
									className="w-full premium-input rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none"
								>
									<option value="">Sin Cuenta (Manual)</option>
									{accounts.map((acc) => (
										<option key={acc.id} value={acc.id}>
											{acc.name} ({acc.owner === 'userA' ? userAName : acc.owner === 'userB' ? userBName : 'Compartida'})
										</option>
									))}
								</select>
							</div>

							<div>
								<label className="block text-xs font-medium text-slate-400 mb-1.5">¿De quién es?</label>
								<div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
									<button
										type="button"
										onClick={() => setTxForm({ ...txForm, owner: 'userA' })}
										className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
											txForm.owner === 'userA'
												? 'bg-indigo-600 text-white shadow-md'
												: 'text-slate-400 hover:text-slate-200'
										}`}
									>
										{userAName}
									</button>
									<button
										type="button"
										onClick={() => setTxForm({ ...txForm, owner: 'userB' })}
										className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
											txForm.owner === 'userB'
												? 'bg-indigo-600 text-white shadow-md'
												: 'text-slate-400 hover:text-slate-200'
										}`}
									>
										{userBName}
									</button>
									<button
										type="button"
										onClick={() => setTxForm({ ...txForm, owner: 'joint' })}
										className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
											txForm.owner === 'joint' || !txForm.owner
												? 'bg-indigo-600 text-white shadow-md'
												: 'text-slate-400 hover:text-slate-200'
										}`}
									>
										Conjunto
									</button>
								</div>
							</div>

							{!txForm.accountId && txForm.owner === 'joint' && txForm.type === 'expense' && (
								<div>
									<label className="block text-xs font-medium text-slate-400 mb-1.5">Pagado por</label>
									<div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
										<button
											type="button"
											onClick={() => setTxForm({ ...txForm, paidBy: 'userA' })}
											className={`py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
												txForm.paidBy === 'userA'
													? 'bg-slate-755 text-white shadow-md'
													: 'text-slate-400 hover:text-slate-200'
											}`}
										>
											{userAName}
										</button>
										<button
											type="button"
											onClick={() => setTxForm({ ...txForm, paidBy: 'userB' })}
											className={`py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
												txForm.paidBy === 'userB'
													? 'bg-slate-755 text-white shadow-md'
													: 'text-slate-400 hover:text-slate-200'
											}`}
										>
											{userBName}
										</button>
										<button
											type="button"
											onClick={() => setTxForm({ ...txForm, paidBy: 'shared' })}
											className={`py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
												txForm.paidBy === 'shared' || !txForm.paidBy
													? 'bg-slate-755 text-white shadow-md'
													: 'text-slate-400 hover:text-slate-200'
											}`}
										>
											Cuenta Común
										</button>
									</div>
								</div>
							)}
						</>
					)}

					<div>
						<label htmlFor="tx-tag" className="block text-xs font-medium text-slate-400 mb-1.5">
							Etiqueta
						</label>
						<input
							id="tx-tag"
							list="tx-tags-list"
							value={txForm.tag}
							onChange={(e) => setTxForm({ ...txForm, tag: e.target.value })}
							placeholder="Elige o escribe una etiqueta"
							className="w-full premium-input rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none"
						/>
						<datalist id="tx-tags-list">
							{DEFAULT_TAGS[txForm.type].map((tag) => (
								<option key={tag} value={tag} />
							))}
						</datalist>
					</div>

					<div className="flex gap-2">
						<button
							type="submit"
							className="flex-1 mt-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 hover:shadow-[0_0_15px_rgba(99,102,241,0.4)] text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-md active:scale-95"
						>
							Agregar Transacción
						</button>
						<button
							type="button"
							onClick={() => setIsMobileFormOpen(false)}
							className="lg:hidden flex-1 mt-2 bg-slate-850 hover:bg-slate-800 text-slate-350 font-semibold py-2.5 rounded-xl text-sm transition-all border border-slate-800 active:scale-95"
						>
							Cancelar
						</button>
					</div>
				</form>
			</div>

			{/* Listado de Historial */}
			<div className="lg:col-span-8 premium-card rounded-2xl p-6 flex flex-col lg:h-full lg:max-h-full min-h-0">
				<h3 className="font-heading text-lg font-bold text-slate-100 mb-6 shrink-0">Historial para el mes {selectedMonth}</h3>

				{filteredTransactions.length === 0 ? (
					<div className="text-center py-12 text-slate-500 flex-1 flex flex-col justify-center">
						<p className="text-sm">No hay transacciones registradas este mes.</p>
						<p className="text-xs">Usa el formulario para añadir ingresos o gastos corrientes.</p>
					</div>
				) : (
					<div className="flex-1 lg:overflow-y-auto pr-1" style={{ WebkitOverflowScrolling: 'touch' }}>
						{/* Vista de Tarjetas para Móviles */}
						<div className="md:hidden space-y-3">
							{filteredTransactions.map((t) => (
								<div
									key={t.id}
									className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col justify-between space-y-3 hover:border-slate-800 transition-all"
								>
									<div className="flex justify-between items-start">
										<div className="space-y-1">
											<div className="flex items-center gap-1.5 flex-wrap">
												<span className="font-semibold text-slate-100 text-sm">{t.desc}</span>
												{t.recurrence === 'recurring' && (
													<span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
														Recurrente
													</span>
												)}
											</div>
											<div className="text-[10px] text-slate-500 font-mono">
												{t.date}
												{t.type === 'transfer' ? (
													<span className="block mt-0.5">
														{accounts.find((a) => a.id === t.fromAccountId)?.name || 'Origen'} ➔ {accounts.find((a) => a.id === t.toAccountId)?.name || 'Destino'}
													</span>
												) : (
													t.accountId && (
														<span className="block mt-0.5">
															Cuenta: {accounts.find((a) => a.id === t.accountId)?.name || 'Desconocida'}
														</span>
													)
												)}
											</div>
										</div>

										<div className="text-right">
											{t.type === 'transfer' ? (
												<span className="text-sky-400 font-bold text-sm">
													{formatAmount(t.amount)}
												</span>
											) : (
												<span className={`font-bold text-sm ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
													{formatAmount(t.amount, { showSign: true })}
												</span>
											)}
										</div>
									</div>

									<div className="flex justify-between items-center pt-2.5 border-t border-slate-900/60">
										<div className="flex gap-1 flex-wrap">
											<span
												className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
													t.type === 'income'
														? 'bg-emerald-500/10 text-emerald-400'
														: t.type === 'transfer'
															? 'bg-sky-500/10 text-sky-400'
															: 'bg-rose-500/10 text-rose-400'
												}`}
											>
												{t.tag}
											</span>
											{t.type !== 'transfer' && (
												<span
													className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
														t.owner === 'userA'
															? 'bg-indigo-500/15 text-indigo-400'
															: t.owner === 'userB'
																? 'bg-violet-500/15 text-violet-400'
																: 'bg-emerald-500/15 text-emerald-400'
													}`}
												>
													{t.owner === 'userA'
														? userAName
														: t.owner === 'userB'
															? userBName
															: 'Conjunto'}
												</span>
											)}
										</div>

										<div className="flex gap-2">
											<button
												onClick={() => handleStartEditTransaction(t)}
												className="text-slate-450 hover:text-indigo-400 p-2 rounded-lg transition-all border border-slate-800 bg-slate-900 shadow-sm min-h-[40px] min-w-[40px] flex items-center justify-center"
												title="Editar transacción"
											>
												<Icons.Edit />
											</button>
											<button
												onClick={() => handleDeleteTransaction(t.id)}
												className="text-slate-450 hover:text-rose-400 p-2 rounded-lg transition-all border border-slate-800 bg-slate-900 shadow-sm min-h-[40px] min-w-[40px] flex items-center justify-center"
												title="Eliminar transacción"
											>
												<Icons.Trash />
											</button>
										</div>
									</div>
								</div>
							))}
						</div>

						{/* Vista de Tabla para Pantallas Grandes */}
						<div className="hidden md:block overflow-x-auto">
							<table className="w-full text-left border-collapse">
								<thead>
									<tr className="border-b border-slate-800/80 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-950/20">
										<th className="pb-3 pt-2 pl-2">Fecha</th>
										<th className="pb-3 pt-2">Concepto</th>
										<th className="pb-3 pt-2">Propietario</th>
										<th className="pb-3 pt-2">Etiqueta</th>
										<th className="pb-3 pt-2 text-right">Importe</th>
										<th className="pb-3 pt-2 text-center">Acciones</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-800/60 text-sm">
									{filteredTransactions.map((t) => (
										<tr key={t.id} className="hover:bg-slate-800/20 transition-colors">
											<td className="py-3.5 pl-2 text-slate-400 font-mono text-xs">{t.date}</td>
											<td className="py-3.5 font-medium text-slate-200">
												<div className="flex flex-col">
													<div className="flex items-center space-x-2">
														<span>{t.desc}</span>
														{t.recurrence === 'recurring' && (
															<span 
																title="Movimiento Recurrente"
																className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
															>
																<svg className="w-3 h-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
																	<path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5" />
																</svg>
																Recurrente
															</span>
														)}
													</div>
													{t.type === 'transfer' ? (
														<div className="text-[10px] text-slate-500 font-mono mt-0.5">
															{accounts.find((a) => a.id === t.fromAccountId)?.name || 'Sin origen'} ➔ {accounts.find((a) => a.id === t.toAccountId)?.name || 'Sin destino'}
														</div>
													) : (
														t.accountId && (
															<div className="text-[10px] text-slate-500 font-mono mt-0.5">
																Cuenta: {accounts.find((a) => a.id === t.accountId)?.name || 'Desconocida'}
															</div>
														)
													)}
												</div>
											</td>
											<td className="py-3.5">
												{t.type === 'transfer' ? (
													<span className="inline-block px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-bold">
														Traspaso
													</span>
												) : (
													<span
														className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
															t.owner === 'userA'
																? 'bg-indigo-500/15 text-indigo-400'
																: t.owner === 'userB'
																	? 'bg-violet-500/15 text-violet-400'
																	: 'bg-emerald-500/15 text-emerald-400'
														}`}
													>
														{t.owner === 'userA'
															? userAName
															: t.owner === 'userB'
																? userBName
																: 'Conjunto'}
														{t.owner === 'joint' && t.type === 'expense' && ` (${t.paidBy === 'userA' ? userAName : t.paidBy === 'userB' ? userBName : 'Común'})`}
													</span>
												)}
											</td>
											<td className="py-3.5">
												<span
													className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
														t.type === 'income'
															? 'bg-emerald-500/10 text-emerald-400'
															: t.type === 'transfer'
																? 'bg-sky-500/10 text-sky-400'
																: 'bg-rose-500/10 text-rose-400'
													}`}
												>
													{t.tag}
												</span>
											</td>
											<td className="py-3.5 text-right">
												{(() => {
													if (t.type === 'transfer') {
														const getWeight = (owner: 'userA' | 'userB' | 'joint') => {
															if (viewMode === 'all') return 1;
															if (viewMode === 'userA') {
																if (owner === 'userA') return 1;
																if (owner === 'joint') return 0.5;
																return 0;
															}
															if (viewMode === 'userB') {
																if (owner === 'userB') return 1;
																if (owner === 'joint') return 0.5;
																return 0;
															}
															return 0;
														};
														const fromAcc = accounts.find((a) => a.id === t.fromAccountId);
														const toAcc = accounts.find((a) => a.id === t.toAccountId);
														if (fromAcc && toAcc) {
															const toW = getWeight(toAcc.owner);
															const fromW = getWeight(fromAcc.owner);
															const netChange = (toW - fromW) * t.amount;
															if (netChange > 0.001) {
																return <span className="text-emerald-400 font-bold">{formatAmount(t.amount, { showSign: true })}</span>;
															} else if (netChange < -0.001) {
																return <span className="text-rose-400 font-bold">{formatAmount(-t.amount)}</span>;
															}
														}
														return <span className="text-sky-400 font-bold">{formatAmount(t.amount)}</span>;
													}
													return (
														<span className={`font-bold ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
															{formatAmount(t.amount, { showSign: t.type === 'income' })}
														</span>
													);
												})()}
											</td>
											<td className="py-3.5 text-center font-semibold">
												<button
													onClick={() => handleStartEditTransaction(t)}
													className="text-slate-550 hover:text-indigo-400 p-1.5 rounded-lg transition-colors mr-1"
													title="Editar transacción"
												>
													<Icons.Edit />
												</button>
												<button
													onClick={() => handleDeleteTransaction(t.id)}
													className="text-slate-550 hover:text-rose-400 p-1.5 rounded-lg transition-colors"
													title="Eliminar transacción"
												>
													<Icons.Trash />
												</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
