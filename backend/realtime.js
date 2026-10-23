let io = null;

exports.setSocketIO = (instance) => {
  io = instance;
};

/**
 * Broadcast after clock-in/out or manual attendance so dashboards refresh.
 * @param {{ branch_id?: import("mongoose").Types.ObjectId, date: string }} payload
 */
exports.emitAttendanceChanged = (payload) => {
  if (!io) return;
  try {
    if (payload.branch_id) io.to(`branch:${payload.branch_id.toString()}`).emit("attendance:changed", payload);
    io.to("admins").emit("attendance:changed", payload);
  } catch (e) {
    console.error("[emitAttendanceChanged]", e.message);
  }
};

exports.emitUserStatusChanged = (payload) => {
  if (!io) return;
  try {
    if (payload?.user_id) io.to(`user:${payload.user_id.toString()}`).emit("user:status", payload);
    io.to("admins").emit("user:status", payload);
  } catch (e) {
    console.error("[emitUserStatusChanged]", e.message);
  }
};

exports.emitLateAlert = (payload) => {
  if (!io) return;
  try {
    io.to("general_supervisors").emit("attendance:late", payload);
    io.to("admins").emit("attendance:late", payload);
    if (payload?.branch_id) io.to(`branch:${payload.branch_id.toString()}`).emit("attendance:late", payload);
  } catch (e) {
    console.error("[emitLateAlert]", e.message);
  }
};
