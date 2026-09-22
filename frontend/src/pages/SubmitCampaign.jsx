import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { TEMAS } from '../constants';

export default function SubmitCampaign() {
  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    categoryId: '',
    tema: '',
    palavrasChave: '',
    metaFinanceira: '',
    prazoFinal: '',
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
      const payload = {
        ...form,
        categoryId: form.categoryId || null,
        tema: form.tema || null,
        metaFinanceira: Number(form.metaFinanceira),
      };
      const { data } = await api.post('/campanhas', payload);
      navigate(`/vitrine/${data.id}`);
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível cadastrar o projeto. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem', maxWidth: 640 }}>
      <p className="rotulo-mono">Novo projeto</p>
      <h1>Divulgue um projeto em busca de apoio</h1>
      <p style={{ color: 'var(--cor-tinta-suave)' }}>
        Projetos entram em análise antes de aparecer na vitrine científica.
      </p>
      <form onSubmit={enviar}>
        <label htmlFor="titulo">Título do projeto</label>
        <input id="titulo" required value={form.titulo} onChange={(e) => atualizar('titulo', e.target.value)} />

        <label htmlFor="descricao">Descrição</label>
        <textarea
          id="descricao"
          required
          rows={8}
          value={form.descricao}
          onChange={(e) => atualizar('descricao', e.target.value)}
        />

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
        <input
          id="palavrasChave"
          placeholder="ex.: robótica, sustentabilidade"
          value={form.palavrasChave}
          onChange={(e) => atualizar('palavrasChave', e.target.value)}
        />

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
        <input
          id="prazoFinal"
          type="date"
          value={form.prazoFinal}
          onChange={(e) => atualizar('prazoFinal', e.target.value)}
        />

        <label htmlFor="imagem">URL da imagem de capa (opcional)</label>
        <input id="imagem" value={form.imagemCapaUrl} onChange={(e) => atualizar('imagemCapaUrl', e.target.value)} />

        {erro && <p className="erro-msg">{erro}</p>}
        <button type="submit" className="botao-primario" style={{ marginTop: '1.5rem' }} disabled={enviando}>
          {enviando ? 'Enviando...' : 'Enviar para análise'}
        </button>
      </form>
    </div>
  );
}
