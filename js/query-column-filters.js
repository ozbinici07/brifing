/* Excel-style value filters shared by the student and institution query tables. */
(() => {
  'use strict';
  const collator = new Intl.Collator('tr', {numeric: true, sensitivity: 'base'});
  const valueKey = value => value == null || value === '' ? '—' : String(value);
  const compare = (a, b) => collator.compare(valueKey(a), valueKey(b));
  let dismissMenu;

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function button(text, action, className) {
    const node = element('button', text, className);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  }

  function attach(headers, readValue, readRows, render) {
    const filters = new Map();
    const triggers = new Map();
    let sort = null, close = null;
    const matches = (row, except) => [...filters].every(([key, values]) =>
      key === except || values.has(valueKey(readValue(row, key))));

    function updateTriggers() {
      for (const [key, trigger] of triggers) {
        trigger.classList.toggle('is-filtered', filters.has(key));
        trigger.closest('th').setAttribute('aria-sort', sort?.key === key
          ? (sort.direction === 1 ? 'ascending' : 'descending') : 'none');
      }
    }

    function open(key, title, trigger) {
      if (trigger.getAttribute('aria-expanded') === 'true') { close?.(true); return; }
      dismissMenu?.();
      const all = new Set(readRows().filter(row => matches(row, key)).map(row => valueKey(readValue(row, key))));
      const previous = filters.get(key);
      const values = [...new Set([...all, ...(previous || [])])].sort(collator.compare);
      const selected = new Set(previous || values);
      const panel = element('section', '', 'query-column-menu');
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', title + ' sütun filtresi');
      const controller = new AbortController();
      const listener = {signal: controller.signal};
      close = (restoreFocus = false) => {
        controller.abort();
        panel.remove();
        trigger.setAttribute('aria-expanded', 'false');
        close = null;
        dismissMenu = null;
        if (restoreFocus) trigger.focus({preventScroll: true});
      };
      dismissMenu = close;
      const commit = () => { close(true); updateTriggers(); render(); };
      const setSort = direction => { sort = {key, direction}; commit(); };
      panel.append(
        element('strong', title),
        button('↑ Artan sırala', () => setSort(1), 'query-column-action'),
        button('↓ Azalan sırala', () => setSort(-1), 'query-column-action')
      );
      const clear = button('Bu sütunun filtresini temizle', () => { filters.delete(key); commit(); }, 'query-column-action');
      clear.disabled = !previous;
      const search = element('input');
      search.type = 'search';
      search.placeholder = 'Değer ara…';
      search.setAttribute('aria-label', title + ' değerlerinde ara');
      const list = element('div', '', 'query-column-options');
      const allCheckbox = element('input');
      allCheckbox.type = 'checkbox';
      const selectAll = element('label', '', 'query-column-select-all');
      selectAll.append(allCheckbox, document.createTextNode('Tümünü seç'));
      let visible = values;
      function refreshSelectAll() {
        const count = visible.filter(value => selected.has(value)).length;
        allCheckbox.disabled = !visible.length;
        allCheckbox.checked = !!visible.length && count === visible.length;
        allCheckbox.indeterminate = count > 0 && count < visible.length;
      }
      function drawValues() {
        const query = search.value.trim().toLocaleLowerCase('tr');
        visible = values.filter(value => value.toLocaleLowerCase('tr').includes(query));
        const fragment = document.createDocumentFragment();
        for (const value of visible) {
          const checkbox = element('input');
          checkbox.type = 'checkbox';
          checkbox.checked = selected.has(value);
          checkbox.addEventListener('change', () => {
            if (checkbox.checked) selected.add(value); else selected.delete(value);
            refreshSelectAll();
          });
          const label = element('label');
          label.append(checkbox, document.createTextNode(value));
          fragment.append(label);
        }
        if (!visible.length) fragment.append(element('p', 'Eşleşen değer yok.'));
        list.replaceChildren(fragment);
        refreshSelectAll();
      }
      allCheckbox.addEventListener('change', () => {
        for (const value of visible) {
          if (allCheckbox.checked) selected.add(value); else selected.delete(value);
        }
        drawValues();
      });
      search.addEventListener('input', drawValues);
      const footer = element('div', '', 'query-column-footer');
      footer.append(button('İptal', () => close(true)), button('Tamam', () => {
        if (values.every(value => selected.has(value))) filters.delete(key);
        else filters.set(key, selected);
        commit();
      }, 'query-column-confirm'));
      panel.append(clear, search, selectAll, list, footer);
      drawValues();
      document.body.append(panel);
      const anchor = trigger.getBoundingClientRect();
      const width = panel.offsetWidth, height = panel.offsetHeight;
      panel.style.left = Math.max(6, Math.min(anchor.right - width, innerWidth - width - 6)) + 'px';
      panel.style.top = Math.max(6, Math.min(anchor.bottom + 4, innerHeight - height - 6)) + 'px';
      trigger.setAttribute('aria-expanded', 'true');
      document.addEventListener('pointerdown', event => {
        if (!panel.contains(event.target) && !trigger.contains(event.target)) close();
      }, listener);
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); close(true); }
      }, listener);
      window.addEventListener('resize', () => close(), listener);
      document.addEventListener('scroll', event => {
        if (!panel.contains(event.target)) close();
      }, {...listener, capture: true});
      search.focus({preventScroll: true});
    }

    for (const [header, key] of headers) {
      const title = header.textContent.trim();
      const trigger = button('', () => open(key, title, trigger), 'query-column-trigger');
      trigger.setAttribute('aria-label', title + ' sütun filtresi');
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2 3h12L9 9v4l-2 1V9z"/></svg>';
      const label = element('span', title, 'query-column-heading');
      label.append(trigger);
      header.replaceChildren(label);
      triggers.set(key, trigger);
    }
    return {
      apply(rows) {
        const result = filters.size ? rows.filter(row => matches(row)) : rows;
        if (!sort) return result;
        return [...result].sort((a, b) => sort.direction * compare(readValue(a, sort.key), readValue(b, sort.key)));
      },
      clearSort() { sort = null; updateTriggers(); },
      reset() { close?.(); filters.clear(); sort = null; updateTriggers(); }
    };
  }

  window.QueryColumnFilters = {attach};
  const headers = [...document.querySelectorAll('#students [data-qth]')];
  if (headers.length) {
    const controller = attach(headers.map(header => [header, header.dataset.qth]),
      (row, key) => key === 'public' ? (publicKey(row.public_private) === 'resmi' ? 'Resmi' : 'Özel') : row[key],
      () => window.studentQueryRows(), () => window.runStudentQuery(true));
    window.studentQueryColumnFilters = controller;
    for (const id of ['stuQSort', 'stuQReverse']) {
      document.getElementById(id)?.addEventListener('change', () => controller.clearSort(), true);
    }
  }
})();
