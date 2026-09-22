export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--cor-borda)', marginTop: '4rem', padding: '2.5rem 0', color: 'var(--cor-tinta-suave)' }}>
      <div className="container" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <strong style={{ fontFamily: 'var(--fonte-display)', color: 'var(--cor-tinta)' }}>IFConnect</strong>
          <p style={{ maxWidth: 360, fontSize: '0.9rem' }}>
            Portal aberto e comunitário de divulgação científica, educacional e
            cultural: um espaço para estudantes, jovens jornalistas, professores
            e a comunidade publicarem conteúdos e divulgarem projetos.
          </p>
        </div>
        <p className="rotulo-mono">Projeto acadêmico — código aberto</p>
      </div>
    </footer>
  );
}
