import fs from 'fs';

let content = fs.readFileSync('src/components/LeadsSection.tsx', 'utf-8');

// 1. Remove COLUMNS constant
content = content.replace(/const COLUMNS: string\[\] = \[\s+'Nuevo', 'Contactado', 'Cotizado', 'Negociación', 'Cerrado Ganado', 'Cerrado Perdido'\s+\];/g, '');

// 2. Add kanbanColumns state and manual assign modal state
const stateInjection = `  const [kanbanColumns, setKanbanColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('verse_crm_kanban_columns');
    return saved ? JSON.parse(saved) : ['Nuevo', 'Contactado', 'Cotizado', 'Negociación', 'Cerrado Ganado', 'Cerrado Perdido'];
  });
  useEffect(() => {
    localStorage.setItem('verse_crm_kanban_columns', JSON.stringify(kanbanColumns));
  }, [kanbanColumns]);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTargetStage, setAssignTargetStage] = useState('');
  const [columnConfigOpen, setColumnConfigOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
`;

content = content.replace(/const \[kanbanMeta, setKanbanMeta\] = useState[^\n]+\n[^\n]+\n[^\n]+\n[^\n]+\n[^\n]+\n  \}\);/, `$&
${stateInjection}`);

// 3. Update useEffect that auto-assigns stages
const oldUseEffect = `          let stage: string = 'Nuevo';
          if (r.estado_proyecto === 'Cerrado Ganado' || r.status_proyecto === 'Win') {
            stage = 'Cerrado Ganado';
          } else if (r.estado_proyecto === 'Negociación') {
            stage = 'Negociación';
          } else if (r.estado_proyecto === 'Propuesta') {
            stage = 'Cotizado';
          } else {
            // cycle them
            const stageIdx = idx % 6;
            stage = stages[stageIdx];
          }`;

content = content.replace(oldUseEffect, `          let stage: string = 'Sin Asignar';`);

// 4. Update the renderKanbanView map from COLUMNS to kanbanColumns
content = content.replace(/COLUMNS\.map\(/g, 'kanbanColumns.map(');

fs.writeFileSync('src/components/LeadsSection.tsx', content);
