import json
import datetime
import os
import urllib.request
import urllib.error
import ssl

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

EMPRESA = "Ritfire Isolamentos"
DESCRICAO = "Fornecemos materiais e serviços de isolamento térmico para obras industriais, plantas petroquímicas, frigoríficos e construção civil de grande porte."
REGIAO = "Brasil"

def buscar_oportunidades():
    if not GROQ_API_KEY:
        raise ValueError("❌ GROQ_API_KEY está vazia!")

    print(f"🔑 Chave: {GROQ_API_KEY[:8]}... ({len(GROQ_API_KEY)} chars)")

    prompt = f"""Você é um especialista sênior em prospecção B2B para o mercado brasileiro.

Empresa: {EMPRESA}
Produto/Serviço: {DESCRICAO}
Região: {REGIAO}

Identifique 5 oportunidades reais e específicas de negócio para esta empresa hoje.
Use conhecimento de: ComprasNet, BEC/SP, obras do PAC, petroquímica (Braskem, Petrobras), frigoríficos (JBS, BRF, Marfrig), construção civil.

Responda APENAS com JSON válido:
{{
  "resumo": "Análise do cenário atual em 1 frase",
  "oportunidades": [
    {{
      "titulo": "Título da oportunidade",
      "tipo": "obra|licitacao|lead",
      "descricao": "2-3 frases com contexto real",
      "localizacao": "Cidade/Estado",
      "valor_estimado": "Valor em R$ ou A consultar",
      "prazo": "Prazo ou fase atual",
      "urgencia": "ALTA|MÉDIA|BAIXA",
      "como_abordar": "Ação específica: quem contatar, canal e momento ideal"
    }}
  ]
}}"""

    payload = json.dumps({
        "model": "llama-3.3-70b-versatile",
        "max_tokens": 2000,
        "temperature": 0.7,
        "messages": [
            {"role": "system", "content": "Responda APENAS com JSON válido, sem markdown."},
            {"role": "user", "content": prompt}
        ]
    }).encode("utf-8")

    # Usa curl via subprocess para contornar bloqueio Cloudflare
    import subprocess
    import tempfile

    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        f.write(payload.decode('utf-8'))
        tmpfile = f.name

    result = subprocess.run([
        "curl", "-s", "-X", "POST",
        "https://api.groq.com/openai/v1/chat/completions",
        "-H", "Content-Type: application/json",
        "-H", f"Authorization: Bearer {GROQ_API_KEY}",
        "-H", "User-Agent: curl/7.88.1",
        "--data", f"@{tmpfile}",
        "--max-time", "30"
    ], capture_output=True, text=True)

    print(f"📡 Status curl: returncode={result.returncode}")
    if result.stderr:
        print(f"⚠️ stderr: {result.stderr[:200]}")

    if result.returncode != 0:
        raise RuntimeError(f"curl falhou: {result.stderr}")

    response_text = result.stdout
    print(f"📋 Resposta (primeiros 200 chars): {response_text[:200]}")

    data = json.loads(response_text)

    if "error" in data:
        raise RuntimeError(f"Erro da API: {data['error']}")

    text = data["choices"][0]["message"]["content"]
    start = text.find("{")
    end = text.rfind("}") + 1
    return json.loads(text[start:end])

def salvar_json(result):
    agora = datetime.datetime.now().strftime("%d/%m/%Y às %H:%M")
    result["gerado_em"] = agora
    result["gh_token"] = os.environ.get("GH_TOKEN", "")
    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"✅ data.json salvo com {len(result.get('oportunidades', []))} oportunidades.")

def main():
    print("🔍 Buscando oportunidades...")
    result = buscar_oportunidades()
    print(f"✅ {len(result.get('oportunidades', []))} oportunidades encontradas!")
    print("💾 Salvando data.json...")
    salvar_json(result)
    print("🚀 Pronto!")

if __name__ == "__main__":
    main()
