import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT || fs.readFileSync('/Users/luismiguelponceherrera/Downloads/didactia-app-firebase-adminsdk-fbsvc-efd44a2336.json', 'utf8');

initializeApp({
  credential: cert(JSON.parse(serviceAccountStr))
});

const db = getFirestore();

async function run() {
  const p = await db.collection('proyectos').limit(5).get();
  console.log("Proyectos count:", p.size);
  p.forEach(doc => console.log(doc.id, doc.data().uid, doc.data().email));
  
  const u = await db.collection('usuarios').limit(5).get();
  console.log("Usuarios:");
  u.forEach(doc => console.log(doc.id, doc.data().email, doc.data().uid));
}

run().catch(console.error);
