# 1. Campos de portfólio como catálogo global fixo em código

Date: 2026-06-15
Status: Accepted

## Context

Os campos de portfólio do projeto (Financeiro, Disciplinas, PPCI/GÁS, ELE/HID APROV, ELE/HID EXEC e os derivados "n" e "Área projetada") foram modelados como campos custom do Asana, por projeto: `AsanaCustomField` (definição) → `ProjectCustomFieldSetting` (opt-in por projeto) → `ProjectCustomFieldValue` (valor), casados por label normalizado.

Consequência: projetos **criados no Mika** divergem dos **importados do Asana**. Ex.: "Área projetada" só era persistida em `update` quando área/disciplinas mudavam, e o read-DTO só reescrevia linhas já existentes — então projeto novo do Mika mostrava `—`. O formulário de edição apenas listava definições de campo (read-only, inútil).

Isso também contradiz a decisão travada em `UIUX.md` §17: "campos custom configuráveis por projeto — campos são fixos em código".

## Decision

- Os campos de portfólio passam a ser um **catálogo global fixo, definido em código** (chaveado por `mikaKey` estável), aplicável a **todo** projeto, independente da origem. Opções de enum e cores também ficam no código (autoradas a partir do que existe hoje no banco, para manter paridade).
- Os **valores** continuam em `ProjectCustomFieldValue` (sem reset de banco), reconciliados ao catálogo por chave estável. A tabela `ProjectCustomFieldSetting` é removida (deixa de existir gating por projeto).
- Os campos **derivados** ("n" e "Área projetada") são **calculados em tempo de leitura** no DTO, nunca persistidos.
- A model `Project` mantém Construtora/Plataforma/Área como colunas nativas; definições custom duplicadas dessas são ignoradas para projetos.
- "Número de Projetos" é renomeado para **Disciplinas** (label de exibição), pois sempre representou o conjunto de disciplinas, não uma contagem de projetos.

## Consequences

- Projetos do Mika e do Asana ficam idênticos em comportamento e cálculo.
- Migração de dados (sem reset): normalizar `mikaKey`/label das definições de portfólio, canonicalizar `customFieldGid` dos valores existentes, apagar linhas derivadas persistidas, pré-criar linhas vazias por projeto×campo, e dropar `ProjectCustomFieldSetting` via migration Prisma.
- O catálogo deixa de depender do import do Asana; instalações novas têm os mesmos campos via seed/código.
- Reversão é cara (envolve schema + dados), daí este ADR.
