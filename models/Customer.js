"use strict";

const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      default: "",
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    active: {
      type: Boolean,
      default: true,
    },
    plan: {
      type: String,
      enum: ["standard", "premium"],
      default: "standard",
    },
    passwordHash: {
      type: String,
      default: null,
      select: false,
    },
    card: {
      name: { type: String, default: "" },
      job: { type: String, default: "" },
      company: { type: String, default: "" },
      bio: { type: String, default: "" },
      background: { type: String, default: "#171717" },
      accent: { type: String, default: "#ffffff" },
      profilePhoto: { type: String, default: "" },
      companyLogo: { type: String, default: "" },
      links: {
        type: [
          {
            type: {
              type: String,
              required: true,
            },
            title: String,
            value: String,
          },
        ],
        default: [],
      },
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Customer", customerSchema);
