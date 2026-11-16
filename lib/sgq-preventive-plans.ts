// Preventive maintenance groups transcribed from the controlled SGQ forms.
export const additionalPreventivePlans = {
  PRE_1: [
    {
      key: "daily",
      label: "Diária",
      pages: [
        1
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Produção",
      points: [
        "Limpar o chão junto à porta carga/descarga devido à condensação de água aquando do uso da câmara."
      ]
    },
    {
      key: "quarterly",
      label: "Trimestral",
      pages: [
        2,
        19
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Manutenção",
      points: [
        "Verificar o switch mecânico das portas.",
        "Verificar a abertura e o fecho da porta de carga e descarga da câmara de pré-condicionamento e, se necessário, ajustar."
      ]
    },
    {
      key: "annual",
      label: "Anual",
      pages: [
        3
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Manutenção",
      points: [
        "Verificar e ajustar as calibrações (se necessário) dos sensores de temperatura (TT) e de humidade relativa (RHT)."
      ]
    }
  ],
  PRE_2: [
    {
      key: "daily",
      label: "Diária",
      pages: [
        4
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Produção",
      points: [
        "Limpar o chão junto à porta carga/descarga devido à condensação de água aquando do uso da câmara."
      ]
    },
    {
      key: "quarterly",
      label: "Trimestral",
      pages: [
        5,
        20
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Manutenção",
      points: [
        "Verificar o switch mecânico das portas.",
        "Verificar a abertura e o fecho da porta de carga e descarga da câmara de pré-condicionamento e, se necessário, ajustar."
      ]
    },
    {
      key: "annual",
      label: "Anual",
      pages: [
        6
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Manutenção",
      points: [
        "Verificar e ajustar as calibrações (se necessário) dos sensores de temperatura (TT) e de humidade relativa (RHT)."
      ]
    }
  ],
  EST_1: [
    {
      key: "daily",
      label: "Diária",
      pages: [
        7,
        8
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Produção",
      points: [
        "Verificar pressão do circuito de aquecimento do vaporizador (0,5 bar frio, 2,5 bar quente).",
        "Verificar pressão do circuito de aquecimento da câmara (0,5 bar frio, 2,5 bar quente).",
        "Verificar fornecimento de ar comprimido (4,5–8 bar).",
        "Verificar fornecimento de azoto para as juntas (1,5–2,5 bar).",
        "Verificar fornecimento de azoto para o vaporizador (PLS ON).",
        "Verificar qualidade do azoto (>95%).",
        "Confirmar uma garrafa cheia de EO (Carbotil).",
        "Esvaziar os condensados da tubagem da extração do scrubber após término do ciclo de esterilização."
      ]
    },
    {
      key: "weekly",
      label: "Semanal",
      pages: [
        9,
        10,
        11,
        12,
        13
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Produção",
      points: [
        "Verificar as juntas insufláveis: não danificadas, bem colocadas dentro da sua ranhura e coladas.",
        "Polimerização de EO: defletores de injeção, cartucho de bomba de vácuo, entre outros.",
        "Verificar potencial dano em qualquer equipamento.",
        "Verificar o nível do scrubber.",
        "Limpar o chão da unidade de esterilização."
      ]
    },
    {
      key: "monthly",
      label: "Mensal",
      pages: [
        14,
        15
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Produção",
      points: [
        "Verificar possíveis fugas pneumáticas (cabines pneumáticas da câmara e do vaporizador).",
        "Verificar o UPS a trabalhar corretamente a 230VAC e 24VCC.",
        "Limpar os motores, ventiladores, trilhos das portas, etc. Para os equipamentos fora das câmaras: limpeza com ar comprimido por cima de cada equipamento. Para os equipamentos dentro das câmaras: limpeza com o aspirador para evitar acumulação de sujidade nos elementos lubrificados.",
        "Limpar grelhas existentes dentro da câmara de esterilização com água quente.",
        "Verificar o nível do sal do tanque e, se necessário acrescentar (no máximo 2 saco de 25 kg)."
      ]
    },
    {
      key: "bimonthly",
      label: "Bimestral",
      pages: [
        16
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Manutenção",
      points: [
        "Substituir filtro 065201 do gerador de vapor."
      ]
    },
    {
      key: "semiannual",
      label: "Semestral",
      pages: [
        21,
        22
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Manutenção",
      points: [
        "Medir a intensidade em equipamentos de alta potência, nomeadamente dos motores e das resistências elétricas (EHxxx): a intensidade deverá ser a correta e uniforme.",
        "Limpar os filtros de entrada de EO (utilizar EPI’s).",
        "Limpar a linha de injeção de EO (com kit de manutenção da MDS; utilizar EPI’s).",
        "Limpar as saídas automáticas de ar.",
        "Esvaziar o scrubber e repor água + ácido sulfúrico após 187 ciclos realizados.",
        "Realizar teste de vácuo: taxas de vácuo e injeções + teste de fugas longo.",
        "Medir o fluxo de ar na recirculação e na extração.",
        "Substituir o filtro 065101 do gerador de vapor."
      ]
    },
    {
      key: "annual",
      label: "Anual",
      pages: [
        23,
        24,
        25
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Manutenção",
      points: [
        "Verificar se a válvula de segurança está dentro da validade e sem fugas.",
        "Verificar a estanquidade dos terminais de alta tensão.",
        "Substituir o filtro de entrada de ar.",
        "Substituir o pré-filtro de entrada de ar.",
        "Substituir o filtro de entrada de azoto na câmara de esterilização.",
        "Substituir os purgadores de vapor.",
        "Substituir os selos mecânicos da recirculação.",
        "Substituir as escovas de carbono da recirculação.",
        "Substituir os purgadores manuais da camisa.",
        "Substituir a junta do gerador de vapor.",
        "Limpar os filtros de entrada/saída dos quadros elétricos.",
        "Substituir os purgadores automáticos de ar nos circuitos de água.",
        "Descalcificar o gerador de vapor.",
        "Verificar e ajustar as calibrações (se necessário) dos sensores de pressão (PT), de temperatura (TT), de humidade relativa (RHT) e de peso (WT)."
      ]
    },
    {
      key: "biennial",
      label: "De dois em dois anos",
      pages: [
        26
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Manutenção",
      points: [
        "Substituir os disjuntores elétricos (tipo LUB32)."
      ]
    },
    {
      key: "conveyor-monthly",
      label: "Transportador · Mensal",
      pages: [
        35
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Produção",
      points: [
        "Verificar a sujidade nos rollers e, se necessário, limpar (dentro e fora das câmaras)."
      ]
    },
    {
      key: "conveyor-quarterly",
      label: "Transportador · Trimestral",
      pages: [
        36
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Manutenção",
      points: [
        "Lubrificar as correntes."
      ]
    },
    {
      key: "conveyor-semiannual",
      label: "Transportador · Semestral",
      pages: [
        37
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Manutenção",
      points: [
        "Apertar os parafusos dos conveyors."
      ]
    }
  ],
  BVC_2: [
    {
      key: "daily",
      label: "Diária",
      pages: [
        27
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Produção",
      points: [
        "Esvaziar recipientes de condensado das bombas de vácuo.",
        "Verificar o nível de óleo das bombas de vácuo e acrescentar, se necessário."
      ]
    },
    {
      key: "annual",
      label: "Anual",
      pages: [
        28
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Manutenção",
      points: [
        "Substituir o óleo da bomba de vácuo.",
        "Substituir o filtro de entrada de ar da bomba de vácuo.",
        "Substituir o filtro de exaustão da bomba de vácuo."
      ]
    }
  ],
  BVC_3: [
    {
      key: "daily",
      label: "Diária",
      pages: [
        29
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Produção",
      points: [
        "Esvaziar recipientes de condensado das bombas de vácuo.",
        "Verificar o nível de óleo das bombas de vácuo e acrescentar, se necessário."
      ]
    },
    {
      key: "annual",
      label: "Anual",
      pages: [
        30
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Manutenção",
      points: [
        "Substituir o óleo da bomba de vácuo.",
        "Substituir o filtro de entrada de ar da bomba de vácuo.",
        "Substituir o filtro de exaustão da bomba de vácuo."
      ]
    }
  ],
  ARE_1: [
    {
      key: "quarterly",
      label: "Trimestral",
      pages: [
        17,
        31
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Manutenção",
      points: [
        "Verificar o switch mecânico das portas.",
        "Verificar a abertura e o fecho da porta de carga e descarga da câmara de arejamento e, se necessário, ajustar."
      ]
    },
    {
      key: "annual",
      label: "Anual",
      pages: [
        32
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Manutenção",
      points: [
        "Verificar e ajustar as calibrações (se necessário) dos sensores de temperatura (TT)."
      ]
    }
  ],
  ARE_2: [
    {
      key: "quarterly",
      label: "Trimestral",
      pages: [
        18,
        33
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Manutenção",
      points: [
        "Verificar o switch mecânico das portas.",
        "Verificar a abertura e o fecho da porta de carga e descarga da câmara de arejamento e, se necessário, ajustar."
      ]
    },
    {
      key: "annual",
      label: "Anual",
      pages: [
        34
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Manutenção",
      points: [
        "Verificar e ajustar as calibrações (se necessário) dos sensores de temperatura (TT)."
      ]
    }
  ],
  GER_1: [
    {
      key: "daily",
      label: "Diária",
      pages: [
        38
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Manutenção",
      points: [
        "Verificar fugas ou ar nas ligações instaladas dentro e à volta da unidade."
      ]
    },
    {
      key: "weekly",
      label: "Semanal",
      pages: [
        39
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Manutenção",
      points: [
        "Limpar o equipamento com ar comprimido."
      ]
    }
  ],
  SEC_2: [
    {
      key: "weekly",
      label: "Semanal",
      pages: [
        40
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Manutenção",
      points: [
        "Limpar o equipamento com ar comprimido."
      ]
    }
  ],
  CHI_2: [
    {
      key: "daily",
      label: "Diária",
      pages: [
        41
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Produção",
      points: [
        "Verificar se há fuga de líquido (presente ou não presente).",
        "Verificar o nível do líquido (dentro ou fora do limite).",
        "Verificar se há sujidade na grelha de ventilação.",
        "Verificar que não há ruído, cheiro, fumo, vibração ou alarme ativo."
      ]
    }
  ],
  COMP_2: [
    {
      key: "weekly",
      label: "Semanal",
      pages: [
        42
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Manutenção",
      points: [
        "Limpar o equipamento com ar comprimido."
      ]
    },
    {
      key: "semiannual",
      label: "Semestral",
      pages: [
        43
      ],
      documentCode: "IMPSUP0820.02",
      primary: "Manutenção",
      points: [
        "Verificar a existência de fugas de ar."
      ]
    }
  ],
  FFS_1: [
    {
      key: "daily",
      label: "Diária",
      pages: [
        1
      ],
      documentCode: "IMPSUP0821.02",
      primary: "Produção",
      points: [
        "Inspeção visual das correntes de transporte (resíduos ou produto).",
        "Inspeção visual da placa de soldadura e limpeza se necessário.",
        "Inspeção visual do codificador (limpeza e estado da superfície da roda, desgaste e tensão da correia).",
        "Verificar o fornecimento de ar comprimido (6 a 8 bar).",
        "Verificar o funcionamento do sistema de arrefecimento e aquecimento.",
        "Verificar se as zonas dos operadores estão limpas e livres para circulação."
      ]
    },
    {
      key: "weekly",
      label: "Semanal",
      pages: [
        2,
        3
      ],
      documentCode: "IMPSUP0821.02",
      primary: "Produção",
      points: [
        "Controlo do equipamento de segurança - botão de paragem de emergência (iniciar a máquina em automático, pressionar botão e verificar que a máquina para automaticamente).",
        "Controlo do equipamento de segurança – circuito de emergência (iniciar a máquina em automático, levantar cárter de proteção e verificar que a máquina para automaticamente)."
      ]
    },
    {
      key: "monthly",
      label: "Mensal",
      pages: [
        4,
        5
      ],
      documentCode: "IMPSUP0821.02",
      primary: "Manutenção",
      points: [
        "Descarga da condensação do sistema pneumático (controlar o grupo filtro -regulador da alimentação pneumática).",
        "Controlo da tensão das correntes de translação do codificador.",
        "Controlo do revestimento de teflon das placas (verificar o grau de desgaste de pré - aquecimento da placa de aquecimento de formação e da placa de soldadura, verificar a camada de teflon é uniforme e se a placa não apresenta abrasões)."
      ]
    },
    {
      key: "quarterly",
      label: "Trimestral",
      pages: [
        6
      ],
      documentCode: "IMPSUP0821.02",
      primary: "Manutenção",
      points: [
        "Verificar os grupos de elevação (controlo dos cilindros dos grupos manualmente para verificar o grau de desgaste e regulação do amortecedor da posição final, se necessário).",
        "Verificar o desgaste das lâminas de corte longitudinal (grau de desgaste das lâminas e contra lâminas, caso necessário fazer a substituição integral das lâminas do grupo).",
        "Verificar o desgaste das ferramentas de corte transversal (ferramentas, lâmina de corte e/ou órgãos de contraste, se necessário fazer operações de retificação)."
      ]
    },
    {
      key: "semiannual",
      label: "Semestral",
      pages: [
        7
      ],
      documentCode: "IMPSUP0821.02",
      primary: "Manutenção",
      points: [
        "Verificar o grau de desgaste nas correias do transportador na saída.",
        "Verificar a limpeza das válvulas de vácuo (principalmente na estação de selagem e na presença de um produto particularmente poeirento)."
      ]
    },
    {
      key: "annual",
      label: "Anual",
      pages: [
        8
      ],
      documentCode: "IMPSUP0821.02",
      primary: "Manutenção",
      points: [
        "Inspeção visual do quadro de distribuição (afrouxamento de fios, bornes e peças de qualquer tipo).",
        "Verificar limpeza da ventoinha de arrefecimento do controlo de sistema elétrico.",
        "Limpeza do filtro do sistema de elétrico (ar comprimido) e, se necessário substituir.",
        "Inspecionar os contactos dos relés do sistema elétrico.",
        "Verificar o funcionamento das lâmpadas de controlo no quadro de comando e o regular funcionamento do motor dos termo-controlos."
      ]
    },
    {
      key: "100-hours",
      label: "A cada 100 horas",
      pages: [
        9
      ],
      documentCode: "IMPSUP0821.02",
      primary: "Manutenção",
      intervalHours: 100,
      points: [
        "Aplicar graxa tipo “Nils Food 00” nas correntes de transporte (aplicação direta nas correntes da zona de entrada do filme)."
      ]
    },
    {
      key: "200-hours",
      label: "A cada 200 horas",
      pages: [
        10,
        11,
        12,
        13
      ],
      documentCode: "IMPSUP0821.02",
      primary: "Manutenção",
      intervalHours: 200,
      points: [
        "Aplicar graxa tipo “Nils Food 00” nos grupos de elevação com alavanca individual (aplicação nas colunas de elevação, alavancas, rolamentos de esfera e, se houver nos engraxadores).",
        "Aplicar graxa tipo “Nils Food 00” no grupo de elevação com lubrificação manual centralizada (aplicação nas colunas de elevação, alavancas e rolamentos de esfera).",
        "Aplicar graxa tipo “Nils Food 00” na matriz de corte (aplicação nas alavancas e rolamentos).",
        "Aplicar graxa tipo “Nils Food 00” no corte integral (aplicação nas alavancas e rolamentos nas zonas de movimento)."
      ]
    },
    {
      key: "300-hours",
      label: "A cada 300 horas",
      pages: [
        14
      ],
      documentCode: "IMPSUP0821.02",
      primary: "Manutenção",
      intervalHours: 300,
      points: [
        "Aplicar graxa tipo “Nils Food 00” no corte transversal da guilhotina (guias laterais em polietileno)."
      ]
    },
    {
      key: "chain-hours",
      label: "200 h iniciais, depois a cada 500 h",
      pages: [
        15
      ],
      documentCode: "IMPSUP0821.02",
      primary: "Manutenção",
      intervalHours: 500,
      firstHours: 200,
      points: [
        "Controlar a tensão das correntes de translação (primeiro controlo ser feito às 200h devido a uma acomodação normal dos elos da corrente)."
      ]
    }
  ],
  BVC_4: [
    {
      key: "weekly",
      label: "Semanal",
      pages: [
        16
      ],
      documentCode: "IMPSUP0821.02",
      primary: "Manutenção",
      points: [
        "Verificação do nível de óleo da bomba de vácuo."
      ]
    },
    {
      key: "annual",
      label: "Anual",
      pages: [
        17
      ],
      documentCode: "IMPSUP0821.02",
      primary: "Manutenção",
      points: [
        "Substituição do óleo da bomba de vácuo.",
        "Substituição do filtro de entrada de ar da bomba de vácuo.",
        "Substituição do filtro de exaustão da bomba de vácuo."
      ]
    }
  ],
  BVC_5: [
    {
      key: "weekly",
      label: "Semanal",
      pages: [
        18
      ],
      documentCode: "IMPSUP0821.02",
      primary: "Manutenção",
      points: [
        "Verificação do nível de óleo da bomba de vácuo."
      ]
    },
    {
      key: "annual",
      label: "Anual",
      pages: [
        19
      ],
      documentCode: "IMPSUP0821.02",
      primary: "Manutenção",
      points: [
        "Substituição do óleo da bomba de vácuo.",
        "Substituição do filtro de entrada de ar da bomba de vácuo.",
        "Substituição do filtro de exaustão da bomba de vácuo."
      ]
    }
  ],
  CHI_3: [
    {
      key: "monthly",
      label: "Mensal",
      pages: [
        20
      ],
      documentCode: "IMPSUP0821.02",
      primary: "Manutenção",
      points: [
        "Limpeza das grelhas de ventilação.",
        "Limpeza do filtro de ar, se necessário, substituir (se existir)."
      ]
    },
    {
      key: "quarterly",
      label: "Trimestral",
      pages: [
        21
      ],
      documentCode: "IMPSUP0821.02",
      primary: "Manutenção",
      points: [
        "Verificação da tensão da fonte de energia.",
        "Verificar o nível de glicol no tanque, se necessário acrescentar até ao máximo. (Diluição a 30% em água destilada)",
        "Verificação de vazamento de água na bomba."
      ]
    },
    {
      key: "annual",
      label: "Anual",
      pages: [
        22
      ],
      documentCode: "IMPSUP0821.02",
      primary: "Manutenção",
      points: [
        "Substituição da mistura de água glicol (70% água + 30% glicol)."
      ]
    }
  ],
  MLA_1: [
    {
      key: "daily",
      label: "Diária",
      pages: [
        1
      ],
      documentCode: "IMPSUP0834.02",
      primary: "Produção",
      points: [
        "Verificar o fornecimento de ar comprimido: 6-7bar."
      ]
    },
    {
      key: "weekly",
      label: "Semanal",
      pages: [
        2
      ],
      documentCode: "IMPSUP0834.02",
      primary: "Produção",
      points: [
        "Verificar potencial dano em qualquer equipamento."
      ]
    },
    {
      key: "monthly",
      label: "Mensal",
      pages: [
        3
      ],
      documentCode: "IMPSUP0834.02",
      primary: "Manutenção",
      points: [
        "Verificar possíveis fugas pneumáticas e esvaziar o separador de condensados."
      ]
    },
    {
      key: "annual",
      label: "Anual",
      pages: [
        4,
        5
      ],
      documentCode: "IMPSUP0834.02",
      primary: "Produção",
      points: [
        "Inspecionar danos visíveis na parte elétrica (fios partidos, peças partidas ou desgaste excessivo).",
        "Verificar o isolamento elétrico se encontra em boas condições.",
        "Verificar se as conexões de aterramento estão em bom estado.",
        "Verificar as condições operacionais.",
        "Efetuar teste de medição de corrente e tensão.",
        "Limpar os filtros de entrada/saída dos quadros elétricos."
      ]
    }
  ],
  HOT_1: [
    {
      key: "daily",
      label: "Diária",
      pages: [
        6
      ],
      documentCode: "IMPSUP0834.02",
      primary: "Produção",
      points: [
        "Verificar danos externos no Hot Melter.",
        "Verificar se há objetos estranhos ou contaminação no tanque antes de o encher.",
        "Verificar fugas, presença de todas as peças e ajuste das ligações de encaixe e do parafuso da barra de espalhamento de cola.",
        "Remover restos de material de fusão e sujidade da barra de espalhamento.",
        "Inspecionar visualmente a mangueira para detetar fugas ou torções."
      ]
    },
    {
      key: "weekly",
      label: "Semanal",
      pages: [
        7,
        8
      ],
      documentCode: "IMPSUP0834.02",
      primary: "Produção",
      points: [
        "Verificar a existência de fugas na barra de espalhamento da cola.",
        "Efetuar purga na barra de espalhamento todas as semanas antes do início de produção e, se necessário, efetuar mais que uma vez na semana."
      ]
    },
    {
      key: "fortnightly",
      label: "A cada duas semanas",
      pages: [
        9
      ],
      documentCode: "IMPSUP0834.02",
      primary: "Manutenção",
      points: [
        "Verificar a existência de contaminação nos cartuchos de filtragem e, se necessário substituir."
      ]
    },
    {
      key: "monthly",
      label: "Mensal",
      pages: [
        10
      ],
      documentCode: "IMPSUP0834.02",
      primary: "Manutenção",
      points: [
        "Fixar o disco da caixa de empanque (acoplador) da bomba de engrenagem.",
        "Verificar o estado da proteção contra sobreaquecimento.",
        "Apertar as porcas de união dos acessórios da mangueira."
      ]
    },
    {
      key: "500-hours",
      label: "A cada 500 horas",
      pages: [
        11,
        12
      ],
      documentCode: "IMPSUP0834.02",
      primary: "Manutenção",
      intervalHours: 500,
      points: [
        "Verificar o aperto dos parafusos de fixação. (Barra de espalhamento)",
        "Verificar a existência de fugas de cola na bomba de engrenagem."
      ]
    },
    {
      key: "annual",
      label: "Anual",
      pages: [
        13
      ],
      documentCode: "IMPSUP0834.02",
      primary: "Produção",
      points: [
        "Inspecionar danos visíveis na parte elétrica (fios partidos, peças partidas ou desgaste excessivo).",
        "Verificar o isolamento elétrico se encontra em boas condições.",
        "Verificar se as conexões de aterramento estão em bom estado.",
        "Verificar as condições operacionais.",
        "Efetuar teste de medição de corrente e tensão."
      ]
    }
  ],
  ASP_1: [
    {
      key: "monthly",
      label: "Mensal",
      pages: [
        14
      ],
      documentCode: "IMPSUP0834.02",
      primary: "Manutenção",
      points: [
        "Limpar o filtro."
      ]
    },
    {
      key: "annual",
      label: "Anual",
      pages: [
        15
      ],
      documentCode: "IMPSUP0834.02",
      primary: "Manutenção",
      points: [
        "Substituir o filtro.",
        "Apertar as ligações elétricas (conforme indicado no manual)."
      ]
    },
    {
      key: "biennial",
      label: "De dois em dois anos",
      pages: [
        16
      ],
      documentCode: "IMPSUP0834.02",
      primary: "Manutenção",
      points: [
        "Retificar as lâminas do granulador."
      ]
    }
  ],
  MAS_3: [
    {
      key: "daily",
      label: "Diária",
      pages: [
        1
      ],
      documentCode: "IMPSUP0839.00",
      primary: "Produção",
      points: [
        "Verificar que a pressão de ar de entrada no equipamento se encontra a 6.2 ± 0.1 bar."
      ]
    },
    {
      key: "monthly",
      label: "Mensal",
      pages: [
        2,
        3
      ],
      documentCode: "IMPSUP0839.00",
      primary: "Manutenção",
      points: [
        "Verificar o funcionamento dos dispositivos de emergência e segurança do equipamento.",
        "Limpar o filtro de ar comprimido.",
        "Limpar a sujidade do tanque do filtro de ar comprimido.",
        "Verificar inexistência de defeitos nas peças de soldadura.",
        "Verificar o correto posicionamento do fio de vedação.",
        "Verificar o correto posicionamento da borracha de armação.",
        "Verificar a inexistência de degradação dos parafusos e dos pernos de plástico."
      ]
    }
  ]
} as const;
