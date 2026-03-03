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
EMAILJS_SERVICE_ID = "service_o318m79"
EMAILJS_TEMPLATE_ID = "template_cfgxl3b"
EMAILJS_PUBLIC_KEY = "xbqV_gmiVw9vchNxR"

EMPRESA = "Ritfire Isolamentos"
DESCRICAO = "Fornecemos materiais e serviços de isolamento térmico para obras industriais, plantas petroquímicas, frigoríficos e construção civil de grande porte."
REGIAO = "Brasil"
# ============================================================

def buscar_oportunidades():
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY não configurada! Verifique os Secrets do repositório.")

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
    with urllib.request.urlopen(req, context=ctx) as response:
        data = json.loads(response.read())
        text = data["choices"][0]["message"]["content"]
        start = text.find("{")
        end = text.rfind("}") + 1
        return json.loads(text[start:end])

def montar_html(result):
    agora = datetime.datetime.now().strftime("%d/%m/%Y às %H:%M")
    
    tipo_emoji = {"obra": "🏗", "licitacao": "📋", "lead": "🎯"}
    urgencia_cor = {"ALTA": "#ff4d00", "MÉDIA": "#ff9500", "BAIXA": "#00c853"}

    cards = ""
    for op in result.get("oportunidades", []):
        emoji = tipo_emoji.get(op.get("tipo", "lead"), "📌")
        cor = urgencia_cor.get(op.get("urgencia", "MÉDIA"), "#ff9500")
        
        cards += f"""
        <div style="border:1px solid #e0e0e0; border-radius:10px; padding:18px; margin-bottom:16px; border-left: 4px solid {cor};">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                <strong style="font-size:15px; color:#1a1a2e;">{emoji} {op.get('titulo','')}</strong>
                <span style="background:{cor}; color:white; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:bold; white-space:nowrap; margin-left:10px;">{op.get('urgencia','')}</span>
            </div>
            <p style="color:#555; font-size:13px; line-height:1.6; margin:0 0 12px;">{op.get('descricao','')}</p>
            <table style="width:100%; font-size:12px; color:#777; margin-bottom:12px;">
                <tr>
                    <td>📍 <strong>{op.get('localizacao','')}</strong></td>
                    <td>💰 <strong>{op.get('valor_estimado','')}</strong></td>
                    <td>🗓 <strong>{op.get('prazo','')}</strong></td>
                </tr>
            </table>
            <div style="background:#fff8f0; border-left:3px solid {cor}; padding:10px 14px; border-radius:0 8px 8px 0;">
                <strong style="font-size:11px; color:{cor}; text-transform:uppercase; letter-spacing:1px;">💡 Como abordar</strong>
                <p style="margin:4px 0 0; font-size:13px; color:#444; line-height:1.5;">{op.get('como_abordar','')}</p>
            </div>
        </div>
        """

    html = f"""
    <div style="font-family:Arial,sans-serif; max-width:600px;">
        <p style="color:#888; font-size:13px; margin-bottom:16px;">
            📊 <strong>Cenário:</strong> {result.get('resumo','')}
        </p>
        <p style="color:#888; font-size:12px; margin-bottom:20px;">
            {len(result.get('oportunidades',[]))} oportunidades identificadas para hoje
        </p>
        {cards}
        <div style="background:#f9f9f9; padding:14px; border-radius:8px; margin-top:20px; text-align:center;">
            <p style="font-size:12px; color:#aaa; margin:0;">
                🤖 Relatório gerado automaticamente pelo AI Prospector<br>
                Powered by Groq + GitHub Actions
            </p>
        </div>
    </div>
    """
    return html, agora

def enviar_email(html_content, data_hora):
    payload = json.dumps({
        "service_id": EMAILJS_SERVICE_ID,
        "template_id": EMAILJS_TEMPLATE_ID,
        "user_id": EMAILJS_PUBLIC_KEY,
        "template_params": {
            "name": "AI Prospector",
            "email": "noreply@aiprospector.com",
            "message": html_content,
            "data_hora": data_hora
        }
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.emailjs.com/api/v1.0/email/send",
        data=payload,
        headers={"Content-Type": "application/json"}
    )

    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, context=ctx) as response:
        return response.read()

def main():
    print("🔍 Buscando oportunidades...")
    result = buscar_oportunidades()
    print(f"✅ {len(result.get('oportunidades', []))} oportunidades encontradas!")

    print("📧 Montando e-mail...")
    html_content, data_hora = montar_html(result)

    print("📤 Enviando e-mail...")
    enviar_email(html_content, data_hora)
    print("✅ E-mail enviado com sucesso!")

if __name__ == "__main__":
    main()
