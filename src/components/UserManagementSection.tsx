import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Shield, 
  Mail, 
  Calendar, 
  Copy, 
  Database, 
  Lock, 
  AlertTriangle, 
  Check, 
  X, 
  Plus,
  RefreshCw
} from 'lucide-react';
import { UserAccount, UserRole } from '../types';
import { 
  loadUsersFromSupabase, 
  upsertUserToSupabase, 
  initializeDefaultUsers,
  getResolvedUsuariosTableName,
  toValidUUID
} from '../supabaseService';

interface UserManagementSectionProps {
  role: UserRole;
  onShowAudit: (action: string, details: string) => void;
}

export default function UserManagementSection({ role, onShowAudit }: UserManagementSectionProps) {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'pending' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // New User Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newNombre, setNewNombre] = useState('');
  const [newRol, setNewRol] = useState<UserRole>('Solo Lectura');

  const supabaseUrl = localStorage.getItem('verse_supabase_url') || '';
  const supabaseKey = localStorage.getItem('verse_supabase_key') || '';
  const isSupabaseConfigured = !!(supabaseUrl && supabaseKey);

  const fetchUsers = async () => {
    setLoading(true);
    if (!isSupabaseConfigured) {
      // Fallback to local storage if not configured
      const localUsersStr = localStorage.getItem('verse_local_users');
      if (localUsersStr) {
        setUsers(JSON.parse(localUsersStr));
      } else {
        // Initialize mock default local users
        const defaultLocal: UserAccount[] = [
          {
            id: 'local_1',
            email: 'geovanni@verse-technology.com',
            nombre: 'Geovanni Verse',
            rol: 'Admin',
            estado: 'active',
            created_at: '2026-06-24 10:00:00'
          },
          {
            id: 'local_2',
            email: 'marisol@verse-technology.com',
            nombre: 'Marisol Verse',
            rol: 'Solo Lectura',
            estado: 'active',
            created_at: '2026-06-24 10:05:00'
          },
          {
            id: 'local_3',
            email: 'ruth.triana@verse-technology.com',
            nombre: 'Ruth Triana',
            rol: 'Vendedor',
            estado: 'active',
            created_at: '2026-06-24 10:10:00'
          }
        ];
        localStorage.setItem('verse_local_users', JSON.stringify(defaultLocal));
        setUsers(defaultLocal);
      }
      setLoading(false);
      return;
    }

    try {
      // Try to load from Supabase
      const res = await loadUsersFromSupabase(supabaseUrl, supabaseKey);
      if (res.success) {
        setUsers(res.users);
      } else {
        console.warn("Could not load users from Supabase, loading from local fallback:", res.message);
        const localUsersStr = localStorage.getItem('verse_local_users') || '[]';
        setUsers(JSON.parse(localUsersStr));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [isSupabaseConfigured]);

  const handleInitializeDefaults = async () => {
    if (!isSupabaseConfigured) {
      alert("Por favor, configure las credenciales de Supabase primero en la sección 'Puente Supabase' para inicializar en la nube.");
      return;
    }

    setLoading(true);
    try {
      const res = await initializeDefaultUsers(supabaseUrl, supabaseKey);
      alert(res.message);
      onShowAudit('MODIFICACIÓN', `Inicialización de usuarios predeterminados: ${res.message}`);
      await fetchUsers();
    } catch (e: any) {
      alert("Error al inicializar usuarios: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (user: UserAccount, newEstado: 'active' | 'rejected', assignedRole?: UserRole) => {
    const updatedUser: UserAccount = {
      ...user,
      estado: newEstado,
      rol: assignedRole || user.rol
    };

    setLoading(true);
    let success = false;

    if (isSupabaseConfigured) {
      success = await upsertUserToSupabase(supabaseUrl, supabaseKey, updatedUser);
    } else {
      // Local storage fallback
      const localUsersStr = localStorage.getItem('verse_local_users') || '[]';
      const localUsers: UserAccount[] = JSON.parse(localUsersStr);
      const updatedList = localUsers.map(u => u.email === user.email ? updatedUser : u);
      localStorage.setItem('verse_local_users', JSON.stringify(updatedList));
      success = true;
    }

    if (success) {
      onShowAudit('MODIFICACIÓN', `Se actualizó el usuario ${user.email}. Estado: ${newEstado}, Rol: ${assignedRole || user.rol}`);
      await fetchUsers();
    } else {
      alert("Error al actualizar el usuario en la base de datos.");
    }
    setLoading(false);
  };

  const handleUpdateRole = async (user: UserAccount, newRole: UserRole) => {
    const updatedUser: UserAccount = {
      ...user,
      rol: newRole
    };

    setLoading(true);
    let success = false;

    if (isSupabaseConfigured) {
      success = await upsertUserToSupabase(supabaseUrl, supabaseKey, updatedUser);
    } else {
      const localUsersStr = localStorage.getItem('verse_local_users') || '[]';
      const localUsers: UserAccount[] = JSON.parse(localUsersStr);
      const updatedList = localUsers.map(u => u.email === user.email ? updatedUser : u);
      localStorage.setItem('verse_local_users', JSON.stringify(updatedList));
      success = true;
    }

    if (success) {
      onShowAudit('MODIFICACIÓN', `Cambio de rol para usuario ${user.email} a: ${newRole}`);
      await fetchUsers();
    } else {
      alert("Error al actualizar el rol en la base de datos.");
    }
    setLoading(false);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    const newUser: UserAccount = {
      id: toValidUUID(newEmail.trim().toLowerCase()),
      email: newEmail.trim().toLowerCase(),
      nombre: newNombre.trim() || newEmail.split('@')[0],
      rol: newRol,
      estado: 'active',
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };

    setLoading(true);
    let success = false;

    if (isSupabaseConfigured) {
      success = await upsertUserToSupabase(supabaseUrl, supabaseKey, newUser);
    } else {
      const localUsersStr = localStorage.getItem('verse_local_users') || '[]';
      const localUsers: UserAccount[] = JSON.parse(localUsersStr);
      if (localUsers.some(u => u.email === newUser.email)) {
        alert("Este correo electrónico ya está registrado.");
        setLoading(false);
        return;
      }
      localUsers.push(newUser);
      localStorage.setItem('verse_local_users', JSON.stringify(localUsers));
      success = true;
    }

    if (success) {
      onShowAudit('ALTA REGISTRO', `Se creó/invitó al usuario ${newUser.email} con el rol ${newRol}`);
      setNewEmail('');
      setNewNombre('');
      setNewRol('Solo Lectura');
      setShowAddForm(false);
      await fetchUsers();
    } else {
      alert("Error al guardar el usuario.");
    }
    setLoading(false);
  };

  const handleCopySql = () => {
    const sqlText = `CREATE TABLE IF NOT EXISTS public."Usuarios" (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    nombre VARCHAR(255),
    rol VARCHAR(50) DEFAULT 'Solo Lectura' CHECK (rol IN ('Admin', 'Vendedor', 'Solo Lectura')),
    estado VARCHAR(50) DEFAULT 'pending' CHECK (estado IN ('active', 'pending', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insertar los usuarios iniciales por defecto
INSERT INTO public."Usuarios" (id, email, nombre, rol, estado) VALUES
('d6387084-2a2b-47e0-9884-635b71db433f', 'geovanni@verse-technology.com', 'Geovanni Verse', 'Admin', 'active'),
('f46a7834-31ee-4eb3-8bf2-ccda71cb143e', 'marisol@verse-technology.com', 'Marisol Verse', 'Solo Lectura', 'active'),
('46747d34-f851-419b-bf55-cbdb51db158a', 'ruth.triana@verse-technology.com', 'Ruth Triana', 'Vendedor', 'active')
ON CONFLICT (email) DO NOTHING;`;

    navigator.clipboard.writeText(sqlText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredUsers = users.filter(user => {
    const matchesFilter = filter === 'all' || user.estado === filter;
    const matchesSearch = user.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          user.nombre.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const pendingRequests = users.filter(user => user.estado === 'pending');

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-xl p-6 text-white shadow-md border border-slate-800">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 bg-indigo-500/20 text-indigo-300 rounded-md">
                <Users className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold tracking-tight">Control de Usuarios y Accesos</h1>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl">
              Administra quién tiene permitido ingresar a la plataforma con autenticación de Google y define sus roles operativos en tiempo real. Los cambios se sincronizan de forma resiliente en Supabase.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs font-semibold flex items-center gap-1.5 border border-slate-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Recargar
            </button>
            <button
              onClick={() => setShowSql(!showSql)}
              className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Database className="w-3.5 h-3.5" />
              {showSql ? 'Ocultar SQL' : 'Estructura SQL'}
            </button>
            <button
              onClick={handleInitializeDefaults}
              disabled={loading}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs font-semibold border border-slate-700 flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Cargar 3 Predeterminados
            </button>
          </div>
        </div>
      </div>

      {/* SQL Setup Guide (Bento card style) */}
      {showSql && (
        <div className="bg-slate-950 text-slate-100 rounded-xl border border-indigo-900/60 p-5 shadow-inner animate-in slide-in-from-top duration-300">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5" />
                Configurar Base de Datos en Supabase
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Ejecuta la siguiente instrucción SQL en el editor de Supabase para inicializar la tabla de <code className="text-indigo-300 px-1 bg-indigo-950 rounded">Usuarios</code> con la que se valida el inicio de sesión.
              </p>
            </div>
            <button
              onClick={handleCopySql}
              className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 text-xs flex items-center gap-1"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? '¡Copiado!' : 'Copiar SQL'}
            </button>
          </div>
          <pre className="p-3 bg-slate-900 rounded-md text-[11px] font-mono text-emerald-400 overflow-x-auto border border-slate-800">
{`CREATE TABLE IF NOT EXISTS public."Usuarios" (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    nombre VARCHAR(255),
    rol VARCHAR(50) DEFAULT 'Solo Lectura' CHECK (rol IN ('Admin', 'Vendedor', 'Solo Lectura')),
    estado VARCHAR(50) DEFAULT 'pending' CHECK (estado IN ('active', 'pending', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insertar los usuarios iniciales por defecto
INSERT INTO public."Usuarios" (id, email, nombre, rol, estado) VALUES
('d6387084-2a2b-47e0-9884-635b71db433f', 'geovanni@verse-technology.com', 'Geovanni Verse', 'Admin', 'active'),
('f46a7834-31ee-4eb3-8bf2-ccda71cb143e', 'marisol@verse-technology.com', 'Marisol Verse', 'Solo Lectura', 'active'),
('46747d34-f851-419b-bf55-cbdb51db158a', 'ruth.triana@verse-technology.com', 'Ruth Triana', 'Vendedor', 'active')
ON CONFLICT (email) DO NOTHING;`}
          </pre>
        </div>
      )}

      {/* Database Connection Warning */}
      {!isSupabaseConfigured && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Modo Simulación Activo</h3>
            <p className="text-xs text-amber-700 mt-0.5">
              No se han configurado credenciales en la pestaña <strong>"Puente Supabase"</strong>. Los usuarios se están administrando y simulando de manera local en tu navegador. Configure Supabase para sincronizar con la tabla real en la nube.
            </p>
          </div>
        </div>
      )}

      {/* Pending Access Requests Grid */}
      {pendingRequests.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-amber-600 animate-pulse" />
            Solicitudes Pendientes de Autorización ({pendingRequests.length})
          </h2>
          <p className="text-xs text-amber-800">
            Los siguientes usuarios iniciaron sesión con Google pero no están en la lista permitida. Selecciona su rol y apruébalos para darles acceso inmediato.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingRequests.map(user => (
              <PendingRequestCard 
                key={user.id} 
                user={user} 
                onApprove={(assignedRole) => handleUpdateStatus(user, 'active', assignedRole)}
                onReject={() => handleUpdateStatus(user, 'rejected')}
              />
            ))}
          </div>
        </div>
      )}

      {/* Main Users List Bento Block */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-xs overflow-hidden">
        {/* Filters Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex gap-2">
            {(['all', 'active', 'pending', 'rejected'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 rounded text-xs font-medium uppercase tracking-wider transition-all duration-200 ${
                  filter === tab 
                    ? 'bg-slate-900 text-white shadow-xs' 
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {tab === 'all' ? 'Todos' : tab === 'active' ? 'Activos' : tab === 'pending' ? 'Pendientes' : 'Rechazados'}
              </button>
            ))}
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Buscar por nombre o correo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-slate-200 rounded px-3 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 w-full sm:w-64"
            />
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="p-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              {showAddForm ? 'Cerrar' : 'Crear'}
            </button>
          </div>
        </div>

        {/* Add User Form */}
        {showAddForm && (
          <form onSubmit={handleAddUser} className="p-4 bg-indigo-50/50 border-b border-indigo-100/60 grid grid-cols-1 md:grid-cols-4 gap-3 items-end animate-in slide-in-from-top duration-200">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre Completo</label>
              <input
                type="text"
                required
                placeholder="Ej. Juan Pérez"
                value={newNombre}
                onChange={(e) => setNewNombre(e.target.value)}
                className="bg-white border border-slate-200 rounded px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 w-full"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Correo Electrónico (Google)</label>
              <input
                type="email"
                required
                placeholder="Ej. juan@verse-technology.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="bg-white border border-slate-200 rounded px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 w-full"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Rol Operativo</label>
              <select
                value={newRol}
                onChange={(e) => setNewRol(e.target.value as UserRole)}
                className="bg-white border border-slate-200 rounded px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 w-full"
              >
                <option value="Admin">Admin (Control Total)</option>
                <option value="Vendedor">Vendedor (Alta/Modificación)</option>
                <option value="Solo Lectura">Solo Lectura (Auditor)</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold uppercase tracking-wider shadow-xs disabled:opacity-50"
            >
              Dar de Alta de Inmediato
            </button>
          </form>
        )}

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3">Nombre / Cuenta</th>
                <th className="px-6 py-3">Rol Asignado</th>
                <th className="px-6 py-3">Estado</th>
                <th className="px-6 py-3">Creado El</th>
                <th className="px-6 py-3 text-right">Acción Operativa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                    No se encontraron usuarios que coincidan con los criterios.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-800 font-bold flex items-center justify-center border border-slate-200 shrink-0">
                          {user.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{user.nombre}</p>
                          <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 text-slate-400" />
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={user.rol}
                        onChange={(e) => handleUpdateRole(user, e.target.value as UserRole)}
                        className="bg-white border border-slate-200 rounded px-2 py-0.5 font-semibold text-xs outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="Admin">Admin</option>
                        <option value="Vendedor">Vendedor</option>
                        <option value="Solo Lectura">Solo Lectura</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        user.estado === 'active' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                          : user.estado === 'pending'
                          ? 'bg-amber-50 text-amber-700 border border-amber-100 animate-pulse'
                          : 'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        {user.estado === 'active' ? 'Autorizado' : user.estado === 'pending' ? 'Pendiente' : 'Rechazado'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-[10px]">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {user.created_at}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        {user.estado !== 'active' && (
                          <button
                            onClick={() => handleUpdateStatus(user, 'active')}
                            className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded"
                            title="Aprobar Acceso"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {user.estado !== 'rejected' && (
                          <button
                            onClick={() => handleUpdateStatus(user, 'rejected')}
                            className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded"
                            title="Denegar Acceso"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Subcomponent: Pending Request Card
interface PendingRequestCardProps {
  key?: any;
  user: UserAccount;
  onApprove: (role: UserRole) => void;
  onReject: () => void;
}

function PendingRequestCard({ user, onApprove, onReject }: PendingRequestCardProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole>('Solo Lectura');

  return (
    <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm flex flex-col justify-between gap-3 animate-in fade-in duration-200">
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">{user.nombre}</h4>
            <p className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
              <Mail className="w-3 h-3 text-slate-400" />
              {user.email}
            </p>
          </div>
          <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold uppercase tracking-wider font-mono">
            Pendiente
          </span>
        </div>
        <p className="text-[11px] text-slate-600 mt-2">
          Registrado el: <span className="font-mono">{user.created_at}</span>
        </p>

        {/* Role Selector */}
        <div className="mt-3 bg-slate-50 p-2 rounded border border-slate-100">
          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">
            Asignar Rol Operativo:
          </label>
          <div className="flex gap-2">
            {(['Solo Lectura', 'Vendedor', 'Admin'] as UserRole[]).map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedRole(r)}
                className={`flex-1 text-[10px] py-1 rounded font-semibold transition-all duration-200 border ${
                  selectedRole === r 
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-t border-slate-100 pt-3">
        <button
          onClick={() => onApprove(selectedRole)}
          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
          Aprobar Acceso
        </button>
        <button
          onClick={onReject}
          className="py-1.5 px-3 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 rounded border border-slate-200 hover:border-rose-200 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center transition-all"
          title="Denegar Solicitud"
        >
          <X className="w-3.5 h-3.5" />
          Rechazar
        </button>
      </div>
    </div>
  );
}
