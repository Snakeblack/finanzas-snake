import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { ChatMessage } from '../types';
import { STORAGE_KEYS } from '../constants';
import { readGeminiApiKeySync, readAiChatSync, saveGeminiApiKey, saveAiChat } from '../services/storageService';
import {
	buildFinanceDataPrompt,
	askGemini,
	GEMINI_API_KEY_UNAVAILABLE_MESSAGE,
	isGeminiApiKeyError,
	type PromptContextParams
} from '../services/geminiService';
import { decodeHtmlEntities } from '../utils/formatters';
import { buildChatPlaintext } from '../utils/chatPlaintext';

interface UseAiAdvisorParams {
	/** El estado solo persiste cuando la app está inicializada y desbloqueada. */
	isInitialized: boolean;
	isLocked: boolean;
	/**
	 * Obtiene, en el momento de preguntar, el snapshot financiero derivado para construir
	 * el prompt de sistema. Es un thunk porque esos valores viven en el contexto y cambian
	 * en cada render; así el hook no necesita conocer cómo se calculan.
	 */
	getPromptParams: () => PromptContextParams;
}

export interface UseAiAdvisorResult {
	geminiApiKey: string;
	setGeminiApiKey: Dispatch<SetStateAction<string>>;
	customQuestion: string;
	setCustomQuestion: Dispatch<SetStateAction<string>>;
	chatMessages: ChatMessage[];
	setChatMessages: Dispatch<SetStateAction<ChatMessage[]>>;
	aiLoading: boolean;
	aiError: string;
	setAiError: Dispatch<SetStateAction<string>>;
	handleAskGemini: (questionText: string) => Promise<void>;
	handleClearChat: () => void;
	handleCopyChatPlaintext: () => void;
}

/**
 * Encapsula el asesor IA (Gemini): estado del chat y la API Key, su persistencia local
 * y los manejadores de preguntar/limpiar/copiar. Extraído de `FinanzasContext` (D1).
 *
 * El contexto sigue siendo el dueño de la composición: consume este hook y reexpone su
 * resultado por `useFinanzas`, además de usar los setters en lock/unlock/import/reset.
 */
export const useAiAdvisor = ({ isInitialized, isLocked, getPromptParams }: UseAiAdvisorParams): UseAiAdvisorResult => {
	const [geminiApiKey, setGeminiApiKey] = useState(() => readGeminiApiKeySync());
	const [customQuestion, setCustomQuestion] = useState('');
	const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => readAiChatSync());
	const [aiLoading, setAiLoading] = useState(false);
	const [aiError, setAiError] = useState('');

	useEffect(() => {
		if (!isInitialized || isLocked) return;
		saveGeminiApiKey(geminiApiKey);
	}, [geminiApiKey, isInitialized, isLocked]);

	useEffect(() => {
		if (!isInitialized || isLocked) return;
		saveAiChat(chatMessages);
	}, [chatMessages, isInitialized, isLocked]);

	const handleAskGemini = async (questionText: string) => {
		if (!geminiApiKey) {
			setAiError(GEMINI_API_KEY_UNAVAILABLE_MESSAGE);
			return;
		}
		if (!questionText.trim()) return;

		setAiLoading(true);
		setAiError('');

		const userMsg: ChatMessage = {
			role: 'user',
			content: questionText,
			timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
		};
		const updatedMessages = [...chatMessages, userMsg];
		setChatMessages(updatedMessages);
		setCustomQuestion('');

		try {
			const systemPrompt = buildFinanceDataPrompt(getPromptParams());
			const responseText = await askGemini(geminiApiKey, updatedMessages, systemPrompt);
			const cleanedResponse = decodeHtmlEntities(responseText);

			const aiMsg: ChatMessage = {
				role: 'model',
				content: cleanedResponse,
				timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
			};
			setChatMessages((prev) => [...prev, aiMsg]);
		} catch (err: unknown) {
			if (isGeminiApiKeyError(err)) {
				setAiError(GEMINI_API_KEY_UNAVAILABLE_MESSAGE);
				return;
			}

			setAiError(err instanceof Error ? err.message : 'Error de comunicación con Gemini.');
		} finally {
			setAiLoading(false);
		}
	};

	const handleClearChat = () => {
		if (window.confirm('¿Seguro que quieres borrar el historial de la conversación?')) {
			setChatMessages([]);
			localStorage.removeItem(STORAGE_KEYS.aiChat);
		}
	};

	const handleCopyChatPlaintext = () => {
		const text = buildChatPlaintext(chatMessages);

		navigator.clipboard
			.writeText(text)
			.then(() => {
				// Copied successfully. We can manage a temporary visual feedback if needed.
			})
			.catch((err) => {
				console.error('Failed to copy text: ', err);
			});
	};

	return {
		geminiApiKey,
		setGeminiApiKey,
		customQuestion,
		setCustomQuestion,
		chatMessages,
		setChatMessages,
		aiLoading,
		aiError,
		setAiError,
		handleAskGemini,
		handleClearChat,
		handleCopyChatPlaintext
	};
};
