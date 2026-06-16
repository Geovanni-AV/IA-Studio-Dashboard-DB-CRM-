import fs from 'fs';
let content = fs.readFileSync('src/components/LeadsSection.tsx', 'utf-8');

const modals = `
      {/* MODAL: ASSIGN CARD TO KANBAN COLUMN */}
      {assignModalOpen && createPortal(
        <div className="fixed inset-0 bg-[#0b1c30]/50 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-150">
          <div className="bg-white border w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
            <header className="bg-slate-50 border-b border-slate-200 px-6 py-4">
              <h3 className="font-bold text-slate-800">Agregar Lead a {assignTargetStage}</h3>
              <p className="text-xs text-slate-500 mt-0.5">Selecciona un proyecto disponible para integrarlo al tablero.</p>
            </header>
            <div className="p-4 overflow-y-auto bg-slate-50 flex-1 space-y-2">
              {records.filter(r => kanbanMeta[r.id]?.stage === 'Sin Asignar').length === 0 ? (
                <div className="text-sm text-center text-slate-400 py-6">
                  No hay proyectos nuevos o sin asignar. Puedes crear uno nuevo desde la vista de lista.
                </div>
              ) : (
                records.filter(r => kanbanMeta[r.id]?.stage === 'Sin Asignar').map(r => (
                  <div key={r.id} className="flex justify-between items-center bg-white p-3 border border-slate-200 rounded-lg shadow-sm">
                    <div>
                      <h4 className="text-sm font-bold text-slate-700">{r.informacion_general_proyecto || 'Sin Nombre'}</h4>
                      <p className="text-xs text-slate-500">{r.informacion_general_cliente || 'Sin Cliente'}</p>
                    </div>
                    <button
                      onClick={() => {
                        handleCardStageChange(r.id, assignTargetStage);
                        setAssignModalOpen(false);
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      Asignar
                    </button>
                  </div>
                ))
              )}
            </div>
            <footer className="bg-white p-4 border-t border-slate-200 flex justify-end">
              <button 
                onClick={() => setAssignModalOpen(false)}
                className="px-4 py-2 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-lg transition-colors border border-transparent hover:border-slate-300"
              >
                Cerrar
              </button>
            </footer>
          </div>
        </div>,
        document.getElementById('root')!
      )}

      {/* MODAL: CONFIGURE COLUMNS */}
      {columnConfigOpen && createPortal(
        <div className="fixed inset-0 bg-[#0b1c30]/50 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-150">
          <div className="bg-white border w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
            <header className="bg-slate-50 border-b border-slate-200 px-6 py-4">
              <h3 className="font-bold text-slate-800">Configurar Columnas Kanban</h3>
              <p className="text-xs text-slate-500 mt-0.5">Agrega o elimina columnas de tu tablero principal. Solo se puede eliminar columnas que no contengan licitaciones activas.</p>
            </header>
            <div className="p-6 overflow-y-auto bg-slate-50 flex-1 space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nombre de la nueva columna..."
                  value={newColumnName}
                  onChange={e => setNewColumnName(e.target.value)}
                  className="flex-1 bg-white border border-slate-300 px-3 py-2 rounded-lg text-sm outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => {
                    const val = newColumnName.trim();
                    if (val && !kanbanColumns.includes(val) && val !== 'Sin Asignar') {
                      setKanbanColumns([...kanbanColumns, val]);
                      setNewColumnName('');
                    }
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg transition-colors disabled:opacity-50"
                  disabled={!newColumnName.trim() || kanbanColumns.includes(newColumnName.trim())}
                >
                  Agregar
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 mt-4">
                {kanbanColumns.map((col, i) => {
                  const itemsInCol = records.filter(r => kanbanMeta[r.id]?.stage === col).length;
                  return (
                    <div key={col} className="flex justify-between items-center p-3">
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 flex items-center justify-center bg-slate-100 rounded text-slate-400 text-xs font-mono">{i + 1}</span>
                        <span className="font-medium text-sm text-slate-700">{col}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">{itemsInCol} items</span>
                        <button
                          onClick={() => {
                            if (itemsInCol > 0) {
                              alert('No puedes eliminar una columna que contiene leads. Mueve los leads a otra columna primero.');
                              return;
                            }
                            setKanbanColumns(kanbanColumns.filter(c => c !== col));
                            
                            // Remove wipLimits as well if they exist
                            const newWip = { ...wipLimits };
                            if (newWip[col]) delete newWip[col];
                            setWipLimits(newWip);
                          }}
                          className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded transition-colors"
                          title={itemsInCol > 0 ? 'La columna tiene elementos' : 'Eliminar columna'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <footer className="bg-white p-4 border-t border-slate-200 flex justify-end">
              <button 
                onClick={() => setColumnConfigOpen(false)}
                className="px-4 py-2 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-lg transition-colors border border-transparent hover:border-slate-300"
              >
                Cerrar
              </button>
            </footer>
          </div>
        </div>,
        document.getElementById('root')!
      )}
`;

content = content.replace("  );\n}", modals + "\n  );\n}");

fs.writeFileSync('src/components/LeadsSection.tsx', content);
