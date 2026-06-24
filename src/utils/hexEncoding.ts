/**
 * Conversión entre `Uint8Array` y su representación hexadecimal. Se usa para serializar
 * el salt del PIN en localStorage (no cabe binario) y reconstruirlo al desbloquear.
 *
 * Funciones puras, sin dependencias de crypto ni DOM.
 */

export const bytesToHex = (bytes: Uint8Array): string =>
	Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');

export const hexToBytes = (hex: string): Uint8Array => {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
	}
	return bytes;
};
