import os
import json
import datetime
import ssl
import time
import requests

# ============================================================
# CONFIGURAÇÕES
# ============================================================
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
print(f"DEBUG - Chave recebida: {GROQ_API_KEY[:8] if GROQ_API_KEY else 'VAZIA'}")

EMAILJS_SERVICE_ID = "service_o318m79"
EMAILJS_TEMPLATE_ID = "template_cfgxl3b"
EMAILJS_PUBLIC_KEY = "xbqV_gmiVw9vchNxR"

EMPRESA = "Ritfire"
REGIAO = "Brasil"
# ============================================================

SETORES_ALVO = [
    "Siderúrgicas", "Metalúrgicas", "Construção Civil", "Offshore",
    "Empresas Navais", "Fundições", "Indústrias de Vidro",
    "Indústrias Cerâmicas", "Cimenteiras", "Fabricantes de Forjas",
    "Petroquímicas", "Refinarias", "Usinas Termoelétricas",
    "Indústrias de Alumínio", "Fabricantes de Fornos Industriais",
    "Empresas de Manutenção de Fornos", "Fabricantes de Caldeiras",
    "Empresas de Isolamento Térmico Industrial", "Empresas de Automação",
    "Montadoras de Automóveis", "Papel e Celulose",
    "Hospitais", "Mineração", "Aeroportos"
]

ctx = ssl.create_default_context()

def buscar_oportunidades():
    setores_str = ", ".join(SETORES_ALVO)

    prompt = f"""Você é um especialista sênior em prospecção B2B para o mercado brasileiro, especializado em vendas para indústrias pesadas.

A empresa {EMPRESA} atua em dois nichos:
1. PROTEÇÃO PASSIVA CONTRA INCÊNDIO (principal): revestimentos intumescentes, selantes, barreiras corta-fogo, portas corta-fogo, sistemas de compartimentação.
2. ISOLAMENTO TÉRMICO (secundário): materiais e serviços de isolamento térmico para processos industriais de alta temperatura.

Setores-alvo: {setores_str}

Identifique 6 oportunidades REAIS e ATUAIS no Brasil onde a Ritfire pode prospectar clientes agora.
Para cada oportunidade, forneça o CNPJ real da empresa se souber.

Responda APENAS com JSON válido (sem markdown):
{{
  "resumo": "Análise do cenário atual em 1 frase para proteção passiva e isolamento térmico no Brasil",
  "oportunidades": [
    {{
      "nicho": "incendio|termico",
      "titulo": "Título da oportunidade",
      "empresa_alvo": "Nome real da empresa",
      "cnpj": "CNPJ com 14 dígitos ou null",
      "setor": "Setor da empresa",
      "descricao": "2-3 frases com contexto real e necessidade específica",
      "localizacao": "Cidade/Estado",
      "valor_estimado": "Valor estimado em R$",
      "prazo": "Prazo ou fase atual",
      "urgencia": "ALTA|MÉDIA|BAIXA",
      "pct": 75,
      "contato_email": "E-mail provável da empresa",
      "contato_telefone": "Telefone da sede se conhecido",
      "como_abordar": "Cargo a contatar, mensagem-chave, canal ideal e melhor momento"
    }}
  ]
}}

Gere exatamente 6 oportunidades: 4 de proteção passiva contra incêndio e 2 de isolamento térmico.
Use empresas reais brasileiras conhecidas nesses setores."""

    response = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {GROQ_API_KEY}"
        },
        json={
            "model": "llama-3.3-70b-versatile",
            "max_tokens": 3000,
            "temperature": 0.7,
            "messages": [
                {"role": "system", "content": "Responda APENAS com JSON válido, sem markdown, sem texto fora do JSON."},
                {"role": "user", "content": prompt}
            ]
        },
        timeout=30
    )

    print(f"DEBUG - Status Groq: {response.status_code}")

    if response.status_code != 200:
        raise Exception(f"Erro Groq: {response.status_code} - {response.text}")

    data = response.json()
    text = data["choices"][0]["message"]["content"]
    start = text.find("{")
    end = text.rfind("}") + 1
    return json.loads(text[start:end])


def buscar_cnpj(cnpj):
    if not cnpj:
        return None
    cnpj_limpo = ''.join(filter(str.isdigit, str(cnpj)))
    if len(cnpj_limpo) != 14:
        return None
    try:
        response = requests.get(
            f"https://publica.cnpj.ws/cnpj/{cnpj_limpo}",
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=8
        )
        if response.status_code == 200:
            data = response.json()
            if data.get("estabelecimento"):
                est = data["estabelecimento"]
                email = est.get("email")
                tel = (est.get("ddd1", "") + est.get("telefone1", "")) or (est.get("ddd2", "") + est.get("telefone2", ""))
                return {
                    "razao_social": data.get("razao_social", ""),
                    "email": email,
                    "telefone": tel
                }
    except Exception as e:
        print(f"  ⚠️ CNPJ {cnpj} erro: {e}")
    return None


def enriquecer_com_cnpj(oportunidades):
    print("🔍 Buscando contatos reais via CNPJ.ws...")
    for op in oportunidades:
        if op.get("cnpj"):
            print(f"  → {op['empresa_alvo']}...")
            dados = buscar_cnpj(op["cnpj"])
            if dados:
                if dados.get("email"):
                    op["contato_email"] = dados["email"]
                if dados.get("telefone"):
                    op["contato_telefone"] = dados["telefone"]
                op["dados_cnpj_validados"] = True
                print(f"  ✅ Contatos encontrados!")
            time.sleep(0.5)
    return oportunidades


def montar_html(result):
    agora = datetime.datetime.now().strftime("%d/%m/%Y às %H:%M")
    nicho_cor = {"incendio": "#ff4d00", "termico": "#1976d2"}
    nicho_label = {"incendio": "🔥 PROTEÇÃO CONTRA INCÊNDIO", "termico": "🌡 ISOLAMENTO TÉRMICO"}
    urgencia_cor = {"ALTA": "#e53935", "MÉDIA": "#ff9500", "BAIXA": "#00c853"}

    ops = result.get("oportunidades", [])
    total = len(ops)
    incendio = len([o for o in ops if o.get("nicho") == "incendio"])
    termico = len([o for o in ops if o.get("nicho") == "termico"])
    alta = len([o for o in ops if o.get("urgencia") == "ALTA"])

    cards = ""
    for op in ops:
        nicho = op.get("nicho", "incendio")
        cor_n = nicho_cor.get(nicho, "#ff4d00")
        cor_u = urgencia_cor.get(op.get("urgencia", "MÉDIA"), "#ff9500")
        label_n = nicho_label.get(nicho, "")
        validado = op.get("dados_cnpj_validados", False)

        contatos_html = ""
        if op.get("contato_email"):
            contatos_html += f'<tr><td style="padding:4px 0;font-size:13px;">📧 <span style="color:#666;">E-mail:</span> <a href="mailto:{op["contato_email"]}" style="color:{cor_n};font-weight:bold;">{op["contato_email"]}</a></td></tr>'
        if op.get("contato_telefone"):
            tel = op["contato_telefone"]
            tel_limpo = ''.join(filter(str.isdigit, tel))
            contatos_html += f'<tr><td style="padding:4px 0;font-size:13px;">📞 <span style="color:#666;">Telefone:</span> <strong>{tel}</strong></td></tr>'
            contatos_html += f'<tr><td style="padding:4px 0;font-size:13px;">💬 <span style="color:#666;">WhatsApp:</span> <a href="https://wa.me/55{tel_limpo}" style="color:#25d366;font-weight:bold;">Abrir conversa →</a></td></tr>'

        cards += f"""
        <div style="border:1px solid #e0e0e0;border-radius:10px;padding:20px;margin-bottom:18px;border-left:5px solid {cor_n};">
            <div style="margin-bottom:10px;">
                <span style="background:{cor_n};color:white;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:bold;">{label_n}</span>
                <span style="background:{cor_u};color:white;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:bold;margin-left:6px;">{op.get('urgencia','')}</span>
                {('<span style="background:#e8f5e9;color:#2e7d32;padding:3px 10px;border-radius:20px;font-size:10px;margin-left:6px;">✅ Contato validado</span>') if validado else ''}
            </div>
            <h3 style="font-size:16px;color:#1a1a2e;margin:0 0 4px;">{op.get('titulo','')}</h3>
            <p style="font-size:13px;color:#666;margin:0 0 12px;">🏭 <strong>{op.get('empresa_alvo','')}</strong> · {op.get('setor','')} · 📍 {op.get('localizacao','')}</p>
            <p style="color:#555;font-size:13px;line-height:1.6;margin:0 0 14px;">{op.get('descricao','')}</p>
            <table style="width:100%;font-size:12px;margin-bottom:14px;border-collapse:collapse;">
                <tr>
                    <td style="color:#666;padding:4px 8px 4px 0;">💰 Valor:</td>
                    <td style="font-weight:bold;color:#333;">{op.get('valor_estimado','A consultar')}</td>
                    <td style="color:#666;padding:4px 8px 4px 16px;">🗓 Prazo:</td>
                    <td style="font-weight:bold;color:#333;">{op.get('prazo','Em andamento')}</td>
                </tr>
            </table>
            {f'<div style="background:#f8f8ff;border:1px solid #e0e0ff;border-radius:8px;padding:12px;margin-bottom:14px;"><p style="font-size:11px;font-weight:bold;color:{cor_n};text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">📬 Dados de Contato</p><table style="border-collapse:collapse;">{contatos_html}</table></div>' if contatos_html else '<div style="background:#fff3e0;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#e65100;">⚠️ Buscar contatos manualmente no site da empresa.</div>'}
            <div style="background:#fff8f0;border-left:3px solid {cor_n};padding:10px 14px;border-radius:0 8px 8px 0;">
                <strong style="font-size:11px;color:{cor_n};text-transform:uppercase;letter-spacing:1px;">💡 Como abordar</strong>
                <p style="margin:4px 0 0;font-size:13px;color:#444;line-height:1.5;">{op.get('como_abordar','')}</p>
            </div>
        </div>"""

    html = f"""<div style="font-family:Arial,sans-serif;max-width:620px;">
    <div style="background:#f9f9f9;border-radius:8px;padding:14px 16px;margin-bottom:20px;text-align:center;">
        <table style="width:100%;border-collapse:collapse;">
            <tr>
                <td style="padding:8px;"><div style="font-size:24px;font-weight:bold;color:#333;">{total}</div><div style="font-size:11px;color:#888;">TOTAL</div></td>
                <td style="padding:8px;"><div style="font-size:24px;font-weight:bold;color:#ff4d00;">{incendio}</div><div style="font-size:11px;color:#888;">INCÊNDIO</div></td>
                <td style="padding:8px;"><div style="font-size:24px;font-weight:bold;color:#1976d2;">{termico}</div><div style="font-size:11px;color:#888;">TÉRMICO</div></td>
                <td style="padding:8px;"><div style="font-size:24px;font-weight:bold;color:#e53935;">{alta}</div><div style="font-size:11px;color:#888;">URGENTE</div></td>
            </tr>
        </table>
    </div>
    <p style="color:#555;font-size:13px;background:#fff8f0;padding:12px 16px;border-radius:8px;margin-bottom:20px;">📊 <strong>Cenário:</strong> {result.get('resumo','')}</p>
    {cards}
    <div style="background:#f5f5f5;padding:14px;border-radius:8px;text-align:center;margin-top:10px;">
        <p style="font-size:11px;color:#aaa;margin:0;">🤖 AI Prospector Ritfire v2.0 · Groq LLaMA 3.3 + CNPJ.ws + GitHub Actions · {agora}</p>
    </div>
    </div>"""
    return html, agora


def enviar_email(html_content, data_hora):
    response = requests.post(
        "https://api.emailjs.com/api/v1.0/email/send",
        headers={"Content-Type": "application/json"},
        json={
            "service_id": EMAILJS_SERVICE_ID,
            "template_id": EMAILJS_TEMPLATE_ID,
            "user_id": EMAILJS_PUBLIC_KEY,
            "template_params": {
                "name": "AI Prospector Ritfire",
                "email": "noreply@aiprospector.com",
                "message": html_content,
                "data_hora": data_hora
            }
        },
        timeout=15
    )
    print(f"DEBUG - Status EmailJS: {response.status_code} - {response.text}")
    return response


def main():
    print("=" * 50)
    print("🎯 AI Prospector Ritfire v2.0")
    print("=" * 50)
    print("\n🔍 Buscando oportunidades com IA...")
    result = buscar_oportunidades()
    ops = result.get("oportunidades", [])
    print(f"✅ {len(ops)} oportunidades identificadas!")
    print("\n📊 Enriquecendo com dados reais de contato...")
    ops = enriquecer_com_cnpj(ops)
    result["oportunidades"] = ops
    print("\n📧 Montando relatório...")
    html_content, data_hora = montar_html(result)
    print("📤 Enviando e-mail...")
    enviar_email(html_content, data_hora)
    print("✅ Concluído!")
    print(f"📬 Destinatários: charles@ritfire.com.br + comercial@ritfire.com.br")
    print("=" * 50)


if __name__ == "__main__":
    main()
