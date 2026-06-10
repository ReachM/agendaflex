import type { Metadata } from "next";
import Link from "next/link";
import "../termos/legal.css";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Como a MarcaiFlex coleta, usa e protege seus dados pessoais. Em conformidade com a LGPD.",
  alternates: { canonical: "/privacidade" },
  robots: { index: true, follow: true }
};

export default function PrivacidadePage() {
  return (
    <div className="legal-page">
      <div className="legal-wrap">
        <div className="legal-header">
          <span className="mark">M</span>
          <span className="word">Marcai<strong>Flex</strong></span>
        </div>

        <h1>Política de Privacidade</h1>
        <p className="updated">Última atualização: junho de 2026 · Em conformidade com a LGPD (Lei nº 13.709/2018)</p>

        <section>
          <h2>1. Quem somos</h2>
          <p>A MarcaiFlex é uma plataforma SaaS de gestão de agendamentos para negócios que trabalham com horário marcado — clínicas, consultórios, salões, barbearias, estéticas, SPAs, oficinas, pet shops e demais prestadores de serviço. Neste documento, &quot;nós&quot; refere-se à MarcaiFlex, e &quot;você&quot; ao usuário (empresa) que utiliza nossa plataforma. Os clientes finais dos estabelecimentos são tratados como &quot;titulares de dados&quot;.</p>
        </section>

        <section>
          <h2>2. Dados que coletamos</h2>
          <h3>2.1 Dados da empresa (usuário B2B)</h3>
          <ul>
            <li>Nome, e-mail e telefone do responsável;</li>
            <li>CNPJ e dados do estabelecimento;</li>
            <li>Dados de pagamento (processados pelo Mercado Pago — não armazenamos cartões);</li>
            <li>Logs de acesso e atividade na plataforma.</li>
          </ul>
          <h3>2.2 Dados dos clientes finais (coletados pela empresa usuária)</h3>
          <ul>
            <li>Nome, telefone e e-mail para agendamento;</li>
            <li>Histórico de atendimentos e preferências;</li>
            <li>Consentimento LGPD registrado no momento do agendamento.</li>
          </ul>
        </section>

        <section>
          <h2>3. Como usamos os dados</h2>
          <ul>
            <li>Prestação do serviço de agendamento e gestão;</li>
            <li>Envio de lembretes automáticos via WhatsApp (com consentimento);</li>
            <li>Processamento de pagamentos;</li>
            <li>Suporte técnico e atendimento ao cliente;</li>
            <li>Melhoria contínua da plataforma;</li>
            <li>Cumprimento de obrigações legais.</li>
          </ul>
        </section>

        <section>
          <h2>4. Base legal (LGPD)</h2>
          <ul>
            <li><strong>Execução de contrato:</strong> necessário para prestar o serviço contratado;</li>
            <li><strong>Legítimo interesse:</strong> melhoria do serviço e segurança;</li>
            <li><strong>Consentimento:</strong> envio de comunicações de marketing e lembretes WhatsApp;</li>
            <li><strong>Obrigação legal:</strong> cumprimento de exigências fiscais e regulatórias.</li>
          </ul>
        </section>

        <section>
          <h2>5. Compartilhamento de dados</h2>
          <p>Compartilhamos dados apenas com:</p>
          <ul>
            <li><strong>Mercado Pago:</strong> processamento de pagamentos;</li>
            <li><strong>Evolution API:</strong> envio de mensagens WhatsApp;</li>
            <li><strong>NFE.io:</strong> emissão de notas fiscais (planos Pro e Max);</li>
            <li><strong>Resend:</strong> envio de e-mails transacionais.</li>
          </ul>
          <p>Não vendemos, alugamos ou cedemos dados a terceiros para fins comerciais.</p>
        </section>

        <section>
          <h2>6. Segurança</h2>
          <ul>
            <li>Senhas armazenadas com hash bcrypt (nunca em texto puro);</li>
            <li>Comunicação criptografada via HTTPS/TLS;</li>
            <li>Tokens JWT com expiração automática;</li>
            <li>Isolamento total entre dados de diferentes empresas;</li>
            <li>Logs de auditoria para todas as ações críticas;</li>
            <li>Rate limiting e proteção contra força bruta.</li>
          </ul>
        </section>

        <section>
          <h2>7. Retenção de dados</h2>
          <ul>
            <li>Dados de conta ativa: mantidos enquanto houver assinatura;</li>
            <li>Após cancelamento: dados preservados por 90 dias, depois excluídos;</li>
            <li>Logs de auditoria: 365 dias;</li>
            <li>Dados fiscais: conforme exigência legal (5 anos).</li>
          </ul>
        </section>

        <section>
          <h2>8. Seus direitos (LGPD)</h2>
          <p>Como titular de dados, você tem direito a:</p>
          <ul>
            <li>Confirmar a existência de tratamento dos seus dados;</li>
            <li>Acessar os dados que temos sobre você;</li>
            <li>Corrigir dados incompletos ou desatualizados;</li>
            <li>Solicitar a anonimização ou exclusão de dados;</li>
            <li>Revogar o consentimento a qualquer momento;</li>
            <li>Solicitar a portabilidade dos dados.</li>
          </ul>
          <p>Para exercer seus direitos: <a href="mailto:contato@marcaiflex.com.br">contato@marcaiflex.com.br</a></p>
        </section>

        <section>
          <h2>9. Cookies</h2>
          <p>Utilizamos apenas cookies estritamente necessários para autenticação (sessão segura HttpOnly). Não utilizamos cookies de rastreamento ou publicidade.</p>
        </section>

        <section>
          <h2>10. Contato e DPO</h2>
          <p>Para questões relacionadas à privacidade e proteção de dados:</p>
          <p>E-mail: <a href="mailto:contato@marcaiflex.com.br">contato@marcaiflex.com.br</a></p>
        </section>

        <div className="legal-footer">
          <Link href="/termos">← Termos de Uso</Link>
          <Link href="/">Voltar ao início →</Link>
        </div>
      </div>
    </div>
  );
}
