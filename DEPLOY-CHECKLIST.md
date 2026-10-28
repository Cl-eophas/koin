# Before every deploy

1. **Make the change on a branch, not on `main`.** Open a pull request. Netlify also creates a preview link for it.
2. **Wait for CI to pass.** The green check on the pull request means the backend tests, type-check, lint, build and config checks all passed.
3. **Read the preview.** Open the Netlify preview link and sign in. Check the page you changed.
4. **Merge only when everything is green.** Then wait for Netlify and Render to show Published and Live.
5. **Check the live site.** Open `https://koin1.netlify.app/login` and `https://koin-jyvc.onrender.com/api/health`.
6. **If something breaks, roll back.** In Netlify, open Deploys and click **Publish deploy** on the last working version. In Render, open Events and roll back to the last working deploy.

## Rules that prevent most problems
- Never commit `.env`. Secrets live only in Render and Netlify settings.
- Never leave placeholder addresses such as `YOUR-BACKEND` in `netlify.toml` or `render.yaml`.
- Change one thing at a time, so a problem is easy to trace.
- Keep the UptimeRobot monitor on `/api/health` running, so you hear about outages first.
