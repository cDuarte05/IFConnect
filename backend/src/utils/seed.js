/**
 * Script de dados de exemplo — popula o banco local para demonstração e testes.
 * Todos os dados são FICTÍCIOS. Executar com: npm run seed
 * Atenção: recria o banco do zero (sequelize.sync({ force: true })) a cada execução.
 */
require('dotenv').config();
const { sequelize, User, Category, Article, Campaign, Donation } = require('../models');

const diasAtras = (n) => new Date(Date.now() - n * 86400000);
const emDias = (n) => new Date(Date.now() + n * 86400000);

async function seed() {
  await sequelize.sync({ force: true });

  // ---------- Usuários (senha de todos: senha123) ----------
  const senhaHash = User.hashSenha('senha123');
  const escola = 'Escola Estadual Jardim das Flores';
  const dadosUsuarios = {
    marina: { nome: 'Profa. Marina Alves', email: 'marina.alves@escola.edu.br', tipo: 'professor_moderador', instituicao: escola },
    rafael: { nome: 'Prof. Rafael Menezes', email: 'rafael.menezes@escola.edu.br', tipo: 'professor_moderador', instituicao: escola },
    lucas: { nome: 'Lucas Ferreira', email: 'lucas.ferreira@escola.edu.br', tipo: 'estudante', instituicao: escola },
    beatriz: { nome: 'Beatriz Santos', email: 'beatriz.santos@escola.edu.br', tipo: 'estudante', instituicao: escola },
    camila: { nome: 'Camila Rocha', email: 'camila.rocha@escola.edu.br', tipo: 'jornalista_jovem', instituicao: escola },
    paulo: { nome: 'Paulo Andrade', email: 'paulo.andrade@comunidade.org.br', tipo: 'membro_comunidade', instituicao: 'Associação de Moradores do Jardim' },
    helena: { nome: 'Helena Duarte', email: 'helena.duarte@comunidade.org.br', tipo: 'membro_comunidade', instituicao: null },
  };
  const u = {};
  for (const [chave, dados] of Object.entries(dadosUsuarios)) {
    u[chave] = await User.create({ ...dados, senhaHash });
  }

  // ---------- Categorias (qualquer professor_moderador pode criar novas via API) ----------
  const nomesCategorias = {
    robotica: ['Robótica', 'Projetos de robótica e automação'],
    ambiente: ['Meio ambiente', 'Sustentabilidade e ecologia'],
    saude: ['Saúde', 'Saúde e bem-estar'],
    astronomia: ['Astronomia', 'Astronomia e ciências espaciais'],
    educacao: ['Educação', 'Ensino, escola e aprendizagem'],
    tecnologia: ['Tecnologia', 'Computação, eletrônica e inovação'],
    cultura: ['Cultura', 'Arte, literatura e manifestações culturais'],
    comunidade: ['Comunidade', 'Iniciativas e vida comunitária'],
  };
  const c = {};
  for (const [chave, [nome, descricao]] of Object.entries(nomesCategorias)) {
    c[chave] = await Category.create({ nome, descricao });
  }

  // ---------- Publicações ----------
  const publicacoes = [
    // --- publicadas ---
    { autor: 'lucas', tipo: 'noticia_escolar', tema: 'cientifico', cat: 'robotica', dias: 20, views: 124,
      titulo: 'Alunos do 3º ano constroem estação meteorológica com Arduino',
      resumo: 'Projeto de feira de ciências mede temperatura e umidade em tempo real.',
      palavrasChave: 'arduino, estação meteorológica, feira de ciências',
      conteudo: 'Os alunos do 3º ano montaram uma estação meteorológica de baixo custo usando Arduino, sensores de temperatura e umidade e um pequeno painel que exibe os dados em tempo real.\n\nO projeto foi apresentado na feira de ciências da escola e agora os dados coletados são usados nas aulas de geografia e matemática.\n\nA turma pretende ampliar a estação com um sensor de chuva e publicar as medições semanalmente.' },
    { autor: 'camila', tipo: 'noticia_escolar', tema: 'educacional', cat: 'educacao', dias: 18, views: 98,
      titulo: 'Feira de Ciências reúne 40 projetos de estudantes',
      resumo: 'Evento abriu a escola para a comunidade e teve experimentos, maquetes e robôs.',
      palavrasChave: 'feira de ciências, estudantes, comunidade',
      conteudo: 'A feira de ciências deste ano reuniu quarenta projetos desenvolvidos por estudantes do ensino fundamental e médio. Familiares e moradores do bairro visitaram os estandes durante todo o sábado.\n\nEntre os destaques estiveram um filtro de água caseiro, uma maquete do sistema solar e um robô seguidor de linha.\n\nA organização já planeja a próxima edição com mais espaço para oficinas abertas ao público.' },
    { autor: 'beatriz', tipo: 'noticia_escolar', tema: 'comunitario', cat: 'ambiente', dias: 15, views: 76,
      titulo: 'Campanha de reciclagem reduz o lixo comum no pátio da escola',
      resumo: 'Coletores separados e uma gincana entre turmas mudaram os hábitos dos estudantes.',
      palavrasChave: 'reciclagem, sustentabilidade, escola',
      conteudo: 'Desde a instalação de coletores separados por tipo de material, a escola passou a descartar muito menos lixo comum. A gincana entre as turmas incentivou os estudantes a levar embalagens limpas para a coleta.\n\nO material reciclável é entregue a uma cooperativa do bairro, e a escola recebe um relatório mensal com as quantidades.' },
    { autor: 'camila', tipo: 'noticia_global', tema: 'cientifico', cat: 'astronomia', dias: 12, views: 143,
      titulo: 'Observatórios ampliam programas abertos de observação do céu',
      resumo: 'Instituições de várias regiões têm aberto sessões gratuitas para escolas e público geral.',
      palavrasChave: 'astronomia, observatório, divulgação científica',
      conteudo: 'Observatórios e universidades têm ampliado programas de observação aberta ao público, com sessões noturnas gratuitas e atividades voltadas a escolas.\n\nA iniciativa busca aproximar a astronomia do cotidiano e despertar o interesse de jovens pela ciência.\n\nProfessores interessados costumam poder agendar visitas guiadas diretamente com as instituições.' },
    { autor: 'camila', tipo: 'noticia_global', tema: 'comunitario', cat: 'ambiente', dias: 9, views: 61,
      titulo: 'Energia solar chega a mais escolas públicas',
      resumo: 'Painéis fotovoltaicos reduzem custos e viram material de aula sobre energia renovável.',
      palavrasChave: 'energia solar, escolas públicas, sustentabilidade',
      conteudo: 'Escolas públicas de diferentes cidades têm instalado painéis solares para reduzir a conta de energia. A economia é usada em manutenção e em materiais pedagógicos.\n\nAlém do ganho financeiro, os painéis são usados como laboratório vivo nas aulas de física e ciências.' },
    { autor: 'lucas', tipo: 'artigo_cientifico', tema: 'cientifico', cat: 'tecnologia', dias: 14, views: 88,
      titulo: 'Medição de umidade do solo com sensores de baixo custo',
      resumo: 'Comparamos leituras de um sensor capacitivo barato com medições manuais em canteiros.',
      palavrasChave: 'sensor, umidade do solo, arduino, agricultura',
      conteudo: 'Introdução: sensores capacitivos de umidade custam pouco e podem apoiar hortas escolares, mas sua precisão precisa ser verificada.\n\nMétodo: instalamos três sensores em canteiros diferentes e comparamos as leituras com amostras pesadas e secas em estufa durante duas semanas.\n\nResultados: as leituras acompanharam bem as variações de umidade, com maior erro em solo muito argiloso.\n\nConclusão: o sensor é adequado para uso didático, desde que calibrado para o tipo de solo.' },
    { autor: 'beatriz', tipo: 'artigo_cientifico', tema: 'educacional', cat: 'saude', dias: 11, views: 54,
      titulo: 'Hortas escolares e a alimentação dos estudantes',
      resumo: 'Revisão de experiências em que o cultivo de hortas aproximou os alunos de alimentos frescos.',
      palavrasChave: 'horta escolar, alimentação, educação',
      conteudo: 'Hortas escolares são usadas como ferramenta pedagógica e também como forma de aproximar os estudantes de alimentos frescos.\n\nRelatos de diferentes escolas indicam maior interesse por frutas e verduras quando os alunos participam do plantio e da colheita.\n\nSão necessários estudos com acompanhamento mais longo para medir mudanças duradouras de hábito.' },
    { autor: 'rafael', tipo: 'texto', tema: 'educacional', cat: 'tecnologia', dias: 10, views: 47,
      titulo: 'Por que aprender a programar na escola?',
      resumo: 'Programar desenvolve raciocínio lógico e criatividade, mesmo para quem não será programador.',
      palavrasChave: 'programação, educação, lógica',
      conteudo: 'Aprender a programar não é apenas preparar futuros desenvolvedores. É exercitar a lógica, dividir problemas grandes em partes pequenas e aprender a testar ideias.\n\nNa escola, a programação pode se conectar a matemática, arte e ciências, tornando as aulas mais práticas.' },
    { autor: 'paulo', tipo: 'texto', tema: 'cultural', cat: 'comunidade', dias: 8, views: 39,
      titulo: 'Memórias de um bairro que se reinventa',
      resumo: 'Um morador conta como a feira, a praça e a escola mudaram a vida do Jardim ao longo dos anos.',
      palavrasChave: 'bairro, memória, comunidade',
      conteudo: 'Moro no Jardim há mais de trinta anos e vi a praça ganhar bancos, a feira crescer e a escola se tornar ponto de encontro.\n\nHoje, quando passo pela rua e vejo os jovens ocupando os espaços com projetos, lembro que um bairro é feito das pessoas que se importam com ele.' },
    { autor: 'beatriz', tipo: 'poema', tema: 'cultural', cat: 'cultura', dias: 7, views: 33,
      titulo: 'Rio de Papel — poema sobre as águas da cidade',
      resumo: 'Poema autoral sobre o rio que atravessa o bairro.',
      palavrasChave: 'poema, rio, cidade',
      conteudo: 'Rio de Papel\n\nO rio que passa devagar\nlevando folhas e pressa,\nescreve no leito escuro\numa história que não cessa.\n\nSe eu dobrar o meu caderno\nem barquinho de esperança,\nele aprende a navegar\nnas águas da lembrança.' },
    { autor: 'camila', tipo: 'poema', tema: 'cultural', cat: 'cultura', dias: 5, views: 28,
      titulo: 'Constelações de Giz — poema sobre a sala de aula',
      resumo: 'Versos sobre o quadro-negro como um céu cheio de ideias.',
      palavrasChave: 'poema, sala de aula, estrelas',
      conteudo: 'Constelações de Giz\n\nNo quadro, o giz desenha\nestrelas de multiplicar,\ne cada aluno é um astro\nque aprendeu a se encontrar.\n\nQuando o sinal toca o dia,\nficam pó e claridade:\numa galáxia pequena\nde curiosidade.' },
    { autor: 'lucas', tipo: 'projeto', tema: 'comunitario', cat: 'ambiente', dias: 6, views: 52,
      titulo: 'Horta vertical com garrafas PET na escola',
      resumo: 'Relato do projeto que reaproveitou garrafas para cultivar temperos no pátio.',
      palavrasChave: 'horta vertical, PET, reaproveitamento',
      conteudo: 'A turma recolheu garrafas PET e montou uma horta vertical presa ao muro do pátio. Cultivamos manjericão, cebolinha e hortelã.\n\nO sistema de irrigação é manual e feito em revezamento. Os temperos colhidos são doados para a cozinha da escola.' },
    { autor: 'beatriz', tipo: 'projeto', tema: 'cientifico', cat: 'robotica', dias: 4, views: 41,
      titulo: 'Robô seguidor de linha da turma 2B',
      resumo: 'Como a turma montou e programou um robô que segue uma linha no chão.',
      palavrasChave: 'robô, seguidor de linha, arduino, sensores',
      conteudo: 'O robô usa dois sensores infravermelhos para detectar uma linha preta no chão e ajusta a velocidade dos motores para acompanhar o percurso.\n\nFizemos testes em pistas com curvas fechadas e ajustamos a velocidade até o robô completar o percurso sem sair da linha.' },
    // --- fila de moderação / outros status (para testar moderação e edição) ---
    { autor: 'lucas', tipo: 'noticia_escolar', tema: 'educacional', cat: 'educacao', dias: 2, status: 'em_revisao',
      titulo: 'Torneio de xadrez movimenta o intervalo das aulas',
      resumo: 'Estudantes de várias turmas disputam o primeiro torneio interno de xadrez.',
      palavrasChave: 'xadrez, torneio, escola',
      conteudo: 'O primeiro torneio interno de xadrez reuniu estudantes de diferentes turmas durante os intervalos. As partidas são rápidas e acompanhadas por colegas e professores.' },
    { autor: 'paulo', tipo: 'texto', tema: 'comunitario', cat: 'comunidade', dias: 2, status: 'em_revisao',
      titulo: 'Como a comunidade pode apoiar os projetos da escola',
      resumo: 'Sugestões práticas para moradores que querem colaborar com a escola do bairro.',
      palavrasChave: 'voluntariado, comunidade, escola',
      conteudo: 'Moradores podem contribuir com tempo, conhecimento ou materiais. Oficinas abertas, doação de livros e acompanhamento de feiras são formas simples de participar.' },
    { autor: 'beatriz', tipo: 'artigo_cientifico', tema: 'cientifico', cat: 'ambiente', dias: 1, status: 'em_revisao',
      titulo: 'Qualidade da água de nascentes próximas ao bairro',
      resumo: 'Resultados preliminares de medições de pH e turbidez em três nascentes.',
      palavrasChave: 'água, pH, turbidez, nascentes',
      conteudo: 'Coletamos amostras em três nascentes e medimos pH e turbidez com um kit escolar. Os resultados preliminares indicam variação entre os pontos, e novas coletas serão feitas na estação chuvosa.' },
    { autor: 'camila', tipo: 'noticia_global', tema: 'cientifico', cat: 'tecnologia', dias: 3, status: 'recusado',
      titulo: 'Texto recusado: notícia sem fontes identificadas',
      resumo: 'Publicação recusada na moderação para teste do fluxo de edição e reenvio.',
      palavrasChave: 'teste, recusado',
      conteudo: 'Conteúdo de exemplo recusado na moderação. Ao ser editado pelo autor, volta para revisão.' },
    { autor: 'lucas', tipo: 'poema', tema: 'cultural', cat: 'cultura', dias: 1, status: 'rascunho',
      titulo: 'Rascunho de poema sobre o recreio',
      resumo: 'Rascunho ainda não enviado para revisão.',
      palavrasChave: 'poema, rascunho',
      conteudo: 'Verso um, verso dois\n(ainda a ser escrito...)' },
  ];

  for (const p of publicacoes) {
    await Article.create({
      titulo: p.titulo, resumo: p.resumo, conteudo: p.conteudo, tipo: p.tipo, tema: p.tema,
      palavrasChave: p.palavrasChave, categoryId: c[p.cat].id, autorId: u[p.autor].id,
      status: p.status || 'publicado', visualizacoes: p.views || 0, createdAt: diasAtras(p.dias),
    });
  }

  // ---------- Projetos da vitrine (campanhas) + doações ----------
  const apoiadores = ['marina', 'rafael', 'lucas', 'beatriz', 'camila', 'paulo', 'helena'];
  const mensagens = [
    'Boa sorte com o projeto!', 'Parabéns pela iniciativa!', 'Ciência é para todos.',
    'Orgulho de ver a turma se dedicando.', null, 'Contem comigo!', null,
  ];

  const campanhas = [
    { autor: 'lucas', cat: 'ambiente', tema: 'cientifico', status: 'ativa', meta: 800, prazo: emDias(40), dias: 25,
      titulo: 'Kit de sensores para monitorar qualidade da água do rio local',
      descricao: 'Arrecadação para comprar sensores de pH e turbidez para o projeto de monitoramento ambiental da turma.',
      palavrasChave: 'água, sensores, monitoramento ambiental', doacoes: [50, 100] },
    { autor: 'beatriz', cat: 'astronomia', tema: 'educacional', status: 'ativa', meta: 3500, prazo: emDias(90), dias: 22,
      titulo: 'Telescópio para o clube de astronomia da escola',
      descricao: 'Queremos comprar um telescópio refrator e um tripé para sessões de observação abertas à comunidade, aos sábados à noite.',
      palavrasChave: 'telescópio, astronomia, observação do céu', doacoes: [200, 150, 300, 100, 250, 200] },
    { autor: 'paulo', cat: 'comunidade', tema: 'comunitario', status: 'ativa', meta: 2000, prazo: emDias(60), dias: 20,
      titulo: 'Biblioteca comunitária itinerante do Jardim',
      descricao: 'Um carrinho de livros que circula pelas ruas e pela praça, com empréstimo gratuito e rodas de leitura para crianças.',
      palavrasChave: 'biblioteca, leitura, comunidade', doacoes: [50, 80, 120, 50, 100] },
    { autor: 'beatriz', cat: 'robotica', tema: 'cientifico', status: 'financiada', meta: 1200, prazo: null, dias: 30,
      titulo: 'Kit de robótica educacional para a turma 2B',
      descricao: 'Compra de placas, motores e sensores para que toda a turma possa montar e programar robôs nas aulas práticas.',
      palavrasChave: 'robótica, arduino, kit, educação', doacoes: [300, 200, 250, 150, 200, 100] },
    { autor: 'lucas', cat: 'ambiente', tema: 'comunitario', status: 'financiada', meta: 600, prazo: null, dias: 28,
      titulo: 'Ampliação da horta vertical com irrigação por gotejamento',
      descricao: 'Mangueiras, temporizador e reservatório para automatizar a irrigação da horta vertical da escola.',
      palavrasChave: 'horta, irrigação, sustentabilidade', doacoes: [100, 150, 200, 200] },
    { autor: 'camila', cat: 'cultura', tema: 'cultural', status: 'ativa', meta: 1500, prazo: emDias(75), dias: 10,
      titulo: 'Oficina de música e cultura popular para jovens',
      descricao: 'Instrumentos de percussão e cordas para oficinas semanais abertas a estudantes e moradores do bairro.',
      palavrasChave: 'música, cultura popular, oficina', doacoes: [] },
    { autor: 'lucas', cat: 'tecnologia', tema: 'cientifico', status: 'ativa', meta: 900, prazo: emDias(15), dias: 18,
      titulo: 'Estufa automatizada com monitoramento de temperatura',
      descricao: 'Sensores, relés e um microcontrolador para manter a temperatura de uma pequena estufa escolar.',
      palavrasChave: 'estufa, automação, sensores', doacoes: [200, 300, 150, 220] },
    { autor: 'camila', cat: 'educacao', tema: 'educacional', status: 'ativa', meta: 700, prazo: emDias(50), dias: 12,
      titulo: 'Podcast científico feito por estudantes',
      descricao: 'Microfones, fones e um gravador para produzir episódios curtos sobre ciência e tecnologia, feitos pelos alunos.',
      palavrasChave: 'podcast, divulgação científica, estudantes', doacoes: [30, 50, 20] },
    { autor: 'beatriz', cat: 'tecnologia', tema: 'educacional', status: 'em_analise', meta: 2500, prazo: emDias(120), dias: 2,
      titulo: 'Impressora 3D para o laboratório da escola',
      descricao: 'Uma impressora 3D para produzir peças de projetos de robótica, maquetes e materiais didáticos.',
      palavrasChave: 'impressora 3D, laboratório, prototipagem', doacoes: [] },
    { autor: 'paulo', cat: 'saude', tema: 'comunitario', status: 'em_analise', meta: 1000, prazo: null, dias: 1,
      titulo: 'Oficinas de primeiros socorros para a comunidade',
      descricao: 'Bonecos de treino e materiais para oficinas abertas de primeiros socorros conduzidas por voluntários habilitados.',
      palavrasChave: 'primeiros socorros, saúde, comunidade', doacoes: [] },
    { autor: 'lucas', cat: 'educacao', tema: 'educacional', status: 'encerrada', meta: 500, prazo: null, dias: 90,
      titulo: 'Materiais para a feira de ciências do ano passado',
      descricao: 'Campanha encerrada: materiais de papelaria e experimentos para os estandes da edição anterior da feira.',
      palavrasChave: 'feira de ciências, materiais', doacoes: [40, 30, 50] },
  ];

  for (const camp of campanhas) {
    const total = camp.doacoes.reduce((soma, v) => soma + v, 0);
    const campanha = await Campaign.create({
      titulo: camp.titulo, descricao: camp.descricao, categoryId: c[camp.cat].id, tema: camp.tema,
      palavrasChave: camp.palavrasChave, metaFinanceira: camp.meta, valorArrecadado: total,
      prazoFinal: camp.prazo, status: camp.status, autorId: u[camp.autor].id, createdAt: diasAtras(camp.dias),
    });

    // Apoiadores diferentes do autor, em rodízio; algumas doações anônimas.
    const possiveis = apoiadores.filter((a) => a !== camp.autor);
    for (let i = 0; i < camp.doacoes.length; i += 1) {
      await Donation.create({
        valor: camp.doacoes[i],
        mensagemApoio: mensagens[i % mensagens.length],
        anonimo: i % 4 === 3,
        campaignId: campanha.id,
        apoiadorId: u[possiveis[i % possiveis.length]].id,
        createdAt: diasAtras(Math.max(1, camp.dias - 2 - i)),
      });
    }
  }

  console.log('Dados de exemplo criados com sucesso (todos fictícios).');
  console.log(`  ${Object.keys(u).length} usuários, ${Object.keys(c).length} categorias, ${publicacoes.length} publicações, ${campanhas.length} projetos.`);
  console.log('Logins (senha de todos: senha123):');
  for (const dados of Object.values(dadosUsuarios)) {
    console.log(`  ${dados.tipo.padEnd(20)} ${dados.email}`);
  }
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});