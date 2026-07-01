/**
 * Convierte un subconjunto de Markdown (negritas, código inline/bloque, encabezados,
 * listas ordenadas/no ordenadas y tablas) a HTML con estilos inline, pensado para
 * incrustarse en el PDF exportable del asesor.
 *
 * Función pura: no depende de estado de React ni del DOM; recibe texto y devuelve HTML.
 */
export const convertMarkdownToHtml = (text: string): string => {
	const parts = text.split(/(```[\s\S]*?```)/g);

	const renderInlineMarkdownHtml = (inlineText: string): string => {
		let escaped = inlineText
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');

		escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
		escaped = escaped.replace(
			/`(.*?)`/g,
			'<code style="background-color: #f1f5f9; padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 0.9em; color: #4f46e5;">$1</code>'
		);
		return escaped;
	};

	const htmlParts = parts.map((part) => {
		if (part.startsWith('```')) {
			const lines = part.split('\n');
			let language = 'text';
			let code = part;
			if (lines[0].startsWith('```')) {
				language = lines[0].replace('```', '').trim() || 'text';
				code = lines.slice(1, -1).join('\n');
			}
			const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
			return (
				`<pre style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 12px; overflow-x: auto; color: #334155; margin: 8px 0;">` +
				(language !== 'text'
					? `<span style="display: block; font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: bold; margin-bottom: 6px; font-family: sans-serif;">${language}</span>`
					: '') +
				`<code>${escapedCode}</code></pre>`
			);
		} else {
			const lines = part.split('\n');
			const renderedHtml: string[] = [];
			let listItems: string[] = [];
			let listType: 'ol' | 'ul' | null = null;

			const flushListHtml = () => {
				if (listItems.length > 0) {
					if (listType === 'ul') {
						renderedHtml.push(
							`<ul style="list-style-type: disc; padding-left: 20px; margin: 8px 0; color: #334155;">${listItems.map((item) => `<li style="margin-bottom: 4px;">${renderInlineMarkdownHtml(item)}</li>`).join('')}</ul>`
						);
					} else if (listType === 'ol') {
						renderedHtml.push(
							`<ol style="list-style-type: decimal; padding-left: 20px; margin: 8px 0; color: #334155;">${listItems.map((item) => `<li style="margin-bottom: 4px;">${renderInlineMarkdownHtml(item)}</li>`).join('')}</ol>`
						);
					}
					listItems = [];
					listType = null;
				}
			};

			const parseTableHtml = (tableLines: string[]): string => {
				if (tableLines.length < 2) return '';

				const splitRow = (l: string) => {
					const parts = l.trim().split('|');
					if (l.trim().startsWith('|')) parts.shift();
					if (l.trim().endsWith('|')) parts.pop();
					return parts.map((p) => p.trim());
				};

				const headers = splitRow(tableLines[0]);
				const sepLine = tableLines[1].trim();
				const isSeparator = /^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(sepLine);

				let rowsStartIndex = 1;
				let alignStyles: string[] = [];

				if (isSeparator) {
					rowsStartIndex = 2;
					const sepCells = splitRow(tableLines[1]);
					alignStyles = sepCells.map((cell) => {
						const trimmed = cell.trim();
						const left = trimmed.startsWith(':');
						const right = trimmed.endsWith(':');
						if (left && right) return 'text-align: center;';
						if (right) return 'text-align: right;';
						if (left) return 'text-align: left;';
						return '';
					});
				}

				const rows = tableLines.slice(rowsStartIndex).map((rowLine) => splitRow(rowLine));

				let tableHtml = `<div style="overflow-x: auto; margin: 12px 0; border: 1px solid #e2e8f0; border-radius: 8px;"><table style="min-width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">`;
				tableHtml += `<thead style="background-color: #f1f5f9; color: #475569; font-weight: bold; border-bottom: 1px solid #e2e8f0;"><tr>`;
				headers.forEach((h, idx) => {
					const align = alignStyles[idx] || '';
					tableHtml += `<th style="padding: 8px 12px; border-right: 1px solid #e2e8f0; ${align}">${renderInlineMarkdownHtml(h)}</th>`;
				});
				tableHtml += `</tr></thead>`;

				tableHtml += `<tbody style="color: #334155;">`;
				rows.forEach((row, rIdx) => {
					const bg = rIdx % 2 === 0 ? 'background-color: #ffffff;' : 'background-color: #f8fafc;';
					tableHtml += `<tr style="${bg} border-bottom: 1px solid #f1f5f9;">`;
					headers.forEach((_, cIdx) => {
						const cellValue = row[cIdx] || '';
						const align = alignStyles[cIdx] || '';
						tableHtml += `<td style="padding: 6px 12px; border-right: 1px solid #f1f5f9; ${align}">${renderInlineMarkdownHtml(cellValue)}</td>`;
					});
					tableHtml += `</tr>`;
				});
				tableHtml += `</tbody></table></div>`;
				return tableHtml;
			};

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				const trimmedLine = line.trim();

				if (trimmedLine === '') {
					flushListHtml();
					continue;
				}

				if (trimmedLine.startsWith('|')) {
					flushListHtml();
					const tableLines = [line];
					while (i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) {
						i++;
						tableLines.push(lines[i]);
					}
					const tableHtml = parseTableHtml(tableLines);
					if (tableHtml) {
						renderedHtml.push(tableHtml);
					} else {
						tableLines.forEach((tLine) => {
							renderedHtml.push(
								`<p style="margin: 6px 0; color: #334155; line-height: 1.5; font-size: 13px;">${renderInlineMarkdownHtml(tLine)}</p>`
							);
						});
					}
					continue;
				}

				const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
				if (headerMatch) {
					flushListHtml();
					const level = headerMatch[1].length;
					const content = headerMatch[2];
					const fontSize = level === 1 ? '18px' : level === 2 ? '16px' : level === 3 ? '14px' : '12px';
					const margin = '12px 0 6px 0';
					renderedHtml.push(
						`<h${level + 2} style="font-size: ${fontSize}; font-weight: bold; color: #1e293b; margin: ${margin}; font-family: sans-serif;">${renderInlineMarkdownHtml(content)}</h${level + 2}>`
					);
					continue;
				}

				const ulMatch = line.match(/^[*\-+]\s+(.*)$/);
				if (ulMatch) {
					if (listType !== 'ul') {
						flushListHtml();
						listType = 'ul';
					}
					listItems.push(ulMatch[1]);
					continue;
				}

				const olMatch = line.match(/^\d+\.\s+(.*)$/);
				if (olMatch) {
					if (listType !== 'ol') {
						flushListHtml();
						listType = 'ol';
					}
					listItems.push(olMatch[1]);
					continue;
				}

				flushListHtml();
				renderedHtml.push(
					`<p style="margin: 6px 0; color: #334155; line-height: 1.5; font-size: 13px;">${renderInlineMarkdownHtml(line)}</p>`
				);
			}
			flushListHtml();
			return renderedHtml.join('');
		}
	});

	return htmlParts.join('');
};
