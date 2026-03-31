import { updateOrderStatusGQL, deleteOrderGQL } from './graphql-client.js';

// ── REPLACE FIREBASE CONFIG 
const firebaseConfig = {
  apiKey:     "AIzaSyANahV1JOHQqEweg6e8i_LvltXNCTW-kIw",
  authDomain: "cafe-moliere.github.io",
  projectId:  "cafe-moliere",
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let orders = {};
let history = {};
let firstLoad = true;
let openCards = new Set();
let openDays = new Set();
let openHistoryItems = new Set();

function formatLL(n){ return 'LL ' + Number(n).toLocaleString(); }

window.switchTab = (name, btn) => {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel, .history-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-' + name).classList.add('active');
}

window.toggleCard = (id) => {
  if (openCards.has(id)) openCards.delete(id); else openCards.add(id);
  render();
}

window.toggleDay = (date) => {
  if (openDays.has(date)) openDays.delete(date); else openDays.add(date);
  renderHistory();
}

window.toggleHistoryItem = (id) => {
  if (openHistoryItems.has(id)) openHistoryItems.delete(id); else openHistoryItems.add(id);
  renderHistory();
}

window.moveOrder = async (id, status) => {
  try {
    await updateOrderStatusGQL(id, status);
  } catch (e) {
    console.error("GraphQL update failed, falling back to direct Firebase:", e);
    await db.collection('orders').doc(id).update({ status });
  }
}

window.clearToHistory = async (id) => {
  try {
    await updateOrderStatusGQL(id, 'history');
  } catch (e) {
    console.error("GraphQL update failed, falling back to direct Firebase:", e);
    await db.collection('orders').doc(id).update({ status: 'history' });
  }
}

window.deleteOrder = async (id) => {
  try {
    await deleteOrderGQL(id);
  } catch (e) {
    console.error("GraphQL delete failed, falling back to direct Firebase:", e);
    await db.collection('orders').doc(id).delete();
  }
}

window.sendWhatsApp = (phone, name) => {
  const msg = `Hello ${name}! Your order at Café Molière is ready for delivery. Thank you!`;
  window.open(`https://wa.me/961${phone.replace(/^0/, '')}?text=${encodeURIComponent(msg)}`, '_blank');
}

function renderCard(id, o) {
  const isOpen = openCards.has(id);
  const isNew  = o.status === 'new';
  const isPrep = o.status === 'preparing';
  const isReady= o.status === 'ready';

  const actions = isNew ? `
    <button class="btn btn-prep" onclick="event.stopPropagation();moveOrder('${id}','preparing')">→ Preparing</button>
    <button class="btn btn-del" onclick="event.stopPropagation();deleteOrder('${id}')">🗑</button>
  ` : isPrep ? `
    <button class="btn btn-ready" onclick="event.stopPropagation();moveOrder('${id}','ready')">→ Ready</button>
    <button class="btn btn-del" onclick="event.stopPropagation();deleteOrder('${id}')">🗑</button>
  ` : `
    <button class="btn btn-wa" onclick="event.stopPropagation();sendWhatsApp('${o.phone||''}','${o.name}')">WhatsApp Client</button>
    <button class="btn btn-clear" onclick="event.stopPropagation();clearToHistory('${id}')">Clear ✓</button>
  `;

  return `
    <div class="order-card">
      <div class="card-header" onclick="toggleCard('${id}')">
        <div>
          <div class="card-name">${o.name}</div>
          <div class="card-meta">${o.time} · ${o.address}</div>
        </div>
        <div class="card-right">
          <span class="card-total-badge">${formatLL(o.total)}</span>
          <span class="card-chevron ${isOpen ? 'open' : ''}">▼</span>
        </div>
      </div>
      <div class="card-body ${isOpen ? 'open' : ''}">
        <div class="card-items">
          ${(o.items||[]).map(i=>`
            <div class="card-item"><span>${i.name} x${i.qty}</span><span>${formatLL(i.price)}</span></div>
          `).join('')}
        </div>
        <div class="card-total-row"><span>Total</span><span>${formatLL(o.total)}</span></div>
        <div class="card-address">📍 ${o.address}${o.phone ? ' · 📞 '+o.phone : ''}</div>
        <div class="card-actions">${actions}</div>
      </div>
    </div>`;
}

function render() {
  const byStatus = { new:[], preparing:[], ready:[] };
  Object.entries(orders).forEach(([id,o]) => {
    if (byStatus[o.status]) byStatus[o.status].push([id,o]);
  });

  const slots = [
    { status:'new',       col:'col-new',  bn:'bn', sn:'sn', empty:'No new orders' },
    { status:'preparing', col:'col-prep', bn:'bp', sn:'sp', empty:'Nothing cooking' },
    { status:'ready',     col:'col-ready',bn:'br', sn:'sr', empty:'Nothing ready' },
  ];

  let total = 0;
  slots.forEach(({status, col, bn, sn, empty}) => {
    const entries = byStatus[status];
    document.getElementById(bn).textContent = entries.length;
    document.getElementById(sn).textContent = entries.length;
    total += entries.length;
    document.getElementById(col).innerHTML = entries.length
      ? entries.map(([id,o]) => renderCard(id,o)).join('')
      : `<div class="empty"><div>—</div>${empty}</div>`;
  });
  document.getElementById('tc-orders').textContent = total;
}

function renderHistory() {
  const byDate = {};
  Object.entries(history).forEach(([id,o]) => {
    const date = o.date || 'Unknown date';
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push([id,o]);
  });

  const hCount = Object.values(history).length;
  document.getElementById('tc-history').textContent = hCount;

  const container = document.getElementById('history-content');
  if (!hCount) {
    container.innerHTML = '<div class="history-empty">No history yet</div>';
    return;
  }

  container.innerHTML = Object.entries(byDate).map(([date, entries]) => {
    const isOpen = openDays.has(date);
    const items = entries.map(([id,o]) => {
      const iOpen = openHistoryItems.has(id);
      return `
        <div class="history-item" onclick="toggleHistoryItem('${id}')">
          <div class="history-item-header">
            <span class="history-item-name">${o.name} — ${formatLL(o.total)}</span>
            <span class="history-item-time">${o.time} ▼</span>
          </div>
          <div class="history-item-body ${iOpen ? 'open' : ''}">
            ${(o.items||[]).map(i=>`
              <div class="history-item-row"><span>${i.name} x${i.qty}</span><span>${formatLL(i.price)}</span></div>
            `).join('')}
            <div class="history-item-total"><span>Total</span><span>${formatLL(o.total)}</span></div>
            ${o.address ? `<div style="font-size:10px;color:#555;margin-top:4px">📍 ${o.address}</div>` : ''}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="history-day">
        <div class="history-day-header" onclick="toggleDay('${date}')">
          <span class="history-day-title">📅 ${date}</span>
          <span>
            <span class="history-day-count">${entries.length} order${entries.length>1?'s':''}</span>
            <span class="history-day-chevron ${isOpen?'open':''}"> ▼</span>
          </span>
        </div>
        <div class="history-day-body ${isOpen?'open':''}">${items}</div>
      </div>`;
  }).join('');
}

function showNotif(name) {
  const el = document.createElement('div');
  el.className = 'notif';
  el.textContent = `New order from ${name}!`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

db.collection('orders').orderBy('createdAt','desc')
  .onSnapshot(snapshot => {
    document.getElementById('conn-badge').textContent = '● Live';
    document.getElementById('conn-badge').className = 'conn-badge on';

    snapshot.docChanges().forEach(change => {
      const id   = change.doc.id;
      const data = change.doc.data();

      if (change.type === 'removed') {
        delete orders[id];
        delete history[id];
      } else if (data.status === 'history') {
        delete orders[id];
        history[id] = data;
      } else {
        delete history[id];
        if (change.type === 'added' && !firstLoad) showNotif(data.name);
        orders[id] = data;
      }
    });

    firstLoad = false;
    render();
    renderHistory();
  }, () => {
    document.getElementById('conn-badge').textContent = '● Offline';
    document.getElementById('conn-badge').className = 'conn-badge off';
  });

