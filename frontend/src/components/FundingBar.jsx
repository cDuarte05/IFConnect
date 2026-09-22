// Termômetro de arrecadação — segundo elemento de assinatura do design,
// visualiza o progresso de cada campanha da vitrine científica.
export default function FundingBar({ arrecadado, meta }) {
  const percentual = Math.min(100, Math.round((Number(arrecadado) / Number(meta)) * 100));
  return (
    <div>
      <div style={{ height: 8, borderRadius: 4, background: 'var(--cor-papel-alt)', overflow: 'hidden', border: '1px solid var(--cor-borda)' }}>
        <div style={{ width: `${percentual}%`, height: '100%', background: 'var(--cor-teal)' }} />
      </div>
      <p className="rotulo-mono" style={{ marginTop: '0.4rem' }}>
        R$ {Number(arrecadado).toFixed(2)} de R$ {Number(meta).toFixed(2)} ({percentual}%)
      </p>
    </div>
  );
}
