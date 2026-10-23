/**
 * Structured log line for attendance writes (clock-in/out). Does not block on failure.
 */
function logAttendanceEvent(event, payload) {
  try {
    console.log(
      `[attendance:${event}]`,
      JSON.stringify({
        t: new Date().toISOString(),
        ...payload,
      })
    );
  } catch (_) {
    /* ignore */
  }
}

module.exports = { logAttendanceEvent };
