const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const crypto = require('crypto');
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

/**
 * Cria uma sessão de checkout com Stripe.
 * O success_url inclui o parâmetro "plan" para uso na página de sucesso.
 */
app.post('/create-checkout-session', async (req, res) => {
  const { plan } = req.query;
  let priceData;
  switch (plan) {
    case "tester":
      priceData = {
        currency: 'usd',
        product_data: { name: 'Plano Tester' },
        unit_amount: 500, // US$5.00 (em centavos)
      };
      break;
    case "enthusiast":
      priceData = {
        currency: 'usd',
        product_data: { name: 'Plano Enthusiast' },
        unit_amount: 1500, // US$15.00
      };
      break;
    case "specialist":
      priceData = {
        currency: 'usd',
        product_data: { name: 'Plano Specialist' },
        unit_amount: 2000, // US$20.00
      };
      break;
    default:
      return res.status(400).json({ error: "Plano inválido" });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price_data: priceData, quantity: 1 }],
      mode: 'payment',
      // Inclui o plano na URL de sucesso para que possamos recuperá-lo na página success.html
      success_url: `${YOUR_DOMAIN}/success.html?plan=${plan}`,
      cancel_url: `${YOUR_DOMAIN}/cancel.html`,
    });
    res.json({ sessionUrl: session.url });
  } catch (err) {
    console.error('Erro ao criar sessão:', err);
    res.status(500).json({ error: "Error processing payment" });
  }
});

/**
 * Gera uma key no Firestore com base no plano escolhido.
 */
app.post('/generate-key', async (req, res) => {
  const { plan } = req.query;
  if (!plan) {
    return res.status(400).json({ error: "The 'plan' parameter is required" });
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
      return res.status(400).json({ error: "Invalid plan" });
  }

  const rawBytes = crypto.randomBytes(16);
  let keyString = rawBytes.toString('hex').toUpperCase();
  keyString = `${keyString.substring(0, 8)}-${keyString.substring(8, 16)}-${keyString.substring(16, 24)}-${keyString.substring(24, 32)}`;

  try {
    await db.collection('keys').doc(keyString).set({
      key: keyString,
      plan: plan,
      created_at: Timestamp.now(),
      expires_at: Timestamp.fromDate(expiresAt),
      used_by: ""
    });
    res.json({
      success: true,
      key: keyString,
      plan: plan,
      expires_at: expiresAt.toISOString()
    });
  } catch (error) {
    console.error('Erro ao gerar key:', error);
    res.status(500).json({ error: "Error generating key." });
  }
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));