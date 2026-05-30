import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let adminDb = null;

try {
    if (!getApps().length) {
        const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (serviceAccountStr) {
            initializeApp({
                credential: cert(JSON.parse(serviceAccountStr))
            });
        }
    }
    if (getApps().length) {
        adminDb = getFirestore();
    }
} catch (error) {
    console.error("Error inicializando Firebase Admin en list-users:", error);
}

// Función auxiliar para hashear la contraseña
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const { adminHash } = req.body;

    if (!adminHash) {
        return res.status(400).json({ error: 'Falta la autenticación de administrador' });
    }

    try {
        // Mismo hash que en admin.html
        const ADMIN_HASH = "3a3cd7dfd12e7429e15f7714d55e1bd587e63d5c46e770f960f3d04aff7a296a";
        
        if (adminHash !== ADMIN_HASH) {
            return res.status(403).json({ error: 'Autenticación de administrador incorrecta' });
        }

        if (!adminDb) {
            return res.status(500).json({ error: 'Error interno: Firebase Admin no inicializado' });
        }

        // Obtener usuarios ordenados por fechaRegistro
        const snapshot = await adminDb.collection('usuarios').orderBy('fechaRegistro', 'desc').get();
        const users = [];
        
        snapshot.forEach(doc => {
            users.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return res.status(200).json({ users });
    } catch (error) {
        console.error("Error al listar usuarios:", error);
        return res.status(500).json({ error: 'Error del servidor: ' + error.message });
    }
}
