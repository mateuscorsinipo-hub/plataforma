import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/site/legal-page";
import { publicEnv } from "@/lib/env/public";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "Regras de uso do Grifo: conta, conteúdo, comunidade, inteligência artificial e planos.",
};

export default function TermsPage() {
  const { company } = publicEnv;
  return (
    <LegalPage title="Termos de uso" updatedAt="27 de outubro de 2026">
      <p>
        Estes termos regulam o uso do Grifo, oferecido por {company.name ?? "[Razão social]"} (
        {company.document ?? "CNPJ [a definir]"}). Ao criar uma conta, você concorda com eles e com a{" "}
        <Link href="/privacidade">Política de privacidade</Link>.
      </p>

      <h2>1. Conta</h2>
      <ul>
        <li>O Grifo é destinado a estudantes a partir de 12 anos. Abaixo dessa idade, a conta depende de autorização de um responsável.</li>
        <li>Menores de 18 anos devem usar a plataforma com conhecimento de seus pais ou responsáveis.</li>
        <li>Você é responsável pelas informações da conta e por manter sua senha em segredo.</li>
        <li>Uma pessoa, uma conta. Contas automatizadas ou criadas para burlar limites podem ser suspensas.</li>
      </ul>

      <h2>2. Uso permitido</h2>
      <p>Não é permitido:</p>
      <ul>
        <li>publicar conteúdo de terceiros sem autorização, incluindo provas, apostilas e livros protegidos por direitos autorais;</li>
        <li>publicar conteúdo ofensivo, discriminatório, sexual, violento, enganoso ou com dados pessoais de outras pessoas;</li>
        <li>usar a plataforma para fraudar avaliações oficiais ou exames em andamento;</li>
        <li>tentar acessar dados de outros usuários, contornar limites ou sobrecarregar o serviço.</li>
      </ul>

      <h2>3. Seu conteúdo</h2>
      <p>
        O que você envia continua sendo seu. Arquivos e materiais privados são usados apenas para prestar o serviço a você. Ao
        publicar um material na biblioteca, você declara que ele é seu ou que tem autorização para compartilhá-lo e nos concede
        licença gratuita, não exclusiva e revogável (ao despublicar ou excluir) para hospedá-lo e exibi-lo na plataforma.
      </p>

      <h2>4. Moderação e denúncias</h2>
      <p>
        Materiais publicados passam pelas regras de moderação e podem ser removidos quando violarem estes termos. Qualquer pessoa
        pode denunciar um material. Detentores de direitos autorais podem pedir a remoção pelo{" "}
        <Link href="/contato?assunto=copyright">formulário de direitos autorais</Link>, informando o material e a obra
        protegida. Contas com violações repetidas podem ser suspensas.
      </p>

      <h2>5. Inteligência artificial</h2>
      <p>
        Respostas do tutor, materiais gerados e correções automáticas são produzidos por modelos de linguagem e podem conter
        erros, omissões ou imprecisões. Use-os como apoio ao estudo, confira informações importantes e não os trate como
        avaliação oficial. Os recursos de IA têm limites de uso definidos no seu plano.
      </p>

      <h2>6. Planos e pagamentos</h2>
      <ul>
        <li>O plano gratuito não exige cartão de crédito.</li>
        <li>
          O plano Pro é cobrado de forma recorrente pelo provedor de pagamentos. Você pode cancelar a qualquer momento; o acesso
          continua até o fim do período já pago.
        </li>
        <li>
          Na primeira contratação, você pode desistir em até 7 dias e receber o valor integral de volta (art. 49 do Código de
          Defesa do Consumidor).
        </li>
        <li>Mudanças de preço serão avisadas com antecedência e valem a partir do ciclo seguinte.</li>
      </ul>

      <h2>7. Disponibilidade</h2>
      <p>
        Trabalhamos para manter o serviço disponível, mas podem ocorrer interrupções para manutenção ou por falhas de
        terceiros. Recursos que dependem de serviços externos (IA, e-mail, pagamentos) podem ficar indisponíveis
        temporariamente.
      </p>

      <h2>8. Encerramento</h2>
      <p>
        Você pode excluir sua conta a qualquer momento nas configurações. Podemos suspender contas que violem estes termos,
        com aviso e indicação do motivo, salvo quando a lei ou a segurança de outros usuários exigir ação imediata.
      </p>

      <h2>9. Lei aplicável</h2>
      <p>
        Estes termos seguem as leis brasileiras. Fica eleito o foro do domicílio do consumidor para resolver eventuais
        conflitos.
      </p>
    </LegalPage>
  );
}
