import admin from 'firebase-admin';

let db = null;
let firebaseInitError = null;

try {
    // Inicializar Firebase Admin (solo una vez)
    if (!admin.apps.length) {
        const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (serviceAccountStr) {
            const serviceAccount = JSON.parse(serviceAccountStr);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }
    }
    db = admin.apps.length ? admin.firestore() : null;
} catch (error) {
    console.error("Error al inicializar Firebase Admin:", error);
    firebaseInitError = error.message;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    if (firebaseInitError) {
        return res.status(500).json({ error: `Error de configuración del servidor (Firebase): ${firebaseInitError}` });
    }

    const { history, userMessage, pedagogicalData, userData } = req.body;
    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) {
        return res.status(500).json({ error: 'La clave de API (GEMINI_API_KEY) no está configurada.' });
    }

    const uid = userData?.uid;
    if (!uid) return res.status(401).json({ error: 'Usuario no identificado.' });

    // --- VALIDACIÓN DE CRÉDITOS Y LÍMITES ---
    let userDocRef = null;
    let userSnapshot = null;

    if (db) {
        userDocRef = db.collection('usuarios').doc(uid);
        userSnapshot = await userDocRef.get();

        if (userSnapshot.exists) {
            const data = userSnapshot.data();
            const today = new Date().toISOString().split('T')[0];
            
            // Validar Créditos
            if ((data.creditos || 0) <= 0) {
                return res.status(403).json({ 
                    error: 'SIN_CREDITOS', 
                    message: 'Te has quedado sin créditos. Por favor, adquiere más para continuar.' 
                });
            }
        }
    }

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
2. CONTENIDOS Y PROCESOS
3. SECUENCIA DIDÁCTICA
4. EVALUACIÓN
5. RECURSOS
6. ADECUACIONES
7. VINCULACIÓN

========================================
BASE DE DATOS (PROGRAMA SINTÉTICO)
========================================
${pedagogicalData?.programaText || 'Cargando...'}
${JSON.stringify(pedagogicalData?.ejes || {})}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
    const payload = {
        contents: [
            { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
            { role: "model", parts: [{ text: "Entendido. Protocolo de 8 pasos activo. He ELIMINADO Contexto y Problematización." }] },
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
        
        if (!response.ok) return res.status(response.status).json(data);
        
        if (!data.candidates || data.candidates.length === 0) {
            return res.status(500).json({ error: 'La IA no devolvió ninguna respuesta.' });
        }

        const aiText = data.candidates[0].content.parts[0].text;
        const isPlanningGenerated = aiText.includes('id="planeacion-oficial"') || aiText.includes('<table');

        // --- CONSUMO DE CRÉDITO Y GUARDADO AUTOMÁTICO ---
        if (db && isPlanningGenerated) {
            await db.runTransaction(async (t) => {
                const snap = await t.get(userDocRef);
                const userData = snap.exists ? snap.data() : { creditos: 0, totalPlaneaciones: 0 };
                
                const newCredits = (userData.creditos || 0) - 1;
                const totalGenerated = (userData.totalPlaneaciones || 0) + 1;

                // Extraer metadatos básicos de la planeación (búsqueda simple)
                const subjectMatch = aiText.match(/Asignatura:<\/th>\s*<td>(.*?)<\/td>/i);
                const gradeMatch = aiText.match(/Grado y Grupo:<\/th>\s*<td>(.*?)<\/td>/i);
                const topicMatch = aiText.match(/Tema:<\/th>\s*<td>(.*?)<\/td>/i);

                const asignatura = subjectMatch ? subjectMatch[1].trim() : "Sin asignar";
                const grado = gradeMatch ? gradeMatch[1].trim() : "";
                const tema = topicMatch ? topicMatch[1].trim() : "Planeación Didáctica";
                const titulo = `${tema} - ${asignatura} ${grado}`.trim();

                // Actualizar Usuario
                if (snap.exists) {
                    t.update(userDocRef, {
                        creditos: Math.max(0, newCredits),
                        totalPlaneaciones: totalGenerated
                    });
                } else {
                    t.set(userDocRef, {
                        creditos: Math.max(0, newCredits),
                        totalPlaneaciones: totalGenerated,
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }

                // Guardar Planeación
                const planRef = db.collection('planeaciones').doc();
                t.set(planRef, {
                    uid: uid,
                    titulo: titulo,
                    contenido: aiText,
                    asignatura: asignatura,
                    nivelEducativo: grado,
                    fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
                });

                // Registrar Transacción
                const txRef = db.collection('transactions').doc();
                t.set(txRef, {
                    uid: uid,
                    tipo: 'uso',
                    creditos: -1,
                    descripcion: `Generación: ${titulo}`,
                    fecha: admin.firestore.FieldValue.serverTimestamp(),
                    referencia: planRef.id
                });
            });
            console.log(`Crédito descontado y planeación guardada para ${uid}`);
        }

        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
