import type { ChatMessage } from '../types';

/**
 * Convierte un texto Markdown del asesor a texto plano legible: elimina marcadores
 * (negritas, código, encabezados, enlaces) y aplana tablas a columnas separadas por tabs.
 *
 * Función pura: recibe texto y devuelve texto, sin estado ni DOM.
 */
export const stripMarkdown = (text: string): string => {
	let output = text;
	output = output.replace(/```[a-zA-Z]*\n([\s\S]*?)\n```/g, '$1');
	output = output.replace(/```([\s\S]*?)```/g, '$1');
	output = output.replace(/`([^`\n]+)`/g, '$1');
	output = output.replace(/\*\*([^*]+)\*\*/g, '$1');
	output = output.replace(/\*([^*]+)\*/g, '$1');
	output = output.replace(/__([^_]+)__/g, '$1');
	output = output.replace(/_([^_]+)_/g, '$1');
	output = output.replace(/^#{1,6}\s+(.*)$/gm, '$1');
	output = output.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
	output = output.replace(/^\|?\s*:?-+\s*:?\s*(?:\|\s*:?-+\s*:?\s*)*\|?$/gm, '');
	output = output.replace(/^[ \t]*\|(.*)\|[ \t]*$/gm, (_, content) => {
		return content
			.split('|')
			.map((cell: string) => cell.trim())
			.filter((c: string) => c !== '')
			.join('\t');
	});
	output = output.replace(/[ \t]+$/gm, '');
	output = output.replace(/\n{3,}/g, '\n\n');
	return output.trim();
};

/**
 * Serializa el historial de chat a texto plano copiable: cada mensaje con su marca de
 * tiempo, rol y contenido (el del asesor pasado por `stripMarkdown`).
 *
 * Función pura.
 */
export const buildChatPlaintext = (messages: ChatMessage[]): string => {
	return messages
		.map((msg) => {
			const roleName = msg.role === 'user' ? 'Tú' : 'Asesor Gemini';
			const plainContent = msg.role === 'user' ? msg.content : stripMarkdown(msg.content);
			return `[${msg.timestamp}] ${roleName}:\n${plainContent}`;
		})
		.join('\n\n');
};
