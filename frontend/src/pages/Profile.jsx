import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const ROTULOS_STATUS_ARTIGO = {
  rascunho: 'Rascunho',
  em_revisao: 'Em revisão',
  publicado: 'Publicado',
  recusado: 'Recusado',
};

const ROTULOS_STATUS_CAMPANHA = {
  em_analise: 'Em análise',
  ativa: 'Ativa na vitrine',
  financiada: 'Meta atingida',
  encerrada: 'Encerrada',
};

export default function Profile() {
  const { atualizarUsuario } = useAuth();
  const [perfil, setPerfil] = useState(null);
  const [form, setForm] = useState({ nome: '', instituicao: '', bio: '' });
  const [meusArtigos, setMeusArtigos] = useState([]);
  const [minhasCampanhas, setMinhasCampanhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/auth/perfil'),
      api.get('/artigos/minhas/publicacoes'),
      api.get('/campanhas/minhas/campanhas'),
    ])
      .then(([p, artigos, campanhas]) => {
        setPerfil(p.data);
        setForm({ nome: p.data.nome, instituicao: p.data.instituicao || '', bio: p.data.bio || '' });
        setMeusArtigos(artigos.data);
        setMinhasCampanhas(campanhas.data);
      })
      .finally(() => setCarregando(false));
  }, []);

  function atualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function salvar(e) {
    e.preventDefault();
    setStatus('');
    setSalvando(true);
    try {
      const { data } = await api.patch('/auth/perfil', form);
      setPerfil(data);
      atualizarUsuario({ nome: data.nome });
      setStatus('sucesso');
    } catch (err) {
      setStatus(err.response?.data?.mensagem || 'erro');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
        <p className="rotulo-mono">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem', maxWidth: 760 }}>
      <p className="rotulo-mono">Meu perfil</p>
      <h1>{perfil.nome}</h1>
      <p style={{ color: 'var(--cor-tinta-suave)' }}>
        {perfil.email} · {perfil.tipo}
      </p>

      <form onSubmit={salvar} className="cartao" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
        <h3>Editar dados</h3>
        <label htmlFor="nome">Nome</label>
        <input id="nome" required value={form.nome} onChange={(e) => atualizar('nome', e.target.value)} />

        <label htmlFor="instituicao">Instituição</label>
        <input id="instituicao" value={form.instituicao} onChange={(e) => atualizar('instituicao', e.target.value)} />

        <label htmlFor="bio">Bio</label>
        <textarea id="bio" rows={4} value={form.bio} onChange={(e) => atualizar('bio', e.target.value)} />

        {status === 'sucesso' && <p className="sucesso-msg">Perfil atualizado.</p>}
        {status && status !== 'sucesso' && <p className="erro-msg">{status}</p>}
        <button type="submit" className="botao-primario" style={{ marginTop: '1rem' }} disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </form>

      <section style={{ marginTop: '2.5rem' }}>
        <h2>Minhas publicações</h2>
        {meusArtigos.length === 0 ? (
          <p>Você ainda não enviou nenhuma publicação.</p>
        ) : (
          meusArtigos.map((a) => (
            <div key={a.id} className="cartao" style={{ padding: '1rem 1.25rem', marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <div>
                <span className="rotulo-mono">{ROTULOS_STATUS_ARTIGO[a.status] || a.status}</span>
                <p style={{ margin: '0.3rem 0 0', fontWeight: 600 }}>{a.titulo}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
                <Link to={`/publicacoes/${a.id}`} className="rotulo-mono">ver</Link>
                {(a.status !== 'publicado' || perfil.tipo === 'professor_moderador') && (
                  <Link to={`/publicacoes/${a.id}/editar`} className="rotulo-mono">editar</Link>
                )}
              </div>
            </div>
          ))
        )}
      </section>

      <section style={{ marginTop: '2.5rem' }}>
        <h2>Minhas campanhas</h2>
        {minhasCampanhas.length === 0 ? (
          <p>Você ainda não cadastrou nenhum projeto na vitrine.</p>
        ) : (
          minhasCampanhas.map((c) => (
            <div key={c.id} className="cartao" style={{ padding: '1rem 1.25rem', marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <div>
                <span className="rotulo-mono">{ROTULOS_STATUS_CAMPANHA[c.status] || c.status}</span>
                <p style={{ margin: '0.3rem 0 0', fontWeight: 600 }}>{c.titulo}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
                <Link to={`/vitrine/${c.id}`} className="rotulo-mono">ver</Link>
                {c.status === 'em_analise' && <Link to={`/vitrine/${c.id}/editar`} className="rotulo-mono">editar</Link>}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
