import { Link } from 'react-router-dom';
import { TEMA_ROTULOS, TIPO_ROTULOS } from '../constants';

export default function ArticleCard({ artigo }) {
  return (
    <Link to={`/publicacoes/${artigo.id}`} className="cartao" style={{ display: 'block', color: 'var(--cor-tinta)', overflow: 'hidden' }}>
      {artigo.imagemCapaUrl && (
        <img
          src={artigo.imagemCapaUrl}
          alt={`Imagem de capa de "${artigo.titulo}"`}
          style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block' }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      <div style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className={`selo selo-${artigo.tipo}`}>
            {TIPO_ROTULOS[artigo.tipo] || artigo.tipo}
          </span>
          {artigo.categoria && <span className="selo selo-categoria">{artigo.categoria.nome}</span>}
        </div>
        <h3 style={{ marginTop: '0.6rem' }}>{artigo.titulo}</h3>
        <p style={{ color: 'var(--cor-tinta-suave)', fontSize: '0.92rem' }}>{artigo.resumo}</p>
        <p className="rotulo-mono">
          {artigo.autor?.nome} {artigo.autor?.instituicao ? `· ${artigo.autor.instituicao}` : ''}
        </p>
      </div>
    </Link>
  );
}
