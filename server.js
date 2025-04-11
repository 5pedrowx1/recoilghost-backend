const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const path = require('path');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

const app = express();
const YOUR_DOMAIN = 'https://r6-aim-keys.web.app';

app.use(cors());
app.use(express.json());

app.post('/create-checkout-session', async (req, res) => {
  const { plan } = req.query;

  let priceData;

  switch (plan) {
    case "tester":
      priceData = {
        currency: 'usd',
        product_data: { name: 'Plano Tester' },
        unit_amount: 0,
      };
      break;
    case "enthusiast":
      priceData = {
        currency: 'usd',
        product_data: { name: 'Plano Enthusiast' },
        unit_amount: 1500,
      };
      break;
    case "specialist":
      priceData = {
        currency: 'usd',
        product_data: { name: 'Plano Specialist' },
        unit_amount: 2000,
      };
      break;
    default:
      return res.status(400).json({ error: "Plano inválido" });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: priceData,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${YOUR_DOMAIN}/success.html`,
      cancel_url: `${YOUR_DOMAIN}/cancel.html`,
    });

    res.json({ sessionUrl: session.url });
  } catch (err) {
    console.error('Erro ao criar sessão:', err);
    res.status(500).json({ error: "Erro ao processar o pagamento" });
  }
});

app.get('/get-available-key', async (req, res) => {
  const { plan } = req.query;
  if (!plan) {
    return res.status(400).json({ error: "O parâmetro 'plan' é obrigatório" });
  }

  const now = new Date();
  let expiresAt;

  switch (plan) {
    case "tester":
      expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      break;
    case "enthusiast":
      expiresAt = new Date(now);
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      break;
    case "specialist":
      expiresAt = new Date(now);
      expiresAt.setFullYear(expiresAt.getFullYear() + 10);
      break;
    default:
      return res.status(400).json({ error: "Plano inválido" });
  }

  try {
    const keysSnapshot = await db.collection('keys')
      .where('used_by', '==', '')
      .limit(1)
      .get();

    if (keysSnapshot.empty) {
      return res.json({ key: null });
    }

    const doc = keysSnapshot.docs[0];
    const key = doc.id;

    await doc.ref.update({
      expires_at: Timestamp.fromDate(expiresAt)
    });

    res.json({ key, expires_at: expiresAt });
  } catch (error) {
    console.error('Erro ao buscar key:', error);
    res.status(500).json({ key: null });
  }
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));