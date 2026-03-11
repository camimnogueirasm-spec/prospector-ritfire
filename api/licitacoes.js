export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { nicho } = req.body || {};
  const hoje = new Date();
  const vistos = new Set();
  const abertas = [];
  const proximas = [];

  // Palavras-chave de busca por nicho
  const keywords = nicho === 'incendio'
    ? ['protecao incendio', 'incendio passivo', 'corta fogo', 'intumescente', 'compartimentacao', 'porta corta fogo', 'selante fogo', 'revestimento incendio']
    : ['isolamento termico', 'isolamento industrial', 'refratario', 'isolamento caldeira', 'isolamento forno', 'revestimento termico', 'material termico', 'isolamento tubulacao'];

  // Palavras que CONFIRMAM relevância
  const confirma = nicho === 'incendio'
    ? ['incendio','incêndio','intumescente','corta-fogo','corta fogo','compartimentac','protecao passiva','proteção passiva','revestimento','selante','porta corta','spda','sprinkler','hidrante']
    : ['isolamento term','isolamento térmico','isolamento termico','refratár','refratario','caldeira','forno industrial','tubulac','material termico','isolante','termica','térmico'];

  // Palavras que EXCLUEM (irrelevante para Ritfire)
  const exclui = ['extintor','extintores','palco','som','iluminacao','iluminação','banheiro quimico','locacao de estrutura','locação de estrutura','merenda','uniforme','combustivel','combustível','veiculo','veículo','medicamento','software','informatica','transporte escolar','alimentacao','alimentação','limpeza urbana','coleta de lixo'];

  for (const kw of keywords) {
    if (abertas.length >= 5 && proximas.length >= 5) break;
    try {
      const url = `https://pncp.gov.br/api/search/?q=${encodeURIComponent(kw)}&tipos_documento=edital&pagina=1&tam_pagina=10&ordenacao=-data`;
      const r = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }});
      if (!r.ok) continue;
      const data = await r.json();
      const items = data.items || [];

      for (const item of items) {
        const id = item.id || item.numero_controle_pncp;
        if (!id || vistos.has(id)) continue;

        const texto = ((item.title||'') + ' ' + (item.description||'')).toLowerCase();

        // Filtra: deve confirmar nicho e não ter palavras excluídas
        const temConfirma = confirma.some(p => texto.includes(p));
        const temExclui = exclui.some(p => texto.includes(p));
        if (!temConfirma || temExclui) continue;

        vistos.add(id);

        const cnpj = (item.orgao_cnpj||'').replace(/\D/g,'');
        const ano = item.ano || hoje.getFullYear();
        const seq = item.numero_sequencial_compra_ata || '';
        const link = seq && cnpj
          ? `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}`
          : item.item_url ? `https://pncp.gov.br${item.item_url}` : 'https://pncp.gov.br/app/editais';

        const dataEncStr = item.data_fim_vigencia || '';
        const dataEnc = dataEncStr ? new Date(dataEncStr) : null;

        const licit = {
          titulo: item.title || 'Licitacao',
          descricao: item.description || '',
          orgao: item.orgao_nome || item.unidade_nome || '',
          uf: item.uf || '',
          municipio: item.municipio_nome || '',
          valor: item.valor_global || null,
          dataPublicacao: item.data_publicacao_pncp || item.createdAt || '',
          dataEncerramento: dataEncStr,
          numero: item.numero_controle_pncp || '',
          modalidade: item.modalidade_licitacao_nome || '',
          cnpjOrgao: item.orgao_cnpj || '',
          situacao: item.situacao_nome || '',
          link,
        };

        // Organiza: encerramento futuro = aberta, sem data ou passada = proxima
        if (dataEnc && dataEnc > hoje) {
          if (abertas.length < 5) abertas.push(licit);
        } else {
          if (proximas.length < 5) proximas.push(licit);
        }
      }
    } catch(e) {
      console.error('PNCP erro:', kw, e.message);
    }
  }

  return res.status(200).json({ abertas: abertas.slice(0,5), proximas: proximas.slice(0,5) });
}
