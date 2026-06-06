import { ImportedTransaction, Transaction, TransactionType } from '../types';
import { deduceTagFromConcept } from './financeService';
import { askGemini } from './geminiService';
import { DEFAULT_TAGS } from '../constants';

/**
 * Normaliza un importe en formato string a un valor numérico decimal absoluto (string)
 * y deduce su tipo (expense/income) según si es negativo o positivo.
 */
export function normalizeAmount(val: string): { amount: string; type: TransactionType } {
	let clean = val.replace(/[€$\s]/g, '').trim();
	const isNegative = clean.startsWith('-');
	clean = clean.replace(/-|\+/g, '');

	if (clean.includes(',') && clean.includes('.')) {
		const commaIndex = clean.indexOf(',');
		const dotIndex = clean.indexOf('.');
		if (commaIndex > dotIndex) {
			// Formato europeo: 1.234,56
			clean = clean.replace(/\./g, '').replace(',', '.');
		} else {
			// Formato americano: 1,234.56
			clean = clean.replace(/,/g, '');
		}
	} else if (clean.includes(',')) {
		// Formato decimal con coma: 45,20
		clean = clean.replace(',', '.');
	}

	const num = parseFloat(clean);
	if (isNaN(num)) {
		return { amount: '0.00', type: 'expense' };
	}

	return {
		amount: num.toFixed(2),
		type: isNegative ? 'expense' : 'income'
	};
}

/**
 * Normaliza fechas en formatos DD/MM/YYYY o YYYY-MM-DD al estándar YYYY-MM-DD.
 */
export function normalizeDate(val: string): string {
	const clean = val.trim();
	const dmyMatch = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
	if (dmyMatch) {
		const [_, d, m, y] = dmyMatch;
		return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
	}
	const ymdMatch = clean.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
	if (ymdMatch) {
		const [_, y, m, d] = ymdMatch;
		return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
	}
	return new Date().toISOString().substring(0, 10);
}

/**
 * Detecta el separador de columnas del CSV basándose en la primera línea.
 */
export function detectSeparator(text: string): string {
	const firstLine = text.split(/\r?\n/)[0] || '';
	const semicolons = (firstLine.match(/;/g) || []).length;
	const commas = (firstLine.match(/,/g) || []).length;
	const tabs = (firstLine.match(/\t/g) || []).length;

	if (semicolons > commas && semicolons > tabs) return ';';
	if (tabs > semicolons && tabs > commas) return '\t';
	return ',';
}

/**
 * Parsea un texto CSV teniendo en cuenta comillas dobles y saltos de línea dentro de campos.
 */
export function parseCSV(text: string, separator: string = ';'): string[][] {
	const lines: string[][] = [];
	let currentRow: string[] = [];
	let currentField = '';
	let insideQuotes = false;

	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		const nextChar = text[i + 1];

		if (insideQuotes) {
			if (char === '"') {
				if (nextChar === '"') {
					currentField += '"';
					i++;
				} else {
					insideQuotes = false;
				}
			} else {
				currentField += char;
			}
		} else {
			if (char === '"') {
				insideQuotes = true;
			} else if (char === separator) {
				currentRow.push(currentField.trim());
				currentField = '';
			} else if (char === '\r' || char === '\n') {
				currentRow.push(currentField.trim());
				if (currentRow.some((field) => field !== '')) {
					lines.push(currentRow);
				}
				currentRow = [];
				currentField = '';
				if (char === '\r' && nextChar === '\n') {
					i++;
				}
			} else {
				currentField += char;
			}
		}
	}

	if (currentField || currentRow.length > 0) {
		currentRow.push(currentField.trim());
		if (currentRow.some((field) => field !== '')) {
			lines.push(currentRow);
		}
	}

	return lines;
}

/**
 * Plantillas preconfiguradas para los bancos más habituales.
 */
export const BANK_TEMPLATES = {
	bbva: { name: 'BBVA (operaciones)', dateCol: 0, descCol: 2, amountCol: 3, hasHeader: true, separator: ';' },
	santander: { name: 'Santander', dateCol: 0, descCol: 3, amountCol: 5, hasHeader: true, separator: ';' },
	caixabank: { name: 'CaixaBank', dateCol: 0, descCol: 2, amountCol: 3, hasHeader: true, separator: ';' },
	revolut: { name: 'Revolut', dateCol: 2, descCol: 1, amountCol: 3, hasHeader: true, separator: ',' },
	generic: { name: 'Estándar (Fecha, Concepto, Importe)', dateCol: 0, descCol: 1, amountCol: 2, hasHeader: true, separator: ',' }
};

/**
 * Procesa las filas parseadas de un CSV y genera objetos ImportedTransaction.
 */
export function processParsedRows(
	rows: string[][],
	options: { dateCol: number; descCol: number; amountCol: number; hasHeader: boolean }
): ImportedTransaction[] {
	const startIndex = options.hasHeader ? 1 : 0;
	const txs: ImportedTransaction[] = [];

	for (let i = startIndex; i < rows.length; i++) {
		const row = rows[i];
		if (row.length <= Math.max(options.dateCol, options.descCol, options.amountCol)) {
			continue;
		}

		const dateRaw = row[options.dateCol];
		const descRaw = row[options.descCol];
		const amountRaw = row[options.amountCol];

		if (!dateRaw || !descRaw || !amountRaw) continue;

		const date = normalizeDate(dateRaw);
		const { amount, type } = normalizeAmount(amountRaw);
		const desc = descRaw.trim();
		const fallbackTag = type === 'income' ? 'Otros Ingresos' : type === 'transfer' ? 'Otros Traspasos' : 'Otros Gastos';
		const tag = deduceTagFromConcept(desc, type) || fallbackTag;

		txs.push({
			id: `imported-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
			date,
			desc,
			amount,
			type,
			tag,
			selected: true,
			isDuplicate: false,
			owner: 'joint',
			paidBy: 'shared',
			originalType: type
		});
	}

	return txs;
}

/**
 * Identifica posibles duplicaciones comparando fecha, importe y concepto.
 */
export function detectDuplicates(
	importedTxs: ImportedTransaction[],
	existingTxs: Transaction[]
): ImportedTransaction[] {
	return importedTxs.map((imported) => {
		const isDuplicate = existingTxs.some((existing) => {
			const existingAmount = existing.money?.amount ? parseFloat(existing.money.amount) : 0;
			const importedAmount = parseFloat(imported.amount);

			const sameAmount = Math.abs(existingAmount - importedAmount) < 0.001 && existing.type === imported.type;
			const sameDate = existing.date === imported.date;

			const desc1 = existing.desc.toLowerCase().trim();
			const desc2 = imported.desc.toLowerCase().trim();
			let sameDesc = desc1 === desc2 || desc1.includes(desc2) || desc2.includes(desc1);

			if (!sameDesc) {
				const words1 = desc1.split(/[^a-záéíóúüñ0-9]+/i).filter((w) => w.length >= 4);
				const words2 = desc2.split(/[^a-záéíóúüñ0-9]+/i).filter((w) => w.length >= 4);
				if (words1.length > 0 && words2.length > 0) {
					sameDesc = words1.some((w) => words2.includes(w));
				}
			}

			return sameAmount && sameDate && sameDesc;
		});

		return {
			...imported,
			isDuplicate,
			selected: !isDuplicate
		};
	});
}

/**
 * Llama a la API de Gemini para procesar un extracto bancario en texto plano.
 */
export async function askGeminiToParseStatement(
	apiKey: string,
	statementText: string
): Promise<ImportedTransaction[]> {
	const systemInstruction = `
Actúas como un extractor de datos bancarios estructurados en formato JSON. Tu objetivo es procesar el texto de un extracto o movimientos de cuenta bancaria y devolver estrictamente un JSON válido que contiene un array de objetos con las transacciones detectadas.

El JSON de salida debe tener el siguiente formato exacto:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "desc": "Concepto de la transacción",
      "amount": "123.45", 
      "type": "expense" | "income" | "transfer",
      "tag": "Categoría sugerida"
    }
  ]
}

Reglas estrictas:
1. Extrae cada movimiento del texto de entrada.
2. La fecha debe formatearse estrictamente como YYYY-MM-DD. Si no se especifica el año en el texto, asume el año actual (2026).
3. La descripción/concepto debe limpiarse de códigos innecesarios si es posible, dejando un nombre claro (ej. "MERCADONA" en lugar de "MERCADONA S.A. 2043").
4. El importe (amount) debe ser un string con el valor absoluto decimal positivo (ej: "45.20" en lugar de "-45,20"). No incluyas símbolos de moneda (€, $, etc.).
5. El tipo de transacción (type) debe ser:
   - "expense" si es un gasto, cargo, compra, débito, transferencia emitida, etc.
   - "income" si es un ingreso, abono, nómina, Bizum, etc.
   - "transfer" si es un traspaso entre cuentas, hucha, ahorro, etc.
6. La etiqueta (tag) sugerida debe ser una de las categorías estándar de la aplicación:
   - Para gastos (expense): "Alquiler/Hipoteca", "Alimentación", "Transporte", "Suministros", "Ocio/Restauración", "Suscripciones", "Salud/Belleza", "Educación", "Viajes", "Compras/Ropa", "Otros Gastos"
   - Para ingresos (income): "Sueldo", "Inversiones", "Freelance", "Bizum/Regalo", "Reembolso", "Otros Ingresos"
   - Para traspasos (transfer): "Traspaso", "Ahorro/Inversión", "Gasto Común", "Ajuste de Saldo", "Otros Traspasos"
7. Retorna ÚNICAMENTE el bloque JSON. No incluyas texto explicativo, ni bloques de código markdown \`\`\`json ... \`\`\`. Devuelve el JSON puro directamente.
`;

	const chatMessages = [
		{
			role: 'user' as const,
			content: `Procesa este texto y extrae las transacciones:\n\n${statementText}`,
			timestamp: new Date().toISOString()
		}
	];

	const resultText = await askGemini(apiKey, chatMessages, systemInstruction);

	let cleanText = resultText.trim();
	if (cleanText.startsWith('```json')) {
		cleanText = cleanText.substring(7);
	} else if (cleanText.startsWith('```')) {
		cleanText = cleanText.substring(3);
	}
	if (cleanText.endsWith('```')) {
		cleanText = cleanText.substring(0, cleanText.length - 3);
	}
	cleanText = cleanText.trim();

	try {
		const parsed = JSON.parse(cleanText);
		if (!parsed.transactions || !Array.isArray(parsed.transactions)) {
			throw new Error("Formato de respuesta inválido de Gemini: falta la clave 'transactions'");
		}

		return parsed.transactions.map((tx: any, index: number) => {
			const parsedType: TransactionType = tx.type === 'income' ? 'income' : tx.type === 'transfer' ? 'transfer' : 'expense';
			const allowedTags = DEFAULT_TAGS[parsedType] as readonly string[];
			const fallbackTag = parsedType === 'income' ? 'Otros Ingresos' : parsedType === 'transfer' ? 'Otros Traspasos' : 'Otros Gastos';
			const tag = allowedTags.includes(tx.tag) ? tx.tag : fallbackTag;

			return {
				id: `imported-ai-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
				date: normalizeDate(tx.date),
				desc: tx.desc || 'Transacción sin concepto',
				amount: normalizeAmount(tx.amount || '0').amount,
				type: parsedType,
				tag,
				selected: true,
				isDuplicate: false,
				owner: 'joint',
				paidBy: 'shared',
				originalType: parsedType
			};
		});
	} catch (err: any) {
		console.error("Error al parsear el JSON de Gemini:", err, "Texto recibido:", resultText);
		throw new Error(
			"No se pudo procesar el extracto con IA. Asegúrate de que el texto contiene movimientos válidos y que tu API Key es correcta."
		);
	}
}

/**
 * Llama a la API de Gemini para procesar un extracto bancario en formato PDF.
 */
export async function askGeminiToParsePdf(
	apiKey: string,
	pdfBase64: string
): Promise<ImportedTransaction[]> {
	try {
		const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

		const systemInstruction = `
Actúas como un extractor de datos bancarios estructurados en formato JSON. Tu objetivo es procesar el archivo PDF del extracto o movimientos de cuenta bancaria y devolver estrictamente un JSON válido que contiene un array de objetos con las transacciones detectadas.

El JSON de salida debe tener el siguiente formato exacto:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "desc": "Concepto de la transacción",
      "amount": "123.45", 
      "type": "expense" | "income" | "transfer",
      "tag": "Categoría sugerida"
    }
  ]
}

Reglas estrictas:
1. Extrae cada movimiento del archivo PDF.
2. La fecha debe formatearse estrictamente como YYYY-MM-DD. Si no se especifica el año en el documento, asume el año actual (2026).
3. La descripción/concepto debe limpiarse de códigos innecesarios si es posible, dejando un nombre claro (ej. "MERCADONA" en lugar de "MERCADONA S.A. 2043").
4. El importe (amount) debe ser un string con el valor absoluto decimal positivo (ej: "45.20" en lugar de "-45,20"). No incluyas símbolos de moneda (€, $, etc.).
5. El tipo de transacción (type) debe ser:
   - "expense" si es un gasto, cargo, compra, débito, transferencia emitida, etc.
   - "income" si es un ingreso, abono, nómina, Bizum, etc.
   - "transfer" si es un traspaso entre cuentas, hucha, ahorro, etc.
6. La etiqueta (tag) sugerida debe ser una de las categorías estándar de la aplicación:
   - Para gastos (expense): "Alquiler/Hipoteca", "Alimentación", "Transporte", "Suministros", "Ocio/Restauración", "Suscripciones", "Salud/Belleza", "Educación", "Viajes", "Compras/Ropa", "Otros Gastos"
   - Para ingresos (income): "Sueldo", "Inversiones", "Freelance", "Bizum/Regalo", "Reembolso", "Otros Ingresos"
   - Para traspasos (transfer): "Traspaso", "Ahorro/Inversión", "Gasto Común", "Ajuste de Saldo", "Otros Traspasos"
7. Retorna ÚNICAMENTE el bloque JSON. No incluyas texto explicativo, ni bloques de código markdown \`\`\`json ... \`\`\`. Devuelve el JSON puro directamente.
`;

		const payload = {
			contents: [
				{
					role: 'user',
					parts: [
						{
							inlineData: {
								mimeType: 'application/pdf',
								data: pdfBase64
							}
						},
						{
							text: 'Procesa este extracto bancario PDF y extrae todas las transacciones.'
						}
					]
				}
			],
			systemInstruction: {
				parts: [
					{
						text: systemInstruction
					}
				]
			}
		};

		let delay = 1000;
		let resultText = '';

		for (let attempt = 1; attempt <= 5; attempt++) {
			try {
				const response = await fetch(url, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
				if (!response.ok) {
					throw new Error(`Error de comunicación con Gemini (Código HTTP ${response.status})`);
				}
				const data = await response.json();
				resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
				break;
			} catch (error: any) {
				if (attempt === 5) {
					throw new Error(`Error tras 5 intentos al parsear PDF con IA: ${error.message}`);
				}
				await new Promise((resolve) => setTimeout(resolve, delay));
				delay *= 2;
			}
		}

		if (!resultText) {
			throw new Error('No se ha obtenido respuesta de Gemini al procesar el PDF.');
		}

		let cleanText = resultText.trim();
		if (cleanText.startsWith('```json')) {
			cleanText = cleanText.substring(7);
		} else if (cleanText.startsWith('```')) {
			cleanText = cleanText.substring(3);
		}
		if (cleanText.endsWith('```')) {
			cleanText = cleanText.substring(0, cleanText.length - 3);
		}
		cleanText = cleanText.trim();

		const parsed = JSON.parse(cleanText);
		if (!parsed.transactions || !Array.isArray(parsed.transactions)) {
			throw new Error("Formato de respuesta inválido de Gemini: falta la clave 'transactions'");
		}

		return parsed.transactions.map((tx: any, index: number) => {
			const parsedType: TransactionType = tx.type === 'income' ? 'income' : tx.type === 'transfer' ? 'transfer' : 'expense';
			const allowedTags = DEFAULT_TAGS[parsedType] as readonly string[];
			const fallbackTag = parsedType === 'income' ? 'Otros Ingresos' : parsedType === 'transfer' ? 'Otros Traspasos' : 'Otros Gastos';
			const tag = allowedTags.includes(tx.tag) ? tx.tag : fallbackTag;

			return {
				id: `imported-pdf-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
				date: normalizeDate(tx.date),
				desc: tx.desc || 'Transacción sin concepto',
				amount: normalizeAmount(tx.amount || '0').amount,
				type: parsedType,
				tag,
				selected: true,
				isDuplicate: false,
				owner: 'joint',
				paidBy: 'shared',
				originalType: parsedType
			};
		});
	} catch (err: any) {
		console.error("Error al procesar extracto PDF con Gemini:", err);
		throw new Error(
			"No se pudo procesar el extracto PDF con IA. Asegúrate de que el documento es válido y tu API Key es correcta."
		);
	}
}
