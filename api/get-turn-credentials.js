export default async function handler(req, res) {
	// Habilitar CORS básico
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

	// Responder a peticiones OPTIONS (CORS preflight)
	if (req.method === 'OPTIONS') {
		return res.status(200).end();
	}

	// Deshabilitar caché para evitar credenciales expiradas o fallbacks de error cacheados
	res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

	const apiKey = process.env.METERED_SECRET_KEY;
	const appName = process.env.METERED_APP_NAME;

	if (!apiKey || !appName) {
		console.warn("Falta configurar METERED_SECRET_KEY o METERED_APP_NAME en Vercel. Usando fallback local.");
		return res.status(200).json([]);
	}

	try {
		const response = await fetch(
			`https://${appName}.metered.ca/api/v1/turn/credentials?apiKey=${apiKey}`,
			{ signal: AbortSignal.timeout(3000) }
		);

		if (!response.ok) {
			throw new Error(`Error de Metered.ca: ${response.statusText}`);
		}

		const iceServers = await response.json();

		const fullIceServers = [
			{ urls: 'stun:stun.l.google.com:19302' },
			{ urls: 'stun:global.stun.twilio.com:3478' },
			...iceServers
		];

		return res.status(200).json(fullIceServers);
	} catch (error) {
		console.error("Error al obtener credenciales TURN:", error);
		return res.status(200).json([]);
	}
}
