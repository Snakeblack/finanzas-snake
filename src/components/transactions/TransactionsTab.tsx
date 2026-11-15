import { useEffect, useState } from 'react';
import { useFinanzas } from '../../hooks/useFinanzas';
import { deduceTagFromConcept } from '../../services/financeService';
import { DEFAULT_TAGS } from '../../constants';
import { Icons } from '../common/Icons';
import { ImportStatementModal } from './ImportStatementModal';
import { Upload } from 'lucide-react';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toNumber } from '../../utils/formatters';
import { moveWithinDay } from '../../utils/transactionOrder';

/**
 * Componente que renderiza la pestaña de Transacciones.
 * Permite dar de alta ingresos, gastos y traspasos, y muestra el
 * historial detallado del mes seleccionado.
 */
interface TransactionsTabProps {
	openImportModalSignal?: number;
	onImportModalConsumed?: () => void;
}

export function TransactionsTab({ openImportModalSignal = 0, onImportModalConsumed }: TransactionsTabProps) {
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
		formatAmount,
		transactions,
		setTransactions,
		profileCount
	} = useFinanzas();

	const [isMobileFormOpen, setIsMobileFormOpen] = useState(false);
	const [isImportModalOpen, setIsImportModalOpen] = useState(false);
	const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income' | 'both'>('all');
	const [draggedTxId, setDraggedTxId] = useState<string | null>(null);
	const [dragOverTxId, setDragOverTxId] = useState<string | null>(null);

	useEffect(() => {
		if (openImportModalSignal > 0) {
			const timer = setTimeout(() => {
				setIsImportModalOpen(true);
				onImportModalConsumed?.();
			}, 0);
			return () => clearTimeout(timer);
		}
	}, [openImportModalSignal, onImportModalConsumed]);

	const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		handleAddTransaction(e);
		setIsMobileFormOpen(false);
	};

	const displayedTransactions = filteredTransactions.filter((t) => {
		if (typeFilter === 'expense') return t.type === 'expense';
		if (typeFilter === 'income') return t.type === 'income';
		if (typeFilter === 'both') return t.type === 'expense' || t.type === 'income';
		return true;
	});

	const handleDragStart = (e: React.DragEvent, txId: string) => {
		setDraggedTxId(txId);
		e.dataTransfer.effectAllowed = 'move';
	};

	const handleDragOver = (e: React.DragEvent, targetId: string) => {
		e.preventDefault();
		if (!draggedTxId || draggedTxId === targetId) return;

		const draggedTx = transactions.find((t) => t.id === draggedTxId);
		const targetTx = transactions.find((t) => t.id === targetId);

		if (draggedTx && targetTx && draggedTx.date === targetTx.date) {
			setDragOverTxId(targetId);
		}
	};

	const handleDragLeave = () => {
		setDragOverTxId(null);
	};

	const handleDrop = (e: React.DragEvent, targetId: string) => {
		e.preventDefault();
		if (!draggedTxId || draggedTxId === targetId) {
			setDraggedTxId(null);
			setDragOverTxId(null);
			return;
		}

		const updated = moveWithinDay(transactions, draggedTxId, targetId);
		if (updated !== transactions) {
			setTransactions(updated);
		}

		setDraggedTxId(null);
		setDragOverTxId(null);
	};

	const handleDragEnd = () => {
		setDraggedTxId(null);
		setDragOverTxId(null);
	};

	return (
		<div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 gap-6">
			{/* Botón para desplegar formulario en móvil */}
			<div className="lg:hidden shrink-0 grid grid-cols-2 gap-3">
				<button
					type="button"
					onClick={() => setIsMobileFormOpen(!isMobileFormOpen)}
					className="flex items-center justify-center gap-2 bg-card hover:bg-muted border border-border text-foreground px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm active:scale-[0.98]"
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
							<span>Ocultar Form</span>
						</>
					) : (
						<>
							<Icons.Plus className="w-4 h-4 text-foreground mr-0" />
							<span>Crear Manual</span>
						</>
					)}
				</button>

				<button
					type="button"
					onClick={() => setIsImportModalOpen(true)}
					className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm active:scale-[0.98]"
				>
					<Upload className="w-4 h-4" />
					<span>Importar Extracto</span>
				</button>
			</div>

			{/* Formulario */}
			<div
				className={`${isMobileFormOpen ? 'block' : 'hidden'} lg:block lg:col-span-4 premium-card rounded-2xl p-5 lg:p-6 h-fit lg:max-h-full lg:overflow-y-auto shrink-0 lg:shrink`}
			>
				<div className="flex items-center justify-between gap-3 mb-5 pb-3.5 border-b border-border">
					<h3 className="font-heading text-base font-bold text-foreground flex items-center tracking-tight">
						<span className="p-1.5 bg-muted text-foreground rounded-lg mr-2 border border-border/60">
							<Icons.Plus className="w-3.5 h-3.5" />
						</span>
						Nueva Transacción
					</h3>

					<button
						type="button"
						onClick={() => setIsImportModalOpen(true)}
						className="inline-flex items-center justify-center gap-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all shadow-sm active:scale-[0.98] outline-none"
						title="Importar Extracto Bancario"
					>
						<Upload className="w-3.5 h-3.5" />
						<span>Importar Extracto Bancario</span>
					</button>
				</div>

				<form onSubmit={handleFormSubmit} className="space-y-3.5">
					<div>
						<label className="block text-xs font-medium text-muted-foreground mb-1.5">Tipo de Movimiento</label>
						<div className="grid grid-cols-3 gap-1.5 p-1 bg-muted/70 rounded-xl border border-border">
							<button
								type="button"
								onClick={() => setTxForm({ ...txForm, type: 'expense', tag: DEFAULT_TAGS.expense[0] })}
								className={`py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
									txForm.type === 'expense'
										? 'bg-rose-600 text-white shadow-sm'
										: 'text-muted-foreground hover:text-foreground'
								}`}
							>
								Gasto
							</button>
							<button
								type="button"
								onClick={() => setTxForm({ ...txForm, type: 'income', tag: DEFAULT_TAGS.income[0] })}
								className={`py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
									txForm.type === 'income'
										? 'bg-emerald-600 text-white shadow-sm'
										: 'text-muted-foreground hover:text-foreground'
								}`}
							>
								Ingreso
							</button>
							<button
								type="button"
								onClick={() =>
									setTxForm({ ...txForm, type: 'transfer', tag: DEFAULT_TAGS.transfer[0] })
								}
								className={`py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
									txForm.type === 'transfer'
										? 'bg-sky-600 text-white shadow-sm'
										: 'text-muted-foreground hover:text-foreground'
								}`}
							>
								Traspaso
							</button>
						</div>
					</div>

					<div>
						<label className="block text-xs font-medium text-muted-foreground mb-1.5">Recurrencia</label>
						<div className="grid grid-cols-2 gap-1.5 p-1 bg-muted/70 rounded-xl border border-border">
							<button
								type="button"
								onClick={() => setTxForm({ ...txForm, recurrence: 'one-off' })}
								className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
									txForm.recurrence === 'one-off' || !txForm.recurrence
										? 'bg-card text-foreground shadow-sm font-semibold border border-border/60'
										: 'text-muted-foreground hover:text-foreground'
								}`}
							>
								Puntual
							</button>
							<button
								type="button"
								onClick={() => setTxForm({ ...txForm, recurrence: 'recurring' })}
								className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
									txForm.recurrence === 'recurring'
										? 'bg-card text-foreground shadow-sm font-semibold border border-border/60'
										: 'text-muted-foreground hover:text-foreground'
								}`}
							>
								Recurrente
							</button>
						</div>
						<p className="text-[10px] text-muted-foreground mt-1">
							Los movimientos recurrentes se añadirán automáticamente a los meses siguientes.
						</p>
					</div>

					<div>
						<label htmlFor="tx-desc" className="block text-xs font-medium text-muted-foreground mb-1.5">
							Concepto
						</label>
						<Input
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
						/>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div>
							<label htmlFor="tx-amount" className="block text-xs font-medium text-muted-foreground mb-1.5">
								Importe (€)
							</label>
							<Input
								id="tx-amount"
								type="number"
								step="0.01"
								required
								min="0.01"
								placeholder="0.00"
								value={txForm.amount}
								onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
								className="font-mono"
							/>
						</div>

						<div>
							<label htmlFor="tx-date" className="block text-xs font-medium text-muted-foreground mb-1.5">
								Fecha del Movimiento
							</label>
							<Input
								id="tx-date"
								type="date"
								required
								value={txForm.date}
								onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
								className="font-mono"
							/>
						</div>
					</div>

					{txForm.type === 'transfer' ? (
						<>
							<div>
								<label
									htmlFor="tx-from-account"
									className="block text-xs font-medium text-muted-foreground mb-1.5"
								>
									Cuenta de Origen
								</label>
								<Select
									value={txForm.fromAccountId}
									onValueChange={(val) => setTxForm({ ...txForm, fromAccountId: val })}
								>
									<SelectTrigger id="tx-from-account">
										<SelectValue placeholder="Selecciona cuenta de origen" />
									</SelectTrigger>
									<SelectContent>
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

							<div>
								<label
									htmlFor="tx-to-account"
									className="block text-xs font-medium text-muted-foreground mb-1.5"
								>
									Cuenta de Destino
								</label>
								<Select
									value={txForm.toAccountId}
									onValueChange={(val) => setTxForm({ ...txForm, toAccountId: val })}
								>
									<SelectTrigger id="tx-to-account">
										<SelectValue placeholder="Selecciona cuenta de destino" />
									</SelectTrigger>
									<SelectContent>
										{accounts
											.filter((acc) => acc.id !== txForm.fromAccountId)
											.map((acc) => (
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
						</>
					) : (
						<>
							<div>
								<label htmlFor="tx-account" className="block text-xs font-medium text-muted-foreground mb-1.5">
									Cuenta Asociada
								</label>
								<Select
									value={txForm.accountId || 'none'}
									onValueChange={(val) => {
										const accId = val === 'none' ? '' : val;
										const acc = accounts.find((a) => a.id === accId);
										setTxForm({
											...txForm,
											accountId: accId,
											owner: acc ? acc.owner : txForm.owner
										});
									}}
								>
									<SelectTrigger id="tx-account">
										<SelectValue placeholder="Selecciona cuenta asociada" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">Sin Cuenta (Manual)</SelectItem>
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

							{profileCount === 2 && (
								<>
									<div>
										<label className="block text-xs font-medium text-muted-foreground mb-1.5">
											¿De quién es?
										</label>
										<div className="grid grid-cols-3 gap-1.5 p-1 bg-muted/70 rounded-xl border border-border">
											<button
												type="button"
												onClick={() => setTxForm({ ...txForm, owner: 'userA' })}
												className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
													txForm.owner === 'userA'
														? 'bg-card text-foreground shadow-sm font-semibold border border-border/60'
														: 'text-muted-foreground hover:text-foreground'
												}`}
											>
												{userAName}
											</button>
											<button
												type="button"
												onClick={() => setTxForm({ ...txForm, owner: 'userB' })}
												className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
													txForm.owner === 'userB'
														? 'bg-card text-foreground shadow-sm font-semibold border border-border/60'
														: 'text-muted-foreground hover:text-foreground'
												}`}
											>
												{userBName}
											</button>
											<button
												type="button"
												onClick={() => setTxForm({ ...txForm, owner: 'joint' })}
												className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
													txForm.owner === 'joint' || !txForm.owner
														? 'bg-card text-foreground shadow-sm font-semibold border border-border/60'
														: 'text-muted-foreground hover:text-foreground'
												}`}
											>
												Conjunto
											</button>
										</div>
									</div>

									{!txForm.accountId && txForm.owner === 'joint' && txForm.type === 'expense' && (
										<div>
											<label className="block text-xs font-medium text-muted-foreground mb-1.5">
												Pagado por
											</label>
											<div className="grid grid-cols-3 gap-1.5 p-1 bg-muted/70 rounded-xl border border-border">
												<button
													type="button"
													onClick={() => setTxForm({ ...txForm, paidBy: 'userA' })}
													className={`py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
														txForm.paidBy === 'userA'
															? 'bg-card text-foreground shadow-sm font-semibold border border-border/60'
															: 'text-muted-foreground hover:text-foreground'
													}`}
												>
													{userAName}
												</button>
												<button
													type="button"
													onClick={() => setTxForm({ ...txForm, paidBy: 'userB' })}
													className={`py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
														txForm.paidBy === 'userB'
															? 'bg-card text-foreground shadow-sm font-semibold border border-border/60'
															: 'text-muted-foreground hover:text-foreground'
													}`}
												>
													{userBName}
												</button>
												<button
													type="button"
													onClick={() => setTxForm({ ...txForm, paidBy: 'shared' })}
													className={`py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
														txForm.paidBy === 'shared' || !txForm.paidBy
															? 'bg-card text-foreground shadow-sm font-semibold border border-border/60'
															: 'text-muted-foreground hover:text-foreground'
													}`}
												>
													Cuenta Común
												</button>
											</div>
										</div>
									)}
								</>
							)}
						</>
					)}

					<div>
						<label htmlFor="tx-tag" className="block text-xs font-medium text-muted-foreground mb-1.5">
							Etiqueta
						</label>
						<Input
							id="tx-tag"
							list="tx-tags-list"
							value={txForm.tag}
							onChange={(e) => setTxForm({ ...txForm, tag: e.target.value })}
							placeholder="Elige o escribe una etiqueta"
						/>
						<datalist id="tx-tags-list">
							{DEFAULT_TAGS[txForm.type].map((tag) => (
								<option key={tag} value={tag} />
							))}
						</datalist>
					</div>

					<div className="flex gap-2 pt-1 lg:sticky lg:bottom-0 lg:z-10 lg:-mx-6 lg:px-6 lg:pt-3 lg:bg-card lg:border-t lg:border-border lg:shadow-[0_24px_0_0_hsl(var(--card))]">
						<button
							type="submit"
							className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 rounded-xl text-sm transition-all active:scale-[0.98]"
						>
							Agregar Transacción
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

			{/* Listado de Historial */}
			<div className="lg:col-span-8 premium-card rounded-2xl p-5 lg:p-6 flex flex-col lg:h-full lg:max-h-full min-h-0">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 shrink-0 pb-3.5 border-b border-border">
					<div className="flex items-center gap-2.5">
						<h3 className="font-heading text-base font-bold text-foreground tracking-tight">
							Historial para el mes {selectedMonth}
						</h3>
						<span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-muted text-muted-foreground border border-border">
							{displayedTransactions.length}
						</span>
					</div>
					<div className="flex bg-muted/70 p-1 rounded-xl border border-border text-xs font-semibold shrink-0">
						<button
							type="button"
							onClick={() => setTypeFilter('all')}
							className={`px-3 py-1.5 rounded-lg transition-all ${
								typeFilter === 'all'
									? 'bg-card text-foreground shadow-sm font-semibold border border-border/60'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							Todos
						</button>
						<button
							type="button"
							onClick={() => setTypeFilter('both')}
							className={`px-3 py-1.5 rounded-lg transition-all ${
								typeFilter === 'both'
									? 'bg-card text-foreground shadow-sm font-semibold border border-border/60'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							Gastos/Ingresos
						</button>
						<button
							type="button"
							onClick={() => setTypeFilter('expense')}
							className={`px-3 py-1.5 rounded-lg transition-all ${
								typeFilter === 'expense'
									? 'bg-card text-foreground shadow-sm font-semibold border border-border/60'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							Gastos
						</button>
						<button
							type="button"
							onClick={() => setTypeFilter('income')}
							className={`px-3 py-1.5 rounded-lg transition-all ${
								typeFilter === 'income'
									? 'bg-card text-foreground shadow-sm font-semibold border border-border/60'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							Ingresos
						</button>
					</div>
				</div>

				{displayedTransactions.length === 0 ? (
					<div className="text-center py-12 text-muted-foreground flex-1 flex flex-col justify-center border border-dashed border-border rounded-xl">
						<p className="text-sm font-medium text-foreground/80">No hay transacciones registradas este mes.</p>
						<p className="text-xs mt-1">Usa el formulario para añadir ingresos o gastos corrientes.</p>
					</div>
				) : (
					<div className="flex-1 lg:overflow-y-auto pr-1" style={{ WebkitOverflowScrolling: 'touch' }}>
						{/* Vista de Tarjetas para Móviles */}
						<div className="md:hidden space-y-3">
							{displayedTransactions.map((t) => (
								<div
									key={t.id}
									draggable
									onDragStart={(e) => handleDragStart(e, t.id)}
									onDragOver={(e) => handleDragOver(e, t.id)}
									onDragLeave={handleDragLeave}
									onDrop={(e) => handleDrop(e, t.id)}
									onDragEnd={handleDragEnd}
									className={`bg-card p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-all duration-200 ${
										draggedTxId === t.id ? 'opacity-40 cursor-grabbing' : ''
									} ${
										dragOverTxId === t.id
											? 'border-foreground/40 bg-muted/50 scale-[1.01]'
											: 'border-border hover:border-border/80'
									}`}
								>
									<div className="flex justify-between items-start">
										<div className="space-y-1">
											<div className="flex items-center gap-1.5 flex-wrap">
												<div
													className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-muted rounded text-muted-foreground flex items-center justify-center"
													title="Arrastrar para reordenar"
												>
													<Icons.GripVertical className="w-3.5 h-3.5" />
												</div>
												<span className="font-semibold text-foreground text-sm">{t.desc}</span>
												{t.recurrence === 'recurring' && (
													<span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-medium bg-muted text-muted-foreground border border-border">
														Recurrente
													</span>
												)}
											</div>
											<div className="text-[10px] text-muted-foreground font-mono">
												{t.date}
												{t.type === 'transfer' ? (
													<span className="block mt-0.5">
														{accounts.find((a) => a.id === t.fromAccountId)?.name ||
															'Origen'}{' '}
														➔{' '}
														{accounts.find((a) => a.id === t.toAccountId)?.name ||
															'Destino'}
													</span>
												) : (
													t.accountId && (
														<span className="block mt-0.5">
															Cuenta:{' '}
															{accounts.find((a) => a.id === t.accountId)?.name ||
																'Desconocida'}
														</span>
													)
												)}
											</div>
										</div>

										<div className="text-right">
											{t.type === 'transfer' ? (
												<span className="text-sky-600 dark:text-sky-400 font-semibold font-mono tabular-nums text-sm">
													{formatAmount(toNumber(t.money?.amount))}
												</span>
											) : (
												<span
													className={`font-semibold font-mono tabular-nums text-sm ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
												>
													{formatAmount(toNumber(t.money?.amount), { showSign: true })}
												</span>
											)}
										</div>
									</div>

									<div className="flex justify-between items-center pt-2.5 border-t border-border">
										<div className="flex gap-1 flex-wrap">
											<span
												className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-medium ${
													t.type === 'income'
														? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
														: t.type === 'transfer'
															? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
															: 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
												}`}
											>
												{t.tag}
											</span>
											{profileCount === 2 && t.type !== 'transfer' && (
												<span
													className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted text-muted-foreground border border-border"
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
												className="text-muted-foreground hover:text-foreground p-2 rounded-lg transition-all border border-border bg-card shadow-sm min-h-[40px] min-w-[40px] flex items-center justify-center"
												title="Editar transacción"
											>
												<Icons.Edit />
											</button>
											<button
												onClick={() => handleDeleteTransaction(t.id)}
												className="text-muted-foreground hover:text-destructive p-2 rounded-lg transition-all border border-border bg-card shadow-sm min-h-[40px] min-w-[40px] flex items-center justify-center"
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
								<thead className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm">
									<tr className="border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/40">
										<th className="pb-2.5 pt-2.5 pl-2 w-8"></th>
										<th className="pb-2.5 pt-2.5 pl-2">Fecha</th>
										<th className="pb-2.5 pt-2.5">Concepto</th>
										{profileCount === 2 && <th className="pb-2.5 pt-2.5">Propietario</th>}
										<th className="pb-2.5 pt-2.5">Etiqueta</th>
										<th className="pb-2.5 pt-2.5 text-right">Importe</th>
										<th className="pb-2.5 pt-2.5 text-center pr-2">Acciones</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border text-sm">
									{displayedTransactions.map((t) => (
										<tr
											key={t.id}
											draggable
											onDragStart={(e) => handleDragStart(e, t.id)}
											onDragOver={(e) => handleDragOver(e, t.id)}
											onDragLeave={handleDragLeave}
											onDrop={(e) => handleDrop(e, t.id)}
											onDragEnd={handleDragEnd}
											className={`transition-all duration-200 ${
												draggedTxId === t.id
													? 'opacity-40 cursor-grabbing'
													: 'hover:bg-muted/40'
											} ${
												dragOverTxId === t.id
													? 'bg-muted/60 border-t-2 border-b-2 border-foreground/30'
													: 'border-b border-border'
											}`}
										>
											<td className="py-3 pl-2 text-center align-middle w-8">
												<div
													className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded flex items-center justify-center text-muted-foreground"
													title="Arrastrar para reordenar"
												>
													<Icons.GripVertical className="w-3.5 h-3.5" />
												</div>
											</td>
											<td className="py-3 pl-2 text-muted-foreground font-mono text-xs whitespace-nowrap">{t.date}</td>
											<td className="py-3 font-medium text-foreground">
												<div className="flex flex-col">
													<div className="flex items-center space-x-2">
														<span>{t.desc}</span>
														{t.recurrence === 'recurring' && (
															<span
																title="Movimiento Recurrente"
																className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted text-muted-foreground border border-border"
															>
																<svg
																	className="w-3 h-3 mr-0.5"
																	fill="none"
																	viewBox="0 0 24 24"
																	stroke="currentColor"
																	strokeWidth={2}
																>
																	<path
																		strokeLinecap="round"
																		strokeLinejoin="round"
																		d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5"
																	/>
																</svg>
																Recurrente
															</span>
														)}
													</div>
													{t.type === 'transfer' ? (
														<div className="text-[10px] text-muted-foreground font-mono mt-0.5">
															{accounts.find((a) => a.id === t.fromAccountId)?.name ||
																'Sin origen'}{' '}
															➔{' '}
															{accounts.find((a) => a.id === t.toAccountId)?.name ||
																'Sin destino'}
														</div>
													) : (
														t.accountId && (
															<div className="text-[10px] text-muted-foreground font-mono mt-0.5">
																Cuenta:{' '}
																{accounts.find((a) => a.id === t.accountId)?.name ||
																	'Desconocida'}
															</div>
														)
													)}
												</div>
											</td>
											{profileCount === 2 && (
												<td className="py-3">
													{t.type === 'transfer' ? (
														<span className="inline-block px-2 py-0.5 rounded text-[10px] bg-muted text-muted-foreground font-medium">
															Traspaso
														</span>
													) : (
														<span
															className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border"
														>
															{t.owner === 'userA'
																? userAName
																: t.owner === 'userB'
																	? userBName
																	: 'Conjunto'}
															{t.owner === 'joint' &&
																t.type === 'expense' &&
																` (${t.paidBy === 'userA' ? userAName : t.paidBy === 'userB' ? userBName : 'Común'})`}
														</span>
													)}
												</td>
											)}
											<td className="py-3">
												<span
													className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
														t.type === 'income'
															? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
															: t.type === 'transfer'
																? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
																: 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
													}`}
												>
													{t.tag}
												</span>
											</td>
											<td className="py-3 text-right font-mono tabular-nums">
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
															const txAmount = toNumber(t.money?.amount);
															const netChange = (toW - fromW) * txAmount;
															if (netChange > 0.001) {
																return (
																	<span className="text-emerald-600 dark:text-emerald-400 font-semibold">
																		{formatAmount(txAmount, { showSign: true })}
																	</span>
																);
															} else if (netChange < -0.001) {
																return (
																	<span className="text-rose-600 dark:text-rose-400 font-semibold">
																		{formatAmount(-txAmount)}
																	</span>
																);
															}
														}
														return (
															<span className="text-sky-600 dark:text-sky-400 font-semibold">
																{formatAmount(toNumber(t.money?.amount))}
															</span>
														);
													}
													return (
														<span
															className={`font-semibold ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
														>
															{formatAmount(toNumber(t.money?.amount), {
																showSign: t.type === 'income'
															})}
														</span>
													);
												})()}
											</td>
											<td className="py-3 text-center font-medium pr-2">
												<button
													onClick={() => handleStartEditTransaction(t)}
													className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg transition-colors mr-1"
													title="Editar transacción"
												>
													<Icons.Edit />
												</button>
												<button
													onClick={() => handleDeleteTransaction(t.id)}
													className="text-muted-foreground hover:text-destructive p-1.5 rounded-lg transition-colors"
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

			<ImportStatementModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
		</div>
	);
}
