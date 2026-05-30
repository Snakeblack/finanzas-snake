import { Fragment, type ReactNode } from 'react';

/**
 * Renderiza código inline envuelto en comillas simples invertidas (`).
 */
function renderInlineCode(text: string, key: string): ReactNode[] {
	const codeParts = text.split(/(`.*?`)/g);
	return codeParts.map((part, cIdx) => {
		if (part.startsWith('`') && part.endsWith('`')) {
			const codeText = part.slice(1, -1);
			return (
				<code key={`${key}-${cIdx}`} className="bg-slate-900 border border-slate-800 text-indigo-300 px-1.5 py-0.5 rounded font-mono text-xs mx-0.5 font-semibold">
					{codeText}
				</code>
			);
		}
		return <span key={`${key}-${cIdx}`}>{part}</span>;
	});
}

/**
 * Renderiza texto en negrita y delega en renderInlineCode para el código inline dentro de él.
 */
function renderInlineMarkdown(text: string): ReactNode[] {
	const boldParts = text.split(/(\*\*.*?\*\*)/g);
	return boldParts.flatMap((part, bIdx) => {
		if (part.startsWith('**') && part.endsWith('**')) {
			const boldText = part.slice(2, -2);
			return renderInlineCode(boldText, `bold-${bIdx}`);
		}
		return renderInlineCode(part, `text-${bIdx}`);
	});
}

interface MarkdownRendererProps {
	text: string;
}

/**
 * Componente principal que procesa un bloque de texto en formato Markdown (soporta negritas, listas ordenadas/desordenadas, encabezados y tablas estructuradas con piping).
 */
export function MarkdownRenderer({ text }: MarkdownRendererProps) {
	const parts = text.split(/(```[\s\S]*?```)/g);

	return (
		<div className="space-y-3 text-left">
			{parts.map((part, index) => {
				if (part.startsWith('```')) {
					const lines = part.split('\n');
					let language = 'text';
					let code = part;
					if (lines[0].startsWith('```')) {
						language = lines[0].replace('```', '').trim() || 'text';
						code = lines.slice(1, -1).join('\n');
					}
					return (
						<pre key={index} className="bg-slate-900 border border-slate-800 p-4 rounded-xl font-mono text-xs overflow-x-auto text-slate-200 my-2">
							{language !== 'text' && <span className="block text-[10px] text-slate-500 uppercase tracking-widest mb-2 font-sans font-bold">{language}</span>}
							<code>{code}</code>
						</pre>
					);
				} else {
					const lines = part.split('\n');
					const renderedElements: ReactNode[] = [];
					let listItems: string[] = [];
					let listType: 'ol' | 'ul' | null = null;

					const flushList = (key: number) => {
						if (listItems.length > 0) {
							if (listType === 'ul') {
								renderedElements.push(
									<ul key={`ul-${key}`} className="list-disc list-inside pl-4 space-y-1.5 my-2 text-slate-350">
										{listItems.map((item, idx) => (
											<li key={idx} className="text-slate-300">{renderInlineMarkdown(item)}</li>
										))}
									</ul>
								);
							} else if (listType === 'ol') {
								renderedElements.push(
									<ol key={`ol-${key}`} className="list-decimal list-inside pl-4 space-y-1.5 my-2 text-slate-350">
										{listItems.map((item, idx) => (
											<li key={idx} className="text-slate-300">{renderInlineMarkdown(item)}</li>
										))}
									</ol>
								);
							}
							listItems = [];
							listType = null;
						}
					};

					const parseTable = (tableLines: string[]): ReactNode => {
						if (tableLines.length < 2) return null;
						
						const splitRow = (l: string) => {
							const parts = l.trim().split('|');
							if (l.trim().startsWith('|')) parts.shift();
							if (l.trim().endsWith('|')) parts.pop();
							return parts.map(p => p.trim());
						};

						const headers = splitRow(tableLines[0]);
						const sepLine = tableLines[1].trim();
						const isSeparator = /^\|?(\s*:?-+\s*:?\s*\|)+\s*:?-+\s*:?\|?$/.test(sepLine);
						
						let rowsStartIndex = 1;
						let alignStyles: Array<Record<string, string>> = [];
						
						if (isSeparator) {
							rowsStartIndex = 2;
							const sepCells = splitRow(tableLines[1]);
							alignStyles = sepCells.map(cell => {
								const trimmed = cell.trim();
								const left = trimmed.startsWith(':');
								const right = trimmed.endsWith(':');
								if (left && right) return { textAlign: 'center' };
								if (right) return { textAlign: 'right' };
								if (left) return { textAlign: 'left' };
								return {};
							});
						}

						const rows = tableLines.slice(rowsStartIndex).map(rowLine => splitRow(rowLine));

						return (
							<div className="overflow-x-auto my-3 border border-slate-800 rounded-xl bg-slate-900/50">
								<table className="min-w-full divide-y divide-slate-800 text-xs">
									<thead className="bg-slate-900 text-slate-350 font-bold uppercase tracking-wider">
										<tr>
											{headers.map((h, idx) => (
												<th 
													key={idx} 
													style={alignStyles[idx] || {}} 
													className="px-4 py-2.5 text-left font-semibold border-r border-slate-800 last:border-r-0"
												>
													{renderInlineMarkdown(h)}
												</th>
											))}
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-850 text-slate-300">
										{rows.map((row, rIdx) => (
											<tr key={rIdx} className="hover:bg-slate-800/30 transition-colors odd:bg-slate-950/20">
												{headers.map((_, cIdx) => {
													const cellValue = row[cIdx] || '';
													return (
														<td 
															key={cIdx} 
															style={alignStyles[cIdx] || {}} 
															className="px-4 py-2 border-r border-slate-850 last:border-r-0"
														>
															{renderInlineMarkdown(cellValue)}
														</td>
													);
												})}
											</tr>
										))}
									</tbody>
								</table>
							</div>
						);
					};

					for (let i = 0; i < lines.length; i++) {
						const line = lines[i];
						const trimmedLine = line.trim();

						if (trimmedLine === '') {
							flushList(i);
							continue;
						}

						if (trimmedLine.startsWith('|')) {
							flushList(i);
							const tableLines = [line];
							while (i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) {
								i++;
								tableLines.push(lines[i]);
							}
							
							const tableNode = parseTable(tableLines);
							if (tableNode) {
								renderedElements.push(tableNode);
							} else {
								tableLines.forEach((tLine, tlIdx) => {
									renderedElements.push(
										<p key={`table-fallback-${i}-${tlIdx}`} className="my-1.5 text-slate-300 leading-relaxed text-sm">
											{renderInlineMarkdown(tLine)}
										</p>
									);
								});
							}
							continue;
						}

						const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
						if (headerMatch) {
							flushList(i);
							const level = headerMatch[1].length;
							const content = headerMatch[2];
							const headerClasses = 
								level === 1 ? 'text-lg font-black text-white mt-3 mb-1.5' :
								level === 2 ? 'text-base font-extrabold text-slate-200 mt-3 mb-1.5' :
								level === 3 ? 'text-sm font-bold text-slate-200 mt-2 mb-1' :
								'text-xs font-bold text-slate-300 mt-2 mb-1';
							
							renderedElements.push(
								level === 1 ? <h3 key={i} className={headerClasses}>{renderInlineMarkdown(content)}</h3> :
								level === 2 ? <h4 key={i} className={headerClasses}>{renderInlineMarkdown(content)}</h4> :
								level === 3 ? <h5 key={i} className={headerClasses}>{renderInlineMarkdown(content)}</h5> :
								<h6 key={i} className={headerClasses}>{renderInlineMarkdown(content)}</h6>
							);
							continue;
						}

						const ulMatch = line.match(/^[\*\-\+]\s+(.*)$/);
						if (ulMatch) {
							if (listType !== 'ul') {
								flushList(i);
								listType = 'ul';
							}
							listItems.push(ulMatch[1]);
							continue;
						}

						const olMatch = line.match(/^\d+\.\s+(.*)$/);
						if (olMatch) {
							if (listType !== 'ol') {
								flushList(i);
								listType = 'ol';
							}
							listItems.push(olMatch[1]);
							continue;
						}

						flushList(i);
						renderedElements.push(
							<p key={i} className="my-1.5 text-slate-300 leading-relaxed text-sm">
								{renderInlineMarkdown(line)}
							</p>
						);
					}
					flushList(lines.length);
					return <Fragment key={index}>{renderedElements}</Fragment>;
				}
			})}
		</div>
	);
}
