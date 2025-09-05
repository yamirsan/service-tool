import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Settings, Calculator } from 'lucide-react';
const API = process.env.REACT_APP_API_BASE || (process.env.NODE_ENV === 'production' ? 'https://service-tool-backend.onrender.com' : '');

// Helper to format margin percent consistently (accepts 0.03 or 3 -> '3%')
const formatMarginPct = (v) => {
  if (v === null || v === undefined || v === '') return '0%';
  const num = Number(v);
  if (Number.isNaN(num)) return '0%';
  // Treat values < 1 as fractional (e.g., 0.03 => 3%), and >= 1 as already-percent (1 => 1%)
  const pct = num < 1 ? num * 100 : num;
  return `${Math.round(pct * 100) / 100}%`;
};

const Formulas = () => {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingFormula, setEditingFormula] = useState(null);
  const [viewType, setViewType] = useState('customer'); // customer | dealer

  const { data: formulas = [], isLoading } = useQuery('formulas', () =>
    axios.get(`${API}/formulas/`).then(res => res.data)
  );

  const deleteMutation = useMutation(
    (formulaId) => axios.delete(`${API}/formulas/${formulaId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('formulas');
        toast.success('Formula deleted successfully');
      },
      onError: () => {
        toast.error('Failed to delete formula');
      }
    }
  );

  const handleDelete = (formulaId) => {
    if (window.confirm('Are you sure you want to delete this formula?')) {
      deleteMutation.mutate(formulaId);
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-extrabold bg-gradient-to-r from-primary-700 via-pink-600 to-violet-700 bg-clip-text text-transparent flex items-center">
                <Settings className="h-7 w-7 mr-2 text-primary-600" />
                Pricing Formulas
              </h1>
              <p className="mt-2 text-gray-700">Manage pricing formulas for different part classes</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Customer/Dealer view toggle */}
              <div className="bg-white/90 backdrop-blur rounded-md border border-gray-200 p-1 text-sm">
                <button
                  className={`px-3 py-1 rounded ${viewType==='customer' ? 'bg-primary-600 text-white' : 'text-gray-700'}`}
                  onClick={() => setViewType('customer')}
                >
                  Customer
                </button>
                <button
                  className={`px-3 py-1 rounded ${viewType==='dealer' ? 'bg-primary-600 text-white' : 'text-gray-700'}`}
                  onClick={() => setViewType('dealer')}
                >
                  Dealer
                </button>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Formula
              </button>
            </div>
          </div>
        </div>

        {/* Formulas Grid */}
        <div className="px-4 sm:px-0">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading formulas...</p>
            </div>
          ) : formulas.length === 0 ? (
            <div className="text-center py-12 bg-white/90 backdrop-blur rounded-lg shadow">
              <Settings className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No formulas found</h3>
              <p className="mt-1 text-sm text-gray-600">Get started by creating a new pricing formula.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {formulas.map((formula) => (
                <div key={formula.id} className="bg-white/90 backdrop-blur rounded-lg shadow p-6 border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className="p-2 bg-primary-100 rounded-lg">
                        <Calculator className="h-6 w-6 text-primary-600" />
                      </div>
                      <h3 className="ml-3 text-lg font-semibold text-gray-900">
                        {formula.class_name}
                      </h3>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setEditingFormula(formula)}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(formula.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Toggle view of customer vs dealer values */}
                  {viewType === 'customer' ? (
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between"><span className="text-gray-600">Labor Lvl1:</span><span className="text-gray-900">${formula.labor_lvl1 || 0}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Labor Lvl2 Major:</span><span className="text-gray-900">${formula.labor_lvl2_major || 0}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Labor Lvl2 Minor:</span><span className="text-gray-900">${formula.labor_lvl2_minor || 0}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Labor Lvl3:</span><span className="text-gray-900">${formula.labor_lvl3 || 0}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Margin (%):</span><span className="text-gray-900">{formatMarginPct(formula.margin)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Exchange Rate:</span><span className="text-gray-900">{formula.exchange_rate || 1450}</span></div>
                    </div>
                  ) : (
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between"><span className="text-gray-600">Dealer Labor Lvl1:</span><span className="text-gray-900">${formula.dealer_labor_lvl1 || 0}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Dealer Labor Lvl2 Major:</span><span className="text-gray-900">${formula.dealer_labor_lvl2_major || 0}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Dealer Labor Lvl2 Minor:</span><span className="text-gray-900">${formula.dealer_labor_lvl2_minor || 0}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Dealer Labor Lvl3:</span><span className="text-gray-900">${formula.dealer_labor_lvl3 || 0}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Dealer Margin (%):</span><span className="text-gray-900">{formatMarginPct(formula.dealer_margin)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Exchange Rate:</span><span className="text-gray-900">{formula.exchange_rate || 1450}</span></div>
                      <div className="text-xs text-gray-500">Leave dealer fields empty to fall back to customer values (with 50% margin reduction).</div>
                    </div>
                  )}

                  <div className="mt-4 text-xs text-gray-500">
                    Last updated: {new Date(formula.updated_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingFormula) && (
        <FormulaModal
          formula={editingFormula}
          onClose={() => {
            setShowAddModal(false);
            setEditingFormula(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries('formulas');
            setShowAddModal(false);
            setEditingFormula(null);
          }}
        />
      )}
    </div>
  );
};

// Formula Modal Component
const FormulaModal = ({ formula, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    class_name: formula?.class_name || '',
    labor_lvl1: formula?.labor_lvl1 ?? '',
    labor_lvl2_major: formula?.labor_lvl2_major ?? '',
    labor_lvl2_minor: formula?.labor_lvl2_minor ?? '',
    labor_lvl3: formula?.labor_lvl3 ?? '',
    margin: formula?.margin ?? '',
    exchange_rate: formula?.exchange_rate ?? 1450,
    // Dealer
    dealer_labor_lvl1: formula?.dealer_labor_lvl1 ?? '',
    dealer_labor_lvl2_major: formula?.dealer_labor_lvl2_major ?? '',
    dealer_labor_lvl2_minor: formula?.dealer_labor_lvl2_minor ?? '',
    dealer_labor_lvl3: formula?.dealer_labor_lvl3 ?? '',
    dealer_margin: formula?.dealer_margin ?? '',
  });

  const mutation = useMutation(
    (data) => {
      if (formula) {
        return axios.put(`${API}/formulas/${formula.id}`, data);
      } else {
        return axios.post(`${API}/formulas/`, data);
      }
    },
    {
      onSuccess: () => {
        toast.success(formula ? 'Formula updated successfully' : 'Formula created successfully');
        onSuccess();
      },
      onError: () => {
        toast.error(formula ? 'Failed to update formula' : 'Failed to create formula');
      }
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();

    // Convert numeric fields (treat empty string as null, but allow 0)
    const num = (val) => (val === '' || val === null || val === undefined ? null : parseFloat(val));

    const submitData = {
      class_name: formData.class_name,
      labor_lvl1: num(formData.labor_lvl1),
      labor_lvl2_major: num(formData.labor_lvl2_major),
      labor_lvl2_minor: num(formData.labor_lvl2_minor),
      labor_lvl3: num(formData.labor_lvl3),
      margin: num(formData.margin),
      exchange_rate: num(formData.exchange_rate) ?? 1450,
      // Dealer
      dealer_labor_lvl1: num(formData.dealer_labor_lvl1),
      dealer_labor_lvl2_major: num(formData.dealer_labor_lvl2_major),
      dealer_labor_lvl2_minor: num(formData.dealer_labor_lvl2_minor),
      dealer_labor_lvl3: num(formData.dealer_labor_lvl3),
      dealer_margin: num(formData.dealer_margin),
    };

    mutation.mutate(submitData);
  };

  return (
    <div className="fixed inset-0 bg-gray-600/60 backdrop-blur overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {formula ? 'Edit Formula' : 'Add New Formula'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Class Name</label>
              <input
                type="text"
                required
                placeholder="e.g., LOW End, Mid End, High End"
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                value={formData.class_name}
                onChange={(e) => setFormData({...formData, class_name: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Labor Level 1 (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  value={formData.labor_lvl1}
                  onChange={(e) => setFormData({...formData, labor_lvl1: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Labor Level 2 Major (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  value={formData.labor_lvl2_major}
                  onChange={(e) => setFormData({...formData, labor_lvl2_major: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Labor Level 2 Minor (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  value={formData.labor_lvl2_minor}
                  onChange={(e) => setFormData({...formData, labor_lvl2_minor: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Labor Level 3 (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  value={formData.labor_lvl3}
                  onChange={(e) => setFormData({...formData, labor_lvl3: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Margin (%)</label>
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  value={formData.margin}
                  onChange={(e) => setFormData({...formData, margin: e.target.value})}
                />
                <p className="mt-1 text-xs text-gray-600">Enter 3 for 3% (fractions like 0.03 are also accepted).</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Exchange Rate (USD to IQD)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  value={formData.exchange_rate}
                  onChange={(e) => setFormData({...formData, exchange_rate: e.target.value})}
                />
              </div>
            </div>

            {/* Dealer specific section */}
            <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
              <p className="text-sm font-medium text-gray-900 mb-2">Dealer Overrides (optional)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Dealer Labor Level 1 (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    value={formData.dealer_labor_lvl1}
                    onChange={(e) => setFormData({...formData, dealer_labor_lvl1: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Dealer Labor Level 2 Major (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    value={formData.dealer_labor_lvl2_major}
                    onChange={(e) => setFormData({...formData, dealer_labor_lvl2_major: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Dealer Labor Level 2 Minor (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    value={formData.dealer_labor_lvl2_minor}
                    onChange={(e) => setFormData({...formData, dealer_labor_lvl2_minor: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Dealer Labor Level 3 (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    value={formData.dealer_labor_lvl3}
                    onChange={(e) => setFormData({...formData, dealer_labor_lvl3: e.target.value})}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Dealer Margin (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    value={formData.dealer_margin}
                    onChange={(e) => setFormData({...formData, dealer_margin: e.target.value})}
                  />
                  <p className="mt-1 text-xs text-gray-600">If left empty, dealer pricing uses customer margin reduced by 50%.</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={mutation.isLoading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                {mutation.isLoading ? 'Saving...' : (formula ? 'Update' : 'Create')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Formulas;
