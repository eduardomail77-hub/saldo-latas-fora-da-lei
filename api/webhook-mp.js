const { MercadoPagoConfig, Payment } = require('mercadopago');
const { google } = require('googleapis');
const https = require('https');

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

async function enviarWhatsApp(d, paymentId) {
  try {
    const partes = [];
    if (d.packs > 0) partes.push(`${d.packs} pack(s) de 12`);
    if (d.units > 0) partes.push(`${d.units} lata(s) avulsa(s)`);
    const itemTxt = partes.join(' + ');
    const msg = `🍺 Novo pedido de latas PAGO!\n👤 ${d.nome}\n📦 ${itemTxt}\n🚚 ${d.tipo}\n📍 ${d.endereco}\n💰 R$ ${d.valor},00\n📱 WhatsApp: ${d.whatsapp}\n🆔 ID: ${paymentId}`;
    const encoded = encodeURIComponent(msg);
    // Troque os números/apikeys do CallMeBot conforme seu cadastro
    const urls = [
      `https://api.callmebot.com/whatsapp.php?phone=555180144565&text=${encoded}&apikey=1059558`,
    ];
    await Promise.all(urls.map(url =>
      new Promise((resolve) => {
        const req = https.get(url, (res) => { res.resume(); resolve(); });
        req.on('error', resolve);
        req.setTimeout(5000, () => { req.destroy(); resolve(); });
      })
    ));
  } catch (err) {
    console.error('Erro WhatsApp:', err.message);
  }
}

async function registrarNoSheets(d, paymentId) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Página1!A:K',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          new Date().toLocaleString('pt-BR'), // A Data
          d.nome,                              // B Nome
          d.whatsapp || '-',                   // C WhatsApp
          d.tipo,                              // D Retirada/Entrega
          d.endereco || '-',                   // E Endereço
          d.packs || 0,                        // F Packs
          d.units || 0,                        // G Latas avulsas
          `R$ ${d.valor},00`,                  // H Valor
          'PAGO ✅',                            // I Status
          paymentId,                           // J Payment ID
          '',                                  // K Entregue? (você preenche)
        ]],
      },
    });
  } catch (err) {
    console.error('Erro Sheets:', err.message);
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(200).end();

  try {
    const { type, data } = req.body;

    if (type === 'payment' && data?.id) {
      const payment = new Payment(mp);
      const pagamento = await payment.get({ id: data.id });

      const status = pagamento.status;
      const ref = pagamento.external_reference;

      // Só grava e avisa quando o pagamento está aprovado (lista limpa = só pagos)
      if (ref && status === 'approved') {
        const d = JSON.parse(ref);
        await registrarNoSheets(d, String(data.id));
        await enviarWhatsApp(d, String(data.id));
      }
    }

    return res.status(200).send('OK');
  } catch (err) {
    console.error('Erro webhook:', err);
    return res.status(500).send('Erro');
  }
};
