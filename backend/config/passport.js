const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");
const { nextYPStaffIdV2 } = require("../utils/staffIdV2");

const configurePassport = () => {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL = process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback";

  if (!clientID || !clientSecret) return;

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const primaryEmail = profile?.emails?.[0]?.value?.toLowerCase()?.trim();
          if (!primaryEmail) return done(new Error("Google account missing email"), null);

          let user = await User.findOne({ $or: [{ googleId: profile.id }, { email: primaryEmail }] });
          if (!user) {
            user = await User.create({
              staffId: await nextYPStaffIdV2(),
              name: profile.displayName || "Google User",
              email: primaryEmail,
              googleId: profile.id,
              email_verified: true, // Google verified this address
              role: null,
              status: "pending",
              is_active: false,
              isVerified: false,
              profileCompleted: false,
            });
          } else if (!user.googleId) {
            user.googleId = profile.id;
            user.email_verified = true;
            await user.save({ validateModifiedOnly: true });
          }

          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
};

module.exports = { configurePassport, passport };
