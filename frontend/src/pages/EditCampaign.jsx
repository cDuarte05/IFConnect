import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { TEMAS } from '../constants';

export default function EditCampaign() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    Promise.all([api.get(`/campanhas/${id}`), api.get('/categorias').catch(() => ({ data: [] }))])
      .then(([r, cats]) => {
        const c = r.data;
        setForm({
          titulo: c.titulo,
          descricao: c.descricao,
          categoryId: c.categoryId || '',
          tema: c.tema || '',
          palavrasChave: c.palavrasChave || '',
          metaFinanceira: c.metaFinanceira,
          prazoFinal: c.prazoFinal ? c.prazoFinal.slice(0, 10) : '',
          imagemCapaUrl: c.imagemCapaUrl || '',
          autorId: c.autorId,
          status: c.status,
        });
        setCategorias(cats.data);
      })
      .catch(() => setErro('Projeto não encontrado.'))
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
      await api.put(`/campanhas/${id}`, {
        titulo: form.titulo,
        descricao: form.descricao,
        categoryId: form.categoryId || null,
        tema: form.tema || null,
        palavrasChave: form.palavrasChave,
        metaFinanceira: Number(form.metaFinanceira),
        prazoFinal: form.prazoFinal || null,
        imagemCapaUrl: form.imagemCapaUrl,
      });
      navigate(`/vitrine/${id}`);
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

  const podeEditar = usuario && form && usuario.id === form.autorId && form.status === 'em_analise';

  if (!podeEditar) {
    return (
      <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
        <p className="erro-msg">
          Este projeto não pode mais ser editado (ou você não é o autor). Projetos só podem ser
          editados enquanto estão em análise.
        </p>
        <Link to={`/vitrine/${id}`} className="rotulo-mono">← voltar ao projeto</Link>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem', maxWidth: 640 }}>
      <p className="rotulo-mono">Editar projeto</p>
      <h1>Ajustar seu projeto</h1>
      <form onSubmit={enviar}>
        <label htmlFor="titulo">Título do projeto</label>
        <input id="titulo" required value={form.titulo} onChange={(e) => atualizar('titulo', e.target.value)} />

        <label htmlFor="descricao">Descrição</label>
        <textarea id="descricao" required rows={8} value={form.descricao} onChange={(e) => atualizar('descricao', e.target.value)} />

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

        <label htmlFor="metaFinanceira">Meta de arrecadação (R$)</label>
        <input
          id="metaFinanceira"
          type="number"
          min="1"
          step="0.01"
          required
          value={form.metaFinanceira}
          onChange={(e) => atualizar('metaFinanceira', e.target.value)}
        />

        <label htmlFor="prazoFinal">Prazo final (opcional)</label>
        <input id="prazoFinal" type="date" value={form.prazoFinal} onChange={(e) => atualizar('prazoFinal', e.target.value)} />

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
