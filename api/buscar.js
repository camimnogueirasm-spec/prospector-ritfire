export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nicho, regiao } = req.body;
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) return res.status(500).json({ error: 'Chave nao configurada.' });

  const nichoDesc = nicho === 'incendio'
    ? 'PROTECAO PASSIVA CONTRA INCENDIO: revestimentos intumescentes, selantes corta-fogo, barreiras, portas corta-fogo, compartimentacao.'
    : 'ISOLAMENTO TERMICO INDUSTRIAL: isolamento para caldeiras, tubulacoes, fornos e equipamentos industriais de alta temperatura.';

  const portes = [
    { porte: 'grande', desc: '3 grandes empresas com mais de 500 funcionarios, marcas conhecidas nacionalmente' },
    { porte: 'media',  desc: '3 medias empresas com 50 a 500 funcionarios' },
    { porte: 'pequena',desc: '3 pequenas empresas com ate 50 funcionarios, prestadoras de servico ou construtoras regionais' }
  ];

  const todasOportunidades = [];
  let resumo = '';

  for (const p of portes) {
    const agora = new Date().toISOString();
    const seed = Math.floor(Math.random() * 99999);
    const prompt = `Especialista B2B industria brasileira. RITFIRE vende: ${nichoDesc}. Regiao: ${regiao || 'Brasil'}.
Timestamp: ${agora} | Seed: ${seed}

Gere EXATAMENTE 3 oportunidades DIFERENTES e NOVAS do tipo: ${p.desc}.
IMPORTANTE: Use empresas e setores VARIADOS a cada chamada. Nunca repita as mesmas empresas. Explore setores diferentes como: siderurgia, petroleo, alimentos, papel e celulose, mineracao, hospitais, construcao civil, naval, automotivo, ceramica, vidro, cimento, termeletrica, quimica, farmaceutica.
Porte fixo: "${p.porte}". Nicho fixo: "${nicho}".
Urgencia: "ALTA", "MEDIA" ou "BAIXA".
Valores de string: curtos, sem aspas duplas internas.
contato_telefone: DDD+numero sem espacos (ex: 1130001234). Nunca null.
contato_email: email provavel. Nunca null.

JSON APENAS, sem markdown:
{"resumo":"frase curta","oportunidades":[{"nicho":"${nicho}","porte":"${p.porte}","titulo":"titulo","empresa_alvo":"empresa","cnpj":null,"setor":"setor","descricao":"necessidade em 1 frase","localizacao":"Cidade/UF","valor_estimado":"R$ X","prazo":"X meses","urgencia":"ALTA","contato_cargo":"Cargo","contato_email":"email@empresa.com.br","contato_telefone":"1130001234","como_abordar":"acao em 1 frase"}]}`;

    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 2000,
          temperature: 0.4,
          messages: [
            { role: 'system', content: 'Responda APENAS com JSON minificado valido. Sem texto fora do JSON.' },
            { role: 'user', content: prompt }
          ]
        })
      });

      if (!groqRes.ok) {
        const err = await groqRes.json();
        console.error('Groq error:', err);
        continue;
      }

      const data = await groqRes.json();
      let text = data.choices[0].message.content.replace(/```json|```/g, '').trim();
      const start = text.indexOf('{');
      if (start === -1) continue;
      let jsonStr = text.slice(start);

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch(e1) {
        try {
          let fixed = jsonStr.replace(/,\s*\{[^{}]*$/s, '');
          let d = 0, a = 0;
          for (const ch of fixed) {
            if (ch==='{') d++; else if (ch==='}') d--;
            else if (ch==='[') a++; else if (ch===']') a--;
          }
          for (let i=0;i<a;i++) fixed+=']';
          for (let i=0;i<d;i++) fixed+='}';
          parsed = JSON.parse(fixed);
        } catch(e2) {
          console.error('Parse error:', e2.message);
          continue;
        }
      }

      if (!resumo && parsed.resumo) resumo = parsed.resumo;
      if (parsed.oportunidades) todasOportunidades.push(...parsed.oportunidades);

    } catch(err) {
      console.error('Fetch error:', err.message);
      continue;
    }
  }

  if (todasOportunidades.length === 0) {
    return res.status(500).json({ error: 'Nao foi possivel gerar oportunidades. Tente novamente.' });
  }

  return res.status(200).json({ resumo, oportunidades: todasOportunidades });
}
