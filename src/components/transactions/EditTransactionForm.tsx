import React, { useState, useEffect } from 'react';
import { Transaction, Account, TxForm } from '../../types';
import { Icons } from '../common/Icons';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DEFAULT_TAGS } from '../../constants';
import { deduceTagFromConcept } from '../../services/financeService';

interface EditTransactionFormProps {
	editingTx: Transaction;
	accounts: Account[];
	userAName: string;
	userBName: string;
	initialEditForm: TxForm;
	editScope: 'only-this' | 'future' | 'all';
	setEditScope: (scope: 'only-this' | 'future' | 'all') => void;
	onSave: (e: React.FormEvent<HTMLFormElement>, form: TxForm) => void;
	onCancel: () => void;
}

export function EditTransactionForm({
	editingTx,
	accounts,
	userAName,
	userBName,
	initialEditForm,
	editScope,
	setEditScope,
	onSave,
	onCancel
}: EditTransactionFormProps) {
	const [editForm, setEditForm] = useState<TxForm>(initialEditForm);

	// Sincronizar con el formulario inicial si cambia desde fuera
	useEffect(() => {
		setEditForm(initialEditForm);
	}, [initialEditForm]);

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		onSave(e, editForm);
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div>
				<label className="block text-xs font-medium text-slate-400 mb-1.5">Tipo de Movimiento</label>
				<div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
					<button
						type="button"
						onClick={() => setEditForm({ ...editForm, type: 'expense', tag: DEFAULT_TAGS.expense[0] })}
						className={`py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all \${
							editForm.type === 'expense'
								? 'bg-rose-500 text-white shadow-md'
								: 'text-slate-400 hover:text-slate-200'
						}`}
					>
						Gasto
					</button>
					<button
						type="button"
						onClick={() => setEditForm({ ...editForm, type: 'income', tag: DEFAULT_TAGS.income[0] })}
						className={`py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all \${
							editForm.type === 'income'
								? 'bg-emerald-500 text-white shadow-md'
								: 'text-slate-400 hover:text-slate-200'
						}`}
					>
						Ingreso
					</button>
					<button
						type="button"
						onClick={() => setEditForm({ ...editForm, type: 'transfer', tag: DEFAULT_TAGS.transfer[0] })}
						className={`py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all \${
							editForm.type === 'transfer'
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
						onClick={() => setEditForm({ ...editForm, recurrence: 'one-off' })}
						className={`py-2 rounded-lg text-xs font-semibold transition-all \${
							editForm.recurrence === 'one-off' || !editForm.recurrence
								? 'bg-indigo-600 text-white shadow-md'
								: 'text-slate-400 hover:text-slate-200'
						}`}
					>
						Puntual
					</button>
					<button
						type="button"
						onClick={() => setEditForm({ ...editForm, recurrence: 'recurring' })}
						className={`py-2 rounded-lg text-xs font-semibold transition-all \${
							editForm.recurrence === 'recurring'
								? 'bg-indigo-600 text-white shadow-md'
								: 'text-slate-400 hover:text-slate-200'
						}`}
					>
						Recurrente
					</button>
				</div>
			</div>

			<div>
				<label htmlFor="edit-desc" className="block text-xs font-medium text-slate-400 mb-1.5">
					Concepto
				</label>
				<Input
					id="edit-desc"
					type="text"
					required
					value={editForm.desc}
					onChange={(e) => {
						const desc = e.target.value;
						const deduced = deduceTagFromConcept(desc, editForm.type);
						setEditForm((prev) => ({
							...prev,
							desc,
							tag: deduced || prev.tag
						}));
					}}
				/>
			</div>

			<div>
				<label htmlFor="edit-amount" className="block text-xs font-medium text-slate-400 mb-1.5">
					Importe (€)
				</label>
				<Input
					id="edit-amount"
					type="number"
					step="0.01"
					required
					min="0.01"
					value={editForm.amount}
					onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
				/>
			</div>

			<div>
				<label htmlFor="edit-date" className="block text-xs font-medium text-slate-400 mb-1.5">
					Fecha
				</label>
				<Input
					id="edit-date"
					type="date"
					required
					value={editForm.date}
					onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
					className="font-mono"
				/>
			</div>

			{editForm.type === 'transfer' ? (
				<>
					<div>
						<label htmlFor="edit-from-account" className="block text-xs font-medium text-slate-400 mb-1.5">
							Cuenta de Origen
						</label>
						<Select
							value={editForm.fromAccountId}
							onValueChange={(val) => setEditForm({ ...editForm, fromAccountId: val })}
						>
							<SelectTrigger id="edit-from-account">
								<SelectValue placeholder="Selecciona cuenta de origen" />
							</SelectTrigger>
							<SelectContent>
								{accounts.map((acc) => (
									<SelectItem key={acc.id} value={acc.id}>
										{acc.name} (
										{acc.owner === 'userA'
											? userAName
											: acc.owner === 'userB'
												? userBName
												: 'Compartida'}
										)
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div>
						<label htmlFor="edit-to-account" className="block text-xs font-medium text-slate-400 mb-1.5">
							Cuenta de Destino
						</label>
						<Select
							value={editForm.toAccountId}
							onValueChange={(val) => setEditForm({ ...editForm, toAccountId: val })}
						>
							<SelectTrigger id="edit-to-account">
								<SelectValue placeholder="Selecciona cuenta de destino" />
							</SelectTrigger>
							<SelectContent>
								{accounts
									.filter((acc) => acc.id !== editForm.fromAccountId)
									.map((acc) => (
										<SelectItem key={acc.id} value={acc.id}>
											{acc.name} (
											{acc.owner === 'userA'
												? userAName
												: acc.owner === 'userB'
													? userBName
													: 'Compartida'}
											)
										</SelectItem>
									))}
							</SelectContent>
						</Select>
					</div>
				</>
			) : (
				<>
					<div>
						<label htmlFor="edit-account" className="block text-xs font-medium text-slate-400 mb-1.5">
							Cuenta Asociada
						</label>
						<Select
							value={editForm.accountId || 'none'}
							onValueChange={(val) => {
								const accId = val === 'none' ? '' : val;
								const acc = accounts.find((a) => a.id === accId);
								setEditForm({
									...editForm,
									accountId: accId,
									owner: acc ? acc.owner : editForm.owner
								});
							}}
						>
							<SelectTrigger id="edit-account">
								<SelectValue placeholder="Selecciona cuenta asociada" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">Sin Cuenta (Manual)</SelectItem>
								{accounts.map((acc) => (
									<SelectItem key={acc.id} value={acc.id}>
										{acc.name} (
										{acc.owner === 'userA'
											? userAName
											: acc.owner === 'userB'
												? userBName
												: 'Compartida'}
										)
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div>
						<label className="block text-xs font-medium text-slate-400 mb-1.5">¿De quién es?</label>
						<div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
							<button
								type="button"
								onClick={() => setEditForm({ ...editForm, owner: 'userA' })}
								className={`py-1.5 rounded-lg text-xs font-semibold transition-all \${
									editForm.owner === 'userA'
										? 'bg-indigo-600 text-white shadow-md'
										: 'text-slate-400 hover:text-slate-200'
								}`}
							>
								{userAName}
							</button>
							<button
								type="button"
								onClick={() => setEditForm({ ...editForm, owner: 'userB' })}
								className={`py-1.5 rounded-lg text-xs font-semibold transition-all \${
									editForm.owner === 'userB'
										? 'bg-indigo-600 text-white shadow-md'
										: 'text-slate-400 hover:text-slate-200'
								}`}
							>
								{userBName}
							</button>
							<button
								type="button"
								onClick={() => setEditForm({ ...editForm, owner: 'joint' })}
								className={`py-1.5 rounded-lg text-xs font-semibold transition-all \${
									editForm.owner === 'joint'
										? 'bg-indigo-600 text-white shadow-md'
										: 'text-slate-400 hover:text-slate-200'
								}`}
							>
								Conjunto
							</button>
						</div>
					</div>

					{!editForm.accountId && editForm.owner === 'joint' && editForm.type === 'expense' && (
						<div>
							<label className="block text-xs font-medium text-slate-400 mb-1.5">Pagado por</label>
							<div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
								<button
									type="button"
									onClick={() => setEditForm({ ...editForm, paidBy: 'userA' })}
									className={`py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all \${
										editForm.paidBy === 'userA'
											? 'bg-slate-750 text-white shadow-md'
											: 'text-slate-400 hover:text-slate-200'
									}`}
								>
									{userAName}
								</button>
								<button
									type="button"
									onClick={() => setEditForm({ ...editForm, paidBy: 'userB' })}
									className={`py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all \${
										editForm.paidBy === 'userB'
											? 'bg-slate-750 text-white shadow-md'
											: 'text-slate-400 hover:text-slate-200'
									}`}
								>
									{userBName}
								</button>
								<button
									type="button"
									onClick={() => setEditForm({ ...editForm, paidBy: 'shared' })}
									className={`py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all \${
										editForm.paidBy === 'shared'
											? 'bg-slate-750 text-white shadow-md'
											: 'text-slate-400 hover:text-slate-200'
									}`}
								>
									Común
								</button>
							</div>
						</div>
					)}
				</>
			)}

			<div>
				<label htmlFor="edit-tag" className="block text-xs font-medium text-slate-400 mb-1.5">
					Etiqueta
				</label>
				<Input
					id="edit-tag"
					list="edit-tags-list"
					value={editForm.tag}
					onChange={(e) => setEditForm({ ...editForm, tag: e.target.value })}
					placeholder="Elige o escribe una etiqueta"
				/>
				<datalist id="edit-tags-list">
					{DEFAULT_TAGS[editForm.type].map((tag) => (
						<option key={tag} value={tag} />
					))}
				</datalist>
			</div>

			{/* Rango de Edición para recurrentes */}
			{editingTx.recurrence === 'recurring' && (
				<div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
					<label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
						Alcance del cambio recurrente
					</label>
					<div className="space-y-2">
						<label className="flex items-center space-x-3 text-xs text-slate-300 cursor-pointer">
							<input
								type="radio"
								name="editScope"
								value="only-this"
								checked={editScope === 'only-this'}
								onChange={() => setEditScope('only-this')}
								className="w-4 h-4 rounded-full border-slate-850 text-indigo-600 focus:ring-0 bg-slate-900"
							/>
							<span>Solo este mes</span>
						</label>
						<label className="flex items-center space-x-3 text-xs text-slate-300 cursor-pointer">
							<input
								type="radio"
								name="editScope"
								value="future"
								checked={editScope === 'future'}
								onChange={() => setEditScope('future')}
								className="w-4 h-4 rounded-full border-slate-850 text-indigo-600 focus:ring-0 bg-slate-900"
							/>
							<span>Este y todos los meses futuros</span>
						</label>
						<label className="flex items-center space-x-3 text-xs text-slate-300 cursor-pointer">
							<input
								type="radio"
								name="editScope"
								value="all"
								checked={editScope === 'all'}
								onChange={() => setEditScope('all')}
								className="w-4 h-4 rounded-full border-slate-850 text-indigo-600 focus:ring-0 bg-slate-900"
							/>
							<span>Toda la serie (pasado y futuro)</span>
						</label>
					</div>
				</div>
			)}

			<div className="flex gap-2 pt-2">
				<button
					type="submit"
					className="w-1/2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold py-2.5 rounded-xl text-xs transition-all active:scale-95 shadow-md shadow-indigo-600/10"
				>
					Guardar
				</button>
				<button
					type="button"
					onClick={onCancel}
					className="w-1/2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold py-2.5 rounded-xl text-xs transition-all"
				>
					Cancelar
				</button>
			</div>
		</form>
	);
}
