import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc, deleteDoc, collection, query, where, orderBy, onSnapshot, limit } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
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
    
    // --- ELEMENTOS UI PANEL ---
    const navButtons = document.querySelectorAll('.nav-btn');
    const viewPanels = document.querySelectorAll('.view-panel');
    const miniAvatar = document.getElementById('mini-avatar');
    const miniName = document.getElementById('mini-name');
    const miniPlan = document.getElementById('mini-plan');
    const profileAvatarLarge = document.getElementById('profile-avatar-large');
    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    const profilePlanBadge = document.getElementById('profile-plan-badge');
    const statCredits = document.getElementById('stat-credits');
    const statTotalPlans = document.getElementById('stat-total-plans');
    const plansListContainer = document.getElementById('plans-list-container');
    const creditsHistoryContainer = document.getElementById('credits-history-container');
    const searchPlansInput = document.getElementById('search-plans');

    let currentPlanningHtml = '';
    let conversationHistory = [];

    // --- NAVEGACIÓN ENTRE VISTAS ---
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetView = btn.getAttribute('data-view');
            switchView(targetView);
        });
    });

    function switchView(viewId) {
        // Desactivar botones
        navButtons.forEach(b => b.classList.remove('active'));
        const activeBtn = document.querySelector(`.nav-btn[data-view="${viewId}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        // Cambiar paneles
        viewPanels.forEach(p => p.classList.remove('active'));
        const activePanel = document.getElementById(`view-${viewId}`);
        if (activePanel) activePanel.classList.add('active');

        // Acciones específicas
        if (viewId === 'planeaciones') loadMyPlannings();
        if (viewId === 'credits') loadCreditsHistory();
    }

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

    // --- MANEJO DE UI (HEADER Y LOGOUT) ---
    const userMenuBtn = document.getElementById('user-menu-btn');
    const userMenu = document.getElementById('user-menu');
    
    if (userMenuBtn) {
        userMenuBtn.onclick = (e) => { 
            e.stopPropagation(); 
            userMenu.style.display = userMenu.style.display === 'flex' ? 'none' : 'flex'; 
        };
    }
    document.addEventListener('click', () => { if (userMenu) userMenu.style.display = 'none'; });
    
    if (logoutBtn) logoutBtn.onclick = () => signOut(auth);

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

    // --- FUNCIONES DE CARGA DE DATOS ---

    async function loadMyPlannings() {
        if (!USER_DATA?.uid) return;
        plansListContainer.innerHTML = '<p class="loading-text">Cargando tus planeaciones...</p>';
        
        try {
            const q = query(
                collection(db, "planeaciones"),
                where("uid", "==", USER_DATA.uid),
                orderBy("fechaCreacion", "desc")
            );
            
            onSnapshot(q, (snapshot) => {
                if (snapshot.empty) {
                    plansListContainer.innerHTML = '<div class="viewer-placeholder"><h3>No tienes planeaciones</h3><p>Genera tu primera planeación en el Editor.</p></div>';
                    return;
                }
                
                plansListContainer.innerHTML = "";
                snapshot.forEach(docSnap => {
                    const plan = docSnap.data();
                    const card = createPlanCard(docSnap.id, plan);
                    plansListContainer.appendChild(card);
                });
            });
        } catch (error) {
            console.error("Error al cargar planeaciones:", error);
        }
    }

    function createPlanCard(id, plan) {
        const div = document.createElement('div');
        div.className = 'plan-item-card';
        const date = plan.fechaCreacion ? plan.fechaCreacion.toDate().toLocaleDateString() : 'Reciente';
        
        div.innerHTML = `
            <div class="plan-card-header">
                <div>
                    <h4 class="plan-card-title">${plan.titulo || 'Sin título'}</h4>
                    <div class="plan-card-meta">
                        <span>📅 ${date}</span>
                        <span>📚 ${plan.asignatura || 'General'}</span>
                    </div>
                </div>
            </div>
            <div class="plan-card-actions">
                <button class="btn-icon-sm open-btn" title="Abrir">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </button>
                <button class="btn-icon-sm copy-btn" title="Copiar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
                <button class="btn-icon-sm delete delete-btn" title="Eliminar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>
        `;

        div.querySelector('.open-btn').onclick = () => {
            currentPlanningHtml = plan.contenido;
            contentViewer.innerHTML = plan.contenido;
            switchView('editor');
        };

        div.querySelector('.copy-btn').onclick = () => {
            const text = contentViewer.innerText; // Fallback or use a hidden div
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = plan.contenido;
            const plainText = tempDiv.innerText;
            navigator.clipboard.writeText(plainText).then(() => alert("Copiado al portapapeles"));
        };

        div.querySelector('.delete-btn').onclick = async () => {
            if (confirm("¿Estás seguro de eliminar esta planeación?")) {
                await deleteDoc(doc(db, "planeaciones", id));
            }
        };

        return div;
    }

    async function loadCreditsHistory() {
        if (!USER_DATA?.uid) return;
        creditsHistoryContainer.innerHTML = '<p class="loading-text">Cargando movimientos...</p>';
        
        try {
            const q = query(
                collection(db, "transactions"),
                where("uid", "==", USER_DATA.uid),
                orderBy("fecha", "desc"),
                limit(50)
            );
            
            onSnapshot(q, (snapshot) => {
                if (snapshot.empty) {
                    creditsHistoryContainer.innerHTML = '<p class="loading-text">No hay movimientos registrados.</p>';
                    return;
                }
                
                creditsHistoryContainer.innerHTML = "";
                snapshot.forEach(docSnap => {
                    const tx = docSnap.data();
                    const date = tx.fecha ? tx.fecha.toDate().toLocaleString() : 'Reciente';
                    const item = document.createElement('div');
                    item.className = 'transaction-item';
                    item.innerHTML = `
                        <div class="tx-info">
                            <span class="tx-desc">${tx.descripcion}</span>
                            <span class="tx-date">${date}</span>
                            ${tx.referencia ? `<span class="tx-ref">Ref: ${tx.referencia}</span>` : ''}
                        </div>
                        <div class="tx-status-group">
                            <span class="tx-amount ${tx.creditos < 0 ? 'neg' : 'pos'}">
                                ${tx.creditos > 0 ? '+' : ''}${tx.creditos}
                            </span>
                            <small class="tx-type-tag">${tx.tipo}</small>
                        </div>
                    `;
                    creditsHistoryContainer.appendChild(item);
                });
            });
        } catch (error) {
            console.error("Error al cargar historial:", error);
        }
    }

    // Buscador
    if (searchPlansInput) {
        searchPlansInput.oninput = (e) => {
            const term = e.target.value.toLowerCase();
            const cards = plansListContainer.querySelectorAll('.plan-item-card');
            cards.forEach(card => {
                const title = card.querySelector('.plan-card-title').innerText.toLowerCase();
                const meta = card.querySelector('.plan-card-meta').innerText.toLowerCase();
                if (title.includes(term) || meta.includes(term)) {
                    card.style.display = 'flex';
                } else {
                    card.style.display = 'none';
                }
            });
        };
    }

    const openCreditsFromPanel = document.getElementById('open-credits-from-panel');
    if (openCreditsFromPanel) {
        openCreditsFromPanel.onclick = () => creditsModal.classList.add('active');
    }


    // --- INTEGRACIÓN MERCADO PAGO GLOBAL ---
    window.comprarCreditos = async function(btn) {
        console.log("Iniciando compra para:", btn.getAttribute('data-pkg'));
        
        if (!USER_DATA) {
            alert("Por favor, inicia sesión para comprar créditos.");
            return;
        }
        
        const pkgId = btn.getAttribute('data-pkg');
        const credits = btn.getAttribute('data-credits');
        const price = btn.getAttribute('data-price');

        // Desactivar botón y mostrar carga
        const originalText = btn.innerText;
        btn.innerText = "Procesando...";
        btn.disabled = true;
        btn.style.opacity = "0.7";

        try {
            const response = await fetch('/api/create-preference', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pkgId: pkgId,
                    credits: credits,
                    price: price,
                    uid: USER_DATA.uid,
                    email: USER_DATA.email
                })
            });

            const result = await response.json();
            if (result.init_point) {
                window.location.href = result.init_point;
            } else {
                throw new Error(result.error || "Error al generar el pago");
            }
        } catch (error) {
            console.error("Error MP:", error);
            alert("Ocurrió un error al conectar con Mercado Pago. Por favor intenta de nuevo.");
            btn.innerText = originalText;
            btn.disabled = false;
            btn.style.opacity = "1";
        }
    };

    // Manejar retorno de pago
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('status');
    if (paymentStatus) {
        if (paymentStatus === 'success') {
            addMessage("✅ ¡Gracias por tu compra! Tus créditos se están procesando y aparecerán en tu cuenta en unos segundos.", 'bot');
            switchView('dashboard');
        } else if (paymentStatus === 'failure') {
            addMessage("❌ El pago no pudo completarse. Si crees que es un error, contacta a soporte.", 'bot');
        } else if (paymentStatus === 'pending') {
            addMessage("⏳ Tu pago está pendiente de aprobación. Te avisaremos cuando se acredite.", 'bot');
        }
        // Limpiar URL para no repetir el mensaje al recargar
        window.history.replaceState({}, document.title, window.location.pathname);
    }


    // --- MANEJO DE MODALES RESTANTES ---
    const closeCreditsBtn = document.getElementById('close-credits');
    if (closeCreditsBtn) {
        closeCreditsBtn.onclick = () => creditsModal.classList.remove('active');
    }
    // Cerrar modal al hacer click fuera
    window.onclick = (event) => {
        if (event.target == creditsModal) creditsModal.classList.remove('active');
    }
