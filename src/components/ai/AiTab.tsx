import { useFinanzas } from '../../hooks/useFinanzas';
import { Icons } from '../common/Icons';
import { MarkdownRenderer } from '../common/MarkdownRenderer';

/**
 * Componente que renderiza la pestaña del Asesor de Inteligencia Artificial (Gemini AI).
 * Permite configurar la clave API, visualizar estadísticas rápidas incluidas en el contexto
 * y chatear con la IA para obtener recomendaciones financieras.
 */
export function AiTab() {
	const {
		geminiApiKey,
		setGeminiApiKey,
		selectedMonth,
		totalIncomes,
		oneOffIncomes,
		totalExpenses,
		oneOffExpenses,
		totalMonthlyDebtPayments,
		netMonthlyBalance,
		debts,
		chatMessages,
		handleClearChat,
		handleCopyChatPlaintext,
		copiedChat,
		setIsExportPdfModalOpen,
		customQuestion,
		setCustomQuestion,
		handleAskGemini,
		aiLoading,
		aiError
	} = useFinanzas();

	return (
		<div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-0 overflow-hidden">
			{/* Panel de Configuración e Información Lateral */}
			<div className="lg:col-span-4 space-y-6 overflow-y-auto lg:h-full pr-1">
				{/* Configuración de API Key */}
				<div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
					<h3 className="text-base font-bold text-slate-200 mb-2 flex items-center">
						<span className="p-1 bg-slate-800 rounded mr-2">
							<Icons.Lock />
						</span>
						Credenciales de Gemini
					</h3>
					<p className="text-xs text-slate-400 mb-4">
						Introduce tu API Key de Google Gemini para habilitar el motor de análisis y recibir consejos
						estructurados en tiempo real.
					</p>

					<div className="space-y-3">
						<input
							type="password"
							placeholder="Al pegar tu AI_KEY se guardará localmente"
							value={geminiApiKey}
							onChange={(e) => setGeminiApiKey(e.target.value)}
							className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2 text-sm text-slate-100 font-mono outline-none"
						/>
						{geminiApiKey ? (
							<span className="text-[10px] text-emerald-400 font-semibold block">
								✓ API Key configurada localmente.
							</span>
						) : (
							<span className="text-[10px] text-amber-500 font-semibold block">
								⚠ Falta la API Key para procesar consultas.
							</span>
						)}
					</div>
				</div>

				{/* Resumen del Contexto Financiero del Mes */}
				<div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
					<h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
						<svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
							<path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
						</svg>
						Contexto del Mes ({selectedMonth})
					</h3>
					<p className="text-xs text-slate-400 leading-relaxed">
						Los siguientes datos son incluidos automáticamente en la consulta de fondo para contextualizar la conversación:
					</p>
					<div className="space-y-2 text-xs border-t border-slate-800 pt-3">
						<div className="flex justify-between">
							<span className="text-slate-500">Ingresos Totales:</span>
							<span className="font-semibold text-emerald-400">
								{totalIncomes.toFixed(2)}€
								{oneOffIncomes > 0 && ` (Puntual: ${oneOffIncomes.toFixed(2)}€)`}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="text-slate-500">Gastos Totales:</span>
							<span className="font-semibold text-rose-400">
								-{totalExpenses.toFixed(2)}€
								{oneOffExpenses > 0 && ` (Puntual: -${oneOffExpenses.toFixed(2)}€)`}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="text-slate-500">Pagos de Deudas:</span>
							<span className="font-semibold text-amber-500">-{totalMonthlyDebtPayments.toFixed(2)}€</span>
						</div>
						<div className="flex justify-between border-t border-slate-850 pt-2 font-semibold">
							<span className="text-slate-400">Balance Neto:</span>
							<span className={netMonthlyBalance >= 0 ? 'text-indigo-400' : 'text-rose-500'}>
								{netMonthlyBalance.toFixed(2)}€
							</span>
						</div>
						<div className="flex justify-between">
							<span className="text-slate-500">Deudas Registradas:</span>
							<span className="font-semibold text-slate-300">{debts.length}</span>
						</div>
					</div>
				</div>

				{/* Acciones Adicionales */}
				{chatMessages.length > 0 && (
					<div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
						<h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3">Opciones de Conversación</h3>
						<button
							onClick={handleClearChat}
							className="w-full py-2 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/30 hover:border-rose-900/50 text-rose-400 hover:text-rose-350 font-semibold rounded-xl text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
						>
							<Icons.Trash />
							<span>Borrar Historial</span>
						</button>
					</div>
				)}
			</div>

			{/* Ventana de Chat */}
			<div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden lg:h-full h-[550px]">
				{/* Cabecera del Chat */}
				<div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
					<div>
						<h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
							<Icons.Sparkles />
							Asesor Gemini
						</h3>
						<p className="text-[10px] text-slate-500">
							Análisis financiero avanzado en base a tus movimientos y deudas
						</p>
					</div>
					<div className="flex items-center gap-2">
						{chatMessages.length > 0 && (
							<>
								<button
									onClick={handleCopyChatPlaintext}
									className="px-2.5 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
									title="Copiar chat como texto plano"
								>
									<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
										<path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
									</svg>
									<span>{copiedChat ? '¡Copiado!' : 'Copiar Chat'}</span>
								</button>
								<button
									onClick={() => setIsExportPdfModalOpen(true)}
									className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg border border-indigo-500 transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
									title="Descargar conversación como PDF"
								>
									<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
										<path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
									</svg>
									<span>Descargar PDF</span>
								</button>
							</>
						)}
						<span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/25">
							Contexto Activo
						</span>
					</div>
				</div>

				{/* Cuerpo del Chat */}
				{chatMessages.length === 0 ? (
					<div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-4">
						<div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 shadow-md">
							<Icons.Sparkles />
						</div>
						<div>
							<p className="text-sm font-bold text-slate-350">Comienza a planificar tu mes</p>
							<p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
								Pregúntame sobre tu balance del mes, recomendaciones de ahorro, o el impacto de tus deudas y simulaciones.
							</p>
						</div>
						<div className="flex flex-wrap gap-2 justify-center max-w-md pt-2">
							{[
								'¿Cómo está mi salud financiera este mes?',
								'¿Tengo deudas con alto coste de intereses?',
								'¿Cómo puedo recortar gastos comunes?',
								'Analiza la reunificación de deudas propuesta.'
							].map((q) => (
								<button
									key={q}
									onClick={() => {
										setCustomQuestion(q);
										handleAskGemini(q);
									}}
									disabled={aiLoading}
									className="px-3 py-1.5 bg-slate-950 border border-slate-800 hover:border-indigo-500/30 text-slate-300 hover:text-white rounded-lg text-[11px] font-medium transition-all text-left shadow-sm active:scale-95"
								>
									{q}
								</button>
							))}
						</div>
					</div>
				) : (
					<div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/20">
						{chatMessages.map((msg, idx) => (
							<div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
								<div className="flex items-center space-x-1.5 mb-1.5">
									<span className="text-[10px] text-slate-400 font-bold">
										{msg.role === 'user' ? 'Tú' : 'Asesor Gemini'}
									</span>
									<span className="text-[9px] text-slate-650 font-mono">({msg.timestamp})</span>
								</div>
								<div
									className={`p-3.5 rounded-2xl text-sm leading-relaxed max-w-[85%] ${
										msg.role === 'user'
											? 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-600/10'
											: 'bg-slate-900 border border-slate-800 text-slate-355 rounded-tl-none shadow-sm'
									}`}
								>
									{msg.role === 'user' ? (
										<div className="whitespace-pre-wrap">{msg.content}</div>
									) : (
										<MarkdownRenderer text={msg.content} />
									)}
								</div>
							</div>
						))}
						{aiLoading && (
							<div className="flex flex-col items-start">
								<div className="flex items-center space-x-1.5 mb-1.5">
									<span className="text-[10px] text-slate-400 font-bold">Asesor Gemini</span>
									<span className="text-[9px] text-indigo-400 animate-pulse font-medium">escribiendo...</span>
								</div>
								<div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl rounded-tl-none text-sm text-slate-400 shadow-md flex items-center space-x-2">
									<svg className="animate-spin h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24">
										<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
										<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
									<span className="animate-pulse">Analizando flujo de caja...</span>
								</div>
							</div>
						)}
						{aiError && (
							<div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-450 text-xs rounded-xl">
								{aiError}
							</div>
						)}
					</div>
				)}

				{/* Formulario de Input al pie */}
				<form
					onSubmit={(e) => {
						e.preventDefault();
						handleAskGemini(customQuestion);
					}}
					className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2 items-end"
				>
					<textarea
						rows={1}
						value={customQuestion}
						onChange={(e) => setCustomQuestion(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								handleAskGemini(customQuestion);
							}
						}}
						placeholder={geminiApiKey ? "Escribe tu consulta sobre finanzas..." : "Configura tu API Key para empezar"}
						disabled={!geminiApiKey}
						className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none resize-none placeholder:text-slate-650 max-h-24 overflow-y-auto disabled:opacity-40 disabled:cursor-not-allowed"
					/>
					<button
						type="submit"
						disabled={aiLoading || !customQuestion.trim() || !geminiApiKey}
						className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-md shadow-indigo-600/10"
					>
						<Icons.Sparkles />
						<span className="hidden sm:inline">Enviar</span>
					</button>
				</form>
			</div>
		</div>
	);
}
