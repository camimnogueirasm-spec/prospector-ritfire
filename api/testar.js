export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const API_KEY = process.env.HUGGINGFACE_API_KEY;
  if (!API_KEY) return res.status(200).json({ status: 'ERRO', problema: 'HUGGINGFACE_API_KEY nao configurada' });

  try {
    const response = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: '<s>[INST] Responda apenas com a palavra: OK [/INST]',
        parameters: { max_new_tokens: 10, temperature: 0.1 }
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(200).json({ status: 'ERRO_HF', detalhe: data.error, code: response.status });

    const texto = Array.isArray(data) ? data[0]?.generated_text || '' : data.generated_text || '';
    return res.status(200).json({ status: 'OK', resposta: texto.slice(-20), chave_configurada: true });
  } catch (err) {
    return res.status(200).json({ status: 'ERRO_CONEXAO', detalhe: err.message });
  }
}
