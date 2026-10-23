# Deployment Guide — Render

This guide covers deploying the WMS application to [Render](https://render.com) with MongoDB Atlas.

## Prerequisites

✅ MongoDB Atlas cluster set up and running  
✅ GitHub repository with this code pushed  
✅ Render account created (free tier available)  

## Step 1: Prepare Environment Variables

Before deploying, ensure you have these values ready:

| Variable | Example | Notes |
|----------|---------|-------|
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/wms_db?retryWrites=true&w=majority` | From MongoDB Atlas |
| `JWT_SECRET` | 64+ random characters | Generate: `openssl rand -hex 32` |
| `NODE_ENV` | `production` | Set to production for deployment |
| `ALLOWED_ORIGINS` | Your deployed URL | Will be `https://your-app.onrender.com` |
| `PUBLIC_APP_URL` | Your deployed URL | Same as above with `/` at end |

### Generate a secure JWT_SECRET (PowerShell):
```powershell
[Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Maximum 256 }))
```

Or use an online generator: https://randomkeygen.com/

## Step 2: Create Render Web Service

1. **Log in to [Render Dashboard](https://dashboard.render.com)**

2. **Click "New +" → "Web Service"**

3. **Connect your GitHub repository**
   - If not authorized, click "Connect account"
   - Select the repository containing this code

4. **Configure the service:**
   - **Name:** `yp-wms` (or your preferred name)
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** `Free` (optional: upgrade to paid for better performance)

5. **Add Environment Variables** (click "Advanced")
   - Click "Add Environment Variable" for each:
     
     | Key | Value |
     |-----|-------|
     | `NODE_ENV` | `production` |
     | `MONGODB_URI` | Your MongoDB Atlas connection string |
     | `JWT_SECRET` | Your generated secret (64+ chars) |
     | `ALLOWED_ORIGINS` | `https://your-app.onrender.com` |
     | `PUBLIC_APP_URL` | `https://your-app.onrender.com/` |
     | `SMTP_HOST` | (optional) Your SMTP provider |
     | `SMTP_PORT` | (optional) e.g., 587 |
     | `SMTP_USER` | (optional) Your email |
     | `SMTP_PASS` | (optional) Your app password |
     | `SMTP_FROM` | (optional) `noreply@your-domain.com` |
     | `GOOGLE_CLIENT_ID` | (optional) From Google Cloud Console |
     | `GOOGLE_CLIENT_SECRET` | (optional) From Google Cloud Console |
     | `GOOGLE_CALLBACK_URL` | (optional) `https://your-app.onrender.com/api/auth/google/callback` |

6. **Click "Create Web Service"**

Render will automatically deploy your app! The initial build takes 2-5 minutes.

## Step 3: Verify Deployment

Once deployment completes:

1. **Check Logs** (in Render Dashboard)
   - Look for: `"Server running on port"`
   - If errors, check error messages and verify environment variables

2. **Test the application**
   - Visit: `https://your-app-name.onrender.com`
   - Try login with seeded admin (`admin@wms.co.ke`) using the password
     printed to the server console at seed time (not stored in docs or API responses).
     You will be required to change the password on first login.

3. **Verify API connectivity**
   ```bash
   curl https://your-app-name.onrender.com/api/auth/status
   ```

## Step 4: Configure MongoDB Atlas for Render

Your MongoDB Atlas cluster needs to allow connections from Render:

1. **In MongoDB Atlas → Network Access**
2. **Add IP Address**
   - Either add Render's IP (if known)
   - OR add `0.0.0.0/0` to allow all (⚠️ secure with strong password)

## Step 5: Update Frontend (if deployed separately)

If your frontend will be on a different domain, update `ALLOWED_ORIGINS`:

```
ALLOWED_ORIGINS=https://your-frontend.com,https://your-app.onrender.com
```

## Step 6: Enable Auto-Deployments (Optional)

1. In Render Dashboard → Select your service
2. **Settings** → "Auto-deploy" → Enable
3. Now every push to `main` (or your branch) auto-deploys

## Troubleshooting

### App crashes immediately after deploy
- Check logs: `tail -f` in Render dashboard
- Verify `MONGODB_URI` is correct (no special characters unescaped)
- Ensure `NODE_ENV=production`

### "Cannot GET /" or 404 errors
- Check `ALLOWED_ORIGINS` includes your Render URL
- Verify `frontend/app.html` exists and is served from backend

### CORS errors in browser console
- Update `ALLOWED_ORIGINS` to include your frontend domain
- Test with `curl -H "Origin: your-url"` to verify headers

### MongoDB connection timeout
- Verify MongoDB Atlas IP whitelist includes Render
- Check `MONGODB_URI` syntax: `mongodb+srv://user:pass@host/db`
- Ensure password has no unescaped special characters

### Emails not sending
- Verify `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` are set
- Check provider's app password requirements (Gmail, Outlook, etc.)
- Ensure `SMTP_PORT` matches provider (usually 587 or 465)

## Performance Tips

- **Free tier:** Auto-spins down after 15 min inactivity (may add 30s startup delay)
- **Paid tier:** Always-on, better performance
- **Database:** Keep MongoDB Atlas on same cloud provider (AWS, GCP) as Render for faster queries
- **Caching:** Consider Redis if needed (available as Render add-on)

## Monitoring & Logs

Check your deployment logs anytime:
1. Render Dashboard → Your service
2. **Logs** tab shows real-time output
3. Set up alerts in **Settings** → **Notifications**

## Next Steps

- Domain: Add custom domain in Render → **Custom Domains**
- SSL: Render auto-generates free SSL certificate
- Backups: Set up MongoDB Atlas automated backups
- Monitoring: Enable Render error tracking in Dashboard

---

**Questions?** Check [Render Docs](https://render.com/docs) or review your app logs first.
