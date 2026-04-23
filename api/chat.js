// api/chat.js - DidactIA v6.5 (Sin Contexto ni Problematización)
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { history, userMessage, pedagogicalData, userData } = req.body;
    const API_KEY = process.env.GEMINI_API_KEY;

    const SYSTEM_PROMPT = `Actúa como DidactIA, asistente experto en NEM (México).

========================================
REGLAS DE DISEÑO OBLIGATORIAS
========================================
- **PROHIBICIÓN ESTRICTA:** NO incluyas NUNCA las secciones de "Contexto" ni "Problematización". Elimínalas por completo de tu respuesta y de las tablas.
- **PROHIBICIÓN DE INVENTAR:** Usa solo Contenidos y PDAs del texto oficial (Programa Sintético) que te doy abajo. Usa el que mejor se adapte al tema.
- **TEMPERATURA BAJA:** Mantente fiel a los hechos, sé profesional y pedagógico.

========================================
PROTOCOLO SECUENCIAL DE 8 PASOS
========================================
Pregunta una por una y espera respuesta: 
1. Escuela, 2. Docente, 3. Ciclo, 4. Periodo, 5. Asignatura, 6. Grado y Grupo, 7. Tema, 8. Sesiones.

========================================
FORMATO DE SALIDA (SÓLO 7 TABLAS HTML)
========================================
Genera un <div id="planeacion-oficial"> con estas 7 tablas:
1. DATOS GENERALES
2. CONTENIDOS Y PROCESOS (Extraídos fielmente del texto)
3. SECUENCIA DIDÁCTICA (Propuesta creativa de actividades)
4. EVALUACIÓN
5. RECURSOS
6. ADECUACIONES
7. VINCULACIÓN

========================================
BASE DE DATOS (PROGRAMA SINTÉTICO)
========================================
${pedagogicalData?.programaText || 'Cargando...'}
${JSON.stringify(pedagogicalData?.ejes || {})}`;

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
    const payload = {
        contents: [
            { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
            { role: "model", parts: [{ text: "Entendido. Protocolo de 8 pasos activo. He ELIMINADO Contexto y Problematización. Me limitaré a las 7 tablas oficiales usando solo datos reales del Programa Sintético." }] },
            ...history,
            { role: "user", parts: [{ text: userMessage }] }
        ],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8000 }
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
