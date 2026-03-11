export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { nicho } = req.body || {};

  const keywords = nicho === 'incendio'
    ? ['revestimento intumescente', 'selante corta fogo', 'porta corta fogo', 'protecao passiva incendio', 'compartimentacao incendio']
    : ['isolamento termico industrial', 'revestimento refratario', 'isolamento caldeira', 'isolamento forno industrial', 'material refratario industrial'];

  // Palavras que DEVEM aparecer para validar relevância
  const palavrasRelevantesIncendio = ['incendio','intumescente','corta-fogo','corta fogo','compartimentacao','compartimentação','protecao passiva','proteção passiva','revestimento','selante','spda','hidrante','sprinkler'];
  const palavrasRelevantesTermico = ['isolamento termico','isolamento térmico','refratario','refratário','caldeira','forno industrial','tubulacao','tubulação','termico','térmico','isolante'];
  const palavrasRelevantes = nicho === 'incendio' ? palavrasRelevantesIncendio : palavrasRelevantesTermico;

  // Palavras que indicam licitação IRRELEVANTE
  const palavrasIrrelevantes = ['palco','som','iluminacao','iluminação','banheiro quimico','locacao de estrutura','festa','evento','alimentacao','alimentação','limpeza urbana','coleta de lixo','transporte escolar','merenda','uniforme','combustivel','combustível','veiculo','veículo','medicamento','consultoria','software','informatica','informática'];

  const abertas = [];
  const proximas = [];
  const hoje = new Date();
  const vistos = new Set();

  for (const kw of keywords) {
    try {
      // Busca editais recentes — sem filtro de status para pegar mais resultados
      const url = `https://pncp.gov.br/api/search/?q=${encodeURIComponent(kw)}&tipos_documento=edital&pagina=1&tam_pagina=10&ordenacao=-data`;
      const r = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }});
      if (!r.ok) continue;
      const data = await r.json();
      const items = data.items || [];

      for (const item of items) {
        const id = item.id || item.numero_controle_pncp;
        if (!id || vistos.has(id)) continue;
        vistos.add(id);

        const cnpj = (item.orgao_cnpj || '').replace(/\D/g, '');
        const ano = item.ano || new Date().getFullYear();
        const seq = item.numero_sequencial_compra_ata || item.numero || '';
        const linkEdital = seq && cnpj
          ? `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}`
          : (item.item_url ? `https://pncp.gov.br${item.item_url}` : 'https://pncp.gov.br/app/editais');

        // Pega data de encerramento ou fim de vigência
        const dataEncStr = item.data_fim_vigencia || item.data_assinatura || '';
        const dataEnc = dataEncStr ? new Date(dataEncStr) : null;

        // Pega data de abertura de propostas
        const dataAbrStr = item.data_publicacao_pncp || item.createdAt || '';
        const dataAbr = dataAbrStr ? new Date(dataAbrStr) : null;

        const licit = {
          titulo: item.title || item.description?.slice(0, 100) || 'Licitacao',
          descricao: item.description || '',
          orgao: item.orgao_nome || item.unidade_nome || '',
          uf: item.uf || '',
          municipio: item.municipio_nome || '',
          valor: item.valor_global || null,
          dataPublicacao: dataAbrStr,
          dataEncerramento: dataEncStr,
          numero: item.numero_controle_pncp || '',
          modalidade: item.modalidade_licitacao_nome || '',
          cnpjOrgao: item.orgao_cnpj || '',
          situacao: item.situacao_nome || '',
          link: linkEdital,
        };

        // Filtra por relevância — descarta licitações fora do contexto Ritfire
        const textoLicit = (licit.titulo + ' ' + licit.descricao).toLowerCase();
        const eRelevante = palavrasRelevantes.some(p => textoLicit.includes(p));
        const eIrrelevante = palavrasIrrelevantes.some(p => textoLicit.includes(p));
        if (!eRelevante || eIrrelevante) continue;

        // Só aceita licitações com encerramento FUTURO (após hoje)
        if (dataEnc && dataEnc > hoje) {
          // Abre em menos de 7 dias = proxima, senão = aberta em andamento
          const diasAteEnc = (dataEnc - hoje) / (1000 * 60 * 60 * 24);
          if (diasAteEnc <= 30) {
            abertas.push(licit);
          } else {
            proximas.push(licit);
          }
        } else if (!dataEnc && dataAbr && dataAbr > hoje) {
          // Sem data de enc mas publicação futura = proxima
          proximas.push(licit);
        }
        // Ignora licitações já encerradas
      }
    } catch(e) {
      console.error('PNCP erro kw:', kw, e.message);
    }
    if (abertas.length >= 5 && proximas.length >= 5) break;
  }

  // Se não achou abertas com data futura, pega as mais recentes sem filtro de data
  if (abertas.length === 0) {
    for (const kw of keywords.slice(0, 2)) {
      try {
        const url = `https://pncp.gov.br/api/search/?q=${encodeURIComponent(kw)}&tipos_documento=edital&pagina=1&tam_pagina=5&ordenacao=-data`;
        const r = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }});
        if (!r.ok) continue;
        const data = await r.json();
        const items = data.items || [];
        for (const item of items.slice(0, 3)) {
          const id = item.id || item.numero_controle_pncp;
          if (!id || vistos.has(id)) continue;
          vistos.add(id);
          // Filtro de relevância no fallback
          const textoFb = ((item.title||'') + ' ' + (item.description||'')).toLowerCase();
          const eRelFb = palavrasRelevantes.some(p => textoFb.includes(p));
          const eIrrFb = palavrasIrrelevantes.some(p => textoFb.includes(p));
          if (!eRelFb || eIrrFb) continue;
          const cnpj = (item.orgao_cnpj || '').replace(/\D/g, '');
          const ano = item.ano || new Date().getFullYear();
          const seq = item.numero_sequencial_compra_ata || '';
          abertas.push({
            titulo: item.title || item.description?.slice(0, 100) || 'Licitacao',
            descricao: item.description || '',
            orgao: item.orgao_nome || '',
            uf: item.uf || '',
            municipio: item.municipio_nome || '',
            valor: item.valor_global || null,
            dataPublicacao: item.data_publicacao_pncp || '',
            dataEncerramento: item.data_fim_vigencia || '',
            numero: item.numero_controle_pncp || '',
            modalidade: item.modalidade_licitacao_nome || '',
            cnpjOrgao: item.orgao_cnpj || '',
            situacao: item.situacao_nome || '',
            link: seq && cnpj ? `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}` : `https://pncp.gov.br${item.item_url||''}`,
          });
        }
        if (abertas.length >= 5) break;
      } catch(e) {}
    }
  }

  return res.status(200).json({ abertas: abertas.slice(0,5), proximas: proximas.slice(0,5) });
}
