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
    ? 'PROTECAO PASSIVA CONTRA INCENDIO: revestimentos intumescentes, selantes corta-fogo, portas corta-fogo, compartimentacao.'
    : 'ISOLAMENTO TERMICO INDUSTRIAL: isolamento para caldeiras, tubulacoes, fornos e equipamentos de alta temperatura.';

  const setoresList = [
    'Siderurgia','Petroleo e Gas','Alimentos e Bebidas','Papel e Celulose',
    'Mineracao','Hospitais','Construcao Civil','Naval','Automotivo',
    'Ceramica','Vidro','Cimento','Termeletrica','Quimica','Farmaceutica',
    'Aluminio','Refinaria','Offshore','Metalurgia','Fundição'
  ];

  const portes = [
    { porte: 'grande',  desc: 'grande empresa com mais de 500 funcionarios' },
    { porte: 'media',   desc: 'media empresa com 50 a 500 funcionarios' },
    { porte: 'pequena', desc: 'pequena empresa ou prestadora de servico regional' }
  ];

  const todasOportunidades = [];
  let resumo = '';
  const seed = Math.floor(Math.random() * 999999);
  const hora = new Date().toISOString();

  for (const p of portes) {
    // Escolhe 2 setores aleatórios para forçar variedade
    const s1 = setoresList[Math.floor(Math.random() * setoresList.length)];
    const s2 = setoresList[Math.floor(Math.random() * setoresList.length)];

    const prompt = `B2B Brasil. RITFIRE vende: ${nichoDesc} Regiao: ${regiao||'Brasil'}. Seed:${seed} Hora:${hora}

Gere 3 leads de prospecção para empresas do tipo: ${p.desc}.
Foque nos setores: ${s1}, ${s2} e outros variados.
Nicho:"${nicho}" Porte:"${p.porte}" Urgencia:"ALTA" ou "MEDIA" ou "BAIXA"
Textos CURTOS. Sem aspas duplas nos valores. Telefone nunca null.

Responda so com este JSON, 3 itens no array:
{"r":"resumo","o":[{"n":"${nicho}","p":"${p.porte}","ti":"titulo","e":"empresa","c":null,"s":"setor","d":"descricao curta","l":"Cidade/UF","v":"R$ valor","pr":"prazo","u":"ALTA","cc":"cargo","ce":"email@emp.com.br","ct":"11999999999","a":"como abordar"}]}`;

    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 1500,
          temperature: 0.5,
          messages: [
            { role: 'system', content: 'Responda APENAS com JSON minificado. Sem markdown. Sem texto fora do JSON.' },
            { role: 'user', content: prompt }
          ]
        })
      });

      if (!groqRes.ok) continue;

      const data = await groqRes.json();
      let text = data.choices[0].message.content;

      // Limpar resposta
      text = text.replace(/```json|```/gi, '').trim();
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start === -1 || end === -1) continue;
      let jsonStr = text.slice(start, end + 1);

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch(e) {
        // Tenta reparar JSON truncado
        try {
          let fixed = jsonStr;
          // Remove ultimo item incompleto
          fixed = fixed.replace(/,\s*\{[^}]*$/s, '');
          // Fecha estruturas
          let d = 0, a = 0;
          for (const ch of fixed) {
            if (ch==='{') d++; else if (ch==='}') d--;
            else if (ch==='[') a++; else if (ch===']') a--;
          }
          for (let i=0;i<a;i++) fixed+=']';
          for (let i=0;i<d;i++) fixed+='}';
          parsed = JSON.parse(fixed);
        } catch(e2) {
          console.error('Parse falhou para porte', p.porte, e2.message);
          continue;
        }
      }

      if (!resumo && parsed.r) resumo = parsed.r;

      // Mapear chaves curtas para chaves completas
      const ops = parsed.o || parsed.oportunidades || [];
      for (const op of ops) {
        todasOportunidades.push({
          nicho:             op.n  || op.nicho            || nicho,
          porte:             op.p  || op.porte             || p.porte,
          titulo:            op.ti || op.titulo            || '',
          empresa_alvo:      op.e  || op.empresa_alvo      || '',
          cnpj:              op.c  || op.cnpj              || null,
          setor:             op.s  || op.setor             || '',
          descricao:         op.d  || op.descricao         || '',
          localizacao:       op.l  || op.localizacao       || '',
          valor_estimado:    op.v  || op.valor_estimado    || '',
          prazo:             op.pr || op.prazo             || '',
          urgencia:          op.u  || op.urgencia          || 'MEDIA',
          contato_cargo:     op.cc || op.contato_cargo     || '',
          contato_email:     op.ce || op.contato_email     || '',
          contato_telefone:  op.ct || op.contato_telefone  || '',
          como_abordar:      op.a  || op.como_abordar      || '',
        });
      }

    } catch(err) {
      console.error('Erro porte', p.porte, err.message);
      continue;
    }
  }

  if (todasOportunidades.length === 0) {
    return res.status(500).json({ error: 'Nao foi possivel gerar oportunidades. Tente novamente.' });
  }

  return res.status(200).json({ resumo: resumo || 'Mercado em expansao', oportunidades: todasOportunidades });
}
