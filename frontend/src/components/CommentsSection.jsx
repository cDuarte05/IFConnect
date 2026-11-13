import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

function formatarHoraData(dataIso) {
  try {
    const data = new Date(dataIso);
    const agora = new Date();
    const ehHoje =
      data.getDate() === agora.getDate() &&
      data.getMonth() === agora.getMonth() &&
      data.getFullYear() === agora.getFullYear();

    const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (ehHoje) {
      return `hoje às ${hora}`;
    }

    return `${data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${hora}`;
  } catch {
    return '';
  }
}

export default function CommentsSection({ tipo, itemId, autorPostId }) {
  const { usuario } = useAuth();
  const [comentarios, setComentarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [novoComentario, setNovoComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [statusSse, setStatusSse] = useState('conectando'); // 'conectado' | 'conectando' | 'desconectado'
  const [temNovoNaoVisto, setTemNovoNaoVisto] = useState(false);

  // Estado para edição
  const [comentarioEmEdicao, setComentarioEmEdicao] = useState(null);
  const [textoEdicao, setTextoEdicao] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [excluindoId, setExcluindoId] = useState(null);

  // Referências para o scroll do chat
  const feedRef = useRef(null);
  const fimChatRef = useRef(null);

  // Força re-render a cada 30 segundos para atualizar tempo limite de 15 minutos
  const [, setTick] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const endpointBase = tipo === 'artigo' ? `/artigos/${itemId}/comentarios` : `/campanhas/${itemId}/comentarios`;
  const streamUrl = `/api${endpointBase}/stream`;

  // Função para checar se o scroll está próximo do fundo
  function estaNoFundo() {
    if (!feedRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
    return scrollHeight - scrollTop - clientHeight < 120;
  }

  function rolarParaFundo(suave = true) {
    if (fimChatRef.current) {
      fimChatRef.current.scrollIntoView({ behavior: suave ? 'smooth' : 'auto' });
      setTemNovoNaoVisto(false);
    }
  }

  // 1. Carregamento inicial via REST
  useEffect(() => {
    if (!itemId) return;

    let montado = true;
    setCarregando(true);
    api
      .get(endpointBase)
      .then((res) => {
        if (montado) {
          setComentarios(res.data);
          setCarregando(false);
          // Rola para a mensagem mais recente após renderizar
          setTimeout(() => rolarParaFundo(false), 80);
        }
      })
      .catch(() => {
        if (montado) {
          setErro('Não foi possível carregar os comentários.');
          setCarregando(false);
        }
      });

    return () => {
      montado = false;
    };
  }, [itemId, tipo]);

  // 2. Conexão em tempo real via Server-Sent Events (SSE)
  useEffect(() => {
    if (!itemId) return;

    setStatusSse('conectando');
    const eventSource = new EventSource(streamUrl);

    eventSource.addEventListener('conectado', () => {
      setStatusSse('conectado');
    });

    // Novo comentário recebido de qualquer usuário
    eventSource.addEventListener('novo_comentario', (event) => {
      try {
        const novo = JSON.parse(event.data);
        const estavamosNoFundo = estaNoFundo();

        setComentarios((atuais) => {
          // Evita duplicatas caso a própria requisição POST já tenha retornado
          if (atuais.some((c) => c.id === novo.id)) {
            return atuais;
          }
          return [...atuais, novo];
        });

        // Se o usuário estava próximo ao final ou é o próprio autor, rola para baixo
        if (estavamosNoFundo || (usuario && usuario.id === novo.autorId)) {
          setTimeout(() => rolarParaFundo(true), 60);
        } else {
          setTemNovoNaoVisto(true);
        }
      } catch (err) {
        console.error('Erro ao processar novo comentário:', err);
      }
    });

    // Comentário editado em tempo real
    eventSource.addEventListener('comentario_editado', (event) => {
      try {
        const editado = JSON.parse(event.data);
        setComentarios((atuais) =>
          atuais.map((c) => (c.id === editado.id ? editado : c))
        );
      } catch (err) {
        console.error('Erro ao processar edição:', err);
      }
    });

    // Comentário excluído em tempo real
    eventSource.addEventListener('comentario_excluido', (event) => {
      try {
        const { id } = JSON.parse(event.data);
        setComentarios((atuais) => atuais.filter((c) => c.id !== id));
      } catch (err) {
        console.error('Erro ao processar exclusão:', err);
      }
    });

    eventSource.onerror = () => {
      setStatusSse('desconectado');
      // O navegador tentará reconectar automaticamente por padrão
    };

    return () => {
      eventSource.close();
    };
  }, [itemId, tipo, usuario]);

  function minutosRestantesEdicao(createdAt) {
    const criado = new Date(createdAt).getTime();
    const limite = criado + 15 * 60 * 1000;
    const msRestantes = limite - Date.now();
    if (msRestantes <= 0) return 0;
    return Math.ceil(msRestantes / (1000 * 60));
  }

  function podeEditar(comentario) {
    if (!usuario || usuario.id !== comentario.autorId) return false;
    return minutosRestantesEdicao(comentario.createdAt) > 0;
  }

  function podeExcluir(comentario) {
    if (!usuario) return false;
    const ehAutorComentario = usuario.id === comentario.autorId;
    const ehAutorPost = usuario.id === autorPostId;
    const ehModerador = usuario.tipo === 'professor_moderador';
    return ehAutorComentario || ehAutorPost || ehModerador;
  }

  async function enviarComentario(e) {
    if (e) e.preventDefault();
    if (!novoComentario.trim() || enviando) return;

    setEnviando(true);
    setErro('');
    const textoParaEnviar = novoComentario.trim();
    setNovoComentario('');

    try {
      const res = await api.post(endpointBase, { conteudo: textoParaEnviar });
      // Adiciona otimisticamente caso o SSE ainda não tenha disparado
      setComentarios((atuais) => {
        if (atuais.some((c) => c.id === res.data.id)) return atuais;
        return [...atuais, res.data];
      });
      setTimeout(() => rolarParaFundo(true), 50);
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Erro ao publicar comentário.');
      setNovoComentario(textoParaEnviar); // Restaura texto se falhar
    } finally {
      setEnviando(false);
    }
  }

  function handleKeyDown(e) {
    // Envia com Enter (sem shift) estilo mensageiro
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarComentario();
    }
  }

  function iniciarEdicao(comentario) {
    const mins = minutosRestantesEdicao(comentario.createdAt);
    if (mins <= 0) {
      alert('O prazo de 15 minutos para edição deste comentário expirou.');
      return;
    }
    setComentarioEmEdicao(comentario.id);
    setTextoEdicao(comentario.conteudo);
    setErro('');
  }

  function cancelarEdicao() {
    setComentarioEmEdicao(null);
    setTextoEdicao('');
  }

  async function salvarEdicao(comentarioId) {
    if (!textoEdicao.trim() || salvandoEdicao) return;
    setSalvandoEdicao(true);
    setErro('');
    try {
      const res = await api.put(`/comentarios/${comentarioId}`, { conteudo: textoEdicao.trim() });
      setComentarios((atuais) =>
        atuais.map((c) => (c.id === comentarioId ? res.data : c))
      );
      setComentarioEmEdicao(null);
      setTextoEdicao('');
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Erro ao salvar alteração no comentário.');
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function excluirComentario(comentario) {
    const ehAutorComentario = usuario?.id === comentario.autorId;
    const mensagemConfirmacao = ehAutorComentario
      ? 'Tem certeza que deseja excluir seu comentário?'
      : 'Como autor desta publicação, deseja remover este comentário?';

    if (!window.confirm(mensagemConfirmacao)) return;

    setExcluindoId(comentario.id);
    setErro('');
    try {
      await api.delete(`/comentarios/${comentario.id}`);
      setComentarios((atuais) => atuais.filter((c) => c.id !== comentario.id));
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Erro ao excluir comentário.');
    } finally {
      setExcluindoId(null);
    }
  }

  return (
    <section style={{ marginTop: '3.5rem', paddingTop: '2rem', borderTop: '2px solid var(--cor-borda)' }}>
      {/* Container Principal do Bate-Papo */}
      <div className="chat-container">
        {/* Cabeçalho do Chat */}
        <div className="chat-cabecalho">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
              Bate-papo & Discussão ({comentarios.length})
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {statusSse === 'conectado' && (
              <span className="status-tempo-real" title="Atualizando automaticamente em tempo real">
                <span className="ponto-pulsante" /> em tempo real
              </span>
            )}
            {statusSse === 'conectando' && (
              <span className="rotulo-mono" style={{ fontSize: '0.7rem' }}>
                conectando...
              </span>
            )}
          </div>
        </div>

        {erro && (
          <div style={{ padding: '0.5rem 1.25rem', background: '#fdf2f2', borderBottom: '1px solid var(--cor-borda)' }}>
            <p className="erro-msg" style={{ margin: 0 }}>{erro}</p>
          </div>
        )}

        {/* Feed de Mensagens / Bate-papo */}
        <div
          ref={feedRef}
          className="chat-feed"
          onScroll={() => {
            if (estaNoFundo()) {
              setTemNovoNaoVisto(false);
            }
          }}
          style={{ position: 'relative' }}
        >
          {carregando ? (
            <p className="rotulo-mono" style={{ textAlign: 'center', padding: '2rem 0' }}>
              Carregando conversa...
            </p>
          ) : comentarios.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--cor-tinta-suave)' }}>
              <p style={{ margin: 0, fontSize: '1rem', fontStyle: 'italic' }}>
                Nenhum comentário por aqui ainda.
              </p>
              <p className="rotulo-mono" style={{ marginTop: '0.5rem' }}>
                Inicie a conversa enviando uma mensagem abaixo!
              </p>
            </div>
          ) : (
            comentarios.map((comentario) => {
              const ehMeu = usuario && usuario.id === comentario.autorId;
              const ehAutorPost = comentario.autorId === autorPostId;
              const minutosRestantes = minutosRestantesEdicao(comentario.createdAt);
              const podeEditarEste = podeEditar(comentario);
              const podeExcluirEste = podeExcluir(comentario);
              const emEdicao = comentarioEmEdicao === comentario.id;

              return (
                <div
                  key={comentario.id}
                  className={`balao-conversa ${ehMeu ? 'balao-meu' : 'balao-outro'} ${
                    ehAutorPost && !ehMeu ? 'balao-autor-post' : ''
                  }`}
                >
                  {/* Topo do Balão (Identificação e Ações) */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: '0.75rem',
                      marginBottom: '0.35rem',
                      fontSize: '0.82rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <strong style={{ color: 'var(--cor-tinta)' }}>
                        {ehMeu ? 'Você' : comentario.autor?.nome || 'Usuário'}
                      </strong>

                      {ehAutorPost && (
                        <span
                          className="selo"
                          style={{
                            fontSize: '0.58rem',
                            padding: '0.1em 0.4em',
                            color: 'var(--cor-ambar-escuro)',
                            borderColor: 'var(--cor-ambar-escuro)',
                            transform: 'none',
                          }}
                        >
                          Autor
                        </span>
                      )}

                      {comentario.autor?.instituicao && (
                        <span className="rotulo-mono" style={{ fontSize: '0.68rem' }}>
                          · {comentario.autor.instituicao}
                        </span>
                      )}

                      <span className="rotulo-mono" style={{ fontSize: '0.68rem', color: 'var(--cor-tinta-suave)' }}>
                        · {formatarHoraData(comentario.createdAt)}
                      </span>

                      {comentario.editado && (
                        <span style={{ fontSize: '0.68rem', fontStyle: 'italic', color: 'var(--cor-tinta-suave)' }}>
                          (editado)
                        </span>
                      )}
                    </div>

                    {/* Ações (Editar / Excluir) */}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                      {podeEditarEste && !emEdicao && (
                        <button
                          type="button"
                          onClick={() => iniciarEdicao(comentario)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--cor-teal)',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            padding: 0,
                            textDecoration: 'underline',
                          }}
                          title={`Você pode editar nos próximos ${minutosRestantes} minuto(s)`}
                        >
                          Editar ({minutosRestantes}m)
                        </button>
                      )}

                      {podeExcluirEste && (
                        <button
                          type="button"
                          onClick={() => excluirComentario(comentario)}
                          disabled={excluindoId === comentario.id}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--cor-alerta)',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            padding: 0,
                            textDecoration: 'underline',
                          }}
                          title={
                            ehMeu
                              ? 'Excluir seu comentário'
                              : 'Excluir comentário da sua publicação'
                          }
                        >
                          {excluindoId === comentario.id ? '...' : 'Excluir'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Conteúdo ou Edição Inline */}
                  {emEdicao ? (
                    <div style={{ marginTop: '0.4rem' }}>
                      <p className="rotulo-mono" style={{ marginBottom: '0.3rem', color: 'var(--cor-teal)', fontSize: '0.7rem' }}>
                        Tempo restante para editar: {minutosRestantes} minuto(s)
                      </p>
                      <textarea
                        rows={2}
                        value={textoEdicao}
                        onChange={(e) => setTextoEdicao(e.target.value)}
                        maxLength={2000}
                        required
                        style={{ fontSize: '0.92rem', padding: '0.4rem 0.6rem' }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="botao-secundario"
                          onClick={cancelarEdicao}
                          disabled={salvandoEdicao}
                          style={{ padding: '0.3em 0.7em', fontSize: '0.78rem' }}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="botao-primario"
                          onClick={() => salvarEdicao(comentario.id)}
                          disabled={salvandoEdicao || !textoEdicao.trim()}
                          style={{ padding: '0.3em 0.8em', fontSize: '0.78rem' }}
                        >
                          {salvandoEdicao ? 'Salvando...' : 'Salvar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, fontSize: '0.95rem' }}>
                      {comentario.conteudo}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={fimChatRef} />
        </div>

        {/* Botão flutuante de novo comentário recebido */}
        {temNovoNaoVisto && (
          <button
            type="button"
            className="chat-aviso-flutuante"
            onClick={() => rolarParaFundo(true)}
          >
            ↓ Novos comentários
          </button>
        )}

        {/* Barra de Digitação Estilo Bate-Papo */}
        <div className="chat-barra-envio">
          {usuario ? (
            <form
              onSubmit={enviarComentario}
              style={{ display: 'flex', gap: '0.75rem', width: '100%', alignItems: 'center' }}
            >
              <div style={{ flex: 1 }}>
                <textarea
                  rows={1}
                  value={novoComentario}
                  onChange={(e) => setNovoComentario(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Escreva uma mensagem como ${usuario.nome}... (Enter para enviar)`}
                  maxLength={2000}
                  style={{
                    resize: 'none',
                    minHeight: '40px',
                    padding: '0.55rem 0.85rem',
                    fontSize: '0.92rem',
                    lineHeight: '1.4',
                  }}
                />
              </div>

              <button
                type="submit"
                className="botao-primario"
                disabled={enviando || !novoComentario.trim()}
                style={{
                  height: '40px',
                  padding: '0 1.3rem',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  flexShrink: 0,
                }}
              >
                {enviando ? 'Enviando...' : 'Enviar'}
              </button>
            </form>
          ) : (
            <div style={{ width: '100%', textAlign: 'center', padding: '0.3rem 0' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--cor-tinta-suave)', marginRight: '0.75rem' }}>
                Deseja participar deste bate-papo?
              </span>
              <Link
                to="/entrar"
                className="botao botao-secundario"
                style={{ display: 'inline-block', fontSize: '0.8rem', padding: '0.4em 1em' }}
              >
                Entrar para comentar
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
