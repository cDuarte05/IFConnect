import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { TEMAS } from '../constants';

export default function SubmitArticle() {
  const [form, setForm] = useState({
    titulo: '',
    resumo: '',
    conteudo: '',
    tipo: 'noticia_escolar',
    categoryId: '',
    tema: '',
    palavrasChave: '',
    imagemCapaUrl: '',
  });
  const [categorias, setCategorias] = useState([]);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/categorias').then((r) => setCategorias(r.data)).catch(() => setCategorias([]));
  }, []);

  function atualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const payload = { ...form, categoryId: form.categoryId || null, tema: form.tema || null };
      const { data } = await api.post('/artigos', payload);
      navigate(`/publicacoes/${data.id}`);
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível publicar. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem', maxWidth: 640 }}>
      <p className="rotulo-mono">Nova publicação</p>
      <h1>Compartilhe com a comunidade</h1>
      <p style={{ color: 'var(--cor-tinta-suave)' }}>
        Notícias entram em revisão antes de ficarem públicas. Professores moderadores
        publicam diretamente.
      </p>
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

        <label htmlFor="titulo">Título (entre 10 e 150 caracteres)</label>
        <input id="titulo" required minLength={10} maxLength={150} value={form.titulo} onChange={(e) => atualizar('titulo', e.target.value)} />

        <label htmlFor="resumo">Resumo (até 300 caracteres)</label>
        <input id="resumo" required maxLength={300} value={form.resumo} onChange={(e) => atualizar('resumo', e.target.value)} />

        <label htmlFor="conteudo">Conteúdo completo (até 20.000 caracteres)</label>
        <textarea id="conteudo" required rows={10} maxLength={20000} value={form.conteudo} onChange={(e) => atualizar('conteudo', e.target.value)} />
        <p className="rotulo-mono" style={{ marginTop: '0.3rem' }}>{form.conteudo.length}/20000</p>

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

        <label htmlFor="palavrasChave">Palavras-chave (opcional, separadas por vírgula, até 300 caracteres)</label>
        <input
          id="palavrasChave"
          maxLength={300}
          placeholder="ex.: robótica, feira de ciências, arduino"
          value={form.palavrasChave}
          onChange={(e) => atualizar('palavrasChave', e.target.value)}
        />

        <label htmlFor="imagem">URL da imagem de capa (opcional)</label>
        <input id="imagem" type="url" maxLength={500} placeholder="https://..." value={form.imagemCapaUrl} onChange={(e) => atualizar('imagemCapaUrl', e.target.value)} />

        {erro && <p className="erro-msg">{erro}</p>}
        <button type="submit" className="botao-primario" style={{ marginTop: '1.5rem' }} disabled={enviando}>
          {enviando ? 'Enviando...' : 'Enviar para revisão'}
        </button>
      </form>
    </div>
  );
}