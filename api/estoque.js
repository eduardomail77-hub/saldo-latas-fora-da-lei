const { google } = require('googleapis');

const STOCK_PACKS = parseInt(process.env.STOCK_PACKS || '23', 10);
const STOCK_UNITS = parseInt(process.env.STOCK_UNITS || '100', 10);

// Soma o que já foi vendido (linhas PAGO) lendo a planilha
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const v = await calcularVendido();
    return res.status(200).json({
      packsLeft: Math.max(0, STOCK_PACKS - v.packs),
      unitsLeft: Math.max(0, STOCK_UNITS - v.units),
      packsTotal: STOCK_PACKS,
      unitsTotal: STOCK_UNITS,
    });
  } catch (err) {
    console.error('Erro estoque:', err.message);
    // Em caso de falha, devolve o estoque cheio para não travar a venda
    return res.status(200).json({
      packsLeft: STOCK_PACKS, unitsLeft: STOCK_UNITS,
      packsTotal: STOCK_PACKS, unitsTotal: STOCK_UNITS, erro: true,
    });
  }
};
