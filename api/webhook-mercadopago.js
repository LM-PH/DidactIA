import { MercadoPagoConfig, Payment } from 'mercadopago';
import admin from 'firebase-admin';

// Inicializar Firebase Admin si no está inicializado
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
    });
}

const db = admin.firestore();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method not allowed');

    const { query } = req;
    const topic = query.topic || req.body.type;
    const id = query.id || (req.body.data && req.body.data.id);

    if (topic === 'payment' && id) {
        try {
            const client = new MercadoPagoConfig({ 
                accessToken: process.env.MP_ACCESS_TOKEN 
            });
            const payment = new Payment(client);
            
            const paymentData = await payment.get({ id: id });
            
            if (paymentData.status === 'approved') {
                const uid = paymentData.external_reference;
                const creditsToAdd = Number(paymentData.metadata.credits);
                const paymentId = String(paymentData.id);

                // Evitar duplicados revisando si este paymentId ya fue procesado
                const txRef = db.collection('transactions').doc(`pay_${paymentId}`);
                const txSnap = await txRef.get();

                if (!txSnap.exists) {
                    const userRef = db.collection('usuarios').doc(uid);
                    
                    await db.runTransaction(async (t) => {
                        const userSnap = await t.get(userRef);
                        if (!userSnap.exists) throw new Error("Usuario no encontrado");
                        
                        const currentCredits = userSnap.data().creditos || 0;
                        
                        // Actualizar créditos
                        t.update(userRef, {
                            creditos: currentCredits + creditsToAdd
                        });

                        // Registrar transacción
                        t.set(txRef, {
                            uid: uid,
                            tipo: 'compra',
                            creditos: creditsToAdd,
                            descripcion: `Compra de ${creditsToAdd} créditos (MP)`,
                            fecha: admin.firestore.FieldValue.serverTimestamp(),
                            referencia: paymentId,
                            monto: paymentData.transaction_amount,
                            metodo: paymentData.payment_method_id
                        });
                    });

                    console.log(`Pago aprobado: ${creditsToAdd} créditos añadidos a ${uid}`);
                } else {
                    console.log(`Pago ${paymentId} ya procesado anteriormente.`);
                }
            }
        } catch (error) {
            console.error('Error procesando webhook:', error);
            return res.status(500).send('Webhook Error');
        }
    }

    res.status(200).send('OK');
}
