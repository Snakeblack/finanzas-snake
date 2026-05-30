import { Peer } from 'peerjs';

const PEER_PREFIX = 'finpro-';

const getDefaultIceServers = () => {
	const customServers = localStorage.getItem('finanzas_v3_custom_ice_servers');
	if (customServers) {
		try {
			const parsed = JSON.parse(customServers);
			if (Array.isArray(parsed)) {
				return parsed;
			}
		} catch (e) {
			console.error('Error parsing custom iceServers:', e);
		}
	}
	return [
		{ urls: 'stun:stun.l.google.com:19302' },
		{ urls: 'stun:global.stun.twilio.com:3478' },
		{
			urls: [
				'turn:openrelay.metered.ca:80',
				'turn:openrelay.metered.ca:443',
				'turn:openrelay.metered.ca:443?transport=tcp',
				'turns:openrelay.metered.ca:443?transport=tcp',
				'turn:relay.metered.ca:80',
				'turn:relay.metered.ca:443',
				'turn:relay.metered.ca:443?transport=tcp',
				'turns:relay.metered.ca:443?transport=tcp'
			],
			username: 'openrelayproject',
			credential: 'openrelayproject'
		}
	];
};

export const getPeerConfig = (customIceServers?: any[]) => {
	return {
		debug: 3,
		config: {
			iceServers: customIceServers && customIceServers.length > 0
				? customIceServers
				: getDefaultIceServers()
		}
	};
};

export interface SyncData {
	[key: string]: string | null;
}

/**
 * Genera un código alfanumérico corto de 6 caracteres excluyendo caracteres ambiguos.
 */
export const generateShortCode = (): string => {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let code = '';
	for (let i = 0; i < 6; i++) {
		code += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return code;
};

export interface HostCallbacks {
	onCodeGenerated: (code: string) => void;
	onConnectionEstablished: () => void;
	onDataSent: () => void;
	onError: (err: any) => void;
}

/**
 * Inicia una sesión de envío de datos (Host).
 * Genera un código y espera a que el móvil/receptor se conecte para enviarle los datos.
 */
export const startSyncHost = (
	callbacks: HostCallbacks,
	customIceServers?: any[]
): { destroy: () => void } => {
	let peer: Peer | null = null;
	let code = generateShortCode();
	let retryCount = 0;
	let isDestroyed = false;

	const initPeer = () => {
		if (isDestroyed) return;
		
		const peerId = `${PEER_PREFIX}${code}`;
		peer = new Peer(peerId, getPeerConfig(customIceServers));

		peer.on('open', () => {
			if (isDestroyed) return;
			callbacks.onCodeGenerated(code);
		});

		peer.on('connection', (conn) => {
			if (isDestroyed) return;
			callbacks.onConnectionEstablished();

			conn.on('open', () => {
				if (isDestroyed) return;
				
				// Recopilar todos los datos locales
				const backupData: SyncData = {};
				const keysToExport = [
					'finanzas_v3_transactions',
					'finanzas_v3_debts',
					'finanzas_v3_periods',
					'finanzas_v3_accounts',
					'finanzas_v3_userA_name',
					'finanzas_v3_userB_name',
					'finanzas_v2_gemini_key',
					'finanzas_v3_ai_chat',
					'finanzas_v3_password_salt',
					'finanzas_v3_password_check'
				];

				keysToExport.forEach(key => {
					backupData[key] = localStorage.getItem(key);
				});

				// Enviar los datos
				conn.send({
					type: 'FINANZAS_PRO_SYNC',
					payload: backupData
				});

				setTimeout(() => {
					if (!isDestroyed) {
						callbacks.onDataSent();
					}
				}, 600);
			});

			conn.on('error', (err) => {
				if (isDestroyed) return;
				callbacks.onError(err);
			});
		});

		peer.on('error', (err: any) => {
			if (isDestroyed) return;
			
			// Si el ID ya existe y no hemos superado el límite de intentos, generamos otro
			if (err.type === 'unavailable-id' && retryCount < 5) {
				retryCount++;
				code = generateShortCode();
				if (peer) {
					peer.destroy();
				}
				setTimeout(initPeer, 500);
			} else {
				callbacks.onError(err);
			}
		});
	};

	initPeer();

	return {
		destroy: () => {
			isDestroyed = true;
			if (peer) {
				peer.destroy();
			}
		}
	};
};

export interface ClientCallbacks {
	onConnected: () => void;
	onDataReceived: (data: SyncData) => void;
	onError: (err: any) => void;
}

/**
 * Conecta a una sesión de envío utilizando el código provisto para recibir los datos.
 */
export const connectToSyncHost = (
	code: string,
	callbacks: ClientCallbacks,
	customIceServers?: any[]
): { destroy: () => void } => {
	let peer: Peer | null = new Peer(undefined, getPeerConfig(customIceServers));
	let conn: any = null;
	let isDestroyed = false;

	peer.on('open', () => {
		if (isDestroyed || !peer) return;
		const targetPeerId = `${PEER_PREFIX}${code.trim().toUpperCase()}`;
		conn = peer.connect(targetPeerId);

		conn.on('open', () => {
			if (isDestroyed) return;
			callbacks.onConnected();
		});

		conn.on('data', (data: any) => {
			if (isDestroyed) return;
			if (data && data.type === 'FINANZAS_PRO_SYNC') {
				callbacks.onDataReceived(data.payload);
			} else {
				callbacks.onError(new Error('Formato de datos recibido no válido.'));
			}
		});

		conn.on('error', (err: any) => {
			if (isDestroyed) return;
			callbacks.onError(err);
		});
	});

	peer.on('error', (err: any) => {
		if (isDestroyed) return;
		callbacks.onError(err);
	});

	return {
		destroy: () => {
			isDestroyed = true;
			if (conn) {
				conn.close();
			}
			if (peer) {
				peer.destroy();
			}
		}
	};
};
