import React, { useState } from 'react';
import { useFinanzas } from '../../hooks/useFinanzas';
import { Icons } from '../common/Icons';
import { SyncModal } from '../sync/SyncModal';
import { Input } from '../ui/input';

/**
 * Componente que renderiza la pestaña de Cuentas y Configuración.
 * Permite configurar las cuentas financieras del hogar y realizar
 * copias de seguridad (exportar e importar datos mediante JSON).
 */
export function AccountsTab() {
	const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
	const {
		accounts,
		selectedMonth,
		timelineBalances,
		userAName,
		userBName,
		editingAccount,
		setEditingAccount,
		accountForm,
		setAccountForm,
		handleStartEditAccount,
		handleDeleteAccount,
		handleAddAccount,
		handleSaveEditAccount,
		handleExportData,
		handleImportData,
		importError,
		importSuccess,
		formatAmount,
		profileCount
	} = useFinanzas();

	// Adaptador para el input del archivo JSON de copia de seguridad
	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (event) => {
			const jsonString = event.target?.result as string;
			// Creamos un evento preventDefault ficticio para cumplir la firma de handleImportData
			const fakeEvent = {
				preventDefault: () => {}
			} as React.SyntheticEvent<HTMLFormElement>;
			handleImportData(fakeEvent, jsonString);
		};
		reader.readAsText(file);
	};

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
				{/* Listado de Cuentas */}
				<div className="lg:col-span-8 premium-card rounded-2xl p-5 lg:p-6">
					<div className="flex items-center justify-between gap-2 mb-1.5">
						<h3 className="font-heading text-base font-bold text-foreground flex items-center gap-2 tracking-tight">
							<svg
								className="w-5 h-5 text-muted-foreground"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
								/>
							</svg>
							Cuentas Configuradas
						</h3>
						<span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-muted text-muted-foreground border border-border">
							{accounts.length}
						</span>
					</div>
					<p className="text-xs text-muted-foreground mb-5 pb-3.5 border-b border-border">
						Tus cuentas financieras activas. Los saldos de apertura de la cronología se calculan en base a
						sus saldos iniciales.
					</p>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{accounts.map((acc) => {
							const closingBal =
								timelineBalances[selectedMonth]?.accountBalances[acc.id] ?? acc.initialBalance;
							const isEditingThis = editingAccount?.id === acc.id;
							return (
								<div
									key={acc.id}
									className={`bg-card p-5 rounded-xl border transition-all flex flex-col justify-between duration-300 taste-lift ${
										isEditingThis
											? 'border-foreground/40 bg-muted/30 shadow-sm'
											: 'border-border hover:border-border/80'
									}`}
								>
									<div>
										<div className="flex justify-between items-start mb-2">
											<h4 className="font-bold text-foreground text-sm truncate max-w-[180px]">
												{acc.name}
											</h4>
											{profileCount === 2 && (
												<span
													className="inline-block px-2 py-0.5 rounded text-[9px] font-medium bg-muted text-muted-foreground border border-border"
												>
													{acc.owner === 'userA'
														? userAName
														: acc.owner === 'userB'
															? userBName
															: 'Compartida'}
												</span>
											)}
										</div>
										<div className="text-xs text-muted-foreground font-mono tabular-nums mt-1 space-y-1">
											<div>Saldo Inicial: {formatAmount(acc.initialBalance)}</div>
										</div>
									</div>

									<div className="mt-4 pt-3.5 border-t border-border flex items-center justify-between">
										<div>
											<span className="block text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
												Saldo en {selectedMonth}:
											</span>
											<span
												className={`text-base font-bold font-mono tabular-nums ${closingBal >= 0 ? 'text-foreground' : 'text-rose-600 dark:text-rose-400'}`}
											>
												{formatAmount(closingBal)}
											</span>
										</div>
										<div className="flex space-x-1.5">
											<button
												onClick={() => handleStartEditAccount(acc)}
												className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg transition-colors border border-border bg-card"
												title="Editar cuenta"
											>
												<Icons.Edit />
											</button>
											<button
												onClick={() => handleDeleteAccount(acc.id)}
												className="text-muted-foreground hover:text-destructive p-1.5 rounded-lg transition-colors border border-border bg-card"
												title="Eliminar cuenta"
											>
												<Icons.Trash />
											</button>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</div>

				{/* Formulario de Alta/Edición */}
				<div className="lg:col-span-4 premium-card rounded-2xl p-5 lg:p-6 h-fit">
					<h3 className="font-heading text-base font-bold text-foreground mb-5 pb-3.5 border-b border-border flex items-center tracking-tight">
						<span className="p-1.5 bg-muted text-foreground rounded-lg mr-2 border border-border/60">
							{editingAccount ? <Icons.Edit className="w-3.5 h-3.5" /> : <Icons.Plus className="w-3.5 h-3.5" />}
						</span>
						{editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta'}
					</h3>

					<form onSubmit={editingAccount ? handleSaveEditAccount : handleAddAccount} className="space-y-4">
						<div>
							<label htmlFor="acc-name" className="block text-xs font-medium text-muted-foreground mb-1.5">
								Nombre de la Cuenta
							</label>
							<Input
								id="acc-name"
								type="text"
								required
								placeholder="Ej. Nómina La Caixa, Cuenta Ahorros..."
								value={accountForm.name}
								onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
							/>
						</div>

						{profileCount === 2 && (
							<div>
								<label className="block text-xs font-medium text-muted-foreground mb-1.5">
									Propietario / Tipo
								</label>
								<div className="grid grid-cols-3 gap-1.5 p-1 bg-muted/70 rounded-xl border border-border">
									<button
										type="button"
										onClick={() => setAccountForm({ ...accountForm, owner: 'userA' })}
										className={`py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
											accountForm.owner === 'userA'
												? 'bg-card text-foreground shadow-sm font-semibold border border-border/60'
												: 'text-muted-foreground hover:text-foreground'
										}`}
									>
										{userAName}
									</button>
									<button
										type="button"
										onClick={() => setAccountForm({ ...accountForm, owner: 'userB' })}
										className={`py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
											accountForm.owner === 'userB'
												? 'bg-card text-foreground shadow-sm font-semibold border border-border/60'
												: 'text-muted-foreground hover:text-foreground'
										}`}
									>
										{userBName}
									</button>
									<button
										type="button"
										onClick={() => setAccountForm({ ...accountForm, owner: 'joint' })}
										className={`py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
											accountForm.owner === 'joint'
												? 'bg-card text-foreground shadow-sm font-semibold border border-border/60'
												: 'text-muted-foreground hover:text-foreground'
										}`}
									>
										Compartida
									</button>
								</div>
							</div>
						)}

						<div>
							<label htmlFor="acc-balance" className="block text-xs font-medium text-muted-foreground mb-1.5">
								Saldo Inicial (€)
							</label>
							<Input
								id="acc-balance"
								type="number"
								step="0.01"
								required
								min="0"
								placeholder="0.00"
								value={accountForm.initialBalance}
								onChange={(e) => setAccountForm({ ...accountForm, initialBalance: e.target.value })}
								className="font-mono"
							/>
						</div>

						<div className="flex gap-2 pt-2">
							<button
								type="submit"
								className={`font-semibold py-2.5 rounded-xl text-sm transition-all active:scale-[0.98] ${editingAccount ? 'w-1/2 bg-primary hover:bg-primary/90 text-primary-foreground' : 'w-full bg-primary hover:bg-primary/90 text-primary-foreground'}`}
							>
								{editingAccount ? 'Guardar' : 'Agregar Cuenta'}
							</button>
							{editingAccount && (
								<button
									type="button"
									onClick={() => {
										setEditingAccount(null);
										setAccountForm({
											name: '',
											owner: profileCount === 1 ? 'userA' : 'joint',
											initialBalance: ''
										});
									}}
									className="w-1/2 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border font-semibold py-2.5 rounded-xl text-xs transition-all"
								>
									Cancelar
								</button>
							)}
						</div>
					</form>
				</div>
			</div>

			{/* Copia de Seguridad (Backup) */}
			<div className="premium-card rounded-2xl p-5 lg:p-6">
				<h3 className="font-heading text-base font-bold text-foreground mb-1.5 flex items-center gap-2 tracking-tight">
					<svg
						className="w-5 h-5 text-muted-foreground"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2}
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2v-9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
						/>
					</svg>
					Copia de Seguridad (Backup)
				</h3>
				<p className="text-xs text-muted-foreground mb-5 pb-3.5 border-b border-border">
					Guarda o restaura toda tu información financiera (cuentas, movimientos, deudas, perfiles y chat)
					para tener un respaldo o transferirla a otro ordenador.
				</p>

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
					<div className="bg-card p-5 rounded-xl border border-border flex flex-col justify-between transition-all hover:border-border/80 duration-300 taste-lift">
						<div>
							<h4 className="font-bold text-foreground text-sm mb-1">Exportar Datos</h4>
							<p className="text-xs text-muted-foreground leading-relaxed">
								Descarga un archivo JSON en tu ordenador que contiene toda la configuración y registros
								actuales de la aplicación.
							</p>
						</div>
						<button
							onClick={handleExportData}
							className="mt-4 w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
						>
							<svg
								className="w-4 h-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
								/>
							</svg>
							Exportar en JSON
						</button>
					</div>

					<div className="bg-card p-5 rounded-xl border border-border flex flex-col justify-between transition-all hover:border-border/80 duration-300 taste-lift">
						<div>
							<h4 className="font-bold text-foreground text-sm mb-1">Importar Copia de Seguridad</h4>
							<p className="text-xs text-muted-foreground leading-relaxed">
								Sube un archivo de copia de seguridad JSON previamente exportado.{' '}
								<span className="text-amber-600 dark:text-amber-400 font-medium">
									Esto reemplazará todos tus datos locales actuales.
								</span>
							</p>
						</div>
						<div className="mt-4 relative">
							<input
								id="import-backup-file"
								type="file"
								accept=".json"
								onChange={handleFileChange}
								className="hidden"
							/>
							<label
								htmlFor="import-backup-file"
								className="w-full bg-secondary hover:bg-secondary/80 border border-border text-secondary-foreground font-semibold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer text-center"
							>
								<svg
									className="w-4 h-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={2}
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12"
									/>
								</svg>
								Seleccionar Archivo JSON
							</label>
						</div>
					</div>

					<div className="bg-card p-5 rounded-xl border border-border flex flex-col justify-between transition-all hover:border-border/80 duration-300 taste-lift">
						<div>
							<h4 className="font-bold text-foreground text-sm mb-1">Sincronización P2P</h4>
							<p className="text-xs text-muted-foreground leading-relaxed">
								Transfiere datos en tiempo real entre tu ordenador y tu móvil. Directo, cifrado y sin
								usar servidores de terceros.
							</p>
						</div>
						<button
							onClick={() => setIsSyncModalOpen(true)}
							className="mt-4 w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
						>
							<svg
								className="w-4 h-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
								/>
							</svg>
							Sincronizar Dispositivos
						</button>
					</div>
				</div>

				{importError && (
					<div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl flex items-center gap-2">
						<svg
							className="w-4 h-4 shrink-0"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth={2}
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/>
						</svg>
						<span>{importError}</span>
					</div>
				)}
				{importSuccess && (
					<div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl flex items-center gap-2">
						<svg
							className="w-4 h-4 shrink-0"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth={2}
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<span>{importSuccess}</span>
					</div>
				)}
			</div>

			<SyncModal isOpen={isSyncModalOpen} onClose={() => setIsSyncModalOpen(false)} />
		</div>
	);
}
