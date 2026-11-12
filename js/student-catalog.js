(function () {
  'use strict';

  const levels = ['Okul Öncesi', 'İlkokul', 'Ortaokul', 'Ortaöğretim'];
  const numbers = new Intl.NumberFormat('tr-TR', {maximumFractionDigits: 2});
  const ownership = ['Resmî', 'Özel', 'Toplam'];
  const definitions = [
    ['levels', 'Kademelere Göre Öğrenciler', 'İlçelere göre kademe ve okul öncesi dağılımı', '▤', 'blue'],
    ['grades', 'Sınıflara Göre Öğrenci Sayıları', 'Anasınıfından 12. sınıfa ilçe dağılımı', '▥', 'green'],
    ['general', 'Genel Öğrenci Sayıları', 'Muğla geneli, okul türleri ve öğrenci oranları', '▦', 'purple'],
    ['classrooms', 'İlçe Bazlı Öğrenci-Derslik Sayı', 'Resmî ve özel öğrenci ve derslik toplamları', '▣', 'slate'],
    ['types', 'İlçe Bazlı Öğrenci Sayıları', 'İlçe ve okul türüne göre öğrenci sayıları', '▧', 'blue'],
  ];

  function add(target, key, value, publicType) {
    if (!target.has(key)) target.set(key, [0, 0, 0]);
    const values = target.get(key);
    const index = publicType === 'resmi' ? 0 : publicType === 'ozel' ? 1 : -1;
    if (index >= 0) values[index] += value;
    values[2] += value;
  }

  function makeModel(rows, institutionRows) {
    const districts = new Set();
    const columns = {type: new Map(), pre: new Map()};
    const matrix = new Map();
    const schools = new Map();
    const districtNames = new Map();
    function districtOf(row) {
      const name = String(row.district || 'İlçesi Belirtilmemiş').trim();
      const key = norm(name);
      if (!districtNames.has(key)) districtNames.set(key, name);
      return districtNames.get(key);
    }
    function schoolOf(row) {
      const district = districtOf(row);
      const publicType = publicKey(row.public_private);
      const identity = JSON.stringify([norm(district), row.code || norm(row.name), publicType]);
      if (!schools.has(identity)) schools.set(identity, {district, publicType, levels: new Set(), classrooms: null, teachers: null});
      return schools.get(identity);
    }
    for (const row of institutionRows) {
      const school = schoolOf(row);
      districts.add(school.district);
      for (const field of ['classrooms', 'teachers']) {
        const value = row[field];
        if (value != null && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0) {
          school[field] = Math.max(school[field] ?? 0, Number(value));
        }
      }
    }
    const keyOf = (dimension, value) => dimension + '|' + value;
    const collate = (a, b) => a.localeCompare(b, 'tr');
    for (const row of rows) {
      const district = districtOf(row);
      const type = row.source_type || row.type || 'Türü Belirtilmemiş';
      const typeKey = row.level + '|' + type;
      const publicType = publicKey(row.public_private);
      districts.add(district);
      if (!matrix.has(district)) matrix.set(district, new Map());
      const counts = matrix.get(district);
      const facts = [['level', row.level, row.level], ['grade', row._gradeIndex, row.grade],
        ['type', typeKey, type]];
      if (row.level === levels[0]) facts.push(['pre', type, type]);
      for (const [dimension, key, label] of facts) {
        columns[dimension]?.set(key, label);
        add(counts, keyOf(dimension, key), row.students, publicType);
      }
      add(counts, 'total', row.students, publicType);
      if (row.students > 0) schoolOf(row).levels.add(row.level);
    }
    const ordered = [...districts].sort(collate);
    const allSchools = [...schools.values()];
    const total = (key, district) => district
      ? matrix.get(district)?.get(key) || [0, 0, 0]
      : ordered.reduce((sum, name) => sum.map((v, index) => v + (matrix.get(name)?.get(key)?.[index] || 0)), [0, 0, 0]);
    function quantities(field, district, level) {
      const selected = allSchools.filter(row => (!district || row.district === district) && (!level || row.levels.has(level)));
      return [0, 1, 2].map(index => {
        const group = selected.filter(row => index === 2 || row.publicType === (index === 0 ? 'resmi' : 'ozel'));
        if (!group.length) return selected.length ? 0 : null;
        if (field === 'schools') return group.length;
        return group.every(row => row[field] != null) ? group.reduce((sum, row) => sum + row[field], 0) : null;
      });
    }
    return {ordered, columns, total, quantities, keyOf, collate};
  }

  function group(title, value, labels = ownership) {
    return {title, value, labels};
  }

  function matrixTable(title, rowLabel, groups, rowNames, footer = true) {
    const table = element('table', null, 'table student-catalog-table');
    table.createCaption().textContent = title;
    const head = table.createTHead();
    const first = head.insertRow(), second = head.insertRow();
    const heading = element('th', rowLabel);
    heading.scope = 'col';
    heading.rowSpan = 2;
    first.append(heading);
    for (const column of groups) {
      const label = element('th', column.title);
      label.colSpan = column.labels.length;
      label.scope = 'colgroup';
      first.append(label);
      for (const part of column.labels) {
        const cell = element('th', part);
        cell.scope = 'col';
        second.append(cell);
      }
    }
    function writeRow(section, label, values) {
      const row = section.insertRow();
      const cell = element('th', label);
      cell.scope = 'row';
      row.append(cell);
      for (const value of values) row.append(element('td', value == null ? '—' : numbers.format(value)));
    }
    const body = table.createTBody();
    for (const row of rowNames) writeRow(body, row, groups.flatMap(column => column.value(row)));
    if (footer) writeRow(table.createTFoot(), 'Muğla Toplamı', groups.flatMap(column => column.value(null)));
    const scroll = element('div', null, 'student-catalog-scroll');
    scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region');
    scroll.setAttribute('aria-label', title);
    scroll.append(table);
    return scroll;
  }

  function renderReport(id, model, out) {
    const {ordered, columns, total, quantities, keyOf, collate} = model;
    const grouped = (dimension, key, label, split = ownership) =>
      group(label, district => total(keyOf(dimension, key), district).slice(0, split.length), split);
    const totalColumn = group('Öğrenci', district => total('total', district));
    const byDistrict = (title, columns) => matrixTable(title, 'İlçe', columns, ordered);
    const selectedTypes = [...columns.type.keys()].sort((a, b) =>
      levels.indexOf(a.split('|')[0]) - levels.indexOf(b.split('|')[0]) || collate(columns.type.get(a), columns.type.get(b)));
    if (id === 'levels') {
      out.append(byDistrict('İlçelere Göre Eğitim Kademeleri', [
        ...levels.map(level => grouped('level', level, level)), totalColumn,
      ]));
      const preschool = [...columns.pre.keys()].sort(collate).map(type => grouped('pre', type, type));
      if (preschool.length) out.append(byDistrict('Okul Öncesi Öğrencilerinin Okul Türüne Göre Dağılımı', [
        ...preschool, grouped('level', levels[0], 'Toplam Okul Öncesi'),
      ]));
      return;
    }
    if (id === 'grades') {
      out.append(byDistrict('İlçelere ve Sınıflara Göre Öğrenciler', [
        ...STUDENT_GRADE_NAMES.map((label, index) => grouped('grade', index, label === levels[0] ? 'Anasınıfı' : label, ownership.slice(0, 2))),
        totalColumn,
      ]));
      return;
    }
    if (id === 'classrooms') {
      out.append(byDistrict('İlçelere Göre Öğrenci ve Derslik Sayıları', [
        totalColumn, group('Derslik', district => quantities('classrooms', district)),
      ]));
      out.append(element('p', 'Derslik sayısı okul/kurum başına bir kez sayılır. Eksik derslik verileri çizgiyle gösterilir.'));
      return;
    }
    if (id === 'types') {
      out.append(byDistrict('İlçelere Göre Genel Öğrenci Sayıları', [
        group('Temel Eğitim', district => [0, 1, 2].map(index => levels.slice(0, 3)
          .reduce((sum, level) => sum + total(keyOf('level', level), district)[index], 0))),
        grouped('level', levels[3], levels[3]), totalColumn,
      ]));
      for (const level of levels) {
        const types = selectedTypes.filter(key => key.startsWith(level + '|'));
        if (types.length) out.append(byDistrict(level + ' · Okul Türlerine Göre Öğrenci Sayıları', [
          ...types.map(key => grouped('type', key, columns.type.get(key))), grouped('level', level, 'Kademe Toplamı'),
        ]));
      }
      return;
    }
    out.append(matrixTable('Kademelere Göre Öğrenci Sayıları', 'Kademe', [
      group('Öğrenci', level => level ? total(keyOf('level', level)) : total('total')),
    ], levels));
    for (const level of levels) {
      const types = selectedTypes.filter(key => key.startsWith(level + '|'));
      if (types.length) out.append(matrixTable(level + ' · Okul Türlerine Göre Öğrenciler', 'Okul Türü', [
        group('Öğrenci', type => type ? total(keyOf('type', level + '|' + type)) : total(keyOf('level', level))),
      ], types.map(key => columns.type.get(key))));
    }
    const ratios = [['schools', 'Okul/Kurum Başına'], ['classrooms', 'Derslik Başına'], ['teachers', 'Öğretmen Başına']];
    out.append(matrixTable('Okul, Derslik ve Öğretmen Başına Öğrenci Sayısı', 'Kademe', ratios.map(([field, title]) =>
      group(title, level => {
        const denominator = quantities(field, null, level)[2];
        const count = level ? total(keyOf('level', level))[2] : total('total')[2];
        return [denominator > 0 ? count / denominator : null];
      }, ['Öğrenci'])), levels));
    out.append(element('p', 'Oranlar, ilgili kademede öğrenci kaydı bulunan okul ve kurumların kayıtlı toplamlarına göre hesaplanır. Eksik paydalar çizgiyle gösterilir.'));
  }

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  const panel = document.getElementById('studentCatalogPanel');
  if (!panel) return;
  const catalog = panel.querySelector('.student-catalog-cards');
  const output = panel.querySelector('.student-catalog-report');
  let dataRef, model, selectedId;
  function refresh() {
    if (panel.hidden || !selectedId) return;
    if (dataRef !== D || !model) {
      model = makeModel(D ? window.studentQueryGradeRows() : [], [...(D?.basic || []), ...(D?.secondary || [])]);
      dataRef = D;
    }
    output.replaceChildren();
    if (!model.ordered.length) output.append(element('p', 'Seçili dönemde öğrenci kaydı bulunamadı.'));
    else renderReport(selectedId, model, output);
  }
  for (const [id, title, subtitle, symbol, color] of definitions) {
    const card = element('button', null, 'student-catalog-card');
    card.type = 'button';
    const icon = element('span', symbol, 'student-catalog-icon ' + color);
    icon.setAttribute('aria-hidden', 'true');
    const copy = element('span');
    copy.append(element('strong', title), element('small', subtitle));
    const arrow = element('span', '›', 'student-catalog-arrow');
    arrow.setAttribute('aria-hidden', 'true');
    card.append(icon, copy, arrow);
    card.setAttribute('aria-pressed', 'false');
    card.onclick = () => {
      selectedId = id;
      catalog.querySelector('[aria-pressed=true]')?.setAttribute('aria-pressed', 'false');
      card.setAttribute('aria-pressed', 'true');
      refresh();
      output.focus({preventScroll:true});
      output.scrollIntoView({block:'nearest'});
    };
    catalog.append(card);
  }
  window.StudentCatalog = {refresh};
})();
