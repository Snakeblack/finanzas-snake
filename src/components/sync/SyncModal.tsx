import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useFinanzas } from '../../hooks/useFinanzas';
import { startSyncHost, connectToSyncHost, type SyncData } from '../../services/syncService';
import { Input } from '../ui/input';
import { STORAGE_KEYS } from '../../constants';
import { buildFinanceBackupPayload, importFinanceBackupPayload } from '../../services/storageService';

interface SyncModalProps {
	isOpen: boolean;
	onClose: () => void;
}

type SyncMode = 'select' | 'send' | 'receive';
type SyncStatus = 'idle' | 'connecting' | 'connected' | 'completed' | 'error';

const SYNC_DOMAIN_KEYS = [
	STORAGE_KEYS.transactions,
	STORAGE_KEYS.debts,
	STORAGE_KEYS.periods,
	STORAGE_KEYS.accounts,
	STORAGE_KEYS.userAName,
	STORAGE_KEYS.userBName,
	STORAGE_KEYS.geminiKey,
	STORAGE_KEYS.aiChat
] as const;
const LEGACY_PASSWORD_SYNC_KEYS = ['finanzas_v3_password_salt', 'finanzas_v3_password_check'] as const;
const SYNC_ACCEPTED_KEYS = [...SYNC_DOMAIN_KEYS, ...LEGACY_PASSWORD_SYNC_KEYS] as const;

export function SyncModal({ isOpen, onClose }: SyncModalProps) {
	const {
		userAName,
		setUserAName,
		userBName,
		setUserBName,
		accounts,
		setAccounts,
		transactions,
		setTransactions,
		debts,
		setDebts,
		periods,
		setPeriods,
		geminiApiKey,
		setGeminiApiKey,
		chatMessages,
		setChatMessages,
		setSelectedMonth
	} = useFinanzas();

	const [mode, setMode] = useState<SyncMode>('select');
	const [status, setStatus] = useState<SyncStatus>('idle');
	const [statusText, setStatusText] = useState('');
	const [code, setCode] = useState('');
	const [inputCode, setInputCode] = useState('');
	const [errorMsg, setErrorMsg] = useState('');

	const [showAdvanced, setShowAdvanced] = useState(false);
	const [customIceServersInput, setCustomIceServersInput] = useState(
		() => localStorage.getItem('finanzas_v3_custom_ice_servers') || ''
	);
	const [advancedError, setAdvancedError] = useState('');
	const [advancedSuccess, setAdvancedSuccess] = useState(false);

	const handleSaveAdvanced = () => {
		setAdvancedError('');
		setAdvancedSuccess(false);

		const value = customIceServersInput.trim();
		if (!value) {
			localStorage.removeItem('finanzas_v3_custom_ice_servers');
			setAdvancedSuccess(true);
			setTimeout(() => setAdvancedSuccess(false), 2000);
			return;
		}

		try {
			const parsed = JSON.parse(value);
			if (!Array.isArray(parsed)) {
				throw new Error('La configuración debe ser un array de objetos.');
			}
			localStorage.setItem('finanzas_v3_custom_ice_servers', value);
			setAdvancedSuccess(true);
			setTimeout(() => setAdvancedSuccess(false), 2000);
		} catch (err: any) {
			setAdvancedError(err.message || 'El formato JSON introducido no es válido.');
		}
	};

	const hostSessionRef = useRef<{ destroy: () => void } | null>(null);
	const clientSessionRef = useRef<{ destroy: () => void } | null>(null);
	const handshakeTimeoutRef = useRef<any>(null);

	const clearHandshakeTimeout = () => {
		if (handshakeTimeoutRef.current) {
			clearTimeout(handshakeTimeoutRef.current);
			handshakeTimeoutRef.current = null;
		}
	};

	// Limpieza al cerrar o cambiar de modo
	const cleanSessions = () => {
		clearHandshakeTimeout();
		if (hostSessionRef.current) {
			hostSessionRef.current.destroy();
			hostSessionRef.current = null;
		}
		if (clientSessionRef.current) {
			clientSessionRef.current.destroy();
			clientSessionRef.current = null;
		}
	};

	useEffect(() => {
		if (!isOpen) {
			cleanSessions();
			setMode('select');
			setStatus('idle');
			setStatusText('');
			setCode('');
			setInputCode('');
			setErrorMsg('');
		}
		return () => {
			cleanSessions();
		};
	}, [isOpen]);

	// Obtener credenciales TURN dinámicas desde la API serverless
	const fetchIceServers = async (): Promise<any[] | undefined> => {
		try {
			const res = await fetch(`/api/get-turn-credentials?t=${Date.now()}`, {
				signal: AbortSignal.timeout(3000) // Timeout de 3 segundos para no bloquear
			});
			if (res.ok) {
				const data = await res.json();
				if (Array.isArray(data) && data.length > 0) {
					return data;
				}
			}
		} catch (e) {
			console.warn('No se pudieron obtener credenciales TURN desde la API. Usando fallbacks locales:', e);
		}
		return undefined;
	};

	// Iniciar modo de envío (Host)
	const handleStartHosting = async () => {
		cleanSessions();
		setMode('send');
		setStatus('connecting');
		setStatusText('Obteniendo credenciales de red seguras...');
		setErrorMsg('');

		let resolvedIceServers: any[] | undefined;
		try {
			resolvedIceServers = await fetchIceServers();
		} catch (e) {
			console.warn(e);
		}

		setStatusText('Conectando con el servicio de señalización...');

		try {
			const dataProvider = {
				exportPayload: async () =>
					buildFinanceBackupPayload({
						accounts,
						transactions,
						debts,
						periods,
						userAName,
						userBName,
						geminiApiKey,
						chatMessages
					})
			};

			hostSessionRef.current = startSyncHost(
				{
					onCodeGenerated: (generatedCode) => {
						setCode(generatedCode);
						setStatus('idle');
						setStatusText('Listo. Introduce este código en tu otro dispositivo.');
					},
					onConnectionEstablished: () => {
						setStatus('connected');
						setStatusText('¡Dispositivo conectado! Estableciendo canal seguro...');

						// Iniciamos un timeout de 15 segundos para la negociación WebRTC (direct connection handshake)
						clearHandshakeTimeout();
						handshakeTimeoutRef.current = setTimeout(() => {
							cleanSessions();
							setStatus('error');
							setErrorMsg(
								'No se pudo establecer el canal WebRTC seguro. Verifica que ambos dispositivos estén en la misma red WiFi, sin VPNs activas y que el Firewall no esté bloqueando las conexiones entrantes.'
							);
						}, 15000);
					},
					onDataSent: () => {
						clearHandshakeTimeout();
						setStatus('completed');
						setStatusText('¡Tus datos han sido enviados con éxito!');
					},
					onError: (err) => {
						console.error('Host error:', err);
						clearHandshakeTimeout();
						setStatus('error');
						setErrorMsg(err.message || 'Error al conectar con el servidor de señalización de PeerJS.');
					}
				},
				dataProvider,
				resolvedIceServers
			);
		} catch (err: any) {
			setStatus('error');
			setErrorMsg(err.message || 'Error inesperado al inicializar la conexión.');
		}
	};

	// Conectar al host y recibir datos (Client)
	const handleConnectToHost = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!inputCode.trim() || inputCode.length < 6) {
			setErrorMsg('El código de conexión debe tener 6 caracteres.');
			return;
		}

		cleanSessions();
		setMode('receive');
		setStatus('connecting');
		setStatusText('Obteniendo credenciales de red seguras...');
		setErrorMsg('');

		let resolvedIceServers: any[] | undefined;
		try {
			resolvedIceServers = await fetchIceServers();
		} catch (e) {
			console.warn(e);
		}

		setStatusText('Conectando al dispositivo emisor...');

		// Iniciamos un timeout de 15 segundos para la conexión inicial y negociación WebRTC
		handshakeTimeoutRef.current = setTimeout(() => {
			cleanSessions();
			setStatus('error');
			setErrorMsg(
				'Tiempo de espera agotado. No se pudo conectar al emisor. Asegúrate de estar conectado a la misma red WiFi, sin VPNs activas y de que el código sea correcto.'
			);
		}, 15000);

		try {
			clientSessionRef.current = connectToSyncHost(
				inputCode,
				{
					onConnected: () => {
						setStatus('connected');
						setStatusText('Conectado. Recibiendo datos...');
					},
					onDataReceived: async (data) => {
						clearHandshakeTimeout(); // Sincronización exitosa, limpiamos el timeout!
						setStatusText('Datos recibidos. Procesando e importando...');
						try {
							await processReceivedData(data);
							setStatus('completed');
							setStatusText('¡Sincronización completada! Recargando aplicación...');
							setTimeout(() => {
								window.location.reload();
							}, 1500);
						} catch (err: any) {
							setStatus('error');
							setErrorMsg(err.message || 'Error al validar y guardar la base de datos recibida.');
						}
					},
					onError: (err) => {
						console.error('Client error:', err);
						clearHandshakeTimeout();
						setStatus('error');
						setErrorMsg(
							err.message ||
								'No se pudo conectar. Verifica que el código es correcto y el PC emisor sigue activo.'
						);
					}
				},
				resolvedIceServers
			);
		} catch (err: any) {
			clearHandshakeTimeout();
			setStatus('error');
			setErrorMsg(err.message || 'Error inesperado al intentar conectar.');
		}
	};

	// Procesamiento e importación de la base de datos recibida
	const processReceivedData = async (data: SyncData) => {
		// 1. Validaciones básicas de tipo, longitud y tamaño (Mitigación DoS y Pollution)
		for (const key of SYNC_ACCEPTED_KEYS) {
			const value = data[key];
			if (value !== undefined && value !== null) {
				if (typeof value !== 'string') {
					throw new Error(`El formato del valor para la clave ${key} es inválido.`);
				}
				if (value.length > 2000000) {
					// Límite de 2MB por clave (2 millones de caracteres)
					throw new Error(`El tamaño de los datos de la clave ${key} supera el límite de seguridad de 2MB.`);
				}
			}
		}

		const filteredData: Record<string, unknown> = {};
		SYNC_DOMAIN_KEYS.forEach((key) => {
			if (data[key] !== undefined && data[key] !== null) {
				filteredData[key] = data[key];
			}
		});

		const imported = await importFinanceBackupPayload(filteredData);

		if (imported.userAName !== undefined) {
			setUserAName(imported.userAName);
		}
		if (imported.userBName !== undefined) {
			setUserBName(imported.userBName);
		}
		if (imported.accounts !== undefined) {
			setAccounts(imported.accounts);
		}
		if (imported.transactions !== undefined) {
			setTransactions(imported.transactions);
		}
		if (imported.debts !== undefined) {
			setDebts(imported.debts);
		}
		if (imported.periods !== undefined) {
			setPeriods(imported.periods);
		}
		if (imported.geminiApiKey !== undefined) {
			setGeminiApiKey(imported.geminiApiKey);
		}
		if (imported.chatMessages !== undefined) {
			setChatMessages(imported.chatMessages);
		}
		if (imported.selectedMonth) {
			setSelectedMonth(imported.selectedMonth);
		}
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
			<div
				className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 relative"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Botón de cerrar */}
				<button
					onClick={onClose}
					className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 transition-colors"
					aria-label="Cerrar modal"
				>
					<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
						<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>

				{/* Cabecera común */}
				<div className="text-center">
					<div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
						<svg
							className="w-6 h-6 text-white"
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
					</div>
					<h2 className="text-xl font-bold text-slate-100">Sincronización P2P</h2>
					<p className="text-xs text-slate-400 mt-1">
						Transfiere tus finanzas directamente entre dispositivos sin usar la nube.
					</p>
				</div>

				{/* MODO SELECCIÓN */}
				{mode === 'select' && (
					<div className="space-y-4 pt-2">
						<button
							onClick={handleStartHosting}
							className="w-full flex items-center gap-4 p-4 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-2xl text-left transition-all group"
						>
							<div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl group-hover:bg-indigo-500/20 transition-all">
								<svg
									className="w-6 h-6"
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
							</div>
							<div>
								<span className="font-semibold text-slate-200 block text-sm">
									Enviar datos (desde este dispositivo)
								</span>
								<span className="text-[11px] text-slate-500 block leading-normal mt-0.5">
									Genera un código temporal para compartir los datos de este PC con tu móvil.
								</span>
							</div>
						</button>

						<button
							onClick={() => setMode('receive')}
							className="w-full flex items-center gap-4 p-4 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-2xl text-left transition-all group"
						>
							<div className="p-3 bg-violet-500/10 text-violet-400 rounded-xl group-hover:bg-violet-500/20 transition-all">
								<svg
									className="w-6 h-6"
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
							</div>
							<div>
								<span className="font-semibold text-slate-200 block text-sm">
									Recibir datos (en este dispositivo)
								</span>
								<span className="text-[11px] text-slate-500 block leading-normal mt-0.5">
									Introduce el código del otro dispositivo para descargar y sobreescribir tus datos
									locales.
								</span>
							</div>
						</button>

						{/* AJUSTES AVANZADOS */}
						<div className="pt-2 border-t border-slate-800/60">
							<button
								type="button"
								onClick={() => setShowAdvanced(!showAdvanced)}
								className="w-full flex items-center justify-between py-1 text-slate-400 hover:text-slate-200 transition-colors text-xs font-semibold"
							>
								<span>Ajustes avanzados de red (WebRTC)</span>
								<svg
									className={`w-4 h-4 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`}
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={2}
								>
									<path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
								</svg>
							</button>

							{showAdvanced && (
								<div className="mt-3 space-y-3 bg-slate-950/50 p-4 border border-slate-800/80 rounded-2xl animate-fadeIn">
									<p className="text-[10px] text-slate-400 leading-normal">
										Si la conexión directa falla por el router, regístrate gratis en{' '}
										<a
											href="https://www.metered.ca"
											target="_blank"
											rel="noopener noreferrer"
											className="text-indigo-400 hover:underline"
										>
											Metered.ca
										</a>{' '}
										y pega aquí la lista de <strong>iceServers</strong> (en formato JSON) de tu
										cuenta para forzar la red de relevo:
									</p>
									<textarea
										value={customIceServersInput}
										onChange={(e) => setCustomIceServersInput(e.target.value)}
										placeholder={
											'[\n  {\n    "urls": "turn:relay.metered.ca:443",\n    "username": "...",\n    "credential": "..."\n  }\n]'
										}
										rows={5}
										className="w-full bg-slate-900 border border-slate-850 rounded-xl px-3 py-2 text-[10px] font-mono text-slate-300 focus:border-indigo-500 outline-none resize-none leading-relaxed"
									/>
									{advancedError && (
										<p className="text-[9px] text-rose-400 font-medium">{advancedError}</p>
									)}
									{advancedSuccess && (
										<p className="text-[9px] text-emerald-400 font-medium">
											✓ Ajustes guardados correctamente.
										</p>
									)}
									<button
										type="button"
										onClick={handleSaveAdvanced}
										className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1.5 rounded-lg text-[10px] transition-all"
									>
										Guardar Ajustes
									</button>
								</div>
							)}
						</div>
					</div>
				)}

				{/* MODO ENVÍO (HOST) */}
				{mode === 'send' && (
					<div className="space-y-6 text-center pt-2">
						{status === 'connecting' && (
							<div className="space-y-4">
								<div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
								<p className="text-xs text-slate-400 font-medium">{statusText}</p>
							</div>
						)}

						{status === 'idle' && (
							<div className="space-y-4">
								<p className="text-xs text-slate-400">
									Introduce este código temporal en la opción **"Recibir datos"** de tu móvil/otro
									dispositivo:
								</p>
								<div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 inline-block">
									<span className="text-4xl font-mono font-black tracking-widest text-indigo-400 select-all">
										{code}
									</span>
								</div>
								<p className="text-[10px] text-slate-500 italic">
									Mantén esta pestaña abierta. El envío comenzará de forma automática al conectarse el
									móvil.
								</p>
							</div>
						)}

						{status === 'connected' && (
							<div className="space-y-4">
								<div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
								<p className="text-xs text-indigo-400 font-bold">{statusText}</p>
							</div>
						)}

						{status === 'completed' && (
							<div className="space-y-3">
								<div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
									<svg
										className="w-6 h-6"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										strokeWidth={3}
									>
										<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
									</svg>
								</div>
								<p className="text-sm font-bold text-slate-200">{statusText}</p>
								<button
									onClick={onClose}
									className="mt-2 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all"
								>
									Entendido
								</button>
							</div>
						)}
					</div>
				)}

				{/* MODO RECEPCIÓN (CLIENT) */}
				{mode === 'receive' && (
					<div className="space-y-6 pt-2">
						{status === 'idle' && (
							<form onSubmit={handleConnectToHost} className="space-y-4">
								<div className="space-y-2">
									<label
										htmlFor="sync-code-input"
										className="block text-xs font-medium text-slate-400"
									>
										Código de Conexión (6 letras/números)
									</label>
									<Input
										id="sync-code-input"
										type="text"
										maxLength={6}
										required
										placeholder="EJ: XZYQWE"
										value={inputCode}
										onChange={(e) => setInputCode(e.target.value.toUpperCase().trim())}
										className="py-3 text-lg font-mono font-black text-center text-indigo-300 tracking-widest uppercase"
									/>
								</div>

								<div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-[10px] text-rose-450 leading-relaxed flex gap-2">
									<svg
										className="w-4 h-4 shrink-0 text-rose-500"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										strokeWidth={2.5}
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
										/>
									</svg>
									<span>
										<strong>Atención:</strong> Al conectar e importar, se reemplazarán por completo
										todas tus cuentas, movimientos y deudas de este dispositivo con los del emisor.
									</span>
								</div>

								<div className="flex gap-2 pt-2">
									<button
										type="submit"
										className="w-1/2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all active:scale-95 shadow-md shadow-indigo-600/10"
									>
										Conectar y Sincronizar
									</button>
									<button
										type="button"
										onClick={() => setMode('select')}
										className="w-1/2 bg-slate-850 hover:bg-slate-800 text-slate-300 font-semibold py-2.5 rounded-xl text-xs transition-all"
									>
										Atrás
									</button>
								</div>
							</form>
						)}

						{status === 'connecting' && (
							<div className="space-y-4 text-center">
								<div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
								<p className="text-xs text-slate-400 font-medium">{statusText}</p>
							</div>
						)}

						{status === 'connected' && (
							<div className="space-y-4 text-center">
								<div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
								<p className="text-xs text-indigo-400 font-bold">{statusText}</p>
							</div>
						)}

						{status === 'completed' && (
							<div className="space-y-3 text-center">
								<div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
									<svg
										className="w-6 h-6"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										strokeWidth={3}
									>
										<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
									</svg>
								</div>
								<p className="text-sm font-bold text-slate-200">{statusText}</p>
							</div>
						)}
					</div>
				)}

				{/* MENSAJES DE ERROR */}
				{status === 'error' && (
					<div className="space-y-4 text-center pt-2">
						<div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
							<svg
								className="w-6 h-6"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2.5}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
						</div>
						<div className="space-y-2">
							<p className="text-sm font-bold text-slate-200">Ha ocurrido un error</p>
							<p className="text-xs text-rose-400 leading-relaxed px-2">{errorMsg}</p>
						</div>
						<div className="flex gap-2 pt-2 justify-center">
							<button
								onClick={mode === 'send' ? handleStartHosting : () => setStatus('idle')}
								className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all"
							>
								Reintentar
							</button>
							<button
								onClick={() => setMode('select')}
								className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-350 text-xs font-semibold rounded-xl transition-all"
							>
								Cambiar Modo
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
