import { MercadoPagoConfig, Payment } from 'mercadopago';
import admin from 'firebase-admin';

let db = null;
let firebaseInitError = null;

try {
    // Inicializar Firebase Admin si no está inicializado
    if (!admin.apps.length) {
        const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (serviceAccountStr) {
            admin.initializeApp({
                credential: admin.credential.cert(JSON.parse(serviceAccountStr))
            });
        }
    }
    db = admin.apps.length ? admin.firestore() : null;
} catch (error) {
    console.error("Error al inicializar Firebase Admin en webhook:", error);
    firebaseInitError = error.message;
}

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

                const txRef = db.collection('transactions').doc(`pay_${paymentId}`);
                const userRef = db.collection('usuarios').doc(uid);
                
                let alreadyProcessed = false;

                await db.runTransaction(async (t) => {
                    // Evitar duplicados leyendo DENTRO de la transacción
                    const txSnap = await t.get(txRef);
                    if (txSnap.exists) {
                        alreadyProcessed = true;
                        return; // Salir silenciosamente
                    }

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
                        
                        // Enviar recibo por correo fuera de la transacción (para evitar reintentos si falla algo interno)
                        if (process.env.RESEND_API_KEY && userSnap.data().email) {
                            fetch('https://api.resend.com/emails', {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    from: 'DidactIA <hola@didactia.app>',
                                    to: [userSnap.data().email],
                                    subject: 'Recibo de Compra - DidactIA',
                                    html: `<div style="font-family:sans-serif; padding:20px; text-align:center;">
                                        <h2>¡Gracias por tu compra!</h2>
                                        <p>Hemos añadido <strong>${creditsToAdd} créditos</strong> a tu cuenta exitosamente.</p>
                                        <p>Monto pagado: $${paymentData.transaction_amount} MXN</p>
                                        <p>Sigue creando planeaciones increíbles en <a href="https://didactia.app">DidactIA</a>.</p>
                                    </div>`
                                })
                            }).catch(err => console.error("Error enviando correo de recibo:", err));
                        }
                    });

                    if (!alreadyProcessed) {
                        console.log(`Pago aprobado: ${creditsToAdd} créditos añadidos a ${uid}`);
                    }
                }
            }
        } catch (error) {
            console.error('Error procesando webhook:', error);
            return res.status(500).send('Webhook Error');
        }
    }

    res.status(200).send('OK');
}
