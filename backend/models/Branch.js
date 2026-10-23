const mongoose = require("mongoose");

const branchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    code: { type: String, unique: true, sparse: true, trim: true },
    /** Legacy display location; source of truth is branchLocation.address. */
    location: { type: String, trim: true },
    address: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    radius_meters: { type: Number, default: 1000 },
    /** New canonical branch location payload. */
    branchLocation: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      address: { type: String, required: true, trim: true },
    },
    /** System-wide fixed 1000m (kept configurable for compatibility). */
    clockInRadius: { type: Number, default: 1000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // Branch-level shift settings (used for clock-in rules + defaults)
    default_shift_start_time: { type: String, default: "08:00" }, // "HH:mm"
    clock_in_window_minutes: { type: Number, default: 60 }, // minutes after shift start
    auto_clockout_hours: { type: Number, default: null }, // null = system default; 0 = automatic clock-out off
    opening_hours: { type: String, default: "" },
    location_source: { type: String, enum: ["manual", "geocoded", "approximate"], default: "manual" },

    is_active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

branchSchema.pre("validate", function setGeoMirrors(next) {
  if (this.branchLocation && Number.isFinite(this.branchLocation.lat) && Number.isFinite(this.branchLocation.lng)) {
    this.latitude = this.branchLocation.lat;
    this.longitude = this.branchLocation.lng;
    this.address = this.branchLocation.address || this.address;
    this.location = this.branchLocation.address || this.location;
  } else if (Number.isFinite(this.latitude) && Number.isFinite(this.longitude)) {
    this.branchLocation = {
      lat: this.latitude,
      lng: this.longitude,
      address: this.address || this.location || "",
    };
  }
  if (!this.radius_meters) this.radius_meters = this.clockInRadius || 1000;
  this.clockInRadius = this.radius_meters; // one value everywhere: the admin-set radius
  next();
});

module.exports = mongoose.model("Branch", branchSchema);
