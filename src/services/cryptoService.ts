/**
 * Servicio criptográfico que implementa cifrado simétrico AES-GCM (256-bit)
 * y derivación de claves mediante PBKDF2 (SHA-256, 100,000 iteraciones) utilizando
 * la API nativa de Web Cryptography del navegador.
 */

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

/**
 * Convierte un ArrayBuffer o Uint8Array a su representación hexadecimal.
 */
export const bufToHex = (buf: ArrayBuffer | Uint8Array): string => {
	const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
	return Array.from(arr)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
};

/**
 * Convierte una cadena hexadecimal a Uint8Array.
 */
export const hexToBuf = (hex: string): Uint8Array => {
	if (hex.length % 2 !== 0) {
		throw new Error('La longitud hexadecimal debe ser par.');
	}
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
	}
	return bytes;
};

/**
 * Genera un salt criptográfico aleatorio de 16 bytes.
 */
export const generateSalt = (): Uint8Array => {
	return window.crypto.getRandomValues(new Uint8Array(16));
};

/**
 * Deriva una clave criptográfica CryptoKey a partir de una contraseña y un salt usando PBKDF2.
 */
export const deriveKeyFromPassword = async (password: string, salt: Uint8Array): Promise<CryptoKey> => {
	const baseKey = await window.crypto.subtle.importKey(
		'raw',
		ENCODER.encode(password),
		'PBKDF2',
		false,
		['deriveKey']
	);

	return window.crypto.subtle.deriveKey(
		{
			name: 'PBKDF2',
			salt: salt as any,
			iterations: 100000,
			hash: 'SHA-256'
		},
		baseKey,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
};

/**
 * Cifra una cadena de texto en claro usando AES-GCM con una clave CryptoKey.
 * Retorna la cadena en formato "iv_hex:ciphertext_hex".
 */
export const encryptWithKey = async (plaintext: string, key: CryptoKey): Promise<string> => {
	const iv = window.crypto.getRandomValues(new Uint8Array(12));
	const ciphertextBuffer = await window.crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		key,
		ENCODER.encode(plaintext)
	);

	const ivHex = bufToHex(iv);
	const ciphertextHex = bufToHex(ciphertextBuffer);

	return `${ivHex}:${ciphertextHex}`;
};

/**
 * Descifra una cadena cifrada con formato "iv_hex:ciphertext_hex" usando una clave CryptoKey.
 * Retorna la cadena de texto original.
 */
export const decryptWithKey = async (encryptedStr: string, key: CryptoKey): Promise<string> => {
	const parts = encryptedStr.split(':');
	if (parts.length !== 2) {
		throw new Error('Formato cifrado inválido. Se esperaba "iv:ciphertext".');
	}

	const iv = hexToBuf(parts[0]);
	const ciphertext = hexToBuf(parts[1]);

	const decryptedBuffer = await window.crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: iv as any },
		key,
		ciphertext as any
	);

	return DECODER.decode(decryptedBuffer);
};
