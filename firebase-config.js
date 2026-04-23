// firebase-config.js - Configuración del proyecto DidactIA en Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCtKaQ3rZPxz4XJNnk3QCBTVhGiU4zQ-n0",
    authDomain: "edu-lm.firebaseapp.com",
    projectId: "edu-lm",
    storageBucket: "edu-lm.firebasestorage.app",
    messagingSenderId: "971708339984",
    appId: "1:971708339984:web:9aa2217a389ff371dab795"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
