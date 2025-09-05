import React from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import { Package, Calculator, TrendingUp, Database, Sparkles, Clock, AlertTriangle } from 'lucide-react';

const API = process.env.REACT_APP_API_BASE || (process.env.NODE_ENV === 'production' ? 'https://service-tool-backend.onrender.com' : '');

// Helper to format margin percent consistently (accepts 0.03 or 3 -> '3%')
const formatMarginPct = (v) => {
  if (v === null || v === undefined || v === '') return '0%';
  const num = Number(v);
  if (Number.isNaN(num)) return '0%';
  const pct = num <= 1 ? num * 100 : num;
  return `${Math.round(pct * 100) / 100}%`;
};

const Dashboard = () => {
  const { data: parts = [] } = useQuery('parts', () =>
    axios.get(`${API}/parts/?limit=10000`).then(res => res.data)
  );

  const { data: formulas = [] } = useQuery('formulas', () =>
    axios.get(`${API}/formulas/`).then(res => res.data)
  );

  const totalParts = parts.length;
  const activeParts = parts.filter(part => part.status === 'Active').length;
  const totalStock = parts.reduce((sum, part) => sum + (part.stock_qty || 0), 0);
  const totalValue = parts.reduce((sum, part) => sum + ((part.net_price || 0) * (part.stock_qty || 0)), 0);

  // Default exchange rate to estimate final price in parts lists
  const defaultExchangeRate = Number(formulas?.[0]?.exchange_rate || 1450);

  const stats = [
    {
      name: 'Total Parts',
      value: totalParts,
      icon: Package,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600'
    },
    {
      name: 'Active Parts',
      value: activeParts,
      icon: TrendingUp,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600'
    },
    {
      name: 'Total Stock',
      value: totalStock,
      icon: Database,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600'
    },
    {
      name: 'Stock Value',
      value: `$${totalValue.toLocaleString()}`,
      icon: Calculator,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600'
    }
  ];

  const recentParts = parts.slice(0, 5);
  const lowStockParts = parts.filter(part => (part.status === 'Active') && ((part.stock_qty || 0) > 0 && (part.stock_qty || 0) < 10));

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-primary-700 via-pink-600 to-violet-700 bg-clip-text text-transparent flex items-center">
            <Sparkles className="h-7 w-7 mr-2 text-primary-600" />
            Dashboard
          </h1>
          <p className="mt-2 text-gray-700">Overview of your parts inventory and system status</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 px-4 sm:px-0">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.name} className="bg-white/90 backdrop-blur rounded-lg shadow border border-gray-100">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className={`${stat.bgColor} p-3 rounded-md`}>
                      <Icon className={`${stat.textColor} h-6 w-6`} />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-600 truncate">
                          {stat.name}
                        </dt>
                        <dd className="text-lg font-semibold text-gray-900">
                          {stat.value}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Parts and Low Stock */}
        <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2 px-4 sm:px-0">
          {/* Recent Parts */}
          <div className="bg-white/90 backdrop-blur rounded-lg shadow border border-gray-100">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-semibold text-gray-900 mb-4 flex items-center">
                <Clock className="h-5 w-5 mr-2 text-primary-600" />
                Recent Parts
              </h3>
              <div className="space-y-3">
                {recentParts.length > 0 ? (
                  recentParts.map((part) => (
                    <div key={part.id} className="flex items-center justify-between border-b border-gray-100 pb-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{part.code}</p>
                        <p className="text-sm text-gray-600 truncate">{part.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          ${(part.net_price || part.map_price || 0).toFixed(2)}
                        </p>
                        <p className="text-xs text-green-700">
                          Final (IQD): {(((part.net_price || part.map_price || 0) * defaultExchangeRate) || 0).toLocaleString()} IQD
                        </p>
                        <p className="text-sm text-gray-600">Qty: {part.stock_qty}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-600 text-center py-4">No parts available</p>
                )}
              </div>
            </div>
          </div>

          {/* Low Stock Alert */}
          <div className="bg-white/90 backdrop-blur rounded-lg shadow border border-gray-100">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-semibold text-gray-900 mb-4 flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2 text-amber-600" />
                Low Stock Alert
              </h3>
              <div className="space-y-3">
                {lowStockParts.length > 0 ? (
                  lowStockParts.slice(0, 5).map((part) => (
                    <div key={part.id} className="flex items-center justify-between border-b border-gray-100 pb-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{part.code}</p>
                        <p className="text-sm text-gray-600 truncate">{part.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-green-700 mb-1">
                          Final: {(((part.net_price || part.map_price || 0) * defaultExchangeRate) || 0).toLocaleString()} IQD
                        </p>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {part.stock_qty} left
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-600 text-center py-4">No low stock items</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Formulas Summary */}
        <div className="mt-8 px-4 sm:px-0">
          <div className="bg-white/90 backdrop-blur rounded-lg shadow border border-gray-100">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-semibold text-gray-900 mb-4 flex items-center">
                <Calculator className="h-5 w-5 mr-2 text-primary-600" />
                Pricing Formulas
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {formulas.length > 0 ? (
                  formulas.map((formula) => (
                    <div key={formula.id} className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-2">{formula.class_name}</h4>
                      <div className="space-y-1 text-sm text-gray-700">
                        <p>Labor Lvl1: ${formula.labor_lvl1 || 0}</p>
                        <p>Labor Lvl2 Major: ${formula.labor_lvl2_major || 0}</p>
                        <p>Labor Lvl2 Minor: ${formula.labor_lvl2_minor || 0}</p>
                        <p>Labor Lvl3: ${formula.labor_lvl3 || 0}</p>
                        <p>Margin (%): {formatMarginPct(formula.margin)}</p>
                        <p>Exchange Rate: {formula.exchange_rate || 1450}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-600 col-span-full text-center py-4">No formulas configured</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
