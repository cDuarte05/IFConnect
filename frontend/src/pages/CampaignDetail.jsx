import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import FundingBar from '../components/FundingBar';
import { useAuth } from '../context/AuthContext';
import { TEMA_ROTULOS } from '../constants';

export default function CampaignDetail() {
  const { id } = useParams();
  const [campanha, setCampanha] = useState(null);
  const [valor, setValor] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [status, setStatus] = useState('');
  const { usuario } = useAuth();

  function carregar() {
    api.get(`/campanhas/${id}`).then((r) => setCampanha(r.data));
  }

  useEffect(() => { carregar(); }, [id]);

  async function apoiar(e) {
    e.preventDefault();
    setStatus('');
    try {
      await api.post(`/doacoes/${id}`, { valor: Number(valor), mensagemApoio: mensagem });
      setValor('');
      setMensagem('');
      setStatus('sucesso');
      carregar();
    } catch (err) {
      setStatus(err.response?.data?.mensagem || 'erro');
    }
  }

  if (!campanha) return <div className="container" style={{ padding: '2.5rem 1.5rem' }}><p className="rotulo-mono">Carregando...</p></div>;

  const podeEditar = usuario && usuario.id === campanha.autorId && campanha.status === 'em_analise';

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem', maxWidth: 760 }}>
      <Link to="/vitrine" className="rotulo-mono">← voltar à vitrine</Link>
      {campanha.imagemCapaUrl && (
        <img
          src={campanha.imagemCapaUrl}
          alt={`Imagem de capa do projeto "${campanha.titulo}"`}
          style={{ width: '100%', maxHeight: 360, objectFit: 'cover', borderRadius: 'var(--raio)', margin: '1rem 0' }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      {(campanha.categoria || campanha.tema) && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '1rem 0' }}>
          {campanha.categoria && <span className="selo selo-projeto">{campanha.categoria.nome}</span>}
          {campanha.tema && <span className={`selo selo-tema-${campanha.tema}`}>{TEMA_ROTULOS[campanha.tema] || campanha.tema}</span>}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <h1>{campanha.titulo}</h1>
        {podeEditar && <Link to={`/vitrine/${id}/editar`} className="botao botao-secundario" style={{ flexShrink: 0 }}>Editar</Link>}
      </div>
      <p className="rotulo-mono">{campanha.autor?.nome} {campanha.autor?.instituicao ? `· ${campanha.autor.instituicao}` : ''}</p>
      <FundingBar arrecadado={campanha.valorArrecadado} meta={campanha.metaFinanceira} />
      <p style={{ fontSize: '1.05rem', lineHeight: 1.7, marginTop: '1.5rem' }}>{campanha.descricao}</p>
      {campanha.palavrasChave && (
        <p className="rotulo-mono" style={{ marginTop: '0.75rem' }}>Palavras-chave: {campanha.palavrasChave}</p>
      )}

      <div className="cartao" style={{ padding: '1.5rem', marginTop: '2rem' }}>
        <h3>Apoiar este projeto</h3>
        {!usuario ? (
          <p>Você precisa <Link to="/entrar">entrar</Link> para apoiar um projeto.</p>
        ) : (
          <form onSubmit={apoiar}>
            <label htmlFor="valor">Valor (R$)</label>
            <input id="valor" type="number" min="1" step="0.01" required value={valor} onChange={(e) => setValor(e.target.value)} />
            <label htmlFor="mensagem">Mensagem de apoio (opcional)</label>
            <input id="mensagem" maxLength={280} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
            {status === 'sucesso' && <p className="sucesso-msg">Apoio registrado — obrigado!</p>}
            {status && status !== 'sucesso' && <p className="erro-msg">{status}</p>}
            <button type="submit" className="botao-primario" style={{ marginTop: '1rem' }}>Confirmar apoio</button>
          </form>
        )}
      </div>

      {campanha.doacoes?.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3>Quem já apoiou</h3>
          {campanha.doacoes.map((d) => (
            <div key={d.id} style={{ borderBottom: '1px solid var(--cor-borda)', padding: '0.6rem 0' }}>
              <strong>{d.anonimo ? 'Apoiador anônimo' : d.apoiador?.nome}</strong> — R$ {Number(d.valor).toFixed(2)}
              {d.mensagemApoio && <p style={{ margin: '0.2rem 0 0', color: 'var(--cor-tinta-suave)' }}>“{d.mensagemApoio}”</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
