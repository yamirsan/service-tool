import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Calculator, Search, DollarSign, Trash2, Plus, Puzzle, Wrench, Smartphone } from 'lucide-react';
const API = process.env.REACT_APP_API_BASE || '';

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
    if (text.includes('LCD')) return 'text-blue-600';
    if (text.includes('PBA')) return 'text-purple-600';
    return 'text-gray-900';
  };
  const getCodeClass = (code) => {
    const text = (code || '').toString().toUpperCase();
    if (text.includes('LCD')) return 'text-blue-600';
    if (text.includes('PBA')) return 'text-purple-600';
    return 'text-gray-900';
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
    <div className="min-h-screen bg-transparent">
      <div className="max-w-screen-2xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="px-4 py-6 sm:px-0">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-primary-100 mb-4">
              <Calculator className="h-6 w-6 text-primary-600" />
            </div>
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-primary-700 via-pink-600 to-violet-700 bg-clip-text text-transparent">Price Calculator</h1>
            <p className="mt-2 text-gray-700">Calculate final pricing with labor costs and exchange rates</p>
          </div>
        </div>

        {/* Calculator Form */}
        <div className="px-4 sm:px-0">
          <div className="bg-white/90 backdrop-blur rounded-lg shadow border border-gray-100 p-6">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-y-8 gap-x-10 items-start">
              {/* Part Selection */}
              <div className="space-y-4 bg-gray-50 rounded-lg p-4 lg:col-span-2">
                <h3 className="text-lg font-medium text-gray-900">Select Parts</h3>
                
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search parts..."
                    className="pl-10 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    value={partSearch}
                    onChange={(e) => setPartSearch(e.target.value)}
                  />
                </div>

                {/* Device filter: show only selected device's parts */}
                <div className="relative">
                  <Smartphone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <select
                    className="pl-10 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    value={deviceFilter}
                    onChange={(e) => setDeviceFilter(e.target.value)}
                  >
                    <option value="">All Devices</option>
                    {deviceOptions.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dynamic rows */}
                <div className="bg-white p-3 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">Selected Items</h4>
                    <label className="flex items-center gap-2 text-xs text-gray-600">
                      <input type="checkbox" checked={autoAddKits} onChange={(e) => setAutoAddKits(e.target.checked)} />
                      Auto add OLED repair kits (same model)
                    </label>
                  </div>
                  <div className="space-y-2">
                    {selectedParts.map((sp, idx) => {
                      const p = findPart(sp.partId);
                      const base = (p?.map_price ?? p?.net_price ?? 0) || 0;
                      const qty = sp.qty || 1;
                      const rowTotal = Number(base) * qty;
                      const hasPart = sp.partId !== '' && sp.partId !== null && sp.partId !== undefined;
                      return (
                        <div key={idx} className="flex flex-wrap items-center gap-2 text-sm min-w-0">
                          <select
                            className="grow min-w-[220px] border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            value={hasPart ? sp.partId : ''}
                            onChange={(e) => updateRowPart(idx, e.target.value)}
                          >
                            <option value="">Select a part...</option>
                            {filteredParts.map((part) => (
                              <option key={part.id} value={part.id}>
                                {part.code} - {part.description}
                              </option>
                            ))}
                          </select>
                          {hasPart && (
                            <span
                              className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${categoryBadge(p?.samsung_category)} shrink-0`}
                              title="Samsung category"
                            >
                              {p?.samsung_category || '-'}
                            </span>
                          )}
                          <label className="text-gray-600 shrink-0">Qty</label>
                          <input
                            type="number"
                            min={1}
                            value={sp.qty}
                            onChange={(e) => updateRowQty(idx, e.target.value)}
                            className="w-16 border border-gray-300 rounded-md px-2 py-1"
                          />
                          <span className="text-gray-600 whitespace-nowrap shrink-0">x ${Number(base).toFixed(2)}</span>
                          <span className="font-medium whitespace-nowrap shrink-0">= ${rowTotal.toFixed(2)}</span>
                          <button onClick={() => removePartRow(idx)} className="text-red-600 hover:text-red-800 ml-auto">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={addPartRow}
                      className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md text-primary-600 bg-white border border-primary-600 hover:bg-primary-50"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add another row
                    </button>
                    <button
                      type="button"
                      onClick={addManualMap}
                      className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md text-amber-700 bg-white border border-amber-400 hover:bg-amber-50"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add MAP
                    </button>
                  </div>

                  {manualMaps.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {manualMaps.map((val, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <label className="w-20 text-sm text-gray-700">MAP {idx + 1}</label>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={val}
                            onChange={(e) => updateManualMap(idx, e.target.value)}
                            className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            placeholder="0.00"
                          />
                          <button type="button" onClick={() => removeManualMap(idx)} className="text-red-600 hover:text-red-800">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 text-right text-sm">
                    <span className="text-gray-600">Parts MAP: </span>
                    <span className="font-medium mr-4">${partsTotalMap.toFixed(2)}</span>
                    <span className="text-gray-600">Manual MAP: </span>
                    <span className="font-medium mr-4">${manualTotalMap.toFixed(2)}</span>
                    <span className="text-gray-600">Total MAP (USD): </span>
                    <span className="font-semibold">${displayTotalMap.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Right Panel: Formula + Results */}
              <div className="space-y-5 bg-gray-50 rounded-lg p-4 lg:col-span-3">
                <h3 className="text-lg font-medium text-gray-900">Select Formula & Labor Level</h3>
                
                {/* Top row: selects on the left, results on the right */}
                <div className="grid grid-cols-1 md:grid-cols-4 md:gap-6 gap-4 items-start">
                  {/* Left: Selects */}
                  <div className="space-y-4 md:col-span-1">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Formula</label>
                      <select
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        value={selectedFormula}
                        onChange={(e) => { setSelectedFormula(e.target.value); setAutoFormula(false); }}
                      >
                        <option value="">Select a formula...</option>
                        {formulas.map((formula) => (
                          <option key={formula.id} value={formula.id}>
                            {formula.class_name}
                          </option>
                        ))}
                      </select>
                      {/* Auto formula helper */}
                      <div className="mt-1 text-xs text-gray-600 flex items-center gap-2">
                        {autoFormula ? (
                          <>
                            <span>Use auto based on detected category{autoDetectedCategory ? ` (${autoDetectedCategory})` : ''}</span>
                            <button type="button" className="text-primary-600 underline" onClick={() => setAutoFormula(false)}>Switch to manual</button>
                          </>
                        ) : (
                          <button type="button" className="text-primary-600 underline" onClick={() => { setAutoFormula(true); }}>
                            Use auto based on detected category
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Labor Level</label>
                      <select
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
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

                  {/* Right: Calculation Results (compact, sticky, wider) */}
                  {(calcCustomer || calcDealer) && (
                    <div className="md:col-span-3 bg-white p-4 rounded-lg border border-gray-200 shadow-sm md:sticky md:top-2">
                      <div className="flex items-center mb-3">
                        <DollarSign className="h-5 w-5 text-green-600 mr-2" />
                        <h4 className="text-sm font-semibold text-gray-900">Price Calculation Results</h4>
                      </div>

                      {/* Common Info */}
                      <dl className="divide-y divide-gray-100 text-sm">
                        <div className="py-1.5 grid grid-cols-2 gap-2">
                          <dt className="text-gray-600">Formula Class</dt>
                          <dd className="text-right font-medium">{(calcCustomer || calcDealer)?.formula_class}</dd>
                        </div>
                        <div className="py-1.5 grid grid-cols-2 gap-2">
                          <dt className="text-gray-600">Labor Level Used</dt>
                          <dd className="text-right font-medium">{(calcCustomer || calcDealer)?.labor_level_used}</dd>
                        </div>
                        <div className="py-1.5 grid grid-cols-2 gap-2">
                          <dt className="text-gray-600">Exchange Rate</dt>
                          <dd className="text-right font-medium">{(calcCustomer || calcDealer)?.exchange_rate}</dd>
                        </div>
                      </dl>

                      {/* Two-column results */}
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {calcCustomer && (
                          <div className="border rounded-md p-3 bg-gray-50">
                            <h5 className="text-sm font-semibold mb-2">Customer</h5>
                            <dl className="text-sm">
                              <div className="py-1.5 grid grid-cols-2 gap-2">
                                <dt className="text-gray-600">Base Price (MAP)</dt>
                                <dd className="text-right font-medium">${calcCustomer.total_map.toFixed(2)}</dd>
                              </div>
                              <div className="py-1.5 grid grid-cols-2 gap-2">
                                <dt className="text-gray-600">Labor Cost</dt>
                                <dd className="text-right font-medium">${calcCustomer.labor_cost.toFixed(2)}</dd>
                              </div>
                              <div className="py-1.5 grid grid-cols-2 gap-2">
                                <dt className="text-gray-600">Margin (USD)</dt>
                                <dd className="text-right font-medium">${calcCustomer.margin.toFixed(2)}</dd>
                              </div>
                              <div className="pt-2 mt-1 grid grid-cols-2 gap-2">
                                <dt className="text-gray-900 font-semibold">Final Price (USD)</dt>
                                <dd className="text-right font-semibold text-green-600">${calcCustomer.final_price_usd.toFixed(2)}</dd>
                              </div>
                              <div className="pb-2 grid grid-cols-2 gap-2">
                                <dt className="text-gray-900 font-semibold">Final Price (IQD)</dt>
                                <dd className="text-right font-bold text-green-600">{calcCustomer.final_price_iqd.toLocaleString()} IQD</dd>
                              </div>
                            </dl>
                            <div className="mt-2 p-2 bg-white rounded text-xs text-gray-600">
                              (Total MAP: ${calcCustomer.total_map.toFixed(2)} + Labor: ${calcCustomer.labor_cost.toFixed(2)} + Margin: ${calcCustomer.margin.toFixed(2)}) × Rate: {calcCustomer.exchange_rate} = {calcCustomer.final_price_iqd.toLocaleString()} IQD
                            </div>
                          </div>
                        )}

                        {calcDealer && (
                          <div className="border rounded-md p-3 bg-gray-50">
                            <h5 className="text-sm font-semibold mb-2">Dealer</h5>
                            <dl className="text-sm">
                              <div className="py-1.5 grid grid-cols-2 gap-2">
                                <dt className="text-gray-600">Base Price (MAP)</dt>
                                <dd className="text-right font-medium">${calcDealer.total_map.toFixed(2)}</dd>
                              </div>
                              <div className="py-1.5 grid grid-cols-2 gap-2">
                                <dt className="text-gray-600">Labor Cost</dt>
                                <dd className="text-right font-medium">${calcDealer.labor_cost.toFixed(2)}</dd>
                              </div>
                              <div className="py-1.5 grid grid-cols-2 gap-2">
                                <dt className="text-gray-600">Margin (USD)</dt>
                                <dd className="text-right font-medium">${calcDealer.margin.toFixed(2)}</dd>
                              </div>
                              <div className="pt-2 mt-1 grid grid-cols-2 gap-2">
                                <dt className="text-gray-900 font-semibold">Final Price (USD)</dt>
                                <dd className="text-right font-semibold text-green-600">${calcDealer.final_price_usd.toFixed(2)}</dd>
                              </div>
                              <div className="pb-2 grid grid-cols-2 gap-2">
                                <dt className="text-gray-900 font-semibold">Final Price (IQD)</dt>
                                <dd className="text-right font-bold text-green-600">{calcDealer.final_price_iqd.toLocaleString()} IQD</dd>
                              </div>
                            </dl>
                            <div className="mt-2 p-2 bg-white rounded text-xs text-gray-600">
                              (Total MAP: ${calcDealer.total_map.toFixed(2)} + Labor: ${calcDealer.labor_cost.toFixed(2)} + Margin: ${calcDealer.margin.toFixed(2)}) × Rate: {calcDealer.exchange_rate} = {calcDealer.final_price_iqd.toLocaleString()} IQD
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Removed Formula Details card */}
                {/* Removed Manual MAP section from right panel (moved to left) */}
              </div>
            </div>

            {/* Calculate Button */}
            <div className="mt-6 text-center">
              <button
                onClick={handleCalculate}
                disabled={(!selectedFormula) || (!allowLaborOnly && displayTotalMap <= 0) || isCalculating}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCalculating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Calculating...
                  </>
                ) : (
                  <>
                    <Calculator className="h-5 w-5 mr-2" />
                    Calculate Price
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PriceCalculator;
