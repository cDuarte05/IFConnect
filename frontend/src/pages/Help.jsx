import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { FAQ_GRUPOS } from '../content/faq';

function normalizarTexto(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export default function Help() {
  const [busca, setBusca] = useState('');
  const [secoesGuia, setSecoesGuia] = useState([]);
  const [carregandoGuia, setCarregandoGuia] = useState(true);
  const [erroGuia, setErroGuia] = useState(false);

  useEffect(() => {
    document.title = 'Ajuda | IFConnect';
  }, []);

  useEffect(() => {
    let ativo = true;
    setCarregandoGuia(true);
    api
      .get('/ajuda')
      .then(({ data }) => {
        if (!ativo) return;
        setSecoesGuia(Array.isArray(data?.secoes) ? data.secoes : []);
        setErroGuia(false);
      })
      .catch(() => {
        if (!ativo) return;
        setSecoesGuia([]);
        setErroGuia(true);
      })
      .finally(() => {
        if (ativo) setCarregandoGuia(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  const abrirSecaoPorHash = useCallback(() => {
    const hash = window.location.hash.replace(/^#/, '').trim();
    if (!hash) return;

    const alvo = document.getElementById(hash);
    if (!alvo) return;

    if (alvo.tagName.toLowerCase() === 'details') {
      alvo.open = true;
    }

    const reduzMovimento =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    alvo.scrollIntoView({ behavior: reduzMovimento ? 'auto' : 'smooth', block: 'start' });
  }, []);

  // Reaplica a âncora na carga inicial, após o guia carregar e em mudanças de hash
  useEffect(() => {
    if (!carregandoGuia) {
      abrirSecaoPorHash();
    }
  }, [carregandoGuia, abrirSecaoPorHash]);

  useEffect(() => {
    window.addEventListener('hashchange', abrirSecaoPorHash);
    return () => {
      window.removeEventListener('hashchange', abrirSecaoPorHash);
    };
  }, [abrirSecaoPorHash]);

  const termo = useMemo(() => normalizarTexto(busca.trim()), [busca]);

  const secoesGuiaFiltradas = useMemo(() => {
    if (!termo) return secoesGuia;
    return secoesGuia.filter((secao) => {
      const texto = [
        secao.titulo,
        ...(secao.perguntasExemplo || []),
        ...(secao.passos || []),
        ...(secao.observacoes || []),
      ].join(' ');
      return normalizarTexto(texto).includes(termo);
    });
  }, [secoesGuia, termo]);

  const gruposFaqFiltrados = useMemo(() => {
    if (!termo) return FAQ_GRUPOS;
    return FAQ_GRUPOS.map((grupo) => ({
      ...grupo,
      perguntas: grupo.perguntas.filter((item) => {
        const texto = `${grupo.titulo} ${item.pergunta} ${item.resposta}`;
        return normalizarTexto(texto).includes(termo);
      }),
    })).filter((grupo) => grupo.perguntas.length > 0);
  }, [termo]);

  function abrirAssistente() {
    window.dispatchEvent(new CustomEvent('abrir-assistente'));
  }

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem', maxWidth: 860 }}>
      <header style={{ marginBottom: '2rem' }}>
        <p className="rotulo-mono">Documentação e suporte</p>
        <h1>Central de ajuda</h1>
        <p style={{ maxWidth: 640, color: 'var(--cor-tinta-suave)' }}>
          Encontre instruções passo a passo para usar o portal e respostas para as dúvidas mais comuns.
        </p>

        <div style={{ marginTop: '1.25rem', maxWidth: 460 }}>
          <label htmlFor="busca-ajuda" className="rotulo-mono">
            Buscar na ajuda
          </label>
          <input
            id="busca-ajuda"
            type="search"
            placeholder="Ex.: publicar, senha, apoio, editar..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </header>

      <section aria-labelledby="titulo-como-fazer" style={{ marginBottom: '2.5rem' }}>
        <h2 id="titulo-como-fazer">Como fazer</h2>

        {carregandoGuia ? (
          <p className="rotulo-mono">Carregando guia do portal...</p>
        ) : erroGuia ? (
          <p className="cartao ajuda-aviso" role="status">
            O guia passo a passo está temporariamente indisponível. Você ainda pode consultar as perguntas frequentes abaixo.
          </p>
        ) : secoesGuiaFiltradas.length === 0 ? (
          <p style={{ color: 'var(--cor-tinta-suave)' }}>
            Nenhuma seção do guia corresponde à sua busca.
          </p>
        ) : (
          <div className="ajuda-lista">
            {secoesGuiaFiltradas.map((secao) => (
              <details
                key={secao.id}
                id={secao.id}
                className="cartao ajuda-item"
                open={Boolean(termo)}
              >
                <summary className="ajuda-summary">{secao.titulo}</summary>
                <div className="ajuda-conteudo">
                  {secao.passos?.length > 0 && (
                    <>
                      <h3>Passos</h3>
                      <ol className="ajuda-passos">
                        {secao.passos.map((passo, idx) => (
                          <li key={idx}>{passo}</li>
                        ))}
                      </ol>
                    </>
                  )}
                  {secao.observacoes?.length > 0 && (
                    <>
                      <h3>Observações</h3>
                      <ul className="ajuda-observacoes">
                        {secao.observacoes.map((obs, idx) => (
                          <li key={idx}>{obs}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="titulo-faq" style={{ marginBottom: '2.5rem' }}>
        <h2 id="titulo-faq">Perguntas frequentes</h2>

        {gruposFaqFiltrados.length === 0 ? (
          <p style={{ color: 'var(--cor-tinta-suave)' }}>
            Nenhuma pergunta frequente corresponde à sua busca.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {gruposFaqFiltrados.map((grupo) => (
              <div key={grupo.id}>
                <h3 style={{ marginBottom: '0.75rem' }}>{grupo.titulo}</h3>
                <div className="ajuda-lista">
                  {grupo.perguntas.map((item) => (
                    <details
                      key={item.id}
                      id={item.id}
                      className="cartao ajuda-item"
                      open={Boolean(termo)}
                    >
                      <summary className="ajuda-summary">{item.pergunta}</summary>
                      <div className="ajuda-conteudo">
                        <p style={{ margin: 0 }}>{item.resposta}</p>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <aside className="cartao ajuda-rodape-assistente">
        <div>
          <p className="rotulo-mono" style={{ margin: '0 0 0.25rem' }}>
            Ainda com dúvida?
          </p>
          <p style={{ margin: 0, fontWeight: 600 }}>
            Não achou? Pergunte ao assistente
          </p>
        </div>
        <button type="button" className="botao-primario" onClick={abrirAssistente}>
          Abrir assistente
        </button>
      </aside>
    </div>
  );
}
