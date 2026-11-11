import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

const BOAS_VINDAS = {
  papel: 'assistente',
  texto: 'Olá! Posso ajudar a encontrar publicações e projetos ou explicar como publicar no IFConnect.',
  fontes: [],
};

export default function AssistenteIA() {
  const [habilitado, setHabilitado] = useState(null);
  const [aberto, setAberto] = useState(false);
  const [pergunta, setPergunta] = useState('');
  const [mensagens, setMensagens] = useState([BOAS_VINDAS]);
  const [enviando, setEnviando] = useState(false);

  const fimRef = useRef(null);
  const inputRef = useRef(null);
  const botaoToggleRef = useRef(null);
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

  // Move foco para o campo ao abrir o painel
  useEffect(() => {
    if (aberto) {
      inputRef.current?.focus();
    }
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

  async function enviar(e) {
    e.preventDefault();
    const texto = pergunta.trim();
    if (texto.length < 2 || enviando) return;

    const idAtual = ++reqIdRef.current;
    setMensagens((m) => [...m, { papel: 'usuario', texto, fontes: [] }]);
    setPergunta('');
    setEnviando(true);

    try {
      const { data } = await api.post('/agente/consulta', { pergunta: texto });
      if (idAtual !== reqIdRef.current) return;
      setMensagens((m) => [
        ...m,
        { papel: 'assistente', texto: data.resposta, fontes: data.fontes || [] },
      ]);
    } catch (err) {
      if (idAtual !== reqIdRef.current) return;
      const msg =
        err.response?.data?.mensagem || 'Não foi possível consultar o assistente agora.';
      setMensagens((m) => [...m, { papel: 'assistente', texto: msg, fontes: [] }]);
    } finally {
      if (idAtual === reqIdRef.current) {
        setEnviando(false);
      }
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape' && aberto) {
      e.stopPropagation();
      setAberto(false);
      requestAnimationFrame(() => botaoToggleRef.current?.focus());
    }
  }

  // Aceita apenas URLs internas iniciadas por "/" (e nunca "//" externo)
  const destino = (f) => {
    if (typeof f.url === 'string' && f.url.startsWith('/') && !f.url.startsWith('//')) {
      return f.url;
    }
    return f.tipo === 'projeto' ? `/vitrine/${f.id}` : `/publicacoes/${f.id}`;
  };

  return (
    <div
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        right: '1rem',
        bottom: '1rem',
        zIndex: 20,
        width: aberto ? 'min(340px, calc(100vw - 2rem))' : 'auto',
        maxWidth: 'calc(100vw - 2rem)',
      }}
    >
      {aberto && (
        <section
          className="cartao"
          aria-label="Assistente do IFConnect"
          style={{
            width: '100%',
            marginBottom: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <header style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--cor-borda)' }}>
            <strong style={{ fontFamily: 'var(--fonte-display)' }}>Assistente IFConnect</strong>
          </header>
          <div
            role="log"
            aria-live="polite"
            style={{ padding: '0.75rem 1rem', maxHeight: 320, overflowY: 'auto' }}
          >
            {mensagens.map((m, i) => (
              <div
                key={i}
                style={{
                  marginBottom: '0.75rem',
                  textAlign: m.papel === 'usuario' ? 'right' : 'left',
                }}
              >
                <span className="rotulo-mono">{m.papel === 'usuario' ? 'Você' : 'Assistente'}</span>
                <p style={{ margin: '0.2rem 0', whiteSpace: 'pre-wrap' }}>{m.texto}</p>
                {m.fontes.length > 0 && (
                  <ul
                    style={{
                      margin: '0.3rem 0 0',
                      paddingLeft: '1.1rem',
                      textAlign: 'left',
                      fontSize: '0.9rem',
                    }}
                  >
                    {m.fontes.map((f, idx) => (
                      <li key={`${f.tipo}-${f.id}-${idx}`}>
                        <Link to={destino(f)} onClick={() => setAberto(false)}>
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
              </div>
            ))}
            {enviando && (
              <p className="rotulo-mono" role="status">
                Pensando...
              </p>
            )}
            <div ref={fimRef} />
          </div>
          <form
            onSubmit={enviar}
            style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--cor-borda)' }}
          >
            <label htmlFor="perguntaAssistente" className="rotulo-mono" style={{ marginTop: 0 }}>
              Sua pergunta
            </label>
            <input
              ref={inputRef}
              id="perguntaAssistente"
              maxLength={500}
              placeholder="Ex.: Há projetos de robótica?"
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
            />
            <button
              type="submit"
              className="botao-primario"
              style={{ marginTop: '0.5rem' }}
              disabled={enviando || pergunta.trim().length < 2}
            >
              Enviar
            </button>
          </form>
        </section>
      )}
      <div style={{ textAlign: 'right' }}>
        <button
          ref={botaoToggleRef}
          className="botao-primario"
          onClick={() => setAberto((a) => !a)}
          aria-expanded={aberto}
          aria-label={aberto ? 'Fechar assistente' : 'Abrir assistente'}
        >
          {aberto ? 'Fechar' : 'Assistente'}
        </button>
      </div>
    </div>
  );
}
