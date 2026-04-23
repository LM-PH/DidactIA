import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { CONOCIMIENTO_NEM, DESCRIPCIONES_EJES } from './pedagogia.js';

// Registrar PWA Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log("PWA Service Worker Registrado"))
      .catch(err => console.error("Error al registrar SW:", err));
}

let USER_DATA = null;
let PROGRAMA_TEXT = "";
let IS_LOADED = false;

fetch('programa_sintetico.txt')
    .then(r => r.text())
    .then(text => {
        PROGRAMA_TEXT = text;
        IS_LOADED = true;
        console.log("Programa sintético cargado correctamente.");
    })
    .catch(err => console.error("No se pudo cargar el programa sintético:", err));

// DidactIA v6.4 - Anti-Hallucination Active
document.addEventListener('DOMContentLoaded', () => {
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
    const userChip = document.getElementById('user-chip');

    let currentPlanningHtml = '';
    let conversationHistory = [];

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'auth.html';
            return;
        }
        authGuard.style.display = 'none';
        let nickname = user.displayName || user.email.split('@')[0];
        USER_DATA = { nickname, email: user.email, uid: user.uid };
        userNicknameSpan.textContent = nickname;
        userAvatarDiv.textContent = nickname.charAt(0).toUpperCase();

        if (chatMessages.children.length === 0) {
            addMessage(`¡Hola, ${nickname}! 👋 Soy DidactIA. Vamos a crear una planeación 100% oficial de forma ordenada.\n\nEmpecemos con el Protocolo de 8 Pasos:\n\n**1. ¿Cuál es el nombre de tu escuela?**`, 'bot');
        }
    });

    logoutBtn.onclick = () => signOut(auth);

    async function handleSend() {
        if (!IS_LOADED) {
            addMessage("Aún estoy cargando mis bases de datos oficiales. Por favor espera 3 segundos...", 'bot');
            return;
        }

        const text = chatInput.value.trim();
        if (!text) return;

        addMessage(text, 'user');
        chatInput.value = '';
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
            addMessage(`Error: ${error.message}`, 'bot');
        }
    }

    sendBtn.onclick = handleSend;
    chatInput.onkeypress = (e) => { if (e.key === 'Enter') handleSend(); };

    async function callGeminiAPI(userMessage) {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                history: conversationHistory,
                userMessage: userMessage,
                userData: USER_DATA,
                pedagogicalData: {
                    programaText: PROGRAMA_TEXT,
                    ejes: DESCRIPCIONES_EJES
                }
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Error de conexión');

        const aiOutput = data.candidates[0].content.parts[0].text;
        conversationHistory.push({ role: "model", parts: [{ text: aiOutput }] });

        const planeacionRegex = /<div id=["']planeacion-oficial["']>([\s\S]*?)<\/div>/i;
        const match = aiOutput.match(planeacionRegex);
        
        let finalHtml = null;
        let cleanText = aiOutput;
        
        if (match && match[0]) {
            finalHtml = match[0];
            cleanText = aiOutput.replace(planeacionRegex, '\n*(Planeación disponible en el visor derecho)*\n').trim();
        } else {
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
        if(side === 'user') conversationHistory.push({ role: "user", parts: [{ text: text }] });
    }

    function showTypingIndicator() {
        if(document.getElementById('typing')) return;
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message bot typing-indicator';
        msgDiv.id = 'typing';
        msgDiv.innerHTML = `
            <div class="avatar"><img src="logo.png" style="width:24px; height:24px; border-radius:4px;"></div>
            <div class="bubble">...</div>
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

    downloadBtn.addEventListener('click', () => {
        if (!currentPlanningHtml) return alert('No hay planeación cargada.');
        const preHtml = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Planeación DidactIA</title></head><body>";
        const postHtml = "</body></html>";
        const html = preHtml + currentPlanningHtml + postHtml;
        const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = 'Planeacion_DidactIA.doc';
        link.click();
        URL.revokeObjectURL(url);
    });

    finalizeBtn.onclick = () => { if(currentPlanningHtml) downloadBtn.click(); };
    newChatBtn.onclick = () => { conversationHistory = []; location.reload(); };
});
