# IA Workshop App - Production Ready

A real-time collaborative workshop platform with live transcription, AI-powered theme synthesis, and video conferencing.

## 🚀 Features

- **Video Conferencing**: Built on Jitsi Meet for reliable video/audio
- **Real-time Sync**: Firebase Realtime Database for participant tracking
- **Live Transcription**: Web Speech API with Whisper fallback
- **AI Theme Synthesis**: GPT-4 powered theme extraction from transcripts
- **Secure Architecture**: API keys protected via Netlify Functions
- **Mobile Responsive**: Works on phones, tablets, and desktops
- **Accessibility**: WCAG compliant with keyboard navigation and screen reader support
- **Dark Mode**: Toggle between light and dark themes with persistent preference

## 🎨 UI Framework

**DaisyUI + Tailwind CSS** for modern, professional design:
- ✅ Pre-built component library (cards, buttons, forms, modals)
- ✅ Responsive design out-of-the-box
- ✅ Consistent visual language across pages
- ✅ Minimal custom CSS required
- ✅ Dark mode support available

See [DAISYUI_INTEGRATION.md](DAISYUI_INTEGRATION.md) for full integration details.

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher)
- [Netlify Account](https://netlify.com) (free tier works)
- [Firebase Project](https://console.firebase.google.com)
- [OpenAI API Key](https://platform.openai.com/api-keys)

## 🛠️ Setup Instructions

### 1. Clone and Install

```bash
cd workshop-app
npm install
```

### 2. Configure Firebase

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project or use existing
3. Enable **Realtime Database**
4. Set up database rules:

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

5. Get your config from Project Settings > General

### 3. Configure OpenAI

1. Get API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Ensure you have credits and GPT-4 access

### 4. Environment Variables

Create `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

Fill in your actual values:

```env
OPENAI_API_KEY=sk-proj-your-actual-key
FIREBASE_API_KEY=your-firebase-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef
```

### 5. Local Development

**You can skip this step for production deployment.**

For local testing only, you can temporarily update `js/config.js` with your Firebase credentials. However, for production deployment, the build script will handle this automatically using environment variables.

## 🧪 Local Development

```bash
npm run dev
```

This starts Netlify Dev server at `http://localhost:8888`

Open:
- Facilitator: `http://localhost:8888/workshop-new.html`
- Participant: `http://localhost:8888/participant-new.html`

## 🚢 Deployment to Netlify

⚠️ **IMPORTANT**: See [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for complete step-by-step deployment guide.

### Option 1: Netlify CLI

```bash
# Login to Netlify
netlify login

# Deploy
npm run deploy
```

### Option 2: Netlify UI (Recommended)

1. Push code to GitHub
2. Go to [Netlify App](https://app.netlify.com)
3. Click "New site from Git"
4. Connect your repository
5. Build settings:
   - **Build command**: `node build.js`
   - **Publish directory**: `.`
   - **Functions directory**: `netlify/functions`
6. Add environment variables (see checklist for all 8 required variables)
7. Deploy!

See [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for detailed instructions.

## 📖 Usage Guide

### Getting Started

1. Visit your deployed site URL (e.g., `https://your-site.netlify.app`)
2. Choose either:
   - **Create Workshop** (for facilitators)
   - **Join Workshop** (for participants)

### For Facilitators

1. Click "Create Workshop" or visit `/workshop-new.html`
2. Enter your name and click "Create Workshop"
3. Share the 6-character code with participants
4. Control phases, timer, and generate themes
5. View all participants and activity

### For Participants

1. Click "Join Workshop" or visit `/participant-new.html`
2. Enter your name and the workshop code
3. Join the video conference
4. Record audio for transcription
5. View synthesized themes

## 🏗️ Architecture

```
┌─────────────────┐
│  Netlify CDN    │ Static hosting
└────────┬────────┘
         │
    ┌────┴─────┐
    │  Client  │ (HTML/CSS/JS)
    └────┬─────┘
         │
    ┌────┴────────────────────┐
    │                         │
┌───▼──────┐         ┌────────▼────────┐
│ Firebase │         │ Netlify Functions│
│ Realtime │         │   (API Proxy)    │
│ Database │         └────────┬─────────┘
└──────────┘                  │
                     ┌────────▼──────────┐
                     │   OpenAI APIs     │
                     │ (GPT-4 & Whisper) │
                     └───────────────────┘
```

## 🔒 Security Features

✅ API keys hidden via serverless functions  
✅ Firebase security rules  
✅ Input validation & sanitization  
✅ HTTPS enforced  
✅ CSP headers  
✅ XSS protection  

## 🐛 Troubleshooting

### Video not working
- Check camera/microphone permissions
- Try different browser (Chrome recommended)
- Check firewall/network settings

### Firebase errors
- Verify Firebase config in `js/config.js`
- Check Firebase database rules
- Ensure Realtime Database is enabled

### Transcription not working
- Web Speech API works best in Chrome
- Whisper fallback requires OpenAI API key
- Check microphone permissions

### Themes not generating
- Verify OpenAI API key in Netlify environment
- Check network connectivity
- Ensure transcripts exist for current phase

## 📊 Browser Support

| Browser | Support |
|---------|---------|
| Chrome  | ✅ Full |
| Firefox | ✅ Full |
| Safari  | ✅ Full (iOS 14.3+) |
| Edge    | ✅ Full |

## 📝 File Structure

```
workshop-app/
├── css/
│   ├── common.css         # Shared styles
│   ├── participant.css    # Participant view
│   └── workshop.css       # Facilitator view
├── js/
│   ├── config.js          # Configuration
│   ├── utils.js           # Utilities
│   ├── firebase.js        # Database
│   ├── participant.js     # Participant logic
│   └── workshop.js        # Facilitator logic
├── netlify/
│   └── functions/
│       ├── openai-proxy.js   # GPT-4 themes
│       └── whisper-proxy.js  # Audio transcription
├── participant-new.html   # Participant page
├── workshop-new.html      # Facilitator page
├── netlify.toml          # Netlify config
├── package.json          # Dependencies
└── README.md             # This file
```

## 🎯 Production Checklist

- [ ] Replace all placeholder Firebase config
- [ ] Set all environment variables in Netlify
- [ ] Test on multiple browsers
- [ ] Test on mobile devices
- [ ] Verify Firebase security rules
- [ ] Test with multiple simultaneous participants
- [ ] Check error handling and loading states
- [ ] Verify API rate limits
- [ ] Set up monitoring/analytics

## 🤝 Contributing

Contributions welcome! Please open an issue first to discuss changes.

## 📄 License

MIT License - See LICENSE file for details

## 🆘 Support

For issues and questions:
1. Check troubleshooting section
2. Review browser console for errors
3. Check Firebase and Netlify logs
4. Open a GitHub issue

---

**Built with ❤️ for interactive workshops**
