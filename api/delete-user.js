// api/delete-user.js - Elimina usuario de Firebase Auth + Firestore
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let adminAuth = null;
let adminDb = null;
let firebaseInitError = null;

try {
    // Inicializar Firebase Admin solo una vez
    if (!getApps().length) {
        const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (serviceAccountStr) {
            const serviceAccount = JSON.parse(serviceAccountStr);
            initializeApp({ credential: cert(serviceAccount) });
        }
    }
    if (getApps().length) {
        adminAuth = getAuth();
        adminDb = getFirestore();
    }
} catch (error) {
    console.error("Error al inicializar Firebase Admin en delete-user:", error);
    firebaseInitError = error.message;
}

// Hash SHA-256 de la contraseña admin (misma que en admin.html)
const ADMIN_HASH = "3a3cd7dfd12e7429e15f7714d55e1bd587e63d5c46e770f960f3d04aff7a296a";

async function sha256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0')).join('');
}

export default async function handler(req, res) {
    if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const { uid, adminPassword } = req.body;

    if (!uid || !adminPassword) {
        return res.status(400).json({ error: 'Faltan parámetros: uid y adminPassword' });
    }

    // Verificar contraseña admin
    const hash = await sha256(adminPassword);
    if (hash !== ADMIN_HASH) {
        return res.status(403).json({ error: 'No autorizado' });
    }

    try {
        // 1. Borrar de Firebase Authentication
        await adminAuth.deleteUser(uid);
        console.log(`Usuario ${uid} eliminado de Firebase Auth`);
    } catch (authErr) {
        // Si no existe en Auth, no es error crítico
        if (authErr.code !== 'auth/user-not-found') {
            console.error('Error Auth:', authErr.message);
        }
    }

    try {
        // 2. Borrar de Firestore
        await adminDb.collection('usuarios').doc(uid).delete();
        console.log(`Usuario ${uid} eliminado de Firestore`);
    } catch (dbErr) {
        return res.status(500).json({ error: 'Error al borrar de Firestore: ' + dbErr.message });
    }

    return res.status(200).json({ success: true, message: 'Usuario eliminado de Auth y Firestore' });
}
