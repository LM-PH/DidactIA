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

const ADMIN_EMAIL = "zlagustin10@gmail.com";

export default async function handler(req, res) {
    if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    if (firebaseInitError) {
        return res.status(500).json({ error: 'Error de inicialización de Firebase: ' + firebaseInitError });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autorizado: Falta token de autenticación.' });
    }

    const token = authHeader.split('Bearer ')[1];
    const { uid } = req.body;

    if (!uid) {
        return res.status(400).json({ error: 'Falta parámetro: uid' });
    }

    try {
        // Verificar token de administrador
        const decodedToken = await adminAuth.verifyIdToken(token);
        if (decodedToken.email !== ADMIN_EMAIL) {
            return res.status(403).json({ error: 'Acceso denegado: Se requiere cuenta de administrador.' });
        }

        if (!adminDb || !adminAuth) {
            return res.status(500).json({ error: 'Error interno: Firebase Admin no inicializado completamente.' });
        }

        // 1. Borrar de Firebase Authentication
        await adminAuth.deleteUser(uid);
        console.log(`Usuario ${uid} eliminado de Firebase Auth`);
    } catch (authErr) {
        // Si el token es inválido o expira
        if (authErr.code === 'auth/argument-error' || authErr.message.includes('token')) {
            return res.status(401).json({ error: 'Token de autenticación inválido.' });
        }
        // Si no existe en Auth, no es error crítico, continuamos a Firestore
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
