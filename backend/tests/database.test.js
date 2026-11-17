const {
  sequelize,
  ambiente,
  extrairHostMascarado,
  determinarAmbiente,
  criarSequelize,
  obterConfigSsl,
} = require('../src/config/database');
const { verificarGuardaRemota } = require('../src/utils/seed');

describe('Configuração do Banco de Dados e Compatibilidade Supabase / PostgreSQL', () => {
  const envOriginal = { ...process.env };

  afterEach(() => {
    process.env = { ...envOriginal };
  });

  // (a) com NODE_ENV=test e DATABASE_URL definida, sequelize.getDialect() === 'sqlite'
  test('(a) com NODE_ENV=test e DATABASE_URL definida, sequelize.getDialect() === sqlite', () => {
    process.env.DATABASE_URL = 'postgres://postgres:senha123@aws-0.pooler.supabase.com:5432/postgres';
    expect(process.env.NODE_ENV).toBe('test');

    // A instância exportada em teste é sqlite
    expect(sequelize.getDialect()).toBe('sqlite');
    expect(ambiente.dialect).toBe('sqlite');
    expect(ambiente.remoto).toBe(false);
    expect(ambiente.hostMascarado).toBe(':memory:');

    // Nova instância criada via helper em ambiente de teste continua sendo SQLite em memória
    const seqEmTeste = criarSequelize({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://usuario:senha@host-remoto.supabase.com:5432/postgres',
      DB_DIALECT: 'postgres',
    });
    expect(seqEmTeste.getDialect()).toBe('sqlite');
    expect(seqEmTeste.options.storage).toBe(':memory:');
  });

  // (b) seed aborta quando ambiente.remoto sem confirmação (testar a função de guarda, sem Postgres real)
  describe('(b) Guarda de proteção do seed em banco remoto (verificarGuardaRemota)', () => {
    test('permite execução imediata quando ambiente NÃO é remoto (ex.: SQLite local)', async () => {
      const ambLocal = { dialect: 'sqlite', remoto: false, hostMascarado: './portal.sqlite' };
      const permitido = await verificarGuardaRemota(ambLocal);
      expect(permitido).toBe(true);
    });

    test('aborta quando ambiente.remoto=true sem PERMITIR_SEED_REMOTO=sim', async () => {
      const ambRemoto = { dialect: 'postgres', remoto: true, hostMascarado: 'aws-0.pooler.supabase.com:5432' };
      const permitido = await verificarGuardaRemota(ambRemoto, {
        env: { PERMITIR_SEED_REMOTO: 'nao' },
        argv: ['node', 'seed.js', '--confirmar-remoto'],
      });
      expect(permitido).toBe(false);
    });

    test('aborta quando ambiente.remoto=true sem a flag --confirmar-remoto', async () => {
      const ambRemoto = { dialect: 'postgres', remoto: true, hostMascarado: 'aws-0.pooler.supabase.com:5432' };
      const permitido = await verificarGuardaRemota(ambRemoto, {
        env: { PERMITIR_SEED_REMOTO: 'sim' },
        argv: ['node', 'seed.js'],
      });
      expect(permitido).toBe(false);
    });

    test('aborta quando usuário digita host incorreto no prompt', async () => {
      const ambRemoto = { dialect: 'postgres', remoto: true, hostMascarado: 'aws-0.pooler.supabase.com:5432' };
      const perguntarMock = jest.fn().mockResolvedValue('host-errado');
      const permitido = await verificarGuardaRemota(ambRemoto, {
        env: { PERMITIR_SEED_REMOTO: 'sim' },
        argv: ['node', 'seed.js', '--confirmar-remoto'],
        perguntar: perguntarMock,
      });
      expect(perguntarMock).toHaveBeenCalled();
      expect(permitido).toBe(false);
    });

    test('permite execução remota quando todas as confirmações foram satisfeitas', async () => {
      const ambRemoto = { dialect: 'postgres', remoto: true, hostMascarado: 'aws-0.pooler.supabase.com:5432' };
      const perguntarMock = jest.fn().mockResolvedValue('aws-0.pooler.supabase.com:5432');
      const permitido = await verificarGuardaRemota(ambRemoto, {
        env: { PERMITIR_SEED_REMOTO: 'sim' },
        argv: ['node', 'seed.js', '--confirmar-remoto'],
        perguntar: perguntarMock,
      });
      expect(perguntarMock).toHaveBeenCalled();
      expect(permitido).toBe(true);
    });
  });

  // (c) hostMascarado nunca contém usuário nem senha
  describe('(c) Mascaramento de host e credenciais (extrairHostMascarado)', () => {
    test('nunca expõe usuário nem senha a partir de URLs do Supabase ou PostgreSQL', () => {
      const urls = [
        'postgres://postgres.abcdef:SuperSenha123!@aws-0-sa-east-1.pooler.supabase.com:5432/postgres',
        'postgresql://usuario_admin:outra_senha_secreta@db.supabase.co:6543/postgres?sslmode=require',
        'postgres://meu_usuario:segredo@127.0.0.1:5432/portal',
      ];

      for (const url of urls) {
        const mascarado = extrairHostMascarado(url);
        expect(mascarado).not.toContain('postgres.abcdef');
        expect(mascarado).not.toContain('SuperSenha123!');
        expect(mascarado).not.toContain('usuario_admin');
        expect(mascarado).not.toContain('outra_senha_secreta');
        expect(mascarado).not.toContain('meu_usuario');
        expect(mascarado).not.toContain('segredo');
        expect(mascarado).not.toContain('@');
        expect(typeof mascarado).toBe('string');
        expect(mascarado.length).toBeGreaterThan(0);
      }
    });

    test('determinarAmbiente em produção com DATABASE_URL gera hostMascarado limpo e remoto=true', () => {
      const amb = determinarAmbiente({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://postgres.xyz:minhasenha@aws-0.pooler.supabase.com:5432/postgres',
      });

      expect(amb.dialect).toBe('postgres');
      expect(amb.remoto).toBe(true);
      expect(amb.hostMascarado).toBe('aws-0.pooler.supabase.com:5432');
      expect(amb.hostMascarado).not.toContain('postgres.xyz');
      expect(amb.hostMascarado).not.toContain('minhasenha');
    });

    test('determinarAmbiente em produção com Postgres local gera remoto=false', () => {
      const amb = determinarAmbiente({
        NODE_ENV: 'production',
        DB_DIALECT: 'postgres',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
      });

      expect(amb.dialect).toBe('postgres');
      expect(amb.remoto).toBe(false);
      expect(amb.hostMascarado).toBe('localhost:5432');
    });

    test('obterConfigSsl respeita DB_SSL=false para postgres local', () => {
      const ssl = obterConfigSsl({ DB_SSL: 'false', NODE_ENV: 'development' });
      expect(ssl).toBe(false);
    });
  });
});
