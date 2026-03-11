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

Gere 9 oportunidades reais (3 grandes + 3 medias + 3 pequenas empresas).
Use "grande","media","pequena" para porte. Use "ALTA","MEDIA","BAIXA" para urgencia.

REGRAS OBRIGATORIAS (mantenha os valores CURTOS para nao truncar o JSON):
1. descricao: 1 frase resumida com necessidade especifica (max 15 palavras)
2. como_abordar: 1 frase resumida com canal e mensagem-chave (max 15 palavras)
3. contato_email: email real ou provavel (ex: compras@empresa.com.br). Nunca null.
4. contato_telefone: telefone com DDD sem espacos (ex: 1130001234). Nunca null.
5. contato_cargo: cargo especifico (max 4 palavras)
6. cnpj: 14 digitos sem formatacao ou null
Sem aspas duplas dentro dos valores.

Responda SOMENTE com JSON minificado valido:
{"resumo":"1 frase","oportunidades":[{"nicho":"${nicho}","porte":"grande","titulo":"titulo curto","empresa_alvo":"Nome Empresa","cnpj":null,"setor":"Setor","descricao":"necessidade especifica em 1 frase","localizacao":"Cidade/UF","valor_estimado":"R$ X","prazo":"X meses","urgencia":"ALTA","contato_cargo":"Cargo","contato_email":"email@empresa.com.br","contato_telefone":"1130001234","como_abordar":"canal e mensagem em 1 frase"}]}`;

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 5000,
        temperature: 0.4,
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
      try {
        // Remove ultimo objeto incompleto
        let fixed = jsonStr.replace(/,\s*\{[^{}]*$/s, '');
        // Fecha estruturas abertas
        let depth = 0, arrD = 0;
        for (const ch of fixed) {
          if (ch==='{') depth++; else if (ch==='}') depth--;
          else if (ch==='[') arrD++; else if (ch===']') arrD--;
        }
        for (let i=0;i<arrD;i++) fixed+=']';
        for (let i=0;i<depth;i++) fixed+='}';
        result = JSON.parse(fixed);
      } catch(e2) {
        // Ultima tentativa: extrair apenas oportunidades validas
        const match = jsonStr.match(/"oportunidades"\s*:\s*\[/);
        if (match) {
          const start = jsonStr.indexOf(match[0]);
          let fixed = '{"resumo":"Mercado em expansao",' + jsonStr.slice(start);
          fixed = fixed.replace(/,\s*\{[^{}]*$/s, '');
          let d=0, a=0;
          for (const ch of fixed) {
            if(ch==='{')d++; else if(ch==='}')d--;
            else if(ch==='[')a++; else if(ch===']')a--;
          }
          for(let i=0;i<a;i++) fixed+=']';
          for(let i=0;i<d;i++) fixed+='}';
          result = JSON.parse(fixed);
        } else {
          throw new Error('JSON invalido da IA. Tente novamente.');
        }
      }
    }

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
