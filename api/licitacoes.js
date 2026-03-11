export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { nicho } = req.body || {};

  const keywords = nicho === 'incendio'
    ? ['incendio', 'intumescente', 'corta-fogo', 'protecao passiva']
    : ['isolamento termico', 'refratario', 'isolamento industrial', 'caldeira isolamento'];

  const abertas = [];
  const proximas = [];
  const hoje = new Date();
  const vistos = new Set();

  for (const kw of keywords) {
    try {
      const url = `https://pncp.gov.br/api/search/?q=${encodeURIComponent(kw)}&tipos_documento=edital&pagina=1&tam_pagina=5`;
      const r = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }});
      if (!r.ok) continue;
      const data = await r.json();
      const items = data.items || [];

      for (const item of items) {
        const id = item.id || item.numero_controle_pncp;
        if (!id || vistos.has(id)) continue;
        vistos.add(id);

        // Montar link direto para o edital
        const cnpj = (item.orgao_cnpj || '').replace(/\D/g, '');
        const ano = item.ano || new Date().getFullYear();
        const seq = item.numero_sequencial_compra_ata || item.numero || '';
        const linkEdital = seq && cnpj
          ? `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}`
          : (item.item_url ? `https://pncp.gov.br${item.item_url}` : 'https://pncp.gov.br/app/editais');

        const licit = {
          titulo: item.title || item.description || 'Licitacao',
          descricao: item.description || item.title || '',
          orgao: item.orgao_nome || item.unidade_nome || '',
          uf: item.uf || '',
          municipio: item.municipio_nome || '',
          valor: item.valor_global || null,
          dataPublicacao: item.data_publicacao_pncp || item.createdAt || '',
          dataEncerramento: item.data_fim_vigencia || item.data_assinatura || '',
          numero: item.numero_controle_pncp || item.numero_sequencial_compra_ata || '',
          modalidade: item.modalidade_licitacao_nome || '',
          cnpjOrgao: item.orgao_cnpj || '',
          situacao: item.situacao_nome || '',
          link: linkEdital,
        };

        const enc = licit.dataEncerramento ? new Date(licit.dataEncerramento) : null;
        const situacaoAberta = item.situacao_id === 1 || item.situacao_nome === 'Divulgada no PNCP';

        if (situacaoAberta || (enc && enc > hoje)) {
          abertas.push(licit);
        } else {
          proximas.push(licit);
        }

        if (abertas.length + proximas.length >= 10) break;
      }
    } catch(e) {
      console.error('PNCP erro kw:', kw, e.message);
    }
    if (abertas.length >= 5) break;
  }

  return res.status(200).json({
    abertas: abertas.slice(0, 5),
    proximas: proximas.slice(0, 5)
  });
}
