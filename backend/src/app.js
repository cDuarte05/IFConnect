require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const articleRoutes = require('./routes/articleRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
const donationRoutes = require('./routes/donationRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());

// CORS: em produção, definir CORS_ORIGIN no .env com o(s) domínio(s) do frontend
// (separados por vírgula). Sem essa variável, mantém aberto — adequado para
// desenvolvimento local, mas não deve ser usado assim em produção.
const origensPermitidas = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: origensPermitidas.length > 0 ? origensPermitidas : true }));
app.use(express.json({ limit: '2mb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// Limite de requisições — protege contra abuso na API pública
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

app.get('/api/saude', (req, res) => res.json({ status: 'ok', servico: 'ifconnect-api' }));

app.use('/api/auth', authRoutes);
app.use('/api/categorias', categoryRoutes);
app.use('/api/artigos', articleRoutes);
app.use('/api/campanhas', campaignRoutes);
app.use('/api/doacoes', donationRoutes);

app.use(errorHandler);

module.exports = app;
