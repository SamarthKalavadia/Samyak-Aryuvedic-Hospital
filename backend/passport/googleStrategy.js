const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
      async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;

        // 1. Try to find in User collection (Patients)
        let user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
        
        // 2. If not found, check Doctor collection
        if (!user) {
          const Doctor = require("../models/Doctor");
          const doctor = await Doctor.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
          if (doctor) {
            // Found a doctor, return doctor object with role fixed
            doctor.role = "doctor"; // Ensure role is present
            return done(null, doctor);
          }
        }

        // 3. If still not found, create a new User (Patient)
        if (!user) {
          user = new User({
            firstName: profile.name?.givenName || profile.displayName?.split(" ")[0] || "User",
            lastName: profile.name?.familyName || profile.displayName?.split(" ")[1] || "",
            email: email,
            role: "patient",
            isGoogleUser: true,
            isVerified: true,
            status: "ACTIVE"
          });
          await user.save();
          return done(null, user);
        }

        // 4. If existing user found, update attributes
        let changed = false;
        if (!user.isGoogleUser) {
          user.isGoogleUser = true;
          changed = true;
        }
        if (!user.isVerified) {
          user.isVerified = true;
          changed = true;
        }
        if (user.status !== 'ACTIVE') {
          user.status = 'ACTIVE';
          changed = true;
        }
        if (changed) await user.save();

        return done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  try {
    const u = await User.findById(id);
    done(null, u);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
