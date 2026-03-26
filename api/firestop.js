export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tipo, regiao } = req.body;
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) return res.status(500).json({ error: 'Chave nao configurada.' });

  const reg = regiao || 'Brasil';
  const seed = Date.now();

  const produtos = 'MASSA RITWOOL, METACAULK 1200, MANTA RITWOOL SPUN, PLACA RITBOARD, AEROGEL RITFLEX, VERNIZ INTUMESCENTE, CONCRETO REFRATARIO, ARGAMASSA REFRATARIA, TIJOLO REFRATARIO, METACAULK COLAR INTUMESCENTE, PLACA SILTHERM';

  const publicos = 'fazeadores de faca, forjadores, ceramistas, construtores de casas container, construtores de fornos de pizza, churrasqueiras, lareiras, oficinas mecanicas, pequenas construtoras';

  let prompt = '';

  if (tipo === 'obras') {
    prompt = `Firestop Shop vende materiais refratarios e isolamento: ${produtos}. [seed:${seed}]
Liste 4 projetos de PEQUENO e MEDIO porte no Brasil que precisam desses materiais. Regiao: ${reg}.
Publicos: ${publicos}

Retorne APENAS este JSON (sem texto antes ou depois):
[{"titulo":"projeto","empresa":"empresa ou pessoa","setor":"segmento","descricao":"necessidade","local":"Cidade/UF","valor":"R$ X","urgencia":"ALTA","cargo":"contato","email":"email@emp.com","telefone":"11912345678","site":"site.com","acao":"como vender"}]`;

  } else if (tipo === 'leads') {
    prompt = `Firestop Shop vende no Mercado Livre: ${produtos}. [seed:${seed}]
Liste 4 perfis de compradores no Brasil. Regiao: ${reg}.
Publicos: ${publicos}

Retorne APENAS este JSON (sem texto antes ou depois):
[{"titulo":"perfil","empresa":"nome ou perfil","setor":"segmento","produto":"produto ideal","descricao":"por que precisa","local":"Cidade/UF","email":"email@emp.com","telefone":"11912345678","site":"site.com","acao":"abordagem"}]`;

  } else if (tipo === 'mercadolivre') {
    prompt = `Firestop Shop vende no Mercado Livre: ${produtos}. [seed:${seed}]
Liste 4 oportunidades de venda com alta demanda. Regiao: ${reg}.

Retorne APENAS este JSON (sem texto antes ou depois):
[{"titulo":"oportunidade","produto":"produto","nicho":"nicho de compradores","descricao":"por que vende bem","volume":"X buscas/mes","concorrencia":"baixa","preco_medio":"R$ X","acao":"estrategia"}]`;
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
        max_tokens: 900,
        temperature: 0.5,
        messages: [
          {
            role: 'system',
            content: 'Voce retorna APENAS arrays JSON validos. Sem texto. Sem markdown. Apenas o array JSON.'
          },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Groq error firestop:', JSON.stringify(err));
      return res.status(500).json({ error: 'Erro no Groq' });
    }

    const data = await response.json();
    const raw = data.choices[0].message.content.trim();
    console.log('Firestop RAW:', raw.slice(0, 400));

    let jsonStr = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const arrStart = jsonStr.indexOf('[');
    const arrEnd = jsonStr.lastIndexOf(']');
    if (arrStart === -1 || arrEnd === -1) return res.status(200).json({ oportunidades: [] });

    jsonStr = jsonStr.slice(arrStart, arrEnd + 1);

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e1) {
      try {
        let fixed = jsonStr.replace(/,\s*\{[^}]*$/s, '') + ']';
        parsed = JSON.parse(fixed);
      } catch (e2) {
        console.error('Firestop parse falhou:', e2.message);
        return res.status(200).json({ oportunidades: [] });
      }
    }

    return res.status(200).json({ oportunidades: parsed });

  } catch (err) {
    console.error('Firestop erro geral:', err.message);
    return res.status(200).json({ oportunidades: [] });
  }
}
