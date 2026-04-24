export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const API_KEY = process.env.HUGGINGFACE_API_KEY;
  if (!API_KEY) return res.status(200).json({ status: 'ERRO', problema: 'HUGGINGFACE_API_KEY nao configurada' });

  // Tenta 3 modelos diferentes
  const modelos = [
    'https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta',
    'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2',
    'https://api-inference.huggingface.co/models/tiiuae/falcon-7b-instruct'
  ];

  for (const url of modelos) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: 'Responda apenas: OK',
          parameters: { max_new_tokens: 10 }
        })
      });

      const text = await response.text();
      console.log('Model:', url, 'Status:', response.status, 'Response:', text.slice(0, 100));

      if (response.ok) {
        return res.status(200).json({ status: 'OK', modelo: url, resposta: text.slice(0, 50) });
      }
    } catch(e) {
      console.error('Erro modelo:', url, e.message);
    }
  }

  return res.status(200).json({ status: 'ERRO', problema: 'Nenhum modelo disponivel' });
}
