/* Shared school matching and the selected-period school profile. */
(function () {
  'use strict';
  const C = window.DataAssistantCore;
  const format = new Intl.NumberFormat('tr-TR');
  const page = document.createElement('section');
  page.id = 'school-detail';
  page.className = 'page';
  document.querySelector('.app .content').append(page);
  let selected = null;

  function node(tag, value, className) {
    const element = document.createElement(tag);
    if (value != null) element.textContent = typeof value === 'number' ? format.format(value) : value;
    if (className) element.className = className;
    return element;
  }

  function matches(records, query, limit = 8) {
    const text = C.fold(query);
    if (text.length < 2) return [];
    const words = text.split(' ');
    const found = new Map();
    for (const record of records) {
      const name = C.fold(record.name);
      if (!name) continue;
      const code = String(record.code ?? '');
      const parts = (name + ' ' + C.fold(record.district) + ' ' + code).split(' ');
      const score = name === text || code === text ? 4 : name.startsWith(text) ? 3 :
        name.includes(text) ? 2 : words.every(word => parts.some(part => part.startsWith(word))) ? 1 : 0;
      if (score && !found.has(C.identity(record))) found.set(C.identity(record), {record, score});
    }
    return [...found.values()].sort((a, b) => b.score - a.score || a.record.name.localeCompare(b.record.name, 'tr'))
      .slice(0, limit).map(item => item.record);
  }

  function may(pageId) {
    const user = window.authUser?.();
    return !!window.token?.() && (user?.role === 'System Admin' || !!user?.account?.screens?.includes(pageId));
  }

  function panel(title) {
    const section = node('section', null, 'global-school-detail');
    section.append(node('h3', title));
    return section;
  }

  function facts(section, entries) {
    const list = node('dl');
    for (const [label, value] of entries) {
      if (value == null || value === '') continue;
      const item = node('div');
      item.append(node('dt', label), node('dd', value));
      list.append(item);
    }
    if (list.childElementCount) section.append(list);
  }

  function distribution(rows) {
    const section = panel('Sınıflara Göre Öğrenci Dağılımı');
    if (!rows.length) {
      section.append(node('p', 'Bu dönem için sınıf bazında öğrenci kaydı bulunamadı.'));
      return section;
    }
    const table = node('table', null, 'table');
    const header = table.createTHead().insertRow();
    for (const label of ['Sınıf', 'Öğrenci', 'Şube']) header.append(node('th', label));
    const body = table.createTBody();
    const chart = node('div', null, 'school-distribution-chart');
    chart.setAttribute('role', 'img');
    chart.setAttribute('aria-label', 'Öğrencilerin sınıflara göre dağılımı');
    const maximum = Math.max(1, ...rows.map(row => row.students));
    for (const row of rows) {
      const tr = body.insertRow();
      tr.append(node('th', row.grade), node('td', row.students), node('td', row.branches ?? '—'));
      const line = node('div', null, 'school-distribution-line');
      const track = node('span', null, 'school-distribution-track');
      const bar = node('span');
      bar.style.width = (100 * row.students / maximum) + '%';
      track.append(bar);
      line.append(node('span', row.grade), track, node('strong', row.students));
      chart.append(line);
    }
    const layout = node('div', null, 'school-distribution');
    layout.append(table, chart);
    section.append(layout);
    return section;
  }

  function render(record, data) {
    const key = C.identity(record);
    const forSchool = row => C.identity(row) === key;
    const basic = (data.basic || []).filter(forSchool);
    const secondary = (data.secondary || []).filter(forSchool);
    const education = [...basic, ...secondary];
    const model = C.buildModel({basic, secondary});
    const groups = new Map();
    for (const row of model.records.filter(row => row.dataset === 'students')) {
      const group = groups.get(row.grade) || {grade: row.grade, students: 0, branches: 0};
      group.students += row.students ?? 0;
      group.branches = group.branches === null || row.branches === null ? null : group.branches + row.branches;
      groups.set(row.grade, group);
    }
    const rows = [...groups.values()].filter(row => row.grade !== 'Toplam' && (row.students > 0 || row.branches > 0))
      .sort((a, b) => C.gradeNames.indexOf(a.grade) - C.gradeNames.indexOf(b.grade));
    const knownMax = field => {
      const values = education.map(row => C.num(row[field])).filter(value => value !== null);
      return values.length ? Math.max(...values) : null;
    };
    const totals = model.records.filter(row => row.dataset === 'students').map(row => row.students);
    const studentTotal = totals.length && totals.every(value => value !== null) ?
      totals.reduce((sum, value) => sum + value, 0) : null;
    const heading = node('div', null, 'page-head');
    heading.append(node('h2', 'Okul / Kurum Ayrıntıları'));
    const back = node('button', '← Geri', 'btn light');
    back.type = 'button';
    back.onclick = () => window.show(selected?.from || 'institutions');
    const intro = panel(record.name);
    const period = window.__BRIFING_CURRENT?.name;
    if (period) intro.append(node('p', period));
    facts(intro, [['Kurum kodu', record.code], ['İl', record.province], ['İlçe', record.district],
      ['Kurum türü', record.type], ['Resmî / Özel', record.status_type], ['Durum', record.status],
      ['Bağlı birim', record.unit]]);
    page.replaceChildren(heading, back, intro);
    if (may('students') || may('teachers')) {
      const summary = panel('Öğrenci, Öğretmen ve Derslik Bilgileri');
      const entries = [];
      const branches = rows.length && rows.every(row => row.branches !== null) ? rows.reduce((sum, row) => sum + row.branches, 0) : null;
      if (may('students')) entries.push(['Öğrenci', studentTotal ?? 'Veri yok'], ['Şube', branches ?? 'Veri yok'], ['Derslik', knownMax('classrooms') ?? 'Veri yok'],
        ['Öğretim şekli', education.find(row => row.teaching)?.teaching], ['Yerleşim', education.find(row => row.settlement)?.settlement]);
      if (may('teachers')) entries.push(['Öğretmen', knownMax('teachers') ?? 'Veri yok']);
      facts(summary, entries);
      if (may('teachers')) summary.append(node('p', 'Öğretmen sayısı, seçili dönemin okul bazlı eğitim kaynağından alınır.'));
      page.append(summary);
    }
    if (may('students')) page.append(distribution(rows));
    const additional = new Map();
    const sources = [record, ...(may('students') ? education : [])];
    for (const source of sources) {
      for (const [label, value] of Object.entries(source.extra || {})) {
        if (!['string', 'number'].includes(typeof value) || value === '' ||
            /sifre|parola|token|api anahtar|oturum|tc kimlik|kullanici hesabi/.test(C.fold(label))) continue;
        const values = additional.get(label) || new Set();
        values.add(typeof value === 'number' ? format.format(value) : value);
        additional.set(label, values);
      }
    }
    if (additional.size) {
      const extra = panel('Diğer Kayıtlı Bilgiler');
      facts(extra, [...additional].map(([label, values]) => [label, [...values].join(' · ')]));
      page.append(extra);
    }
  }

  async function open(record, from) {
    if (!may('institutions') || typeof D === 'undefined' || !D) return false;
    const origin = from === page.id ? selected?.from : from;
    if ((await window.show(page.id)) === false || !page.classList.contains('active') || !may('institutions')) return false;
    const fresh = (D.institutions || []).find(row => C.identity(row) === C.identity(record));
    if (!fresh) {
      window.show(origin || 'institutions');
      return false;
    }
    selected = {key: C.identity(fresh), from: origin};
    render(fresh, D);
    return true;
  }

  function refresh(data) {
    if (!selected || !page.classList.contains('active')) return;
    const record = (data?.institutions || []).find(row => C.identity(row) === selected.key);
    if (may('institutions') && record) render(record, data);
    else {
      clear();
      window.show('institutions');
    }
  }

  function clear() {
    selected = null;
    page.replaceChildren();
  }

  window.SchoolDetail = {matches, open, refresh, clear};
})();
