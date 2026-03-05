import urllib.request
import urllib.error
import json
import datetime
import ssl
import os

# ============================================================
# CONFIGURAÇÕES
# ============================================================
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

EMPRESA = "Ritfire Isolamentos"
DESCRICAO = "Fornecemos materiais e serviços de isolamento térmico para obras industriais, plantas petroquímicas, frigoríficos e construção civil de grande porte."
REGIAO = "Brasil"
# ============================================================

def buscar_oportunidades():
    # DEBUG: verifica se a chave chegou
    if not GROQ_API_KEY:
        raise ValueError("❌ GROQ_API_KEY está VAZIA! Verifique os Secrets do repositório.")
    
    print(f"🔑 Chave carregada: {GROQ_API_KEY[:8]}... ({len(GROQ_API_KEY)} caracteres)")

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

    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {GROQ_API_KEY}"
        }
    )

    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, context=ctx) as response:
            data = json.loads(response.read())
            text = data["choices"][0]["message"]["content"]
            start = text.find("{")
            end = text.rfind("}") + 1
            return json.loads(text[start:end])
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"❌ HTTP {e.code}: {e.reason}")
        print(f"📋 Resposta da API: {body}")
        raise

def salvar_json(result):
    agora = datetime.datetime.now().strftime("%d/%m/%Y às %H:%M")
    result["gerado_em"] = agora
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
