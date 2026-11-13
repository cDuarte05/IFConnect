class ProvedorIndisponivelError extends Error {
  constructor(mensagem, { provedor, status } = {}) {
    super(mensagem);
    this.name = 'ProvedorIndisponivelError';
    this.provedor = provedor;
    this.status = status;
  }
}

module.exports = { ProvedorIndisponivelError };

