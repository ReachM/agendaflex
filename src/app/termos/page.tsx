import type { Metadata } from "next";
import Link from "next/link";
import "./legal.css";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Termos e condições de uso da plataforma MarcaiFlex para gestão de agendamentos.",
  alternates: { canonical: "/termos" },
  robots: { index: true, follow: true }
};

export default function TermosPage() {
  return (
    <div className="legal-page">
      <div className="legal-wrap">
        <div className="legal-header">
          <span className="mark">M</span>
          <span className="word">Marcai<strong>Flex</strong></span>
        </div>

        <h1>Termos de Uso</h1>
        <p className="updated">Última atualização: junho de 2026</p>

        <section>
          <h2>1. Aceitação dos Termos</h2>
          <p>Ao criar uma conta e utilizar a plataforma MarcaiFlex, você concorda integralmente com estes Termos de Uso. Caso não concorde com qualquer disposição, não utilize o serviço.</p>
        </section>

        <section>
          <h2>2. Descrição do Serviço</h2>
          <p>A MarcaiFlex é uma plataforma SaaS de gestão de agendamentos voltada para salões de beleza, barbearias, clínicas e estabelecimentos similares. Os serviços incluem agenda online, link público de agendamento, gestão de clientes, controle financeiro e bot de WhatsApp.</p>
        </section>

        <section>
          <h2>3. Cadastro e Conta</h2>
          <p>Para utilizar a MarcaiFlex, é necessário criar uma conta com informações verdadeiras e completas. Você é responsável por manter a confidencialidade de suas credenciais de acesso e por todas as atividades realizadas em sua conta.</p>
          <p>É proibido criar contas com informações falsas, ceder ou transferir sua conta a terceiros sem autorização prévia.</p>
        </section>

        <section>
          <h2>4. Planos e Pagamentos</h2>
          <p>A MarcaiFlex oferece planos pagos com diferentes funcionalidades:</p>
          <ul>
            <li><strong>Starter (R$ 49/mês):</strong> Funcionalidades operacionais básicas.</li>
            <li><strong>Pro (R$ 99/mês):</strong> Inclui módulo financeiro, relatórios e notas fiscais.</li>
            <li><strong>Max (R$ 179/mês):</strong> Inclui Bot WhatsApp com lembretes automáticos.</li>
          </ul>
          <p>O período de teste gratuito é de 14 dias, sem necessidade de cartão de crédito. Após o período de teste, o acesso será limitado até a contratação de um plano.</p>
          <p>Os pagamentos são processados via Mercado Pago. Em caso de inadimplência, o acesso poderá ser suspenso após notificação.</p>
        </section>

        <section>
          <h2>5. Uso Aceitável</h2>
          <p>É expressamente proibido:</p>
          <ul>
            <li>Usar a plataforma para atividades ilegais ou fraudulentas;</li>
            <li>Tentar acessar dados de outras empresas cadastradas;</li>
            <li>Realizar engenharia reversa ou copiar o código da plataforma;</li>
            <li>Sobrecarregar os servidores com requisições automatizadas excessivas;</li>
            <li>Enviar mensagens de spam ou conteúdo inadequado via Bot WhatsApp.</li>
          </ul>
        </section>

        <section>
          <h2>6. Dados e Privacidade</h2>
          <p>O tratamento de dados pessoais é regido pela nossa <Link href="/privacidade">Política de Privacidade</Link>, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).</p>
          <p>Os dados dos clientes cadastrados na plataforma pertencem exclusivamente à empresa que os cadastrou. A MarcaiFlex não compartilha, vende ou cede esses dados a terceiros.</p>
        </section>

        <section>
          <h2>7. Disponibilidade do Serviço</h2>
          <p>A MarcaiFlex empenha-se em manter disponibilidade de 99,5% ao mês. Manutenções programadas serão comunicadas com antecedência mínima de 24 horas. Não nos responsabilizamos por indisponibilidades causadas por fatores externos (internet, energia, etc.).</p>
        </section>

        <section>
          <h2>8. Cancelamento</h2>
          <p>Você pode cancelar sua assinatura a qualquer momento através do painel de Configurações. O acesso permanece ativo até o fim do período já pago. Não há reembolso proporcional por cancelamentos antecipados.</p>
          <p>Em caso de violação destes termos, a MarcaiFlex reserva-se o direito de cancelar a conta imediatamente, sem aviso prévio.</p>
        </section>

        <section>
          <h2>9. Limitação de Responsabilidade</h2>
          <p>A MarcaiFlex não se responsabiliza por perdas de receita, dados ou oportunidades decorrentes do uso ou impossibilidade de uso da plataforma. Nossa responsabilidade total está limitada ao valor pago nos últimos 3 meses.</p>
        </section>

        <section>
          <h2>10. Alterações nos Termos</h2>
          <p>Podemos atualizar estes termos periodicamente. Alterações significativas serão comunicadas por e-mail com antecedência mínima de 15 dias. O uso continuado da plataforma após as alterações implica na aceitação dos novos termos.</p>
        </section>

        <section>
          <h2>11. Foro e Legislação</h2>
          <p>Estes termos são regidos pela legislação brasileira. Fica eleito o foro da comarca de São Paulo/SP para dirimir eventuais conflitos.</p>
        </section>

        <section>
          <h2>12. Contato</h2>
          <p>Dúvidas sobre estes termos: <a href="mailto:contato@marcaiflex.com.br">contato@marcaiflex.com.br</a></p>
        </section>

        <div className="legal-footer">
          <Link href="/">← Voltar para o início</Link>
          <Link href="/privacidade">Política de Privacidade →</Link>
        </div>
      </div>
    </div>
  );
}
