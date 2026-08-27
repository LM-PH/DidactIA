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
            if (tx.creditos > 0) {
                if (!purchasesByUid[tx.uid]) purchasesByUid[tx.uid] = 0;
                purchasesByUid[tx.uid] += tx.creditos;
            }
        });

        const results = [];
        const debugInfo = [];

        for (const [uid, totalBought] of Object.entries(purchasesByUid)) {
            const userRef = adminDb.collection('usuarios').doc(uid);
            const userSnap = await userRef.get();
            if (userSnap.exists) {
                const userData = userSnap.data();
                const planesCount = userData.totalPlaneaciones || 0;
                
                let expected = 1 + totalBought - planesCount;
                if (expected < 0) expected = 0;
                
                debugInfo.push({ email: userData.email, totalBought, planesCount, current: userData.creditos, expected });
                
                if ((userData.creditos || 0) < expected) {
                    await userRef.update({
                        creditos: expected,
                        plan: 'premium'
                    });
                    results.push(`Updated ${userData.email} from ${userData.creditos} to ${expected}`);
                }
            } else {
                debugInfo.push({ uid, status: 'Not found in usuarios' });
            }
        }
        
        res.status(200).json({ status: 'ok', results, debugInfo });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
}
