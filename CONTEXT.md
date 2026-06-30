# CONTEXT.md — MK Projetos (Mika)

> Glossário do domínio. Apenas linguagem ubíqua e definições — sem detalhes de implementação.
> Complementar a `AGENTS.md` (arquitetura/stack) e `UIUX.md` (design).

## Glossário

### Projeto
Empreendimento de engenharia. Pode ser **importado do Asana** ou **criado no Mika**. Ambas as origens são cidadãos de primeira classe: têm exatamente os mesmos campos e comportamento. A origem não muda quais campos existem nem como são calculados.

### Campos de portfólio (Portfolio fields)
Conjunto fixo de campos a nível de projeto, definidos em código (não configuráveis por projeto). Aparecem como colunas no portfólio e no formulário de edição. Aplicam-se a **todo** projeto, independente da origem.

Catálogo atual:
- **Financeiro** (multi): parcelas financeiras do projeto.
- **Disciplinas** (multi): conjunto de disciplinas de engenharia do projeto (Elétrico, Telecom, Hid, PPCI, SPDA, Gás, Clima, ...). *Internamente já foi rotulado "Número de Projetos" — termo descontinuado.*
- **PPCI / GÁS** (enum): status de aprovação.
- **ELE APROV.**, **HID APROV.** (enum): status de aprovação elétrico/hidráulico.
- **ELE EXEC.**, **HID EXEC.** (enum): status de execução elétrico/hidráulico.

Campos derivados (somente leitura, calculados — nunca persistidos como verdade):
- **n (contagem de disciplinas)**: número de disciplinas selecionadas em **Disciplinas**. Não é uma coluna visível; é apenas o multiplicador.
- **Área projetada**: `Área (m²) × n`. Vazia quando Área é vazia.

### Campos nativos do Projeto
Atributos próprios da model Project, **não** são campos de portfólio: **Nome**, **Construtora** (`builder`), **Plataforma** (`platform`), **Área** (`areaM2`), Status, Datas. Definições de custom field "Construtora"/"Plataforma" importadas do Asana são ignoradas para projetos (duplicatas).

### Campos fixos de tarefa
Conceito análogo, porém a nível de **Tarefa** (ver `UIUX.md` §4). Distinto dos campos de portfólio do projeto.

### Prazo Máximo
Data limite externa prometida ao cliente para uma **Tarefa**. É uma informação de coordenação e não deve ser exposta a projetistas ou estagiários.

### Entrega
Data interna estimada para conclusão de uma **Tarefa**. Nunca deve ser posterior ao **Prazo Máximo** quando esse limite existir.

### Mudança de data
Alteração do Início ou da **Entrega** de uma **Tarefa**. Pode recalcular o status operacional de uma tarefa aberta, mas não envia tarefa para revisão.

### Indicadores
Painel gerencial de métricas agregadas para coordenação. Consolida tarefas, prazos, entregas, equipe operacional e áreas de projeto em gráficos e contadores. Indicadores de tarefas usam período operacional; indicadores de projetos são leitura de carteira geral ou por ano de origem do projeto. Não é o mesmo que **Relatório semanal**, que é um registro individual preenchido pelo usuário sobre a semana.
_Evitar_: relatórios, dashboard configurável

### Anotação
Documento colaborativo vinculado a um **Projeto**, identificado por título e composto por conteúdo textual ou anexos. É diferente da descrição do projeto e dos comentários de tarefas.
_Evitar_: nota do projeto, comentário do projeto

### Ata de Reunião
Registro colaborativo de uma reunião vinculada a um **Projeto**, com data, participantes e conteúdo textual ou anexos. Participantes podem ser usuários do Mika ou pessoas externas.
_Evitar_: anotação de reunião, comentário de reunião

### Anexo
Arquivo associado a um comentário de tarefa, revisão, anotação ou ata de reunião. Seu nome é o nome apresentado ao usuário e utilizado no download, independentemente do identificador físico usado para armazenar o arquivo.

### Relatório mensal de concluídas
Documento gerencial mensal que lista tarefas concluídas no período, agrupadas por responsável, para apoiar fechamento e complemento manual pela coordenação. É diferente do **Relatório semanal**, que é um registro individual preenchido pelo usuário sobre sua semana.
_Evitar_: relatório semanal mensal, template mensal genérico

---
*MK Engenharia · Balneário Camboriú/SC*
