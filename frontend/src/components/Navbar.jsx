import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { usuario, sair } = useAuth();

  return (
    <header style={{ borderBottom: '2px solid var(--cor-tinta)', background: 'var(--cor-papel)', position: 'sticky', top: 0, zIndex: 10 }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <Link to="/" style={{ fontFamily: 'var(--fonte-display)', fontWeight: 700, fontSize: '1.4rem', color: 'var(--cor-tinta)' }}>
          IFConnect
        </Link>
        <nav style={{ display: 'flex', gap: '1.4rem', alignItems: 'center', fontSize: '0.95rem', flexWrap: 'wrap' }}>
          <NavLink to="/" style={({ isActive }) => ({ color: 'var(--cor-tinta)', fontWeight: isActive ? 700 : 500 })}>Publicações</NavLink>
          <NavLink to="/vitrine" style={({ isActive }) => ({ color: 'var(--cor-tinta)', fontWeight: isActive ? 700 : 500 })}>Vitrine científica</NavLink>
          {usuario && <NavLink to="/publicar" style={({ isActive }) => ({ color: 'var(--cor-tinta)', fontWeight: isActive ? 700 : 500 })}>Publicar</NavLink>}
          {usuario?.tipo === 'professor_moderador' && (
            <NavLink to="/moderacao" style={({ isActive }) => ({ color: 'var(--cor-tinta)', fontWeight: isActive ? 700 : 500 })}>Moderação</NavLink>
          )}
          {usuario && <NavLink to="/perfil" style={({ isActive }) => ({ color: 'var(--cor-tinta)', fontWeight: isActive ? 700 : 500 })}>Perfil</NavLink>}
          {usuario ? (
            <>
              <span className="rotulo-mono">{usuario.nome.split(' ')[0]}</span>
              <button className="botao-secundario" onClick={sair}>Sair</button>
            </>
          ) : (
            <Link to="/entrar" className="botao botao-primario">Entrar</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
