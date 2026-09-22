import { Link } from 'react-router-dom';
import FundingBar from './FundingBar';

export default function CampaignCard({ campanha }) {
  return (
    <Link to={`/vitrine/${campanha.id}`} className="cartao" style={{ display: 'block', color: 'var(--cor-tinta)', overflow: 'hidden' }}>
      {campanha.imagemCapaUrl && (
        <img
          src={campanha.imagemCapaUrl}
          alt={`Imagem de capa do projeto "${campanha.titulo}"`}
          style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block' }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      <div style={{ padding: '1.25rem' }}>
        {campanha.categoria && <span className="selo selo-projeto">{campanha.categoria.nome}</span>}
        <h3 style={{ marginTop: '0.6rem' }}>{campanha.titulo}</h3>
        <p style={{ color: 'var(--cor-tinta-suave)', fontSize: '0.92rem' }}>{campanha.descricao?.slice(0, 120)}...</p>
        <FundingBar arrecadado={campanha.valorArrecadado} meta={campanha.metaFinanceira} />
      </div>
    </Link>
  );
}
