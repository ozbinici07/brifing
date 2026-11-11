/* Administrator controls in the overview strip. History is read only when opened. */
(() => {
  'use strict';
  let controls, dialog;
  const pageSize = 50;
  const date = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'medium'
  });
  const admin = () => window.authUser?.()?.role === 'System Admin';

  function node(tag, text) {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    return element;
  }

  function openHistory() {
    if (!admin() || dialog?.open) return;
    const modal = node('dialog');
    dialog = modal;
    modal.className = 'session-audit-dialog';
    modal.setAttribute('aria-labelledby', 'sessionAuditTitle');
    const title = node('h2', 'Kullanıcı Kayıtları');
    title.id = 'sessionAuditTitle';
    const close = node('button', 'Kapat');
    close.type = 'button';
    close.onclick = () => modal.close();
    const header = node('header');
    header.append(title, close);
    const note = node('p', 'Saatler Türkiye saatine göre gösterilir. Çıkış kaydı olmayan satırlar, oturumun hâlâ açık olduğunu göstermez.');
    const filters = node('div');
    filters.className = 'session-audit-filters';
    const day = node('input');
    day.type = 'date';
    const dayLabel = node('label', 'Giriş tarihi');
    dayLabel.append(day);
    const reset = node('button', 'Tüm tarihler');
    reset.type = 'button';
    filters.append(dayLabel, reset);
    const status = node('p');
    status.setAttribute('role', 'status');
    const wrap = node('div');
    wrap.className = 'session-audit-table';
    const table = node('table');
    const heading = table.createTHead().insertRow();
    for (const text of ['Kullanıcı', 'Giriş tarihi ve saati', 'Çıkış tarihi ve saati']) {
      const cell = node('th', text);
      cell.scope = 'col';
      heading.append(cell);
    }
    const body = table.createTBody();
    wrap.append(table);
    const more = node('button', 'Daha eski kayıtlar');
    more.type = 'button';
    more.hidden = true;
    let cursor, requestId = 0;
    async function load() {
      if (!admin() || !modal.open) return;
      const request = ++requestId;
      more.disabled = true;
      status.textContent = 'Kayıtlar yükleniyor…';
      const query = {
        from: [{collectionId:'userSessionAudit'}], limit: pageSize,
        orderBy: [{field:{fieldPath:'signedInAt'},direction:'DESCENDING'},
          {field:{fieldPath:'__name__'},direction:'DESCENDING'}]
      };
      if (day.value) {
        const start = new Date(day.value + 'T00:00:00+03:00');
        const end = new Date(start.getTime() + 86400000);
        query.where = {compositeFilter:{op:'AND',filters:[
          {fieldFilter:{field:{fieldPath:'signedInAt'},op:'GREATER_THAN_OR_EQUAL',value:{timestampValue:start.toISOString()}}},
          {fieldFilter:{field:{fieldPath:'signedInAt'},op:'LESS_THAN',value:{timestampValue:end.toISOString()}}}
        ]}};
      }
      if (cursor) query.startAt = {before:false, values:[
        {timestampValue:cursor.signedInAt},
        {referenceValue:`projects/${window.BRIFING_FIREBASE_CONFIG.projectId}/databases/(default)/documents/userSessionAudit/${cursor.id}`}
      ]};
      try {
        const rows = await window.__personnelFirestore.query('', query);
        if (request !== requestId || !modal.open || !admin()) return;
        for (const row of rows) {
          const line = body.insertRow();
          for (const value of [row.username, date.format(new Date(row.signedInAt)),
            row.signedOutAt ? date.format(new Date(row.signedOutAt)) : 'Çıkış kaydı yok']) {
            line.insertCell().textContent = value;
          }
        }
        if (rows.length) cursor = rows.at(-1);
        more.textContent = 'Daha eski kayıtlar';
        more.hidden = rows.length < pageSize;
        status.textContent = body.rows.length ? `${body.rows.length} kayıt` : (day.value ? 'Seçilen tarihte giriş kaydı yok.' : 'Henüz giriş kaydı bulunmuyor.');
      } catch {
        if (request !== requestId || !modal.open) return;
        status.textContent = 'Kullanıcı kayıtları yüklenemedi.';
        more.textContent = 'Tekrar dene';
        more.hidden = false;
      } finally { if (request === requestId) more.disabled = false; }
    }
    function changeDate() {
      cursor = undefined;
      body.replaceChildren();
      more.hidden = true;
      void load();
    }
    day.onchange = changeDate;
    reset.onclick = () => { day.value = ''; changeDate(); };
    more.onclick = load;
    modal.append(header, filters, note, status, wrap, more);
    modal.addEventListener('close', () => {
      modal.remove();
      if (dialog === modal) dialog = null;
    }, {once:true});
    document.body.append(modal);
    modal.showModal();
    void load();
  }

  function clear() {
    const strip = document.getElementById('overviewQuickInfo');
    if (strip) strip.hidden = true;
    dialog?.close();
    controls?.remove();
    controls = null;
  }

  function update() {
    if (!admin()) { clear(); return; }
    const strip = document.getElementById('overviewQuickInfo');
    const quick = strip?.querySelector('.quick-info');
    if (!quick) return;
    strip.hidden = false;
    if (controls?.isConnected) return;
    controls = node('section');
    controls.id = 'firebaseUsagePanel';
    controls.className = 'firebase-usage overview-admin-controls';
    const history = node('button', 'Kullanıcı Kayıtları');
    history.type = 'button';
    history.setAttribute('aria-haspopup', 'dialog');
    history.onclick = openHistory;
    const usage = node('a', 'Firebase Kullanım Limiti Kontrol Etme');
    usage.href = 'https://console.firebase.google.com/project/brifingbilgisistemi/firestore/usage';
    usage.target = '_blank';
    usage.rel = 'noopener noreferrer';
    controls.append(history, usage);
    quick.append(controls);
  }

  const show = window.show;
  window.show = function(page) {
    const result = show.apply(this, arguments);
    if (page === 'overview' && result !== false) update();
    return result;
  };
  const login = window.login;
  window.login = async function() {
    const result = await login.apply(this, arguments);
    update();
    return result;
  };
  const logout = window.logout;
  window.logout = function() { clear(); return logout.apply(this, arguments); };
  document.addEventListener('visibilitychange', () => {
    if (document.querySelector('#overview.active')) update();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', update, {once:true});
  else update();
  window.FirebaseUsage = {refresh:update};
})();
