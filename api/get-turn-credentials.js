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
		return res.status(200).json({
			error: "Variables no configuradas en el entorno",
			apiKeyPresent: !!apiKey,
			appNamePresent: !!appName,
			envKeys: Object.keys(process.env).filter(k => k.includes('METERED'))
		});
	}

	try {
		const response = await fetch(
			`https://${appName}.metered.ca/api/v1/turn/credentials?apiKey=${apiKey}`,
			{ signal: AbortSignal.timeout(3000) }
		);

		if (!response.ok) {
			return res.status(200).json({
				error: `Http error from Metered: ${response.status} ${response.statusText}`,
				appName,
				responseStatus: response.status
			});
		}

		const iceServers = await response.json();

		const fullIceServers = [
			{ urls: 'stun:stun.l.google.com:19302' },
			{ urls: 'stun:global.stun.twilio.com:3478' },
			...iceServers
		];

		return res.status(200).json(fullIceServers);
	} catch (error) {
		return res.status(200).json({
			error: "Excepción capturada",
			message: error.message,
			stack: error.stack
		});
	}
}
