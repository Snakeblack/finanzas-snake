import { useState } from 'react';
import { useFinanzas } from '../../hooks/useFinanzas';
import {
	calculateDebtMonthlyPayment,
	calculateClassicDebtInstallment,
	isPaymentPlanDebt,
	getPaymentPlanOverdueAmount,
	getPaymentPlanRemainingAmount,
	getDebtRateLabel
} from '../../services/financeService';
import { normalizeMonth } from '../../utils/dateUtils';

/**
 * Genera marcas de graduación del eje Y legibles y redondeadas.
 */
function calculateNiceTicks(min: number, max: number, maxTicks = 5): number[] {
	const range = max - min;
	if (range === 0) return [min];

	// Encontrar un paso limpio aproximado
	const tempStep = range / (maxTicks - 1);
	const magnitude = 10 ** Math.floor(Math.log10(tempStep));
	const residual = tempStep / magnitude;

	let niceStep: number;
	if (residual < 1.5) {
		niceStep = magnitude * 1;
	} else if (residual < 3) {
		niceStep = magnitude * 2;
	} else if (residual < 7) {
		niceStep = magnitude * 5;
	} else {
		niceStep = magnitude * 10;
	}

	// Ticks alineados al paso limpio
	const startTick = Math.floor(min / niceStep) * niceStep;
	const endTick = Math.ceil(max / niceStep) * niceStep;

	const ticks: number[] = [];
	for (let val = startTick; val <= endTick + 0.1 * niceStep; val += niceStep) {
		ticks.push(Math.round(val * 100) / 100);
	}
	return ticks;
}

/**
 * Componente que renderiza la pestaña de Resumen General (Dashboard).
 * Muestra el gráfico de barras del flujo mensual, desglose por etiquetas,
 * liquidación de cuentas conjuntas y resumen de deudas activas.
 */
export function OverviewTab() {
	const {
		selectedMonth,
		userAName,
		userBName,
		profileCount,
		totalIncomes,
		totalExpenses,
		totalMonthlyDebtPayments,
		netMonthlyBalance,
		tagData,
		maxTagAmount,
		jointPaidByA,
		jointPaidByB,
		netOwed,
		filteredDebts,
		formatAmount,
		projections
	} = useFinanzas();

	// Estado para interactividad del gráfico de cascada
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
	const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

	// Estado para interactividad del gráfico de proyecciones
	const [hoveredProjIndex, setHoveredProjIndex] = useState<number | null>(null);
	const [projTooltipPos, setProjTooltipPos] = useState<{ x: number; y: number } | null>(null);

	// Manejo del hover y movimiento de cursor
	const handleMouseMove = (e: React.MouseEvent, idx: number) => {
		setHoveredIndex(idx);
		const card = document.getElementById('waterfall-card');
		if (card) {
			const cardRect = card.getBoundingClientRect();
			setTooltipPos({
				x: e.clientX - cardRect.left,
				y: e.clientY - cardRect.top
			});
		}
	};

	// Manejo táctil para dispositivos móviles
	const handleTouchStart = (e: React.TouchEvent, idx: number) => {
		const touch = e.touches[0];
		if (!touch) return;
		setHoveredIndex(idx);
		const card = document.getElementById('waterfall-card');
		if (card) {
			const cardRect = card.getBoundingClientRect();
			setTooltipPos({
				x: touch.clientX - cardRect.left,
				y: touch.clientY - cardRect.top
			});
		}
	};

	const handleTouchMove = (e: React.TouchEvent, idx: number) => {
		const touch = e.touches[0];
		if (!touch) return;
		setHoveredIndex(idx);
		const card = document.getElementById('waterfall-card');
		if (card) {
			const cardRect = card.getBoundingClientRect();
			setTooltipPos({
				x: touch.clientX - cardRect.left,
				y: touch.clientY - cardRect.top
			});
		}
	};

	const handleMouseLeave = () => {
		setHoveredIndex(null);
		setTooltipPos(null);
	};

	// Definición de pasos para el Gráfico de Cascada (Waterfall)
	const steps = [
		{
			name: 'Ingresos',
			amount: totalIncomes,
			type: 'inflow' as const,
			start: 0,
			end: totalIncomes,
			colorClass: 'from-emerald-600 to-emerald-400',
			textColor: 'text-emerald-400',
			dotColor: 'bg-emerald-500',
			description: 'Ingresos totales del mes'
		},
		{
			name: profileCount === 1 ? 'Gastos' : 'G. Comunes',
			amount: -totalExpenses,
			type: 'outflow' as const,
			start: totalIncomes,
			end: totalIncomes - totalExpenses,
			colorClass: 'from-rose-600 to-rose-400',
			textColor: 'text-rose-400',
			dotColor: 'bg-rose-500',
			description: profileCount === 1 ? 'Gastos mensuales' : 'Gastos comunes y compartidos'
		},
		{
			name: 'Cuota Deuda',
			amount: -totalMonthlyDebtPayments,
			type: 'outflow' as const,
			start: totalIncomes - totalExpenses,
			end: totalIncomes - totalExpenses - totalMonthlyDebtPayments,
			colorClass: 'from-amber-600 to-amber-400',
			textColor: 'text-amber-400',
			dotColor: 'bg-amber-500',
			description: 'Cuotas de deudas activas'
		},
		{
			name: 'Neto',
			amount: netMonthlyBalance,
			type: 'total' as const,
			start: 0,
			end: netMonthlyBalance,
			colorClass: netMonthlyBalance >= 0 ? 'from-emerald-600 to-emerald-400' : 'from-rose-600 to-rose-400',
			textColor: netMonthlyBalance >= 0 ? 'text-emerald-400' : 'text-rose-400',
			dotColor: netMonthlyBalance >= 0 ? 'bg-emerald-500' : 'bg-rose-500',
			description: 'Balance mensual neto final'
		}
	];

	// Dimensiones del SVG de escritorio
	const width = 600;
	const height = 260;
	const marginTop = 30;
	const marginBottom = 45;
	const marginLeft = 70;
	const marginRight = 20;
	const chartHeight = height - marginTop - marginBottom;
	const chartWidth = width - marginLeft - marginRight;

	// Dimensiones del SVG móvil
	const widthMobile = 350;
	const heightMobile = 280;
	const marginTopMobile = 35;
	const marginBottomMobile = 15;
	const marginLeftMobile = 85;
	const marginRightMobile = 15;
	const chartWidthMobile = widthMobile - marginLeftMobile - marginRightMobile;
	const chartHeightMobile = heightMobile - marginTopMobile - marginBottomMobile;

	// Valores acumulados para calcular el rango del eje Y (o eje X en móvil)
	const cumValues = [0, totalIncomes, totalIncomes - totalExpenses, netMonthlyBalance];
	const minVal = Math.min(...cumValues);
	const maxVal = Math.max(...cumValues);

	// Obtener ticks limpios y dinámicos para el eje de importes
	const rawMin = minVal < 0 ? minVal : 0;
	const rawMax = maxVal;
	const ticks = calculateNiceTicks(rawMin, rawMax, 5);
	const yMin = ticks[0];
	const yMax = ticks[ticks.length - 1];

	// Función para escalar los valores al eje Y del SVG de escritorio
	const getScaleY = (val: number) => {
		const scaleRange = yMax - yMin || 1;
		const ratio = (val - yMin) / scaleRange;
		return marginTop + chartHeight - ratio * chartHeight;
	};

	// Columnas (eje X de escritorio)
	const colWidth = chartWidth / steps.length;
	const barWidth = colWidth * 0.55; // 55% ancho barra, resto espaciado
	const getScaleX = (idx: number) => {
		return marginLeft + idx * colWidth + (colWidth - barWidth) / 2;
	};

	// Función para escalar los valores al eje X del SVG móvil
	const getScaleXMobile = (val: number) => {
		const scaleRange = yMax - yMin || 1;
		const ratio = (val - yMin) / scaleRange;
		return marginLeftMobile + ratio * chartWidthMobile;
	};

	// Filas (eje Y móvil)
	const colHeightMobile = chartHeightMobile / steps.length;
	const barHeightMobile = colHeightMobile * 0.55; // 55% alto de la fila para la barra
	const getScaleYMobile = (idx: number) => {
		return marginTopMobile + idx * colHeightMobile + (colHeightMobile - barHeightMobile) / 2;
	};

	// Obtener ID del gradiente para escritorio
	const getGradientId = (name: string, isPositive: boolean) => {
		if (name === 'Ingresos') return 'url(#gradient-emerald)';
		if (name === 'G. Comunes') return 'url(#gradient-rose)';
		if (name === 'Cuota Deuda') return 'url(#gradient-amber)';
		if (name === 'Neto') return isPositive ? 'url(#gradient-emerald)' : 'url(#gradient-rose)';
		return 'url(#gradient-indigo)';
	};

	// Obtener ID del gradiente para móvil
	const getGradientIdMobile = (name: string, isPositive: boolean) => {
		if (name === 'Ingresos') return 'url(#gradient-emerald-mobile)';
		if (name === 'G. Comunes') return 'url(#gradient-rose-mobile)';
		if (name === 'Cuota Deuda') return 'url(#gradient-amber-mobile)';
		if (name === 'Neto') return isPositive ? 'url(#gradient-emerald-mobile)' : 'url(#gradient-rose-mobile)';
		return 'url(#gradient-indigo-mobile)';
	};

	// Formateador de etiquetas de barra (evita +0€ o -0€)
	const getLabelText = (amount: number) => {
		if (Math.abs(amount) < 0.01) return formatAmount(0, { decimals: 0 });
		return formatAmount(amount, { decimals: 0, showSign: true });
	};

	return (
		<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
			{/* Gráfico SVG de Cascada de Composición */}
			<div id="waterfall-card" className="lg:col-span-7 premium-card rounded-2xl p-6 relative overflow-visible">
				<h3 className="font-heading text-lg font-bold text-slate-100 mb-6">
					Composición del Flujo Mensual en {selectedMonth}
				</h3>

				{/* Vista de Escritorio: Gráfico de Cascada Horizontal */}
				<div className="hidden md:block w-full h-64 relative select-none">
					<svg
						viewBox={`0 0 ${width} ${height}`}
						className="w-full h-full"
						preserveAspectRatio="xMidYMid meet"
					>
						<defs>
							<linearGradient id="gradient-emerald" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor="#34d399" />
								<stop offset="100%" stopColor="#059669" />
							</linearGradient>
							<linearGradient id="gradient-rose" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor="#f87171" />
								<stop offset="100%" stopColor="#e11d48" />
							</linearGradient>
							<linearGradient id="gradient-amber" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor="#fbbf24" />
								<stop offset="100%" stopColor="#d97706" />
							</linearGradient>
						</defs>

						{/* Líneas de cuadrícula y etiquetas del eje Y */}
						{ticks.map((tick, idx) => {
							const y = getScaleY(tick);
							return (
								<g key={idx} className="opacity-75">
									<line
										x1={marginLeft}
										y1={y}
										x2={width - marginRight}
										y2={y}
										stroke="#1e293b"
										strokeWidth={tick === 0 ? 1.5 : 1}
										strokeDasharray={tick === 0 ? '0' : '3 3'}
									/>
									<text
										x={marginLeft - 10}
										y={y + 4}
										textAnchor="end"
										className="fill-slate-400 text-[10px] font-mono font-medium"
									>
										{formatAmount(tick, { decimals: 0 })}
									</text>
								</g>
							);
						})}

						{/* Líneas conectoras de Cascada */}
						{steps.map((step, idx) => {
							// Solo conectamos Ingresos -> G. Comunes, y G. Comunes -> Cuota Deuda.
							if (idx >= steps.length - 2) return null;
							const x1 = getScaleX(idx) + barWidth;
							const y1 = getScaleY(step.end);
							const x2 = getScaleX(idx + 1);
							const y2 = getScaleY(step.end);
							return (
								<line
									key={`connect-${idx}`}
									x1={x1}
									y1={y1}
									x2={x2}
									y2={y2}
									stroke="#475569"
									strokeWidth={1.5}
									strokeDasharray="4 4"
								/>
							);
						})}

						{/* Barras de la Cascada */}
						{steps.map((step, idx) => {
							const x = getScaleX(idx);
							const yStart = getScaleY(step.start);
							const yEnd = getScaleY(step.end);
							const y = Math.min(yStart, yEnd);
							const barHeight = Math.abs(yStart - yEnd);
							const isZero = Math.abs(step.amount) < 0.01;

							const isHovered = hoveredIndex === idx;
							const opacity = isHovered || hoveredIndex === null ? 0.9 : 0.4;
							const isPositiveNet = step.name === 'Neto' ? netMonthlyBalance >= 0 : step.amount >= 0;

							return (
								<g
									key={idx}
									className="cursor-pointer"
									onMouseEnter={(e) => handleMouseMove(e, idx)}
									onMouseMove={(e) => handleMouseMove(e, idx)}
									onMouseLeave={handleMouseLeave}
								>
									{/* Área interactiva invisible */}
									<rect
										x={x - (colWidth - barWidth) / 4}
										y={marginTop}
										width={colWidth * 0.8}
										height={chartHeight}
										fill="transparent"
									/>

									{/* Elemento visual real: rect (con relleno) o line plana (si es 0€) */}
									{isZero ? (
										<line
											x1={x}
											y1={yStart}
											x2={x + barWidth}
											y2={yStart}
											stroke={step.name === 'Cuota Deuda' ? '#f59e0b' : '#64748b'}
											strokeWidth={3}
											strokeLinecap="round"
											className="transition-all duration-300"
											style={{ opacity }}
										/>
									) : (
										<rect
											x={x}
											y={y}
											width={barWidth}
											height={barHeight}
											rx={6}
											ry={6}
											fill={getGradientId(step.name, isPositiveNet)}
											className="transition-all duration-300 hover:brightness-110"
											style={{ opacity }}
										/>
									)}

									{/* Etiqueta de valor encima de la barra o línea */}
									<text
										x={x + barWidth / 2}
										y={y - 8}
										textAnchor="middle"
										fill="currentColor"
										className={`font-semibold text-[10px] md:text-xs transition-all duration-300 ${step.textColor}`}
										style={{ opacity: hoveredIndex === null ? 1.0 : isHovered ? 1.0 : 0.3 }}
									>
										{getLabelText(step.amount)}
									</text>

									{/* Etiqueta de nombre del eje X */}
									<text
										x={x + barWidth / 2}
										y={height - marginBottom + 20}
										textAnchor="middle"
										className="fill-slate-400 text-xs font-semibold"
									>
										{step.name}
									</text>
								</g>
							);
						})}
					</svg>
				</div>

				{/* Vista Móvil: Gráfico de Cascada Vertical */}
				<div className="block md:hidden w-full h-[280px] relative select-none">
					<svg
						viewBox={`0 0 ${widthMobile} ${heightMobile}`}
						className="w-full h-full"
						preserveAspectRatio="xMidYMid meet"
					>
						<defs>
							<linearGradient id="gradient-emerald-mobile" x1="0" y1="0" x2="1" y2="0">
								<stop offset="0%" stopColor="#059669" />
								<stop offset="100%" stopColor="#34d399" />
							</linearGradient>
							<linearGradient id="gradient-rose-mobile" x1="0" y1="0" x2="1" y2="0">
								<stop offset="0%" stopColor="#e11d48" />
								<stop offset="100%" stopColor="#f87171" />
							</linearGradient>
							<linearGradient id="gradient-amber-mobile" x1="0" y1="0" x2="1" y2="0">
								<stop offset="0%" stopColor="#d97706" />
								<stop offset="100%" stopColor="#fbbf24" />
							</linearGradient>
						</defs>

						{/* Líneas de cuadrícula y etiquetas del eje X (Montos) */}
						{ticks.map((tick, idx) => {
							const x = getScaleXMobile(tick);
							return (
								<g key={`grid-mobile-${idx}`} className="opacity-75">
									<line
										x1={x}
										y1={marginTopMobile}
										x2={x}
										y2={marginTopMobile + chartHeightMobile}
										stroke="#1e293b"
										strokeWidth={tick === 0 ? 1.5 : 1}
										strokeDasharray={tick === 0 ? '0' : '3 3'}
									/>
									<text
										x={x}
										y={marginTopMobile - 8}
										textAnchor="middle"
										className="fill-slate-400 text-[10px] font-mono font-medium"
									>
										{formatAmount(tick, { decimals: 0 })}
									</text>
								</g>
							);
						})}

						{/* Líneas conectoras de Cascada en Vertical */}
						{steps.map((step, idx) => {
							if (idx >= steps.length - 2) return null;
							const x = getScaleXMobile(step.end);
							const y1 = getScaleYMobile(idx) + barHeightMobile;
							const y2 = getScaleYMobile(idx + 1);
							return (
								<line
									key={`connect-mobile-${idx}`}
									x1={x}
									y1={y1}
									x2={x}
									y2={y2}
									stroke="#475569"
									strokeWidth={1.5}
									strokeDasharray="4 4"
								/>
							);
						})}

						{/* Barras de la Cascada en Vertical */}
						{steps.map((step, idx) => {
							const y = getScaleYMobile(idx);
							const xStart = getScaleXMobile(step.start);
							const xEnd = getScaleXMobile(step.end);
							const x = Math.min(xStart, xEnd);
							const barWidthMobile = Math.abs(xStart - xEnd);
							const isZero = Math.abs(step.amount) < 0.01;

							const isHovered = hoveredIndex === idx;
							const opacity = isHovered || hoveredIndex === null ? 0.9 : 0.4;
							const isPositiveNet = step.name === 'Neto' ? netMonthlyBalance >= 0 : step.amount >= 0;

							return (
								<g
									key={`bar-mobile-${idx}`}
									className="cursor-pointer"
									onMouseEnter={(e) => handleMouseMove(e, idx)}
									onMouseMove={(e) => handleMouseMove(e, idx)}
									onMouseLeave={handleMouseLeave}
									onTouchStart={(e) => handleTouchStart(e, idx)}
									onTouchMove={(e) => handleTouchMove(e, idx)}
									onTouchEnd={handleMouseLeave}
								>
									{/* Área interactiva invisible (facilita el hover/tap en móvil) */}
									<rect
										x={marginLeftMobile}
										y={y - (colHeightMobile - barHeightMobile) / 4}
										width={chartWidthMobile}
										height={colHeightMobile * 0.8}
										fill="transparent"
									/>

									{/* Elemento visual real: rect (con relleno) o line vertical (si es 0€) */}
									{isZero ? (
										<line
											x1={xStart}
											y1={y}
											x2={xStart}
											y2={y + barHeightMobile}
											stroke={step.name === 'Cuota Deuda' ? '#f59e0b' : '#64748b'}
											strokeWidth={3}
											strokeLinecap="round"
											className="transition-all duration-300"
											style={{ opacity }}
										/>
									) : (
										<rect
											x={x}
											y={y}
											width={barWidthMobile}
											height={barHeightMobile}
											rx={4}
											ry={4}
											fill={getGradientIdMobile(step.name, isPositiveNet)}
											className="transition-all duration-300 hover:brightness-110"
											style={{ opacity }}
										/>
									)}

									{/* Etiqueta de valor encima de la barra o línea */}
									<text
										x={isZero ? xStart : x + barWidthMobile / 2}
										y={y - 4}
										textAnchor="middle"
										fill="currentColor"
										className={`font-semibold text-[10px] transition-all duration-300 ${step.textColor}`}
										style={{ opacity: hoveredIndex === null ? 1.0 : isHovered ? 1.0 : 0.3 }}
									>
										{getLabelText(step.amount)}
									</text>

									{/* Etiqueta de nombre del eje Y (Categorías) a la izquierda */}
									<text
										x={marginLeftMobile - 10}
										y={y + barHeightMobile / 2 + 4}
										textAnchor="end"
										className="fill-slate-400 text-xs font-semibold"
									>
										{step.name}
									</text>
								</g>
							);
						})}
					</svg>
				</div>

				{/* Tooltip Interactivo HTML (Renderizado fuera del contenedor con scroll para evitar cortes y scrollbars) */}
				{hoveredIndex !== null &&
					tooltipPos &&
					(() => {
						let translateX = '-50%';
						const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
						const rightThreshold = isMobile ? 240 : 490;
						if (tooltipPos.x < 110) {
							translateX = '-10%';
						} else if (tooltipPos.x > rightThreshold) {
							translateX = '-90%';
						}

						return (
							<div
								className="absolute bg-slate-950/95 border border-slate-800/80 text-slate-100 rounded-xl p-3 shadow-2xl backdrop-blur-md pointer-events-none transition-all duration-200 z-50 flex flex-col gap-1 w-48 text-xs font-sans animate-in fade-in zoom-in-95 duration-150"
								style={{
									left: `${tooltipPos.x}px`,
									top: `${tooltipPos.y - 15}px`,
									transform: `translate(${translateX}, -100%)`
								}}
							>
								<div className="font-bold flex justify-between items-center text-slate-200">
									<span>{steps[hoveredIndex].name}</span>
									<span className={steps[hoveredIndex].textColor}>
										{getLabelText(steps[hoveredIndex].amount)}
									</span>
								</div>
								<p className="text-[10px] text-slate-400">{steps[hoveredIndex].description}</p>
								{steps[hoveredIndex].name !== 'Ingresos' && totalIncomes > 0 && (
									<div className="text-[10px] text-slate-500 mt-1 border-t border-slate-800/60 pt-1 flex justify-between">
										<span>Proporción:</span>
										<span className="font-mono font-medium text-slate-400">
											{Math.abs((steps[hoveredIndex].amount / totalIncomes) * 100).toFixed(1)}%
										</span>
									</div>
								)}
							</div>
						);
					})()}

				<div className="flex flex-wrap justify-between items-center mt-6 text-xs text-slate-500 gap-4 border-t border-slate-900 pt-4">
					<p>* Escala absoluta del flujo mensual acumulado.</p>
					<div className="flex flex-wrap gap-x-4 gap-y-2">
						{steps.map((step) => (
							<span key={step.name} className="flex items-center">
								<span className={`w-2.5 h-2.5 rounded-full ${step.dotColor} mr-1.5`}></span>
								<span className="text-slate-400 font-medium">{step.name}</span>
							</span>
						))}
					</div>
				</div>
			</div>

			{/* Desglose Acumulado por Etiquetas */}
			<div className="lg:col-span-5 premium-card rounded-2xl p-6 h-fit">
				<h3 className="font-heading text-lg font-bold text-slate-100 mb-6">
					Desglose Acumulado por Etiquetas ({selectedMonth})
				</h3>

				{tagData.length === 0 ? (
					<div className="h-48 flex flex-col items-center justify-center text-slate-500 text-center">
						<p className="text-sm">No hay egresos ni cuotas este mes.</p>
						<p className="text-xs">Usa el menú para añadir datos o cambia de mes.</p>
					</div>
				) : (
					<div className="space-y-4 max-h-[310px] overflow-y-auto pr-2">
						{tagData.map(({ tag, amount }) => {
							const pct = ((amount / (totalExpenses + totalMonthlyDebtPayments)) * 100).toFixed(0);
							return (
								<div key={tag} className="space-y-1">
									<div className="flex justify-between text-xs font-medium text-slate-300">
										<span>{tag}</span>
										<span className="text-slate-400">
											{formatAmount(amount)} ({pct}%)
										</span>
									</div>
									<div className="w-full bg-slate-950/60 h-2.5 rounded-full overflow-hidden border border-white/5">
										<div
											className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full rounded-full transition-all duration-500"
											style={{ width: `${(amount / maxTagAmount) * 100}%` }}
										></div>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Tarjeta: Hacer Cuentas (Liquidación de Gastos Conjuntos) */}
			{profileCount === 2 && (
				<div className="lg:col-span-12 premium-card rounded-2xl p-6">
					<h3 className="font-heading text-lg font-bold text-slate-100 mb-2 flex items-center gap-2">
						<svg
							className="w-5 h-5 text-indigo-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth={2}
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						Cuentas del Mes ({selectedMonth})
					</h3>
					<p className="text-xs text-slate-400 mb-6">
						Desglose de los gastos comunes y quién los ha pagado para cuadrar cuentas a final de mes.
					</p>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						{/* Columna Usuario A */}
						<div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 backdrop-blur-sm shadow-inner transition-all hover:border-indigo-500/20">
							<div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">
								Gastos comunes pagados por
							</div>
							<div className="text-xl font-bold text-slate-200">{userAName}</div>
							<div className="text-2xl font-black text-indigo-400 mt-2">{formatAmount(jointPaidByA)}</div>
							<p className="text-[10px] text-slate-500 mt-1">
								Aportación correspondiente: {formatAmount(jointPaidByA / 2)} por persona
							</p>
						</div>

						{/* Columna Usuario B */}
						<div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 backdrop-blur-sm shadow-inner transition-all hover:border-indigo-500/20">
							<div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">
								Gastos comunes pagados por
							</div>
							<div className="text-xl font-bold text-slate-200">{userBName}</div>
							<div className="text-2xl font-black text-indigo-400 mt-2">{formatAmount(jointPaidByB)}</div>
							<p className="text-[10px] text-slate-500 mt-1">
								Aportación correspondiente: {formatAmount(jointPaidByB / 2)} por persona
							</p>
						</div>

						{/* Columna Liquidación */}
						<div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 backdrop-blur-sm shadow-inner flex flex-col justify-between transition-all hover:border-indigo-500/20">
							<div>
								<div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">
									Estado de Cuentas
								</div>
								{netOwed === 0 ? (
									<div className="text-emerald-400 font-bold text-lg mt-2">¡Cuentas al día!</div>
								) : netOwed > 0 ? (
									<div>
										<div className="text-rose-400 font-bold text-lg mt-1">
											{userBName} debe a {userAName}
										</div>
										<div className="text-3xl font-black text-rose-400 mt-2">
											{formatAmount(netOwed)}
										</div>
									</div>
								) : (
									<div>
										<div className="text-rose-400 font-bold text-lg mt-1">
											{userAName} debe a {userBName}
										</div>
										<div className="text-3xl font-black text-rose-400 mt-2">
											{formatAmount(Math.abs(netOwed))}
										</div>
									</div>
								)}
							</div>
							<p className="text-[10px] text-slate-500 mt-2">
								Calculado en base a gastos compartidos 50/50 donde uno adelanta el pago.
							</p>
						</div>
					</div>
				</div>
			)}

			{/* Tarjeta: Proyección y Evolución de Patrimonio Neto */}
			{projections && projections.length > 0 && (
				<div className="lg:col-span-12 premium-card rounded-2xl p-6 relative overflow-visible" id="projections-card">
					<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
						<div>
							<h3 className="font-heading text-lg font-bold text-slate-100 flex items-center gap-2">
								<svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
									<path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
								</svg>
								Patrimonio Neto y Tendencia a Futuro
							</h3>
							<p className="text-xs text-slate-400 mt-1">
								Histórico de balance contable y proyección predictiva a 12 meses basada en flujos recurrentes y amortizaciones.
							</p>
						</div>
						
						{/* Tarjetas KPI en miniatura */}
						<div className="flex flex-wrap gap-3">
							{(() => {
								const currentProj = projections.find(p => p.month === selectedMonth) || projections[0];
								return (
									<>
										<div className="bg-slate-900/60 border border-slate-800/80 px-3 py-1.5 rounded-lg text-right">
											<span className="text-[10px] text-slate-500 block font-medium">PATRIMONIO NETO ({currentProj.month})</span>
											<span className={`text-sm font-bold font-mono ${currentProj.netWorth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
												{formatAmount(currentProj.netWorth, { forceShow: true })}
											</span>
										</div>
										<div className="bg-slate-900/60 border border-slate-800/80 px-3 py-1.5 rounded-lg text-right">
											<span className="text-[10px] text-slate-500 block font-medium">ACTIVOS TOTALES</span>
											<span className="text-sm font-bold font-mono text-slate-300">
												{formatAmount(currentProj.assets, { forceShow: true })}
											</span>
										</div>
										<div className="bg-slate-900/60 border border-slate-800/80 px-3 py-1.5 rounded-lg text-right">
											<span className="text-[10px] text-slate-500 block font-medium">PASIVOS (DEUDAS)</span>
											<span className="text-sm font-bold font-mono text-rose-400">
												{formatAmount(currentProj.liabilities, { forceShow: true })}
											</span>
										</div>
									</>
								);
							})()}
						</div>
					</div>

					{/* Contenedor del Gráfico SVG */}
					{(() => {
						// Parámetros de dimensiones
						const pWidth = 840;
						const pHeight = 280;
						const pMarginTop = 30;
						const pMarginBottom = 40;
						const pMarginLeft = 75;
						const pMarginRight = 20;
						
						const pChartHeight = pHeight - pMarginTop - pMarginBottom;
						const pChartWidth = pWidth - pMarginLeft - pMarginRight;

						// Extraer valores máximos y mínimos para el eje Y
						const allVals = projections.flatMap(p => [p.assets, p.liabilities, p.netWorth]);
						const maxValProj = Math.max(...allVals, 100);
						const minValProj = Math.min(...allVals, 0);

						const projTicks = calculateNiceTicks(minValProj, maxValProj, 6);
						const projYMin = projTicks[0];
						const projYMax = projTicks[projTicks.length - 1];

						const getProjScaleY = (val: number) => {
							const scaleRange = projYMax - projYMin || 1;
							const ratio = (val - projYMin) / scaleRange;
							return pMarginTop + pChartHeight - ratio * pChartHeight;
						};

						const projColWidth = pChartWidth / projections.length;
						const projBarWidth = Math.max(8, projColWidth * 0.35); // 35% del ancho de columna para cada barra

						const getProjScaleX = (idx: number) => {
							return pMarginLeft + idx * projColWidth + (projColWidth - projBarWidth * 2) / 2;
						};

						// Formateador de meses corto (ej: 2026-07 -> Jul 26)
						const formatShortMonth = (monthStr: string) => {
							const [year, month] = monthStr.split('-');
							const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
							const monthIdx = parseInt(month, 10) - 1;
							return `${monthNames[monthIdx]} ${year.substring(2)}`;
						};

						// Generar la cadena de puntos para el trazado de la línea de Patrimonio Neto
						const linePoints = projections.map((p, idx) => {
							const x = getProjScaleX(idx) + projBarWidth; // centro de las dos barras
							const y = getProjScaleY(p.netWorth);
							return `${x},${y}`;
						}).join(' ');

						const handleProjMouseMove = (e: React.MouseEvent, idx: number) => {
							setHoveredProjIndex(idx);
							const card = document.getElementById('projections-card');
							if (card) {
								const cardRect = card.getBoundingClientRect();
								setProjTooltipPos({
									x: e.clientX - cardRect.left,
									y: e.clientY - cardRect.top
								});
							}
						};

						const handleProjTouchStart = (e: React.TouchEvent, idx: number) => {
							const touch = e.touches[0];
							if (!touch) return;
							setHoveredProjIndex(idx);
							const card = document.getElementById('projections-card');
							if (card) {
								const cardRect = card.getBoundingClientRect();
								setProjTooltipPos({
									x: touch.clientX - cardRect.left,
									y: touch.clientY - cardRect.top
								});
							}
						};

						const handleProjTouchMove = (e: React.TouchEvent, idx: number) => {
							const touch = e.touches[0];
							if (!touch) return;
							setHoveredProjIndex(idx);
							const card = document.getElementById('projections-card');
							if (card) {
								const cardRect = card.getBoundingClientRect();
								setProjTooltipPos({
									x: touch.clientX - cardRect.left,
									y: touch.clientY - cardRect.top
								});
							}
						};

						const handleProjMouseLeave = () => {
							setHoveredProjIndex(null);
							setProjTooltipPos(null);
						};

						return (
							<div className="w-full relative select-none overflow-x-auto">
								<div className="min-w-[800px] h-72">
									<svg viewBox={`0 0 ${pWidth} ${pHeight}`} className="w-full h-full">
										<defs>
											{/* Gradientes para barras de activos */}
											<linearGradient id="gradient-assets-real" x1="0" y1="0" x2="0" y2="1">
												<stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
												<stop offset="100%" stopColor="#047857" stopOpacity="0.8" />
											</linearGradient>
											<linearGradient id="gradient-assets-proj" x1="0" y1="0" x2="0" y2="1">
												<stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
												<stop offset="100%" stopColor="#047857" stopOpacity="0.35" />
											</linearGradient>

											{/* Gradientes para barras de pasivos */}
											<linearGradient id="gradient-liabilities-real" x1="0" y1="0" x2="0" y2="1">
												<stop offset="0%" stopColor="#f43f5e" stopOpacity="0.8" />
												<stop offset="100%" stopColor="#be123c" stopOpacity="0.8" />
											</linearGradient>
											<linearGradient id="gradient-liabilities-proj" x1="0" y1="0" x2="0" y2="1">
												<stop offset="0%" stopColor="#f43f5e" stopOpacity="0.35" />
												<stop offset="100%" stopColor="#be123c" stopOpacity="0.35" />
											</linearGradient>
										</defs>

										{/* Líneas de cuadrícula del eje Y */}
										{projTicks.map((tick, idx) => {
											const y = getProjScaleY(tick);
											return (
												<g key={`proj-grid-${idx}`} className="opacity-75">
													<line
														x1={pMarginLeft}
														y1={y}
														x2={pWidth - pMarginRight}
														y2={y}
														stroke="#1e293b"
														strokeWidth={tick === 0 ? 1.5 : 1}
														strokeDasharray={tick === 0 ? '0' : '3 3'}
													/>
													<text
														x={pMarginLeft - 10}
														y={y + 4}
														textAnchor="end"
														className="fill-slate-400 text-[10px] font-mono font-medium"
													>
														{formatAmount(tick, { decimals: 0, forceShow: true })}
													</text>
												</g>
											);
										})}

										{/* Línea divisoria entre Histórico y Proyección */}
										{(() => {
											const firstProjIdx = projections.findIndex(p => p.isProjected);
											if (firstProjIdx === -1) return null;
											const x = getProjScaleX(firstProjIdx) - (projColWidth - projBarWidth * 2) / 2;
											return (
												<g>
													<line
														x1={x}
														y1={pMarginTop}
														x2={x}
														y2={pHeight - pMarginBottom}
														stroke="#6366f1"
														strokeWidth={1.5}
														strokeDasharray="4 4"
														className="opacity-70"
													/>
													<rect
														x={x - 45}
														y={pMarginTop - 15}
														width={90}
														height={16}
														rx={4}
														fill="#1e1b4b"
														stroke="#312e81"
														strokeWidth={1}
													/>
													<text
														x={x}
														y={pMarginTop - 4}
														textAnchor="middle"
														className="fill-indigo-300 text-[8px] uppercase tracking-wider font-bold"
													>
														Proyección →
													</text>
												</g>
											);
										})()}

										{/* Barras de Activos y Pasivos */}
										{projections.map((p, idx) => {
											const xBase = getProjScaleX(idx);
											
											// Activos (verde)
											const yAssets0 = getProjScaleY(0);
											const yAssets = getProjScaleY(p.assets);
											const xAct = xBase;
											const yAct = Math.min(yAssets0, yAssets);
											const hAct = Math.max(1, Math.abs(yAssets0 - yAssets));

											// Pasivos (rojo)
											const yLiab0 = getProjScaleY(0);
											const yLiab = getProjScaleY(p.liabilities);
											const xPas = xBase + projBarWidth;
											const yPas = Math.min(yLiab0, yLiab);
											const hPas = Math.max(1, Math.abs(yLiab0 - yLiab));

											const isHovered = hoveredProjIndex === idx;
											const opacity = isHovered || hoveredProjIndex === null ? 1.0 : 0.4;

											return (
												<g
													key={`proj-bars-${idx}`}
													onMouseEnter={(e) => handleProjMouseMove(e, idx)}
													onMouseMove={(e) => handleProjMouseMove(e, idx)}
													onMouseLeave={handleProjMouseLeave}
													onTouchStart={(e) => handleProjTouchStart(e, idx)}
													onTouchMove={(e) => handleProjTouchMove(e, idx)}
													onTouchEnd={handleProjMouseLeave}
													className="cursor-pointer"
												>
													{/* Área interactiva invisible */}
													<rect
														x={xBase - (projColWidth - projBarWidth * 2) / 4}
														y={pMarginTop}
														width={projColWidth}
														height={pChartHeight}
														fill="transparent"
													/>

													{/* Barra Activos */}
													<rect
														x={xAct}
														y={yAct}
														width={projBarWidth - 2}
														height={hAct}
														rx={2}
														fill={p.isProjected ? 'url(#gradient-assets-proj)' : 'url(#gradient-assets-real)'}
														className="transition-all duration-300"
														style={{ opacity }}
													/>

													{/* Barra Pasivos */}
													<rect
														x={xPas}
														y={yPas}
														width={projBarWidth - 2}
														height={hPas}
														rx={2}
														fill={p.isProjected ? 'url(#gradient-liabilities-proj)' : 'url(#gradient-liabilities-real)'}
														className="transition-all duration-300"
														style={{ opacity }}
													/>

													{/* Nombre de mes */}
													{(idx % 2 === 0 || projections.length < 10) && (
														<text
															x={xBase + projBarWidth}
															y={pHeight - pMarginBottom + 16}
															textAnchor="middle"
															className="fill-slate-500 text-[9px] font-semibold"
														>
															{formatShortMonth(p.month)}
														</text>
													)}
												</g>
											);
										})}

										{/* Trazado del Patrimonio Neto (Área e Hilo de Tendencia) */}
										{/* Hilo de Línea Principal */}
										<path
											d={`M ${linePoints}`}
											fill="none"
											stroke="#a78bfa"
											strokeWidth={3}
											strokeLinecap="round"
											strokeLinejoin="round"
											className="opacity-90 pointer-events-none"
										/>

										{/* Puntos / Marcadores del Patrimonio Neto */}
										{projections.map((p, idx) => {
											const x = getProjScaleX(idx) + projBarWidth;
											const y = getProjScaleY(p.netWorth);
											const isHovered = hoveredProjIndex === idx;

											return (
												<circle
													key={`proj-dot-${idx}`}
													cx={x}
													cy={y}
													r={isHovered ? 6 : 4}
													fill={p.isProjected ? '#6366f1' : '#c084fc'}
													stroke="#1e1b4b"
													strokeWidth={isHovered ? 2 : 1.5}
													className="transition-all duration-300 pointer-events-none"
													style={{
														opacity: hoveredProjIndex === null || isHovered ? 1.0 : 0.5
													}}
												/>
											);
										})}
									</svg>
								</div>

								{/* Tooltip Interactivo */}
								{hoveredProjIndex !== null && projTooltipPos && (
									(() => {
										const pItem = projections[hoveredProjIndex];
										let transX = '-50%';
										if (projTooltipPos.x < 120) {
											transX = '-10%';
										} else if (projTooltipPos.x > 720) {
											transX = '-90%';
										}
										return (
											<div
												className="absolute bg-slate-950/95 border border-slate-800/80 text-slate-100 rounded-xl p-3 shadow-2xl backdrop-blur-md pointer-events-none transition-all duration-200 z-50 flex flex-col gap-1 w-52 text-xs font-sans animate-in fade-in zoom-in-95 duration-150"
												style={{
													left: `${projTooltipPos.x}px`,
													top: `${projTooltipPos.y - 15}px`,
													transform: `translate(${transX}, -100%)`
												}}
											>
												<div className="font-bold flex justify-between items-center text-slate-200 border-b border-slate-800/60 pb-1 mb-1">
													<span>{formatShortMonth(pItem.month)}</span>
													<span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${pItem.isProjected ? 'bg-indigo-500/20 text-indigo-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
														{pItem.isProjected ? 'PROYECCIÓN' : 'REAL'}
													</span>
												</div>
												
												<div className="flex justify-between items-center text-[11px] mt-0.5">
													<span className="text-slate-400 flex items-center gap-1.5">
														<span className="w-2 h-2 rounded-full bg-emerald-500"></span> Activos:
													</span>
													<span className="font-mono font-semibold text-slate-200">
														{formatAmount(pItem.assets, { forceShow: true })}
													</span>
												</div>

												<div className="flex justify-between items-center text-[11px]">
													<span className="text-slate-400 flex items-center gap-1.5">
														<span className="w-2 h-2 rounded-full bg-rose-500"></span> Pasivos:
													</span>
													<span className="font-mono font-semibold text-slate-200 text-rose-300">
														{formatAmount(pItem.liabilities, { forceShow: true })}
													</span>
												</div>

												<div className="flex justify-between items-center text-[11px] font-bold border-t border-slate-800/60 pt-1 mt-1">
													<span className="text-violet-300 flex items-center gap-1.5">
														<span className="w-2 h-2 rounded-full bg-violet-400"></span> Patrimonio:
													</span>
													<span className={`font-mono ${pItem.netWorth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
														{formatAmount(pItem.netWorth, { forceShow: true })}
													</span>
												</div>

												{/* Cambio con respecto al mes anterior */}
												{hoveredProjIndex > 0 && (
													<div className="text-[9px] text-slate-500 mt-1 flex justify-between">
														<span>Var. intermensual:</span>
														{(() => {
															const prevNet = projections[hoveredProjIndex - 1].netWorth;
															const diff = pItem.netWorth - prevNet;
															return (
																<span className={`font-mono font-medium ${diff >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
																	{diff >= 0 ? '+' : ''}{formatAmount(diff, { forceShow: true })}
																</span>
															);
														})()}
													</div>
												)}
											</div>
										);
									})()
								)}
							</div>
						);
					})()}
					
					{/* Leyenda */}
					<div className="flex flex-wrap justify-between items-center mt-4 text-xs text-slate-500 gap-4 border-t border-slate-900 pt-4">
						<p>* Los activos representan los saldos en cuenta acumulados. Los pasivos son el principal de deudas pendientes.</p>
						<div className="flex gap-x-4 gap-y-2">
							<span className="flex items-center">
								<span className="w-3 h-3 rounded bg-emerald-500/70 mr-1.5 border border-emerald-500/30"></span>
								<span className="text-slate-400 font-medium">Activos</span>
							</span>
							<span className="flex items-center">
								<span className="w-3 h-3 rounded bg-rose-500/70 mr-1.5 border border-rose-500/30"></span>
								<span className="text-slate-400 font-medium">Pasivos (Deudas)</span>
							</span>
							<span className="flex items-center">
								<span className="w-2 h-2 rounded-full bg-violet-400 mr-1.5"></span>
								<span className="text-slate-400 font-medium">Patrimonio Neto</span>
							</span>
						</div>
					</div>
				</div>
			)}

			{/* Resumen de Deudas Activas */}
			<div className="lg:col-span-12 premium-card rounded-2xl p-6">
				<h3 className="font-heading text-lg font-bold text-slate-100 mb-4">
					Deudas Activas al Mes {selectedMonth}
				</h3>

				{filteredDebts.length === 0 ? (
					<p className="text-sm text-slate-500">
						No se registran deudas activas iniciadas en o antes de {selectedMonth}.
					</p>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{filteredDebts.map((d) => {
							const cuota = calculateDebtMonthlyPayment(d, selectedMonth);
							const isPlan = isPaymentPlanDebt(d);
							const totalIntereses = isPlan
								? d.fees
								: calculateClassicDebtInstallment(d) * d.termMonths - d.principal;
							const overdueAmount = isPlan ? getPaymentPlanOverdueAmount(d, selectedMonth) : 0;
							return (
								<div
									key={d.id}
									className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 hover:border-indigo-500/30 hover:shadow-[0_0_15px_rgba(99,102,241,0.05)] transition-all duration-300"
								>
									<div className="flex justify-between items-start mb-2">
										<span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded">
											{d.tag}
										</span>
										<span className="text-xs text-slate-500 font-mono">
											{normalizeMonth(d.date)}
										</span>
									</div>
									<h4 className="font-bold text-slate-200 text-sm mb-1">{d.desc}</h4>
									<div className="grid grid-cols-2 gap-2 my-3 text-xs border-y border-slate-800 py-2">
										<div>
											<span className="text-slate-500 block">
												{isPlan ? 'Financiado:' : 'Capital Inicial:'}
											</span>
											<span className="font-semibold text-slate-300">
												{formatAmount(isPlan ? d.financedAmount : d.principal, { decimals: 0 })}
											</span>
										</div>
										<div>
											<span className="text-slate-500 block">
												{isPlan ? 'Comisiones:' : 'Intereses Totales:'}
											</span>
											<span className="font-semibold text-rose-400">
												{formatAmount(totalIntereses)}
											</span>
										</div>
									</div>
									<div className="flex justify-between items-center text-xs mt-2 gap-3">
										<div>
											<span className="text-slate-500 block">
												{isPlan ? 'Tipo / Pendiente:' : 'Plazo / Tipo:'}
											</span>
											<span className="font-semibold text-slate-300">
												{isPlan
													? `Fraccionamiento · ${formatAmount(getPaymentPlanRemainingAmount(d))}`
													: `${d.termMonths}m / ${getDebtRateLabel(d)}`}
											</span>
											{overdueAmount > 0 && (
												<span className="block text-[10px] text-rose-400">
													Vencido: {formatAmount(overdueAmount)}
												</span>
											)}
										</div>
										<div className="text-right">
											<span className="text-slate-500 block">
												{isPlan ? 'Exigible este mes:' : 'Cuota Mensual:'}
											</span>
											<span className="font-bold text-sm text-indigo-400">
												{formatAmount(cuota)}
											</span>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
