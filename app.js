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
fetch('programa_sintetico.txt')
    .then(r => r.text())
    .then(text => PROGRAMA_TEXT = text)
    .catch(err => console.error("No se pudo cargar el programa sintético:", err));

// DidactIA v5.8 - Vercel Tunnel Active
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
    const userChip = document.getElementById('user-chip');

    let currentPlanningHtml = '';
    let conversationHistory = [];

    // Verificar Autenticación
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'auth.html';
            return;
        }

        authGuard.style.display = 'none';

        // Lógica de Perfil v5.8 (Silent)
        let nickname = user.displayName;
        const localNick = localStorage.getItem(`nick_${user.uid}`);

        const cleanName = (str) => {
            if (!str) return 'Docente';
            return str.split('@')[0].split('.')[0].split('_')[0];
        };

        if (!nickname) {
            nickname = localNick || cleanName(user.email);
        }

        if (nickname.includes('@') || nickname.includes('_')) {
            nickname = cleanName(nickname);
        }

        nickname = nickname.charAt(0).toUpperCase() + nickname.slice(1);
        const name = localStorage.getItem(`name_${user.uid}`) || nickname;
        USER_DATA = { nickname, name };
        
        userNicknameSpan.textContent = nickname;
        userAvatarDiv.textContent = nickname.charAt(0).toUpperCase();

        const vTag = document.getElementById('version-tag') || document.createElement('div');
        vTag.id = 'version-tag';
        vTag.style = "position:fixed; bottom:5px; right:12px; font-size:10px; color:rgba(255,255,255,0.3); z-index:100;";
        vTag.textContent = "DidactIA v5.8 (Vercel Secure Mode)";
        document.body.appendChild(vTag);

        userChip.onclick = async () => {
            const newNick = prompt("Cambiar mi nombre de docente:", nickname);
            if (newNick && newNick !== nickname) {
                await updateProfile(auth.currentUser, { displayName: newNick });
                localStorage.setItem(`nick_${user.uid}`, newNick);
                location.reload();
            }
        };

        if (chatMessages.children.length === 0) {
            addMessage(`¡Hola, ${nickname}! 👋 Soy DidactIA. ¿En qué vamos a trabajar hoy?`, 'bot');
        }
    });

    logoutBtn.onclick = () => signOut(auth);

    // Lógica del Chat
    async function handleSend() {
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
            addMessage(`Error: ${error.message}. Verifica tu conexión o revisa la llave en Vercel.`, 'bot');
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
                userMessage: userMessage
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Error al conectar con el servidor');

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

    // Exportación a Word
    downloadBtn.addEventListener('click', () => {
        if (!currentPlanningHtml) return alert('No hay planeación para descargar.');
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
