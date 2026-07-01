const { MercadoPagoConfig, Preference } = require('mercadopago');
const { google } = require('googleapis');

// ── Mercado Pago
const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

// ── Estoque
const STOCK_PACKS = parseInt(process.env.STOCK_PACKS || '23', 10);
const STOCK_UNITS = parseInt(process.env.STOCK_UNITS || '100', 10);

async function calcularVendido() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Página1!F:I', // F=Packs, G=Latas avulsas, H=Valor, I=Status
  });
  const rows = r.data.values || [];
  let packs = 0, units = 0;
  for (const row of rows) {
    const status = (row[3] || '').toLowerCase();
    if (!status.includes('pago')) continue;
    packs += parseInt(row[0], 10) || 0;
    units += parseInt(row[1], 10) || 0;
  }
  return { packs, units };
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  try {
    const d = req.body;

    // Dados mínimos
    if (!d.nome || !d.whatsapp) {
      return res.status(400).json({ error: 'Nome e WhatsApp são obrigatórios.' });
    }

    const packs = Math.max(0, parseInt(d.packs, 10) || 0);
    const units = Math.max(0, parseInt(d.units, 10) || 0);
    const entrega = d.tipo === 'entrega';

    if (packs + units < 1) {
      return res.status(400).json({ error: 'Escolha pelo menos 1 pack ou 1 lata.' });
    }
    if (entrega && (!d.endereco || d.endereco.trim().length < 6)) {
      return res.status(400).json({ error: 'Informe o endereço de entrega.' });
    }

    // Checa estoque (se a leitura falhar, não trava a venda)
    try {
      const v = await calcularVendido();
      if (packs > (STOCK_PACKS - v.packs) || units > (STOCK_UNITS - v.units)) {
        return res.status(409).json({
          error: `Estoque insuficiente. Restam ${Math.max(0, STOCK_PACKS - v.packs)} pack(s) e ${Math.max(0, STOCK_UNITS - v.units)} lata(s).`,
        });
      }
    } catch (e) {
      console.error('Falha ao checar estoque:', e.message);
    }

    // Itens do checkout
    const items = [];
    if (packs > 0) items.push({
      title: 'Pack do Festival, 12 latas Predileta Cream Ale 473ml',
      description: 'Saldo do Fora da Lei Rock Festival, pack com 12 latas colecionaveis',
      quantity: packs, unit_price: 150, currency_id: 'BRL',
    });
    if (units > 0) items.push({
      title: 'Lata Predileta Cream Ale 473ml (avulsa)',
      description: 'Saldo do Fora da Lei Rock Festival, lata colecionavel avulsa',
      quantity: units, unit_price: 15, currency_id: 'BRL',
    });
    if (entrega) items.push({
      title: 'Entrega em Porto Alegre',
      quantity: 1, unit_price: 20, currency_id: 'BRL',
    });

    const valorTotal = packs * 150 + units * 15 + (entrega ? 20 : 0);

    // Cria preferência no Mercado Pago
    const preference = new Preference(mp);
    const result = await preference.create({
      body: {
        items,
        payer: {
          name: d.nome,
          email: d.email || undefined,
        },
        back_urls: {
          success: `${process.env.SITE_URL}/sucesso.html`,
          failure: `${process.env.SITE_URL}/`,
          pending: `${process.env.SITE_URL}/`,
        },
        auto_return: 'approved',
        external_reference: JSON.stringify({
          nome: d.nome,
          whatsapp: d.whatsapp,
          tipo: entrega ? 'Entrega' : 'Retirada',
          endereco: entrega ? d.endereco : '-',
          packs,
          units,
          valor: valorTotal,
        }),
        notification_url: `${process.env.SITE_URL}/api/webhook-mp`,
      },
    });

    return res.status(200).json({ init_point: result.init_point });

  } catch (err) {
    console.error('Erro ao criar preferência MP:', err);
    return res.status(500).json({ error: 'Erro interno ao criar pagamento.' });
  }
};
