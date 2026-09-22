const { Donation, Campaign, sequelize } = require('../models');
const asyncHandler = require('../utils/asyncHandler');

// Registra um apoio/doação e atualiza o total arrecadado da campanha.
// Em produção, isso seria confirmado por webhook do gateway de pagamento (não no clique do usuário).
exports.apoiar = asyncHandler(async (req, res) => {
  const { valor, mensagemApoio, anonimo } = req.body;
  const campanha = await Campaign.findByPk(req.params.campaignId);
  if (!campanha) return res.status(404).json({ erro: true, mensagem: 'Campanha não encontrada' });
  if (!valor || valor <= 0) {
    return res.status(400).json({ erro: true, mensagem: 'Valor de apoio inválido' });
  }

  const resultado = await sequelize.transaction(async (t) => {
    const doacao = await Donation.create(
      { valor, mensagemApoio, anonimo: !!anonimo, campaignId: campanha.id, apoiadorId: req.usuario.id },
      { transaction: t }
    );
    campanha.valorArrecadado = Number(campanha.valorArrecadado) + Number(valor);
    if (campanha.valorArrecadado >= Number(campanha.metaFinanceira)) {
      campanha.status = 'financiada';
    }
    await campanha.save({ transaction: t });
    return doacao;
  });

  res.status(201).json(resultado);
});
