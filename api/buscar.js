export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nicho, regiao, tipo, porte } = req.body;
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) return res.status(500).json({ error: 'Chave nao configurada.' });

  const nd = nicho === 'incendio'
    ? 'protecao passiva contra incendio: intumescente, corta-fogo, compartimentacao'
    : 'isolamento termico industrial: caldeiras, fornos, tubulacoes';

  const reg = regiao || 'Brasil';
  const seed = Date.now();

  let prompt = '';
  if (tipo === 'obras') {
    prompt = `Voce e um especialista em prospecção B2B. Liste 3 obras em andamento no Brasil que precisam de ${nd}. Regiao: ${reg}. [seed:${seed}]

Retorne APENAS este JSON com 3 itens preenchidos (sem texto antes ou depois):
[{"titulo":"nome da obra","empresa":"nome empresa","setor":"setor","descricao":"necessidade especifica","local":"Cidade/UF","valor":"R$ X","urgencia":"ALTA","cargo":"Gerente de Obras","email":"contato@empresa.com.br","telefone":"11912345678","site":"www.empresa.com.br","acao":"como abordar"}]`;
  } else {
    const pd = porte === 'grande' ? 'grandes empresas com mais de 500 funcionarios'
      : porte === 'media' ? 'medias empresas de 50 a 500 funcionarios'
      : 'pequenas empresas com ate 50 funcionarios';
    prompt = `Voce e um especialista em prospecção B2B. Liste 3 ${pd} no Brasil que usam ${nd}. Regiao: ${reg}. [seed:${seed}]

Retorne APENAS este JSON com 3 itens preenchidos (sem texto antes ou depois):
[{"titulo":"oportunidade","empresa":"nome empresa","porte":"${porte}","setor":"setor","descricao":"necessidade especifica","local":"Cidade/UF","valor":"R$ X","urgencia":"ALTA","cargo":"cargo ideal","email":"contato@empresa.com.br","telefone":"11912345678","site":"www.empresa.com.br","acao":"como abordar"}]`;
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 800,
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content: 'Voce retorna APENAS arrays JSON validos. Sem texto. Sem markdown. Sem explicacoes. Apenas o array JSON.'
          },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Groq error:', JSON.stringify(err));
      return res.status(500).json({ error: 'Erro no Groq: ' + (err.error?.message || response.status) });
    }

    const data = await response.json();
    const raw = data.choices[0].message.content.trim();
    console.log('RAW response:', raw.slice(0, 500));

    // Extrair array JSON da resposta
    let jsonStr = raw;

    // Remove markdown se houver
    jsonStr = jsonStr.replace(/```json/gi, '').replace(/```/g, '').trim();

    // Encontra o array
    const arrStart = jsonStr.indexOf('[');
    const arrEnd = jsonStr.lastIndexOf(']');

    if (arrStart === -1 || arrEnd === -1) {
      console.error('Array nao encontrado. Raw:', raw);
      return res.status(500).json({ error: 'Resposta invalida da IA', raw: raw.slice(0, 200) });
    }

    jsonStr = jsonStr.slice(arrStart, arrEnd + 1);

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e1) {
      console.error('Parse erro:', e1.message, 'jsonStr:', jsonStr.slice(0, 300));
      // Tenta reparar JSON truncado
      try {
        let fixed = jsonStr.replace(/,\s*\{[^}]*$/s, '') + ']';
        parsed = JSON.parse(fixed);
        console.log('Parse reparado com sucesso');
      } catch (e2) {
        console.error('Parse reparado falhou:', e2.message);
        return res.status(500).json({ error: 'JSON invalido: ' + e1.message });
      }
    }

    const oportunidades = parsed.map(op => ({
      titulo: String(op.titulo || ''),
      empresa_alvo: String(op.empresa || ''),
      porte: String(op.porte || porte || ''),
      setor: String(op.setor || ''),
      descricao: String(op.descricao || ''),
      localizacao: String(op.local || ''),
      valor_estimado: String(op.valor || ''),
      urgencia: String(op.urgencia || 'MEDIA'),
      contato_cargo: String(op.cargo || ''),
      contato_email: String(op.email || ''),
      contato_telefone: String(op.telefone || ''),
      site: String(op.site || ''),
      como_abordar: String(op.acao || ''),
    }));

    console.log('Sucesso:', oportunidades.length, 'oportunidades');
    return res.status(200).json({ oportunidades });

  } catch (err) {
    console.error('Erro geral:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
