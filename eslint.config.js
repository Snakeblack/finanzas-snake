import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
	{
		ignores: ['dist', 'coverage', 'node_modules', 'api', 'scripts', '*.config.js', '*.config.ts']
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ['**/*.{ts,tsx}'],
		languageOptions: {
			ecmaVersion: 2022,
			globals: { ...globals.browser, ...globals.node }
		},
		plugins: {
			'react-hooks': reactHooks,
			'react-refresh': reactRefresh
		},
		rules: {
			...reactHooks.configs.recommended.rules,
			'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
			// Baseline pragmático sobre código existente: error solo para bugs reales
			// (rules-of-hooks queda en error). El resto avisa y forma el backlog a saldar
			// — ver docs/ARCHITECTURE.md (deuda técnica).
			'react-hooks/set-state-in-effect': 'warn',
			'react-hooks/globals': 'warn',
			'react-hooks/refs': 'warn',
			'preserve-caught-error': 'warn',
			'no-useless-assignment': 'warn',
			'no-useless-escape': 'warn',
			'@typescript-eslint/no-empty-object-type': 'warn',
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
		}
	},
	{
		// Los tests usan globals de Vitest y mocks laxos.
		files: ['**/*.test.{ts,tsx}', 'setupTests.ts'],
		languageOptions: {
			globals: { ...globals.node }
		},
		rules: {
			'@typescript-eslint/no-explicit-any': 'off'
		}
	},
	prettier
);
