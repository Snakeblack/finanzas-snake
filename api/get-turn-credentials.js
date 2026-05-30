export default async function handler(req, res) {
	// Habilitar CORS básico
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

	// Responder a peticiones OPTIONS (CORS preflight)
	if (req.method === 'OPTIONS') {
		return res.status(200).end();
	}

	const apiKey = process.env.METERED_SECRET_KEY;
	const appName = process.env.METERED_APP_NAME;

	if (!apiKey || !appName) {
		console.warn("Falta configurar METERED_SECRET_KEY o METERED_APP_NAME en Vercel. Usando fallback local.");
		// Respondemos con un array vacío indicando que se debe usar el fallback del cliente
		return res.status(200).json([]);
	}

	try {
		// Llamamos a la API de Metered.ca para obtener credenciales dinámicas de un solo uso
		const response = await fetch(
			`https://${appName}.metered.ca/api/v1/turn/credentials?apiKey=${apiKey}`,
			{ signal: AbortSignal.timeout(3000) } // Timeout de 3 segundos
		);

		if (!response.ok) {
			throw new Error(`Error de Metered.ca: ${response.statusText}`);
		}

		const iceServers = await response.json();

		// Añadimos STUN públicos básicos redundantes al principio
		const fullIceServers = [
			{ urls: 'stun:stun.l.google.com:19302' },
			{ urls: 'stun:global.stun.twilio.com:3478' },
			...iceServers
		];

		// Cacheamos la respuesta por 1 hora en Vercel Edge para no saturar las llamadas al API de Metered
		res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
		return res.status(200).json(fullIceServers);
	} catch (error) {
		console.error("Error al obtener credenciales TURN:", error);
		// Si falla la API de Metered, devolvemos un array vacío para que el cliente use sus defaults
		return res.status(200).json([]);
	}
}
