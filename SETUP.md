# Saldo de Latas, Fora da Lei Rock Festival

Site de venda do saldo de latas (Pack do Festival, 12 latas Predileta Cream Ale, de R$300 por R$150).
Mesma arquitetura do projeto Namorados: Vercel + Mercado Pago Checkout Pro + Google Sheets + WhatsApp (CallMeBot), **sem reservas**.

## Como funciona

1. Cliente preenche nome, WhatsApp, quantidade, retirada ou entrega (e endereço).
2. Clica em pagar, vai pro Mercado Pago (Pix, cartão ou boleto).
3. Pagou, o Mercado Pago chama o webhook, que grava a venda na planilha e te avisa no WhatsApp.
4. Você entrega (ou separa pra retirada) e marca a coluna "Entregue?" na planilha.

## Estrutura

```
saldo-latas-fora-da-lei/
├── index.html              página de venda (formulário + checkout)
├── sucesso.html            confirmação pós-pagamento
├── logo.png                logo do festival
├── lata.png                imagem da lata
├── package.json
└── api/
    ├── criar-preferencia.js   cria o checkout no Mercado Pago (checa estoque antes)
    ├── webhook-mp.js          confirma pagamento, grava no Sheets, avisa no WhatsApp
    └── estoque.js             lê a planilha e retorna quanto resta de pack e avulsa
```

## Estoque

- `STOCK_PACKS` e `STOCK_UNITS` definem o estoque total (23 packs e 100 latas avulsas).
- O site lê os pedidos PAGOS na planilha e mostra/limita o disponível em tempo real.
- O backend também recusa a compra se não houver estoque suficiente.
- Observação: a baixa de estoque acontece quando o pagamento é aprovado. Em compras simultâneas do último item há um pequeno risco de venda a mais, aceitável neste volume.

## Passo a passo pra publicar (Vercel)

1. Suba esta pasta para um repositório no GitHub (ou reaproveite a conta da Vercel do projeto Namorados).
2. Na Vercel: New Project, importe o repositório.
3. Em Settings, Environment Variables, configure:

```
MP_ACCESS_TOKEN=...           (token de produção do Mercado Pago)
GOOGLE_SERVICE_ACCOUNT={...}  (JSON da Service Account, pode reusar a do Namorados)
GOOGLE_SHEET_ID=...           (ID de uma NOVA planilha pra latas)
SITE_URL=https://seu-projeto.vercel.app
STOCK_PACKS=23                (estoque de packs de 12 latas)
STOCK_UNITS=100               (estoque de latas avulsas)
```

4. Crie uma planilha Google nova com a aba "Página1" e cabeçalho:
   `Data | Nome | WhatsApp | Tipo | Endereço | Packs | Latas avulsas | Valor | Status | Payment ID | Entregue?`
5. Compartilhe a planilha com o e-mail da Service Account (permissão de Editor).
6. No painel do Mercado Pago, em Webhooks/Notificações, confirme a URL:
   `https://seu-projeto.vercel.app/api/webhook-mp` (evento: pagamentos).
7. Deploy. Teste uma compra de R$150 com Pix.

## Observações

- O Pixel da Meta (2032280697195908) e o GA4 (G-B92W6B9BLJ) já estão no HTML. Troque se quiser outra conta.
- WhatsApp de aviso (CallMeBot): ajuste número/apikey em `api/webhook-mp.js`. Hoje está o (51) 98014-4565.
- A planilha só recebe pedidos PAGOS (status approved), então ela já é sua lista de entrega.
- Sem controle de estoque automático. Se quiser limitar unidades, dá pra adicionar depois.
