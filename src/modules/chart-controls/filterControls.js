import { t } from '../../services/i18nService.js';
import {
  FILTER_CATEGORY_LIMIT,
  createDefaultFilterConfig,
  getCategoricalFilterOptions,
  normalizeFilterConfig,
} from '../../utils/chartFilters.js';
import { createSelectControl } from './shared.js';

function buildFilterUiIds(chartKey) {
  return {
    column: `viz-filter-${chartKey}-column`,
    search: `viz-filter-${chartKey}-search`,
    list: `viz-filter-${chartKey}-list`,
    selectAll: `viz-filter-${chartKey}-select-all`,
    clear: `viz-filter-${chartKey}-clear`,
    operator: `viz-filter-${chartKey}-operator`,
    min: `viz-filter-${chartKey}-min`,
    max: `viz-filter-${chartKey}-max`,
    value: `viz-filter-${chartKey}-value`,
  };
}

const liveSearchByChartKey = new Map();

export function createChartFilterControls({
  chartKey,
  rows,
  allColumns,
  numericColumns,
  rawFilter,
  disabled = false,
}) {
  const controls = [];
  const ids = buildFilterUiIds(chartKey);
  const filter = normalizeFilterConfig(rawFilter, numericColumns);
  const liveSearch = liveSearchByChartKey.get(chartKey) ?? filter.search ?? '';

  if (!liveSearchByChartKey.has(chartKey)) {
    liveSearchByChartKey.set(chartKey, liveSearch);
  }

  controls.push(createSelectControl(
    ids.column,
    t('chive-chart-filter-column'),
    [
      { value: '', label: t('chive-chart-option-none') },
      ...allColumns.map(columnName => ({ value: columnName, label: columnName })),
    ],
    filter.column || '',
    disabled
  ));

  if (!filter.column) {
    return controls;
  }

  if (filter.mode === 'numeric') {
    controls.push(createSelectControl(
      ids.operator,
      t('chive-chart-filter-operator'),
      [
        { value: 'between', label: t('chive-chart-filter-op-between') },
        { value: 'lt', label: t('chive-chart-filter-op-lt') },
        { value: 'gt', label: t('chive-chart-filter-op-gt') },
        { value: 'eq', label: t('chive-chart-filter-op-eq') },
      ],
      filter.operator,
      disabled
    ));

    if (filter.operator === 'between') {
      const minDiv = document.createElement('div');
      minDiv.className = 'chart-controle';
      const minLabel = document.createElement('label');
      minLabel.htmlFor = ids.min;
      minLabel.textContent = t('chive-chart-filter-min');
      const minInput = document.createElement('input');
      minInput.id = ids.min;
      minInput.type = 'number';
      minInput.className = 'linhas-select';
      minInput.value = String(filter.min ?? '');
      minInput.disabled = disabled;
      minDiv.appendChild(minLabel);
      minDiv.appendChild(minInput);
      controls.push(minDiv);

      const maxDiv = document.createElement('div');
      maxDiv.className = 'chart-controle';
      const maxLabel = document.createElement('label');
      maxLabel.htmlFor = ids.max;
      maxLabel.textContent = t('chive-chart-filter-max');
      const maxInput = document.createElement('input');
      maxInput.id = ids.max;
      maxInput.type = 'number';
      maxInput.className = 'linhas-select';
      maxInput.value = String(filter.max ?? '');
      maxInput.disabled = disabled;
      maxDiv.appendChild(maxLabel);
      maxDiv.appendChild(maxInput);
      controls.push(maxDiv);
    } else {
      const valueDiv = document.createElement('div');
      valueDiv.className = 'chart-controle';
      const valueLabel = document.createElement('label');
      valueLabel.htmlFor = ids.value;
      valueLabel.textContent = t('chive-chart-filter-value');
      const valueInput = document.createElement('input');
      valueInput.id = ids.value;
      valueInput.type = 'number';
      valueInput.className = 'linhas-select';
      valueInput.value = String(filter.value ?? '');
      valueInput.disabled = disabled;
      valueDiv.appendChild(valueLabel);
      valueDiv.appendChild(valueInput);
      controls.push(valueDiv);
    }

    return controls;
  }

  const options = getCategoricalFilterOptions(rows, filter.column, {
    search: liveSearch,
    limit: FILTER_CATEGORY_LIMIT,
    missingLabel: t('chive-chart-filter-missing'),
  });
  const includeSet = new Set(filter.include);

  const searchDiv = document.createElement('div');
  searchDiv.className = 'chart-controle';
  const searchLabel = document.createElement('label');
  searchLabel.htmlFor = ids.search;
  searchLabel.textContent = t('chive-chart-filter-search');
  const searchInput = document.createElement('input');
  searchInput.id = ids.search;
  searchInput.type = 'text';
  searchInput.className = 'linhas-select';
  searchInput.value = liveSearch;
  searchInput.disabled = disabled;
  searchDiv.appendChild(searchLabel);
  searchDiv.appendChild(searchInput);
  controls.push(searchDiv);

  const valuesDiv = document.createElement('div');
  valuesDiv.className = 'chart-controle chart-filter-values-control';

  const valuesLabel = document.createElement('label');
  valuesLabel.textContent = t('chive-chart-filter-values');
  valuesDiv.appendChild(valuesLabel);

  const actions = document.createElement('div');
  actions.className = 'chart-filter-actions';

  const selectAllBtn = document.createElement('button');
  selectAllBtn.type = 'button';
  selectAllBtn.id = ids.selectAll;
  selectAllBtn.className = 'chart-control-btn chart-filter-action-btn';
  selectAllBtn.textContent = t('chive-chart-filter-select-all');
  selectAllBtn.disabled = disabled;

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.id = ids.clear;
  clearBtn.className = 'chart-control-btn chart-filter-action-btn';
  clearBtn.textContent = t('chive-chart-filter-clear');
  clearBtn.disabled = disabled;

  actions.appendChild(selectAllBtn);
  actions.appendChild(clearBtn);
  valuesDiv.appendChild(actions);

  const list = document.createElement('div');
  list.id = ids.list;
  list.className = 'chart-filter-list';

  options.options.forEach(item => {
    const row = document.createElement('label');
    row.className = 'chart-filter-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.chartFilterOption = chartKey;
    checkbox.dataset.token = item.token;
    checkbox.dataset.label = String(item.label || '').toLowerCase();
    checkbox.checked = includeSet.has(item.token);
    checkbox.disabled = disabled;

    const text = document.createElement('span');
    text.className = 'chart-filter-item-text';
    text.textContent = `${item.label} (${item.count})`;

    row.appendChild(checkbox);
    row.appendChild(text);
    list.appendChild(row);
  });

  valuesDiv.appendChild(list);

  const summary = document.createElement('div');
  summary.className = 'chart-filter-summary';
  summary.textContent = t('chive-chart-filter-showing', options.options.length, options.total);
  valuesDiv.appendChild(summary);

  if (options.hasMore) {
    const more = document.createElement('div');
    more.className = 'chart-filter-summary';
    more.textContent = t('chive-chart-filter-more', options.total - options.options.length);
    valuesDiv.appendChild(more);
  }

  controls.push(valuesDiv);
  return controls;
}

function renderCategoricalFilterList({ list, summaryContainer, rows, column, search, includeSet, disabled }) {
  const options = getCategoricalFilterOptions(rows, column, {
    search,
    limit: search.trim().length > 0 ? Number.MAX_SAFE_INTEGER : FILTER_CATEGORY_LIMIT,
    missingLabel: t('chive-chart-filter-missing'),
  });

  list.innerHTML = '';

  options.options.forEach(item => {
    const row = document.createElement('label');
    row.className = 'chart-filter-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.token = item.token;
    checkbox.dataset.label = String(item.label || '').toLowerCase();
    checkbox.checked = includeSet.has(item.token);
    checkbox.disabled = disabled;

    const text = document.createElement('span');
    text.className = 'chart-filter-item-text';
    text.textContent = `${item.label} (${item.count})`;

    row.appendChild(checkbox);
    row.appendChild(text);
    list.appendChild(row);
  });

  summaryContainer.textContent = t('chive-chart-filter-showing', options.options.length, options.total);

  return options;
}

export function setupChartFilterControlListeners({
  chartKey,
  rows,
  numericColumns,
  rawFilter,
  onFilterChange,
}) {
  const ids = buildFilterUiIds(chartKey);
  const filter = normalizeFilterConfig(rawFilter, numericColumns);
  const liveSearch = liveSearchByChartKey.get(chartKey) ?? filter.search ?? '';

  const emit = nextFilter => {
    if (typeof onFilterChange !== 'function') return;
    onFilterChange(nextFilter);
  };

  const columnSelect = document.getElementById(ids.column);
  if (columnSelect) {
    columnSelect.addEventListener('change', () => {
      const nextColumn = columnSelect.value || null;
      if (!nextColumn) {
        emit(createDefaultFilterConfig());
        return;
      }

      const nextMode = numericColumns.includes(nextColumn) ? 'numeric' : 'categorical';
      if (nextMode === 'numeric') {
        emit({
          ...createDefaultFilterConfig(),
          column: nextColumn,
          mode: 'numeric',
          operator: 'between',
        });
        return;
      }

      const options = getCategoricalFilterOptions(rows, nextColumn, {
        search: '',
        limit: Number.MAX_SAFE_INTEGER,
        missingLabel: t('chive-chart-filter-missing'),
      });
      emit({
        ...createDefaultFilterConfig(),
        column: nextColumn,
        mode: 'categorical',
        include: options.allTokens,
        search: '',
      });
    });
  }

  const operatorSelect = document.getElementById(ids.operator);
  if (operatorSelect) {
    operatorSelect.addEventListener('change', () => {
      emit({
        ...filter,
        operator: operatorSelect.value,
      });
    });
  }

  const minInput = document.getElementById(ids.min);
  const maxInput = document.getElementById(ids.max);
  if (minInput || maxInput) {
    const updateRange = () => {
      emit({
        ...filter,
        min: minInput?.value ?? '',
        max: maxInput?.value ?? '',
      });
    };
    minInput?.addEventListener('change', updateRange);
    maxInput?.addEventListener('change', updateRange);
  }

  const valueInput = document.getElementById(ids.value);
  if (valueInput) {
    valueInput.addEventListener('change', () => {
      emit({
        ...filter,
        value: valueInput.value,
      });
    });
  }

  const searchInput = document.getElementById(ids.search);
  if (searchInput) {
    const list = document.getElementById(ids.list);
    const summary = list?.parentElement?.querySelector('.chart-filter-summary');
    const controlsDisabled = searchInput.disabled === true;

    searchInput.addEventListener('input', () => {
      if (!list || !summary) return;

      const query = String(searchInput.value || '').trim();
      liveSearchByChartKey.set(chartKey, query);
      const includeSet = new Set(
        Array.from(list.querySelectorAll('input[type="checkbox"][data-token]'))
          .filter(input => input.checked)
          .map(input => input.dataset.token || '')
      );

      renderCategoricalFilterList({
        list,
        summaryContainer: summary,
        rows,
        column: filter.column,
        search: query,
        includeSet,
        disabled: controlsDisabled,
      });
    });

    // Commit search to config on blur/Enter (avoids full re-render while typing).
    searchInput.addEventListener('change', () => {
      emit({
        ...filter,
        search: searchInput.value,
      });
    });

    searchInput.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      emit({
        ...filter,
        search: searchInput.value,
      });
    });
  }

  const list = document.getElementById(ids.list);
  if (list) {
    list.addEventListener('change', () => {
      const currentSearch = liveSearchByChartKey.get(chartKey) ?? filter.search ?? '';
      const checkedTokens = Array.from(list.querySelectorAll('input[type="checkbox"][data-token]'))
        .filter(input => input.checked)
        .map(input => input.dataset.token || '');
      emit({
        ...filter,
        search: currentSearch,
        include: checkedTokens,
      });
    });
  }

  const selectAllBtn = document.getElementById(ids.selectAll);
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      const list = document.getElementById(ids.list);
      if (!list) return;
      const currentSearch = liveSearchByChartKey.get(chartKey) ?? filter.search ?? '';

      // Select only currently visible checkboxes (respects active search filter)
      const visibleCheckboxes = Array.from(list.querySelectorAll('input[type="checkbox"][data-token]'))
        .filter(input => {
          const row = input.closest('.chart-filter-item');
          return row && row.style.display !== 'none';
        });

      visibleCheckboxes.forEach(input => {
        input.checked = true;
      });

      // Emit change event to persist selection
      const checkedTokens = Array.from(list.querySelectorAll('input[type="checkbox"][data-token]'))
        .filter(input => input.checked)
        .map(input => input.dataset.token || '');

      emit({
        ...filter,
        search: currentSearch,
        include: checkedTokens,
      });
    });
  }

  const clearBtn = document.getElementById(ids.clear);
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const list = document.getElementById(ids.list);
      if (!list) return;
      const currentSearch = liveSearchByChartKey.get(chartKey) ?? filter.search ?? '';

      // Uncheck only currently visible checkboxes (respects active search filter)
      const visibleCheckboxes = Array.from(list.querySelectorAll('input[type="checkbox"][data-token]'))
        .filter(input => {
          const row = input.closest('.chart-filter-item');
          return row && row.style.display !== 'none';
        });

      visibleCheckboxes.forEach(input => {
        input.checked = false;
      });

      // Emit change event to persist selection
      const checkedTokens = Array.from(list.querySelectorAll('input[type="checkbox"][data-token]'))
        .filter(input => input.checked)
        .map(input => input.dataset.token || '');

      emit({
        ...filter,
        search: currentSearch,
        include: checkedTokens,
      });
    });
  }
}
