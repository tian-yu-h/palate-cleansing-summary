(() => {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const panels = [...document.querySelectorAll('[role="tabpanel"]')];
  const panelIds = new Set(panels.map((panel) => panel.id));
  const defaultTab = "survey";

  function activateTab() {
    const requested = window.location.hash.slice(1);
    const activeId = panelIds.has(requested) ? requested : defaultTab;
    panels.forEach((panel) => { panel.hidden = panel.id !== activeId; });
    tabs.forEach((tab) => {
      const active = tab.getAttribute('aria-controls') === activeId;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => requestAnimationFrame(activateTab));
    tab.addEventListener('keydown', (event) => {
      const keys = { ArrowRight: 1, ArrowLeft: -1 };
      if (!(event.key in keys) && !['Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      let next = index + (keys[event.key] || 0);
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      next = (next + tabs.length) % tabs.length;
      tabs[next].focus();
      tabs[next].click();
    });
  });
  window.addEventListener('hashchange', activateTab);
  activateTab();

  const tbody = document.querySelector('#papers-body');
  if (!tbody) return;
  const filter = document.querySelector('#paper-filter');
  const status = document.querySelector('#paper-status');
  const tableHeaders = [...document.querySelectorAll('#papers-table th[data-key]')];
  const columns = tableHeaders.map((header) => header.dataset.key);
  const numericColumns = new Set(
    tableHeaders.filter((header) => header.dataset.numeric === 'true')
      .map((header) => header.dataset.key)
  );
  const state = { rows: [], query: '', sortKey: null, direction: 1 };

  function recommendationCell(value) {
    const cell = document.createElement('td');
    const text = document.createElement('div');
    text.className = 'recommendation-text';
    text.textContent = value;
    cell.append(text);
    if (value !== '—' && value.length > 72) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'more-button';
      button.textContent = 'more';
      button.setAttribute('aria-expanded', 'false');
      button.addEventListener('click', () => {
        const expanded = text.classList.toggle('expanded');
        button.textContent = expanded ? 'less' : 'more';
        button.setAttribute('aria-expanded', String(expanded));
      });
      cell.append(button);
    }
    return cell;
  }

  function renderTable() {
    const query = state.query.trim().toLocaleLowerCase();
    let rows = state.rows.filter((row) => !query || columns.some((key) =>
      String(row[key]).toLocaleLowerCase().includes(query)
    ));
    if (state.sortKey) {
      rows = [...rows].sort((a, b) => {
        const left = a[state.sortKey];
        const right = b[state.sortKey];
        return (typeof left === 'number' ? left - right : String(left).localeCompare(String(right)))
          * state.direction;
      });
    }
    const fragment = document.createDocumentFragment();
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      columns.forEach((key) => {
        if (key === 'recommendation') {
          tr.append(recommendationCell(String(row[key])));
          return;
        }
        const td = document.createElement('td');
        if (numericColumns.has(key)) td.classList.add('number');
        td.textContent = row[key];
        tr.append(td);
      });
      fragment.append(tr);
    });
    tbody.replaceChildren(fragment);
    status.textContent = `Showing ${rows.length} of ${state.rows.length} papers`;
  }

  filter.addEventListener('input', () => { state.query = filter.value; renderTable(); });
  document.querySelectorAll('[data-sort]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.sort;
      state.direction = state.sortKey === key ? state.direction * -1 : 1;
      state.sortKey = key;
      document.querySelectorAll('th[aria-sort]').forEach((th) => th.setAttribute('aria-sort', 'none'));
      button.closest('th').setAttribute('aria-sort', state.direction === 1 ? 'ascending' : 'descending');
      document.querySelectorAll('.sort-mark').forEach((mark) => { mark.textContent = '↕'; });
      button.querySelector('.sort-mark').textContent = state.direction === 1 ? '↑' : '↓';
      renderTable();
    });
  });

  fetch('data/papers.json')
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((rows) => { state.rows = rows; renderTable(); })
    .catch(() => {
      status.textContent = 'The paper index could not be loaded.';
      document.querySelector('#table-error').hidden = false;
    });
})();
