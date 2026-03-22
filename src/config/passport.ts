import passport from "passport";
import { Strategy as GoogleStrategy }   from "passport-google-oauth20";
import { Strategy as GitHubStrategy }   from "passport-github2";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { Strategy as TwitterStrategy }  from "passport-twitter";
import { oauthLogin }                   from "../services/auth.service";
import { ApiError }                     from "../utils/apiError";

// ─── HOW THIS FILE WORKS ──────────────────────────────────────────────────────
//
// Each strategy below handles ONE OAuth provider.
// The flow is always the same:
//   1. The user clicks "Login with X" on the frontend
//   2. We redirect them to the provider's consent screen
//   3. The provider redirects back to our callback URL with a code
//   4. Passport exchanges the code for an access token, then fetches the profile
//   5. Our strategy callback runs — it finds or creates the user in our DB
//   6. We call done(null, user) on success or done(null, false, { message }) on failure
//   7. The route handler reads req.user and issues our own JWT
//
// We use { session: false } on all strategies because we issue JWTs, not sessions.
//
// ─────────────────────────────────────────────────────────────────────────────

// ─── GOOGLE ───────────────────────────────────────────────────────────────────
passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL:  `${process.env.API_URL}/api/auth/google/callback`,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(null, false, { message: "Google did not share your email address. Please check your Google privacy settings." });
        }

        const user = await oauthLogin({
          provider:   "google",
          providerId: profile.id,
          email,
          firstName:  profile.name?.givenName  || profile.displayName || "User",
          lastName:   profile.name?.familyName || "",
          avatar:     profile.photos?.[0]?.value,
        });

        done(null, user);
      } catch (err) {
        // ApiError = known business error (e.g. "you registered with GitHub")
        // Pass it as a failure message so the callback route can redirect with it
        if (err instanceof ApiError) return done(null, false, { message: err.message });
        done(err as Error);
      }
    }
  )
);

// ─── GITHUB ───────────────────────────────────────────────────────────────────
passport.use(
  new GitHubStrategy(
    {
      clientID:     process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      callbackURL:  `${process.env.API_URL}/api/auth/github/callback`,
      scope:        ["user:email"],
    },
    async (_accessToken: string, _refreshToken: string, profile: any, done: (err: any, user?: any, info?: any) => void) => {
      try {
        // GitHub can return multiple emails — prefer the primary verified one
        const emailObj = profile.emails?.find((e: any) => e.primary && e.verified)
                      ?? profile.emails?.[0];
        const email = emailObj?.value;

        if (!email) {
          return done(null, false, { message: "GitHub did not share your email address. Please make your email public in your GitHub settings." });
        }

        const nameParts  = (profile.displayName || profile.username || "").split(" ");
        const firstName  = nameParts[0] || profile.username || "User";
        const lastName   = nameParts.slice(1).join(" ") || "";

        const user = await oauthLogin({
          provider:   "github",
          providerId: profile.id,
          email,
          firstName,
          lastName,
          avatar: profile.photos?.[0]?.value,
        });

        done(null, user);
      } catch (err) {
        if (err instanceof ApiError) return done(null, false, { message: err.message });
        done(err as Error);
      }
    }
  )
);

// ─── FACEBOOK ─────────────────────────────────────────────────────────────────
passport.use(
  new FacebookStrategy(
    {
      clientID:     process.env.FACEBOOK_APP_ID!,
      clientSecret: process.env.FACEBOOK_APP_SECRET!,
      callbackURL:  `${process.env.API_URL}/api/auth/facebook/callback`,
      // Ask Facebook to include email and profile picture in the response
      profileFields: ["id", "emails", "name", "picture"],
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(null, false, { message: "Facebook did not share your email address. Please check your Facebook privacy settings." });
        }

        const user = await oauthLogin({
          provider:   "facebook",
          providerId: profile.id,
          email,
          firstName:  profile.name?.givenName  || profile.displayName || "User",
          lastName:   profile.name?.familyName || "",
          avatar:     profile.photos?.[0]?.value,
        });

        done(null, user);
      } catch (err) {
        if (err instanceof ApiError) return done(null, false, { message: err.message });
        done(err as Error);
      }
    }
  )
);

// ─── TWITTER / X ──────────────────────────────────────────────────────────────
// Note: Getting the user's email from Twitter requires your app to have
// "Elevated" access in the Twitter Developer Portal. Without it, profile.emails
// will be empty and we redirect the user to use a different sign-in method.
passport.use(
  new TwitterStrategy(
    {
      consumerKey:    process.env.TWITTER_CLIENT_ID!,
      consumerSecret: process.env.TWITTER_CLIENT_SECRET!,
      callbackURL:    `${process.env.API_URL}/api/auth/twitter/callback`,
      // includeEmail: true requires Elevated access in the Twitter Developer Portal
      includeEmail:   true,
    },
    async (_token, _tokenSecret, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          // @types/passport-twitter types done as 2-arg only — cast to use the info arg
          return (done as (err: any, user?: any, info?: any) => void)(null, false, { message: "Twitter did not share your email address. Your app may need Elevated access in the Twitter Developer Portal, or the user may not have a verified email on their account." });
        }

        const nameParts = (profile.displayName || "").split(" ");
        const firstName = nameParts[0] || profile.username || "User";
        const lastName  = nameParts.slice(1).join(" ") || "";

        const user = await oauthLogin({
          provider:   "twitter",
          providerId: profile.id,
          email,
          firstName,
          lastName,
          avatar: profile.photos?.[0]?.value,
        });

        done(null, user);
      } catch (err) {
        if (err instanceof ApiError) return (done as (err: any, user?: any, info?: any) => void)(null, false, { message: err.message });
        done(err as Error);
      }
    }
  )
);

export default passport;
