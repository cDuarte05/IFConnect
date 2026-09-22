module.exports = (err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    erro: true,
    mensagem: err.message || 'Erro interno no servidor',
  });
};
