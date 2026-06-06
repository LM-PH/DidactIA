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
            const isSuperAdmin = data.email === 'zlagustin10@gmail.com';
            if (!isSuperAdmin && (data.creditos || 0) <= 0) {
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
- **PROHIBICIÓN ESTRICTA:** NO incluyas NUNCA las secciones de "Contexto" ni "Problematización" de forma aislada. Elimínalas por completo de tu respuesta y de las tablas si no se solicitan explícitamente en el formato.
- **PROHIBICIÓN DE INVENTAR:** Usa solo Contenidos y PDAs del texto oficial (Programa Sintético) que te doy abajo. Usa el que mejor se adapte al tema.
- **INTEGRACIÓN ORGÁNICA DEL PROBLEMA:** No fuerces todos los contenidos ni actividades para que encajen estrictamente en la "Situación Problema" de forma antinatural. Atiende la problemática de forma transversal y orgánica, permitiendo que los temas se desarrollen de manera natural sin forzar la relación en cada actividad.
- **TEMPERATURA BAJA:** Mantente fiel a los hechos, sé profesional y pedagógico.

========================================
========================================
PROTOCOLO OPTIMIZADO DE 5 PASOS
========================================
Pide la información de forma agrupada para evitar saturar al usuario:
1. Datos Generales (Agrupado): El usuario debe proporcionarte de un solo golpe: Escuela, Docente, Ciclo, Periodo, Asignatura y Grado/Grupo. Si falta algo, pídelo amablemente.
2. Contenido: Pregunta qué Contenido se va a desarrollar.
3. Selección de PDAs: Al recibir el Contenido, busca en el PROGRAMA SINTÉTICO los PDAs correspondientes a ese Contenido, Asignatura y **Grado específico**. Muéstrale al docente ÚNICAMENTE los PDAs de su grado en una lista numerada (Ej. 1. [Texto]). Pídele que elija tecleando el número. **ATENCIÓN AL LEER EL NÚMERO:** Sé extremadamente preciso. Si el docente escribe "1", "uno", "el 1", se refiere exclusivamente al número 1, NO asumas que es un 11 u otro número. Interpreta su intención exacta.
4. Sesiones y Situación Problema (Agrupado): Pregunta en un solo mensaje: a) En cuántas sesiones se desarrollará el/los PDA(s), y b) Cuál es la Situación Problema (Problema del Contexto).
5. Sugerencia y Aprobación: Al recibir la Situación Problema y las Sesiones, sugiere al docente una Metodología Didáctica (y sus Fases), un Nombre del Proyecto y un Producto Final. Pide su aprobación o posibles ajustes.

Una vez aprobado el paso 5, genera las tablas. 
**REGLA ESTRICTA DE DOSIFICACIÓN DE PROYECTOS (¡MUY IMPORTANTE!):** 
- Un "Proyecto" ampara todo el "Contenido" (es decir, TODOS sus PDAs juntos).
- **EXCEPCIÓN:** Si el contenido tiene **SOLO 1 PDA EN TOTAL** para ese grado (ej. Formación Cívica y Ética), entonces ese único PDA abarca todo el proyecto. En este caso único, **SÍ DEBES** desarrollar la metodología completa de principio a fin.
- Si el contenido tiene VARIOS PDAs y el docente elige **SOLO 1 PDA** (o una parte de ellos), tienes **ESTRICTAMENTE PROHIBIDO** desarrollar todas las fases de la metodología. 
- Debes "dosificar" el proyecto: Si eligió el primer PDA (de varios), diseña la Secuencia Didáctica abarcando **ÚNICAMENTE** las fases iniciales (ej. Fase 1 y/o 2) ajustadas a las sesiones que pidió. NO incluyas las fases de desarrollo avanzado, cierre, ni la evaluación del producto final. En su lugar, agrega una nota indicando: *"Las siguientes fases del proyecto se desarrollarán en futuras planeaciones con los PDAs restantes"*.
- Si elige un PDA intermedio, desarrolla solo las fases intermedias. Si elige el último PDA, desarrolla solo las fases de cierre y presentación del producto. 
- Solo si el docente elige TODOS los PDAs al mismo tiempo (o si el contenido solo tiene 1 PDA en total), puedes desarrollar la metodología completa de principio a fin.
========================================
FORMATO DE SALIDA (SÓLO 7 TABLAS HTML)
========================================
Genera un <div id="planeacion-oficial"> con estas 7 tablas:
1. DATOS GENERALES (Incluye Nombre del Proyecto, Producto Final, Metodología Didáctica y Situación Problema)
2. CONTENIDOS Y PROCESOS
3. SECUENCIA DIDÁCTICA (Debe estar estructurada por las Fases de la Metodología Didáctica)
4. EVALUACIÓN
5. RECURSOS
6. ADECUACIONES
7. VINCULACIÓN (Especifica contenidos transversales de otras disciplinas. **REGLA NEM:** Asocia correctamente: Lenguajes [Español, Inglés, Artes], Saberes y P.C. [Matemáticas, Biología, Física, Química], Ética, Naturaleza y Soc. [Geografía, Historia, FCyE], De lo Humano y lo Comunitario [Tecnología, Ed. Física, Tutoría]).

========================================
BASE DE DATOS (PROGRAMA SINTÉTICO Y METODOLOGÍAS)
========================================
PROGRAMA SINTÉTICO:
${pedagogicalData?.programaText || 'Cargando...'}
EJES ARTICULADORES:
${JSON.stringify(pedagogicalData?.ejes || {})}
METODOLOGÍAS SOCIOCRÍTICAS Y SUS FASES POR CAMPO FORMATIVO:
${JSON.stringify(pedagogicalData?.metodologias || {})}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
    const payload = {
        contents: [
            { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
            { role: "model", parts: [{ text: "Entendido. Protocolo optimizado de 5 pasos activo. Recolectaré la información de manera ágil y agrupada para ahorrar tokens. He ELIMINADO Contexto y Problematización aislados." }] },
            ...history,
            { role: "user", parts: [{ text: userMessage }] }
        ],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8000 }
    };

    try {
        let response;
        let data;
        let maxRetries = 3;
        let delay = 2000;

    for (let i = 0; i < maxRetries; i++) {
        response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        data = await response.json();

        if (response.ok) {
            break; // Éxito, salir del bucle
        } else if (response.status === 503 && i < maxRetries - 1) {
            // Si es error 503 (High Demand), esperar y reintentar
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 1.5; // Backoff exponencial
        } else {
            // Si es otro error o se acabaron los intentos, devolver el error
            return res.status(response.status).json(data);
        }
    }
        
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
                
                const isSuperAdmin = userData.email === 'zlagustin10@gmail.com';
                const newCredits = isSuperAdmin ? userData.creditos : (userData.creditos || 0) - 1;
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
