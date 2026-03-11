export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nicho, regiao, tipo } = req.body;
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) return res.status(500).json({ error: 'Chave nao configurada.' });

  const nichoDesc = nicho === 'incendio'
    ? 'PROTECAO PASSIVA CONTRA INCENDIO: revestimentos intumescentes, selantes corta-fogo, portas corta-fogo, compartimentacao.'
    : 'ISOLAMENTO TERMICO INDUSTRIAL: isolamento para caldeiras, tubulacoes, fornos e equipamentos de alta temperatura.';

  const seed = Math.floor(Math.random() * 999999);
  const hora = new Date().toISOString();

  let prompt = '';

  if (tipo === 'obras') {
    prompt = `Especialista B2B Brasil. Seed:${seed} Hora:${hora}
Gere 5 obras industriais/comerciais REAIS ou realistas atualmente em andamento no Brasil que precisam de: ${nichoDesc}
Regiao: ${regiao||'Brasil'}. Varie os setores e regioes.

JSON apenas:
{"o":[{"ti":"nome da obra","e":"empresa responsavel","s":"setor","d":"descricao da obra e necessidade","l":"Cidade/UF","v":"R$ orcamento estimado","pr":"fase atual","u":"ALTA ou MEDIA","cc":"cargo contato","ce":"email@empresa.com.br","ct":"11999999999","si":"site.com.br","a":"como abordar em 1 frase"}]}`;
  } else {
    // leads gerais - 1 chamada por porte
    const porte = req.body.porte || 'grande';
    const porteDesc = porte === 'grande' ? 'grandes empresas +500 funcionarios' : porte === 'media' ? 'medias empresas 50-500 funcionarios' : 'pequenas empresas ate 50 funcionarios';
    prompt = `Especialista B2B Brasil. Seed:${seed} Hora:${hora}
Gere 5 leads de ${porteDesc} que usam: ${nichoDesc}
Regiao: ${regiao||'Brasil'}. Varie setores: siderurgia, petroleo, alimentos, papel, mineracao, hospitais, construcao, naval, automotivo, ceramica, cimento, quimica.

JSON apenas:
{"o":[{"ti":"oportunidade","e":"empresa","p":"${porte}","s":"setor","d":"necessidade especifica","l":"Cidade/UF","v":"R$ estimado","pr":"prazo","u":"ALTA ou MEDIA ou BAIXA","cc":"cargo","ce":"email@empresa.com.br","ct":"11999999999","si":"site.com.br","a":"como abordar"}]}`;
  }

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2000,
        temperature: 0.5,
        messages: [
          { role: 'system', content: 'Responda APENAS com JSON minificado. Sem markdown. Sem texto fora do JSON.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!groqRes.ok) {
      const err = await groqRes.json();
      return res.status(500).json({ error: err.error?.message || 'Erro Groq' });
    }

    const data = await groqRes.json();
    let text = data.choices[0].message.content.replace(/```json|```/gi, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return res.status(500).json({ error: 'JSON invalido' });
    let jsonStr = text.slice(start, end + 1);

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch(e) {
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
        return res.status(500).json({ error: 'Parse error: ' + e2.message });
      }
    }

    const ops = (parsed.o || parsed.oportunidades || []).map(op => ({
      titulo:           op.ti || op.titulo || '',
      empresa_alvo:     op.e  || op.empresa_alvo || '',
      porte:            op.p  || op.porte || req.body.porte || '',
      setor:            op.s  || op.setor || '',
      descricao:        op.d  || op.descricao || '',
      localizacao:      op.l  || op.localizacao || '',
      valor_estimado:   op.v  || op.valor_estimado || '',
      prazo:            op.pr || op.prazo || '',
      urgencia:         op.u  || op.urgencia || 'MEDIA',
      contato_cargo:    op.cc || op.contato_cargo || '',
      contato_email:    op.ce || op.contato_email || '',
      contato_telefone: String(op.ct || op.contato_telefone || ''),
      site:             op.si || op.site || '',
      como_abordar:     op.a  || op.como_abordar || '',
    }));

    return res.status(200).json({ oportunidades: ops });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
