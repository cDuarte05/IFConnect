import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { TEMA_ROTULOS } from '../constants';

export default function ArticleDetail() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const [artigo, setArtigo] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.get(`/artigos/${id}`).then((r) => setArtigo(r.data)).catch(() => setErro('Publicação não encontrada.'));
  }, [id]);

  if (erro) return <div className="container" style={{ padding: '2.5rem 1.5rem' }}><p className="erro-msg">{erro}</p></div>;
  if (!artigo) return <div className="container" style={{ padding: '2.5rem 1.5rem' }}><p className="rotulo-mono">Carregando...</p></div>;

  const podeEditar =
    usuario && usuario.id === artigo.autorId && (artigo.status !== 'publicado' || usuario.tipo === 'professor_moderador');

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
        <span className={`selo selo-${artigo.tipo}`}>{artigo.tipo}</span>
        {artigo.categoria && <span className="selo selo-categoria">{artigo.categoria.nome}</span>}
        {artigo.tema && <span className={`selo selo-tema-${artigo.tema}`}>{TEMA_ROTULOS[artigo.tema] || artigo.tema}</span>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <h1>{artigo.titulo}</h1>
        {podeEditar && <Link to={`/publicacoes/${id}/editar`} className="botao botao-secundario" style={{ flexShrink: 0 }}>Editar</Link>}
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
    </article>
  );
}
