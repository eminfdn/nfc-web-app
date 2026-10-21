"use strict";

let customers = [];
let editingCustomerId = null;

const form = document.getElementById("customerForm");
const table = document.getElementById("customerTable");
const message = document.getElementById("formMessage");

const saveBtn = document.getElementById("saveCustomerBtn");
const cancelBtn = document.getElementById("cancelEditBtn");
const formTitle = document.getElementById("formTitle");

const searchInput = document.getElementById("customerSearch");
const clearSearchBtn = document.getElementById("clearSearch");
const resultCount = document.getElementById("searchResultCount");

const totalCount = document.getElementById("totalCount");
const standardCount = document.getElementById("standardCount");
const premiumCount = document.getElementById("premiumCount");

const passwordInput = document.getElementById("customerPassword");
const passwordField = document.getElementById("passwordField");
const passwordHelp = document.getElementById("passwordHelp");

async function apiRequest(url, options = {}) {
  let response;

  try {
    response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new Error("Sunucuya bağlanılamadı.");
  }

  const result = await response.json().catch(() => ({}));

  if (response.status === 401) {
    window.location.href = "/giris";
    throw new Error("Oturum sona erdi.");
  }

  if (!response.ok) {
    throw new Error(result.error || "İşlem başarısız.");
  }

  return result;
}

async function loadCustomers() {
  customers = await apiRequest("/api/customers");
  renderCustomers();
}

function normalizeText(value) {
  return String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .trim();
}

function getFilteredCustomers() {
  const query = normalizeText(searchInput.value);

  if (!query) return customers;

  return customers.filter((customer) =>
    [customer.name, customer.email, customer.phone, customer.slug].some(
      (value) => normalizeText(value).includes(query),
    ),
  );
}

function updateStats() {
  totalCount.textContent = customers.length;

  standardCount.textContent = customers.filter(
    (customer) => customer.plan === "standard",
  ).length;

  premiumCount.textContent = customers.filter(
    (customer) => customer.plan === "premium",
  ).length;
}

function makeButton(text, className, callback) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  button.addEventListener("click", callback);
  return button;
}

function makeDetail(text, className = "customer-detail") {
  const element = document.createElement("div");
  element.className = className;
  element.textContent = text || "";
  return element;
}

function renderCustomers() {
  updateStats();

  const filtered = getFilteredCustomers();
  const isSearching = searchInput.value.trim() !== "";

  clearSearchBtn.hidden = !isSearching;

  resultCount.textContent = isSearching
    ? `${filtered.length} müşteri bulundu.`
    : `${customers.length} müşteri listeleniyor.`;

  table.replaceChildren();

  if (!filtered.length) {
    const row = table.insertRow();
    const cell = row.insertCell();

    cell.colSpan = 4;
    cell.className = "empty";
    cell.textContent = isSearching
      ? "Aramanızla eşleşen müşteri bulunamadı."
      : "Henüz müşteri eklenmedi.";
    return;
  }

  filtered.forEach((customer) => {
    const row = table.insertRow();

    const nameCell = row.insertCell();
    const name = document.createElement("strong");
    name.className = "customer-name";
    name.textContent = customer.name;

    const email = makeDetail(customer.email);
    const phone = makeDetail(customer.phone);
    const status = makeDetail(
      customer.active ? "● Aktif" : "● Pasif",
      customer.active ? "status-active" : "status-inactive",
    );

    nameCell.append(name, email, phone, status);

    const planCell = row.insertCell();
    const badge = document.createElement("span");

    badge.className =
      customer.plan === "premium" ? "plan-badge premium" : "plan-badge";

    badge.textContent = customer.plan === "premium" ? "Premium ★" : "Standart";

    planCell.appendChild(badge);

    const slugCell = row.insertCell();
    const link = document.createElement("a");

    link.href = "/kart/" + encodeURIComponent(customer.slug);
    link.textContent = "/kart/" + customer.slug;
    link.className = "card-link";
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    slugCell.appendChild(link);

    const actionCell = row.insertCell();
    const actions = document.createElement("div");
    actions.className = "actions";

    actions.appendChild(
      makeButton("Kartvizit", "card-edit-btn", () => {
        window.location.href =
          "/panel?customer=" + encodeURIComponent(customer.id);
      }),
    );

    actions.appendChild(
      makeButton("Düzenle", "edit-btn", () => {
        editCustomer(customer.id);
      }),
    );

    actions.appendChild(
      makeButton("Sil", "delete-btn", () => {
        deleteCustomer(customer.id);
      }),
    );

    actionCell.appendChild(actions);
  });
}

function updatePasswordVisibility() {
  const plan = document.querySelector('input[name="plan"]:checked')?.value;

  const premium = plan === "premium";

  passwordField.hidden = !premium;
  passwordInput.required = premium && editingCustomerId === null;

  passwordHelp.textContent = editingCustomerId
    ? "Şifreyi değiştirmek istemiyorsan boş bırak."
    : "Premium müşterinin giriş şifresi en az 12 karakter olmalı.";

  if (!premium) passwordInput.value = "";
}

function resetForm() {
  form.reset();
  editingCustomerId = null;

  formTitle.textContent = "Yeni Müşteri";
  saveBtn.textContent = "Müşteri Ekle";
  cancelBtn.hidden = true;

  passwordInput.value = "";
  updatePasswordVisibility();
}

function editCustomer(id) {
  const customer = customers.find((item) => item.id === id);
  if (!customer) return;

  editingCustomerId = id;

  document.getElementById("customerName").value = customer.name || "";
  document.getElementById("customerEmail").value = customer.email || "";
  document.getElementById("customerPhone").value = customer.phone || "";
  document.getElementById("customerSlug").value = customer.slug || "";
  document.getElementById("customerActive").checked = customer.active !== false;

  const plan = customer.plan === "premium" ? "premium" : "standard";
  const radio = document.querySelector(`input[name="plan"][value="${plan}"]`);

  if (radio) radio.checked = true;

  passwordInput.value = "";

  formTitle.textContent = "Müşteri Düzenle";
  saveBtn.textContent = "Değişiklikleri Kaydet";
  cancelBtn.hidden = false;

  updatePasswordVisibility();

  message.textContent = customer.name + " düzenleniyor.";

  document.getElementById("new-customer").scrollIntoView({
    behavior: "smooth",
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const plan =
    document.querySelector('input[name="plan"]:checked')?.value || "standard";

  const payload = {
    name: document.getElementById("customerName").value.trim(),
    email: document.getElementById("customerEmail").value.trim(),
    phone: document.getElementById("customerPhone").value.trim(),
    slug: document.getElementById("customerSlug").value.trim(),
    active: document.getElementById("customerActive").checked,
    plan,
    password: plan === "premium" ? passwordInput.value : "",
  };

  const isEditing = editingCustomerId !== null;

  saveBtn.disabled = true;
  message.textContent = "Kaydediliyor...";

  try {
    await apiRequest(
      isEditing
        ? "/api/customers/" + encodeURIComponent(editingCustomerId)
        : "/api/customers",
      {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify(payload),
      },
    );

    resetForm();
    await loadCustomers();

    message.textContent = isEditing
      ? "Müşteri güncellendi."
      : "Yeni müşteri oluşturuldu.";
  } catch (error) {
    message.textContent = error.message;
  } finally {
    saveBtn.disabled = false;
  }
});

async function deleteCustomer(id) {
  const customer = customers.find((item) => item.id === id);
  if (!customer) return;

  if (!confirm(customer.name + " adlı müşteriyi silmek istiyor musun?")) {
    return;
  }

  try {
    await apiRequest("/api/customers/" + encodeURIComponent(id), {
      method: "DELETE",
    });

    if (editingCustomerId === id) resetForm();

    await loadCustomers();
    message.textContent = "Müşteri silindi.";
  } catch (error) {
    message.textContent = error.message;
  }
}

searchInput.addEventListener("input", renderCustomers);
searchInput.addEventListener("search", renderCustomers);

clearSearchBtn.addEventListener("click", () => {
  searchInput.value = "";
  renderCustomers();
  searchInput.focus();
});

cancelBtn.addEventListener("click", () => {
  resetForm();
  message.textContent = "Düzenleme iptal edildi.";
});

document.querySelectorAll('input[name="plan"]').forEach((radio) => {
  radio.addEventListener("change", updatePasswordVisibility);
});

async function initialize() {
  resetForm();

  try {
    await loadCustomers();
  } catch (error) {
    message.textContent = error.message;
    table.replaceChildren();
    resultCount.textContent = "Müşteriler yüklenemedi.";
  }
}

initialize();
