export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const API_KEY = process.env.OPENROUTER_API_KEY;
  if (!API_KEY) return res.status(200).json({ status: 'ERRO', problema: 'OPENROUTER_API_KEY nao configurada' });

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'HTTP-Referer': 'https://prospector-ritfire.vercel.app',
        'X-Title': 'Prospector Ritfire'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        max_tokens: 50,
        messages: [{ role: 'user', content: 'Responda apenas: OK' }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(200).json({ status: 'ERRO_OPENROUTER', detalhe: data.error?.message, code: response.status });

    const texto = data.choices?.[0]?.message?.content || '';
    return res.status(200).json({ status: 'OK', resposta: texto, chave_configurada: true });
  } catch (err) {
    return res.status(200).json({ status: 'ERRO_CONEXAO', detalhe: err.message });
  }
}
