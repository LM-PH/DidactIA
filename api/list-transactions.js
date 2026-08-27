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
    console.error("Error inicializando Firebase Admin en list-transactions:", error);
}

const ADMIN_EMAIL = "zlagustin10@gmail.com";

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
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

        // Obtener transacciones de tipo 'compra'
        const snapshot = await adminDb.collection('transactions')
            .where('tipo', '==', 'compra')
            .get();

        const purchases = [];

        // Obtener mapa de usuarios para asociar nombre y email si es necesario
        const usersSnap = await adminDb.collection('usuarios').get();
        const usersMap = {};
        usersSnap.forEach(doc => {
            usersMap[doc.id] = doc.data();
        });

        snapshot.forEach(doc => {
            const data = doc.data();
            const userInfo = usersMap[data.uid] || {};
            
            purchases.push({
                id: doc.id,
                ...data,
                userNombre: userInfo.nombre || userInfo.nickname || 'Usuario',
                userEmail: userInfo.email || data.email || 'Desconocido',
                fecha: data.fecha && data.fecha.toDate ? data.fecha.toDate().toISOString() : data.fecha
            });
        });

        // Ordenar por fecha descendente
        purchases.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

        return res.status(200).json({ purchases });
    } catch (error) {
        console.error("Error al listar transacciones:", error);
        return res.status(500).json({ error: 'Error del servidor: ' + error.message });
    }
}
