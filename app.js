import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc, collection, query, where, orderBy, onSnapshot, limit } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { CONOCIMIENTO_NEM, DESCRIPCIONES_EJES } from './pedagogia.js';

// Registrar PWA Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js?v=7.1')
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

// DidactIA v6.8 - Clean PDF Export Active
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
    
    // UI Elements para Créditos
    const userMenuBtn = document.getElementById('user-menu-btn');
    const userMenu = document.getElementById('user-menu');
    const creditsModal = document.getElementById('credits-modal');
    const historyModal = document.getElementById('history-modal');
    const openHistoryBtn = document.getElementById('open-history');
    const openCreditsBtn = document.getElementById('open-credits');
    const closeHistoryBtn = document.getElementById('close-history');
    const closeCreditsBtn = document.getElementById('close-credits');
    const transactionsContainer = document.getElementById('transactions-container');

    let currentPlanningHtml = '';
    let conversationHistory = [];

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'auth.html';
            return;
        }
        authGuard.style.display = 'none';
        
        // Escuchar cambios en tiempo real del usuario (Créditos, Plan, etc)
        const userRef = doc(db, "usuarios", user.uid);
        onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                USER_DATA = { ...data, uid: user.uid };
                
                // Actualizar UI
                userNicknameSpan.textContent = data.nombre || data.nickname || user.displayName || user.email.split('@')[0];
                const creditsSpan = document.getElementById('user-credits');
                if (creditsSpan) {
                    creditsSpan.textContent = `Créditos: ${data.creditos ?? 0}`;
                    if ((data.creditos ?? 0) <= 1) creditsSpan.style.color = "#E11D48";
                    else creditsSpan.style.color = "";
                }
                
                if (data.fotoPerfil) {
                    userAvatarDiv.style.backgroundImage = `url(${data.fotoPerfil})`;
                    userAvatarDiv.textContent = "";
                } else {
                    userAvatarDiv.style.backgroundImage = "none";
                    userAvatarDiv.textContent = (data.nombre || user.email).charAt(0).toUpperCase();
                }

                // Mostrar botón admin
                if (user.email === "zlagustin10@gmail.com") {
                    const adminBtn = document.getElementById('admin-link');
                    if (adminBtn) adminBtn.style.display = 'flex';
                }

                if (chatMessages.children.length === 0) {
                    addMessage(`¡Hola! 👋 Soy DidactIA. Vamos a crear una planeación 100% oficial de forma ordenada.\n\n**1. ¿Cuál es el nombre de tu escuela?**`, 'bot');
                }
            } else {
                setDoc(userRef, {
                    uid: user.uid,
                    nombre: user.displayName || user.email.split('@')[0],
                    email: user.email,
                    fotoPerfil: user.photoURL || "",
                    creditos: 3,
                    plan: "gratis",
                    fechaRegistro: new Date().toISOString()
                });
            }
        });
    });

    // --- MANEJO DE UI (MENÚS Y MODALES) ---
    userMenuBtn.onclick = (e) => { e.stopPropagation(); userMenu.classList.toggle('active'); };
    document.onclick = () => userMenu.classList.remove('active');
    
    openHistoryBtn.onclick = () => { historyModal.classList.add('active'); loadTransactions(); };
    openCreditsBtn.onclick = () => creditsModal.classList.add('active');
    closeHistoryBtn.onclick = () => historyModal.classList.remove('active');
    closeCreditsBtn.onclick = () => creditsModal.classList.remove('active');
    logoutBtn.onclick = () => signOut(auth);

    async function loadTransactions() {
        if (!USER_DATA?.uid) return;
        transactionsContainer.innerHTML = '<p class="loading-text">Cargando...</p>';
        
        try {
            const q = query(
                collection(db, "transactions"),
                where("uid", "==", USER_DATA.uid),
                orderBy("fecha", "desc"),
                limit(20)
            );
            
            onSnapshot(q, (snapshot) => {
                if (snapshot.empty) {
                    transactionsContainer.innerHTML = '<p class="empty-text">No hay movimientos aún.</p>';
                    return;
                }
                
                let html = '';
                snapshot.forEach(doc => {
                    const tx = doc.data();
                    const fecha = tx.fecha?.toDate().toLocaleDateString() || 'Reciente';
                    const isPos = tx.creditos > 0;
                    html += `
                        <div class="transaction-item">
                            <div class="tx-info">
                                <h5>${tx.descripcion}</h5>
                                <span>${fecha} • ${tx.tipo}</span>
                            </div>
                            <div class="tx-amount ${isPos ? 'pos' : 'neg'}">
                                ${isPos ? '+' : ''}${tx.creditos}
                            </div>
                        </div>
                    `;
                });
                transactionsContainer.innerHTML = html;
            });
        } catch (err) {
            console.error(err);
            transactionsContainer.innerHTML = '<p class="error-text">Error al cargar historial.</p>';
        }
    }

    async function handleSend() {
        if (!IS_LOADED) {
            addMessage("Cargando bases de datos... Espera un momento.", 'bot');
            return;
        }

        const text = chatInput.value.trim();
        if (!text) return;

        // Validar créditos localmente antes de enviar
        if ((USER_DATA?.creditos ?? 0) <= 0) {
            addMessage("⚠️ No tienes créditos suficientes. Por favor adquiere más para continuar.", 'bot');
            creditsModal.classList.add('active');
            return;
        }

        addMessage(text, 'user');
        chatInput.value = '';
        chatInput.disabled = true;
        sendBtn.disabled = true;
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
            if (error.message.includes('SIN_CREDITOS')) {
                addMessage("⚠️ Se han agotado tus créditos durante la generación.", 'bot');
                creditsModal.classList.add('active');
            } else {
                addMessage(`Error: ${error.message}`, 'bot');
            }
        } finally {
            chatInput.disabled = false;
            sendBtn.disabled = false;
            chatInput.focus();
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
        if (!response.ok) {
            const errorMsg = data.error?.message || data.error || 'Error de conexión';
            throw new Error(errorMsg);
        }

        if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
            throw new Error("Respuesta incompleta de la IA. Por favor intenta de nuevo.");
        }

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
        
        const element = document.createElement('div');
        element.innerHTML = `
            <style>
                body { font-family: 'Inter', sans-serif; padding: 20px; color: #333; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; table-layout: fixed; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 10pt; word-wrap: break-word; }
                th { background-color: #f8f9fa; color: #6366f1; }
                #planeacion-oficial { width: 100%; }
                h1, h2 { color: #1e1b4b; }
            </style>
            ${currentPlanningHtml}
        `;

        const opt = {
            margin:       [10, 10, 10, 10],
            filename:     'Planeacion_DidactIA.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'letter', orientation: 'portrait' }
        };

        // Nueva forma de descargar en PDF profesional
        html2pdf().set(opt).from(element).save();
    });

    finalizeBtn.onclick = () => { if(currentPlanningHtml) downloadBtn.click(); };
    newChatBtn.onclick = () => { conversationHistory = []; location.reload(); };
});
