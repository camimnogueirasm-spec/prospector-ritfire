export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { nicho } = req.body || {};

  const keywords = nicho === 'incendio'
    ? ['protecao+contra+incendio', 'intumescente', 'porta+corta+fogo']
    : ['isolamento+termico', 'refratario', 'isolamento+industrial'];

  const abertas = [];
  const proximas = [];
  const hoje = new Date();

  for (const kw of keywords) {
    try {
      // Endpoint correto da API pública PNCP
      const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?tamanhoPagina=5&pagina=1&q=${kw}`;
      const r = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        }
      });

      console.log(`PNCP ${kw} status:`, r.status);
      if (!r.ok) continue;

      const data = await r.json();
      console.log('PNCP keys:', Object.keys(data));
      const items = data.data || data.items || data.resultado || data.content || [];
      console.log('PNCP items count:', items.length);

      for (const item of items.slice(0, 3)) {
        const enc = item.dataEncerramentoProposta ? new Date(item.dataEncerramentoProposta) : null;
        const licit = {
          titulo: item.objetoCompra || item.descricaoObjeto || item.objeto || 'Licitacao relacionada',
          orgao: item.orgaoEntidade?.razaoSocial || item.nomeOrgao || item.razaoSocialOrgao || '',
          uf: item.unidadeOrgao?.ufSigla || item.ufSigla || item.uf || '',
          municipio: item.unidadeOrgao?.municipioNome || item.municipioNome || '',
          valor: item.valorTotalEstimado || item.valorEstimadoTotal || null,
          dataAbertura: item.dataAberturaProposta || item.dataPublicacaoPncp || '',
          dataEncerramento: item.dataEncerramentoProposta || '',
          numero: item.numeroCompra || item.sequencialCompra || '',
          modalidade: item.modalidadeNome || '',
          cnpjOrgao: item.orgaoEntidade?.cnpj || item.cnpj || '',
          // Montar link correto
          link: item.linkSistemaOrigem || montarLink(item),
        };

        if (enc && enc > hoje) {
          abertas.push(licit);
        } else {
          proximas.push(licit);
        }
      }
    } catch(e) {
      console.error('PNCP erro:', kw, e.message);
    }
  }

  // Se não achou nada, tenta endpoint alternativo de busca
  if (abertas.length === 0 && proximas.length === 0) {
    try {
      const kwMain = nicho === 'incendio' ? 'incendio' : 'isolamento termico';
      const url2 = `https://pncp.gov.br/api/search/?q=${encodeURIComponent(kwMain)}&tipos_documento=edital&pagina=1&tam_pagina=8&status=recebendo_proposta`;
      const r2 = await fetch(url2, { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }});
      console.log('Search endpoint status:', r2.status);
      if (r2.ok) {
        const data2 = await r2.json();
        console.log('Search keys:', Object.keys(data2));
        const items2 = data2.items || data2.data || data2.resultado || [];
        for (const item of items2.slice(0, 5)) {
          abertas.push({
            titulo: item.objetoCompra || item.descricao || item.titulo || 'Licitacao',
            orgao: item.nomeOrgao || item.orgaoEntidade?.razaoSocial || '',
            uf: item.uf || item.unidadeOrgao?.ufSigla || '',
            municipio: item.municipio || item.unidadeOrgao?.municipioNome || '',
            valor: item.valorTotalEstimado || null,
            dataAbertura: item.dataPublicacaoPncp || '',
            dataEncerramento: item.dataEncerramentoProposta || '',
            numero: item.sequencialCompra || item.numeroCompra || '',
            modalidade: item.modalidadeNome || '',
            cnpjOrgao: item.cnpj || item.orgaoEntidade?.cnpj || '',
            link: item.linkSistemaOrigem || montarLink(item),
          });
        }
      }
    } catch(e2) {
      console.error('Search endpoint erro:', e2.message);
    }
  }

  return res.status(200).json({ abertas: abertas.slice(0,5), proximas: proximas.slice(0,5) });
}

function montarLink(item) {
  // Tenta montar link direto para o edital no PNCP
  const cnpj = item.orgaoEntidade?.cnpj || item.cnpj || '';
  const ano = item.anoCompra || new Date().getFullYear();
  const seq = item.sequencialCompra || item.numeroCompra || '';
  if (cnpj && seq) {
    return `https://pncp.gov.br/app/editais/${cnpj.replace(/\D/g,'')}/${ano}/${seq}`;
  }
  return 'https://pncp.gov.br/app/editais';
}
