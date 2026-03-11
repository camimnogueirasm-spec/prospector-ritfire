export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nicho, regiao, tipo, porte } = req.body;
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) return res.status(500).json({ error: 'Chave nao configurada.' });

  const seed = Math.floor(Math.random() * 999999);
  const nd = nicho === 'incendio'
    ? 'protecao passiva contra incendio: intumescente, corta-fogo, compartimentacao'
    : 'isolamento termico industrial: caldeiras, tubulacoes, fornos';

  let prompt;
  if (tipo === 'obras') {
    prompt = `Brasil B2B seed${seed}. 3 obras em andamento precisando de ${nd}. Regiao:${regiao||'Brasil'}.
JSON:{"o":[{"ti":"obra","e":"empresa","s":"setor","d":"necessidade","l":"Cidade/UF","v":"R$X","pr":"fase","u":"ALTA","cc":"Cargo","ce":"a@b.com","ct":"11912345678","si":"site.com","a":"acao"}]}`;
  } else {
    const pd = porte==='grande'?'grande empresa +500func':porte==='media'?'media empresa 50-500func':'pequena empresa ate 50func';
    prompt = `Brasil B2B seed${seed}. 3 leads ${pd} usando ${nd}. Regiao:${regiao||'Brasil'}.
JSON:{"o":[{"ti":"titulo","e":"empresa","p":"${porte||'grande'}","s":"setor","d":"necessidade","l":"Cidade/UF","v":"R$X","pr":"prazo","u":"ALTA","cc":"Cargo","ce":"a@b.com","ct":"11912345678","si":"site.com","a":"acao"}]}`;
  }

  try {
    const gr = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1000,
        temperature: 0.4,
        messages: [
          { role: 'system', content: 'Responda SOMENTE com JSON minificado valido. Sem texto fora do JSON.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!gr.ok) {
      const e = await gr.json();
      return res.status(500).json({ error: e.error?.message || 'Erro Groq' });
    }

    const data = await gr.json();
    let text = data.choices[0].message.content.replace(/```json|```/gi,'').trim();

    // Extrair apenas o JSON entre { e }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return res.status(500).json({ error: 'JSON nao encontrado' });
    let jsonStr = text.slice(start, end + 1);

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch(e1) {
      // Tenta remover ultimo item truncado e fechar o JSON
      try {
        let fixed = jsonStr
          .replace(/,\s*\{[^}]*$/s, '')  // remove ultimo obj incompleto
          .replace(/,\s*"[^"]*"\s*:\s*[^,}\]]*$/s, ''); // remove ultimo campo incompleto
        let d=0, a=0;
        for(const c of fixed){ if(c==='{')d++;else if(c==='}')d--;else if(c==='[')a++;else if(c===']')a--; }
        while(a-->0) fixed+=']';
        while(d-->0) fixed+='}';
        parsed = JSON.parse(fixed);
      } catch(e2) {
        console.error('Parse falhou:', e2.message, '| texto:', jsonStr.slice(0,200));
        return res.status(500).json({ error: 'Parse error: ' + e2.message });
      }
    }

    const ops = (parsed.o || []).map(op => ({
      titulo:          String(op.ti||op.titulo||''),
      empresa_alvo:    String(op.e||op.empresa_alvo||''),
      porte:           String(op.p||op.porte||porte||''),
      setor:           String(op.s||op.setor||''),
      descricao:       String(op.d||op.descricao||''),
      localizacao:     String(op.l||op.localizacao||''),
      valor_estimado:  String(op.v||op.valor_estimado||''),
      prazo:           String(op.pr||op.prazo||''),
      urgencia:        String(op.u||op.urgencia||'MEDIA'),
      contato_cargo:   String(op.cc||op.contato_cargo||''),
      contato_email:   String(op.ce||op.contato_email||''),
      contato_telefone:String(op.ct||op.contato_telefone||''),
      site:            String(op.si||op.site||''),
      como_abordar:    String(op.a||op.como_abordar||''),
    }));

    return res.status(200).json({ oportunidades: ops });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
