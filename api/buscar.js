export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nicho, regiao } = req.body;
  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  if (!GROQ_API_KEY) return res.status(500).json({ error: 'Chave não configurada no servidor.' });

  const nichoDesc = nicho === 'incendio'
    ? 'PROTECAO PASSIVA CONTRA INCENDIO: revestimentos intumescentes, selantes corta-fogo, barreiras, portas corta-fogo, compartimentacao.'
    : 'ISOLAMENTO TERMICO INDUSTRIAL: materiais e servicos de isolamento para processos industriais de alta temperatura, caldeiras, tubulacoes, fornos.';

  const prompt = `Voce e especialista em prospeccao B2B para industrias brasileiras.
RITFIRE vende: ${nichoDesc}
Regiao: ${regiao || 'Brasil'}

Gere 9 oportunidades (3 grandes + 3 medias + 3 pequenas empresas).
Use "grande","media","pequena" para porte. Use "ALTA","MEDIA","BAIXA" para urgencia.
Sem aspas duplas dentro dos valores de string.

Responda SOMENTE com JSON minificado valido:
{"resumo":"string","oportunidades":[{"nicho":"${nicho}","porte":"grande","titulo":"string","empresa_alvo":"string","cnpj":null,"setor":"string","descricao":"string","localizacao":"string","valor_estimado":"string","prazo":"string","urgencia":"ALTA","contato_cargo":"string","contato_email":"string","contato_telefone":null,"como_abordar":"string"}]}`;

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 3000,
        temperature: 0.6,
        messages: [
          { role: 'system', content: 'Responda APENAS com JSON minificado valido. Sem markdown.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!groqRes.ok) {
      const err = await groqRes.json();
      return res.status(500).json({ error: err.error?.message || 'Erro no Groq' });
    }

    const data = await groqRes.json();
    let text = data.choices[0].message.content.replace(/```json|```/g, '').trim();
    const start = text.indexOf('{');
    let jsonStr = text.slice(start);

    // Parser robusto
    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch(e1) {
      let fixed = jsonStr.replace(/,\s*\{[^}]*$/s, '');
      let depth = 0, arrD = 0;
      for (const ch of fixed) {
        if (ch==='{') depth++; else if (ch==='}') depth--;
        else if (ch==='[') arrD++; else if (ch===']') arrD--;
      }
      for (let i=0;i<arrD;i++) fixed+=']';
      for (let i=0;i<depth;i++) fixed+='}';
      result = JSON.parse(fixed);
    }

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
