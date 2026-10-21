"use strict";

require("dotenv").config();

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const session = require("express-session");
const MongoStore = require("connect-mongo");

const Customer = require("./models/Customer");
const Admin = require("./models/Admin");

const app = express();
const PORT = Number(process.env.PORT || 3000);

const { MONGODB_URI, SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD } =
  process.env;

if (
  !MONGODB_URI ||
  !SESSION_SECRET ||
  SESSION_SECRET.length < 32 ||
  !ADMIN_EMAIL ||
  !ADMIN_PASSWORD ||
  ADMIN_PASSWORD.length < 12
) {
  console.error(
    "MongoDB veya yönetici ayarları eksik. .env dosyasını kontrol edin.",
  );
  process.exit(1);
}

const publicFolder = path.join(__dirname, "public");

app.disable("x-powered-by");

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(express.json({ limit: "5mb" }));

app.use(
  session({
    name: "nfc.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: MONGODB_URI,
      collectionName: "sessions",
    }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 12 * 60 * 60 * 1000,
    },
  }),
);

const ACCENTS = {
  standard: "#ffffff",
  premium: "#d4af65",
};

function sendPage(filename) {
  return (req, res) => {
    res.sendFile(path.join(publicFolder, filename));
  };
}

function requireLogin(req, res, next) {
  if (!req.session.role) {
    return res.status(401).json({
      error: "Giriş yapmanız gerekiyor.",
    });
  }

  next();
}

function requireAdmin(req, res, next) {
  if (req.session.role !== "admin") {
    return res.status(403).json({
      error: "Yönetici yetkisi gerekiyor.",
    });
  }

  next();
}

function customerData(customer) {
  return {
    id: String(customer._id),
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    slug: customer.slug,
    active: customer.active,
    plan: customer.plan,
    card: customer.card,
  };
}

function sendError(res, error) {
  console.error(error);

  if (error.code === 11000) {
    return res.status(409).json({
      error: "E-posta veya kartvizit adresi zaten kullanılıyor.",
    });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      error: "Girilen bilgiler geçersiz.",
    });
  }

  res.status(500).json({
    error: "Sunucu işlemi tamamlayamadı.",
  });
}

function validSlug(slug) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function cleanText(value, max = 120) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function validateCustomerInput(body) {
  const name = cleanText(body.name);
  const email = cleanText(body.email, 254).toLowerCase();
  const phone = cleanText(body.phone, 40);
  const slug = cleanText(body.slug, 120).toLowerCase();
  const plan = body.plan;
  const active = body.active !== false;

  if (
    !name ||
    !validEmail(email) ||
    !validSlug(slug) ||
    !["standard", "premium"].includes(plan)
  ) {
    return null;
  }

  return { name, email, phone, slug, plan, active };
}

function validImage(value) {
  return (
    typeof value === "string" &&
    (value === "" ||
      (/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(value) &&
        value.length <= 1800000))
  );
}

function normalizeCard(input, plan) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    !Array.isArray(input.links) ||
    input.links.length > 12
  ) {
    return null;
  }

  const types = new Set([
    "instagram",
    "linkedin",
    "whatsapp",
    "phone",
    "email",
    "website",
    "location",
    "iban",
    "sahibinden",
    "custom",
  ]);

  const links = [];

  for (const item of input.links) {
    if (!item || typeof item !== "object" || !types.has(item.type)) {
      return null;
    }

    links.push({
      type: item.type,
      title: cleanText(item.title, 100),
      value: cleanText(item.value, 2000),
    });
  }

  if (!validImage(input.profilePhoto) || !validImage(input.companyLogo)) {
    return null;
  }

  const background = /^#[0-9a-f]{6}$/i.test(input.background)
    ? input.background
    : "#171717";

  return {
    name: cleanText(input.name),
    job: cleanText(input.job),
    company: cleanText(input.company),
    bio: cleanText(input.bio, 500),
    background,
    accent: ACCENTS[plan],
    profilePhoto: input.profilePhoto,
    companyLogo: input.companyLogo,
    links,
  };
}

function getEditorId(req) {
  return req.params.id === "me" ? req.session.customerId : req.params.id;
}

async function findEditableCustomer(req, res) {
  const id = getEditorId(req);

  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({
      error: "Geçersiz müşteri numarası.",
    });
    return null;
  }

  if (req.session.role !== "admin" && id !== req.session.customerId) {
    res.status(403).json({
      error: "Başka müşterinin kartvizitini düzenleyemezsiniz.",
    });
    return null;
  }

  const customer = await Customer.findById(id);

  if (!customer) {
    res.status(404).json({
      error: "Müşteri bulunamadı.",
    });
    return null;
  }

  if (
    req.session.role !== "admin" &&
    (!customer.active || customer.plan !== "premium")
  ) {
    res.status(403).json({
      error: "Kartvizit düzenleme yetkiniz yok.",
    });
    return null;
  }

  return customer;
}

// OTURUM

app.post("/api/login", async (req, res) => {
  try {
    const email = cleanText(req.body.email, 254).toLowerCase();

    const password = String(req.body.password || "");

    if (!validEmail(email) || !password) {
      return res.status(401).json({
        error: "E-posta veya şifre hatalı.",
      });
    }

    let role = null;
    let customerId = null;

    const admin = await Admin.findOne({
      email,
    }).select("+passwordHash");

    if (admin && (await bcrypt.compare(password, admin.passwordHash))) {
      role = "admin";
    } else {
      const customer = await Customer.findOne({
        email,
        active: true,
        plan: "premium",
      }).select("+passwordHash");

      if (
        customer &&
        customer.passwordHash &&
        (await bcrypt.compare(password, customer.passwordHash))
      ) {
        role = "premium";
        customerId = String(customer._id);
      }
    }

    if (!role) {
      return res.status(401).json({
        error: "E-posta veya şifre hatalı.",
      });
    }

    req.session.regenerate((error) => {
      if (error) {
        return res.status(500).json({
          error: "Oturum açılamadı.",
        });
      }

      req.session.role = role;
      req.session.customerId = customerId;

      req.session.save((error) => {
        if (error) {
          return res.status(500).json({
            error: "Oturum kaydedilemedi.",
          });
        }

        res.json({ role });
      });
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/api/me", async (req, res) => {
  if (req.session.role === "admin") {
    return res.json({ role: "admin" });
  }

  if (req.session.role === "premium") {
    try {
      const customer = await Customer.findOne({
        _id: req.session.customerId,
        active: true,
        plan: "premium",
      });

      if (customer) {
        return res.json({
          role: "premium",
          customerId: String(customer._id),
        });
      }
    } catch (error) {
      return sendError(res, error);
    }
  }

  res.json({ role: null });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({
        error: "Çıkış yapılamadı.",
      });
    }

    res.clearCookie("nfc.sid");
    res.json({ ok: true });
  });
});

// ADMIN - MÜŞTERİLER

app.get("/api/customers", requireAdmin, async (req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 });

    res.json(customers.map(customerData));
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/customers", requireAdmin, async (req, res) => {
  try {
    const data = validateCustomerInput(req.body);

    if (!data) {
      return res.status(400).json({
        error: "Müşteri bilgileri geçersiz.",
      });
    }

    const password = String(req.body.password || "");

    if (data.plan === "premium" && password.length < 12) {
      return res.status(400).json({
        error: "Premium müşteri şifresi en az 12 karakter olmalı.",
      });
    }

    const customer = await Customer.create({
      ...data,
      passwordHash:
        data.plan === "premium" ? await bcrypt.hash(password, 12) : null,
      card: {
        background: "#171717",
        accent: ACCENTS[data.plan],
        links: [],
      },
    });

    res.status(201).json(customerData(customer));
  } catch (error) {
    sendError(res, error);
  }
});

app.put("/api/customers/:id", requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        error: "Geçersiz müşteri numarası.",
      });
    }

    const customer = await Customer.findById(req.params.id).select(
      "+passwordHash",
    );

    if (!customer) {
      return res.status(404).json({
        error: "Müşteri bulunamadı.",
      });
    }

    const data = validateCustomerInput(req.body);

    if (!data) {
      return res.status(400).json({
        error: "Müşteri bilgileri geçersiz.",
      });
    }

    const password = String(req.body.password || "");

    if (
      data.plan === "premium" &&
      !customer.passwordHash &&
      password.length < 12
    ) {
      return res.status(400).json({
        error: "Premium paket için en az 12 karakterlik şifre gerekiyor.",
      });
    }

    if (password && password.length < 12) {
      return res.status(400).json({
        error: "Şifre en az 12 karakter olmalı.",
      });
    }

    Object.assign(customer, data);

    if (data.plan === "standard") {
      customer.passwordHash = null;
    } else if (password) {
      customer.passwordHash = await bcrypt.hash(password, 12);
    }

    customer.card.accent = ACCENTS[data.plan];

    await customer.save();

    res.json(customerData(customer));
  } catch (error) {
    sendError(res, error);
  }
});

app.delete("/api/customers/:id", requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        error: "Geçersiz müşteri numarası.",
      });
    }

    const customer = await Customer.findByIdAndDelete(req.params.id);

    if (!customer) {
      return res.status(404).json({
        error: "Müşteri bulunamadı.",
      });
    }

    res.json({ ok: true });
  } catch (error) {
    sendError(res, error);
  }
});

// KARTVİZİT DÜZENLEME

app.get("/api/editor/:id", requireLogin, async (req, res) => {
  try {
    const customer = await findEditableCustomer(req, res);

    if (!customer) return;

    res.json(customerData(customer));
  } catch (error) {
    sendError(res, error);
  }
});

app.put("/api/editor/:id", requireLogin, async (req, res) => {
  try {
    const customer = await findEditableCustomer(req, res);

    if (!customer) return;

    const card = normalizeCard(req.body.card, customer.plan);

    if (!card) {
      return res.status(400).json({
        error: "Kartvizit bilgileri geçersiz.",
      });
    }

    customer.set("card", card);
    await customer.save();

    res.json({
      ok: true,
      card: customer.card,
    });
  } catch (error) {
    sendError(res, error);
  }
});

// HERKESE AÇIK KARTVİZİT

app.get("/api/card/:slug", async (req, res) => {
  try {
    const customer = await Customer.findOne({
      slug: req.params.slug,
      active: true,
    });

    if (!customer) {
      return res.status(404).json({
        error: "Kartvizit bulunamadı.",
      });
    }

    const card = customer.card;

    res.json({
      name: card.name || customer.name,
      phone: customer.phone,
      email: customer.email,
      job: card.job,
      company: card.company,
      bio: card.bio,
      background: card.background,
      accent: ACCENTS[customer.plan],
      profilePhoto: card.profilePhoto,
      companyLogo: card.companyLogo,
      links: card.links,
    });
  } catch (error) {
    sendError(res, error);
  }
});

// SAYFALAR

app.get("/giris", sendPage("giris.html"));

app.get("/admin", (req, res) => {
  if (req.session.role !== "admin") {
    return res.redirect("/giris");
  }

  res.sendFile(path.join(publicFolder, "admin.html"));
});

app.get("/panel", (req, res) => {
  if (!req.session.role) {
    return res.redirect("/giris");
  }

  res.sendFile(path.join(publicFolder, "panel.html"));
});

app.get("/kart/:slug", sendPage("index.html"));

// HTML DOSYALARINI DOĞRUDAN AÇARAK
// YETKİ KONTROLÜNÜ ATLAMAYI ÖNLE

app.get("/admin.html", (req, res) => {
  res.redirect("/admin");
});

app.get("/panel.html", (req, res) => {
  res.redirect("/panel");
});

app.get("/giris.html", (req, res) => {
  res.redirect("/giris");
});

app.use(express.static(publicFolder));

// BAŞLATMA

async function start() {
  await mongoose.connect(MONGODB_URI);

  const email = ADMIN_EMAIL.trim().toLowerCase();

  const existingAdmin = await Admin.findOne({
    email,
  });

  if (!existingAdmin) {
    await Admin.create({
      email,
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12),
    });

    console.log("İlk yönetici hesabı oluşturuldu.");
  }

  app.listen(PORT, () => {
    console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error("MongoDB bağlantısı kurulamadı:", error.message);

  process.exit(1);
});
