import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Search, Filter, Plus, Edit, Trash2, Package, Wrench, Smartphone, ChevronLeft, ChevronRight } from 'lucide-react';
import { FixedSizeList as List } from 'react-window';
import { useAuth } from '../contexts/AuthContext';
const API = process.env.REACT_APP_API_BASE || (process.env.NODE_ENV === 'production' ? 'https://service-tool-backend.onrender.com' : '');

// Helper: debounce hook
function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// Helper: color-code part codes by prefix
const getPartCodeClass = (code) => {
  const c = (code ?? '').toString().toUpperCase();
  if (c.startsWith('LCD')) return 'text-blue-600';
  if (c.startsWith('PBA')) return 'text-purple-600';
  return 'text-gray-900';
};

const categoryBadge = (cat) => {
  const c = (cat || '').toLowerCase();
  if (c === 'highend') return 'bg-purple-100 text-purple-800';
  if (c === 'midend') return 'bg-indigo-100 text-indigo-800';
  if (c === 'lowend') return 'bg-green-100 text-green-800';
  if (c === 'tab') return 'bg-blue-100 text-blue-800';
  if (c === 'wearable') return 'bg-amber-100 text-amber-800';
  return 'bg-gray-100 text-gray-800';
};

// Helper to process requests in chunks to avoid overwhelming the API
const chunkArray = (arr, size) => {
  const res = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
};

const Parts = () => {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 400);
  const [statusFilter, setStatusFilter] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  // Reset to page 0 when filters change (include device)
  useEffect(() => { setPage(0); }, [debouncedSearch, statusFilter, deviceFilter]);

  // Fetch parts with server-side pagination; request one extra to detect hasNext
  const fetchParts = useCallback(async () => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.append('search', debouncedSearch);
    if (statusFilter) params.append('status', statusFilter);
    if (deviceFilter) params.append('device', deviceFilter);
    params.append('skip', String(page * pageSize));
    params.append('limit', String(pageSize + 1));
    const res = await axios.get(`${API}/parts/?${params.toString()}`);
    const items = Array.isArray(res.data) ? res.data : [];
    const hasNext = items.length > pageSize;
    return { items: hasNext ? items.slice(0, pageSize) : items, hasNext };
  }, [debouncedSearch, statusFilter, deviceFilter, page, pageSize]);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery(
    ['parts', debouncedSearch, statusFilter, deviceFilter, page, pageSize],
    fetchParts,
    { keepPreviousData: true }
  );

  const parts = data?.items ?? [];
  const hasNext = data?.hasNext ?? false;

  // Build device options from ALL matching parts across filters (not just current page)
  const fetchDeviceOptions = useCallback(async () => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.append('search', debouncedSearch);
    if (statusFilter) params.append('status', statusFilter);
    params.append('skip', '0');
    params.append('limit', '50000');
    const res = await axios.get(`${API}/parts/?${params.toString()}`);
    const items = Array.isArray(res.data) ? res.data : [];
    const seen = new Set();
    const opts = [];
    items.forEach((p) => {
      const name = (p.samsung_match_name || '').trim();
      const code = (p.samsung_match_code || '').trim();
      if (!name && !code) return;
      const key = `${name}||${code}`.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      const label = name ? (code ? `${name} (${code})` : name) : code;
      opts.push({ key, label });
    });
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [debouncedSearch, statusFilter]);

  const { data: deviceOptions = [], isFetching: isFetchingDevices } = useQuery(
    ['parts-device-options', debouncedSearch, statusFilter],
    fetchDeviceOptions,
    { keepPreviousData: true, staleTime: 60_000 }
  );

  // Visible parts now come directly from server (device filter is applied server-side)
  const visibleParts = parts;

  const deleteMutation = useMutation(
    (partId) => axios.delete(`${API}/parts/${partId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('parts');
        toast.success('Part deleted successfully');
      },
      onError: () => {
        toast.error('Failed to delete part');
      }
    }
  );

  // Restore single-item delete handler used by the table action button
  const handleDelete = (partId) => {
    if (!isAdmin) { toast.error('Not authorized'); return; }
    if (window.confirm('Are you sure you want to delete this part?')) {
      deleteMutation.mutate(partId);
    }
  };

  // Helper to fetch all matching parts for bulk operations (respects current search/status/device)
  const fetchAllMatchingParts = useCallback(async () => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.append('search', debouncedSearch);
    if (statusFilter) params.append('status', statusFilter);
    if (deviceFilter) params.append('device', deviceFilter);
    params.append('skip', '0');
    params.append('limit', '50000');
    const res = await axios.get(`${API}/parts/?${params.toString()}`);
    return Array.isArray(res.data) ? res.data : [];
  }, [debouncedSearch, statusFilter, deviceFilter]);

  // Empty stock for all parts (sets stock_qty and gr_qty to 0)
  const emptyStockMutation = useMutation(
    async () => {
      const all = await fetchAllMatchingParts();
      if (!all || all.length === 0) return;
      const chunks = chunkArray(all, 100);
      for (const chunk of chunks) {
        await Promise.all(
          chunk.map((part) => {
            const payload = {
              code: part.code,
              description: part.description,
              map_price: part.map_price ?? null,
              net_price: part.net_price ?? null,
              status: part.status,
              stock_qty: 0,
              gr_qty: 0,
              gr_usd: part.gr_usd ?? null,
              diff: part.diff ?? null,
            };
            return axios.put(`${API}/parts/${part.id}`, payload);
          })
        );
      }
    },
    {
      onMutate: () => toast.loading('Emptying stock for all matching parts...', { id: 'bulk-empty' }),
      onSuccess: () => {
        toast.success('Stock cleared', { id: 'bulk-empty' });
        queryClient.invalidateQueries('parts');
      },
      onError: (err) => {
        console.error(err);
        toast.error('Failed to empty stock', { id: 'bulk-empty' });
      }
    }
  );

  // Delete all matching parts
  const deleteAllMutation = useMutation(
    async () => {
      const all = await fetchAllMatchingParts();
      if (!all || all.length === 0) return;
      const chunks = chunkArray(all, 100);
      for (const chunk of chunks) {
        await Promise.all(chunk.map((p) => axios.delete(`${API}/parts/${p.id}`)));
      }
    },
    {
      onMutate: () => toast.loading('Deleting all matching parts...', { id: 'bulk-del' }),
      onSuccess: () => {
        toast.success('All matching parts deleted', { id: 'bulk-del' });
        queryClient.invalidateQueries('parts');
      },
      onError: (err) => {
        console.error(err);
        toast.error('Failed to delete all', { id: 'bulk-del' });
      }
    }
  );

  const handleEmptyStockAll = () => {
    if (!isAdmin) { toast.error('Not authorized'); return; }
    if (window.confirm('This will set Stock and GR Qty to 0 for ALL matching parts. Continue?')) {
      emptyStockMutation.mutate();
    }
  };

  const handleDeleteAll = () => {
    if (!isAdmin) { toast.error('Not authorized'); return; }
    if (window.confirm('This will permanently DELETE ALL matching parts. This cannot be undone. Continue?')) {
      deleteAllMutation.mutate();
    }
  };

  // Row renderer for virtualization
  const Row = ({ index, style, data }) => {
    const part = data[index];
    return (
      <div style={style} className="grid grid-cols-9 items-center px-6 border-b border-gray-200 hover:bg-gray-50 text-sm">
        <div className="font-medium break-all">
          <span className={getPartCodeClass(part.code)} title={part.code}>{part.code}</span>
        </div>
        <div className="truncate" title={part.description}>{part.description}</div>
        <div className="truncate" title={`${part.samsung_match_name || ''}${part.samsung_match_code ? ` (${part.samsung_match_code})` : ''}`}>
          {part.samsung_match_name ? (
            <span>
              {part.samsung_match_name}
              {part.samsung_match_code ? ` (${part.samsung_match_code})` : ''}
            </span>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
        <div>
          {part.samsung_category ? (
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${categoryBadge(part.samsung_category)}`}>
              {part.samsung_category}
            </span>
          ) : (
            <span className="text-gray-400 text-sm">-</span>
          )}
        </div>
        <div>${(part.map_price || 0).toFixed(2)}</div>
        <div>${(part.net_price || 0).toFixed(2)}</div>
        <div>{part.stock_qty || 0}</div>
        <div>
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            part.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {part.status}
          </span>
        </div>
        {isAdmin ? (
          <div className="text-right">
            <div className="flex justify-end space-x-2">
              <button onClick={() => setEditingPart(part)} className="text-primary-600 hover:text-primary-900">
                <Edit className="h-4 w-4" />
              </button>
              <button onClick={() => handleDelete(part.id)} className="text-red-600 hover:text-red-900">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  // Skeleton loader for list
  const SkeletonRows = ({ count = 12 }) => (
    <div className="divide-y divide-gray-200">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="grid grid-cols-9 items-center px-6 py-4 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-24" />
          <div className="h-4 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-200 rounded w-40" />
          <div className="h-5 bg-gray-200 rounded w-16" />
          <div className="h-4 bg-gray-200 rounded w-20" />
          <div className="h-4 bg-gray-200 rounded w-20" />
          <div className="h-4 bg-gray-200 rounded w-12" />
          <div className="h-5 bg-gray-200 rounded w-16" />
          <div className="h-4 bg-gray-200 rounded w-10 justify-self-end" />
        </div>
      ))}
    </div>
  );

  // New: fetch total count for current filters (include device)
  const fetchCount = useCallback(async () => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.append('search', debouncedSearch);
    if (statusFilter) params.append('status', statusFilter);
    if (deviceFilter) params.append('device', deviceFilter);
    const res = await axios.get(`${API}/parts/count?${params.toString()}`);
    return Number(res.data?.total || 0);
  }, [debouncedSearch, statusFilter, deviceFilter]);

  const { data: totalCount = 0 } = useQuery(
    ['parts-count', debouncedSearch, statusFilter, deviceFilter],
    fetchCount,
    { staleTime: 60_000, keepPreviousData: true }
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize) || 1);
  const canPrev = page > 0;
  const canNext = page + 1 < totalPages;

  // Adjust page if page exceeds totalPages (e.g., when filters change)
  useEffect(() => {
    if (page + 1 > totalPages) setPage(0);
  }, [totalPages]);

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-extrabold bg-gradient-to-r from-primary-700 via-pink-600 to-violet-700 bg-clip-text text-transparent flex items-center">
                <Wrench className="h-7 w-7 mr-2 text-primary-600" />
                Parts Management
              </h1>
              <p className="mt-2 text-gray-700">Manage your parts inventory</p>
            </div>
            {isAdmin && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleEmptyStockAll}
                  disabled={emptyStockMutation.isLoading || deleteAllMutation.isLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-amber-500 hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50"
                  title="Set stock to 0 for all parts"
                >
                  Empty Stock (All)
                </button>
                <button
                  onClick={handleDeleteAll}
                  disabled={emptyStockMutation.isLoading || deleteAllMutation.isLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                  title="Delete all parts"
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete All
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  disabled={emptyStockMutation.isLoading || deleteAllMutation.isLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Part
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 sm:px-0 mb-6">
          <div className="bg-white/90 backdrop-blur p-4 rounded-lg shadow border">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search parts..."
                  className="pl-10 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <select
                  className="pl-10 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Dead">Dead</option>
                </select>
              </div>
              <div className="relative">
                <Smartphone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <select
                  className="pl-10 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  value={deviceFilter}
                  onChange={(e) => setDeviceFilter(e.target.value)}
                >
                  <option value="">All Devices</option>
                  {deviceOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
                {isFetchingDevices && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Loading…</span>}
              </div>
              <div className="flex items-center text-sm text-gray-700">
                <Package className="h-4 w-4 mr-2" />
                {visibleParts.length} on page {page + 1} / {totalPages} • total {totalCount}
                {isFetching && <span className="ml-2 text-gray-400">(updating...)</span>}
              </div>
              {/* Right controls placeholder (pager moved to bottom) */}
              <div className="flex items-center justify-end space-x-2 md:col-span-2" />
            </div>
          </div>
        </div>

        {/* Error State */}
        {isError && (
          <div className="px-4 sm:px-0 mb-6">
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
              <p className="font-medium">Failed to load parts</p>
              <p className="text-sm mt-1">{error?.message || 'Something went wrong.'}</p>
              <button onClick={() => refetch()} className="mt-3 px-3 py-1.5 bg-red-600 text-white rounded text-sm">Retry</button>
            </div>
          </div>
        )}

        {/* Parts Table */}
        <div className="px-4 sm:px-0">
          <div className="bg-white/90 backdrop-blur shadow overflow-hidden sm:rounded-md border border-gray-100">
            {isLoading ? (
              <div className="py-4">
                {/* Header skeleton */}
                <div className="bg-gray-50/80 px-6 py-3 text-xs font-medium text-gray-600 uppercase tracking-wider">Loading parts...</div>
                <SkeletonRows count={12} />
              </div>
            ) : visibleParts.length === 0 ? (
              <div className="text-center py-12">
                <Package className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No parts found</h3>
                <p className="mt-1 text-sm text-gray-600">Try adjusting filters or search.</p>
              </div>
            ) : (
              <div className="overflow-x-auto relative">
                {/* Header */}
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50/80">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Part Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Model</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">MAP Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Net Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Stock</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                      {isAdmin && (
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                      )}
                    </tr>
                  </thead>
                </table>
                {/* Virtualized rows */}
                {visibleParts.length > 200 ? (
                  <div className="max-h-[70vh] overflow-auto">
                    <List
                      height={Math.min(70 * 8, 560)}
                      itemCount={visibleParts.length}
                      itemSize={56}
                      width={'100%'}
                      itemData={visibleParts}
                    >
                      {Row}
                    </List>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <tbody className="bg-white divide-y divide-gray-200">
                      {visibleParts.map((part) => (
                        <tr key={part.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium break-all">
                            <span className={getPartCodeClass(part.code)} title={part.code}>{part.code}</span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={part.description}>
                            {part.description}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={`${part.samsung_match_name || ''}${part.samsung_match_code ? ` (${part.samsung_match_code})` : ''}`}>
                            {part.samsung_match_name ? (
                              <span>
                                {part.samsung_match_name}
                                {part.samsung_match_code ? ` (${part.samsung_match_code})` : ''}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {part.samsung_category ? (
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${categoryBadge(part.samsung_category)}`}>
                                {part.samsung_category}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${(part.map_price || 0).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${(part.net_price || 0).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {part.stock_qty || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              part.status === 'Active' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {part.status}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-right w-24">
                              <div className="flex justify-end space-x-2">
                                <button
                                  onClick={() => setEditingPart(part)}
                                  className="text-primary-600 hover:text-primary-900"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(part.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom pager controls (only bottom) */}
        {!isLoading && (
          <div className="px-4 sm:px-0 mt-4">
            <div className="flex items-center justify-end space-x-2">
              <select
                className="border border-gray-300 rounded-md px-2 py-2 text-sm"
                value={pageSize}
                onChange={(e) => { setPage(0); setPageSize(parseInt(e.target.value, 10)); }}
              >
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
              <span className="text-sm text-gray-600 px-2">Page {page + 1} of {totalPages}</span>
              <button
                className="inline-flex items-center px-2 py-2 border rounded-md text-sm disabled:opacity-50"
                onClick={() => setPage(0)}
                disabled={!canPrev || isFetching}
                title="First page"
              >
                «
              </button>
              <button
                className="inline-flex items-center px-2 py-2 border rounded-md text-sm disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={!canPrev || isFetching}
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <button
                className="inline-flex items-center px-2 py-2 border rounded-md text-sm disabled:opacity-50"
                onClick={() => setPage((p) => (canNext ? p + 1 : p))}
                disabled={!canNext || isFetching}
                title="Next page"
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </button>
              <button
                className="inline-flex items-center px-2 py-2 border rounded-md text-sm disabled:opacity-50"
                onClick={() => setPage(totalPages - 1)}
                disabled={!canNext || isFetching}
                title="Last page"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isAdmin && (showAddModal || editingPart) && (
        <PartModal
          part={editingPart}
          onClose={() => {
            setShowAddModal(false);
            setEditingPart(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries('parts');
            setShowAddModal(false);
            setEditingPart(null);
          }}
        />
      )}
    </div>
  );
};

// Part Modal Component
const PartModal = ({ part, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    code: part?.code || '',
    description: part?.description || '',
    map_price: part?.map_price || '',
    net_price: part?.net_price || '',
    status: part?.status || 'Active',
    stock_qty: part?.stock_qty || 0,
    gr_qty: part?.gr_qty || 0,
    gr_usd: part?.gr_usd || '',
    diff: part?.diff || ''
  });

  // Live Samsung detection from code/description
  const [detected, setDetected] = useState({
    model_name: part?.samsung_match_name || null,
    model_code: part?.samsung_match_code || null,
    category: part?.samsung_category || null,
  });
  const [detectLoading, setDetectLoading] = useState(false);

  useEffect(() => {
    const text = `${formData.code || ''} ${formData.description || ''}`.trim();
    if (!text) {
      setDetected({ model_name: null, model_code: null, category: null });
      return;
    }
    let cancelled = false;
    setDetectLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await axios.get(`${API}/detect-samsung`, { params: { text } });
        if (!cancelled) setDetected(res.data || { model_name: null, model_code: null, category: null });
      } catch {
        if (!cancelled) setDetected({ model_name: null, model_code: null, category: null });
      } finally {
        if (!cancelled) setDetectLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [formData.code, formData.description]);

  const mutation = useMutation(
    (data) => {
      if (part) {
        return axios.put(`${API}/parts/${part.id}`, data);
      } else {
        return axios.post(`${API}/parts/`, data);
      }
    },
    {
      onSuccess: () => {
        toast.success(part ? 'Part updated successfully' : 'Part created successfully');
        onSuccess();
      },
      onError: () => {
        toast.error(part ? 'Failed to update part' : 'Failed to create part');
      }
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Convert numeric fields
    const submitData = {
      ...formData,
      map_price: formData.map_price ? parseFloat(formData.map_price) : null,
      net_price: formData.net_price ? parseFloat(formData.net_price) : null,
      gr_usd: formData.gr_usd ? parseFloat(formData.gr_usd) : null,
      diff: formData.diff ? parseFloat(formData.diff) : null,
      stock_qty: parseInt(formData.stock_qty) || 0,
      gr_qty: parseInt(formData.gr_qty) || 0
    };

    mutation.mutate(submitData);
  };

  return (
    <div className="fixed inset-0 bg-gray-600/60 backdrop-blur overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            {part ? 'Edit Part' : 'Add New Part'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Part Code</label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <select
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                >
                  <option value="Active">Active</option>
                  <option value="Dead">Dead</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                rows="3"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">MAP Price</label>
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  value={formData.map_price}
                  onChange={(e) => setFormData({...formData, map_price: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text sm font-medium text-gray-700">Net Price</label>
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  value={formData.net_price}
                  onChange={(e) => setFormData({...formData, net_price: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Stock Quantity</label>
                <input
                  type="number"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  value={formData.stock_qty}
                  onChange={(e) => setFormData({...formData, stock_qty: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">GR Quantity</label>
                <input
                  type="number"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  value={formData.gr_qty}
                  onChange={(e) => setFormData({...formData, gr_qty: e.target.value})}
                />
              </div>
            </div>

            {/* Read-only Samsung link info (live detection) */}
            <div className="bg-gray-50 border rounded-md p-3">
              <p className="text-sm font-medium text-gray-800">Detected Model & Category</p>
              {detectLoading ? (
                <p className="mt-1 text-sm text-gray-400">Detecting...</p>
              ) : (
                <div className="mt-1 text-sm text-gray-700">
                  <p>
                    Model: {detected.model_name ? (
                      <span>
                        {detected.model_name}{detected.model_code ? ` (${detected.model_code})` : ''}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </p>
                  <p className="mt-1">
                    Category: {detected.category ? (
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${categoryBadge(detected.category)}`}>
                        {detected.category}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </p>
                </div>
              )}
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
                {mutation.isLoading ? 'Saving...' : (part ? 'Update' : 'Create')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Parts;
