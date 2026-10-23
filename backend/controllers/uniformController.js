const Uniform = require("../models/Uniform");

exports.getMyUniforms = async (req, res) => {
  try {
    const items = await Uniform.find({ staff_id: req.user._id }).sort({ issued_date: -1 });
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};
