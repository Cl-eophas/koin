const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    // Identity
    staffId: { type: String, unique: true, sparse: true, trim: true }, // e.g. "YP/0001"
    name: { type: String, required: true, trim: true, maxlength: 100 }, // kept for compatibility (full name)
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: false },
    googleId: { type: String, default: null, index: true },

    // HR / payroll (required for onboarding completion)
    phone: { type: String, trim: true },
    idNumber: { type: String, trim: true },
    kraPin: { type: String, trim: true },
    nssf: { type: String, trim: true },
    nhif: { type: String, trim: true },
    bank: {
      accountNumber: { type: String, trim: true },
      bankName: { type: String, trim: true },
      branch: { type: String, trim: true },
      isVerified: { type: Boolean, default: false },
      isActive: { type: Boolean, default: false },
    },

    // System / onboarding
    role: {
      type: String,
      default: null,
      validate: {
        validator(v) {
          return v === null || ["admin", "general_supervisor", "supervisor", "staff"].includes(v);
        },
        message: "Invalid role value.",
      },
    },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    approved_at: { type: Date, default: null },
    approved_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejected_at: { type: Date, default: null },
    rejection_reason: { type: String, trim: true, default: null },
    /** Profile/payroll verification after login (not gating login). */
    verification_status: {
      type: String,
      enum: ["not_submitted", "pending", "verified", "rejected"],
      default: "not_submitted",
    },
    verification_rejection_reason: { type: String, trim: true, default: null },
    isVerified: { type: Boolean, default: false },
    profileCompleted: { type: Boolean, default: false },
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
    /** Canonical branch reference for new modules; mirrored with branch_id for compatibility. */
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
    /** casual | reliever | contract | permanent | supervisor | general_supervisor */
    employment_type: {
      type: String,
      enum: ["casual", "reliever", "contract", "permanent", "supervisor", "general_supervisor"],
    },
    /** Last time a casual user self-selected / changed branch (weekly limit). */
    last_branch_change: { type: Date, default: null },
    is_active: { type: Boolean, default: false }, // false until approved
    deleted_at: { type: Date, default: null },
    failed_login_attempts: { type: Number, default: 0 },
    lockout_until: { type: Date, default: null },
    password_changed_at: { type: Date },
    force_password_reset: { type: Boolean, default: false },
    refresh_token_hash: { type: String, select: false },
    totp_secret: { type: String, select: false },
    totp_enabled: { type: Boolean, default: false },
    last_ip: { type: String },
    last_login: { type: Date },

    // Email ownership verification (signup flow)
    email_verified: { type: Boolean, default: false },
    email_verification_token_hash: { type: String, select: false, default: null },
    email_verification_expires: { type: Date, select: false, default: null },

    // Personal notification choices (see /api/preferences)
    notification_prefs: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Resignation with notice (see /api/staff/resign)
    resignation: { type: mongoose.Schema.Types.Mixed, default: null },

    // Email-based password reset (forgot-password flow)
    password_reset_token_hash: { type: String, select: false, default: null },
    password_reset_expires: { type: Date, select: false, default: null },

    // Onboarding document uploads (filenames under /uploads, same convention
    // as Leave.medical_document)
    documents: {
      national_id: { type: String, default: null },
      kra_pin_certificate: { type: String, default: null },
      profile_photo: { type: String, default: null },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.password;
        delete ret.refresh_token_hash;
        delete ret.totp_secret;
        delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.index({ branch_id: 1, role: 1 });
userSchema.index({ is_active: 1, role: 1 });
userSchema.index({ status: 1, role: 1, is_active: 1 });
userSchema.index({ deleted_at: 1 });

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  if (!this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  this.password_changed_at = new Date();
  next();
});

userSchema.pre("validate", function syncBranchRefs(next) {
  // Admins oversee the whole company and never belong to a branch. Enforced here so no route can set one.
  if (this.role === "admin") {
    this.branch_id = null;
    this.branch = null;
  }
  if (this.branch && !this.branch_id) this.branch_id = this.branch;
  if (this.branch_id && !this.branch) this.branch = this.branch_id;
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.isLocked = function () {
  return this.lockout_until && this.lockout_until > new Date();
};

userSchema.methods.recordFailedLogin = async function () {
  this.failed_login_attempts += 1;
  if (this.failed_login_attempts >= 5) {
    this.lockout_until = new Date(Date.now() + 15 * 60 * 1000);
  }
  return this.save({ validateModifiedOnly: true });
};

userSchema.methods.resetLoginAttempts = async function () {
  this.failed_login_attempts = 0;
  this.lockout_until = null;
  return this.save({ validateModifiedOnly: true });
};

module.exports = mongoose.model("User", userSchema);
