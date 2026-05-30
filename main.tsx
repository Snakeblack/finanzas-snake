import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/outfit';
import App from './src/components/App';
import './styles.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
	throw new Error('No se encontró el elemento #root para montar la app.');
}

createRoot(rootElement).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
);
