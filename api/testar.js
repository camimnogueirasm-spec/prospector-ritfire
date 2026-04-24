export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) return res.status(200).json({ status: 'ERRO', problema: 'GEMINI_API_KEY nao configurada' });

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Responda apenas: OK' }] }],
        generationConfig: { maxOutputTokens: 10 }
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(200).json({ status: 'ERRO_GEMINI', detalhe: data.error?.message, code: response.status });

    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({ status: 'OK', resposta: texto, chave_configurada: true });
  } catch (err) {
    return res.status(200).json({ status: 'ERRO_CONEXAO', detalhe: err.message });
  }
}
