// api/chat.js - DidactIA v6.2 (Modo Ordenado + Memoria Pedagógica)
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { history, userMessage, pedagogicalData, userData } = req.body;
    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) {
        return res.status(500).json({ error: 'Error de configuración: GEMINI_API_KEY no encontrada' });
    }

    const SYSTEM_PROMPT = `Actúa como DidactIA, un asistente experto en planeación didáctica para educación secundaria en México (NEM).

TU OBJETIVO: Recolectar la información necesaria para generar una planeación profesional sin saturar al docente.

========================================
PROTOCOLO DE RECOLECCIÓN (UNA COSA A LA VEZ)
========================================
Antes de generar la planeación, necesitas estos datos. Si faltan, pidelos AMABLEMENTE Y UNO POR UNO (o en grupos pequeños de 2):
1. Nombre de la Escuela.
2. Nombre del Docente.
3. Ciclo Escolar.
4. Periodo de aplicación (fechas).
5. Asignatura y Grado.
6. Tema y Número de sesiones (Dosificación).

REGLA CRÍTICA: 
- NO preguntes por Contenidos, PDAs ni Ejes Articuladores. TÚ debes buscarlos en la base de datos que te proporciono abajo.
- Una vez que tengas el Tema y las Sesiones, genera la planeación COMPLETA (las 7 tablas HTML) dentro de <div id="planeacion-oficial"> ... </div>.

========================================
BASE DE CONOCIMIENTO (PROGRAMA SINTÉTICO)
========================================
Extrae Contenidos y PDAs TEXTUALES de aquí:
${pedagogicalData?.programaText || 'No disponible'}

Significado de los Ejes:
${JSON.stringify(pedagogicalData?.ejes || {})}

FORMATO OBLIGATORIO DE SALIDA:
Genera 7 tablas HTML (Datos, Contenidos, Secuencia, Evaluación, Recursos, Adecuaciones, Vinculación).`;

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

    const payload = {
        contents: [
            { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
            { role: "model", parts: [{ text: "Hola, soy DidactIA. Estoy listo para ayudarte a planear siguiendo la NEM. Comenzaré solicitando los datos generales de forma ordenada." }] },
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
        if (data.error) return res.status(response.status).json({ error: data.error.message });
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: 'Error: ' + err.message });
    }
}
