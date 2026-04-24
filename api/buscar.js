async function chamarIA(prompt, apiKey) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://prospector-ritfire.vercel.app',
      'X-Title': 'Prospector Ritfire'
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      max_tokens: 1000,
      temperature: 0.4,
      messages: [
        { role: 'system', content: 'Voce retorna APENAS arrays JSON validos. Sem texto. Sem markdown. Apenas o array JSON.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error('OpenRouter error: ' + (err.error?.message || response.status));
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  console.log('RAW:', text.slice(0, 300));
  return text;
}

function parseArray(text) {
  let clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = clean.indexOf('[');
  const end = clean.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('Array nao encontrado: ' + clean.slice(0,100));
  clean = clean.slice(start, end + 1);
  try {
    return JSON.parse(clean);
  } catch(e) {
    let fixed = clean.replace(/,\s*\{[^}]*$/s, '') + ']';
    return JSON.parse(fixed);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nicho, regiao, tipo, porte } = req.body;
  const API_KEY = process.env.OPENROUTER_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'OPENROUTER_API_KEY nao configurada.' });

  const nd = nicho === 'incendio'
    ? 'protecao passiva contra incendio: intumescente, corta-fogo, compartimentacao'
    : 'isolamento termico industrial: caldeiras, fornos, tubulacoes';

  const reg = regiao || 'Brasil';
  const seed = Date.now();

  let prompt = '';
  if (tipo === 'obras') {
    prompt = `Liste 3 obras reais em andamento no Brasil que precisam de ${nd}. Regiao: ${reg}. seed:${seed}
Retorne APENAS array JSON com 3 objetos:
[{"titulo":"nome da obra","empresa":"empresa responsavel","setor":"setor","descricao":"necessidade especifica","local":"Cidade/UF","valor":"R$ X","urgencia":"ALTA","cargo":"cargo do contato","email":"contato@empresa.com.br","telefone":"11912345678","site":"www.empresa.com.br","acao":"como abordar"}]`;
  } else {
    const pd = porte === 'grande' ? 'grandes empresas com mais de 500 funcionarios'
      : porte === 'media' ? 'medias empresas de 50 a 500 funcionarios'
      : 'pequenas empresas com ate 50 funcionarios';
    prompt = `Liste 3 ${pd} no Brasil que usam ${nd}. Regiao: ${reg}. seed:${seed}
Retorne APENAS array JSON com 3 objetos:
[{"titulo":"oportunidade","empresa":"nome empresa","porte":"${porte}","setor":"setor","descricao":"necessidade especifica","local":"Cidade/UF","valor":"R$ X","urgencia":"ALTA","cargo":"cargo ideal","email":"contato@empresa.com.br","telefone":"11912345678","site":"www.empresa.com.br","acao":"como abordar"}]`;
  }

  try {
    const text = await chamarIA(prompt, API_KEY);
    const parsed = parseArray(text);
    const oportunidades = parsed.map(op => ({
      titulo:           String(op.titulo || ''),
      empresa_alvo:     String(op.empresa || ''),
      porte:            String(op.porte || porte || ''),
      setor:            String(op.setor || ''),
      descricao:        String(op.descricao || ''),
      localizacao:      String(op.local || ''),
      valor_estimado:   String(op.valor || ''),
      urgencia:         String(op.urgencia || 'MEDIA'),
      contato_cargo:    String(op.cargo || ''),
      contato_email:    String(op.email || ''),
      contato_telefone: String(op.telefone || ''),
      site:             String(op.site || ''),
      como_abordar:     String(op.acao || ''),
    }));
    console.log('Sucesso:', oportunidades.length, 'oportunidades');
    return res.status(200).json({ oportunidades });
  } catch (err) {
    console.error('Erro buscar:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
