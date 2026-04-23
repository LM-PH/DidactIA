// api/chat.js - DidactIA v6.3 (Protocolo de 8 Pasos Estricto)
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { history, userMessage, pedagogicalData, userData } = req.body;
    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) return res.status(500).json({ error: 'Falta GEMINI_API_KEY en Vercel' });

    const SYSTEM_PROMPT = `Actúa como DidactIA, asistente experto en NEM (México).
    
TU MISIÓN ÚNICA: Recolectar 8 datos obligatorios antes de generar la planeación.
DEBES PREGUNTAR UNO POR UNO, EN ORDEN, Y ESPERAR LA RESPUESTA:

ORDEN DE RECOLECCIÓN:
1. Nombre de la escuela.
2. Nombre del docente.
3. Ciclo escolar actual.
4. Periodo de aplicación (¿A partir de qué fecha?).
5. Asignatura.
6. Grado y Grupo.
7. Tema a trabajar.
8. Número de sesiones (Dosificación).

REGLAS DE ORO:
- NO pidas dos cosas al mismo tiempo (salvo que sea muy fluido).
- NO pidas Contenidos, PDAs ni Ejes Articuladores (Búscalos tú mismo en la base de datos).
- SÓLO cuando tengas el dato #8, genera inmediatamente las 7 tablas HTML dentro de <div id="planeacion-oficial"> ... </div>.

BASE DE DATOS PEDAGÓGICA (PARA TI):
${pedagogicalData?.programaText || 'No disponible'}
${JSON.stringify(pedagogicalData?.ejes || {})}

Si el usuario te intenta saltar pasos, dile amablemente que necesitas completar el registro para que la planeación sea perfecta.`;

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
    const payload = {
        contents: [
            { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
            { role: "model", parts: [{ text: "Hola. Soy DidactIA. Iniciaré el protocolo de 8 pasos para tu planeación NEM. Empecemos: ¿Cuál es el nombre de tu escuela?" }] },
            ...history,
            { role: "user", parts: [{ text: userMessage }] }
        ],
        generationConfig: { temperature: 0.7, maxOutputTokens: 8000 }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
