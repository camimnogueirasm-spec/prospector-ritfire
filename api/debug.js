export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const url = 'https://pncp.gov.br/api/search/?q=incendio&tipos_documento=edital&pagina=1&tam_pagina=2';
    const r = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }});
    const text = await r.text();
    return res.status(200).json({ status: r.status, body: text.slice(0, 3000) });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
