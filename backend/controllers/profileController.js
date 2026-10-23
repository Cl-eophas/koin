const User = require("../models/User");
const StaffProfile = require("../models/StaffProfile");
const Notification = require("../models/Notification");
const {
  isPayrollUnlocked,
  verificationPayload,
  resolveVerificationStatus,
} = require("../utils/profileVerification");
const { notifyAdmins } = require("../utils/notifyAdmins");

const KRA_PIN_REGEX = /^[A-Z][0-9]{9}[A-Z]$/;
const PHONE_REGEX = /^(\+254|0)[0-9]{9}$/;

function profileIsComplete(user) {
  return Boolean(
    user.name &&
      user.email &&
      /^[0-9]{7,8}$/.test(String(user.idNumber || "")) &&
      KRA_PIN_REGEX.test(String(user.kraPin || "").toUpperCase()) &&
      PHONE_REGEX.test(String(user.phone || "")) &&
      user.nssf &&
      user.nhif &&
      user.bank?.bankName &&
      user.bank?.branch &&
      String(user.bank?.accountNumber || "").trim().length >= 6
  );
}

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("branch_id", "name address").select("-password");
    const sp = await StaffProfile.findOne({ user_id: req.user._id });
    const o = user.toObject();
    res.json({
      success: true,
      data: {
        ...o,
        staff_id: sp?.staff_id,
        type: sp?.type,
        join_date: sp?.join_date,
        phone: sp?.phone || o.phone,
        address: sp?.address,
        ...verificationPayload(user),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    const completedGate = Boolean(user.profileCompleted && profileIsComplete(user));

    if (!completedGate) {
      const {
        fullName,
        idNumber,
        kraPin,
        nssf,
        nhif,
        accountNumber,
        bankName,
        bankBranch,
        email,
        phone,
      } = req.body;

      const idOk = /^[0-9]{7,8}$/.test(String(idNumber || ""));
      const kraOk = KRA_PIN_REGEX.test(String(kraPin || "").toUpperCase());
      const phoneOk = PHONE_REGEX.test(String(phone || ""));
      const acctOk = String(accountNumber || "").trim().length >= 6;
      const requiredOk = [fullName, nssf, nhif, bankName, bankBranch, email].every(
        (v) => typeof v === "string" && v.trim().length > 0
      );

      if (!idOk || !kraOk || !phoneOk || !acctOk || !requiredOk) {
        return res.status(400).json({
          success: false,
          message: "Invalid profile data. Ensure all required fields are complete and valid.",
        });
      }

      const prevBank = user.bank || {};
      const bankChanged =
        String(prevBank.accountNumber || "").trim() !== String(accountNumber).trim() ||
        String(prevBank.bankName || "").trim() !== String(bankName).trim() ||
        String(prevBank.branch || "").trim() !== String(bankBranch).trim();

      const wasUnlocked = isPayrollUnlocked(user);
      const priorEffective = resolveVerificationStatus(user).status;

      user.name = fullName.trim();
      user.email = email.trim().toLowerCase();
      user.idNumber = String(idNumber).trim();
      user.kraPin = String(kraPin).trim().toUpperCase();
      user.nssf = String(nssf).trim();
      user.nhif = String(nhif).trim();
      user.phone = String(phone).trim();
      user.bank = {
        ...prevBank,
        accountNumber: String(accountNumber).trim(),
        bankName: String(bankName).trim(),
        branch: String(bankBranch).trim(),
      };
      if (bankChanged) {
        user.bank.isVerified = false;
        user.bank.isActive = false;
      }

      user.profileCompleted = true;

      if (wasUnlocked && !bankChanged) {
        // Admin-verified profile: non-bank edits do not reset payroll verification.
      } else {
        user.verification_status = "pending";
        user.isVerified = false;
        user.verification_rejection_reason = null;
        if (priorEffective !== "pending") {
          await Notification.create({
            user_id: user._id,
            type: "info",
            message: "Profile submitted for admin verification.",
          });
        }
      }

      await StaffProfile.findOneAndUpdate(
        { user_id: user._id },
        { $set: { phone: String(phone).trim() } },
        { upsert: true }
      );

      await user.save();

      return res.json({
        success: true,
        message: "Profile updated successfully.",
        data: { profileCompleted: user.profileCompleted, ...verificationPayload(user) },
      });
    }

    const {
      fullName,
      idNumber,
      kraPin,
      nssf,
      nhif,
      accountNumber,
      bankName,
      bankBranch,
      email,
      phone,
    } = req.body;

    if (
      fullName === undefined &&
      idNumber === undefined &&
      kraPin === undefined &&
      nssf === undefined &&
      nhif === undefined &&
      accountNumber === undefined &&
      bankName === undefined &&
      bankBranch === undefined &&
      email === undefined &&
      phone === undefined
    ) {
      return res.status(400).json({ success: false, message: "No fields to update." });
    }

    if (fullName !== undefined) user.name = String(fullName).trim();
    if (idNumber !== undefined) {
      if (!/^[0-9]{7,8}$/.test(String(idNumber).trim())) {
        return res.status(400).json({ success: false, message: "Invalid ID number." });
      }
      user.idNumber = String(idNumber).trim();
    }
    if (kraPin !== undefined) {
      const k = String(kraPin).trim().toUpperCase();
      if (!KRA_PIN_REGEX.test(k)) return res.status(400).json({ success: false, message: "Invalid KRA PIN." });
      user.kraPin = k;
    }
    if (nssf !== undefined) user.nssf = String(nssf).trim();
    if (nhif !== undefined) user.nhif = String(nhif).trim();
    if (email !== undefined) {
      const nextEmail = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
        return res.status(400).json({ success: false, message: "Invalid email address." });
      }
      if (nextEmail !== user.email) {
        const taken = await User.findOne({ email: nextEmail, _id: { $ne: user._id }, deleted_at: null }).select("_id").lean();
        if (taken) return res.status(400).json({ success: false, message: "That email is already in use." });
      }
      user.email = nextEmail;
    }
    if (phone !== undefined) {
      if (!PHONE_REGEX.test(String(phone).trim())) {
        return res.status(400).json({ success: false, message: "Invalid phone number format." });
      }
      user.phone = String(phone).trim();
    }

    const prevBank = user.bank || {};
    if (accountNumber !== undefined || bankName !== undefined || bankBranch !== undefined) {
      const nextAcct = accountNumber !== undefined ? String(accountNumber).trim() : String(prevBank.accountNumber || "");
      const nextBn = bankName !== undefined ? String(bankName).trim() : String(prevBank.bankName || "");
      const nextBr = bankBranch !== undefined ? String(bankBranch).trim() : String(prevBank.branch || "");
      if (nextAcct.length < 6 || nextBn.length < 2 || nextBr.length < 2) {
        return res.status(400).json({
          success: false,
          message: "Bank name, branch, and account number (min 6 chars) are required when updating bank details.",
        });
      }
      user.bank = {
        ...prevBank,
        accountNumber: nextAcct,
        bankName: nextBn,
        branch: nextBr,
        isVerified: false,
        isActive: false,
      };
    }

    user.verification_status = "pending";
    user.isVerified = false;
    user.verification_rejection_reason = null;
    await user.save();

    if (phone !== undefined) {
      await StaffProfile.findOneAndUpdate(
        { user_id: user._id },
        { $set: { phone: String(phone).trim() } },
        { upsert: true }
      );
    }

    await notifyAdmins({
      type: "approval",
      message: `${user.name} updated HR profile; verification set to pending for admin review.`,
    });
    await Notification.create({
      user_id: user._id,
      type: "info",
      message: "Your profile was updated and is pending admin verification.",
    });

    return res.json({
      success: true,
      message: "Profile updated successfully.",
      data: { profileCompleted: user.profileCompleted, ...verificationPayload(user) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.updateContact = async (req, res) => {
  try {
    const { phone, address, email } = req.body;
    const phoneOk = PHONE_REGEX.test(String(phone || ""));
    if (!phoneOk) {
      return res.status(400).json({ success: false, message: "Invalid phone number format." });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    const nextPhone = String(phone).trim();
    const phoneChanged = nextPhone !== String(user.phone || "").trim();

    if (email !== undefined) {
      const nextEmail = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
        return res.status(400).json({ success: false, message: "Invalid email address." });
      }
      if (nextEmail !== user.email) {
        const taken = await User.findOne({ email: nextEmail, _id: { $ne: user._id }, deleted_at: null }).select("_id").lean();
        if (taken) {
          return res.status(400).json({ success: false, message: "That email is already in use." });
        }
        user.email = nextEmail;
      }
    }

    user.phone = nextPhone;
    const emailChanged = email !== undefined;

    if (user.profileCompleted && profileIsComplete(user) && (phoneChanged || emailChanged)) {
      user.verification_status = "pending";
      user.isVerified = false;
      user.verification_rejection_reason = null;
      await notifyAdmins({
        type: "approval",
        message: `${user.name} updated phone or email; verification set to pending.`,
      });
    }

    await user.save();

    const profile = await StaffProfile.findOneAndUpdate(
      { user_id: req.user._id },
      { $set: { phone: nextPhone, address: String(address || "").trim() } },
      { new: true, upsert: true }
    );

    const fresh = await User.findById(req.user._id);
    return res.json({
      success: true,
      message: "Contact profile updated successfully.",
      data: { phone: profile.phone, address: profile.address, ...verificationPayload(fresh) },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};
