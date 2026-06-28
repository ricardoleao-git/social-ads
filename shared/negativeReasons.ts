/**
 * Lista canônica de motivos de negativação de palavras-chave.
 * Usada tanto no frontend (dropdown) quanto no backend (classificação automática).
 * Serve como base de aprendizado e auditoria de decisões.
 */

export const NEGATIVE_REASONS = [
  // ─── Intenção / Relevância ───────────────────────────────────────────────
  {
    value: "irrelevante_produto",
    label: "Irrelevante para o produto",
    description: "O termo não tem relação com nenhum produto ou serviço da Zênite Tech.",
    category: "relevancia",
    examples: ["skynet", "terminator", "ficção científica"],
  },
  {
    value: "generico_sem_intencao",
    label: "Termo genérico sem intenção de compra",
    description: "Termo amplo demais que atrai tráfego de baixa qualidade sem intenção comercial.",
    category: "relevancia",
    examples: ["segurança", "tecnologia", "sistema"],
  },
  {
    value: "informacional",
    label: "Busca informacional (não comercial)",
    description: "Usuário busca informação, conceito ou definição — não está comprando.",
    category: "relevancia",
    examples: ["o que é reconhecimento facial", "como funciona biometria", "wikipedia"],
  },
  {
    value: "tutorial_diy",
    label: "Tutorial / faça você mesmo (DIY)",
    description: "Usuário quer instalar ou configurar sozinho — não quer contratar serviço.",
    category: "relevancia",
    examples: ["como instalar", "tutorial", "passo a passo", "github", "open source"],
  },
  // ─── Público / Segmento ──────────────────────────────────────────────────
  {
    value: "b2c_residencial",
    label: "B2C / uso residencial",
    description: "Intenção de uso pessoal ou residencial — Zênite Tech atende exclusivamente B2B.",
    category: "publico",
    examples: ["para apartamento", "uso pessoal", "condomínio residencial", "portaria residencial"],
  },
  {
    value: "emprego",
    label: "Busca por emprego / vaga",
    description: "Usuário procura trabalho, não produto ou serviço.",
    category: "publico",
    examples: ["vaga de emprego", "estágio", "trainee", "salário", "currículo"],
  },
  {
    value: "estudante_pesquisador",
    label: "Estudante / pesquisador acadêmico",
    description: "Busca acadêmica ou de pesquisa — não é cliente potencial B2B.",
    category: "publico",
    examples: ["TCC", "monografia", "artigo científico", "pesquisa universitária"],
  },
  // ─── Concorrência ────────────────────────────────────────────────────────
  {
    value: "concorrente_direto",
    label: "Concorrente direto",
    description: "Usuário já pesquisa marca concorrente específica — clique seria desperdiçado.",
    category: "concorrencia",
    examples: ["control id", "zkteco", "anviz", "henry uhf", "nice sistemas", "acesso id"],
  },
  {
    value: "plataforma_alternativa",
    label: "Plataforma / ferramenta alternativa",
    description: "Usuário busca plataforma alternativa específica — já tem preferência definida.",
    category: "concorrencia",
    examples: ["manychat", "botmaker", "take blip", "zendesk", "freshdesk", "botmake"],
  },
  // ─── Produto / Serviço ───────────────────────────────────────────────────
  {
    value: "produto_nao_vendemos",
    label: "Produto que não vendemos",
    description: "Busca por produto ou categoria fora do portfólio da Zênite Tech.",
    category: "produto",
    examples: ["PABX físico", "câmera analógica", "alarme residencial"],
  },
  {
    value: "ia_pessoal",
    label: "IA pessoal / chatbot pessoal",
    description: "Usuário busca IA para uso pessoal — não é solução B2B empresarial.",
    category: "produto",
    examples: ["chatgpt", "gemini", "claude", "copilot", "conversar com ia", "chatbot grátis"],
  },
  {
    value: "gratuidade",
    label: "Busca por produto gratuito",
    description: "Usuário quer versão gratuita — incompatível com posicionamento premium B2B.",
    category: "produto",
    examples: ["grátis", "gratuito", "free", "sem custo", "de graça"],
  },
  // ─── Preço / Posicionamento ──────────────────────────────────────────────
  {
    value: "preco_baixo",
    label: "Busca por preço baixo / promoção",
    description: "Intenção de compra por preço mínimo — incompatível com posicionamento premium.",
    category: "preco",
    examples: ["mais barato", "promoção", "oferta", "desconto", "preço baixo"],
  },
  // ─── Performance ─────────────────────────────────────────────────────────
  {
    value: "alto_custo_sem_conversao",
    label: "Alto custo sem conversão",
    description: "Termo gerou gasto significativo sem nenhuma conversão no período analisado.",
    category: "performance",
    examples: ["termos com >R$10 gasto e 0 conversões"],
  },
  {
    value: "baixo_ctr",
    label: "CTR muito baixo (< 1%)",
    description: "Termo com muitas impressões mas pouquíssimos cliques — indica irrelevância.",
    category: "performance",
    examples: ["termos com >100 impressões e CTR < 1%"],
  },
  // ─── Localidade ──────────────────────────────────────────────────────────
  {
    value: "localidade_fora_alvo",
    label: "Localidade fora do alvo",
    description: "Busca de região geográfica fora da área de atuação da Zênite Tech.",
    category: "localidade",
    examples: ["exterior", "fora do Brasil", "cidade não atendida"],
  },
  // ─── Suporte / Pós-venda ─────────────────────────────────────────────────
  {
    value: "suporte_pos_venda",
    label: "Suporte / pós-venda (cliente existente)",
    description: "Busca de cliente já existente por suporte — não é novo lead.",
    category: "suporte",
    examples: ["suporte técnico", "assistência", "conserto", "manutenção"],
  },
  // ─── Outro ───────────────────────────────────────────────────────────────
  {
    value: "outro",
    label: "Outro motivo",
    description: "Motivo específico não coberto pelas categorias acima.",
    category: "outro",
    examples: [],
  },
] as const;

export type NegativeReasonValue = typeof NEGATIVE_REASONS[number]["value"];

/** Mapa rápido valor → label para exibição */
export const NEGATIVE_REASON_LABELS: Record<string, string> = Object.fromEntries(
  NEGATIVE_REASONS.map(r => [r.value, r.label])
);

/** Mapa de categoria de intenção automática → valor do motivo */
export const INTENT_CATEGORY_TO_REASON: Record<string, NegativeReasonValue> = {
  emprego: "emprego",
  gratuidade: "gratuidade",
  informacional: "informacional",
  b2c_residencial: "b2c_residencial",
  preco_baixo: "preco_baixo",
  ia_pessoal: "ia_pessoal",
  concorrente: "concorrente_direto",
  plataforma_bot: "plataforma_alternativa",
  tutorial_diy: "tutorial_diy",
  irrelevante: "irrelevante_produto",
  alto_custo: "alto_custo_sem_conversao",
};

/**
 * Infere automaticamente o motivo de negativação com base no texto da palavra-chave.
 * Usado para palavras que vieram da API do Google Ads sem motivo cadastrado.
 * Cobre 100% dos casos reais da conta Zênite Tech por inferência.
 * Retorna sempre um valor canônico — nunca retorna null.
 */
export function inferNegativeReason(keyword: string): NegativeReasonValue {
  const k = keyword.toLowerCase().trim();

  // ── 1. Emprego / vaga ─────────────────────────────────────────────────────
  if (/\b(vaga|emprego|est[aá]gio|trainee|sal[aá]rio|curr[ií]culo|contrata[cç][aã]o|recrutamento|sele[cç][aã]o|rh\b|recursos.?humanos|clt|pj\b|home.?office|remoto|presencial|vagas|oportunidade.?de.?trabalho|trabalhar|trabalho.?em)\b/.test(k)) return "emprego";

  // ── 2. Gratuidade / free / pirataria ─────────────────────────────────────
  if (/\b(gr[aá]tis|gratuito|free|sem.?custo|de.?gra[cç]a|open.?source|download|crack|serial|pirat|keygen|trial|vers[aã]o.?gratuita|plano.?gratuito|freemium|sem.?mensalidade)\b/.test(k)) return "gratuidade";

  // ── 3. Concorrentes diretos (hardware/acesso/biometria) ───────────────────
  if (/\b(control.?id|zkteco|zteco|anviz|henry.?uhf|nice.?sist|acesso.?id|hikvision|dahua|intelbras|geoface|bioface|biopoint|suprema|virdi|secullum|dimep|topdata|ponto.?more|ahgora|senior.?sistemas|totvs.?rh|sap.?rh|benner|tangerino|pontomais|pontofacil|clockin|jornada.?work|solides|convenia|gupy)\b/.test(k)) return "concorrente_direto";

  // ── 4. Plataformas alternativas (chatbot/WhatsApp/CRM) ────────────────────
  if (/\b(manychat|botmaker|take.?blip|zendesk|freshdesk|botmake|wati|twilio|intercom|hubspot|salesforce|pipedrive|rd.?station|kommo|treble|respond.?io|octadesk|movidesk|jivochat|crisp|tawk|tidio|drift|livechat|clickup|monday|asana|trello|notion|slack|teams|discord|telegram.?bot|whatsapp.?business.?api)\b/.test(k)) return "plataforma_alternativa";

  // ── 5. IAs pessoais / chatbots pessoais ───────────────────────────────────
  if (/\b(chatgpt|chat.?gpt|gemini|claude|copilot|grok|perplexity|llama|mistral|bard|bing.?ia|ia.?gratis|chatbot.?gr[aá]tis|conversar.?com.?ia|ia.?pessoal|skynet|terminator|robô.?pessoal|assistente.?virtual.?pessoal|siri|alexa|cortana|google.?assistant)\b/.test(k)) return "ia_pessoal";

  // ── 6. Informacional / conceitual ─────────────────────────────────────────
  if (/\b(o que [eé]|como funciona|defini[cç][aã]o|wikipedia|conceito|significado|hist[oó]ria|origem|explica[cç][aã]o|entender|aprender|saber|conhecer|diferença entre|vantagens.?e.?desvantagens|pros.?e.?contras|comparativo.?entre|vs\b)\b/.test(k)) return "informacional";

  // ── 7. Tutorial / DIY / código ────────────────────────────────────────────
  if (/\b(como instalar|como configurar|como fazer|tutorial|passo.?a.?passo|manual|instru[cç][oõ]es|github|reposit[oó]rio|c[oó]digo.?fonte|api.?gratis|sdk|documentação|doc\b|exemplo.?de.?c[oó]digo|script|automação.?gratuita|zapier.?gratis|n8n.?gratis|make.?gratis)\b/.test(k)) return "tutorial_diy";

  // ── 8. B2C / residencial / uso pessoal ────────────────────────────────────
  if (/\b(uso.?pessoal|para.?casa|apartamento|condom[ií]nio.?residencial|portaria.?residencial|residencial|dom[eé]stico|individual|pessoa.?f[ií]sica|minha.?casa|meu.?apartamento|para.?mim|para.?minha|casa.?inteligente|smart.?home|automação.?residencial|alarme.?residencial|câmera.?residencial|portão.?residencial)\b/.test(k)) return "b2c_residencial";

  // ── 9. Preço baixo / promoção ─────────────────────────────────────────────
  if (/\b(mais.?barato|promo[cç][aã]o|oferta|desconto|pre[cç]o.?baixo|barato|econ[oô]mico|custo.?baixo|menor.?pre[cç]o|pre[cç]o.?acess[ií]vel|custo.?bene[fí]cio|mais.?em.?conta|parcelado.?sem.?juros|sem.?entrada|pre[cç]o.?popular|pre[cç]o.?reduzido)\b/.test(k)) return "preco_baixo";

  // ── 10. Suporte / pós-venda ───────────────────────────────────────────────
  if (/\b(suporte.?t[eé]cnico|assist[eê]ncia.?t[eé]cnica|conserto|manuten[cç][aã]o|reparo|pe[cç]as|reposi[cç][aã]o|garantia|troca|devolu[cç][aã]o|reclamação|reclame.?aqui|procon|ouvidoria|sac\b|atendimento.?p[oó]s|help.?desk|service.?desk)\b/.test(k)) return "suporte_pos_venda";

  // ── 11. Estudante / acadêmico ─────────────────────────────────────────────
  if (/\b(tcc|monografia|artigo.?cient[ií]fico|pesquisa.?universit[aá]ria|faculdade|universidade|escola.?t[eé]cnica|curso.?gratuito|apostila|material.?did[aá]tico|aula|professor|aluno|vestibular|enem|concurso.?p[uú]blico|concurso.?policial|concurso.?militar)\b/.test(k)) return "estudante_pesquisador";

  // ── 12. Produto fora do portfólio ─────────────────────────────────────────
  if (/\b(pabx.?f[ií]sico|central.?telef[oô]nica.?f[ií]sica|câmera.?anal[oó]gica|dvr|nvr|alarme.?residencial|sensor.?de.?movimento.?residencial|fechadura.?residencial|fechadura.?digital.?residencial|interfone.?residencial|porteiro.?eletr[oô]nico.?residencial|cerca.?el[eé]trica|eletrificador|cerca.?eletrica)\b/.test(k)) return "produto_nao_vendemos";

  // ── 13. Localidade fora do alvo ───────────────────────────────────────────
  if (/\b(exterior|fora.?do.?brasil|portugal|angola|mo[cç]ambique|cabo.?verde|timor|estados.?unidos|eua|argentina|chile|colombia|mexico|espanha|fran[cç]a|alemanha|reino.?unido|uk\b|usa\b|worldwide|global|international)\b/.test(k)) return "localidade_fora_alvo";

  // ── 14. Termos genéricos sem intenção (palavra única ou muito curta) ──────
  if (/^(segurança|tecnologia|sistema|software|hardware|app|aplicativo|programa|plataforma|solu[cç][aã]o|servi[cç]o|produto|controle|acesso|monitoramento|câmera|sensor|biometria|facial|digital|inteligente|automa[cç][aã]o|gest[aã]o|gerenciamento|rastreamento|vigilância|cftv|ip\b|iot\b|cloud|nuvem|saas|paas)$/.test(k)) return "generico_sem_intencao";

  // ── 15. Termos de carregamento/EV fora do contexto B2B ────────────────────
  if (/\b(carro.?el[eé]trico.?residencial|recarga.?em.?casa|tomada.?residencial.?carro|carregador.?portatil.?carro|power.?bank.?carro|recarga.?na.?tomada.?comum|220v.?carro|110v.?carro|extensão.?carro.?el[eé]trico)\b/.test(k)) return "b2c_residencial";

  // ── 16. Termos de WhatsApp pessoal (não empresarial) ─────────────────────
  if (/\b(whatsapp.?pessoal|whatsapp.?gratis|baixar.?whatsapp|instalar.?whatsapp|whatsapp.?web|whatsapp.?pc|whatsapp.?computador|whatsapp.?backup|recuperar.?whatsapp|whatsapp.?hackeado|whatsapp.?clonado|espionar.?whatsapp|ver.?whatsapp.?de.?outra.?pessoa)\b/.test(k)) return "b2c_residencial";

  // ── 17. Termos de relógio de ponto pessoal / para MEI ────────────────────
  if (/\b(rel[oó]gio.?de.?ponto.?para.?mim|rel[oó]gio.?de.?ponto.?gratuito|rel[oó]gio.?de.?ponto.?gratis|controle.?de.?ponto.?pessoal|ponto.?para.?autonomo|ponto.?para.?mei|ponto.?para.?freelancer|bater.?ponto.?sozinho|app.?ponto.?gratis)\b/.test(k)) return "b2c_residencial";

  // ── 18. Termos de reconhecimento facial pessoal / desbloqueio ────────────
  if (/\b(reconhecimento.?facial.?celular|face.?id|touch.?id|desbloquear.?celular|biometria.?celular|biometria.?digital.?celular|impressão.?digital.?celular|sensor.?biometrico.?celular|face.?unlock)\b/.test(k)) return "b2c_residencial";

  // ── 19. Fallback: termos muito curtos (1-2 caracteres) → genérico ─────────
  if (k.length <= 3) return "generico_sem_intencao";

  // ── 20. Fallback final: irrelevante para o produto ────────────────────────
  return "irrelevante_produto";
}

/**
 * Versão legível do motivo inferido para exibição na UI.
 * Sempre retorna uma string — nunca vazia.
 */
export function getReasonLabel(keyword: string, storedReason?: string | null): string {
  if (storedReason && storedReason !== "sem_motivo" && storedReason !== "") {
    return NEGATIVE_REASON_LABELS[storedReason] ?? storedReason;
  }
  const inferred = inferNegativeReason(keyword);
  return NEGATIVE_REASON_LABELS[inferred] ?? "Irrelevante para o produto";
}
