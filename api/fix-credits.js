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
        const txSnap = await adminDb.collection('transactions').where('tipo', '==', 'compra').get();
        const purchasesByUid = {};
        
        txSnap.forEach(doc => {
            const tx = doc.data();
            if (tx.creditos > 0 && tx.uid) {
                if (!purchasesByUid[tx.uid]) purchasesByUid[tx.uid] = 0;
                purchasesByUid[tx.uid] += tx.creditos;
            }
        });

        const results = [];
        const debugInfo = [];

        // Pre-fetch all proyectos and planeaciones to accurately count per user
        const proyectosSnap = await adminDb.collection('proyectos').get();
        const planeacionesSnap = await adminDb.collection('planeaciones').get();

        const planeacionesCountByUid = {};
        const planeacionesCountByEmail = {};

        proyectosSnap.forEach(doc => {
            const data = doc.data();
            if (data.uid) {
                planeacionesCountByUid[data.uid] = (planeacionesCountByUid[data.uid] || 0) + 1;
            }
            if (data.email) {
                planeacionesCountByEmail[data.email] = (planeacionesCountByEmail[data.email] || 0) + 1;
            }
        });

        planeacionesSnap.forEach(doc => {
            const data = doc.data();
            if (data.uid) {
                planeacionesCountByUid[data.uid] = (planeacionesCountByUid[data.uid] || 0) + 1;
            }
            if (data.email) {
                planeacionesCountByEmail[data.email] = (planeacionesCountByEmail[data.email] || 0) + 1;
            }
        });

        // Also update all users with their accurate totalPlaneaciones count
        const allUsersSnap = await adminDb.collection('usuarios').get();
        for (const userDoc of allUsersSnap.docs) {
            const uid = userDoc.id;
            const userData = userDoc.data();
            const email = userData.email;

            const realPlaneaciones = Math.max(
                planeacionesCountByUid[uid] || 0,
                planeacionesCountByEmail[email] || 0,
                userData.totalPlaneaciones || 0
            );

            const totalBought = purchasesByUid[uid] || 0;

            // If user bought credits or has planeaciones, let's sync their totalPlaneaciones
            if (userData.totalPlaneaciones !== realPlaneaciones) {
                await userDoc.ref.update({ totalPlaneaciones: realPlaneaciones });
            }

            if (totalBought > 0) {
                // Expected credits = 1 (free) + totalBought - realPlaneaciones
                let expected = 1 + totalBought - realPlaneaciones;
                if (expected < 0) expected = 0;

                debugInfo.push({
                    email: userData.email,
                    uid,
                    totalBought,
                    realPlaneaciones,
                    currentCredits: userData.creditos,
                    expectedCredits: expected
                });

                if ((userData.creditos || 0) < expected) {
                    await userDoc.ref.update({
                        creditos: expected,
                        plan: 'premium',
                        totalPlaneaciones: realPlaneaciones
                    });
                    results.push(`Restored ${userData.email}: creditos updated from ${userData.creditos} to ${expected}`);
                }
            }
        }
        
        res.status(200).json({ status: 'ok', results, debugInfo });
    } catch(e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
}
