import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Smartphone, Plus, Edit, Trash2, Search, Filter } from 'lucide-react';
const API = process.env.REACT_APP_API_BASE || '';

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'highend', label: 'High End' },
  { value: 'midend', label: 'Mid End' },
  { value: 'lowend', label: 'Low End' },
  { value: 'tab', label: 'Tablet' },
  { value: 'wearable', label: 'Wearable' },
];

const categoryBadge = (cat) => {
  const c = (cat || '').toLowerCase();
  if (c === 'highend') return 'bg-purple-100 text-purple-800';
  if (c === 'midend') return 'bg-indigo-100 text-indigo-800';
  if (c === 'lowend') return 'bg-green-100 text-green-800';
  if (c === 'tab') return 'bg-blue-100 text-blue-800';
  if (c === 'wearable') return 'bg-amber-100 text-amber-800';
  return 'bg-gray-100 text-gray-800';
};

export default function SamsungModels() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: models = [], isLoading } = useQuery(
    ['samsung-models', search, category],
    () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (category) params.append('category', category);
      params.append('limit', '10000');
      return axios.get(`${API}/samsung-models/?${params.toString()}`).then(r => r.data);
    }
  );

  const createMutation = useMutation(
    (payload) => axios.post(`${API}/samsung-models/`, payload),
    {
      onSuccess: () => {
        toast.success('Model added');
        queryClient.invalidateQueries('samsung-models');
        setModalOpen(false);
      },
      onError: (e) => toast.error(e?.response?.data?.detail || 'Failed to add model')
    }
  );
  const updateMutation = useMutation(
    ({ id, ...payload }) => axios.put(`${API}/samsung-models/${id}`, payload),
    {
      onSuccess: () => {
        toast.success('Model updated');
        queryClient.invalidateQueries('samsung-models');
        setEditing(null);
      },
      onError: () => toast.error('Failed to update model')
    }
  );
  const deleteMutation = useMutation(
    (id) => axios.delete(`${API}/samsung-models/${id}`),
    {
      onSuccess: () => {
        toast.success('Model deleted');
        queryClient.invalidateQueries('samsung-models');
      },
      onError: () => toast.error('Failed to delete model')
    }
  );

  const handleSave = (payload) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-extrabold bg-gradient-to-r from-primary-700 via-pink-600 to-violet-700 bg-clip-text text-transparent flex items-center">
                <Smartphone className="h-7 w-7 mr-2 text-primary-600" />
                Samsung Models
              </h1>
              <p className="mt-2 text-gray-700">Manage Samsung phone, tablet, and wearable models and their category</p>
            </div>
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Model
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 sm:px-0 mb-6">
          <div className="bg-white/90 backdrop-blur p-4 rounded-lg shadow border border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search model name..."
                  className="pl-10 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <select
                  className="pl-10 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="px-4 sm:px-0">
          <div className="bg-white/90 backdrop-blur rounded-lg shadow border border-gray-100 overflow-hidden sm:rounded-md">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-2 text-gray-500">Loading models...</p>
              </div>
            ) : models.length === 0 ? (
              <div className="text-center py-12">
                <Smartphone className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No models found</h3>
                <p className="mt-1 text-sm text-gray-500">Add your first Samsung model.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {models.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{m.model_name}{m.model_code ? ` (${m.model_code})` : ''}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{m.model_code || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${categoryBadge(m.category)}`}>
                            {m.category || 'Uncategorized'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => setEditing(m)}
                              className="text-primary-600 hover:text-primary-900"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm('Delete this model?')) {
                                  deleteMutation.mutate(m.id);
                                }
                              }}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {(modalOpen || editing) && (
        <ModelModal
          initial={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSave={handleSave}
          loading={createMutation.isLoading || updateMutation.isLoading}
        />
      )}
    </div>
  );
}

function ModelModal({ initial, onClose, onSave, loading }) {
  const [name, setName] = useState(initial?.model_name || '');
  const [category, setCategory] = useState(initial?.category || '');
  const [code, setCode] = useState(initial?.model_code || '');

  return (
    <div className="fixed inset-0 bg-gray-600/60 backdrop-blur overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {initial ? 'Edit Model' : 'Add Model'}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Model Name</label>
              <input
                type="text"
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Model Code (e.g., SM-S928)</label>
              <input
                type="text"
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <select
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.filter(c => c.value !== '').map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading || !name}
              onClick={() => onSave({ model_name: name, category: category || null, model_code: code || null })}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
