import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Moderation() {
  const { usuario } = useAuth();
  const [artigos, setArtigos] = useState([]);
  const [campanhas, setCampanhas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [novaCategoria, setNovaCategoria] = useState('');
  const [erroCategoria, setErroCategoria] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  function carregar() {
    setCarregando(true);
    Promise.all([
      api.get('/artigos/moderacao/pendentes'),
      api.get('/campanhas/moderacao/pendentes'),
      api.get('/categorias'),
    ])
      .then(([a, c, cat]) => {
        setArtigos(a.data);
        setCampanhas(c.data);
        setCategorias(cat.data);
      })
      .catch((err) => setErro(err.response?.data?.mensagem || 'Não foi possível carregar a fila de moderação.'))
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    if (usuario?.tipo === 'professor_moderador') carregar();
    else setCarregando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  async function moderarArtigo(id, novoStatus) {
    await api.patch(`/artigos/${id}/moderar`, { status: novoStatus });
    carregar();
  }

  async function moderarCampanha(id, novoStatus) {
    await api.patch(`/campanhas/${id}/moderar`, { status: novoStatus });
    carregar();
  }

  async function criarCategoria(e) {
    e.preventDefault();
    setErroCategoria('');
    try {
      await api.post('/categorias', { nome: novaCategoria });
      setNovaCategoria('');
      carregar();
    } catch (err) {
      setErroCategoria(err.response?.data?.mensagem || 'Não foi possível criar a categoria.');
    }
  }

  if (!usuario || usuario.tipo !== 'professor_moderador') {
    return (
      <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
        <p className="erro-msg">Esta área é restrita a professores(as) moderadores(as).</p>
      </div>
    );
  }

  if (carregando) {
    return (
      <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
        <p className="rotulo-mono">Carregando fila de moderação...</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
      <p className="rotulo-mono">Moderação</p>
      <h1>Itens aguardando revisão</h1>
      {erro && <p className="erro-msg">{erro}</p>}

      <section style={{ marginTop: '2rem' }}>
        <h2>Publicações em revisão ({artigos.length})</h2>
        {artigos.length === 0 ? (
          <p>Nenhuma publicação pendente no momento.</p>
        ) : (
          artigos.map((a) => (
            <div key={a.id} className="cartao" style={{ padding: '1.25rem', marginTop: '0.75rem' }}>
              <span className={`selo selo-${a.tipo}`}>{a.tipo}</span>
              <h3 style={{ marginTop: '0.5rem' }}>
                <Link to={`/publicacoes/${a.id}`}>{a.titulo}</Link>
              </h3>
              <p className="rotulo-mono">{a.autor?.nome} {a.autor?.instituicao ? `· ${a.autor.instituicao}` : ''}</p>
              <p style={{ color: 'var(--cor-tinta-suave)' }}>{a.resumo}</p>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button className="botao-primario" onClick={() => moderarArtigo(a.id, 'publicado')}>Aprovar</button>
                <button className="botao-secundario" onClick={() => moderarArtigo(a.id, 'recusado')}>Recusar</button>
              </div>
            </div>
          ))
        )}
      </section>

      <section style={{ marginTop: '2.5rem' }}>
        <h2>Projetos em análise ({campanhas.length})</h2>
        {campanhas.length === 0 ? (
          <p>Nenhum projeto pendente no momento.</p>
        ) : (
          campanhas.map((c) => (
            <div key={c.id} className="cartao" style={{ padding: '1.25rem', marginTop: '0.75rem' }}>
              {c.categoria && <span className="selo selo-projeto">{c.categoria.nome}</span>}
              <h3 style={{ marginTop: '0.5rem' }}>
                <Link to={`/vitrine/${c.id}`}>{c.titulo}</Link>
              </h3>
              <p className="rotulo-mono">{c.autor?.nome} {c.autor?.instituicao ? `· ${c.autor.instituicao}` : ''}</p>
              <p style={{ color: 'var(--cor-tinta-suave)' }}>{c.descricao?.slice(0, 160)}...</p>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button className="botao-primario" onClick={() => moderarCampanha(c.id, 'ativa')}>Aprovar</button>
                <button className="botao-secundario" onClick={() => moderarCampanha(c.id, 'encerrada')}>Recusar / encerrar</button>
              </div>
            </div>
          ))
        )}
      </section>

      <section style={{ marginTop: '2.5rem' }}>
        <h2>Categorias</h2>
        <p style={{ color: 'var(--cor-tinta-suave)' }}>
          Usadas para classificar publicações e projetos por assunto (ex.: Robótica, Meio ambiente).
          Só professores(as) moderadores(as) podem criar novas categorias.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '0.75rem 0 1.25rem' }}>
          {categorias.length === 0 ? (
            <span className="rotulo-mono">Nenhuma categoria cadastrada ainda.</span>
          ) : (
            categorias.map((c) => <span key={c.id} className="selo selo-categoria">{c.nome}</span>)
          )}
        </div>
        <form onSubmit={criarCategoria} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label htmlFor="novaCategoria">Nova categoria</label>
            <input
              id="novaCategoria"
              placeholder="ex.: Robótica"
              required
              value={novaCategoria}
              onChange={(e) => setNovaCategoria(e.target.value)}
            />
          </div>
          <button type="submit" className="botao-secundario">Criar categoria</button>
        </form>
        {erroCategoria && <p className="erro-msg">{erroCategoria}</p>}
      </section>
    </div>
  );
}
