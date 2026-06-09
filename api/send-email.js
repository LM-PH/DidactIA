import { Resend } from 'resend';
import admin from 'firebase-admin';

const resend = new Resend(process.env.RESEND_API_KEY);

// Inicializar Firebase Admin
try {
    if (!admin.apps.length) {
        const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (serviceAccountStr) {
            const serviceAccount = JSON.parse(serviceAccountStr);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }
    }
} catch (error) {
    console.error("Error al inicializar Firebase Admin en send-email:", error);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No autorizado' });
        }

        const token = authHeader.split('Bearer ')[1];
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(token);
        } catch (e) {
            return res.status(401).json({ error: 'Token de autenticación inválido.' });
        }

        const email = decodedToken.email;
        if (!email) {
            return res.status(400).json({ error: 'El token no contiene un correo electrónico.' });
        }

        const name = decodedToken.name || 'Docente';
        const firstName = name.split(' ')[0];

        const subject = '¡Bienvenido a DidactIA! 🍎';
        const html = `<div style="font-family:sans-serif; padding:20px; text-align:center;">
            <h2>¡Hola, ${firstName}!</h2>
            <p>Te damos la bienvenida a <strong>DidactIA</strong>, tu asistente de planeaciones.</p>
            <p>Hemos añadido <strong>1 crédito de regalo</strong> a tu cuenta para que pruebes nuestra tecnología.</p>
            <p>¡Esperamos que te sea de muchísima utilidad!</p>
            <a href="https://didactia.app" style="display:inline-block; padding:10px 20px; background:#4F46E5; color:white; text-decoration:none; border-radius:5px; margin-top:20px;">Comenzar a planear</a>
        </div>`;

        // Send email using Resend
        const data = await resend.emails.send({
            from: 'DidactIA <hola@didactia.app>',
            to: [email],
            subject: subject,
            html: html,
        });

        return res.status(200).json(data);
    } catch (error) {
        console.error("Resend Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
