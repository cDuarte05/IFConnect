import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import ArticleDetail from './pages/ArticleDetail';
import SubmitArticle from './pages/SubmitArticle';
import EditArticle from './pages/EditArticle';
import Crowdfunding from './pages/Crowdfunding';
import CampaignDetail from './pages/CampaignDetail';
import SubmitCampaign from './pages/SubmitCampaign';
import EditCampaign from './pages/EditCampaign';
import Profile from './pages/Profile';
import Moderation from './pages/Moderation';
import Login from './pages/Login';
import Register from './pages/Register';

export default function App() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/publicacoes/:id" element={<ArticleDetail />} />
          <Route path="/publicacoes/:id/editar" element={<EditArticle />} />
          <Route path="/publicar" element={<SubmitArticle />} />
          <Route path="/vitrine" element={<Crowdfunding />} />
          <Route path="/vitrine/nova" element={<SubmitCampaign />} />
          <Route path="/vitrine/:id/editar" element={<EditCampaign />} />
          <Route path="/vitrine/:id" element={<CampaignDetail />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/moderacao" element={<Moderation />} />
          <Route path="/entrar" element={<Login />} />
          <Route path="/registrar" element={<Register />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
