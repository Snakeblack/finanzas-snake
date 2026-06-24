import { useContext } from 'react';
import { FinanzasContext, type FinanzasContextType } from '../context/FinanzasContext';

/**
 * Hook personalizado para consumir el contexto global de Finanzas de forma segura.
 * Lanza un error si se utiliza fuera del proveedor correspondiente.
 *
 * @returns El contexto global de Finanzas.
 */
export const useFinanzas = (): FinanzasContextType => {
	const context = useContext(FinanzasContext);
	if (context === undefined) {
		throw new Error('useFinanzas debe ser utilizado dentro de un FinanzasProvider.');
	}
	return context;
};
