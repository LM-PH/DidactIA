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
    console.error("Init Error:", error);
}

export default async function handler(req, res) {
    if (!adminDb) return res.status(500).json({ error: 'DB no init' });

    try {
        const results = [];

        // Specifically target chompsjery24@gmail.com as requested by admin
        const usersSnap = await adminDb.collection('usuarios').where('email', '==', 'chompsjery24@gmail.com').get();
        
        if (usersSnap.empty) {
            return res.status(404).json({ error: 'Usuario chompsjery24@gmail.com no encontrado' });
        }

        for (const doc of usersSnap.docs) {
            await doc.ref.update({
                creditos: 17,
                totalPlaneaciones: 4,
                plan: 'premium'
            });
            results.push(`Updated ${doc.data().email} (ID: ${doc.id}) -> creditos: 17, totalPlaneaciones: 4`);
        }

        res.status(200).json({ status: 'ok', results });
    } catch(e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
}
