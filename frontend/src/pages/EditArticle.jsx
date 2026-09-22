import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { TEMAS } from '../constants';

export default function EditArticle() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    Promise.all([api.get(`/artigos/${id}`), api.get('/categorias').catch(() => ({ data: [] }))])
      .then(([r, cats]) => {
        const a = r.data;
        setForm({
          titulo: a.titulo,
          resumo: a.resumo,
          conteudo: a.conteudo,
          tipo: a.tipo,
          categoryId: a.categoryId || '',
          tema: a.tema || '',
          palavrasChave: a.palavrasChave || '',
          imagemCapaUrl: a.imagemCapaUrl || '',
          autorId: a.autorId,
          status: a.status,
        });
        setCategorias(cats.data);
      })
      .catch(() => setErro('Publicação não encontrada.'))
      .finally(() => setCarregando(false));
  }, [id]);

  function atualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await api.put(`/artigos/${id}`, {
        titulo: form.titulo,
        resumo: form.resumo,
        conteudo: form.conteudo,
        tipo: form.tipo,
        categoryId: form.categoryId || null,
        tema: form.tema || null,
        palavrasChave: form.palavrasChave,
        imagemCapaUrl: form.imagemCapaUrl,
      });
      navigate(`/publicacoes/${id}`);
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível salvar as alterações.');
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return (
      <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
        <p className="rotulo-mono">Carregando...</p>
      </div>
    );
  }

  if (erro && !form) {
    return (
      <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
        <p className="erro-msg">{erro}</p>
      </div>
    );
  }

  const podeEditar =
    usuario && form && (usuario.id === form.autorId) && (form.status !== 'publicado' || usuario.tipo === 'professor_moderador');

  if (!podeEditar) {
    return (
      <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
        <p className="erro-msg">Você não tem permissão para editar esta publicação.</p>
        <Link to={`/publicacoes/${id}`} className="rotulo-mono">← voltar à publicação</Link>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem', maxWidth: 640 }}>
      <p className="rotulo-mono">Editar publicação</p>
      <h1>Ajustar sua publicação</h1>
      {form.status === 'recusado' && (
        <p style={{ color: 'var(--cor-tinta-suave)' }}>
          Esta publicação foi recusada. Ao salvar, ela volta para revisão.
        </p>
      )}
      <form onSubmit={enviar}>
        <label htmlFor="tipo">Tipo de publicação</label>
        <select id="tipo" value={form.tipo} onChange={(e) => atualizar('tipo', e.target.value)}>
          <option value="noticia_escolar">Notícia escolar</option>
          <option value="noticia_global">Notícia global</option>
          <option value="artigo_cientifico">Artigo científico</option>
          <option value="texto">Texto</option>
          <option value="poema">Poema</option>
          <option value="projeto">Projeto</option>
        </select>

        <label htmlFor="titulo">Título</label>
        <input id="titulo" required value={form.titulo} onChange={(e) => atualizar('titulo', e.target.value)} />

        <label htmlFor="resumo">Resumo (até 300 caracteres)</label>
        <input id="resumo" required maxLength={300} value={form.resumo} onChange={(e) => atualizar('resumo', e.target.value)} />

        <label htmlFor="conteudo">Conteúdo completo</label>
        <textarea id="conteudo" required rows={10} value={form.conteudo} onChange={(e) => atualizar('conteudo', e.target.value)} />

        <label htmlFor="categoria">Categoria (opcional)</label>
        <select id="categoria" value={form.categoryId} onChange={(e) => atualizar('categoryId', e.target.value)}>
          <option value="">Sem categoria</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>

        <label htmlFor="tema">Tema (opcional)</label>
        <select id="tema" value={form.tema} onChange={(e) => atualizar('tema', e.target.value)}>
          <option value="">Sem tema</option>
          {TEMAS.map((t) => (
            <option key={t.valor} value={t.valor}>{t.rotulo}</option>
          ))}
        </select>

        <label htmlFor="palavrasChave">Palavras-chave (opcional, separadas por vírgula)</label>
        <input id="palavrasChave" value={form.palavrasChave} onChange={(e) => atualizar('palavrasChave', e.target.value)} />

        <label htmlFor="imagem">URL da imagem de capa (opcional)</label>
        <input id="imagem" value={form.imagemCapaUrl} onChange={(e) => atualizar('imagemCapaUrl', e.target.value)} />

        {erro && <p className="erro-msg">{erro}</p>}
        <button type="submit" className="botao-primario" style={{ marginTop: '1.5rem' }} disabled={enviando}>
          {enviando ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </form>
    </div>
  );
}
