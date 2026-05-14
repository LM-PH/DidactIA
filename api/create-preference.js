import { MercadoPagoConfig, Preference } from 'mercadopago';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { pkgId, credits, price, uid, email } = req.body;

    if (!uid || !pkgId) {
        return res.status(400).json({ error: 'Faltan datos requeridos (UID o Paquete)' });
    }

    // Configurar Mercado Pago
    const client = new MercadoPagoConfig({ 
        accessToken: process.env.MP_ACCESS_TOKEN 
    });

    const preference = new Preference(client);

    try {
        const body = {
            items: [
                {
                    id: pkgId,
                    title: `Paquete de ${credits} créditos - DidactIA`,
                    quantity: 1,
                    unit_price: Number(price),
                    currency_id: 'MXN',
                }
            ],
            payer: {
                email: email
            },
            back_urls: {
                success: `${req.headers.origin}/?status=success`,
                failure: `${req.headers.origin}/?status=failure`,
                pending: `${req.headers.origin}/?status=pending`,
            },
            auto_return: 'approved',
            external_reference: uid, // Importante para el Webhook
            metadata: {
                uid: uid,
                credits: credits
            },
            notification_url: `https://${req.headers.host}/api/webhook-mercadopago`
        };

        const result = await preference.create({ body });
        
        res.status(200).json({ id: result.id, init_point: result.init_point });
    } catch (error) {
        console.error('Error creating preference:', error);
        res.status(500).json({ error: 'Error al crear la preferencia de pago' });
    }
}
