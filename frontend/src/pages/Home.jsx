import { useEffect, useState } from 'react';
import api from '../api/client';
import ArticleCard from '../components/ArticleCard';
import { TEMAS } from '../constants';

const TIPOS = [
  { valor: '', rotulo: 'Tudo' },
  { valor: 'noticia_escolar', rotulo: 'Notícias escolares' },
  { valor: 'noticia_global', rotulo: 'Notícias globais' },
  { valor: 'artigo_cientifico', rotulo: 'Artigos científicos' },
  { valor: 'texto', rotulo: 'Textos' },
  { valor: 'poema', rotulo: 'Poemas' },
  { valor: 'projeto', rotulo: 'Projetos' },
];

export default function Home() {
  const [artigos, setArtigos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [tipo, setTipo] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tema, setTema] = useState('');
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.get('/categorias').then((r) => setCategorias(r.data)).catch(() => setCategorias([]));
  }, []);

  useEffect(() => {
    setCarregando(true);
    api
      .get('/artigos', {
        params: {
          tipo: tipo || undefined,
          categoryId: categoryId || undefined,
          tema: tema || undefined,
          busca: busca || undefined,
        },
      })
      .then((r) => setArtigos(r.data))
      .finally(() => setCarregando(false));
  }, [tipo, categoryId, tema, busca]);

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
      <section style={{ marginBottom: '2.5rem' }}>
        <p className="rotulo-mono">Divulgação científica comunitária</p>
        <h1>O que a nossa comunidade está descobrindo, escrevendo e construindo.</h1>
        <p style={{ maxWidth: 640, color: 'var(--cor-tinta-suave)' }}>
          Um mural aberto para notícias escolares e globais, artigos científicos,
          textos e poemas — publicado por estudantes, jovens jornalistas e a
          comunidade. Sem curadoria fechada, sem paywall.
        </p>
      </section>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
        <div>
          <label htmlFor="busca" className="rotulo-mono">Buscar</label>
          <input
            id="busca"
            placeholder="Título ou palavra-chave..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ maxWidth: 280 }}
          />
        </div>
        {categorias.length > 0 && (
          <div>
            <label htmlFor="categoria" className="rotulo-mono">Categoria</label>
            <select id="categoria" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ maxWidth: 220 }}>
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="tema" className="rotulo-mono">Tema</label>
          <select id="tema" value={tema} onChange={(e) => setTema(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="">Todos</option>
            {TEMAS.map((t) => (
              <option key={t.valor} value={t.valor}>{t.rotulo}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {TIPOS.map((t) => (
          <button
            key={t.valor}
            onClick={() => setTipo(t.valor)}
            className={tipo === t.valor ? 'botao-primario' : 'botao-secundario'}
            style={{ fontSize: '0.82rem', padding: '0.4em 0.9em' }}
          >
            {t.rotulo}
          </button>
        ))}
      </div>

      {carregando ? (
        <p className="rotulo-mono">Carregando publicações...</p>
      ) : artigos.length === 0 ? (
        <p>Nenhuma publicação encontrada. Que tal ser a primeira pessoa a publicar?</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {artigos.map((a) => <ArticleCard key={a.id} artigo={a} />)}
        </div>
      )}
    </div>
  );
}
