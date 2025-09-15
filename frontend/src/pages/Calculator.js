import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Calculator, Search, DollarSign, Trash2, Plus, Puzzle, Wrench, Smartphone } from 'lucide-react';
import API from '../config';

// ...existing code...

const PriceCalculator = () => {
  // Dynamic multi-row parts selection
  const [selectedParts, setSelectedParts] = useState([{ partId: '', qty: 1 }]);
  const [selectedFormula, setSelectedFormula] = useState('');
  const [laborLevel, setLaborLevel] = useState('2_major');
  const [partSearch, setPartSearch] = useState('');
  const [calcCustomer, setCalcCustomer] = useState(null);
  const [calcDealer, setCalcDealer] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  // New: track whether formula is auto-selected based on detected category
  const [autoFormula, setAutoFormula] = useState(true);
  const [autoDetectedCategory, setAutoDetectedCategory] = useState(null);
  // New: auto add OLED repair kits for same model
  const [autoAddKits, setAutoAddKits] = useState(true);
  const [deviceFilter, setDeviceFilter] = useState('');
  // New: manual MAP entries (separate from part rows)
  const [manualMaps, setManualMaps] = useState([]);

  const { data: parts = [] } = useQuery(['parts', partSearch], () => {
    const params = new URLSearchParams();
    params.append('limit', '10000');
    if (partSearch) params.append('search', partSearch);
    return axios.get(`${API}/parts/?${params.toString()}`).then(res => res.data);
  });

  // Build unique device options from parts (name + optional code)
  const deviceOptions = useMemo(() => {
    const seen = new Set();
    const opts = [];
    parts.forEach((p) => {
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
  }, [parts]);

  // When device filter changes, reset selected parts rows to default
  useEffect(() => {
    setSelectedParts([{ partId: '', qty: 1 }]);
  }, [deviceFilter]);

  const { data: formulas = [] } = useQuery('formulas', () =>
    axios.get(`${API}/formulas/?limit=10000`).then(res => res.data)
  );

  // Client-side device filtering of available parts for selection
  const filteredParts = useMemo(() => {
    if (!deviceFilter) return parts;
    return parts.filter((p) => {
      const name = (p.samsung_match_name || '').trim();
      const code = (p.samsung_match_code || '').trim();
      const key = `${name}||${code}`.toLowerCase();
      return key === deviceFilter;
    });
  }, [parts, deviceFilter]);

  const findPart = (id) => parts.find(p => p.id === Number(id));
  const selectedFormulaData = formulas.find(formula => formula.id === parseInt(selectedFormula));

  // Helpers for auto kit selection
  const norm = (s) => (s ?? '').toString().trim().toLowerCase();
  const compositeText = (p) => norm(`${p?.code || ''} ${p?.description || ''}`);
  const sameModel = (a, b) => {
    if (!a || !b) return false;
    const ac = norm(a.samsung_match_code), bc = norm(b.samsung_match_code);
    const an = norm(a.samsung_match_name), bn = norm(b.samsung_match_name);
    if (ac && bc) return ac === bc;
    if (an && bn) return an === bn;
    return false;
  };
  const isOLEDPart = (p) => {
    const t = compositeText(p);
    // Must include OLED/AMOLED and not be explicitly OCTA-only
    return (t.includes('oled') || t.includes('amoled')) && !t.includes('octa');
  };
  const isRepairKit = (p) => {
    const t = compositeText(p);
    return t.includes('repair') && t.includes('kit');
  };
  const isRepairKitOLED = (p) => {
    const t = compositeText(p);
    return isRepairKit(p) && (t.includes('oled') || t.includes('amoled'));
  };
  const isRepairKitBC = (p) => {
    const t = compositeText(p);
    return isRepairKit(p) && (t.includes('b/c') || t.includes('bc') || t.includes('back cover'));
  };
  const findKitForModel = (sourcePart, predicate) => parts.find(q => sameModel(q, sourcePart) && predicate(q));

  // New: also detect additional companion parts by name when OLED is selected
  const hasText = (p, s) => compositeText(p).includes(s);
  const isTapeUB = (p) => hasText(p, 'tape double face-ub');
  const isTapeFrontSide = (p) => hasText(p, 'tape double face-front side');
  const isASRepairKit = (p) => hasText(p, 'a/s repair kit');

  // New: predicates for OCTA / PBA / Sub PBA selections and related accessories
  const isOCTAPart = (p) => compositeText(p).includes('octa');
  const isPBAPart = (p) => compositeText(p).includes('pba');
  const isSubPBAPart = (p) => {
    const t = compositeText(p);
    return t.includes('sub pba') || t.includes('sub-pba') || t.includes('subpba');
  };
  // Make Non-OLED kit mutually exclusive with SVC/BC/Tape variants to avoid double matches
  const isASRepairKitNonOLED = (p) => {
    const t = compositeText(p);
    return t.includes('a/s') && t.includes('repair kit') &&
      !(t.includes('oled') || t.includes('amoled')) &&
      !(t.includes('svc') || t.includes('b/c') || t.includes('back cover') || t.includes('tape'));
  };
  const isASRepairKitSVC = (p) => {
    const t = compositeText(p);
    return t.includes('a/s') && t.includes('repair kit') && t.includes('svc');
  };
  const isASRepairKitBC = (p) => {
    const t = compositeText(p);
    return t.includes('a/s') && t.includes('repair kit') && (t.includes('b/c') || t.includes('back cover'));
  };
  const isASSVCTapeBackCover = (p) => {
    const t = compositeText(p);
    return t.includes('a/s') && t.includes('svc') && t.includes('tape') && (t.includes('back cover') || t.includes('b/c'));
  };

  // New: detect battery or camera main parts
  const isBatteryPart = (p) => {
    const t = compositeText(p);
    return t.includes('battery') || t.includes('batt');
  };
  const isCameraPart = (p) => {
    const t = compositeText(p);
    return t.includes('camera');
  };

  // Central helper to compute extras for a selected part (OLED or OCTA/PBA/Sub PBA/Battery/Camera) with de-dup
  const computeExtrasForSelected = (selected, alreadyIds = new Set()) => {
    const extras = [];
    const extrasIds = new Set();
    const pushExtra = (part) => {
      const id = Number(part?.id);
      if (!id) return;
      if (!alreadyIds.has(id) && !extrasIds.has(id)) {
        extras.push({ partId: id, qty: 1 });
        extrasIds.add(id);
      }
    };

    if (!selected) return extras;

    if (isOLEDPart(selected)) {
      const kitOLED = findKitForModel(selected, isRepairKitOLED);
      const kitBC = findKitForModel(selected, isRepairKitBC);
      const tapeUB = findKitForModel(selected, isTapeUB);
      const tapeFront = findKitForModel(selected, isTapeFrontSide);
      const asRepair = findKitForModel(selected, isASRepairKit);
      if (kitOLED) pushExtra(kitOLED);
      if (kitBC) pushExtra(kitBC);
      if (tapeUB) pushExtra(tapeUB);
      if (tapeFront) pushExtra(tapeFront);
      if (asRepair) pushExtra(asRepair);
    } else if (
      isOCTAPart(selected) ||
      isPBAPart(selected) ||
      isSubPBAPart(selected) ||
      isBatteryPart(selected) ||
      isCameraPart(selected)
    ) {
      const candNonOLED = findKitForModel(selected, isASRepairKitNonOLED);
      const candSVC = findKitForModel(selected, isASRepairKitSVC);
      const candBC = findKitForModel(selected, isASRepairKitBC);
      const candTapeBackCover = findKitForModel(selected, isASSVCTapeBackCover);
      if (candNonOLED) pushExtra(candNonOLED);
      if (candSVC) pushExtra(candSVC);
      if (candBC) pushExtra(candBC);
      if (candTapeBackCover) pushExtra(candTapeBackCover);
    }

    return extras;
  };

  // New: helper to map samsung category to a formula id
  const pickFormulaIdForCategory = (category) => {
    if (!category || !formulas?.length) return null;
    const c = String(category).toLowerCase();
    const tokenMap = {
      highend: 'high',
      midend: 'mid',
      lowend: 'low',
      tab: 'tab',
      wearable: 'wear',
    };
    const token = tokenMap[c] || c;
    const match = formulas.find(f => String(f.class_name || '').toLowerCase().includes(token));
    return match?.id ? String(match.id) : null;
  };

  // New: auto-select formula when in auto mode, based on majority category across selected parts
  useEffect(() => {
    if (!autoFormula) return;
    // gather categories from selected parts
    const cats = selectedParts
      .map(sp => findPart(sp.partId)?.samsung_category)
      .filter(Boolean)
      .map(c => String(c).toLowerCase());
    if (!cats.length) {
      setAutoDetectedCategory(null);
      return;
    }
    // majority vote with priority fallback
    const counts = cats.reduce((acc, c) => { acc[c] = (acc[c] || 0) + 1; return acc; }, {});
    const priority = ['highend', 'midend', 'lowend', 'tab', 'wearable'];
    const majority = Object.keys(counts)
      .sort((a, b) => counts[b] - counts[a] || priority.indexOf(a) - priority.indexOf(b))[0];
    setAutoDetectedCategory(majority);
    const autoId = pickFormulaIdForCategory(majority);
    if (autoId && autoId !== selectedFormula) {
      setSelectedFormula(autoId);
    }
  }, [autoFormula, selectedParts, formulas]);

  // Row operations
  const addPartRow = () => setSelectedParts([...selectedParts, { partId: '', qty: 1 }]);
  const removePartRow = (idx) => setSelectedParts(selectedParts.filter((_, i) => i !== idx));
  const updateRowPart = (idx, value) => {
    const v = value === '' ? '' : Number(value);
    const next = [...selectedParts];
    next[idx] = { ...next[idx], partId: v };

    // If changing the main part (first row), clear other rows and reselect kits for the new main part
    if (idx === 0) {
      if (v === '' || v === null || v === undefined) {
        setSelectedParts([{ partId: '', qty: 1 }]);
        return;
      }
      if (autoAddKits) {
        const selected = findPart(v);
        const mainQty = next[0]?.qty || 1;
        // Start from clean slate for extras, only keep main row
        const alreadyIds = new Set([Number(v)]);
        const extras = computeExtrasForSelected(selected, alreadyIds);
        setSelectedParts([{ partId: Number(v), qty: mainQty }, ...extras]);
        return;
      } else {
        // No auto kits: keep only the main row
        const mainQty = next[0]?.qty || 1;
        setSelectedParts([{ partId: v, qty: mainQty }]);
        return;
      }
    }

    // Auto add kits for non-main rows as before
    if (autoAddKits && v !== '' && v !== null && v !== undefined) {
      const selected = findPart(v);
      if (selected) {
        const alreadyIds = new Set(next.filter(sp => sp.partId).map(sp => Number(sp.partId)));
        const extras = computeExtrasForSelected(selected, alreadyIds);
        if (extras.length) {
          setSelectedParts([...next, ...extras]);
          return;
        }
      }
    }

    setSelectedParts(next);
  };
  const updateRowQty = (idx, qty) => {
    const q = Math.max(1, Number(qty) || 1);
    const next = [...selectedParts];
    next[idx] = { ...next[idx], qty: q };
    setSelectedParts(next);
  };

  // Manual MAP list handlers
  const addManualMap = () => setManualMaps([...manualMaps, '']);
  const updateManualMap = (idx, value) => {
    const next = [...manualMaps];
    next[idx] = value;
    setManualMaps(next);
  };
  const removeManualMap = (idx) => setManualMaps(manualMaps.filter((_, i) => i !== idx));

  // New: clear all selected parts & manual MAP inputs
  const clearPartAndMapInputs = () => {
    setSelectedParts([{ partId: '', qty: 1 }]);
    setManualMaps([]);
    setCalcCustomer(null);
    setCalcDealer(null);
    toast.success('Inputs cleared');
  };

  // Totals
  const partsTotalMap = useMemo(() => selectedParts.reduce((sum, sp) => {
    const p = findPart(sp.partId);
    const base = (p?.map_price ?? p?.net_price ?? 0) || 0;
    const qty = sp.qty || 1;
    if (!sp.partId) return sum;
    return sum + Number(base) * qty;
  }, 0), [selectedParts, parts]);

  const manualTotalMap = useMemo(() => manualMaps.reduce((sum, v) => sum + (Number(v) || 0), 0), [manualMaps]);

  const displayTotalMap = partsTotalMap + manualTotalMap;

  // Allow labor-only for Level 1 and Level 3
  const allowLaborOnly = laborLevel === '1' || laborLevel === 1 || laborLevel === '3' || laborLevel === 3;

  const handleCalculate = async () => {
    if (!selectedFormula) {
      toast.error('Please select a formula');
      return;
    }

    // Allow labor-only calculation for levels 1 and 3 even when no parts/MAP are selected
    if (!(displayTotalMap > 0) && !allowLaborOnly) {
      toast.error('Add parts or manual MAP (or choose Labor 1 or 3 for labor-only)');
      return;
    }

    const basePayload = {
      formula_id: parseInt(selectedFormula),
      labor_level: laborLevel,
    };

    // Always send compounded total as manual_total_map (parts + manual maps)
    const payloadWithBase = { ...basePayload, manual_total_map: Number(displayTotalMap) };

    try {
      setIsCalculating(true);
      setCalcCustomer(null);
      setCalcDealer(null);
      const [custRes, dealRes] = await Promise.all([
        axios.post(`${API}/calculate-price`, { ...payloadWithBase, customer_type: 'customer' }),
        axios.post(`${API}/calculate-price`, { ...payloadWithBase, customer_type: 'dealer' })
      ]);
      setCalcCustomer(custRes.data);
      setCalcDealer(dealRes.data);
      toast.success('Prices calculated successfully');
    } catch (e) {
      toast.error('Failed to calculate prices');
    } finally {
      setIsCalculating(false);
    }
  };

  // Color helpers for part code
  const getPartCodeClass = (part) => {
    const text = `${part?.code || ''} ${part?.description || ''}`.toUpperCase();
    if (text.includes('LCD')) return 'text-blue-600 dark:text-blue-400';
    if (text.includes('PBA')) return 'text-purple-600 dark:text-purple-400';
    return 'text-gray-900 dark:text-gray-200';
  };
  const getCodeClass = (code) => {
    const text = (code || '').toString().toUpperCase();
    if (text.includes('LCD')) return 'text-blue-600 dark:text-blue-400';
    if (text.includes('PBA')) return 'text-purple-600 dark:text-purple-400';
    return 'text-gray-900 dark:text-gray-200';
  };
  // New: category badge styles
  const categoryBadge = (cat) => {
    const c = (cat || '').toLowerCase();
    if (c === 'highend') return 'bg-purple-100 text-purple-800';
    if (c === 'midend') return 'bg-indigo-100 text-indigo-800';
    if (c === 'lowend') return 'bg-green-100 text-green-800';
    if (c === 'tab') return 'bg-blue-100 text-blue-800';
    if (c === 'wearable') return 'bg-amber-100 text-amber-800';
    return 'bg-gray-100 text-gray-800';
  };

  // Helper to format margin percent (accepts 0.03 or 3 -> '3%')
  const formatMarginPct = (v) => {
    if (v === null || v === undefined || v === '') return '0%';
    const num = Number(v);
    if (Number.isNaN(num)) return '0%';
    const pct = num < 1 ? num * 100 : num;
    return `${Math.round(pct * 100) / 100}%`;
  };

  const defaultMarginPctForClass = (className) => {
    const cls = (className || '').toLowerCase();
    if (cls.startsWith('low')) return 3;
    if (cls.startsWith('mid')) return 2;
    if (cls.startsWith('high')) return 1;
    if (cls.startsWith('wear')) return 1;
    if (cls.startsWith('tab')) return 2;
    return 0;
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 transition-colors" />
      <div className="absolute inset-0 opacity-50 [background-image:radial-gradient(circle_at_15%_20%,rgba(99,102,241,0.35),transparent_55%),radial-gradient(circle_at_85%_80%,rgba(168,85,247,0.35),transparent_55%)]" />
      <div className="relative max-w-screen-2xl mx-auto py-10 px-4 sm:px-6 lg:px-10">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="mx-auto h-20 w-20 flex items-center justify-center rounded-3xl bg-gradient-to-r from-indigo-500 to-purple-600 shadow-xl shadow-indigo-300/40 mb-6 ring-2 ring-white/50">
            <Calculator className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">Price Calculator</h1>
          <p className="mt-4 text-slate-600 dark:text-slate-400 text-lg max-w-2xl mx-auto">Calculate final pricing with intelligent labor costs and real-time exchange rates</p>
        </div>

        {/* Main Card Frame */}
        <div className="p-[3px] rounded-3xl bg-gradient-to-br from-indigo-400/60 via-fuchsia-400/50 to-pink-400/60 shadow-2xl shadow-indigo-200/50 dark:shadow-none">
          <div className="bg-white/80 dark:bg-gray-900/70 backdrop-blur-2xl rounded-[inherit] p-8 lg:p-10 transition-colors">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 items-start">
              {/* Part Selection */}
              <div className="space-y-7 bg-gradient-to-br from-white/70 to-indigo-50/60 dark:from-gray-900/60 dark:to-gray-800/40 rounded-2xl p-6 lg:col-span-2 border border-slate-300/80 dark:border-slate-600/80 ring-1 ring-white/60 dark:ring-gray-900/40 shadow-inner">
                <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 flex items-center">
                  <span className="p-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white mr-3 shadow-md shadow-indigo-300/40"><Puzzle className="h-5 w-5" /></span>
                  Parts & MAP Inputs
                </h3>

                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 h-5 w-5" />
                  <input
                    type="text"
                    placeholder="Search parts by code or text..."
                    className="pl-12 w-full border border-slate-200/70 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-transparent transition-all bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 text-gray-900 dark:text-gray-100"
                    value={partSearch}
                    onChange={(e) => setPartSearch(e.target.value)}
                  />
                </div>

                <div className="relative">
                  <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 h-5 w-5" />
                  <select
                    className="pl-12 w-full border border-slate-200/70 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-transparent transition-all bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm appearance-none shadow-sm text-gray-900 dark:text-gray-100"
                    value={deviceFilter}
                    onChange={(e) => setDeviceFilter(e.target.value)}
                  >
                    <option value="">All Devices</option>
                    {deviceOptions.map((opt) => (
                      <option key={opt.key} value={opt.key}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-5 rounded-xl border border-slate-200/60 dark:border-slate-700 shadow">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">Selected Items</h4>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100/80 dark:bg-gray-800/80 px-3 py-1 rounded-full">
                      <input type="checkbox" checked={autoAddKits} onChange={(e) => setAutoAddKits(e.target.checked)} className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500" />
                      Auto add kits
                    </label>
                  </div>

                  <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1 custom-scroll">
                    {selectedParts.map((sp, idx) => {
                      const p = findPart(sp.partId);
                      const base = (p?.map_price ?? p?.net_price ?? 0) || 0;
                      const qty = sp.qty || 1;
                      const rowTotal = Number(base) * qty;
                      const hasPart = sp.partId !== '' && sp.partId !== null && sp.partId !== undefined;
                      return (
                        <div key={idx} className="flex flex-wrap items-center gap-2 text-xs md:text-sm min-w-0 bg-slate-50/70 dark:bg-gray-800/50 rounded-lg p-2 border border-slate-200/60 dark:border-slate-700">
                          <select
                            className="grow min-w-[220px] border border-slate-300 dark:border-slate-600 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-transparent bg-white/70 dark:bg-gray-800/70 text-gray-900 dark:text-gray-100"
                            value={hasPart ? sp.partId : ''}
                            onChange={(e) => updateRowPart(idx, e.target.value)}
                          >
                            <option value="">Select a part...</option>
                            {filteredParts.map((part) => (
                              <option key={part.id} value={part.id}>{part.code} - {part.description}</option>
                            ))}
                          </select>
                          {hasPart && (
                            <span className={`inline-flex px-2 py-1 rounded-full text-[10px] font-semibold ${categoryBadge(p?.samsung_category)} shrink-0`}>{p?.samsung_category || '-'}</span>
                          )}
                          <span className="text-slate-500 dark:text-slate-400">Qty</span>
                          <input
                            type="number"
                            min={1}
                            value={sp.qty}
                            onChange={(e) => updateRowQty(idx, e.target.value)}
                            className="w-16 border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-transparent bg-white/70 dark:bg-gray-800/70 text-gray-900 dark:text-gray-100"
                          />
                          <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">x ${Number(base).toFixed(2)}</span>
                          <span className="font-medium whitespace-nowrap text-slate-800 dark:text-slate-200">= ${rowTotal.toFixed(2)}</span>
                          <button type="button" onClick={() => removePartRow(idx)} className="text-red-500/80 hover:text-red-600 dark:hover:text-red-400 ml-auto">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button type="button" onClick={addPartRow} className="inline-flex items-center px-4 py-2 text-xs md:text-sm font-medium rounded-xl text-indigo-600 dark:text-indigo-400 bg-white/80 dark:bg-gray-800/70 border border-indigo-200 dark:border-indigo-600/40 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all shadow-sm hover:shadow">
                      <Plus className="h-4 w-4 mr-2" /> Add Row
                    </button>
                    <button type="button" onClick={addManualMap} className="inline-flex items-center px-4 py-2 text-xs md:text-sm font-medium rounded-xl text-amber-600 dark:text-amber-400 bg-white/80 dark:bg-gray-800/70 border border-amber-200 dark:border-amber-600/40 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-all shadow-sm hover:shadow">
                      <Plus className="h-4 w-4 mr-2" /> Add MAP
                    </button>
                    <button type="button" onClick={clearPartAndMapInputs} className="inline-flex items-center px-4 py-2 text-xs md:text-sm font-medium rounded-xl text-rose-600 dark:text-rose-400 bg-white/80 dark:bg-gray-800/70 border border-rose-200 dark:border-rose-600/40 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all shadow-sm hover:shadow">
                      <Trash2 className="h-4 w-4 mr-2" /> Clear
                    </button>
                  </div>

                  {manualMaps.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {manualMaps.map((val, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs md:text-sm bg-slate-50/70 dark:bg-gray-800/50 p-2 rounded-lg border border-slate-200/60 dark:border-slate-700">
                          <label className="w-20 text-slate-600 dark:text-slate-400 font-medium">MAP {idx + 1}</label>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={val}
                            onChange={(e) => updateManualMap(idx, e.target.value)}
                            className="flex-1 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-transparent bg-white/70 dark:bg-gray-800/70 text-gray-900 dark:text-gray-100"
                            placeholder="0.00"
                          />
                          <button type="button" onClick={() => removeManualMap(idx)} className="text-red-500/80 hover:text-red-600 dark:hover:text-red-400">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 text-right text-xs md:text-sm leading-5 font-medium bg-slate-100/60 dark:bg-gray-800/60 rounded-lg p-3">
                    <div className="flex flex-wrap justify-end gap-x-4 gap-y-1">
                      <span className="text-slate-500 dark:text-slate-400">Parts MAP: <span className="text-slate-800 dark:text-slate-200">${partsTotalMap.toFixed(2)}</span></span>
                      <span className="text-slate-500 dark:text-slate-400">Manual MAP: <span className="text-slate-800 dark:text-slate-200">${manualTotalMap.toFixed(2)}</span></span>
                      <span className="text-slate-500 dark:text-slate-400">Total MAP: <span className="text-indigo-600 dark:text-indigo-400 font-semibold">${displayTotalMap.toFixed(2)}</span></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Formula & Results */}
              <div className="space-y-7 bg-gradient-to-br from-white/70 to-fuchsia-50/60 dark:from-gray-900/60 dark:to-gray-800/40 rounded-2xl p-6 lg:col-span-3 border border-slate-300/80 dark:border-slate-600/80 ring-1 ring-white/60 dark:ring-gray-900/40 shadow-inner">
                <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 flex items-center">
                  <span className="p-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-600 text-white mr-3 shadow-md shadow-purple-300/40"><DollarSign className="h-5 w-5" /></span>
                  Formula & Calculation
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
                  <div className="space-y-5 md:col-span-1">
                    <div>
                      <label className="block text-xs font-semibold tracking-wide uppercase text-slate-600 dark:text-slate-400 mb-2">Formula</label>
                      <select
                        className="w-full border border-slate-200/70 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/60 focus:border-transparent transition-all bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm appearance-none shadow-sm text-gray-900 dark:text-gray-100"
                        value={selectedFormula}
                        onChange={(e) => { setSelectedFormula(e.target.value); setAutoFormula(false); }}
                      >
                        <option value="">Select a formula...</option>
                        {formulas.map((formula) => (
                          <option key={formula.id} value={formula.id}>{formula.class_name}</option>
                        ))}
                      </select>
                      <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-2">
                        {autoFormula ? (
                          <>
                            <span className="px-2 py-0.5 rounded bg-slate-200/60 dark:bg-gray-700 text-slate-700 dark:text-slate-300">Auto: {autoDetectedCategory || '—'}</span>
                            <button type="button" className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 underline" onClick={() => setAutoFormula(false)}>Manual</button>
                          </>
                        ) : (
                          <button type="button" className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 underline" onClick={() => { setAutoFormula(true); }}>
                            Use auto-detect
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold tracking-wide uppercase text-slate-600 dark:text-slate-400 mb-2">Labor Level</label>
                      <select
                        className="w-full border border-slate-200/70 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/60 focus:border-transparent transition-all bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm appearance-none shadow-sm text-gray-900 dark:text-gray-100"
                        value={laborLevel}
                        onChange={(e) => setLaborLevel(e.target.value)}
                      >
                        <option value="1">Level 1</option>
                        <option value="2_major">Level 2 Major</option>
                        <option value="2_minor">Level 2 Minor</option>
                        <option value="3">Level 3</option>
                      </select>
                    </div>
                  </div>

                  {(calcCustomer || calcDealer) && (
                    <div className="md:col-span-3 bg-white/85 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-2xl border border-slate-300/80 dark:border-slate-600/80 ring-1 ring-white/50 dark:ring-gray-900/40 shadow-md space-y-4 transition-colors">
                      <div className="flex items-center">
                        <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg mr-3 shadow-md shadow-emerald-300/40">
                          <DollarSign className="h-5 w-5 text-white" />
                        </div>
                        <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Calculation Results</h4>
                      </div>
                      <dl className="grid grid-cols-2 gap-3 text-xs md:text-sm">
                        <div className="bg-slate-50/70 dark:bg-gray-800/60 rounded-md p-2 border border-slate-200/60 dark:border-slate-700 flex flex-col">
                          <dt className="text-slate-500 dark:text-slate-400">Formula Class</dt>
                          <dd className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">{(calcCustomer || calcDealer)?.formula_class}</dd>
                        </div>
                        <div className="bg-slate-50/70 dark:bg-gray-800/60 rounded-md p-2 border border-slate-200/60 dark:border-slate-700 flex flex-col">
                          <dt className="text-slate-500 dark:text-slate-400">Labor Level</dt>
                          <dd className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">{(calcCustomer || calcDealer)?.labor_level_used}</dd>
                        </div>
                        <div className="bg-slate-50/70 dark:bg-gray-800/60 rounded-md p-2 border border-slate-200/60 dark:border-slate-700 flex flex-col">
                          <dt className="text-slate-500 dark:text-slate-400">Exchange Rate</dt>
                          <dd className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">{(calcCustomer || calcDealer)?.exchange_rate}</dd>
                        </div>
                        <div className="bg-slate-50/70 dark:bg-gray-800/60 rounded-md p-2 border border-slate-200/60 dark:border-slate-700 flex flex-col">
                          <dt className="text-slate-500 dark:text-slate-400">Total MAP</dt>
                          <dd className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">${displayTotalMap.toFixed(2)}</dd>
                        </div>
                      </dl>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {calcCustomer && (
                          <div className="rounded-xl border border-slate-300/80 dark:border-slate-600/80 ring-1 ring-white/50 dark:ring-gray-900/40 bg-gradient-to-br from-white/90 to-green-50/70 dark:from-gray-900/70 dark:to-emerald-900/20 p-4 shadow-inner space-y-1 text-xs md:text-sm transition-colors">
                            <h5 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-1">Customer</h5>
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Base MAP</span><span className="font-medium text-slate-800 dark:text-slate-200">${calcCustomer.total_map.toFixed(2)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Labor</span><span className="font-medium text-slate-800 dark:text-slate-200">${calcCustomer.labor_cost.toFixed(2)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Margin</span><span className="font-medium text-slate-800 dark:text-slate-200">${calcCustomer.margin.toFixed(2)}</span></div>
                            {/* Enhanced divider */}
                            <div className="mt-2 h-[2px] rounded-full bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-600 to-transparent" />
                            <div className="flex justify-between mt-1"><span className="font-semibold text-slate-700 dark:text-slate-300">Final (USD)</span><span className="font-semibold text-green-600 dark:text-green-400">${calcCustomer.final_price_usd.toFixed(2)}</span></div>
                            <div className="flex justify-between"><span className="font-semibold text-slate-700 dark:text-slate-300">Final (IQD)</span><span className="font-bold text-green-600 dark:text-green-400">{calcCustomer.final_price_iqd.toLocaleString()} IQD</span></div>
                          </div>
                        )}
                        {calcDealer && (
                          <div className="rounded-xl border border-slate-300/80 dark:border-slate-600/80 ring-1 ring-white/50 dark:ring-gray-900/40 bg-gradient-to-br from-white/90 to-emerald-50/60 dark:from-gray-900/70 dark:to-emerald-900/20 p-4 shadow-inner space-y-1 text-xs md:text-sm transition-colors">
                            <h5 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-1">Dealer</h5>
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Base MAP</span><span className="font-medium text-slate-800 dark:text-slate-200">${calcDealer.total_map.toFixed(2)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Labor</span><span className="font-medium text-slate-800 dark:text-slate-200">${calcDealer.labor_cost.toFixed(2)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Margin</span><span className="font-medium text-slate-800 dark:text-slate-200">${calcDealer.margin.toFixed(2)}</span></div>
                            {/* Enhanced divider */}
                            <div className="mt-2 h-[2px] rounded-full bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-600 to-transparent" />
                            <div className="flex justify-between mt-1"><span className="font-semibold text-slate-700 dark:text-slate-300">Final (USD)</span><span className="font-semibold text-green-600 dark:text-green-400">${calcDealer.final_price_usd.toFixed(2)}</span></div>
                            <div className="flex justify-between"><span className="font-semibold text-slate-700 dark:text-slate-300">Final (IQD)</span><span className="font-bold text-green-600 dark:text-green-400">{calcDealer.final_price_iqd.toLocaleString()} IQD</span></div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-12 text-center">
              <button
                onClick={handleCalculate}
                disabled={(!selectedFormula) || (!allowLaborOnly && displayTotalMap <= 0) || isCalculating}
                className="group relative inline-flex items-center px-10 py-5 text-lg font-semibold rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/60 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-purple-300/40 dark:shadow-purple-900/40 hover:shadow-2xl hover:-translate-y-0.5 overflow-hidden"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 group_hover:from-indigo-500 group_hover:via-purple-500 group_hover:to-pink-500 transition-colors" />
                <span className="relative flex items-center">
                  {isCalculating ? (
                    <>
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-white/70 border-t-transparent mr-3" />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <Calculator className="h-6 w-6 mr-3" />
                      Calculate Price
                    </>
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PriceCalculator;
