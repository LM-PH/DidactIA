const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
try {
  const serviceAccount = JSON.parse(fs.readFileSync('/Users/luismiguelponceherrera/Downloads/didactia-app-firebase-adminsdk-fbsvc-efd44a2336.json', 'utf8'));
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();
  db.collection('proyectos').limit(1).get().then(p => {
    fs.writeFileSync('out.txt', 'Success: ' + p.size);
    process.exit(0);
  }).catch(e => {
    fs.writeFileSync('out.txt', 'Error DB: ' + e.message);
    process.exit(1);
  });
} catch(e) {
  fs.writeFileSync('out.txt', 'Error INIT: ' + e.message);
  process.exit(1);
}
