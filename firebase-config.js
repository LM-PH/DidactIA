// firebase-config.js - Configuración del proyecto DidactIA en Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCNPodfCSZ0G3fy8rClQjNh7ixlveh3g9I",
    authDomain: "didactia-app.firebaseapp.com",
    projectId: "didactia-app",
    storageBucket: "didactia-app.firebasestorage.app",
    messagingSenderId: "1096182455883",
    appId: "1:1096182455883:web:c866542328c444bf61b7ce"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
