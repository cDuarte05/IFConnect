import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PROJETO } from '../config/projeto';

export default function About() {
  useEffect(() => {
    document.title = 'Sobre | IFConnect';
  }, []);

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem', maxWidth: 860 }}>
      <header style={{ marginBottom: '2rem' }}>
        <p className="rotulo-mono">Projeto acadêmico · {PROJETO.ANO}</p>
        <h1>Sobre o {PROJETO.NOME}</h1>
        <p style={{ maxWidth: 660, color: 'var(--cor-tinta-suave)' }}>
          Conheça o propósito, o funcionamento e a equipe por trás do portal.
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <section className="cartao" style={{ padding: '1.5rem' }} aria-labelledby="sobre-proposito">
          <h2 id="sobre-proposito">Propósito e público</h2>
          <p>
            O {PROJETO.NOME} é um portal aberto de divulgação científica, educacional, cultural e
            comunitária, acompanhado de uma vitrine para projetos que buscam apoio.
          </p>
          <p style={{ marginBottom: 0 }}>
            Ele foi pensado para aproximar estudantes, jovens jornalistas, professores e a
            comunidade, oferecendo um espaço gratuito para ler, escrever e acompanhar iniciativas
            sem paywall.
          </p>
        </section>

        <section className="cartao" style={{ padding: '1.5rem' }} aria-labelledby="sobre-conteudo">
          <h2 id="sobre-conteudo">O que você encontra aqui</h2>
          <ul style={{ paddingLeft: '1.25rem', margin: '0.5rem 0 0', display: 'grid', gap: '0.6rem' }}>
            <li>
              <Link to="/">Publicações</Link>: notícias escolares e globais, artigos científicos,
              textos e poemas organizados por categoria e tema.
            </li>
            <li>
              <Link to="/vitrine">Vitrine científica</Link>: espaço dedicado a projetos e campanhas
              que buscam apoio e divulgação na comunidade.
            </li>
            <li>
              <Link to="/ajuda">Central de ajuda</Link> e Assistente de IA: orientações passo a
              passo sobre o uso do portal e apoio na busca por conteúdos públicos.
            </li>
          </ul>
        </section>

        <section className="cartao" style={{ padding: '1.5rem' }} aria-labelledby="sobre-fluxo">
          <h2 id="sobre-fluxo">Como o conteúdo chega ao ar</h2>
          <p style={{ marginBottom: 0 }}>
            Após o envio de uma publicação ou projeto por uma pessoa cadastrada, o material passa
            pela análise de professores moderadores antes de ficar visível para o público geral.
            O autor pode acompanhar o andamento do envio diretamente no seu Perfil.
          </p>
        </section>

        <section className="cartao" style={{ padding: '1.5rem' }} aria-labelledby="sobre-tecnologia">
          <h2 id="sobre-tecnologia">Tecnologia</h2>
          <p>
            A interface do portal é construída com React no frontend, enquanto o servidor utiliza
            Node.js com Express e banco de dados PostgreSQL em produção (com SQLite no
            desenvolvimento local).
          </p>
          <p style={{ marginBottom: 0 }}>
            O assistente de IA combina busca por palavras-chave e busca por significado (embeddings)
            junto a um modelo de linguagem, consultando exclusivamente conteúdos já públicos do
            portal.
          </p>
        </section>

        <section className="cartao" style={{ padding: '1.5rem' }} aria-labelledby="sobre-equipe">
          <h2 id="sobre-equipe">Contexto acadêmico e equipe</h2>
          <dl className="sobre-lista-dados">
            <div>
              <dt className="rotulo-mono">Instituição</dt>
              <dd>{PROJETO.INSTITUICAO}</dd>
            </div>
            <div>
              <dt className="rotulo-mono">Curso</dt>
              <dd>{PROJETO.CURSO}</dd>
            </div>
            <div>
              <dt className="rotulo-mono">Disciplina</dt>
              <dd>{PROJETO.DISCIPLINA}</dd>
            </div>
            <div>
              <dt className="rotulo-mono">Professor orientador</dt>
              <dd>{PROJETO.PROFESSOR}</dd>
            </div>
            <div>
              <dt className="rotulo-mono">Equipe</dt>
              <dd>{PROJETO.EQUIPE.join(', ')}</dd>
            </div>
          </dl>
        </section>

        <section className="cartao" style={{ padding: '1.5rem' }} aria-labelledby="sobre-codigo">
          <h2 id="sobre-codigo">Código aberto e demonstração</h2>
          <p>
            O {PROJETO.NOME} é desenvolvido como um projeto acadêmico de código aberto.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {PROJETO.DEMO_URL && (
              <a
                href={PROJETO.DEMO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="botao botao-primario"
              >
                Ver o site no ar
              </a>
            )}
            {PROJETO.REPO_URL && (
              <a
                href={PROJETO.REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="botao botao-secundario"
              >
                Repositório do projeto
              </a>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
