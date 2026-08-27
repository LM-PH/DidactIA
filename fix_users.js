import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT || fs.readFileSync('/Users/luismiguelponceherrera/Downloads/didactia-app-firebase-adminsdk-fbsvc-efd44a2336.json', 'utf8');

initializeApp({
  credential: cert(JSON.parse(serviceAccountStr))
});

const db = getFirestore();

async function fixUsers() {
  console.log("Fetching transactions...");
  const txSnap = await db.collection('transactions').get();
  const purchasesByUid = {};
  
  txSnap.forEach(doc => {
    const tx = doc.data();
    if (tx.tipo === 'compra' && tx.creditos > 0) {
      if (!purchasesByUid[tx.uid]) {
        purchasesByUid[tx.uid] = 0;
      }
      purchasesByUid[tx.uid] += tx.creditos;
    }
  });

  console.log("Purchases by UID:", purchasesByUid);

  for (const [uid, totalBought] of Object.entries(purchasesByUid)) {
    const userRef = db.collection('usuarios').doc(uid);
    const userSnap = await userRef.get();
    if (userSnap.exists) {
        const userData = userSnap.data();
        if (userData.creditos < totalBought) {
            console.log(`Fixing user ${userData.email} (${uid}): has ${userData.creditos}, should have at least ${totalBought}`);
            // Wait, what if they spent some?
            // If they had their profile recreated, their 'creditos' was set to 1.
            // If they actually had totalBought credits + 1 initial - what they spent...
            // Let's count how many planeaciones they made to deduct properly!
            const planesSnap = await db.collection('proyectos').where('uid', '==', uid).get();
            const planesCount = planesSnap.size;
            
            // Expected credits = 1 (free) + totalBought - planesCount
            // Let's check how many they should have
            let expected = 1 + totalBought - planesCount;
            if (expected < 0) expected = 0;
            
            console.log(`User ${userData.email} made ${planesCount} planes. Expected credits: ${expected}. Currently has: ${userData.creditos}`);
            
            if (userData.creditos !== expected) {
                await userRef.update({
                    creditos: expected,
                    plan: 'premium'
                });
                console.log(`-> Updated to ${expected}`);
            }
        }
    }
  }

  // Also let's debug why projects are showing as 0 in admin.
  // Maybe uid is saved differently or we need to check an example.
  console.log("Fetching projects...");
  const pSnap = await db.collection('proyectos').limit(1).get();
  pSnap.forEach(p => {
    console.log("Sample project:", p.id, p.data().uid, p.data().email);
  });
}

fixUsers().catch(console.error);
