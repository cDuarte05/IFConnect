import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    try {
      await login(email, senha);
      navigate('/');
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível entrar.');
    }
  }

  return (
    <div className="container" style={{ padding: '3rem 1.5rem', maxWidth: 420 }}>
      <h1>Entrar</h1>
      <form onSubmit={enviar}>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="senha">Senha</label>
        <input id="senha" type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        {erro && <p className="erro-msg">{erro}</p>}
        <button type="submit" className="botao-primario" style={{ marginTop: '1.5rem' }}>Entrar</button>
      </form>
      <p style={{ marginTop: '1rem' }}>Ainda não tem conta? <Link to="/registrar">Criar conta</Link></p>
    </div>
  );
}
