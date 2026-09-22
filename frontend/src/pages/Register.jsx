import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [form, setForm] = useState({ nome: '', email: '', senha: '', tipo: 'estudante', instituicao: '' });
  const [erro, setErro] = useState('');
  const { registrar } = useAuth();
  const navigate = useNavigate();

  function atualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    try {
      await registrar(form);
      navigate('/');
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível criar a conta.');
    }
  }

  return (
    <div className="container" style={{ padding: '3rem 1.5rem', maxWidth: 420 }}>
      <h1>Criar conta</h1>
      <form onSubmit={enviar}>
        <label htmlFor="nome">Nome</label>
        <input id="nome" required value={form.nome} onChange={(e) => atualizar('nome', e.target.value)} />

        <label htmlFor="email">Email</label>
        <input id="email" type="email" required value={form.email} onChange={(e) => atualizar('email', e.target.value)} />

        <label htmlFor="senha">Senha</label>
        <input id="senha" type="password" required minLength={6} value={form.senha} onChange={(e) => atualizar('senha', e.target.value)} />

        <label htmlFor="tipo">Eu sou</label>
        <select id="tipo" value={form.tipo} onChange={(e) => atualizar('tipo', e.target.value)}>
          <option value="estudante">Estudante</option>
          <option value="jornalista_jovem">Jovem jornalista</option>
          <option value="membro_comunidade">Membro da comunidade</option>
        </select>
        <p style={{ fontSize: '0.82rem', color: 'var(--cor-tinta-suave)', marginTop: '0.35rem' }}>
          Contas de professor(a)/moderador(a) não são criadas por autocadastro.
        </p>

        <label htmlFor="instituicao">Instituição (opcional)</label>
        <input id="instituicao" value={form.instituicao} onChange={(e) => atualizar('instituicao', e.target.value)} />

        {erro && <p className="erro-msg">{erro}</p>}
        <button type="submit" className="botao-primario" style={{ marginTop: '1.5rem' }}>Criar conta</button>
      </form>
      <p style={{ marginTop: '1rem' }}>Já tem conta? <Link to="/entrar">Entrar</Link></p>
    </div>
  );
}
