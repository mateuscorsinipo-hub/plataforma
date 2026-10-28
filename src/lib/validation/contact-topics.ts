// Sem zod de propósito: o formulário de contato usa no navegador.
export const contactTopics = {
  support: "Ajuda com a conta ou o app",
  privacy: "Pedido sobre dados pessoais (LGPD)",
  copyright: "Direitos autorais (pedido de remoção)",
  report: "Denunciar conteúdo ou usuário",
  partnership: "Escolas e parcerias",
  other: "Outro assunto",
} as const;

export type ContactTopic = keyof typeof contactTopics;
