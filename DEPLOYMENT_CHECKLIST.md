# 🚀 Deployment Checklist

Complete these steps to successfully deploy your IA Workshop App to Netlify.

## 📋 Pre-Deployment Checklist

### 1. Firebase Setup ✅

- [ ] Create Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
- [ ] Enable **Realtime Database**
- [ ] Set database rules:

```json
{
  "rules": {
    "sessions": {
      "$sessionId": {
        ".read": true,
        ".write": "auth != null || !data.exists()"
      }
    },
    "transcripts": {
      "$sessionId": {
        ".read": true,
        ".write": true
      }
    },
    "themes": {
      "$sessionId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

- [ ] Get Firebase configuration from Project Settings > General > Your apps > Web app
- [ ] Copy these values (you'll need them in step 3):
  - API Key
  - Auth Domain
  - Database URL
  - Project ID
  - Storage Bucket
  - Messaging Sender ID
  - App ID

### 2. OpenAI Setup ✅

- [ ] Get API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- [ ] Ensure you have:
  - [ ] Active account with credits
  - [ ] GPT-4 API access (or GPT-3.5 as fallback)
  - [ ] Whisper API access (included with all accounts)

### 3. Repository Setup ✅

- [ ] Push code to GitHub/GitLab/Bitbucket
- [ ] Ensure `.env` file is NOT committed (it's in `.gitignore`)
- [ ] Verify `js/config.js` still has placeholders like `{{FIREBASE_API_KEY}}`
  - **DO NOT manually edit config.js** - the build script handles this
- [ ] Commit all changes

## 🌐 Netlify Deployment

### Option A: Netlify UI (Recommended for First Deploy)

#### Step 1: Connect Repository

1. Go to [app.netlify.com](https://app.netlify.com)
2. Click **"Add new site"** > **"Import an existing project"**
3. Choose your Git provider (GitHub/GitLab/Bitbucket)
4. Authorize Netlify to access your repositories
5. Select your `workshop-app` repository

#### Step 2: Configure Build Settings

```
Build command:     node build.js
Publish directory: .
Functions dir:     netlify/functions
```

#### Step 3: Add Environment Variables

In **Site configuration** > **Environment variables**, add these **8 variables**:

```
OPENAI_API_KEY              = sk-proj-your-actual-key-here

FIREBASE_API_KEY            = your-firebase-api-key
FIREBASE_AUTH_DOMAIN        = your-project.firebaseapp.com
FIREBASE_DATABASE_URL       = https://your-project.firebaseio.com
FIREBASE_PROJECT_ID         = your-project-id
FIREBASE_STORAGE_BUCKET     = your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID = 123456789
FIREBASE_APP_ID             = 1:123456789:web:abcdef
```

⚠️ **Important**: Copy these values exactly from your Firebase project settings.

#### Step 4: Deploy

- [ ] Click **"Deploy site"**
- [ ] Wait for build to complete (1-2 minutes)
- [ ] Check build logs for any errors

### Option B: Netlify CLI (For Subsequent Deploys)

```bash
# Install Netlify CLI (one time)
npm install -g netlify-cli

# Login to Netlify
netlify login

# Link to your site (first time only)
netlify link

# Deploy
netlify deploy --prod
```

## ✅ Post-Deployment Verification

### Test Core Functionality

- [ ] Visit your Netlify URL (e.g., `https://your-site.netlify.app`)
- [ ] Index page loads with Create/Join buttons
- [ ] Click **"Create Workshop"**
  - [ ] Enter facilitator name
  - [ ] Workshop code is generated
  - [ ] Video conference loads
  - [ ] Share link works
- [ ] Open participant page in incognito/different browser
  - [ ] Enter name and workshop code
  - [ ] Join succeeds
  - [ ] Video conference connects
- [ ] Test recording (participant page)
  - [ ] Click record button
  - [ ] Speak some words
  - [ ] Stop recording
  - [ ] Verify transcript saves
- [ ] Test theme generation (facilitator page)
  - [ ] Ensure participants have recorded transcripts
  - [ ] Click "Generate Themes"
  - [ ] Verify themes appear in both facilitator and participant views

### Check Browser Console

- [ ] Open DevTools (F12)
- [ ] Check Console for errors
- [ ] Verify Firebase connection: Look for "✅ Firebase initialized"
- [ ] Verify no "{{PLACEHOLDER}}" errors

### Test on Mobile

- [ ] Open on phone/tablet
- [ ] Test responsive design
- [ ] Verify video works on mobile
- [ ] Test touch interactions

## 🔍 Troubleshooting

### Build Fails

**Error**: "Missing required environment variables"
- **Fix**: Go to Netlify Site Settings > Environment Variables and add all 8 variables

**Error**: "Cannot read property of undefined"
- **Fix**: Check that all Firebase config values are correct (no extra spaces, quotes, etc.)

### Firebase Connection Fails

**Error**: "Firebase configuration not set"
- **Fix**: Verify build script ran successfully (check build logs)
- **Fix**: Ensure `js/config.js` doesn't have `{{PLACEHOLDERS}}` after build

**Error**: "Permission denied"
- **Fix**: Check Firebase database rules are set correctly
- **Fix**: Ensure database URL is correct (includes `https://` and ends with `.firebaseio.com`)

### Video Conference Doesn't Load

**Error**: Jitsi container is empty
- **Fix**: Check browser console for CORS errors
- **Fix**: Verify Jitsi domain is accessible (meet.jit.si)
- **Fix**: Try different browser

### Theme Generation Fails

**Error**: "OpenAI API request failed"
- **Fix**: Verify OPENAI_API_KEY is set in Netlify
- **Fix**: Check API key has credits and GPT-4 access
- **Fix**: Check Netlify Functions logs for detailed error

### Transcription Not Working

**Issue**: Recording but no transcript
- **Fix**: Check browser has microphone permissions
- **Fix**: Try in different browser (Chrome recommended)
- **Fix**: Check browser console for Speech Recognition errors

## 🔄 Updating Deployment

### Update Environment Variables

1. Netlify Dashboard > Site Settings > Environment Variables
2. Edit or add new variables
3. Trigger new deployment (automatic on next git push, or manual deploy)

### Update Code

```bash
git add .
git commit -m "Your changes"
git push origin main
```

Netlify will automatically rebuild and deploy.

### Force Rebuild

```bash
# Using CLI
netlify build

# Or in Netlify UI
# Site Overview > Deploys > Trigger deploy > Clear cache and deploy site
```

## 📊 Monitoring

### Check Netlify Functions Logs

1. Netlify Dashboard > Functions
2. Click on `openai-proxy` or `whisper-proxy`
3. View real-time logs and errors

### Firebase Usage

1. Firebase Console > Usage and billing
2. Monitor:
   - Realtime Database reads/writes
   - Storage usage
   - Concurrent connections

### OpenAI Usage

1. OpenAI Platform > Usage
2. Monitor:
   - API requests
   - Token usage
   - Costs

## 🎉 Success Criteria

Your deployment is successful when:

- [x] Index page loads without errors
- [x] Facilitator can create workshop and get code
- [x] Participant can join with code
- [x] Video conference works for both
- [x] Recording and transcription work
- [x] Theme generation produces results
- [x] No console errors
- [x] Mobile responsive design works
- [x] Dark mode toggle functions

## 📞 Support

If issues persist:

1. Check Netlify build logs
2. Check browser console (DevTools)
3. Check Netlify Functions logs
4. Review [README.md](README.md) for configuration details
5. Verify all environment variables are set correctly

---

**Ready to deploy?** Start with the Firebase Setup checklist above! 🚀
