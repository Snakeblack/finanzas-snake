import { Peer, type DataConnection } from 'peerjs';
import { bytesToHex, hexToBytes } from '../utils/hexEncoding';

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

export const getPeerConfig = (customIceServers?: RTCIceServer[]) => {
	return {
		config: {
			iceServers: customIceServers && customIceServers.length > 0 ? customIceServers : getDefaultIceServers()
		}
	};
};

export interface SyncData {
	[key: string]: string | null;
}

/**
 * Genera un código alfanumérico de 10 caracteres excluyendo caracteres ambiguos.
 */
export const generateShortCode = (): string => {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	const bytes = new Uint8Array(10);
	window.crypto.getRandomValues(bytes);
	let code = '';
	for (let i = 0; i < 10; i++) {
		code += chars.charAt(bytes[i] % chars.length);
	}
	return code;
};

export interface ISyncDataProvider {
	exportPayload(): Promise<Record<string, unknown>>;
}

export interface HostCallbacks {
	onCodeGenerated: (code: string) => void;
	onConnectionEstablished: () => void;
	onDataSent: () => void;
	onError: (err: unknown) => void;
}

// === ENCRYPTION HELPERS ===
export const hashCode = async (code: string): Promise<string> => {
	const encoder = new TextEncoder();
	const data = encoder.encode(code.trim().toUpperCase());
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

export const deriveKeyFromCode = async (code: string): Promise<CryptoKey> => {
	const encoder = new TextEncoder();
	const data = encoder.encode(code.trim().toUpperCase());
	const hash = await crypto.subtle.digest('SHA-256', data);
	return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
};

export const encryptPayload = async (payload: string, key: CryptoKey): Promise<string> => {
	const encoder = new TextEncoder();
	const data = encoder.encode(payload);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encrypted = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv: iv as BufferSource },
		key,
		data as BufferSource
	);
	const ivHex = bytesToHex(iv);
	const encryptedHex = bytesToHex(new Uint8Array(encrypted));
	return `${ivHex}:${encryptedHex}`;
};

export const decryptPayload = async (encryptedStr: string, key: CryptoKey): Promise<string> => {
	const parts = encryptedStr.split(':');
	if (parts.length !== 2) {
		throw new Error('Formato de datos cifrados no válido.');
	}
	const iv = hexToBytes(parts[0]);
	const encryptedData = hexToBytes(parts[1]);
	const decrypted = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: iv as BufferSource },
		key,
		encryptedData as BufferSource
	);
	const decoder = new TextDecoder();
	return decoder.decode(decrypted);
};

/**
 * Inicia una sesión de envío de datos (Host).
 * Genera un código y espera a que el móvil/receptor se conecte para enviarle los datos.
 */
export const startSyncHost = (
	callbacks: HostCallbacks,
	dataProvider: ISyncDataProvider,
	customIceServers?: RTCIceServer[]
): { destroy: () => void } => {
	let peer: Peer | null = null;
	let code = generateShortCode();
	let retryCount = 0;
	let isDestroyed = false;

	const initPeer = async () => {
		if (isDestroyed) return;

		try {
			// Derivar clave de cifrado a partir del código y calcular hash de PeerJS ID
			const cryptoKey = await deriveKeyFromCode(code);
			const peerHash = await hashCode(code);
			const peerId = `${PEER_PREFIX}${peerHash}`;

			peer = new Peer(peerId, getPeerConfig(customIceServers));

			peer.on('open', () => {
				if (isDestroyed) return;
				// Le notificamos el código de 10 caracteres legible para el usuario
				callbacks.onCodeGenerated(code);
			});

			peer.on('connection', (conn) => {
				if (isDestroyed) return;
				callbacks.onConnectionEstablished();

				conn.on('open', async () => {
					if (isDestroyed) return;

					try {
						// Recopilar todos los datos locales usando el proveedor inyectado (DIP)
						const backupData = await dataProvider.exportPayload();
						const payloadStr = JSON.stringify(backupData);

						// Cifrar el payload con la clave derivada del código
						const encryptedPayload = await encryptPayload(payloadStr, cryptoKey);

						// Enviar los datos cifrados
						conn.send({
							type: 'FINANZAS_PRO_SYNC_ENC',
							payload: encryptedPayload
						});

						setTimeout(() => {
							if (!isDestroyed) {
								callbacks.onDataSent();
							}
						}, 600);
					} catch (err) {
						callbacks.onError(err);
					}
				});

				conn.on('error', (err) => {
					if (isDestroyed) return;
					callbacks.onError(err);
				});
			});

			peer.on('error', (err) => {
				if (isDestroyed) return;

				const peerErr = err as Error & { type?: string };
				// Si el ID ya existe y no hemos superado el límite de intentos, generamos otro
				if (peerErr.type === 'unavailable-id' && retryCount < 5) {
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
		} catch (err) {
			callbacks.onError(err);
		}
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
	onError: (err: unknown) => void;
}

/**
 * Conecta a una sesión de envío utilizando el código provisto para recibir los datos.
 */
export const connectToSyncHost = (
	code: string,
	callbacks: ClientCallbacks,
	customIceServers?: RTCIceServer[]
): { destroy: () => void } => {
	let peer: Peer | null = null;
	let conn: DataConnection | null = null;
	let isDestroyed = false;

	const initClient = async () => {
		if (isDestroyed) return;

		try {
			const cryptoKey = await deriveKeyFromCode(code);
			const peerHash = await hashCode(code);
			const targetPeerId = `${PEER_PREFIX}${peerHash}`;

			peer = new Peer(undefined, getPeerConfig(customIceServers));

			peer.on('open', () => {
				if (isDestroyed || !peer) return;
				conn = peer.connect(targetPeerId);

				conn.on('open', () => {
					if (isDestroyed) return;
					callbacks.onConnected();
				});

				conn.on('data', async (data: unknown) => {
					if (isDestroyed) return;
					const packet = data as { type?: string; payload?: string };
					if (packet && packet.type === 'FINANZAS_PRO_SYNC_ENC' && typeof packet.payload === 'string') {
						try {
							const decryptedJson = await decryptPayload(packet.payload, cryptoKey);
							const decryptedPayload = JSON.parse(decryptedJson) as SyncData;
							callbacks.onDataReceived(decryptedPayload);
						} catch {
							callbacks.onError(
								new Error(
									'No se pudo descifrar el paquete de datos. Código inválido o datos corruptos.'
								)
							);
						}
					} else {
						callbacks.onError(new Error('Formato de datos recibido no válido o no cifrado.'));
					}
				});

				conn.on('error', (err) => {
					if (isDestroyed) return;
					callbacks.onError(err);
				});
			});

			peer.on('error', (err) => {
				if (isDestroyed) return;
				callbacks.onError(err);
			});
		} catch (err) {
			callbacks.onError(err);
		}
	};

	initClient();

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
