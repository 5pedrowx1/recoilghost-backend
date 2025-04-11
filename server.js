const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const YOUR_DOMAIN = 'https://recoilghost-backend.onrender.com'; // <- frontend

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
        unit_amount: 500,
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

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));