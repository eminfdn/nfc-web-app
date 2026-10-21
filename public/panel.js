"use strict";

const MAX_LINKS = 12;

const PACKAGE_COLORS = {
  standard: "#ffffff",
  premium: "#d4af65",
};

const fields = {
  name: document.getElementById("name"),
  job: document.getElementById("job"),
  company: document.getElementById("company"),
  background: document.getElementById("background"),
  accent: document.getElementById("accent"),
};

const profilePhotoInput = document.getElementById("profilePhoto");
const companyLogoInput = document.getElementById("companyLogo");
const statusElement = document.getElementById("status");
const saveButton = document.getElementById("save");
const addLinkButton = document.getElementById("addLink");

let profilePhoto = "";
let companyLogo = "";
let links = [];
let customerId = null;
let customerPlan = "standard";
let currentRole = null;
let imageOperations = 0;
let saving = false;
let currentBio = "";
let initialized = false;

const linkIcons = {
  instagram: "fa-brands fa-instagram",
  sahibinden: "fa-solid fa-house",
  linkedin: "fa-brands fa-linkedin",
  whatsapp: "fa-brands fa-whatsapp",
  phone: "fa-solid fa-phone",
  email: "fa-solid fa-envelope",
  location: "fa-solid fa-location-dot",
  iban: "fa-solid fa-building-columns",
  website: "fa-solid fa-globe",
  custom: "fa-solid fa-link",
};

const types = [
  ["custom", "Özel Bağlantı"],
  ["sahibinden", "Sahibinden"],
  ["instagram", "Instagram"],
  ["linkedin", "LinkedIn"],
  ["whatsapp", "WhatsApp"],
  ["phone", "Telefon"],
  ["email", "E-posta"],
  ["website", "Web Sitesi"],
  ["location", "Konum"],
  ["iban", "IBAN"],
];

function setStatus(message) {
  statusElement.textContent = message;
}

function updateSaveState() {
  saveButton.disabled = !initialized || saving || imageOperations > 0;
}

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
    throw new Error("Oturum sona erdi. Yeniden giriş yap.");
  }

  if (!response.ok) {
    throw new Error(result.error || "İşlem başarısız.");
  }

  return result;
}

function getAccent() {
  return PACKAGE_COLORS[customerPlan];
}

function applyPackageColors() {
  const accent = getAccent();

  fields.accent.value = accent;
  fields.accent.disabled = true;
  fields.accent.title = "Vurgu rengi satın alınan pakete göre belirlenir.";

  const colorLabel = fields.accent.closest("label");

  if (colorLabel) {
    colorLabel.title =
      customerPlan === "premium"
        ? "Premium paket: altın sarısı"
        : "Standart paket: beyaz";
  }

  document.documentElement.style.setProperty("--panel-accent", accent);

  document
    .querySelectorAll(".editor h1, .editor h3, .preview-section h3")
    .forEach((element) => {
      element.style.color = accent;
    });

  const mainSave = document.getElementById("save");

  mainSave.style.backgroundColor = accent;
  mainSave.style.color = "#171717";

  addLinkButton.style.borderColor = accent;
  addLinkButton.style.color = accent;
}

function resizeImage(file, maxSize = 600) {
  return new Promise((resolve, reject) => {
    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      reject(new Error("PNG, JPG veya WebP dosyası seç."));
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      reject(new Error("Görsel en fazla 8 MB olabilir."));
      return;
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      try {
        const scale = Math.min(
          1,
          maxSize / Math.max(image.width, image.height),
        );

        const width = Math.max(1, Math.round(image.width * scale));

        const height = Math.max(1, Math.round(image.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Görsel işlenemedi.");
        }

        context.drawImage(image, 0, 0, width, height);

        const result = canvas.toDataURL("image/webp", 0.78);

        if (result.length > 1800000) {
          throw new Error("Görsel kaydedilemeyecek kadar büyük.");
        }

        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Görsel açılamadı."));
    };

    image.src = objectUrl;
  });
}

async function handleImageUpload(input, kind) {
  const file = input.files[0];

  if (!file) return;

  imageOperations++;
  updateSaveState();

  try {
    const resized = await resizeImage(file, kind === "profile" ? 450 : 800);

    if (kind === "profile") {
      profilePhoto = resized;
    } else {
      companyLogo = resized;
    }

    updatePreview();

    setStatus("Görsel hazır. Kaydet butonuna basmayı unutma.");
  } catch (error) {
    setStatus(error.message);
  } finally {
    imageOperations = Math.max(0, imageOperations - 1);

    input.value = "";
    updateSaveState();
  }
}

profilePhotoInput.addEventListener("change", () => {
  handleImageUpload(profilePhotoInput, "profile");
});

companyLogoInput.addEventListener("change", () => {
  handleImageUpload(companyLogoInput, "company");
});

document.getElementById("removeProfilePhoto").addEventListener("click", () => {
  profilePhoto = "";
  updatePreview();
  setStatus("Profil fotoğrafı kaldırıldı. Kaydetmeyi unutma.");
});

document.getElementById("removeCompanyLogo").addEventListener("click", () => {
  companyLogo = "";
  updatePreview();
  setStatus("Şirket görseli kaldırıldı. Kaydetmeyi unutma.");
});

function getInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "?";

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toLocaleUpperCase("tr-TR");
  }

  return (parts[0][0] + parts[parts.length - 1][0]).toLocaleUpperCase("tr-TR");
}

function renderLinks() {
  const container = document.getElementById("links");
  container.replaceChildren();

  links.forEach((link, index) => {
    const row = document.createElement("div");
    row.className = "link-row";

    const iconPreview = document.createElement("i");

    iconPreview.className = linkIcons[link.type] || linkIcons.custom;

    iconPreview.style.color = getAccent();
    iconPreview.style.fontSize = "24px";
    iconPreview.style.marginRight = "12px";

    const select = document.createElement("select");

    types.forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    });

    select.value = link.type;

    select.addEventListener("change", () => {
      link.type = select.value;

      iconPreview.className = linkIcons[link.type] || linkIcons.custom;

      updatePreview();
    });

    const title = document.createElement("input");
    title.placeholder = "Buton adı";
    title.value = link.title || "";

    title.addEventListener("input", () => {
      link.title = title.value;
      updatePreview();
    });

    const value = document.createElement("input");
    value.placeholder = "Bağlantı, numara veya IBAN";
    value.value = link.value || "";

    value.addEventListener("input", () => {
      link.value = value.value;
      updatePreview();
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Sil";

    remove.addEventListener("click", () => {
      links.splice(index, 1);
      renderLinks();
    });

    row.append(iconPreview, select, title, value, remove);

    container.appendChild(row);
  });

  document.getElementById("count").textContent = `${links.length}/${MAX_LINKS}`;

  addLinkButton.disabled = !initialized || links.length >= MAX_LINKS;

  updatePreview();
}

function updatePreview() {
  const name = fields.name.value;
  const job = fields.job.value;
  const company = fields.company.value;
  const accent = getAccent();
  const background = fields.background.value;

  document.getElementById("previewName").textContent = name;

  document.getElementById("previewJob").textContent = job;

  document.getElementById("previewCompany").textContent = company;

  const preview = document.getElementById("preview");

  preview.style.backgroundColor = background;
  preview.style.borderColor = accent;

  document.getElementById("cover").style.background =
    `linear-gradient(135deg, ${background}, ${accent})`;

  const avatar = document.getElementById("previewAvatar");

  const photo = document.getElementById("previewProfilePhoto");

  const initials = document.getElementById("avatarInitials");

  avatar.style.borderColor = accent;

  if (profilePhoto) {
    photo.src = profilePhoto;
    photo.hidden = false;
    initials.hidden = true;
  } else {
    photo.removeAttribute("src");
    photo.hidden = true;
    initials.hidden = false;
    initials.textContent = getInitials(name);
  }

  const banner = document.getElementById("companyLogoContainer");

  const bannerImage = document.getElementById("previewCompanyLogo");

  if (companyLogo) {
    bannerImage.src = companyLogo;
    banner.hidden = false;
  } else {
    bannerImage.removeAttribute("src");
    banner.hidden = true;
  }

  document.getElementById("previewJob").style.color = accent;

  document.querySelector(".contact").style.backgroundColor = accent;

  const container = document.getElementById("previewLinks");

  container.replaceChildren();

  links.forEach((link) => {
    const item = document.createElement("div");
    item.className = "preview-link";
    item.style.borderColor = accent;

    const icon = document.createElement("i");

    icon.className = linkIcons[link.type] || linkIcons.custom;

    icon.style.color = accent;
    icon.style.marginRight = "12px";

    const text = document.createElement("span");

    text.textContent = link.title || "Yeni Bağlantı";

    item.append(icon, text);
    container.appendChild(item);
  });
}

addLinkButton.addEventListener("click", () => {
  if (!initialized || links.length >= MAX_LINKS) {
    return;
  }

  links.push({
    type: "custom",
    title: "",
    value: "",
  });

  renderLinks();
});

Object.values(fields).forEach((field) => {
  field.addEventListener("input", updatePreview);
});

function getCardPayload() {
  return {
    name: fields.name.value.trim(),
    job: fields.job.value.trim(),
    company: fields.company.value.trim(),
    bio: currentBio,
    background: fields.background.value,
    accent: getAccent(),
    profilePhoto,
    companyLogo,
    links: links.map((link) => ({
      type: link.type,
      title: link.title,
      value: link.value,
    })),
  };
}

saveButton.addEventListener("click", async () => {
  if (!initialized || !customerId) {
    setStatus("Müşteri kartviziti henüz yüklenmedi.");
    return;
  }

  if (imageOperations > 0) {
    setStatus("Görseller işleniyor. Lütfen bekle.");
    return;
  }

  saving = true;
  updateSaveState();
  setStatus("Kartvizit kaydediliyor...");

  try {
    await apiRequest("/api/editor/" + encodeURIComponent(customerId), {
      method: "PUT",
      body: JSON.stringify({
        card: getCardPayload(),
      }),
    });

    setStatus("Kartvizit ve görseller başarıyla kaydedildi.");
  } catch (error) {
    setStatus(error.message);
  } finally {
    saving = false;
    updateSaveState();
  }
});

async function initializePanel() {
  saveButton.disabled = true;
  addLinkButton.disabled = true;
  setStatus("Kartvizit yükleniyor...");

  try {
    const me = await apiRequest("/api/me");

    if (me.role !== "admin" && me.role !== "premium") {
      window.location.href = "/giris";
      return;
    }

    currentRole = me.role;

    const requestedId = new URLSearchParams(window.location.search).get(
      "customer",
    );

    if (currentRole === "admin") {
      if (!requestedId) {
        throw new Error(
          "Düzenlenecek müşteri seçilmedi. Admin panelinden müşteri seç.",
        );
      }

      customerId = requestedId;
    } else {
      customerId = "me";
    }

    const customer = await apiRequest(
      "/api/editor/" + encodeURIComponent(customerId),
    );

    customerPlan = customer.plan === "premium" ? "premium" : "standard";

    const card = customer.card || {};
    currentBio = card.bio || "";

    fields.name.value = card.name || customer.name || "";

    fields.job.value = card.job || "";
    fields.company.value = card.company || "";

    fields.background.value = /^#[0-9a-f]{6}$/i.test(card.background)
      ? card.background
      : "#171717";

    profilePhoto = card.profilePhoto || "";
    companyLogo = card.companyLogo || "";

    links = Array.isArray(card.links)
      ? card.links.slice(0, MAX_LINKS).map((link) => ({
          type: link.type || "custom",
          title: link.title || "",
          value: link.value || "",
        }))
      : [];

    const backButton = document.getElementById("backToAdmin");

    if (backButton) {
      backButton.hidden = currentRole !== "admin";
    }

    document.querySelector(".editor h1").textContent =
      customer.name + " - Kartvizit Düzenle";

    document.querySelector("header span").textContent =
      customerPlan === "premium" ? "Premium Kartvizit" : "Standart Kartvizit";

    applyPackageColors();

    initialized = true;
    renderLinks();
    updateSaveState();

    setStatus("Kartvizit düzenlemeye hazır.");
  } catch (error) {
    initialized = false;
    updateSaveState();
    setStatus(error.message);
  }
}

initializePanel();
