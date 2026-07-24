import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc, deleteDoc, addDoc, collection, query, where, orderBy, onSnapshot, limit } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { CONOCIMIENTO_NEM, DESCRIPCIONES_EJES, METODOLOGIAS_SOCIOCRITICAS } from './pedagogia.js';

// DidactIA v15.0 - Sistema Desbloqueado

console.log("--- DIDACTIA v17.0 INICIANDO ---");
// Prueba de vida instantánea
window.SISTEMA_CARGADO = true;

// --- FUNCIONES GLOBALES DE EMERGENCIA (FUERA DE TODO) ---
window.switchView = function(viewId) {
    console.log("Cambiando a vista:", viewId);
    const navButtons = document.querySelectorAll('.nav-btn');
    const viewPanels = document.querySelectorAll('.view-panel');
    
    navButtons.forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.nav-btn[data-view="${viewId}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    viewPanels.forEach(p => p.classList.remove('active'));
    const activePanel = document.getElementById(`view-${viewId}`);
    if (activePanel) activePanel.classList.add('active');
};
// window.comprarCreditos original removido para evitar duplicados. Ver definición abajo.

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
    // DESBLOQUEO FORZADO v15.0
    setTimeout(() => {
        if (authGuard) {
            authGuard.style.opacity = '0';
            setTimeout(() => authGuard.style.display = 'none', 500);
            console.log("🔓 Interfaz desbloqueada manualmente");
        }
    }, 1500);

    const userNicknameSpan = document.getElementById('user-nickname');
    const userAvatarDiv = document.getElementById('user-avatar');
    const logoutBtn = document.getElementById('logout-btn');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const chatMessages = document.getElementById('chat-messages');
    const contentViewer = document.getElementById('content-viewer');
    const downloadBtn = document.getElementById('download-btn');
    const downloadWordBtn = document.getElementById('download-word-btn');
    const finalizeBtn = document.getElementById('finalizar-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const creditsModal = document.getElementById('credits-modal');
    
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

    window.switchView = function(viewId) {
        // Desactivar botones
        navButtons.forEach(b => b.classList.remove('active'));
        const activeBtn = document.querySelector(`.nav-btn[data-view="${viewId}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        // Cambiar paneles
        viewPanels.forEach(p => p.classList.remove('active'));
        const activePanel = document.getElementById(`view-${viewId}`);
        if (activePanel) activePanel.classList.add('active');

        // Acciones específicas
        if (viewId === 'credits') loadCreditsHistory();
        if (viewId === 'dashboard') loadProjectsHistory();
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

                // Actualizar Dashboard (Perfil)
                if (profileName) {
                    profileName.textContent = data.nombre || data.nickname || user.displayName || user.email.split('@')[0];
                    profileName.classList.remove('skeleton', 'skeleton-text');
                }
                if (profileEmail) {
                    profileEmail.textContent = user.email || data.email;
                    profileEmail.classList.remove('skeleton', 'skeleton-text');
                }
                if (profilePlanBadge) {
                    profilePlanBadge.textContent = (data.plan === 'premium' || data.creditos > 1) ? 'Plan Premium' : 'Plan Gratis';
                    profilePlanBadge.classList.remove('skeleton');
                }
                if (statCredits) {
                    statCredits.textContent = data.creditos ?? 0;
                    statCredits.classList.remove('skeleton');
                }
                if (statTotalPlans) {
                    statTotalPlans.textContent = data.totalPlaneaciones ?? 0;
                    statTotalPlans.classList.remove('skeleton');
                }
                if (profileAvatarLarge) {
                    profileAvatarLarge.classList.remove('skeleton-avatar');
                    if (data.fotoPerfil) {
                        profileAvatarLarge.style.backgroundImage = `url(${data.fotoPerfil})`;
                        profileAvatarLarge.textContent = "";
                    } else {
                        profileAvatarLarge.style.backgroundImage = "none";
                        profileAvatarLarge.textContent = (data.nombre || user.email).charAt(0).toUpperCase();
                    }
                }

                // Mostrar botón admin
                if (user.email === "zlagustin10@gmail.com") {
                    const adminBtn = document.getElementById('admin-link');
                    if (adminBtn) adminBtn.style.display = 'flex';
                }

                if (chatMessages.children.length === 0) {
                    const nombreCompleto = data.nombre || data.nickname || user.displayName || user.email.split('@')[0];
                    const primerNombre = nombreCompleto.split(' ')[0];
                    addMessage(`¡Hola ${primerNombre}! 👋 Soy DidactIA. Vamos a crear una nueva planeación didáctica. Para comenzar de forma rápida y ahorrarte tiempo, por favor compárteme tus **Datos Generales** (puedes escribirlos separados por comas o saltos de línea):\n\n🏫 Escuela:\n👩‍🏫 Docente:\n📅 Ciclo y Periodo:\n📚 Asignatura:\n🎓 Grado y Grupo:`, 'bot');
                }
            } else {
                setDoc(userRef, {
                    uid: user.uid,
                    nombre: user.displayName || user.email.split('@')[0],
                    email: user.email,
                    fotoPerfil: user.photoURL || "",
                    creditos: 1,
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
        const isSuperAdmin = USER_DATA?.email === 'zlagustin10@gmail.com';
        if (!isSuperAdmin && (USER_DATA?.creditos ?? 0) <= 0) {
            addMessage("⚠️ No tienes créditos suficientes. Por favor adquiere más para continuar.", 'bot');
            creditsModal.classList.add('active');
            return;
        }

        addMessage(text, 'user');
        chatInput.value = '';
        chatInput.disabled = true;
        sendBtn.disabled = true;
        showTypingIndicator();

        // Analytics
        if (typeof gtag === 'function') gtag('event', 'generate_plan_started');

        try {
            const response = await callGeminiAPI(text);
            removeTypingIndicator();
            addMessage(response.text, 'bot');
            if (response.html) {
                updateViewer(response.html);
                if (typeof gtag === 'function') gtag('event', 'generate_plan_success');
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
    // Eliminamos el envío con "Enter" para permitir saltos de línea.
    // El usuario deberá presionar el botón de enviar para mandar el mensaje.

    async function callGeminiAPI(userMessage) {
        const idToken = await auth.currentUser.getIdToken();
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
                history: conversationHistory.slice(0, -1),
                userMessage: userMessage,
                pedagogicalData: {
                    programaText: PROGRAMA_TEXT,
                    ejes: DESCRIPCIONES_EJES,
                    metodologias: METODOLOGIAS_SOCIOCRITICAS
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
            
            // Extraer y guardar metadatos de forma segura usando el DOM (en lugar de Regex)
            if (USER_DATA?.uid) {
                try {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = finalHtml;
                    const metaDiv = tempDiv.querySelector('#metadata-planeacion');
                    
                    if (metaDiv) {
                        const contenido = metaDiv.getAttribute('data-contenido') || '';
                        const pdas = metaDiv.getAttribute('data-pdas') || '';
                        const nombreProyecto = metaDiv.getAttribute('data-proyecto') || 'Proyecto';
                        const resumen = metaDiv.getAttribute('data-resumen') || '';
                        
                        await addDoc(collection(db, "proyectos"), {
                            uid: USER_DATA.uid,
                            contenido: contenido,
                            pdas: pdas,
                            nombre_proyecto: nombreProyecto,
                            resumen: resumen,
                            html: finalHtml,
                            fecha: new Date().toISOString()
                        });
                        console.log("Proyecto guardado en el historial");
                    } else {
                        // Si no mandó metadata, aun así lo guardamos como Genérico
                        await addDoc(collection(db, "proyectos"), {
                            uid: USER_DATA.uid,
                            contenido: "N/A",
                            pdas: "N/A",
                            nombre_proyecto: "Planeación Genérica",
                            resumen: "Planeación guardada automáticamente.",
                            html: finalHtml,
                            fecha: new Date().toISOString()
                        });
                    }
                } catch (e) {
                    console.error("Error al guardar proyecto", e);
                }
            }
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

    if (downloadWordBtn) {
        downloadWordBtn.addEventListener('click', () => {
            if (!currentPlanningHtml) return alert('No hay planeación cargada.');
            
            const preHtml = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Planeacion DidactIA</title><style>body { font-family: 'Arial', sans-serif; color: #333; } table { width: 100%; border-collapse: collapse; margin-bottom: 20px; } th, td { border: 1px solid #000; padding: 8px; text-align: left; } th { background-color: #f2f2f2; } h1, h2 { color: #1e1b4b; }</style></head><body>";
            const postHtml = "</body></html>";
            
            // Remove the metadata div before exporting
            let exportHtml = currentPlanningHtml.replace(/<div id=["']metadata-planeacion["'][\s\S]*?<\/div>/i, '');
            
            const html = preHtml + exportHtml + postHtml;
            const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
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
    }

    finalizeBtn.onclick = () => { if(currentPlanningHtml) downloadBtn.click(); };
    newChatBtn.onclick = () => { conversationHistory = []; location.reload(); };

    // --- FUNCIONES DE CARGA DE DATOS ---

    async function loadProjectsHistory() {
        if (!USER_DATA?.uid) return;
        const container = document.getElementById('projects-history-container');
        if (!container) return;

        container.innerHTML = '<p class="loading-text">Cargando planeaciones...</p>';
        
        try {
            const q = query(
                collection(db, "proyectos"),
                where("uid", "==", USER_DATA.uid),
                orderBy("fecha", "desc") // Nota: Esto requerirá un índice compuesto en Firestore
            );
            
            // Para evitar errores si no hay índice todavía, hacemos el query básico y ordenamos en local si falla.
            const basicQ = query(collection(db, "proyectos"), where("uid", "==", USER_DATA.uid));
            
            onSnapshot(basicQ, (snapshot) => {
                if (snapshot.empty) {
                    container.innerHTML = '<p class="loading-text" style="grid-column: 1/-1; text-align:center;">Aún no tienes planeaciones guardadas.</p>';
                    return;
                }
                
                let proyectos = [];
                snapshot.forEach(doc => proyectos.push({ id: doc.id, ...doc.data() }));
                
                // Ordenar localmente por fecha descendente
                proyectos.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
                
                container.innerHTML = "";
                proyectos.forEach(p => {
                    const card = document.createElement('div');
                    card.style.cssText = "background: white; border-radius: 8px; padding: 15px; border: 1px solid #e2e8f0; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;";
                    card.onmouseover = () => { card.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)"; card.style.transform = "translateY(-2px)"; };
                    card.onmouseout = () => { card.style.boxShadow = "none"; card.style.transform = "none"; };
                    
                    const dateStr = p.fecha ? new Date(p.fecha).toLocaleDateString() : 'Sin fecha';
                    
                    card.innerHTML = `
                        <div style="font-size: 12px; color: #64748b; margin-bottom: 5px;">${dateStr}</div>
                        <h4 style="margin: 0 0 10px 0; color: #1e1b4b; font-size: 15px;">${p.nombre_proyecto || 'Proyecto'}</h4>
                        <p style="margin: 0; font-size: 13px; color: #475569; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                            <strong>Contenido:</strong> ${p.contenido || 'N/A'}<br>
                            <strong>PDA:</strong> ${p.pdas || 'N/A'}
                        </p>
                    `;
                    
                    card.onclick = () => {
                        if (p.html) {
                            updateViewer(p.html);
                            switchView('editor');
                        } else {
                            alert("Esta planeación es antigua y no tiene guardado su formato completo.");
                        }
                    };
                    
                    container.appendChild(card);
                });
            }, (error) => {
                console.error("Error cargando historial de proyectos:", error);
                container.innerHTML = '<p class="error-text">Error al cargar las planeaciones.</p>';
            });
        } catch (error) {
            console.error("Error al iniciar carga de proyectos:", error);
        }
    }

    async function loadCreditsHistory() {
        if (!USER_DATA?.uid) return;
        creditsHistoryContainer.innerHTML = '<p class="loading-text">Cargando movimientos...</p>';
        
        try {
            const q = query(
                collection(db, "transactions"),
                where("uid", "==", USER_DATA.uid)
            );
            
            onSnapshot(q, (snapshot) => {
                if (snapshot.empty) {
                    creditsHistoryContainer.innerHTML = '<p class="loading-text">No hay movimientos registrados.</p>';
                    return;
                }
                
                creditsHistoryContainer.innerHTML = "";
                
                let transacciones = [];
                snapshot.forEach(docSnap => {
                    transacciones.push(docSnap.data());
                });

                // Ordenar localmente por fecha descendente
                transacciones.sort((a, b) => {
                    const getTime = (f) => {
                        if (!f) return 0;
                        if (typeof f.toMillis === 'function') return f.toMillis();
                        if (f.seconds) return f.seconds * 1000;
                        if (typeof f === 'string' || typeof f === 'number') return new Date(f).getTime();
                        return 0;
                    };
                    return getTime(b.fecha) - getTime(a.fecha);
                });

                // Mostrar máximo 50
                transacciones.slice(0, 50).forEach(tx => {
                    let date = 'Reciente';
                    try {
                        if (tx.fecha) {
                            if (typeof tx.fecha.toDate === 'function') date = tx.fecha.toDate().toLocaleString();
                            else if (tx.fecha.seconds) date = new Date(tx.fecha.seconds * 1000).toLocaleString();
                            else if (typeof tx.fecha === 'string' || typeof tx.fecha === 'number') date = new Date(tx.fecha).toLocaleString();
                        }
                    } catch (e) {
                        console.error("Error fecha:", e);
                    }
                    
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
            }, (error) => {
                console.error("Error en Snapshot de historial:", error);
                creditsHistoryContainer.innerHTML = '<p class="loading-text" style="color:#ef4444;">No se pudo cargar el historial.</p>';
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


    // --- INTEGRACIÓN MERCADO PAGO GLOBAL (CON DIAGNÓSTICO) ---
    window.comprarCreditos = async function(btn) {
        console.log("--- INICIANDO PROCESO DE COMPRA ---");
        
        const pkgId = btn.getAttribute('data-pkg');
        const credits = btn.getAttribute('data-credits');
        const price = btn.getAttribute('data-price');
        
        console.log("Datos capturados:", { pkgId, credits, price, user: USER_DATA?.email });

        if (!USER_DATA) {
            alert("⚠️ Error: Debes iniciar sesión para realizar compras.");
            return;
        }

        // Feedback visual inmediato
        const originalText = btn.innerHTML;
        btn.innerHTML = `
            <svg class="spinner" width="18" height="18" viewBox="0 0 24 24" style="animation: spin 1s linear infinite; margin-right: 8px;">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" style="opacity: 0.25;"></circle>
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg> Conectando...
        `;
        btn.disabled = true;

        try {
            if (typeof gtag === 'function') gtag('event', 'checkout_started', { value: price, currency: 'MXN', items: [{ item_id: pkgId }] });
            console.log("Enviando petición a /api/create-preference...");
            const response = await fetch('/api/create-preference', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pkgId: pkgId,
                    uid: USER_DATA.uid,
                    email: USER_DATA.email
                })
            });

            const result = await response.json();
            console.log("Respuesta del servidor:", result);

            if (result.init_point) {
                console.log("Redirigiendo a Mercado Pago:", result.init_point);
                window.location.assign(result.init_point);
            } else {
                const errorMsg = result.error || "El servidor no devolvió un link de pago.";
                console.error("Fallo en la respuesta:", errorMsg);
                alert(`❌ No se pudo generar el pago:\n${errorMsg}\n\nVerifica que tus credenciales de Mercado Pago estén configuradas en el servidor.`);
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        } catch (error) {
            console.error("Error crítico en fetch:", error);
            alert(`⚠️ Error de conexión:\nNo se pudo contactar con el servidor de pagos. Detalles: ${error.message}`);
            btn.innerHTML = originalText;
            btn.disabled = false;
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

    // FEEDBACK
    window.sendFeedback = async () => {
        const textEl = document.getElementById('feedback-text');
        const btn = document.querySelector('.feedback-modal .btn-primary');
        const text = textEl.value.trim();
        if (!text) return alert("Por favor escribe algo antes de enviar.");
        
        btn.textContent = "Enviando...";
        btn.disabled = true;

        try {
            await addDoc(collection(db, "feedback"), {
                uid: USER_DATA?.uid || 'anon',
                email: USER_DATA?.email || 'anon',
                mensaje: text,
                fecha: new Date().toISOString()
            });
            alert("¡Gracias por tu sugerencia! La revisaremos pronto.");
            textEl.value = "";
            document.getElementById('feedback-modal').classList.remove('active');
        } catch (e) {
            console.error("Error al enviar feedback", e);
            alert("Hubo un error al enviar tu mensaje. Intenta de nuevo.");
        } finally {
            btn.textContent = "Enviar sugerencia";
            btn.disabled = false;
        }
    };
});
