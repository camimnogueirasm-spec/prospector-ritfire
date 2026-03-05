import json
import datetime
import os
import subprocess
import tempfile

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

EMPRESA = "Ritfire Isolamentos"
DESCRICAO = "Fornecemos materiais e serviços de isolamento térmico para obras industriais, plantas petroquímicas, frigoríficos e construção civil de grande porte."
REGIAO = "Brasil"

def buscar_oportunidades(categoria, quantidade):
    categorias_desc = {
        "obra": "obras de construção civil industrial, expansões de plantas, reformas em indústrias, galpões frigoríficos e instalações petroquímicas",
        "licitacao": "licitações públicas e editais em portais como ComprasNet, BEC/SP, Licitações-e, portais estaduais e municipais",
        "lead": "empresas privadas com potencial de compra: petroquímicas, frigoríficos, siderúrgicas, alimentícias, farmacêuticas e data centers"
    }

    prompt = f"""Você é um especialista sênior em prospecção B2B para o mercado brasileiro, com foco em {categorias_desc[categoria]}.

Empresa prospectando: {EMPRESA}
Produto/Serviço: {DESCRICAO}
Região: {REGIAO}
Categoria: {categoria.upper()}

Identifique {quantidade} oportunidades REAIS, ESPECÍFICAS e ACIONÁVEIS de negócio para esta empresa hoje, focando em {categorias_desc[categoria]}.

Para cada oportunidade, inclua:
- Empresa ou órgão real e específico (com nome)
- Fonte real onde encontrar (portal, site, LinkedIn, etc)
- Contato sugerido (cargo/departamento ideal para abordar)
- Contexto de mercado atual que justifica a oportunidade

Responda APENAS com JSON válido:
{{
  "resumo": "Análise do cenário atual de {categoria} em 1 frase",
  "oportunidades": [
    {{
      "titulo": "Título específico da oportunidade",
      "tipo": "{categoria}",
      "empresa": "Nome real da empresa ou órgão",
      "descricao": "3-4 frases com contexto real, justificativa e momento de mercado",
      "localizacao": "Cidade/Estado",
      "valor_estimado": "Valor em R$ ou faixa estimada",
      "prazo": "Prazo, fase atual ou janela de oportunidade",
      "urgencia": "ALTA|MÉDIA|BAIXA",
      "fonte": "Portal ou canal onde encontrar/confirmar (ex: ComprasNet, LinkedIn, site da empresa)",
      "contato_ideal": "Cargo ou departamento para abordar (ex: Gerente de Manutenção, Engenharia)",
      "como_abordar": "Ação específica e detalhada: canal, argumento principal e momento ideal"
    }}
  ]
}}"""

    payload = json.dumps({
        "model": "llama-3.3-70b-versatile",
        "max_tokens": 4000,
        "temperature": 0.7,
        "messages": [
            {"role": "system", "content": "Responda APENAS com JSON válido, sem markdown, sem explicações."},
            {"role": "user", "content": prompt}
        ]
    }).encode("utf-8")

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
        "--max-time", "60"
    ], capture_output=True, text=True)

    if result.returncode != 0:
        raise RuntimeError(f"curl falhou: {result.stderr}")

    data = json.loads(result.stdout)
    if "error" in data:
        raise RuntimeError(f"Erro da API: {data['error']}")

    text = data["choices"][0]["message"]["content"]
    start = text.find("{")
    end = text.rfind("}") + 1
    return json.loads(text[start:end])

def salvar_json(categorias_data):
    agora = datetime.datetime.now().strftime("%d/%m/%Y às %H:%M")
    output = {
        "gerado_em": agora,
        "gh_token": os.environ.get("GH_TOKEN", ""),
        "categorias": categorias_data
    }
    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    total = sum(len(c.get("oportunidades", [])) for c in categorias_data.values())
    print(f"✅ data.json salvo com {total} oportunidades no total.")

def main():
    if not GROQ_API_KEY:
        raise ValueError("❌ GROQ_API_KEY está vazia!")

    print(f"🔑 Chave: {GROQ_API_KEY[:8]}... ({len(GROQ_API_KEY)} chars)")

    categorias = {
        "obra": 7,
        "licitacao": 7,
        "lead": 6
    }

    categorias_data = {}
    for categoria, quantidade in categorias.items():
        print(f"🔍 Buscando {quantidade} oportunidades de {categoria.upper()}...")
        result = buscar_oportunidades(categoria, quantidade)
        categorias_data[categoria] = result
        print(f"✅ {len(result.get('oportunidades', []))} oportunidades de {categoria} encontradas!")

    print("💾 Salvando data.json...")
    salvar_json(categorias_data)
    print("🚀 Pronto!")

if __name__ == "__main__":
    main()
