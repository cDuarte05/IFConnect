/**
 * Script de dados de exemplo — popula o banco local para facilitar
 * a demonstração do projeto (ex: em sala de aula ou banca avaliadora).
 * Executar com: npm run seed
 */
require('dotenv').config();
const { sequelize, User, Category, Article, Campaign } = require('../models');

async function seed() {
  await sequelize.sync({ force: true });

  const professor = await User.create({
    nome: 'Profa. Marina Alves',
    email: 'marina.alves@escola.edu.br',
    senhaHash: User.hashSenha('senha123'),
    tipo: 'professor_moderador',
    instituicao: 'Escola Estadual Jardim das Flores',
  });

  const aluno = await User.create({
    nome: 'Lucas Ferreira',
    email: 'lucas.ferreira@escola.edu.br',
    senhaHash: User.hashSenha('senha123'),
    tipo: 'estudante',
    instituicao: 'Escola Estadual Jardim das Flores',
  });

  // Categorias de exemplo — a lista não é fixa: qualquer professor_moderador
  // pode criar novas categorias via POST /api/categorias.
  const categoriaRobotica = await Category.create({ nome: 'Robótica', descricao: 'Projetos de robótica e automação' });
  const categoriaMeioAmbiente = await Category.create({ nome: 'Meio ambiente', descricao: 'Sustentabilidade e ecologia' });
  await Category.create({ nome: 'Saúde', descricao: 'Saúde e bem-estar' });

  await Article.create({
    titulo: 'Alunos do 3º ano constroem estação meteorológica com Arduino',
    resumo: 'Projeto de feira de ciências mede temperatura e umidade em tempo real.',
    conteudo: 'Texto completo da matéria sobre o projeto de feira de ciências...',
    tipo: 'noticia_escolar',
    categoryId: categoriaRobotica.id,
    tema: 'cientifico',
    palavrasChave: 'arduino, estação meteorológica, feira de ciências',
    status: 'publicado',
    autorId: aluno.id,
  });

  await Campaign.create({
    titulo: 'Kit de sensores para monitorar qualidade da água do rio local',
    descricao: 'Arrecadação para comprar sensores de pH e turbidez para o projeto de monitoramento ambiental da turma.',
    categoryId: categoriaMeioAmbiente.id,
    tema: 'cientifico',
    palavrasChave: 'água, sensores, monitoramento ambiental',
    metaFinanceira: 800.0,
    valorArrecadado: 150.0,
    status: 'ativa',
    autorId: aluno.id,
  });

  console.log('Dados de exemplo criados com sucesso.');
  console.log('Login professor: marina.alves@escola.edu.br / senha123');
  console.log('Login estudante: lucas.ferreira@escola.edu.br / senha123');
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
