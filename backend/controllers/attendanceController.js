const { employmentBlockReason } = require("../utils/employment");

const Attendance = require("../models/Attendance");
const User = require("../models/User");
const StaffProfile = require("../models/StaffProfile");
const { haversineDistance, branchRadius } = require("../utils/geo");
const { requiresFixedBranch } = require("../utils/branchEmployment");
const { getTodayString } = require("../utils/dateHelpers");
const { emitAttendanceChanged } = require("../realtime");
const { shiftStartDateTime } = require("../utils/shiftTime");
const scheduleService = require("../services/scheduleService");
const Notification = require("../models/Notification");
const SecurityEvent = require("../models/SecurityEvent");
const ForceClockRequest = require("../models/ForceClockRequest");
const { logAttendanceEvent } = require("../utils/attendanceClock");
const { syncHoursWorkedOnDocument } = require("../utils/attendanceHours");
const { clientIp, checkVpnProxy } = require("../utils/networkRisk");
const { resolveBranchForUser } = require("../utils/branchResolve");

async function persistClockIn({ staffId, branchOid, today, now, locIn, shiftStart, status, lateMinutes, source }) {
  const payload = {
    clock_in: now,
    branch_id: branchOid,
    location_in: locIn,
    shift_start: shiftStart,
    status,
    late_minutes: lateMinutes,
    is_supervisor_entry: false,
    source: source || "self",
  };
  const existing = await Attendance.findOne({ staff_id: staffId, date: today });
  if (existing?.clock_in) {
    const err = new Error("Already clocked in today.");
    err.statusCode = 400;
    throw err;
  }
  try {
    if (existing?._id) {
      const doc = await Attendance.findByIdAndUpdate(existing._id, payload, { new: true });
      logAttendanceEvent("clock_in_update", { staff_id: String(staffId), date: today, branch_id: String(branchOid) });
      return doc;
    }
    const doc = await Attendance.create({
      staff_id: staffId,
      branch_id: branchOid,
      date: today,
      ...payload,
    });
    logAttendanceEvent("clock_in_create", { staff_id: String(staffId), date: today, branch_id: String(branchOid) });
    return doc;
  } catch (err) {
    if (err.code === 11000) {
      const again = await Attendance.findOne({ staff_id: staffId, date: today });
      if (again?.clock_in) {
        const dup = new Error("Already clocked in today.");
        dup.statusCode = 400;
        throw dup;
      }
      if (again) {
        const doc = await Attendance.findByIdAndUpdate(again._id, payload, { new: true });
        logAttendanceEvent("clock_in_retry", { staff_id: String(staffId), date: today });
        return doc;
      }
    }
    throw err;
  }
}

async function evaluateGeoAndRisk({ req, user, latNum, lonNum, accNum }) {
  const branch = await resolveBranchForUser(user);
  if (!branch) {
    const err = new Error("No branch assigned.");
    err.statusCode = 400;
    err.code = "ERR_NO_BRANCH";
    throw err;
  }
  const branchLat = Number(branch?.branchLocation?.lat ?? branch?.latitude);
  const branchLng = Number(branch?.branchLocation?.lng ?? branch?.longitude);
  if (!Number.isFinite(branchLat) || !Number.isFinite(branchLng)) {
    const err = new Error("Branch location is not configured.");
    err.statusCode = 400;
    err.code = "ERR_BRANCH_GEO";
    throw err;
  }
  const baseRadius = branchRadius(branch);
  const effectiveRadius = baseRadius + accNum;
  const distance = Math.round(haversineDistance(latNum, lonNum, branchLat, branchLng));
  const withinFence = distance <= effectiveRadius;
  const ipAddress = clientIp(req);
  const vpn = await checkVpnProxy(ipAddress);
  return { branch, distance, effectiveRadius, withinFence, ipAddress, vpn };
}

exports.clockInPrecheck = async (req, res) => {
  try {
    const termsBlock = await employmentBlockReason(req.user._id);
    if (termsBlock) return res.status(403).json({ success: false, message: termsBlock });
    const { latitude, longitude, accuracy } = req.body;
    const latNum = parseFloat(latitude);
    const lonNum = parseFloat(longitude);
    const accNum = parseFloat(accuracy);
    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum) || !Number.isFinite(accNum)) {
      return res.status(400).json({ success: false, message: "Invalid location payload.", code: "ERR_INVALID_COORDS" });
    }
    if (accNum > 500) {
      return res.status(400).json({
        success: false,
        message: `Location accuracy too low (±${Math.round(accNum)}m). Move to open sky and try again.`,
        code: "ERR_LOW_GPS_ACCURACY",
      });
    }
    const user = await User.findById(req.user._id).populate("branch_id").populate("branch");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    if (user.status !== "approved" || !user.is_active) {
      return res.status(403).json({ success: false, message: "Only approved, active accounts can clock in." });
    }
    if (!user.branch_id && !user.branch) {
      return res.status(400).json({ success: false, message: "No branch assigned.", code: "ERR_NO_BRANCH" });
    }
    let geo;
    try {
      geo = await evaluateGeoAndRisk({ req, user, latNum, lonNum, accNum });
    } catch (e) {
      if (e.statusCode) {
        return res.status(e.statusCode).json({ success: false, message: e.message, code: e.code || "ERR_GEO" });
      }
      throw e;
    }
    if (geo.vpn.blocked) {
      return res.status(403).json({
        success: false,
        message: "VPN or proxy detected. Clock-in requires your real network location.",
        code: "ERR_VPN_PROXY",
      });
    }
    return res.json({
      success: true,
      data: {
        distance: geo.distance,
        effectiveRadius: Math.round(geo.effectiveRadius),
        withinRange: geo.withinFence,
        vpnOk: !geo.vpn.blocked,
      },
    });
  } catch (err) {
    console.error("[clockInPrecheck]", err);
    return res.status(500).json({ success: false, message: "Server error.", code: "ERR_SERVER" });
  }
};

exports.clockIn = async (req, res) => {
  try {
    const termsBlock = await employmentBlockReason(req.user._id);
    if (termsBlock) return res.status(403).json({ success: false, message: termsBlock });
    const staffId = req.user._id;
    const { latitude, longitude, accuracy, locationName, deviceMeta } = req.body;

    if (latitude === undefined || longitude === undefined || accuracy === undefined) {
      return res.status(400).json({ success: false, message: "GPS coordinates required." });
    }
    const latNum = parseFloat(latitude);
    const lonNum = parseFloat(longitude);
    const accNum = parseFloat(accuracy);
    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum) || !Number.isFinite(accNum)) {
      return res.status(400).json({ success: false, message: "Invalid location payload.", code: "ERR_INVALID_COORDS" });
    }
    if (accNum > 500) {
      return res.status(400).json({
        success: false,
        message: `Location accuracy too low (±${Math.round(accNum)}m). Move to open sky and try again.`,
        code: "ERR_LOW_GPS_ACCURACY",
      });
    }

    const user = await User.findById(staffId).populate("branch_id").populate("branch");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    if (user.status !== "approved" || !user.is_active) {
      return res.status(403).json({ success: false, message: "Only approved, active accounts can clock in." });
    }

    if (!["staff", "supervisor"].includes(user.role)) {
      return res.status(403).json({ success: false, message: "Clock-in is only available for staff roles." });
    }

    if (["staff", "supervisor"].includes(user.role) && !user.employment_type) {
      const sp = await StaffProfile.findOne({ user_id: staffId });
      if (sp) {
        user.employment_type = user.role === "supervisor" ? "supervisor" : sp.type;
        await user.save({ validateModifiedOnly: true });
      }
    }
    if (["staff", "supervisor"].includes(user.role) && !user.employment_type) {
      return res.status(403).json({
        success: false,
        message: "Account is missing employment_type. Ask an administrator to complete your assignment.",
      });
    }

    if (requiresFixedBranch(user.employment_type) && !user.branch_id && !user.branch) {
      return res.status(400).json({ success: false, message: "Not assigned to a branch." });
    }
    if (user.employment_type === "casual" && !user.branch_id && !user.branch) {
      return res.status(400).json({
        success: false,
        code: "BRANCH_REQUIRED",
        message:
          "Select your work branch before clock-in. Use GET /api/staff/branches/available then PUT /api/staff/my-branch.",
      });
    }

    const branch = await resolveBranchForUser(user);
    if (!branch) {
      return res.status(400).json({ success: false, message: "No branch assigned.", code: "ERR_NO_BRANCH" });
    }
    const branchLat = Number(branch?.branchLocation?.lat ?? branch?.latitude);
    const branchLng = Number(branch?.branchLocation?.lng ?? branch?.longitude);
    if (!Number.isFinite(branchLat) || !Number.isFinite(branchLng)) {
      return res.status(400).json({ success: false, message: "Branch location is not configured.", code: "ERR_BRANCH_GEO" });
    }
    const baseRadius = branchRadius(branch);
    const effectiveRadius = baseRadius + accNum;
    const distance = Math.round(haversineDistance(latNum, lonNum, branchLat, branchLng));
    const withinFence = distance <= effectiveRadius;

    const ipAddress = clientIp(req);
    const vpn = await checkVpnProxy(ipAddress);
    if (vpn.blocked) {
      return res.status(403).json({
        success: false,
        message: "VPN or proxy detected. Clock-in must be from your real location.",
        code: "ERR_VPN_PROXY",
      });
    }

    const last = await Attendance.findOne({
      staff_id: staffId,
      "coords.lat": { $exists: true },
      "coords.lng": { $exists: true },
      clock_in: { $ne: null },
    })
      .sort({ clock_in: -1 })
      .select("clock_in coords")
      .lean();
    if (last?.coords?.lat != null && last?.coords?.lng != null && last?.clock_in) {
      const dtHours = Math.max(1 / 3600, (Date.now() - new Date(last.clock_in).getTime()) / 3600000);
      const distM = haversineDistance(latNum, lonNum, Number(last.coords.lat), Number(last.coords.lng));
      const speed = distM / 1000 / dtHours;
      if (speed > 500) {
        return res.status(400).json({
          success: false,
          message: "Location jump detected. Please try again or contact your supervisor.",
          code: "ERR_LOCATION_JUMP",
        });
      }
    }

    if (!withinFence) {
      return res.status(400).json({
        success: false,
        message: `You are ${distance}m away. Must be within ${Math.round(effectiveRadius)}m of ${branch.name}.`,
        code: "ERR_OUT_OF_RANGE",
        distance,
        effectiveRadius: Math.round(effectiveRadius),
      });
    }

    const today = getTodayString();
    const existing = await Attendance.findOne({ staff_id: staffId, date: today });
    if (existing?.clock_in) {
      return res.status(400).json({ success: false, message: "Already clocked in today." });
    }

    const now = new Date();
    const scheduled = await scheduleService.getClockWindowForToday(staffId, today);

    let shiftStart;
    let status;
    let lateMinutes = 0;

    if (scheduled) {
      shiftStart = shiftStartDateTime(scheduled.shift_date, scheduled.start_time);
      if (!shiftStart) {
        shiftStart = new Date(now);
        status = "present";
      } else {
        lateMinutes = Math.max(0, Math.floor((now.getTime() - shiftStart.getTime()) / 60000));
        status = lateMinutes > 0 ? "late" : "present";
      }
    } else {
      shiftStart = new Date(now);
      const dst = String(branch.default_shift_start_time || "08:00");
      const m = dst.match(/^(\d{1,2}):(\d{2})$/);
      const hh = m ? Math.min(23, Math.max(0, parseInt(m[1], 10))) : 8;
      const mm = m ? Math.min(59, Math.max(0, parseInt(m[2], 10))) : 0;
      shiftStart.setHours(hh, mm, 0, 0);
      status = "unscheduled";
    }

    const locIn = { latitude: latNum, longitude: lonNum };
    const branchOid = branch._id || branch;

    let attendance;
    try {
      attendance = await persistClockIn({
        staffId,
        branchOid,
        today,
        now,
        locIn,
        shiftStart,
        status,
        lateMinutes,
        source: "self",
      });
    } catch (e) {
      if (e.statusCode === 400) {
        return res.status(400).json({ success: false, message: e.message });
      }
      throw e;
    }

    if (status === "late") {
      const escalatedUsers = await User.find({
        role: { $in: ["general_supervisor", "admin"] },
        is_active: true,
      }).select("_id");

      if (escalatedUsers.length) {
        await Notification.insertMany(
          escalatedUsers.map((u) => ({
            user_id: u._id,
            type: "attendance",
            message: `Late alert: ${user.name} (${user.phone || "no phone"}) is ${lateMinutes} minute(s) late — ${branch.name}.`,
          }))
        );
      }

      const { emitLateAlert } = require("../realtime");
      emitLateAlert({
        date: today,
        branch_id: branch._id,
        branch_name: branch.name,
        staff_id: user._id,
        staff_name: user.name,
        phone: user.phone || null,
        minutes_late: lateMinutes,
      });

      await SecurityEvent.create({
        type: "anomalous_action",
        user_id: user._id,
        metadata: {
          category: "late_escalation",
          name: user.name,
          phone: user.phone || null,
          minutes_late: lateMinutes,
          date: today,
        },
      });
    }

    attendance.coords = { lat: latNum, lng: lonNum, accuracy: accNum };
    attendance.locationName = String(locationName || "").slice(0, 500) || undefined;
    attendance.distance = distance;
    attendance.ipAddress = ipAddress;
    attendance.deviceMeta = deviceMeta || {};
    attendance.vpnFlagged = Boolean(vpn.flagged || accNum < 3);
    if (!attendance.branch_id) attendance.branch_id = branchOid;
    attendance.matchStatus = scheduled ? "matched" : "unscheduled";
    await attendance.save();

    emitAttendanceChanged({ branch_id: user.branch_id?._id || user.branch_id || user.branch, date: today });

    res.json({
      success: true,
      message: "Clocked in successfully.",
      data: attendance,
      geo: { distance, effectiveRadius: Math.round(effectiveRadius) },
    });
  } catch (err) {
    console.error("[clockIn]", err);
    if (err.statusCode && err.statusCode < 500) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        ...(err.code && { code: err.code }),
      });
    }
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.clockOut = async (req, res) => {
  try {
    const staffId = req.user._id;
    const { latitude, longitude, accuracy } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, message: "GPS coordinates required." });
    }
    const latNum = parseFloat(latitude);
    const lonNum = parseFloat(longitude);
    const accRaw = accuracy !== undefined && accuracy !== null ? parseFloat(accuracy) : NaN;
    const accNum = Number.isFinite(accRaw) ? accRaw : 50;
    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
      return res.status(400).json({ success: false, message: "Invalid location payload.", code: "ERR_INVALID_COORDS" });
    }
    if (accNum > 500) {
      return res.status(400).json({
        success: false,
        message: `Location accuracy too low (±${Math.round(accNum)}m). Move to open sky and try again.`,
        code: "ERR_LOW_GPS_ACCURACY",
      });
    }

    const user = await User.findById(staffId).populate("branch_id").populate("branch");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    if (user.status !== "approved" || !user.is_active) {
      return res.status(403).json({ success: false, message: "Only approved, active accounts can clock out." });
    }

    const branch = await resolveBranchForUser(user);
    if (!branch) {
      return res.status(400).json({ success: false, message: "Not assigned to a branch.", code: "ERR_NO_BRANCH" });
    }
    const branchLat = Number(branch.branchLocation?.lat ?? branch.latitude);
    const branchLng = Number(branch.branchLocation?.lng ?? branch.longitude);
    if (!Number.isFinite(branchLat) || !Number.isFinite(branchLng)) {
      return res.status(400).json({ success: false, message: "Branch location is not configured.", code: "ERR_BRANCH_GEO" });
    }
    const baseRadius = branchRadius(branch);
    const effectiveRadius = baseRadius + accNum;
    const distance = Math.round(haversineDistance(latNum, lonNum, branchLat, branchLng));

    if (distance > effectiveRadius) {
      return res.status(400).json({
        success: false,
        message: `You are ${distance}m away. Must be within ${Math.round(effectiveRadius)}m to clock out.`,
        distance,
        effectiveRadius: Math.round(effectiveRadius),
        code: "ERR_OUT_OF_RANGE",
      });
    }

    const branchOid = branch._id;

    const today = getTodayString();
    const attendance = await Attendance.findOne({ staff_id: staffId, date: today });
    if (!attendance?.clock_in) {
      return res.status(400).json({ success: false, message: "No clock-in found for today." });
    }
    if (attendance.clock_out) {
      return res.status(400).json({ success: false, message: "Already clocked out today." });
    }

    const now = new Date();
    attendance.clock_out = now;
    attendance.location_out = { latitude: parseFloat(latitude), longitude: parseFloat(longitude) };
    if (!attendance.branch_id) attendance.branch_id = branchOid;
    syncHoursWorkedOnDocument(attendance);
    await attendance.save();
    logAttendanceEvent("clock_out", { staff_id: String(staffId), date: today, branch_id: String(branchOid) });

    emitAttendanceChanged({ branch_id: branchOid, date: today });

    res.json({ success: true, message: "Clocked out successfully.", data: attendance });
  } catch (err) {
    console.error("[clockOut]", err);
    if (err.statusCode && err.statusCode < 500) {
      return res.status(err.statusCode).json({ success: false, message: err.message, ...(err.code && { code: err.code }) });
    }
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const staffId = req.user._id;
    const { month, year } = req.query;
    const now = new Date();
    const m =
      month !== undefined && month !== "" && !Number.isNaN(parseInt(month, 10))
        ? parseInt(month, 10) - 1
        : now.getMonth();
    const y =
      year !== undefined && year !== "" && !Number.isNaN(parseInt(year, 10))
        ? parseInt(year, 10)
        : now.getFullYear();

    const startDate = new Date(y, m, 1).toISOString().slice(0, 10);
    const endDate = new Date(y, m + 1, 0).toISOString().slice(0, 10);

    const records = await Attendance.find({
      staff_id: staffId,
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 });

    const summary = {
      total_days: records.length,
      present: records.filter((r) => r.status === "present").length,
      late: records.filter((r) => r.status === "late").length,
      forced: records.filter((r) => r.status === "forced" || r.is_forced).length,
      on_leave: records.filter((r) => r.status === "leave").length,
    };

    res.json({ success: true, data: records, summary });
  } catch (err) {
    console.error("[getHistory]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.requestForcedClockIn = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("name branch_id");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    const today = getTodayString();
    const { reason } = req.body;
    const reasonText = String(reason || "").trim();
    if (!reasonText) {
      return res.status(400).json({ success: false, message: "Reason is required." });
    }

    const att = await Attendance.findOne({ staff_id: user._id, date: today });
    if (att?.clock_in) {
      return res.status(400).json({ success: false, message: "You are already clocked in for today." });
    }

    const existingPending = await ForceClockRequest.findOne({
      user_id: user._id,
      date: today,
      status: "pending",
    });
    if (existingPending) {
      return res.status(400).json({ success: false, message: "A forced clock-in request is already pending." });
    }

    const request = await ForceClockRequest.create({
      user_id: user._id,
      branch_id: user.branch_id || null,
      date: today,
      reason: reasonText,
      status: "pending",
    });

    const recipients = await User.find({
      role: "admin",
      is_active: true,
    }).select("_id");

    if (recipients.length) {
      await Notification.insertMany(
        recipients.map((r) => ({
          user_id: r._id,
          type: "attendance",
          message: `Forced clock-in request from ${user.name} for ${today}.`,
        }))
      );
    }

    return res.status(201).json({
      success: true,
      message: "Forced clock-in request submitted and pending admin approval.",
      data: request,
    });
  } catch (err) {
    console.error("[requestForcedClockIn]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.reverseGeocode = async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ success: false, message: "Invalid coordinates.", code: "ERR_INVALID_COORDS" });
    }
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(
      lon
    )}&format=json&addressdetails=1`;
    const r = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "koin-WMS/1.0 (attendance reverse geocode; +https://openstreetmap.org/copyright)",
        "Accept-Language": "en",
      },
    });
    if (!r.ok) {
      return res.status(502).json({ success: false, message: "Geocoding service unavailable.", code: "ERR_GEOCODE_DOWN" });
    }
    const j = await r.json();
    const parts = String(j?.display_name || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const noCountry = /kenya/i.test(parts[parts.length - 1]) ? parts.slice(0, -1) : parts;
    return res.json({ success: true, data: { locationName: noCountry.slice(0, 5).join(", ") } });
  } catch (err) {
    console.error("[reverseGeocode]", err);
    return res.status(500).json({ success: false, message: "Server error.", code: "ERR_SERVER" });
  }
};
