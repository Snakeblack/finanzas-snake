/**
 * Categorías y etiquetas predeterminadas para los distintos tipos de movimientos y deudas.
 */
export const DEFAULT_TAGS = {
	income: ['Sueldo', 'Inversiones', 'Freelance', 'Bizum/Regalo', 'Reembolso', 'Otros Ingresos'],
	expense: ['Alquiler/Hipoteca', 'Alimentación', 'Transporte', 'Suministros', 'Ocio/Restauración', 'Suscripciones', 'Salud/Belleza', 'Educación', 'Viajes', 'Compras/Ropa', 'Otros Gastos'],
	transfer: ['Traspaso', 'Ahorro/Inversión', 'Gasto Común', 'Ajuste de Saldo', 'Otros Traspasos'],
	debt: ['Hipoteca', 'Préstamo Coche', 'Tarjeta de Crédito', 'Préstamo Personal', 'Otros Préstamos']
} as const;

/**
 * Claves de almacenamiento utilizadas en LocalStorage para persistir los datos de la app.
 */
export const STORAGE_KEYS = {
	transactions: 'finanzas_v3_transactions',
	debts: 'finanzas_v3_debts',
	periods: 'finanzas_v3_periods',
	geminiKey: 'finanzas_v2_gemini_key',
	aiChat: 'finanzas_v3_ai_chat',
	accounts: 'finanzas_v3_accounts',
	userAName: 'finanzas_v3_userA_name',
	userBName: 'finanzas_v3_userB_name',
	clearedV2: 'finanzas_v3_cleared_v2'
} as const;

/**
 * Claves de datos de versiones anteriores (v2) que requieren limpieza o migración al iniciar la v3.
 */
export const LEGACY_DATA_KEYS = ['finanzas_v2_transactions', 'finanzas_v2_debts'] as const;
