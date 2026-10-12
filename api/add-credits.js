// api/add-credits.js - Permite al administrador añadir créditos a cualquier usuario desde el panel
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

let adminAuth = null;
let adminDb = null;
let firebaseInitError = null;

try {
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
    console.error("Error al inicializar Firebase Admin en add-credits:", error);
    firebaseInitError = error.message;
}

const ADMIN_EMAIL = "zlagustin10@gmail.com";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
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
    const { uid, creditsToAdd } = req.body;

    if (!uid) {
        return res.status(400).json({ error: 'Falta parámetro: uid' });
    }

    const amount = Number(creditsToAdd);
    if (isNaN(amount) || amount === 0) {
        return res.status(400).json({ error: 'La cantidad de créditos no es válida' });
    }

    try {
        const decodedToken = await adminAuth.verifyIdToken(token);
        if (decodedToken.email !== ADMIN_EMAIL) {
            return res.status(403).json({ error: 'Acceso denegado: Se requiere cuenta de administrador.' });
        }

        if (!adminDb || !adminAuth) {
            return res.status(500).json({ error: 'Error interno: Firebase Admin no inicializado completamente.' });
        }

        const userRef = adminDb.collection('usuarios').doc(uid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
            return res.status(404).json({ error: 'Usuario no encontrado en Firestore' });
        }

        const currentCredits = Number(userSnap.data().creditos) || 0;
        const newCredits = Math.max(0, currentCredits + amount);

        await userRef.update({
            creditos: newCredits,
            plan: 'premium'
        });

        // Registrar en transacciones
        await adminDb.collection('transactions').add({
            uid: uid,
            tipo: 'recarga_admin',
            creditos: amount,
            descripcion: `Ajuste manual de ${amount > 0 ? '+' : ''}${amount} créditos por Admin`,
            fecha: FieldValue.serverTimestamp(),
            monto: 0,
            metodo: 'Panel Admin'
        });

        return res.status(200).json({
            success: true,
            uid,
            creditosAnteriores: currentCredits,
            creditosNuevos: newCredits,
            message: `Créditos actualizados correctamente a ${newCredits}.`
        });
    } catch (error) {
        console.error("Error al actualizar créditos:", error);
        return res.status(500).json({ error: 'Error del servidor: ' + error.message });
    }
}
