import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { TEMA_ROTULOS, TIPO_ROTULOS } from '../constants';
import { useParams, Link, useNavigate } from 'react-router-dom';
import CommentsSection from '../components/CommentsSection';


export default function ArticleDetail() {
  const navigate = useNavigate();
  const [excluindo, setExcluindo] = useState(false);
  const { id } = useParams();
  const { usuario } = useAuth();
  const [artigo, setArtigo] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.get(`/artigos/${id}`).then((r) => setArtigo(r.data)).catch(() => setErro('Publicação não encontrada.'));
  }, [id]);

  async function excluir() {
    if (!window.confirm('Tem certeza que deseja excluir esta publicação? Esta ação não pode ser desfeita.')) return;
    setExcluindo(true);
    try {
      await api.delete(`/artigos/${id}`);
      navigate('/perfil');
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível excluir a publicação.');
      setExcluindo(false);
    }
  }

  if (erro) return <div className="container" style={{ padding: '2.5rem 1.5rem' }}><p className="erro-msg">{erro}</p></div>;
  if (!artigo) return <div className="container" style={{ padding: '2.5rem 1.5rem' }}><p className="rotulo-mono">Carregando...</p></div>;

  const podeEditar =
    usuario && usuario.id === artigo.autorId && (artigo.status !== 'publicado' || usuario.tipo === 'professor_moderador');
  const ehAutor = usuario && usuario.id === artigo.autorId;
  return (
    <article className="container" style={{ padding: '2.5rem 1.5rem', maxWidth: 760 }}>
      <Link to="/" className="rotulo-mono">← voltar às publicações</Link>
      {artigo.imagemCapaUrl && (
        <img
          src={artigo.imagemCapaUrl}
          alt={`Imagem de capa de "${artigo.titulo}"`}
          style={{ width: '100%', maxHeight: 360, objectFit: 'cover', borderRadius: 'var(--raio)', margin: '1rem 0' }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '1rem 0' }}>
        <span className={`selo selo-${artigo.tipo}`}>
          {TIPO_ROTULOS[artigo.tipo] || artigo.tipo}
        </span>        {artigo.categoria && <span className="selo selo-categoria">{artigo.categoria.nome}</span>}
        {artigo.tema && <span className={`selo selo-tema-${artigo.tema}`}>{TEMA_ROTULOS[artigo.tema] || artigo.tema}</span>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <h1>{artigo.titulo}</h1>
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          {podeEditar && <Link to={`/publicacoes/${id}/editar`} className="botao botao-secundario">Editar</Link>}
          {ehAutor && (
            <button type="button" className="botao-secundario" onClick={excluir} disabled={excluindo}>
              {excluindo ? 'Excluindo...' : 'Excluir'}
            </button>
          )}
        </div>
      </div>
      <p className="rotulo-mono">
        {artigo.autor?.nome} {artigo.autor?.instituicao ? `· ${artigo.autor.instituicao}` : ''} · {artigo.visualizacoes} visualizações
      </p>
      <p style={{ fontSize: '1.05rem', fontStyle: 'italic', color: 'var(--cor-tinta-suave)', borderLeft: '3px solid var(--cor-ambar)', paddingLeft: '1rem' }}>
        {artigo.resumo}
      </p>
      <div style={{ whiteSpace: 'pre-wrap', fontSize: '1.05rem', lineHeight: 1.7 }}>{artigo.conteudo}</div>
      {artigo.palavrasChave && (
        <p className="rotulo-mono" style={{ marginTop: '1.5rem' }}>Palavras-chave: {artigo.palavrasChave}</p>
      )}

      <CommentsSection tipo="artigo" itemId={id} autorPostId={artigo.autorId} />
    </article>
  );
}
