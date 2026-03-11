export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nicho, regiao, tipo, porte } = req.body;
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) return res.status(500).json({ error: 'Chave nao configurada.' });

  const seed = Math.random().toString(36).slice(2,8);
  const nd = nicho==='incendio' ? 'protecao passiva incendio' : 'isolamento termico industrial';
  const pd = tipo==='obras' ? '3 obras em andamento' : `3 empresas ${porte==='grande'?'grandes':porte==='media'?'medias':'pequenas'}`;

  // Prompt ultra-curto para evitar truncamento
  const prompt = `${pd} no Brasil precisando de ${nd}. Regiao:${regiao||'Brasil'} #${seed}
Retorne JSON com exatamente 3 itens:
{"o":[{"ti":"titulo","e":"empresa","s":"setor","d":"necessidade","l":"Cidade/UF","v":"R$X","u":"ALTA","cc":"Cargo","ce":"email@empresa.com","ct":"11912345678","a":"acao"}]}`;

  try {
    const gr = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 800,
        temperature: 0.4,
        messages: [
          { role: 'system', content: 'Responda SOMENTE com JSON minificado. Sem texto fora do JSON. Sem markdown.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!gr.ok) {
      const e = await gr.json();
      return res.status(500).json({ error: e.error?.message||'Erro Groq' });
    }

    const data = await gr.json();
    let text = data.choices[0].message.content.replace(/```json|```/gi,'').trim();

    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start===-1||end===-1) return res.status(500).json({ error: 'JSON nao encontrado' });
    let js = text.slice(start, end+1);

    let parsed;
    try {
      parsed = JSON.parse(js);
    } catch(e1) {
      try {
        // Remove ultimo item incompleto
        let fixed = js.replace(/,\s*\{[^}]*$/s,'');
        // Remove ultimo campo incompleto
        fixed = fixed.replace(/,\s*"[^"]*"\s*:\s*"[^"]*$/s,'');
        // Fecha estruturas abertas
        let d=0,a=0;
        for(const c of fixed){if(c==='{')d++;else if(c==='}')d--;else if(c==='[')a++;else if(c===']')a--;}
        while(a-->0)fixed+=']';
        while(d-->0)fixed+='}';
        parsed = JSON.parse(fixed);
      } catch(e2) {
        console.error('Parse falhou:', e2.message);
        return res.status(500).json({ error: 'Parse error: '+e2.message });
      }
    }

    const ops = (parsed.o||[]).map(op=>({
      titulo:          String(op.ti||''),
      empresa_alvo:    String(op.e||''),
      porte:           String(op.p||porte||''),
      setor:           String(op.s||''),
      descricao:       String(op.d||''),
      localizacao:     String(op.l||''),
      valor_estimado:  String(op.v||''),
      prazo:           String(op.pr||''),
      urgencia:        String(op.u||'MEDIA'),
      contato_cargo:   String(op.cc||''),
      contato_email:   String(op.ce||''),
      contato_telefone:String(op.ct||''),
      site:            String(op.si||''),
      como_abordar:    String(op.a||''),
    }));

    return res.status(200).json({ oportunidades: ops });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
