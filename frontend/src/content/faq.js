// Perguntas frequentes estáticas agrupadas por assunto.
// Contém apenas fatos verificados no código e na documentação do portal.

export const FAQ_GRUPOS = [
  {
    id: 'geral',
    titulo: 'Geral',
    perguntas: [
      {
        id: 'o-que-e-ifconnect',
        pergunta: 'O que é o IFConnect?',
        resposta:
          'O IFConnect é um portal aberto de divulgação científica, educacional, cultural e comunitária, que também oferece uma vitrine de projetos em busca de apoio.',
      },
      {
        id: 'para-quem-e',
        pergunta: 'Para quem o portal é destinado?',
        resposta:
          'O portal é voltado para estudantes, jovens jornalistas, professores e membros da comunidade interessados em publicar conteúdos, acompanhar notícias científicas e apoiar projetos.',
      },
      {
        id: 'gratuito-codigo-aberto',
        pergunta: 'O IFConnect é gratuito e de código aberto?',
        resposta:
          'Sim. Trata-se de um projeto acadêmico de código aberto, com acesso gratuito e sem cobrança de assinatura ou paywall.',
      },
    ],
  },
  {
    id: 'conta',
    titulo: 'Conta e acesso',
    perguntas: [
      {
        id: 'quem-pode-criar-conta',
        pergunta: 'Quem pode criar conta e quais perfis existem?',
        resposta:
          'Qualquer pessoa pode se cadastrar escolhendo entre os perfis Estudante, Jovem jornalista ou Membro da comunidade. Contas de professor moderador não são criadas por autocadastro público.',
      },
      {
        id: 'precisa-conta-para-ler',
        pergunta: 'Preciso de conta para ler ou para publicar e apoiar?',
        resposta:
          'Não é preciso ter conta para ler as publicações e visualizar os projetos da vitrine científica. Já para enviar publicações, cadastrar projetos, comentar ou registrar apoio a um projeto, é necessário entrar na sua conta.',
      },
    ],
  },
  {
    id: 'publicacoes',
    titulo: 'Publicações',
    perguntas: [
      {
        id: 'por-que-nao-aparece',
        pergunta: 'Por que minha publicação ainda não aparece na página inicial?',
        resposta:
          'Toda publicação enviada passa por análise antes de ficar visível para o público. Você pode acompanhar a situação do seu envio acessando a seção Minhas publicações no seu Perfil.',
      },
      {
        id: 'posso-editar-publicacao',
        pergunta: 'Posso editar uma publicação depois de enviá-la?',
        resposta:
          'Apenas o próprio autor pode editar uma publicação, e somente enquanto ela ainda não tiver sido aprovada (em revisão ou recusada). Ao editar uma publicação recusada, ela retorna automaticamente para a fila de revisão. Publicações já aprovadas não podem mais ser alteradas pelo autor, exceto no caso de professores moderadores editando suas próprias publicações.',
      },
    ],
  },
  {
    id: 'projetos',
    titulo: 'Projetos e vitrine científica',
    perguntas: [
      {
        id: 'como-funciona-apoio',
        pergunta: 'Como funciona o apoio aos projetos da vitrine?',
        resposta:
          'Ao confirmar um apoio em um projeto ativo, o valor e a mensagem opcional são registrados diretamente na plataforma e somados ao total arrecadado da campanha. Não há gateway de pagamento integrado nem cobrança financeira online no momento.',
      },
    ],
  },
  {
    id: 'assistente-ia',
    titulo: 'Assistente de IA',
    perguntas: [
      {
        id: 'o-que-faz-assistente',
        pergunta: 'O que o Assistente de IA faz?',
        resposta:
          'O assistente ajuda a buscar publicações e projetos, explica como usar o portal e pode resumir a publicação ou o projeto que estiver aberto na sua tela, usando apenas conteúdo público.',
      },
      {
        id: 'limitacoes-assistente',
        pergunta: 'Quais são as limitações e cuidados ao usar o assistente?',
        resposta:
          'O assistente utiliza um serviço externo de inteligência artificial e pode cometer erros — confira sempre as fontes citadas nas respostas. Ele não responde a perguntas fora do contexto do portal e, por segurança, você nunca deve enviar dados pessoais na conversa.',
      },
    ],
  },
];

// Pendente da equipe: política de privacidade, canal de denúncia, e-mail de suporte e prazos de análise (não definidos na documentação atual).
