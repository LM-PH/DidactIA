import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { CONOCIMIENTO_NEM, DESCRIPCIONES_EJES } from './pedagogia.js';

// Registrar PWA Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log("PWA Service Worker Registrado"))
      .catch(err => console.error("Error al registrar SW:", err));
}

const API_KEY = "AIzaSyBZhMRtuZ8l1Q3c-4ckg2otdshkAYbZQQQ";
let USER_DATA = null;

let PROGRAMA_TEXT = "";
fetch('programa_sintetico.txt')
    .then(r => r.text())
    .then(text => PROGRAMA_TEXT = text)
    .catch(err => console.error("No se pudo cargar el programa sintético:", err));

const SYSTEM_PROMPT = `Actúa como DidactIA, un asistente experto en planeación didáctica para educación secundaria en México, alineado a la Nueva Escuela Mexicana.

Tu función es crear una secuencia didáctica COMPLETA en formato oficial tan pronto como el docente proporcione los datos base.

========================================
COMPORTAMIENTO DEL ASISTENTE
========================================
- TÚ ERES EXPERTO EN EL PLAN SINTÉTICO 2022. **REGLA DE ORO:** Si el docente te pega o te da textualmente sus propios Contenidos y PDAs en el chat, **TIENES QUE USARLOS AL PIE DE LA LETRA, no los cambies, no los ignores ni inventes otros.** Úsalos textualmente. Solo si el docente NO te los da, entonces tú propónlos usando tu base de datos. NUNCA le pidas que te los dé si tú ya tienes unos, pero respeta su autoridad si te los entrega.
- **GRAN REGLA:** Para generar la planeación necesitas: Asignatura, Grado, Tema y **NÚMERO DE SESIONES**. Si el docente te da su tema pero no el número de sesiones, PREGÚNTALE "¡Excelente maestro! ¿Cuántas sesiones o clases le vas a dedicar a este tema para dosificarlo?". **En cuanto tengas ese dato, GENERA Inmediatamente LA PLANEACIÓN COMPLETA (las 7 tablas) EN UN SOLO MENSAJE.**
- NO DETENGAS la generación para preguntar por actividades, ni propósitos, ni evaluación. INVENTA, PROPÓN Y LLENA toda la planeación de forma lógica y creativa basada en la Nueva Escuela Mexicana.
- DESPUÉS de mostrar la planeación completa en pantalla, puedes preguntar: "¿Qué te parece? ¿Quisieras cambiar alguna actividad, evaluación o adaptar algo a tu contexto?"
- Usa un tono profesional, claro y práctico. Evita explicaciones largas o teóricas.

========================================
DATOS MÍNIMOS (NO TE DETENGAS A PREGUNTARLOS TODOS SI YA TE DIERON EL TEMA)
========================================
- Docente
- Escuela
- Grado y grupo
- Campo formativo
- Fase
- Asignatura
- Tema
- ***Número de sesiones / dosificación (CRÍTICO)***
- Temporalidad (semanal o quincenal)
- Fecha

========================================
FORMATO OBLIGATORIO (NO MODIFICAR)
========================================
Genera la planeación ÚNICAMENTE con esta estructura:
1. DATOS GENERALES (Tabla HTML)
2. CONTENIDOS Y PROCESOS (Tabla HTML)
3. SECUENCIA DIDÁCTICA (Tabla HTML: Momento | Actividades | Organización | Recursos | Evidencias | Evaluación formativa)
4. EVALUACIÓN (Tabla HTML)
5. RECURSOS Y MATERIALES (Tabla HTML)
6. ADECUACIONES (Tabla HTML)
7. VINCULACIÓN INTERDISCIPLINARIA (Tabla HTML)

========================================
REGLAS DE GENERACIÓN
========================================
- ENCIERRA TODA LA PLANEACIÓN dentro de una etiqueta <div id="planeacion-oficial"> ... </div>. Esto es OBLIGATORIO para que el sistema reconozca la planeación.
- Incluye los títulos de las secciones usando etiquetas <h3> dentro del div, seguidos de su respectiva tabla.
- Usa formato HTML con <table>, <tr>, <th>, <td>.
- Actividades concretas y aplicables en el aula.
- Integra el enfoque sociocrítico.`;

document.addEventListener('DOMContentLoaded', () => {
    // Referencias UI
    const authGuard = document.getElementById('auth-guard');
    const userNicknameSpan = document.getElementById('user-nickname');
    const userAvatarDiv = document.getElementById('user-avatar');
    const logoutBtn = document.getElementById('logout-btn');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const chatMessages = document.getElementById('chat-messages');
    const contentViewer = document.getElementById('content-viewer');
    const downloadBtn = document.getElementById('download-btn');
    const finalizeBtn = document.getElementById('finalizar-btn');
    const newChatBtn = document.getElementById('new-chat-btn');

    let currentPlanningHtml = '';
    let conversationHistory = [];

    // Verificar Autenticación
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'auth.html';
            return;
        }

        // Recuperar datos de Firebase central (prioridad) o localStorage
        let nickname = user.displayName;
        if (!nickname) {
            nickname = localStorage.getItem(`nick_${user.uid}`);
            if (!nickname) {
                // Si todo falla, mostrar la primera parte del correo (ej. luis.ponce)
                nickname = user.email ? user.email.split('@')[0] : 'Docente';
            }
        }
        
        const name = localStorage.getItem(`name_${user.uid}`) || nickname;
        
        USER_DATA = { nickname, name };
        
        userNicknameSpan.textContent = nickname;
        userAvatarDiv.textContent = nickname.charAt(0).toUpperCase();
        
        // Mostrar saludo inicial personalizado si no hay mensajes
        if (chatMessages.children.length === 0) {
            addMessage(`¡Hola, ${nickname}! 👋 Soy DidactIA, tu asistente de planeación. ¿En qué asignatura o tema trabajaremos hoy?`, 'bot');
        }

        // Quitar el protector de carga
        authGuard.style.opacity = '0';
        setTimeout(() => authGuard.style.display = 'none', 300);
    });

    // Logout
    logoutBtn.addEventListener('click', async () => {
        if (confirm('¿Cerrar sesión de DidactIA?')) {
            await signOut(auth);
            window.location.href = 'auth.html';
        }
    });

    // Nuevo Chat
    newChatBtn.addEventListener('click', () => {
        if (confirm('¿Deseas iniciar una nueva planeación? Se borrará el chat actual.')) {
            chatMessages.innerHTML = '';
            contentViewer.innerHTML = `<div class="viewer-placeholder"><div class="placeholder-icon">📋</div><h3>Tu planeación aparecerá aquí</h3><p>Comienza la conversación con DidactIA.</p></div>`;
            conversationHistory = [];
            currentPlanningHtml = '';
            addMessage(`Entendido. Empecemos de nuevo. ¿Qué tema o asignatura planearemos hoy?`, 'bot');
        }
    });

    // Auto-resize textarea
    chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    // Handle Send Button
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        addMessage(text, 'user');
        chatInput.value = '';
        chatInput.style.height = 'auto';

        showTypingIndicator();
        
        try {
            const response = await callGeminiAPI(text);
            
            removeTypingIndicator();
            addMessage(response.text, 'bot');
            if (response.html) {
                updateViewer(response.html);
            }
        } catch (error) {
            removeTypingIndicator();
            addMessage(`Dificultad técnica: ${error.message}. Por favor, verifica tu conexión o inténtalo más tarde.`, 'bot');
        }
    }

    async function callGeminiAPI(userInput) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
        
        let promptFinal = SYSTEM_PROMPT;
        if (USER_DATA) {
            promptFinal += `\n\nEl nombre del docente es: ${USER_DATA.name}. Su nickname es: ${USER_DATA.nickname}. Salúdalo de forma ocasional usando su nickname.`;
        }

        // Inyectando la base de datos de PDAs y Ejes de forma Obligatoria
        promptFinal += `\n\n========================================\nDOCUMENTO OFICIAL DEL PLAN SINTÉTICO (Fase 6)\n========================================\nSi el docente NO te proporcionó sus propios PDA o Contenidos textuales en la charla, es OBLIGATORIO que los busques y extraigas EXACTA Y TEXTUALMENTE del siguiente texto crudo que es la copia fiel del PDF del Plan Sintético. Tienes estrictamente prohibido inventarlos. Identifica la disciplina y compárala.\n\nTEXTO RAW PROGRAMA SINTETICO:\n${PROGRAMA_TEXT}\n\nSignificado de cada eje articulador (para fines de la secuencia):\n${JSON.stringify(DESCRIPCIONES_EJES, null, 2)}`;

        conversationHistory.push({ role: "user", parts: [{ text: userInput }] });
        
        const payload = {
            contents: [
                { role: "user", parts: [{ text: promptFinal }] },
                { role: "model", parts: [{ text: "Entendido, soy DidactIA y asistiré al docente de forma personalizada." }] },
                ...conversationHistory
            ],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 4096,
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (data.error) throw new Error(data.error.message);

        const aiOutput = data.candidates[0].content.parts[0].text;
        conversationHistory.push({ role: "model", parts: [{ text: aiOutput }] });

        const planeacionRegex = /<div id=["']planeacion-oficial["']>([\s\S]*?)<\/div>/i;
        const match = aiOutput.match(planeacionRegex);
        
        let finalHtml = null;
        let cleanText = aiOutput;
        
        if (match && match[0]) {
            finalHtml = match[0]; // Capturamos todo el bloque con su formato
            cleanText = aiOutput.replace(planeacionRegex, '\n*(Planeación disponible en el visor derecho)*\n').trim();
        } else {
            // Fallback por si la IA generara tablas sin el div
            const tableRegex = /<table[\s\S]*?<\/table>/gi;
            const tables = aiOutput.match(tableRegex);
            if(tables) {
               finalHtml = tables.join('<br><br>');
               cleanText = aiOutput.replace(tableRegex, '\n*(Tablas en el visor derecho)*\n').trim();
            }
        }

        return { text: cleanText, html: finalHtml };
    }

    function addMessage(text, side) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${side}`;
        msgDiv.innerHTML = `
            <div class="avatar">${side === 'bot' ? '<img src="logo.png" style="width:24px; height:24px; border-radius:4px;">' : (USER_DATA?.nickname?.charAt(0) || '👤')}</div>
            <div class="bubble">${text}</div>
        `;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function showTypingIndicator() {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message bot typing-indicator';
        msgDiv.id = 'typing';
        msgDiv.innerHTML = `
            <div class="avatar"><img src="logo.png" style="width:24px; height:24px; border-radius:4px;"></div>
            <div class="bubble">DidactIA está pensando...</div>
        `;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function removeTypingIndicator() {
        const indicator = document.getElementById('typing');
        if (indicator) indicator.remove();
    }

    function updateViewer(html) {
        if (!html) return;
        currentPlanningHtml = html;
        contentViewer.innerHTML = html;
    }

    // Exportación a Word
    downloadBtn.addEventListener('click', () => {
        if (!currentPlanningHtml) return alert('No hay planeación para descargar.');
        
        const preHtml = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Planeación DidactIA</title></head><body>";
        const postHtml = "</body></html>";
        const html = preHtml + currentPlanningHtml + postHtml;

        const blob = new Blob(['\ufeff', html], {
            type: 'application/msword'
        });
        
        const url = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(html);
        const filename = 'Planeacion_DidactIA.doc';
        
        const downloadLink = document.createElement("a");
        document.body.appendChild(downloadLink);
        
        if (navigator.msSaveOrOpenBlob) {
            navigator.msSaveOrOpenBlob(blob, filename);
        } else {
            downloadLink.href = url;
            downloadLink.download = filename;
            downloadLink.click();
        }
        document.body.removeChild(downloadLink);
    });

    finalizeBtn.addEventListener('click', () => {
        if (!currentPlanningHtml) return alert('No hay nada que finalizar.');
        alert('Planeación guardada con éxito.');
    });
});
