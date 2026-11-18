import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, matchPath } from 'react-router-dom';
import api from '../api/client';

const BOAS_VINDAS = {
  papel: 'assistente',
  texto: 'Olá! Posso ajudar a encontrar publicações e projetos ou explicar como publicar no IFConnect.',
  fontes: [],
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function detectarPagina(pathname) {
  if (matchPath({ path: '/publicacoes/:id/editar', end: true }, pathname)) {
    return null;
  }
  const matchPub = matchPath({ path: '/publicacoes/:id', end: true }, pathname);
  if (matchPub?.params?.id) {
    return { tipo: 'publicacao', id: matchPub.params.id };
  }

  const matchVitrine = matchPath({ path: '/vitrine/:id', end: true }, pathname);
  if (matchVitrine?.params?.id && UUID_REGEX.test(matchVitrine.params.id)) {
    return { tipo: 'projeto', id: matchVitrine.params.id };
  }

  return null;
}

export default function AssistenteIA() {
  const [habilitado, setHabilitado] = useState(null);
  const [aberto, setAberto] = useState(false);
  const [pergunta, setPergunta] = useState('');
  const [mensagens, setMensagens] = useState([BOAS_VINDAS]);
  const [enviando, setEnviando] = useState(false);
  const [textoProgresso, setTextoProgresso] = useState('Pensando...');

  const location = useLocation();
  const pagina = useMemo(() => detectarPagina(location.pathname), [location.pathname]);

  const atalhos = useMemo(() => {
    const lista = [];
    if (pagina) {
      if (pagina.tipo === 'publicacao') {
        lista.push('Resumir esta publicação');
      } else if (pagina.tipo === 'projeto') {
        lista.push('Resumir este projeto');
      }
      lista.push('Explicar de forma simples');
    }
    lista.push('Como publicar uma notícia?');
    lista.push('Como cadastrar um projeto?');
    lista.push('Como apoiar um projeto?');
    return lista;
  }, [pagina]);

  const painelRef = useRef(null);
  const botaoToggleRef = useRef(null);
  const inputRef = useRef(null);
  const fimRef = useRef(null);
  const reqIdRef = useRef(0);

  // Verifica status do assistente uma única vez ao montar
  useEffect(() => {
    let ativo = true;
    api
      .get('/agente/status')
      .then(({ data }) => {
        if (ativo) setHabilitado(data?.habilitado === true);
      })
      .catch(() => {
        if (ativo) setHabilitado(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  // Move o foco para o campo de texto ao abrir o painel
  useEffect(() => {
    if (aberto) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [aberto]);

  // Listener para fechar o painel ao clicar fora ou pressionar a tecla Escape
  useEffect(() => {
    if (!aberto) return;

    function handleClickFora(event) {
      if (
        painelRef.current?.contains(event.target) ||
        botaoToggleRef.current?.contains(event.target)
      ) {
        return;
      }
      setAberto(false);
    }

    function handleKeyDownGlobal(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setAberto(false);
        requestAnimationFrame(() => {
          botaoToggleRef.current?.focus();
        });
      }
    }

    document.addEventListener('mousedown', handleClickFora);
    document.addEventListener('touchstart', handleClickFora);
    document.addEventListener('keydown', handleKeyDownGlobal);

    return () => {
      document.removeEventListener('mousedown', handleClickFora);
      document.removeEventListener('touchstart', handleClickFora);
      document.removeEventListener('keydown', handleKeyDownGlobal);
    };
  }, [aberto]);

  // Rola o histórico respeitando prefers-reduced-motion
  useEffect(() => {
    if (!aberto) return;
    const reduzMovimento =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    fimRef.current?.scrollIntoView({ behavior: reduzMovimento ? 'auto' : 'smooth' });
  }, [mensagens, aberto]);

  if (habilitado !== true) {
    return null;
  }

  function fecharPainel() {
    setAberto(false);
    requestAnimationFrame(() => {
      botaoToggleRef.current?.focus();
    });
  }

  async function enviarTexto(textoAEnviar) {
    const texto = (textoAEnviar || '').trim();
    if (texto.length < 2 || enviando) return;

    const idAtual = ++reqIdRef.current;
    setMensagens((m) => [...m, { papel: 'usuario', texto, fontes: [] }]);
    setPergunta('');
    setEnviando(true);
    setTextoProgresso('Pensando...');

    const timerProgresso = setTimeout(() => {
      setTextoProgresso('Ainda procurando... o servidor pode estar acordando.');
    }, 8000);

    try {
      const payload = pagina ? { pergunta: texto, pagina } : { pergunta: texto };
      const { data } = await api.post('/agente/consulta', payload, { timeout: 30000 });
      if (idAtual !== reqIdRef.current) return;
      setMensagens((m) => [
        ...m,
        { papel: 'assistente', texto: data.resposta, fontes: data.fontes || [] },
      ]);
    } catch (err) {
      if (idAtual !== reqIdRef.current) return;
      const isTimeout =
        err.code === 'ECONNABORTED' ||
        err.message?.toLowerCase().includes('timeout') ||
        err.response?.status === 408 ||
        err.response?.status === 504;

      if (isTimeout) {
        setMensagens((m) => [
          ...m,
          {
            papel: 'assistente',
            texto: 'A resposta demorou muito para chegar. O servidor pode estar inicializando.',
            fontes: [],
            podeTentarNovamente: true,
            perguntaParaReenviar: texto,
          },
        ]);
      } else {
        const msg =
          err.response?.data?.mensagem || 'Não foi possível consultar o assistente agora.';
        setMensagens((m) => [...m, { papel: 'assistente', texto: msg, fontes: [] }]);
      }
    } finally {
      clearTimeout(timerProgresso);
      if (idAtual === reqIdRef.current) {
        setEnviando(false);
        setTextoProgresso('Pensando...');
      }
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    enviarTexto(pergunta);
  }

  // Aceita apenas URLs internas iniciadas por "/" (e nunca "//" externo)
  const destino = (f) => {
    if (typeof f.url === 'string' && f.url.startsWith('/') && !f.url.startsWith('//')) {
      return f.url;
    }
    return f.tipo === 'projeto' ? `/vitrine/${f.id}` : `/publicacoes/${f.id}`;
  };

  const podeEnviar = !enviando && pergunta.trim().length >= 2;

  return (
    <div className="assistente-widget-container">
      {aberto && (
        <section
          ref={painelRef}
          id="assistente-painel"
          className="assistente-painel"
          role="dialog"
          aria-label="Assistente IFConnect"
          aria-modal="false"
        >
          <header className="assistente-cabecalho">
            <h2 className="assistente-titulo">Assistente IFConnect</h2>
            <button
              type="button"
              className="assistente-botao-fechar"
              onClick={fecharPainel}
              aria-label="Fechar assistente IFConnect"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </header>

          <div className="assistente-mensagens" role="log" aria-live="polite">
            {mensagens.map((m, i) => (
              <div
                key={i}
                className={`assistente-bolha-grupo ${m.papel === 'usuario' ? 'usuario' : 'assistente'}`}
              >
                <span className="assistente-bolha-remetente">
                  {m.papel === 'usuario' ? 'Você' : 'Assistente'}
                </span>
                <div
                  className={`assistente-bolha ${m.papel === 'usuario' ? 'usuario' : 'assistente'}`}
                >
                  <p>{m.texto}</p>
                  {m.fontes && m.fontes.length > 0 && (
                    <ul className="assistente-fontes">
                      {m.fontes.map((f, idx) => (
                        <li key={`${f.tipo}-${f.id}-${idx}`}>
                          <Link to={destino(f)} onClick={fecharPainel}>
                            [{f.ref ?? idx + 1}] {f.titulo}
                          </Link>
                          <span className="rotulo-mono">
                            {' '}
                            · {f.tipo === 'projeto' ? 'projeto' : 'publicação'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {m.podeTentarNovamente && (
                    <button
                      type="button"
                      className="assistente-botao-tentar-novamente"
                      onClick={() => enviarTexto(m.perguntaParaReenviar)}
                      disabled={enviando}
                    >
                      Tentar novamente
                    </button>
                  )}
                </div>
              </div>
            ))}
            {enviando && (
              <div className="assistente-digitando" role="status">
                <span className="ponto-pulsante" aria-hidden="true" />
                <span>{textoProgresso}</span>
              </div>
            )}
            <div ref={fimRef} />
          </div>

          <div
            className="assistente-chips-container"
            role="toolbar"
            aria-label="Sugestões de perguntas rápidas"
          >
            {atalhos.map((chipTexto) => (
              <button
                key={chipTexto}
                type="button"
                className="assistente-chip"
                onClick={() => enviarTexto(chipTexto)}
                disabled={enviando}
              >
                {chipTexto}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="assistente-form">
            <input
              ref={inputRef}
              id="perguntaAssistente"
              className="assistente-input"
              aria-label="Sua pergunta para o assistente"
              maxLength={500}
              placeholder="Pergunte sobre publicações e projetos..."
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              disabled={enviando}
            />
            <button
              type="submit"
              className="assistente-botao-enviar"
              disabled={!podeEnviar}
              aria-label={enviando ? 'Enviando pergunta...' : 'Enviar pergunta'}
            >
              {enviando ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="assistente-spinner"
                  aria-hidden="true"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" />
                </svg>
              )}
            </button>
          </form>

          <div className="assistente-rodape-info">
            {pagina && (
              <p className="assistente-dica-pagina">
                Posso ler a publicação/projeto aberto.
              </p>
            )}
            <p className="assistente-aviso-privacidade">
              Não envie dados pessoais.
            </p>
          </div>
        </section>
      )}

      <button
        ref={botaoToggleRef}
        type="button"
        className="assistente-botao-toggle"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-controls="assistente-painel"
        aria-label={aberto ? 'Fechar assistente IFConnect' : 'Abrir assistente IFConnect'}
      >
        {aberto ? (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>
    </div>
  );
}
