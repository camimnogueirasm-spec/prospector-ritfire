export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { nicho } = req.body || {};

  // Palavras-chave por nicho
  const keywords = nicho === 'incendio'
    ? ['incendio','intumescente','corta-fogo','compartimentacao','protecao passiva','spda','hidrante']
    : ['isolamento termico','isolamento industrial','refratario','caldeira','forno industrial','termico'];

  const hoje = new Date();
  const dataInicio = new Date(hoje - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 60 dias atrás
  const dataFim = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 30 dias à frente

  const abertas = [];
  const proximas = [];

  for (const kw of keywords.slice(0, 3)) {
    try {
      const url = `https://pncp.gov.br/api/search/?q=${encodeURIComponent(kw)}&tipos_documento=edital&ordenacao=-data&pagina=1&tam_pagina=5&status=recebendo_proposta`;
      const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!r.ok) continue;
      const data = await r.json();
      const items = data.items || data.data || [];

      for (const item of items.slice(0, 3)) {
        const licit = {
          titulo: item.objetoCompra || item.titulo || item.descricao || 'Licitação',
          orgao: item.nomeOrgao || item.orgaoEntidade?.razaoSocial || item.unidadeOrgao?.nomeUnidade || '',
          uf: item.uf || item.unidadeOrgao?.ufNome || '',
          municipio: item.municipio || item.unidadeOrgao?.municipioNome || '',
          valor: item.valorTotalEstimado || item.valorEstimadoTotal || null,
          dataAbertura: item.dataAberturaProposta || item.dataPublicacaoPncp || '',
          dataEncerramento: item.dataEncerramentoProposta || '',
          numero: item.numeroCompra || item.sequencialCompra || '',
          link: item.linkSistemaOrigem || `https://pncp.gov.br/app/editais/${item.cnpj}/${new Date().getFullYear()}/${item.sequencialCompra}`,
          modalidade: item.modalidadeNome || item.modalidade || '',
          cnpjOrgao: item.cnpj || '',
          status: item.situacaoCompraId === 1 ? 'aberta' : 'proxima'
        };

        const enc = new Date(licit.dataEncerramento);
        if (enc > hoje) {
          abertas.push(licit);
        } else {
          proximas.push(licit);
        }
      }
    } catch(e) {
      console.error('PNCP erro kw', kw, e.message);
    }
  }

  // Se não achou nada no PNCP, tenta endpoint alternativo
  if (abertas.length === 0) {
    try {
      const url2 = `https://pncp.gov.br/api/search/?q=${encodeURIComponent(keywords[0])}&tipos_documento=edital&pagina=1&tam_pagina=10`;
      const r2 = await fetch(url2, { headers: { 'Accept': 'application/json' } });
      if (r2.ok) {
        const data2 = await r2.json();
        const items2 = data2.items || data2.data || data2.resultado || [];
        for (const item of items2.slice(0, 5)) {
          abertas.push({
            titulo: item.objetoCompra || item.descricao || 'Licitação relacionada',
            orgao: item.nomeOrgao || item.orgaoEntidade?.razaoSocial || '',
            uf: item.uf || '',
            municipio: item.municipio || '',
            valor: item.valorTotalEstimado || null,
            dataAbertura: item.dataPublicacaoPncp || '',
            dataEncerramento: item.dataEncerramentoProposta || '',
            numero: item.sequencialCompra || '',
            link: item.linkSistemaOrigem || 'https://pncp.gov.br',
            modalidade: item.modalidadeNome || '',
            cnpjOrgao: item.cnpj || '',
            status: 'aberta'
          });
        }
      }
    } catch(e) { console.error('PNCP alt erro', e.message); }
  }

  return res.status(200).json({
    abertas: abertas.slice(0, 5),
    proximas: proximas.slice(0, 5)
  });
}
