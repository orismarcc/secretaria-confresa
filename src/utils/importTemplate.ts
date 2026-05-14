/**
 * importTemplate.ts
 *
 * Defines the canonical column layout for the Atendimentos import template
 * and provides a function to generate and download the Excel file.
 */

import * as XLSX from 'xlsx';

// ─── Column definition ──────────────────────────────────────────────────────

export type ColType = 'text' | 'date' | 'number' | 'boolean_yn' | 'enum';

export interface ColDef {
  /** Header text as it appears in the Excel file */
  header: string;
  /** Internal field name used by the parser */
  field: string;
  required: boolean;
  type: ColType;
  /** Human-readable description shown in the Reference sheet */
  description: string;
  /** Example value shown in the example row */
  example: string;
  /** Valid values for enum / boolean_yn columns */
  enumValues?: string[];
  /** Approximate column width (chars) */
  width: number;
}

export const COLUMN_DEFS: ColDef[] = [
  {
    header: 'Produtor',
    field: 'producerName',
    required: true,
    type: 'text',
    description: 'Nome completo do produtor rural (OBRIGATÓRIO)',
    example: 'João da Silva',
    width: 30,
  },
  {
    header: 'CPF',
    field: 'cpf',
    required: false,
    type: 'text',
    description: 'CPF do produtor — apenas números ou formato 000.000.000-00',
    example: '123.456.789-00',
    width: 16,
  },
  {
    header: 'Telefone',
    field: 'phone',
    required: false,
    type: 'text',
    description: 'Telefone do produtor — apenas números',
    example: '66999999999',
    width: 16,
  },
  {
    header: 'Assentamento',
    field: 'settlementName',
    required: false,
    type: 'text',
    description: 'Nome do assentamento (deve existir no cadastro)',
    example: 'PA Tucumã',
    width: 26,
  },
  {
    header: 'Localidade',
    field: 'locationName',
    required: false,
    type: 'text',
    description: 'Localidade dentro do assentamento',
    example: 'Gleba 1',
    width: 20,
  },
  {
    header: 'Tipo de Serviço',
    field: 'demandTypeName',
    required: true,
    type: 'text',
    description: 'Nome exato do tipo de serviço cadastrado no sistema (OBRIGATÓRIO)',
    example: 'Grade',
    width: 25,
  },
  {
    header: 'Status',
    field: 'statusLabel',
    required: true,
    type: 'enum',
    enumValues: ['Pendente', 'Em Execução', 'Finalizado', 'Próximo'],
    description: 'Status do atendimento (OBRIGATÓRIO): Pendente | Em Execução | Finalizado | Próximo',
    example: 'Finalizado',
    width: 14,
  },
  {
    header: 'Prioridade',
    field: 'priorityLabel',
    required: false,
    type: 'enum',
    enumValues: ['Baixa', 'Média', 'Alta'],
    description: 'Prioridade: Baixa | Média | Alta',
    example: 'Média',
    width: 12,
  },
  {
    header: 'Data Agendamento',
    field: 'scheduledDate',
    required: true,
    type: 'date',
    description: 'Data de agendamento do serviço — formato DD/MM/AAAA (OBRIGATÓRIO)',
    example: '15/03/2026',
    width: 18,
  },
  {
    header: 'Data Cadastro',
    field: 'registeredDate',
    required: false,
    type: 'date',
    description: 'Data em que o registro foi criado — formato DD/MM/AAAA',
    example: '10/03/2026',
    width: 16,
  },
  {
    header: 'Data Finalização',
    field: 'completedDate',
    required: false,
    type: 'date',
    description: 'Data de conclusão — formato DD/MM/AAAA (obrigatório quando Status = Finalizado)',
    example: '15/03/2026',
    width: 18,
  },
  {
    header: 'Área Trabalhada (ha)',
    field: 'workedArea',
    required: false,
    type: 'number',
    description: 'Área trabalhada em hectares — use ponto como separador decimal',
    example: '2.5',
    width: 20,
  },
  {
    header: 'Qtd. Calcário (ton)',
    field: 'limestoneQuantity',
    required: false,
    type: 'number',
    description: 'Quantidade de calcário aplicada em toneladas',
    example: '1.0',
    width: 20,
  },
  {
    header: 'Qtd. Insumos (ton)',
    field: 'inputQuantity',
    required: false,
    type: 'number',
    description: 'Quantidade de insumos distribuídos em toneladas',
    example: '0.5',
    width: 19,
  },
  {
    header: 'Maquinário',
    field: 'machineryName',
    required: false,
    type: 'text',
    description: 'Nome ou patrimônio do maquinário (deve existir no cadastro)',
    example: 'Trator MF 290',
    width: 22,
  },
  {
    header: 'Operador',
    field: 'operatorName',
    required: false,
    type: 'text',
    description: 'Nome do operador (deve existir no cadastro de colaboradores)',
    example: 'Pedro Oliveira',
    width: 22,
  },
  {
    header: 'Resp. Técnico',
    field: 'technicianName',
    required: false,
    type: 'text',
    description: 'Nome do responsável técnico (deve existir no cadastro)',
    example: 'Ana Lima',
    width: 22,
  },
  {
    header: 'DAM Emitida',
    field: 'damIssued',
    required: false,
    type: 'boolean_yn',
    enumValues: ['Sim', 'Não'],
    description: 'DAM foi emitida? — Sim ou Não',
    example: 'Não',
    width: 13,
  },
  {
    header: 'DAM Paga',
    field: 'damPaid',
    required: false,
    type: 'boolean_yn',
    enumValues: ['Sim', 'Não'],
    description: 'DAM foi paga? — Sim ou Não',
    example: 'Não',
    width: 12,
  },
  {
    header: 'Observações',
    field: 'notes',
    required: false,
    type: 'text',
    description: 'Observações adicionais sobre o atendimento',
    example: 'Área com declive — aração dupla necessária',
    width: 38,
  },
];

// ─── Template download ──────────────────────────────────────────────────────

export function downloadImportTemplate(): void {
  const wb = XLSX.utils.book_new();
  const ncols = COLUMN_DEFS.length;

  // ── Sheet 1: Atendimentos ──────────────────────────────────────
  const wsData: (string | null)[][] = [];

  // Row 0 — title
  wsData.push([
    'MODELO DE IMPORTAÇÃO DE ATENDIMENTOS — Secretaria Municipal de Agricultura de Confresa',
    ...Array<null>(ncols - 1).fill(null),
  ]);

  // Row 1 — column headers
  wsData.push(COLUMN_DEFS.map((c) => c.header));

  // Row 2 — example row (prefixed so parser can detect and skip)
  wsData.push(COLUMN_DEFS.map((c, i) => (i === 0 ? `EXEMPLO: ${c.example}` : c.example)));

  // Rows 3–7 — empty data rows (ready to fill)
  for (let i = 0; i < 5; i++) {
    wsData.push(Array<null>(ncols).fill(null));
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws['!cols'] = COLUMN_DEFS.map((c) => ({ wch: c.width }));

  // Merge title row
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: ncols - 1 } }];

  XLSX.utils.book_append_sheet(wb, ws, 'Atendimentos');

  // ── Sheet 2: Referência ────────────────────────────────────────
  const refRows: (string | null)[][] = [
    [
      'TABELA DE REFERÊNCIA — Modelo de importação de atendimentos',
      null,
      null,
      null,
      null,
    ],
    [null, null, null, null, null],
    ['CAMPOS OBRIGATÓRIOS', null, null, null, null],
    ['Produtor', null, 'Tipo de Serviço', null, null],
    ['Status', null, 'Data Agendamento', null, null],
    [null, null, null, null, null],
    ['VALORES VÁLIDOS — Status', null, null, null, null],
    ['Pendente', null, null, null, null],
    ['Em Execução', null, null, null, null],
    ['Finalizado', null, null, null, null],
    ['Próximo', null, null, null, null],
    [null, null, null, null, null],
    ['VALORES VÁLIDOS — Prioridade', null, null, null, null],
    ['Baixa', null, null, null, null],
    ['Média', null, null, null, null],
    ['Alta', null, null, null, null],
    [null, null, null, null, null],
    ['VALORES VÁLIDOS — DAM Emitida / DAM Paga', null, null, null, null],
    ['Sim', null, null, null, null],
    ['Não', null, null, null, null],
    [null, null, null, null, null],
    ['DESCRIÇÃO DAS COLUNAS', null, null, null, null],
    ...COLUMN_DEFS.map((c) => [
      `${c.header}${c.required ? ' *' : ''}`,
      c.description,
      null,
      null,
      null,
    ]),
    [null, null, null, null, null],
    ['INSTRUÇÕES GERAIS', null, null, null, null],
    [
      '1. NÃO altere os cabeçalhos da linha 2 da aba "Atendimentos".',
      null,
      null,
      null,
      null,
    ],
    [
      '2. Preencha a partir da linha 3. A linha 3 é um EXEMPLO — apague-a antes de importar se desejar.',
      null,
      null,
      null,
    ],
    [
      '3. Datas: use o formato DD/MM/AAAA ou deixe o Excel formatar como data.',
      null,
      null,
      null,
      null,
    ],
    [
      '4. Números decimais: use ponto (.) como separador — ex: 2.5',
      null,
      null,
      null,
      null,
    ],
    [
      '5. Assentamento, Maquinário, Operador e Resp. Técnico são correspondidos por nome.',
      null,
      null,
      null,
      null,
    ],
    [
      '   Caso não sejam encontrados, o atendimento é importado sem o vínculo (aviso, não erro).',
      null,
      null,
      null,
      null,
    ],
    [
      '6. Linhas completamente vazias são ignoradas automaticamente.',
      null,
      null,
      null,
      null,
    ],
    [
      '7. Linhas com erros críticos (produtor vazio, tipo inválido, data inválida) são ignoradas.',
      null,
      null,
      null,
      null,
    ],
    [
      '8. Baixe o relatório de validação após importar para ver o resultado linha a linha.',
      null,
      null,
      null,
      null,
    ],
  ];

  const wsRef = XLSX.utils.aoa_to_sheet(refRows);
  wsRef['!cols'] = [
    { wch: 45 },
    { wch: 55 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
  ];
  wsRef['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
  ];

  XLSX.utils.book_append_sheet(wb, wsRef, 'Referência');

  XLSX.writeFile(wb, 'modelo_importacao_atendimentos.xlsx');
}
