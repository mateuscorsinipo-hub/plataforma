import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/site/legal-page";
import { publicEnv } from "@/lib/env/public";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Como o Grifo coleta, usa, compartilha e protege dados pessoais, em conformidade com a LGPD.",
};

export default function PrivacyPage() {
  const { company } = publicEnv;
  return (
    <LegalPage title="Política de privacidade" updatedAt="27 de outubro de 2026">
      <p>
        Esta política explica quais dados pessoais o Grifo trata, para quê, com quem compartilha e como você exerce seus
        direitos, nos termos da Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018, LGPD) e das normas de proteção
        de crianças e adolescentes no ambiente digital.
      </p>

      <h2>1. Quem é o controlador</h2>
      <p>
        O controlador dos dados é {company.name ?? "[Razão social]"}, inscrito sob {company.document ?? "CNPJ [a definir]"}
        {company.address ? `, com sede em ${company.address}` : ", com sede em [endereço]"}. O encarregado pelo tratamento de
        dados pessoais pode ser contatado em {company.dpoEmail ?? "[e-mail do encarregado]"} ou pelo{" "}
        <Link href="/contato?assunto=privacy">formulário de pedidos sobre dados pessoais</Link>.
      </p>

      <h2>2. Dados que tratamos</h2>
      <ul>
        <li>
          <strong>Cadastro:</strong> nome, e-mail, senha (guardada apenas como hash pelo provedor de autenticação) e data de
          nascimento, usada para aplicar as regras de proteção a menores.
        </li>
        <li>
          <strong>Perfil e preferências:</strong> nome de exibição, nome de usuário, foto e biografia opcionais, etapa de ensino,
          série, matérias de interesse, objetivos, dificuldades, tempo disponível e datas de provas que você informar.
        </li>
        <li>
          <strong>Conteúdo que você envia:</strong> arquivos, textos colados, conversas com o tutor, materiais gerados,
          flashcards, quizzes, respostas de simulados, planos e eventos do calendário.
        </li>
        <li>
          <strong>Atividade de estudo:</strong> revisões, tentativas, tempo de estudo registrado, XP, conquistas e posição em
          ligas.
        </li>
        <li>
          <strong>Dados técnicos:</strong> cookies de sessão necessários para manter você conectado e um identificador anônimo
          derivado do endereço IP (com segredo e troca diária) para contar visualizações sem duplicidade e limitar abusos.
        </li>
        <li>
          <strong>Pagamentos:</strong> processados pelo provedor de pagamento. Não armazenamos número de cartão; guardamos o
          status da assinatura e o identificador do cliente no provedor.
        </li>
      </ul>

      <h2>3. Para que usamos e com qual base legal</h2>
      <ul>
        <li>
          <strong>Prestar o serviço</strong> (contas, ferramentas de estudo, IA, biblioteca): execução de contrato (art. 7º, V).
        </li>
        <li>
          <strong>Segurança, prevenção de fraude e abuso, moderação de conteúdo</strong>: legítimo interesse (art. 7º, IX) e
          cumprimento de obrigação legal (art. 7º, II).
        </li>
        <li>
          <strong>Lembretes por e-mail e comunicações opcionais</strong>: consentimento (art. 7º, I), que você pode revogar nas
          configurações.
        </li>
        <li>
          <strong>Cobrança do plano Pro</strong>: execução de contrato e obrigações fiscais.
        </li>
      </ul>
      <p>Não vendemos dados pessoais e não usamos seus dados para publicidade direcionada.</p>

      <h2>4. Crianças e adolescentes</h2>
      <p>
        O tratamento de dados de crianças e adolescentes é feito no seu melhor interesse (art. 14 da LGPD). Na prática:
      </p>
      <ul>
        <li>
          Abaixo de 12 anos, a conta só é liberada depois do consentimento específico de um dos pais ou responsável legal,
          enviado por e-mail ao responsável.
        </li>
        <li>
          Para menores de 16 anos sem consentimento do responsável, o perfil fica privado, as estatísticas não são públicas e a
          publicação na biblioteca não é permitida.
        </li>
        <li>No ranking aparece apenas o nome de usuário escolhido, nunca o nome real ou o e-mail.</li>
        <li>Não há mensagens privadas entre usuários nem publicidade.</li>
        <li>
          Responsáveis podem pedir acesso, correção ou exclusão dos dados do menor pelo{" "}
          <Link href="/contato?assunto=privacy">formulário de dados pessoais</Link>.
        </li>
      </ul>

      <h2>5. Inteligência artificial</h2>
      <p>
        Para responder perguntas e gerar materiais, o conteúdo necessário (sua pergunta, trechos dos arquivos escolhidos e o
        histórico da conversa) é enviado ao provedor de modelos de linguagem contratado, que atua como operador e processa os
        dados apenas para devolver a resposta. Não usamos seu conteúdo para treinar modelos próprios. Respostas geradas por IA
        podem conter erros.
      </p>

      <h2>6. Compartilhamento e transferência internacional</h2>
      <p>Compartilhamos dados apenas com operadores necessários ao serviço:</p>
      <ul>
        <li>hospedagem da aplicação, banco de dados, autenticação e armazenamento de arquivos;</li>
        <li>provedor de modelos de linguagem (IA);</li>
        <li>provedor de pagamentos, quando você assina o Pro;</li>
        <li>provedor de envio de e-mails transacionais.</li>
      </ul>
      <p>
        Alguns desses operadores podem processar dados fora do Brasil. Nesses casos, a transferência segue o art. 33 da LGPD,
        com cláusulas contratuais e garantias de proteção equivalentes.
      </p>

      <h2>7. O que fica público</h2>
      <p>
        Por padrão, seu perfil é privado. Ficam visíveis para outras pessoas apenas: os materiais que você publicar na
        biblioteca (com seu nome de usuário), as informações de perfil que você escolher tornar públicas e sua posição no
        ranking da liga, se você mantiver essa opção ligada.
      </p>

      <h2>8. Por quanto tempo guardamos</h2>
      <ul>
        <li>Dados da conta e conteúdo: enquanto a conta existir.</li>
        <li>Registros de visualização anônimos: até 90 dias.</li>
        <li>Registros de consumo e de cobrança: pelo prazo exigido pela legislação fiscal e de defesa do consumidor.</li>
        <li>
          Ao excluir a conta, apagamos perfil, arquivos, conversas, materiais e histórico de estudo. Cópias de segurança são
          sobrescritas no ciclo normal de backup do provedor.
        </li>
      </ul>

      <h2>9. Seus direitos</h2>
      <p>
        Você pode confirmar a existência de tratamento, acessar, corrigir, exportar e excluir seus dados, revogar
        consentimentos e pedir informações sobre compartilhamento (art. 18). Na área de configurações há opções para{" "}
        <strong>exportar seus dados</strong> e <strong>excluir sua conta</strong>. Para os demais pedidos, use o{" "}
        <Link href="/contato?assunto=privacy">formulário de dados pessoais</Link>. Você também pode reclamar à Autoridade
        Nacional de Proteção de Dados (ANPD).
      </p>

      <h2>10. Segurança</h2>
      <p>
        Usamos conexão criptografada, controle de acesso por usuário no banco de dados (cada pessoa só acessa os próprios
        registros), armazenamento privado de arquivos com links temporários e registro das ações administrativas.
      </p>

      <h2>11. Cookies</h2>
      <p>
        Usamos apenas cookies necessários para autenticação e funcionamento do site. Não usamos cookies de publicidade nem de
        rastreamento de terceiros.
      </p>

      <h2>12. Alterações</h2>
      <p>
        Mudanças relevantes nesta política serão avisadas no aplicativo antes de entrarem em vigor.
      </p>
    </LegalPage>
  );
}
