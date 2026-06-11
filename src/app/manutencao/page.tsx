export const metadata = {
  title: "Em manutenção · MarcaiFlex"
};

export default function ManutencaoPage() {
  return (
    <div className="error-page">
      <div className="error-page__wrap">
        <div className="error-page__logo">
          <div className="error-page__mark">MF</div>
          <span>
            Marcai<strong>Flex</strong>
          </span>
        </div>
        <div style={{ fontSize: 64 }}>🔧</div>
        <h1 className="error-page__title">Em manutenção</h1>
        <p className="error-page__desc">
          Estamos realizando melhorias no sistema.
          <br />
          Voltamos em breve. Obrigado pela paciência!
        </p>
        <p className="error-page__help">
          Dúvidas? <a href="mailto:contato@marcaiflex.com.br">contato@marcaiflex.com.br</a>
        </p>
      </div>
    </div>
  );
}
