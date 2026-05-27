import { Resend } from 'resend';

// Vercel inyectará esto si está en las variables de entorno
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { to, subject, html } = req.body;

        if (!to || !subject || !html) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Send email using Resend
        const data = await resend.emails.send({
            from: 'DidactIA <hola@didactia.app>', // El usuario deberá configurar su dominio en Resend después, o usar la dirección por defecto de Resend para pruebas
            to: [to],
            subject: subject,
            html: html,
        });

        return res.status(200).json(data);
    } catch (error) {
        console.error("Resend Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
