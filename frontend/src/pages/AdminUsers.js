import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Plus, Trash2, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API = process.env.REACT_APP_API_BASE || '';

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};

const fetchUsers = async () => {
  const { data } = await axios.get(`${API}/admin/users`, { headers: authHeaders() });
  return data || [];
};

const AdminUsers = () => {
  const { isAdmin, hasPermission, user, logout } = useAuth();
  const allowed = isAdmin || hasPermission('manage_users');
  const qc = useQueryClient();
  const { data: users = [], isLoading } = useQuery(['admin-users'], fetchUsers, { 
    enabled: allowed,
    onError: (e) => {
      const status = e?.response?.status;
      if (status === 401) {
        toast.error('Session expired. Please sign in again.');
        logout();
      }
    }
  });

  const [form, setForm] = useState({ username: '', password: '', role: 'user', permissions: '' });
  const [showOnlyMine, setShowOnlyMine] = useState(false);

  const createMutation = useMutation(
    async (payload) => (await axios.post(`${API}/admin/users`, payload, { headers: authHeaders() })).data,
    { onSuccess: () => { toast.success('User created'); qc.invalidateQueries(['admin-users']); setForm({ username: '', password: '', role: 'user', permissions: ''}); },
      onError: (e) => {
        if (e?.response?.status === 401) { toast.error('Session expired. Please sign in again.'); logout(); return; }
        toast.error(e?.response?.data?.detail || 'Failed to create user');
      } }
  );

  const updateMutation = useMutation(
    async ({ id, updates }) => (await axios.put(`${API}/admin/users/${id}`, updates, { headers: authHeaders() })).data,
    { onSuccess: () => { toast.success('User updated'); qc.invalidateQueries(['admin-users']); },
      onError: (e) => {
        if (e?.response?.status === 401) { toast.error('Session expired. Please sign in again.'); logout(); return; }
        toast.error(e?.response?.data?.detail || 'Failed to update user');
      } }
  );

  const deleteMutation = useMutation(
    async (id) => (await axios.delete(`${API}/admin/users/${id}`, { headers: authHeaders() })).data,
    { onSuccess: () => { toast.success('User deleted'); qc.invalidateQueries(['admin-users']); },
      onError: (e) => {
        if (e?.response?.status === 401) { toast.error('Session expired. Please sign in again.'); logout(); return; }
        toast.error(e?.response?.data?.detail || 'Failed to delete user');
      } }
  );

  // Move hook before any conditional returns to satisfy rules-of-hooks
  const visibleUsers = useMemo(() => {
    if (!showOnlyMine || !user?.id) return users;
    return users.filter(u => u.created_by_id === user.id);
  }, [showOnlyMine, users, user]);

  if (!allowed) return <div className="p-6">Not authorized.</div>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">User Management</h2>

      <div className="bg-white shadow rounded p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Create User</h3>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" className="rounded" checked={showOnlyMine} onChange={e=>setShowOnlyMine(e.target.checked)} />
            Show only users I created
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input className="border rounded px-3 py-2" placeholder="Username" value={form.username} onChange={e=>setForm(f=>({...f, username: e.target.value}))} />
          <input className="border rounded px-3 py-2" placeholder="Password" type="password" value={form.password} onChange={e=>setForm(f=>({...f, password: e.target.value}))} />
          <select className="border rounded px-3 py-2" value={form.role} onChange={e=>setForm(f=>({...f, role: e.target.value}))}>
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
          <input className="border rounded px-3 py-2" placeholder="permissions (csv)" value={form.permissions} onChange={e=>setForm(f=>({...f, permissions: e.target.value}))} />
          <button className="inline-flex items-center justify-center bg-primary-600 text-white rounded px-3 py-2" onClick={()=>createMutation.mutate(form)} disabled={createMutation.isLoading}>
            <Plus className="w-4 h-4 mr-1" /> Create
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded">
        <div className="p-4 border-b font-semibold">Existing Users</div>
        <div className="divide-y">
          {isLoading ? (
            <div className="p-4">Loading...</div>
          ) : (
            visibleUsers.map(u => <UserRow key={u.id} user={u} onUpdate={updateMutation.mutate} onDelete={()=>deleteMutation.mutate(u.id)} />)
          )}
        </div>
      </div>
    </div>
  );
};

const UserRow = ({ user, onUpdate, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ username: user.username, is_active: user.is_active, role: user.role || 'user', permissions: user.permissions || '' });

  const save = () => {
    onUpdate({ id: user.id, updates: draft });
    setEditing(false);
  };

  return (
    <div className="p-4 flex items-center gap-3">
      {editing ? (
        <>
          <input className="border rounded px-2 py-1 w-40" value={draft.username} onChange={e=>setDraft(d=>({...d, username: e.target.value}))} />
          <select className="border rounded px-2 py-1" value={draft.is_active} onChange={e=>setDraft(d=>({...d, is_active: e.target.value}))}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <select className="border rounded px-2 py-1" value={draft.role} onChange={e=>setDraft(d=>({...d, role: e.target.value}))}>
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
          <input className="border rounded px-2 py-1 flex-1" placeholder="permissions (csv)" value={draft.permissions} onChange={e=>setDraft(d=>({...d, permissions: e.target.value}))} />
          <button className="inline-flex items-center bg-green-600 text-white rounded px-3 py-2" onClick={save}><Save className="w-4 h-4 mr-1"/>Save</button>
        </>
      ) : (
        <>
          <div className="w-40 font-medium">{user.username}</div>
          <div className="w-28"><span className={`px-2 py-1 text-xs rounded ${user.is_active==='Active'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-700'}`}>{user.is_active}</span></div>
          <div className="w-28"><span className={`px-2 py-1 text-xs rounded ${user.role==='admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{user.role || 'user'}</span></div>
          <div className="flex-1 text-sm text-gray-600">{user.permissions || '-'}</div>
          <div className="w-48 text-xs text-gray-500">Created by: {user.created_by_username || '-'}</div>
          <div className="flex gap-2">
            <button className="text-primary-600" onClick={()=>setEditing(true)}>Edit</button>
            <button className="text-red-600 inline-flex items-center" onClick={onDelete}><Trash2 className="w-4 h-4 mr-1"/>Delete</button>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminUsers;
