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

	const apiKey = process.env.METERED_SECRET_KEY ? process.env.METERED_SECRET_KEY.trim() : '';
	const appName = process.env.METERED_APP_NAME ? process.env.METERED_APP_NAME.trim() : '';

	if (!apiKey || !appName) {
		return res.status(200).json({
			error: "Variables no configuradas en el entorno",
			apiKeyPresent: !!apiKey,
			appNamePresent: !!appName,
			envKeys: Object.keys(process.env).filter(k => k.includes('METERED'))
		});
	}

	// Sanitizar el appName por si el usuario copió el dominio completo o con protocolo
	let appNameClean = appName;
	appNameClean = appNameClean.replace(/^https?:\/\//i, '');
	appNameClean = appNameClean.replace(/\.metered\.(ca|live)$/i, '');
	appNameClean = appNameClean.replace(/\/+$/, '');

	// Metered usa el dominio .metered.live (el param en la URL se llama apiKey)
	const targetUrl = `https://${appNameClean}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`;

	try {
		const response = await fetch(
			targetUrl,
			{ signal: AbortSignal.timeout(4000) } // Timeout de 4 segundos
		);

		if (!response.ok) {
			return res.status(200).json({
				error: `Http error from Metered: ${response.status} ${response.statusText}`,
				appName: appNameClean,
				targetUrl: targetUrl.replace(apiKey, '[MASKED]'),
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
			error: "Excepción capturada al hacer fetch",
			message: error.message,
			targetUrl: targetUrl.replace(apiKey, '[MASKED]'),
			stack: error.stack
		});
	}
}
