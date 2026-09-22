import { useEffect, useState } from 'react';
import api from '../api/client';
import CampaignCard from '../components/CampaignCard';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { TEMAS } from '../constants';

export default function Crowdfunding() {
  const [campanhas, setCampanhas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [categoryId, setCategoryId] = useState('');
  const [tema, setTema] = useState('');
  const [busca, setBusca] = useState('');
  const { usuario } = useAuth();

  useEffect(() => {
    api.get('/categorias').then((r) => setCategorias(r.data)).catch(() => setCategorias([]));
  }, []);

  useEffect(() => {
    setCarregando(true);
    api
      .get('/campanhas', {
        params: { categoryId: categoryId || undefined, tema: tema || undefined, busca: busca || undefined },
      })
      .then((r) => setCampanhas(r.data))
      .finally(() => setCarregando(false));
  }, [categoryId, tema, busca]);

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <p className="rotulo-mono">Vitrine científica</p>
          <h1>Projetos buscando apoio da comunidade</h1>
          <p style={{ maxWidth: 620, color: 'var(--cor-tinta-suave)' }}>
            Divulgação gratuita e transparente para projetos científicos de estudantes
            em busca de financiamento — de kits de robótica a estações meteorológicas.
          </p>
        </div>
        {usuario && <Link to="/vitrine/nova" className="botao botao-primario">Cadastrar projeto</Link>}
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', marginTop: '1.5rem' }}>
        <div>
          <label htmlFor="buscaProjeto" className="rotulo-mono">Buscar</label>
          <input
            id="buscaProjeto"
            placeholder="Título ou palavra-chave..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ maxWidth: 280 }}
          />
        </div>
        {categorias.length > 0 && (
          <div>
            <label htmlFor="filtroCategoria" className="rotulo-mono">Categoria</label>
            <select id="filtroCategoria" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ maxWidth: 220 }}>
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="filtroTema" className="rotulo-mono">Tema</label>
          <select id="filtroTema" value={tema} onChange={(e) => setTema(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="">Todos</option>
            {TEMAS.map((t) => (
              <option key={t.valor} value={t.valor}>{t.rotulo}</option>
            ))}
          </select>
        </div>
      </div>

      {carregando ? (
        <p className="rotulo-mono" style={{ marginTop: '2rem' }}>Carregando campanhas...</p>
      ) : campanhas.length === 0 ? (
        <p style={{ marginTop: '2rem' }}>Nenhuma campanha encontrada para este filtro.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem', marginTop: '2rem' }}>
          {campanhas.map((c) => <CampaignCard key={c.id} campanha={c} />)}
        </div>
      )}
    </div>
  );
}
