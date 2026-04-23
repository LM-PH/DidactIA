// api/chat.js - DidactIA v6.4 (Anti-Alucinaciones y Búsqueda Textual)
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { history, userMessage, pedagogicalData, userData } = req.body;
    const API_KEY = process.env.GEMINI_API_KEY;

    const SYSTEM_PROMPT = `Actúa como DidactIA, asistente experto en NEM (México). 

========================================
REGLA DE ORO: PROHIBIDO INVENTAR (ANTI-ALUCINACIÓN)
========================================
- Es TERMINANTEMENTE PROHIBIDO inventar Contenidos o Procesos de Desarrollo de Aprendizaje (PDA).
- Todo Contenido y PDA que escribas en las tablas DEBE haber sido extraído TEXTUALMENTE de la base de datos "PROGRAMA SINTÉTICO" que te proporciono abajo.
- Si el tema que pide el docente no aparece exactamente, busca el Contenido de la asignatura/grado que más se le relacione, pero usa SÓLO las palabras oficiales del documento.
- Si intentas inventar, la planeación perderá validez oficial. Sé fiel al texto.

========================================
PROTOCOLO SECUENCIAL DE 8 PASOS
========================================
Sigue preguntando uno por uno: 1. Escuela, 2. Docente, 3. Ciclo, 4. Periodo, 5. Asignatura, 6. Grado/Grupo, 7. Tema, 8. Sesiones.

========================================
BASE DE DATOS OFICIAL (PROGRAMA SINTÉTICO FASE 6)
========================================
Usa este texto como tu ÚNICA fuente para Contenidos y PDAs:
${pedagogicalData?.programaText || 'Aviso: La base de datos no cargó. Pide al docente que espere un segundo.'}

Descripciones de Ejes:
${JSON.stringify(pedagogicalData?.ejes || {})}

FORMATO DE SALIDA:
Genera las 7 tablas HTML tradicionales en cuanto tengas los 8 datos.`;

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
    const payload = {
        contents: [
            { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
            { role: "model", parts: [{ text: "Entendido. Aplicaré el protocolo de 8 pasos y usaré EXCLUSIVAMENTE el texto oficial para Contenidos y PDAs. Cero alucinaciones." }] },
            ...history,
            { role: "user", parts: [{ text: userMessage }] }
        ],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8000 } // Temperatura baja para más fidelidad y menos inventiva
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
