// api/grant-credits.js - Asignación directa de 50 créditos para areligonzalezmacias20@gmail.com
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

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
        adminDb = getFirestore();
    }
} catch (error) {
    console.error("Error al inicializar Firebase Admin:", error);
    firebaseInitError = error.message;
}

const TARGET_EMAIL = "areligonzalezmacias20@gmail.com";
const CREDITS_TO_ADD = 50;

export default async function handler(req, res) {
    if (firebaseInitError) {
        return res.status(500).json({ error: 'Error de inicialización de Firebase: ' + firebaseInitError });
    }

    if (!adminDb) {
        return res.status(500).json({ error: 'Firebase Admin DB no disponible. Verifica FIREBASE_SERVICE_ACCOUNT.' });
    }

    try {
        const usersSnap = await adminDb.collection('usuarios').where('email', '==', TARGET_EMAIL).get();

        if (usersSnap.empty) {
            return res.status(404).json({ 
                error: `Usuario con correo ${TARGET_EMAIL} no encontrado en la base de datos de usuarios.` 
            });
        }

        const results = [];

        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data();
            const currentCredits = Number(userData.creditos) || 0;
            const newCredits = currentCredits + CREDITS_TO_ADD;

            // Actualizar créditos y asegurar plan premium
            await userDoc.ref.update({
                creditos: newCredits,
                plan: 'premium'
            });

            // Registrar en la colección de transacciones para trazabilidad en la cuenta
            await adminDb.collection('transactions').add({
                uid: userDoc.id,
                tipo: 'recarga_admin',
                creditos: CREDITS_TO_ADD,
                descripcion: `Asignación de ${CREDITS_TO_ADD} créditos de regalo`,
                fecha: FieldValue.serverTimestamp(),
                monto: 0,
                metodo: 'Regalo Admin'
            });

            results.push({
                uid: userDoc.id,
                email: TARGET_EMAIL,
                nombre: userData.nombre || 'Docente',
                creditosAnteriores: currentCredits,
                creditosActuales: newCredits
            });
        }

        return res.status(200).json({
            success: true,
            message: `¡Se asignaron exitosamente ${CREDITS_TO_ADD} créditos a ${TARGET_EMAIL}!`,
            results
        });
    } catch (err) {
        console.error("Error al asignar créditos:", err);
        return res.status(500).json({ error: 'Error del servidor: ' + err.message });
    }
}
