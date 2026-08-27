import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

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

const ADMIN_EMAIL = "zlagustin10@gmail.com";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autorizado: Falta token de autenticación.' });
    }

    const token = authHeader.split('Bearer ')[1];

    try {
        const decodedToken = await getAuth().verifyIdToken(token);
        if (decodedToken.email !== ADMIN_EMAIL) {
            return res.status(403).json({ error: 'Acceso denegado: Se requiere cuenta de administrador.' });
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
