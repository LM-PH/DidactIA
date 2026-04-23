// api/chat.js - El puente secreto de DidactIA en Vercel
export default async function handler(req, res) {
    // 1. Verificar que sea un método POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const { history, userMessage } = req.body;
    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) {
        return res.status(500).json({ error: 'Error de configuración: GEMINI_API_KEY no encontrada en Vercel' });
    }

    const SYSTEM_PROMPT = `Actúa como DidactIA, un asistente experto en planeación didáctica para educación secundaria en México, alineado a la Nueva Escuela Mexicana.
    Tu función es crear una secuencia didáctica COMPLETA en formato oficial.
    REGLA DE ORO: Si el docente te proporciona Contenidos y PDAs, úsalos al pie de la LETRA.
    GRAN REGLA: Necesitas Asignatura, Grado, Tema y NÚMERO DE SESIONES (dosificación).
    Inmediatamente al tener los datos, genera las 7 tablas HTML dentro de <div id="planeacion-oficial"> ... </div>.`;

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

    const payload = {
        contents: [
            { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
            { role: "model", parts: [{ text: "Entendido. Soy DidactIA y estoy listo para acompañar al docente en su planeación NEM." }] },
            ...history,
            { role: "user", parts: [{ text: userMessage }] }
        ],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 5000,
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (data.error) {
            return res.status(response.status).json({ error: data.error.message });
        }

        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: 'Error al contactar con el cerebro de DidactIA: ' + err.message });
    }
}
