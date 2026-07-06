import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ColumnConfig } from '../../types';
import { X, GripVertical, Plus, Trash2, ShieldAlert } from 'lucide-react';

interface KanbanConfigModalProps {
  isOpen: boolean;
  currentColumns: any[];
  onClose: () => void;
  onSave: (newColumns: ColumnConfig[]) => void;
}

export default function KanbanConfigModal({ isOpen, currentColumns, onClose, onSave }: KanbanConfigModalProps) {
  const [columns, setLocalColumns] = useState<ColumnConfig[]>([]);
  const [newColumnName, setNewColumnName] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Auto-healing: Transforma strings antiguos a la nueva estructura estructurada
  useEffect(() => {
    if (isOpen && currentColumns) {
      const mapped = currentColumns.map(col => {
        if (typeof col === 'string') {
          return { name: col, require_confirm: col.toLowerCase().includes('cerrado') || col.toLowerCase().includes('ganado') };
        }
        return { name: col.name || '', require_confirm: !!col.require_confirm };
      });
      setLocalColumns(mapped);
    }
  }, [isOpen, currentColumns]);

  // Bloquear scroll de la página cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // --- HTML5 DRAG & DROP NATIVO DE FILAS ---
  const handleDragStart = (index: number) => setDraggedIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => e.preventDefault();
  
  const handleDrop = (index: number) => {
    if (draggedIndex === null) return;
    const updated = [...columns];
    const [movedItem] = updated.splice(draggedIndex, 1);
    updated.splice(index, 0, movedItem);
    setLocalColumns(updated);
    setDraggedIndex(null);
  };

  // --- CONTROLADORES DE MODIFICACIONES ---
  const handleAddColumn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColumnName.trim()) return;
    if (columns.some(c => c.name.toLowerCase() === newColumnName.trim().toLowerCase())) {
      alert("Ya existe una etapa con ese nombre.");
      return;
    }
    setLocalColumns([...columns, { name: newColumnName.trim(), require_confirm: false }]);
    setNewColumnName('');
  };

  // NUEVO: Permite la edición inline del nombre de cada columna
  const handleRenameColumn = (index: number, newName: string) => {
    const updated = [...columns];
    updated[index].name = newName;
    setLocalColumns(updated);
  };

  const handleToggleConfirm = (index: number) => {
    const updated = [...columns];
    updated[index].require_confirm = !updated[index].require_confirm;
    setLocalColumns(updated);
  };

  const handleRemoveColumn = (index: number) => {
    if (confirm(`¿Estás seguro de eliminar la etapa "${columns[index].name}"?`)) {
      setLocalColumns(columns.filter((_, i) => i !== index));
    }
  };

  const handlePreSaveValidation = () => {
    // Validación de seguridad: evitar nombres vacíos accidentales
    if (columns.some(c => !c.name.trim())) {
      alert("Error: No puedes dejar el nombre de una columna vacío.");
      return;
    }
    onSave(columns);
  };

  return createPortal(
    /* CONTENEDOR ANCLA: Fija el modal en el centro perfecto de la pantalla */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 backdrop-blur-xs p-4 overflow-hidden animate-in fade-in duration-150">
      
      {/* CUERPO DEL MODAL (Max-h restringido, scroll únicamente interno en las columnas) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* ENCABEZADO */}
        <header className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div>
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest font-mono">Estructura del Kanban</h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Edita los nombres inline o arrastra las filas para reordenar.</p>
          </div>
          <button onClick={onClose} type="button" className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-all cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* LISTADO DE COLUMNAS (SCROLL INTERNO) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2.5 custom-scrollbar bg-slate-50/40">
          {columns.map((col, index) => (
            <div
              key={index}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              className={`flex items-center justify-between p-2.5 bg-white border rounded-xl transition-all shadow-2xs ${
                draggedIndex === index ? 'opacity-40 bg-blue-50 border-blue-200 scale-95' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Arrastre e Input Inline */}
              <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 p-1 shrink-0">
                  <GripVertical className="w-4 h-4" />
                </div>
                
                {/* INPUT INLINE EDITABLE */}
                <input
                  type="text"
                  value={col.name}
                  onChange={(e) => handleRenameColumn(index, e.target.value)}
                  className="w-full text-xs font-bold text-slate-700 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-400 focus:bg-slate-50 px-2 py-1.5 rounded-lg outline-none transition-all truncate"
                  placeholder="Nombre de la etapa..."
                  title="Haga clic para renombrar esta columna"
                />
              </div>

              {/* Checkbox de Confirmación y Eliminar */}
              <div className="flex items-center gap-4 shrink-0 pl-3 border-l border-slate-100">
                <label className="flex items-center gap-1.5 cursor-pointer group" title="Solicitar confirmación de seguridad antes de mover un lead aquí">
                  <input
                    type="checkbox"
                    checked={col.require_confirm}
                    onChange={() => handleToggleConfirm(index)}
                    className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <span className={`text-[9px] font-black uppercase tracking-wider flex items-center gap-0.5 transition-colors ${col.require_confirm ? 'text-amber-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
                    {col.require_confirm && <ShieldAlert className="w-3 h-3 text-amber-500 shrink-0" />} Seguro
                  </span>
                </label>

                <button onClick={() => handleRemoveColumn(index)} type="button" className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* AGREGAR NUEVA COLUMNA */}
        <form onSubmit={handleAddColumn} className="px-6 py-3 border-t border-slate-100 bg-white flex gap-2 shrink-0">
          <input
            type="text"
            placeholder="Añadir nueva etapa al pipeline..."
            value={newColumnName}
            onChange={(e) => setNewColumnName(e.target.value)}
            className="flex-1 bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-semibold rounded-lg outline-none focus:bg-white focus:border-blue-500 transition-all"
          />
          <button type="submit" className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-600 flex items-center gap-1.5 transition-colors cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Añadir
          </button>
        </form>

        {/* FOOTER */}
        <footer className="px-6 py-3 border-t border-slate-100 flex justify-end gap-2 shrink-0 bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} type="button" className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors cursor-pointer">
            Cancelar
          </button>
          <button onClick={handlePreSaveValidation} type="button" className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm cursor-pointer">
            Guardar Cambios
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
