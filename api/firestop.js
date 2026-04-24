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
      temperature: 0.5,
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
  return data.choices?.[0]?.message?.content || '';
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

  const { tipo, regiao } = req.body;
  const API_KEY = process.env.GROQ_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY nao configurada.' });

  const reg = regiao || 'Brasil';
  const seed = Date.now();
  const produtos = 'MASSA RITWOOL, METACAULK 1200, MANTA RITWOOL SPUN, PLACA RITBOARD, AEROGEL RITFLEX, VERNIZ INTUMESCENTE, CONCRETO REFRATARIO, TIJOLO REFRATARIO RITBRICK, METACAULK COLAR INTUMESCENTE, PLACA SILTHERM';
  const publicos = 'fazeadores de faca, forjadores, ceramistas, construtores de casas container, fornos de pizza, churrasqueiras, lareiras, oficinas mecanicas, pequenas construtoras';

  let prompt = '';
  if (tipo === 'obras') {
    prompt = `Firestop Shop vende: ${produtos}. seed:${seed}
Liste 4 projetos PEQUENO e MEDIO porte no Brasil precisando desses materiais. Regiao: ${reg}. Publicos: ${publicos}
Retorne APENAS array JSON com 4 objetos:
[{"titulo":"projeto","empresa":"empresa","setor":"segmento","descricao":"necessidade","local":"Cidade/UF","valor":"R$ X","urgencia":"ALTA","cargo":"contato","email":"email@emp.com","telefone":"11912345678","site":"site.com","acao":"como vender"}]`;
  } else if (tipo === 'leads') {
    prompt = `Firestop Shop vende no Mercado Livre: ${produtos}. seed:${seed}
Liste 4 perfis de compradores no Brasil. Regiao: ${reg}. Publicos: ${publicos}
Retorne APENAS array JSON com 4 objetos:
[{"titulo":"perfil","empresa":"nome","setor":"segmento","produto":"produto ideal","descricao":"por que precisa","local":"Cidade/UF","email":"email@emp.com","telefone":"11912345678","site":"site.com","acao":"abordagem"}]`;
  } else if (tipo === 'mercadolivre') {
    prompt = `Firestop Shop vende no Mercado Livre: ${produtos}. seed:${seed}
Liste 4 oportunidades de venda com alta demanda no Brasil. Regiao: ${reg}.
Retorne APENAS array JSON com 4 objetos:
[{"titulo":"oportunidade","produto":"produto","nicho":"nicho","descricao":"por que vende bem","volume":"X buscas/mes","concorrencia":"baixa","preco_medio":"R$ X","acao":"estrategia"}]`;
  }

  try {
    const text = await chamarGroq(prompt, API_KEY);
    const parsed = parseArray(text);
    return res.status(200).json({ oportunidades: parsed });
  } catch (err) {
    console.error('Firestop erro:', err.message);
    return res.status(200).json({ oportunidades: [] });
  }
}
