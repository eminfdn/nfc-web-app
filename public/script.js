"use strict";

// NFC Dijital Kartvizit - Herkese Açık Sayfa

const cardIcons = {
  instagram: "fa-brands fa-instagram",
  linkedin: "fa-brands fa-linkedin",
  whatsapp: "fa-brands fa-whatsapp",
  phone: "fa-solid fa-phone",
  email: "fa-solid fa-envelope",
  website: "fa-solid fa-globe",
  location: "fa-solid fa-location-dot",
  iban: "fa-solid fa-building-columns",
  sahibinden: "fa-solid fa-house",
  custom: "fa-solid fa-link",
};

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

function normalizePhone(value) {
  return String(value || "").replace(/[^\d+]/g, "");
}

function getLinkDestination(link) {
  const value = String(link.value || "").trim();

  if (!value) return null;

  if (link.type === "phone") {
    const phone = normalizePhone(value);

    return /^\+?\d{7,15}$/.test(phone) ? "tel:" + phone : null;
  }

  if (link.type === "email") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? "mailto:" + value : null;
  }

  if (link.type === "whatsapp" && !value.includes("://")) {
    const phone = value.replace(/\D/g, "");

    if (/^\d{7,15}$/.test(phone)) {
      return "https://wa.me/" + phone;
    }
  }

  try {
    const url = new URL(value);

    if (url.protocol === "https:" || url.protocol === "http:") {
      return url.href;
    }
  } catch {
    return null;
  }

  return null;
}

function getContactValue(links, type) {
  const link = links.find((item) => item && item.type === type);

  return link ? String(link.value || "") : "";
}

function setStatus(message) {
  document.getElementById("actionStatus").textContent = message;
}

function showError(message) {
  document.getElementById("card").hidden = true;
  document.getElementById("errorPage").hidden = false;

  document.getElementById("errorMessage").textContent = message;
}

function escapeVcard(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function setupContactButton(customer, links) {
  const button = document.getElementById("saveContact");

  button.addEventListener("click", () => {
    const phone = customer.phone || getContactValue(links, "phone");

    const email = customer.email || getContactValue(links, "email");

    const vcard = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:" + escapeVcard(customer.name),
      "TEL;TYPE=CELL:" + escapeVcard(phone),
      "EMAIL:" + escapeVcard(email),
      "ORG:" + escapeVcard(customer.company),
      "TITLE:" + escapeVcard(customer.job),
      "END:VCARD",
    ].join("\r\n");

    const blob = new Blob([vcard], {
      type: "text/vcard;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "kartvizit.vcf";

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setStatus("Rehber dosyası hazırlandı.");

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  });
}

function setupShareButton(name) {
  const button = document.getElementById("shareCard");

  button.addEventListener("click", async () => {
    const url = window.location.href;

    if (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    ) {
      setStatus(
        "Bu adres yalnızca bilgisayarında çalışır. " +
          "Kartviziti başkalarıyla paylaşmak için " +
          "siteyi internete yayınlamamız gerekiyor.",
      );
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: name + " | Dijital Kartvizit",
          text: name + " - Dijital Kartvizit",
          url,
        });

        setStatus("Paylaşım işlemi tamamlandı.");
        return;
      } catch (error) {
        if (error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setStatus("Kartvizit bağlantısı kopyalandı.");
    } catch {
      window.prompt("Kartvizit bağlantısını kopyalayın:", url);
    }
  });
}

function renderCard(customer) {
  document.getElementById("card").hidden = false;
  document.getElementById("errorPage").hidden = true;
  const links = Array.isArray(customer.links)
    ? customer.links.slice(0, 12)
    : [];

  const name = customer.name || "Dijital Kartvizit";

  document.title = name + " | Dijital Kartvizit";

  document.getElementById("customerName").textContent = name;

  document.getElementById("customerJob").textContent = customer.job || "";

  document.getElementById("customerCompany").textContent =
    customer.company || "";

  document.getElementById("customerBio").textContent = customer.bio || "";

  const background = /^#[0-9a-f]{6}$/i.test(customer.background)
    ? customer.background
    : "#171717";

  const accent = /^#[0-9a-f]{6}$/i.test(customer.accent)
    ? customer.accent
    : "#ffffff";

  document.documentElement.style.setProperty("--card-background", background);

  document.documentElement.style.setProperty("--card-accent", accent);

  const cover = document.getElementById("cover");
  const avatar = document.getElementById("avatar");

  cover.style.background = `linear-gradient(135deg, ${background}, ${accent})`;

  avatar.style.borderColor = accent;

  const profilePhoto = document.getElementById("profilePhoto");

  const initials = document.getElementById("avatarInitials");

  if (customer.profilePhoto) {
    profilePhoto.src = customer.profilePhoto;
    profilePhoto.hidden = false;
    initials.hidden = true;
  } else {
    profilePhoto.removeAttribute("src");
    profilePhoto.hidden = true;
    initials.hidden = false;
    initials.textContent = getInitials(name);
  }

  const banner = document.getElementById("companyLogoContainer");

  const bannerImage = document.getElementById("companyLogo");

  if (customer.companyLogo) {
    bannerImage.src = customer.companyLogo;
    banner.hidden = false;
  } else {
    bannerImage.removeAttribute("src");
    banner.hidden = true;
  }

  const container = document.getElementById("links");
  container.replaceChildren();

  links.forEach((link) => {
    if (!link || !link.value) return;

    const isIban = link.type === "iban";
    const destination = isIban ? null : getLinkDestination(link);

    if (!isIban && !destination) return;

    const element = document.createElement(isIban ? "button" : "a");

    element.className = "link-button";

    const icon = document.createElement("i");
    icon.className = "link-icon " + (cardIcons[link.type] || cardIcons.custom);

    const title = document.createElement("span");
    title.textContent = link.title || "Bağlantı";

    element.append(icon, title);

    if (isIban) {
      element.type = "button";

      element.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(String(link.value));

          setStatus("IBAN kopyalandı.");
        } catch {
          window.prompt("IBAN numarasını kopyalayın:", String(link.value));
        }
      });
    } else {
      element.href = destination;

      if (/^https?:\/\//i.test(destination)) {
        element.target = "_blank";
        element.rel = "noopener noreferrer";
      }
    }

    container.appendChild(element);
  });

  setupContactButton(customer, links);
  setupShareButton(name);
}

async function initializeCard() {
  const match = window.location.pathname.match(/^\/kart\/([^/]+)\/?$/);

  if (!match) {
    showError(
      "Bu sayfada kartvizit bulunmuyor. " +
        "Lütfen size verilen özel kartvizit bağlantısını açın.",
    );
    return;
  }

  let slug;

  try {
    slug = decodeURIComponent(match[1]);
  } catch {
    showError("Kartvizit adresi geçersiz.");
    return;
  }

  try {
    const response = await fetch("/api/card/" + encodeURIComponent(slug), {
      credentials: "same-origin",
      cache: "no-store",
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showError(result.error || "Kartvizit bulunamadı.");
      return;
    }

    renderCard(result);
  } catch {
    showError("Kartvizit yüklenemedi. Lütfen tekrar deneyin.");
  }
}

initializeCard();
