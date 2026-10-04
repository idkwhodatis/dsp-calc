const EPSILON = 1e-8;
const DEFAULT_MAX_EXPANDED_NODES = 1000;
const DEFAULT_MAX_DEPTH = 64;

const positive = value => Number.isFinite(Number(value)) && Number(value) > EPSILON ? Number(value) : 0;
const canonicalItemId = item => `dependency-item:${encodeURIComponent(item)}`;
const finiteRateEntries = values => Object.entries(values || {}).map(([item, value]) => [item, positive(value)])
    .filter(([, value]) => value > 0);
const rateRecord = values => Object.fromEntries(finiteRateEntries(values));
const add = (map, item, rate) => map.set(item, (map.get(item) || 0) + rate);

/**
 * Read-only projection of one existing calculation; never calls the solver.
 *
 * roots: requested positive targets, with branchRate in the current display unit.
 * supplyRoots: otherwise-unrepresented physical sources, with globalRate instead
 *   of branchRate. Their immediate inputs are exact full-source consumption.
 * rows: depth-first roots followed by supplyRoots, useful for a compact table.
 * items/sources: canonical records to link to the ONE existing global editor.
 *
 * Branch rates are recipe requirements, NOT independent factories, allocations,
 * gross recirculation or summable production totals. A pooled supply terminates
 * a branch and points to its canonical records, rather than guessing routing.
 *
 * maxExpandedNodes bounds non-root occurrences. Every requested target and
 * otherwise-unrepresented source still gets a root, so the total row bound is
 * O(targets + sources + maxExpandedNodes), including on highly shared DAGs.
 * A capped node exposes omittedInputs and a reason; truncation is never silent.
 */
export function buildDependencyView(state, needs, calculation, options = {}) {
    const [production = {}, surplus = {}, details] = calculation || [];
    const settings = state.settings || {};
    const graph = state.item_graph || {};
    const maxExpandedNodes = Number.isSafeInteger(options.maxExpandedNodes) && options.maxExpandedNodes >= 0
        ? options.maxExpandedNodes : DEFAULT_MAX_EXPANDED_NODES;
    const maxDepth = Number.isSafeInteger(options.maxDepth) && options.maxDepth >= 0 ? options.maxDepth : DEFAULT_MAX_DEPTH;
    const sources = [];
    const warnings = [];

    function sourceRecord(line, kind, index) {
        const item = line.target_item;
        const sourceId = line.id || `${kind}-${index}-${item}`;
        const invalidFlow = [line.output, line.gross_output ?? line.output,
            ...Object.values(line.inputs || {}), ...Object.values(line.byproducts || {})]
            .some(value => value !== undefined && !Number.isFinite(Number(value)));
        return {
            id: `${kind}:${sourceId}`, sourceId, kind, item,
            canonicalId: `dependency-source:${encodeURIComponent(kind)}:${encodeURIComponent(sourceId)}`,
            outputRate: positive(line.output), grossRate: positive(line.gross_output ?? line.output),
            inputs: rateRecord(line.inputs), byproducts: rateRecord(line.byproducts),
            error: line.error || (invalidFlow ? 'non-finite-source-flow' : null), mineralized: line.mineralized === true,
        };
    }

    if (details?.automatic) {
        for (const [item, line] of Object.entries(details.automatic)) {
            sources.push(sourceRecord({...line, target_item: item}, 'automatic', sources.length));
        }
    } else {
        // Use the graph used by THIS legacy calculation. Rebuilding recipes can
        // subtly change mod, proliferation, recycling and zero-source behavior.
        for (const [item, amount] of Object.entries(production)) {
            const output = positive(amount);
            const itemGraph = graph[item] || {};
            const scale = values => Object.fromEntries(finiteRateEntries(values).map(([input, coefficient]) => [input, coefficient * output]));
            sources.push(sourceRecord({id: `automatic-${item}`, target_item: item, output,
                gross_output: output * (1 + positive(itemGraph.自消耗)),
                inputs: scale(itemGraph.原料), byproducts: scale(itemGraph.副产物),
                mineralized: Object.hasOwn(settings.mineralize_list || {}, item)}, 'automatic', sources.length));
        }
    }
    for (const [index, line] of (details?.sources || []).entries()) sources.push(sourceRecord(line, 'manual', index));
    for (const [index, line] of (details?.legacy_sources || []).entries()) sources.push(sourceRecord(line, 'legacy', index));

    if (!details && settings.natural_production_line?.length) {
        // ContextProvider migrates these before normal UI use. If a caller hands
        // us an older raw calculation, do not invent its missing source flows.
        warnings.push('legacy-source-details-unavailable');
        for (const [index, line] of settings.natural_production_line.entries()) {
            sources.push({...sourceRecord({target_item: line.目标物品, error: 'legacy-source-details-unavailable'}, 'legacy', index),
                outputRate: null, grossRate: null});
        }
    }

    const required = new Map(finiteRateEntries(needs));
    const external = new Map(Object.entries(needs || {}).filter(([, amount]) => Number.isFinite(Number(amount)) && Number(amount) < -EPSILON)
        .map(([item, amount]) => [item, -Number(amount)]));
    const coproducts = new Map();
    const primarySources = new Map();
    const coproductSources = new Map();
    for (const source of sources) {
        const primary = primarySources.get(source.item) || [];
        source.ordinal = source.kind === 'manual' ? primary.filter(line => line.kind === 'manual').length + 1 : null;
        primary.push(source);
        primarySources.set(source.item, primary);
        for (const [item, amount] of Object.entries(source.inputs)) add(required, item, amount);
        for (const [item, amount] of Object.entries(source.byproducts)) {
            add(coproducts, item, amount);
            const producers = coproductSources.get(item) || [];
            producers.push(source.id);
            coproductSources.set(item, producers);
        }
    }
    const itemOrder = new Set([...Object.keys(needs || {}), ...(details?.order || []), ...Object.keys(production),
        ...Object.keys(details?.groups || {}), ...required.keys(), ...external.keys(), ...primarySources.keys(), ...coproducts.keys()]);
    const flatOrder = new Set([...(details?.order || Object.keys(production)), ...Object.keys(details?.groups || {})]);
    const sourceLookup = new Map(sources.map(source => [source.id, source]));
    const items = Object.fromEntries([...itemOrder].filter(item => typeof item === 'string').map(item => {
        const lines = primarySources.get(item) || [];
        const automatic = lines.find(line => line.kind === 'automatic');
        const manualRate = lines.filter(line => line.kind !== 'automatic').reduce((total, line) => total + (line.outputRate || 0), 0);
        const automaticRate = automatic?.outputRate || 0;
        const externalRate = external.get(item) || 0;
        const byproductRate = coproducts.get(item) || 0;
        const group = details?.groups?.[item];
        const requiredRate = group ? positive(group.required) : required.get(item) || 0;
        const producedRate = automaticRate + manualRate + externalRate + byproductRate;
        const surplusRate = group ? positive(group.surplus) : Object.hasOwn(surplus, item)
            ? positive(surplus[item]) : Math.max(0, producedRate - requiredRate);
        const missingRate = group ? positive(group.missing) : Math.max(0, requiredRate - producedRate);
        const mineralized = Object.hasOwn(settings.mineralize_list || {}, item) || automatic?.mineralized === true;
        const hasManualSources = lines.some(line => line.kind === 'manual');
        const recipeId = state.item_data?.[item]?.[state.scheme_data?.item_recipe_choices?.[item]];
        const recipeInputs = state.game_data?.recipe_data?.[recipeId]?.原料 ?? graph[item]?.原料 ?? {};
        const flatByproductRate = (coproductSources.get(item) || []).reduce((total, id) => {
            const source = sourceLookup.get(id);
            return total + (source.kind === 'manual' || (source.kind === 'automatic' && Object.hasOwn(production, source.item))
                ? source.byproducts[item] : 0);
        }, 0);
        const hasCanonicalRow = flatOrder.has(item) && Object.hasOwn(state.item_data || graph, item)
            && (automaticRate + flatByproductRate >= 1e-6 || hasManualSources)
            && !(settings.hide_mines && !hasManualSources && (mineralized || !Object.keys(recipeInputs).length));
        const boundaryReasons = [];
        if (lines.some(line => line.error)) boundaryReasons.push('invalid-source');
        if (manualRate > EPSILON) boundaryReasons.push('manual-supply');
        if (byproductRate > EPSILON) boundaryReasons.push('byproduct-supply');
        if (externalRate > EPSILON) boundaryReasons.push('external-supply');
        if (surplusRate > EPSILON) boundaryReasons.push('overproduction');
        if (missingRate > 1e-6) boundaryReasons.push('missing-supply');
        return [item, {item, canonicalId: canonicalItemId(item), automaticRate, manualRate, byproductRate, externalRate,
            requiredRate, surplusRate, missingRate, boundaryReasons,
            mineralized, hasCanonicalRow, hasCanonicalGroup: hasCanonicalRow && hasManualSources,
            sourceIds: lines.map(line => line.id), coproductSourceIds: coproductSources.get(item) || [],
            automaticSourceId: automatic?.id || null, occurrenceIds: []}];
    }));
    const sourcesById = Object.fromEntries(sources.map(source => [source.id, source]));
    const rows = [];
    const coveredSources = new Set();
    let expandedNodes = 0;
    let truncated = false;

    function makeOccurrence({item, rate, id, parentId = null, depth = 0, scope = 'branch', source = null}) {
        const canonical = items[item];
        const occurrence = {id, item, kind: source ? 'supply' : 'demand', scope,
            branchRate: scope === 'branch' ? rate : null, globalRate: scope === 'global' ? rate : null,
            parentId, depth, canonicalId: canonical?.canonicalId || canonicalItemId(item),
            sourceId: source?.id || null, children: [], reason: null, boundaryReasons: [],
            shared: false, repeated: Boolean(canonical?.occurrenceIds.length),
            canonicalOccurrenceId: canonical?.occurrenceIds[0] || id, truncated: false, omittedInputs: []};
        canonical?.occurrenceIds.push(id);
        rows.push(occurrence);
        return occurrence;
    }

    function expandInputs(occurrence, inputRates, ancestors) {
        const inputs = finiteRateEntries(inputRates);
        for (let index = 0; index < inputs.length; index++) {
            if (occurrence.depth >= maxDepth || expandedNodes >= maxExpandedNodes) {
                occurrence.truncated = true;
                occurrence.reason = occurrence.depth >= maxDepth ? 'depth-limit' : 'node-limit';
                occurrence.omittedInputs = inputs.slice(index).map(([item, rate]) => ({item, rate, canonicalId: canonicalItemId(item)}));
                truncated = true;
                return;
            }
            const [item, rate] = inputs[index];
            expandedNodes++;
            const child = makeOccurrence({item, rate, id: `${occurrence.id}/input:${encodeURIComponent(item)}`,
                parentId: occurrence.id, depth: occurrence.depth + 1, scope: occurrence.scope});
            occurrence.children.push(child);
            expandDemand(child, rate, ancestors);
        }
    }

    function expandDemand(occurrence, rate, ancestors) {
        const {item} = occurrence;
        const canonical = items[item];
        if (ancestors.has(item)) {
            occurrence.reason = 'cycle';
            occurrence.referenceId = ancestors.get(item);
            return;
        }
        if (!canonical || !Object.hasOwn(state.item_data || graph, item)) {
            occurrence.reason = 'unknown-item';
            return;
        }
        if (canonical.mineralized) {
            occurrence.reason = 'mineralized';
            if (canonical.automaticSourceId) coveredSources.add(canonical.automaticSourceId);
            return;
        }
        if (canonical.boundaryReasons.length) {
            occurrence.reason = 'global-supply';
            occurrence.boundaryReasons = [...canonical.boundaryReasons];
            return;
        }
        const automatic = sourcesById[canonical.automaticSourceId];
        if (!automatic || !(automatic.outputRate > EPSILON)) {
            occurrence.reason = 'missing-supply';
            return;
        }
        coveredSources.add(automatic.id);
        const inputs = Object.fromEntries(Object.entries(automatic.inputs).map(([input, amount]) => [input, rate * (amount / automatic.outputRate)]));
        if (Object.values(inputs).some(amount => !Number.isFinite(amount))) {
            occurrence.reason = 'invalid-flow';
            warnings.push(`non-finite-branch:${occurrence.id}`);
            return;
        }
        if (!Object.keys(inputs).length) {
            occurrence.reason = 'raw';
            return;
        }
        const nextAncestors = new Map(ancestors);
        nextAncestors.set(item, occurrence.id);
        expandInputs(occurrence, inputs, nextAncestors);
    }

    const roots = finiteRateEntries(needs).map(([item, rate]) => {
        const root = makeOccurrence({item, rate, id: `target:${encodeURIComponent(item)}`});
        expandDemand(root, rate, new Map());
        return root;
    });
    const pendingSources = sources.filter(source => !coveredSources.has(source.id)
        && (source.outputRate > EPSILON || source.error || (source.kind !== 'automatic' && !items[source.item]?.occurrenceIds.length)));
    const supplyRoots = [];
    for (const source of pendingSources) {
        if (coveredSources.has(source.id)) continue;
        const root = makeOccurrence({item: source.item, rate: source.outputRate, id: `supply:${encodeURIComponent(source.id)}`, scope: 'global', source});
        coveredSources.add(source.id);
        root.reason = source.error ? 'invalid-source' : source.mineralized ? 'mineralized' : null;
        if (!root.reason) expandInputs(root, source.inputs, new Map([[source.item, root.id]]));
        supplyRoots.push(root);
    }
    for (const occurrence of rows) occurrence.shared = (items[occurrence.item]?.occurrenceIds.length || 0) > 1;
    return {roots, supplyRoots, rows, items, sources: sourcesById, warnings,
        limits: {maxExpandedNodes, maxDepth, expandedNodes, truncated}};
}
