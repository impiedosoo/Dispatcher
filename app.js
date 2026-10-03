const STORAGE_KEY = "masterRequests";

let requests = [];
let currentTab = "new";
let editingId = null;

/* =========================
   STORAGE
========================= */

try {
  requests = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
} catch (e) {
  requests = [];
}

requests = requests.map(r => ({
  ...r,
  address: r.address || "",
  time: r.time || "",
  masterNote: r.masterNote || "",
  paid: typeof r.paid === "boolean" ? r.paid : false,
  completedAt: r.completedAt || null,
  paidAt: r.paidAt || null
}));

function saveStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
}

/* =========================
   HELPERS
========================= */

function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function formatMoney(value) {
  return new Intl.NumberFormat("ru-RU").format(Number(value) || 0) + " ₽";
}

function formatDateHuman(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(value + "T00:00:00"));
}

function formatDateTime(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value || "";
  return div.innerHTML;
}

function getDebts() {
  return requests
    .filter(r => r.status === "done" && !r.paid)
    .sort((a, b) => {
      const aDate = a.completedAt || a.date || "";
      const bDate = b.completedAt || b.date || "";
      return bDate.localeCompare(aDate);
    });
}

/* =========================
   NAVIGATION
========================= */

function showPage(page) {
  const pages = {
    today: document.getElementById("todayPage"),
    orders: document.getElementById("ordersPage"),
    debts: document.getElementById("debtsPage")
  };

  Object.keys(pages).forEach(name => {
    pages[name].style.display = name === page ? "block" : "none";
  });

  document.getElementById("navToday")
    .classList.toggle("active", page === "today");

  document.getElementById("navOrders")
    .classList.toggle("active", page === "orders");

  document.getElementById("navDebts")
    .classList.toggle("active", page === "debts");

  if (page === "today") renderToday();
  if (page === "orders") renderOrders();
  if (page === "debts") renderDebts();
}

/* =========================
   FORM
========================= */

function clearForm() {
  [
    "clientName",
    "phone",
    "description",
    "address",
    "date",
    "time",
    "masterNote",
    "price"
  ].forEach(id => {
    document.getElementById(id).value = "";
  });

  document.getElementById("status").value = "new";
  document.getElementById("paid").checked = false;
}

function showForm(id = null) {
  editingId = id;

  document.getElementById("formOverlay").classList.add("visible");
  document.body.style.overflow = "hidden";

  if (id === null) {
    clearForm();

    document.getElementById("date").value = localDateString();
    document.getElementById("formTitle").textContent = "Новая заявка";
    document.getElementById("deleteEditButton").style.display = "none";

    return;
  }

  const r = requests.find(item => item.id === id);

  if (!r) {
    hideForm();
    return;
  }

  document.getElementById("clientName").value = r.clientName || "";
  document.getElementById("phone").value = r.phone || "";
  document.getElementById("description").value = r.description || "";
  document.getElementById("address").value = r.address || "";
  document.getElementById("date").value = r.date || "";
  document.getElementById("time").value = r.time || "";
  document.getElementById("masterNote").value = r.masterNote || "";
  document.getElementById("price").value = r.price || "";
  document.getElementById("status").value = r.status || "new";
  document.getElementById("paid").checked = Boolean(r.paid);

  document.getElementById("formTitle").textContent = "Редактирование";
  document.getElementById("deleteEditButton").style.display = "block";
}

function hideForm() {
  document.getElementById("formOverlay").classList.remove("visible");
  document.body.style.overflow = "";
  editingId = null;
}

function saveRequest() {
  const clientName = document.getElementById("clientName").value.trim();

  if (!clientName) {
    alert("Укажи имя клиента");
    return;
  }

  const data = {
    clientName,
    phone: document.getElementById("phone").value.trim(),
    description: document.getElementById("description").value.trim(),
    address: document.getElementById("address").value.trim(),
    date: document.getElementById("date").value,
    time: document.getElementById("time").value,
    masterNote: document.getElementById("masterNote").value.trim(),
    price: Number(document.getElementById("price").value) || 0,
    status: document.getElementById("status").value,
    paid: document.getElementById("paid").checked
  };

  const now = new Date().toISOString();

  if (editingId !== null) {
    const r = requests.find(item => item.id === editingId);

    if (r) {
      const wasDone = r.status === "done";
      const wasPaid = r.paid;

      Object.assign(r, data);

      if (!wasDone && r.status === "done") {
        r.completedAt = now;
      }

      if (r.status !== "done") {
        r.completedAt = null;
      }

      if (!wasPaid && r.paid) {
        r.paidAt = now;
      }

      if (!r.paid) {
        r.paidAt = null;
      }
    }
  } else {
    requests.unshift({
      id: Date.now() + Math.floor(Math.random() * 1000),
      ...data,
      createdAt: now,
      completedAt: data.status === "done" ? now : null,
      paidAt: data.paid ? now : null
    });
  }

  saveStorage();
  hideForm();
  renderAll();
}

function deleteEditingRequest() {
  if (editingId === null) return;

  const r = requests.find(item => item.id === editingId);
  if (!r) return;

  if (!confirm(`Удалить заявку клиента «${r.clientName}»?`)) return;

  requests = requests.filter(item => item.id !== editingId);

  saveStorage();
  hideForm();
  renderAll();
}

/* =========================
   STATUS / PAYMENT
========================= */

function changeStatus(id, status) {
  const r = requests.find(item => item.id === id);
  if (!r) return;

  const previous = r.status;

  r.status = status;

  if (previous !== "done" && status === "done") {
    r.completedAt = new Date().toISOString();
  }

  if (status !== "done") {
    r.completedAt = null;
  }

  saveStorage();
  renderAll();
}

function markPaid(id) {
  const r = requests.find(item => item.id === id);
  if (!r) return;

  r.paid = !r.paid;
  r.paidAt = r.paid ? new Date().toISOString() : null;

  saveStorage();
  renderAll();
}

/* =========================
   QUICK ACTIONS
========================= */

function callClient(id) {
  const r = requests.find(item => item.id === id);

  if (!r || !r.phone) {
    alert("У клиента не указан телефон");
    return;
  }

  const phone = r.phone.replace(/[^\d+]/g, "");
  window.location.href = "tel:" + phone;
}

function normalizeWhatsAppPhone(phone) {
  let digits = String(phone || "").replace(/\D/g, "");

  if (digits.length === 11 && digits.startsWith("8")) {
    digits = "7" + digits.slice(1);
  }

  if (digits.length === 10) {
    digits = "7" + digits;
  }

  return digits;
}

function messageClient(id) {
  const r = requests.find(item => item.id === id);

  if (!r || !r.phone) {
    alert("У клиента не указан телефон");
    return;
  }

  const phone = normalizeWhatsAppPhone(r.phone);

  const message = r.time
    ? `Здравствуйте, ${r.clientName}! По вашей заявке буду ориентировочно в ${r.time}.`
    : `Здравствуйте, ${r.clientName}! Пишу по вашей заявке.`;

  window.open(
    `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
    "_blank"
  );
}

function openRoute(id) {
  const r = requests.find(item => item.id === id);

  if (!r || !r.address) {
    alert("У заявки не указан адрес");
    return;
  }

  window.open(
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.address)}`,
    "_blank"
  );
}

/* =========================
   ORDER TABS
========================= */

function setTab(tab) {
  currentTab = tab;

  ["new", "work", "done"].forEach(name => {
    document.getElementById("tab-" + name)
      .classList.toggle("active", name === tab);
  });

  renderOrders();
}

/* =========================
   CARD
========================= */

function cardHtml(r, overdue = false) {
  let statusButton = "";

  if (r.status === "new") {
    statusButton = `
      <button class="work" onclick="changeStatus(${r.id}, 'work')">
        ▶ В работу
      </button>
    `;
  }

  if (r.status === "work") {
    statusButton = `
      <button class="done" onclick="changeStatus(${r.id}, 'done')">
        ✓ Завершить
      </button>
    `;
  }

  if (r.status === "done") {
    statusButton = `
      <button class="work" onclick="changeStatus(${r.id}, 'work')">
        ↩ Вернуть
      </button>
    `;
  }

  return `
    <div class="request ${overdue ? "overdue" : ""}">

      <div class="request-top">
        <div class="client">${escapeHtml(r.clientName)}</div>
        <div class="price">${formatMoney(r.price)}</div>
      </div>

      ${r.description ? `
        <div class="job">${escapeHtml(r.description)}</div>
      ` : ""}

      ${r.time ? `
        <div class="meta time">🕐 ${escapeHtml(r.time)}</div>
      ` : ""}

      ${r.date ? `
        <div class="meta">📅 ${formatDateHuman(r.date)}</div>
      ` : ""}

      ${r.address ? `
        <div class="meta">📍 ${escapeHtml(r.address)}</div>
      ` : ""}

      ${r.phone ? `
        <div class="meta">📞 ${escapeHtml(r.phone)}</div>
      ` : ""}

      ${r.masterNote ? `
        <div class="master-note">
          📝 ${escapeHtml(r.masterNote)}
        </div>
      ` : ""}

      ${r.completedAt ? `
        <div class="meta">
          Завершено: ${formatDateTime(r.completedAt)}
        </div>
      ` : ""}

      <div class="payment ${r.paid ? "paid" : "unpaid"}">
        ${r.paid ? "✓ Оплачено" : "● Не оплачено"}
      </div>

      <div class="quick-actions">

        ${r.phone ? `
          <button onclick="callClient(${r.id})">
            📞 Позвонить
          </button>

          <button onclick="messageClient(${r.id})">
            💬 Написать
          </button>
        ` : ""}

        ${r.address ? `
          <button onclick="openRoute(${r.id})">
            📍 Маршрут
          </button>
        ` : ""}

      </div>

      <div class="actions">

        ${statusButton}

        <button class="edit" onclick="showForm(${r.id})">
          ✎ Изменить
        </button>

        ${r.status === "done" ? `
          <button class="paid-button" onclick="markPaid(${r.id})">
            ${r.paid ? "Отменить оплату" : "₽ Оплачено"}
          </button>
        ` : ""}

      </div>

    </div>
  `;
}

/* =========================
   NEXT JOB
========================= */

function renderNextJob(todayRequests) {
  const box = document.getElementById("nextJob");

  if (!todayRequests.length) {
    box.innerHTML = "";
    return;
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let next = todayRequests.find(r => {
    if (!r.time) return false;

    const [hours, minutes] = r.time.split(":").map(Number);

    return hours * 60 + minutes >= currentMinutes;
  });

  if (!next) {
    next = todayRequests[0];
  }

  box.innerHTML = `
    <div class="next-job">

      <div class="next-label">
        Ближайшая заявка
      </div>

      <div class="next-main">

        <div>
          <strong>${escapeHtml(next.time || "Без времени")}</strong>
          ${escapeHtml(next.clientName)}
        </div>

        <div>
          ${formatMoney(next.price)}
        </div>

      </div>

      ${next.description ? `
        <div class="next-description">
          ${escapeHtml(next.description)}
        </div>
      ` : ""}

      <button class="next-open" onclick="showForm(${next.id})">
        Открыть заявку
      </button>

    </div>
  `;
}

/* =========================
   TODAY
========================= */

function renderToday() {
  const today = localDateString();

  const todayRequests = requests
    .filter(r => r.date === today && r.status !== "done")
    .sort((a, b) =>
      (a.time || "99:99").localeCompare(b.time || "99:99")
    );

  const overdue = requests.filter(
    r => r.date && r.date < today && r.status !== "done"
  );

  const todayMoney = todayRequests.reduce(
    (sum, r) => sum + Number(r.price || 0),
    0
  );

  const todayReceived = requests
    .filter(r =>
      r.paid &&
      r.paidAt &&
      localDateString(new Date(r.paidAt)) === today
    )
    .reduce(
      (sum, r) => sum + Number(r.price || 0),
      0
    );

  const debtTotal = getDebts().reduce(
    (sum, r) => sum + Number(r.price || 0),
    0
  );

  document.getElementById("todayCount").textContent =
    todayRequests.length;

  document.getElementById("todayMoney").textContent =
    formatMoney(todayMoney);

  document.getElementById("todayReceived").textContent =
    formatMoney(todayReceived);

  document.getElementById("unpaidMoney").textContent =
    formatMoney(debtTotal);

  renderNextJob(todayRequests);

  document.getElementById("todayRequests").innerHTML =
    todayRequests.length
      ? todayRequests.map(r => cardHtml(r)).join("")
      : `<div class="empty">На сегодня активных заявок нет.</div>`;

  const overdueTitle = document.getElementById("overdueTitle");
  const overdueBox = document.getElementById("overdueRequests");

  if (overdue.length) {
    overdueTitle.style.display = "block";
    overdueBox.innerHTML =
      overdue.map(r => cardHtml(r, true)).join("");
  } else {
    overdueTitle.style.display = "none";
    overdueBox.innerHTML = "";
  }
}

/* =========================
   ORDERS
========================= */

function renderOrders() {
  const newRequests =
    requests.filter(r => r.status === "new");

  const workRequests =
    requests.filter(r => r.status === "work");

  const doneRequests =
    requests.filter(r => r.status === "done");

  document.getElementById("totalCount").textContent =
    requests.length;

  document.getElementById("workCount").textContent =
    workRequests.length;

  document.getElementById("doneCount").textContent =
    doneRequests.length;

  const income = doneRequests
    .filter(r => r.paid)
    .reduce(
      (sum, r) => sum + Number(r.price || 0),
      0
    );

  document.getElementById("income").textContent =
    formatMoney(income);

  document.getElementById("tabNewCount").textContent =
    `(${newRequests.length})`;

  document.getElementById("tabWorkCount").textContent =
    `(${workRequests.length})`;

  document.getElementById("tabDoneCount").textContent =
    `(${doneRequests.length})`;

  const searchElement =
    document.getElementById("search");

  const query =
    searchElement
      ? searchElement.value.trim().toLowerCase()
      : "";

  let visible =
    requests.filter(r => r.status === currentTab);

  if (query) {
    visible = visible.filter(r => {
      const text = [
        r.clientName,
        r.phone,
        r.description,
        r.address,
        r.masterNote
      ].join(" ").toLowerCase();

      return text.includes(query);
    });
  }

  document.getElementById("requests").innerHTML =
    visible.length
      ? visible.map(r => cardHtml(r)).join("")
      : `<div class="empty">${
          query
            ? "Ничего не найдено."
            : "Здесь пока нет заявок."
        }</div>`;
}

/* =========================
   DEBTS
========================= */

function renderDebts() {
  const debts = getDebts();

  const total = debts.reduce(
    (sum, r) => sum + Number(r.price || 0),
    0
  );

  document.getElementById("debtTotal").textContent =
    formatMoney(total);

  document.getElementById("debtCount").textContent =
    debts.length;

  document.getElementById("navDebtCount").textContent =
    debts.length ? `(${debts.length})` : "";

  const box =
    document.getElementById("debtsList");

  if (!debts.length) {
    box.innerHTML = `
      <div class="empty">
        Текущих долгов нет.
      </div>
    `;

    return;
  }

  box.innerHTML = debts.map(r => `
    <div class="debt-card">

      <div class="debt-top">

        <div class="debt-client">
          ${escapeHtml(r.clientName)}
        </div>

        <div class="debt-price">
          ${formatMoney(r.price)}
        </div>

      </div>

      ${r.description ? `
        <div class="job">
          ${escapeHtml(r.description)}
        </div>
      ` : ""}

      ${r.phone ? `
        <div class="meta">
          📞 ${escapeHtml(r.phone)}
        </div>
      ` : ""}

      ${r.completedAt ? `
        <div class="meta">
          Завершено: ${formatDateTime(r.completedAt)}
        </div>
      ` : r.date ? `
        <div class="meta">
          📅 ${formatDateHuman(r.date)}
        </div>
      ` : ""}

      <div class="quick-actions">

        ${r.phone ? `
          <button onclick="callClient(${r.id})">
            📞 Позвонить
          </button>

          <button onclick="messageClient(${r.id})">
            💬 Написать
          </button>
        ` : ""}

      </div>

      <div class="debt-actions">

        <button
          class="debt-open"
          onclick="showForm(${r.id})"
        >
          Открыть заявку
        </button>

        <button
          class="debt-pay"
          onclick="markPaid(${r.id})"
        >
          ✓ Оплачено
        </button>

      </div>

    </div>
  `).join("");
}

/* =========================
   RENDER
========================= */

function renderAll() {
  renderToday();
  renderOrders();
  renderDebts();
}

/* =========================
   START
========================= */

document.getElementById("todayDate").textContent =
  new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(new Date());

saveStorage();
renderAll();