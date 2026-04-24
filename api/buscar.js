async function chamarGroq(prompt, apiKey) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1000,
      temperature: 0.4,
      messages: [
        { role: 'system', content: 'Retorne APENAS arrays JSON validos. Sem texto. Sem markdown.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error('Groq error: ' + (err.error?.message || response.status));
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  console.log('RAW:', text.slice(0, 200));
  return text;
}

function parseArray(text) {
  let clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = clean.indexOf('[');
  const end = clean.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('Array nao encontrado');
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
  const API_KEY = process.env.GROQ_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY nao configurada.' });

  const nd = nicho === 'incendio'
    ? 'protecao passiva contra incendio: intumescente, corta-fogo, compartimentacao'
    : 'isolamento termico industrial: caldeiras, fornos, tubulacoes';

  const reg = regiao || 'Brasil';
  const seed = Date.now();

  let prompt = '';
  if (tipo === 'obras') {
    prompt = `Liste 3 obras em andamento no Brasil precisando de ${nd}. Regiao: ${reg}. seed:${seed}
Retorne APENAS array JSON com 3 objetos:
[{"titulo":"nome","empresa":"empresa","setor":"setor","descricao":"necessidade","local":"Cidade/UF","valor":"R$ X","urgencia":"ALTA","cargo":"cargo","email":"email@empresa.com.br","telefone":"11912345678","site":"www.empresa.com.br","acao":"como abordar"}]`;
  } else {
    const pd = porte === 'grande' ? 'grandes empresas +500 funcionarios'
      : porte === 'media' ? 'medias empresas 50-500 funcionarios'
      : 'pequenas empresas ate 50 funcionarios';
    prompt = `Liste 3 ${pd} no Brasil que usam ${nd}. Regiao: ${reg}. seed:${seed}
Retorne APENAS array JSON com 3 objetos:
[{"titulo":"oportunidade","empresa":"nome","porte":"${porte}","setor":"setor","descricao":"necessidade","local":"Cidade/UF","valor":"R$ X","urgencia":"ALTA","cargo":"cargo","email":"email@empresa.com.br","telefone":"11912345678","site":"www.empresa.com.br","acao":"como abordar"}]`;
  }

  try {
    const text = await chamarGroq(prompt, API_KEY);
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
    return res.status(200).json({ oportunidades });
  } catch (err) {
    console.error('Erro buscar:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
