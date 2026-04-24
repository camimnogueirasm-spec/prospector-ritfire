export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const API_KEY = process.env.GROQ_API_KEY;
  if (!API_KEY) return res.status(200).json({ status: 'ERRO', problema: 'GROQ_API_KEY nao configurada' });

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Responda apenas: OK' }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(200).json({ status: 'ERRO_GROQ', detalhe: data.error?.message, code: response.status });

    const texto = data.choices?.[0]?.message?.content || '';
    return res.status(200).json({ status: 'OK', resposta: texto, chave_configurada: true });
  } catch (err) {
    return res.status(200).json({ status: 'ERRO_CONEXAO', detalhe: err.message });
  }
}
