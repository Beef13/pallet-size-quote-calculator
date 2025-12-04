# Deploy to GitHub Pages - Step-by-Step Guide

This guide will help you host your Timber Pallet Quote Calculator on GitHub Pages for **FREE**.

---

## 📋 Prerequisites

- ✅ Project already pushed to GitHub (Done!)
- ✅ GitHub account
- ✅ Repository: `https://github.com/Beef13/pallet-size-quote-calculator`

---

## 🚀 Deployment Method 1: GitHub Actions (Recommended)

This method automatically builds and deploys whenever you push changes.

### Step 1: Update Vite Configuration

The `vite.config.js` file needs to be updated with your repository name.

**File:** `vite.config.js`

**Change from:**
```javascript
export default defineConfig({
  plugins: [react()],
})
```

**To:**
```javascript
export default defineConfig({
  plugins: [react()],
  base: '/pallet-size-quote-calculator/',
})
```

> **Note:** The base must match your repository name!

### Step 2: Create GitHub Actions Workflow

Create a new file: `.github/workflows/deploy.yml`

**Full content:**
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci --legacy-peer-deps

      - name: Build
        run: npm run build

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### Step 3: Enable GitHub Pages

1. Go to your repository: https://github.com/Beef13/pallet-size-quote-calculator
2. Click **Settings** (top right)
3. Click **Pages** (left sidebar)
4. Under "Source", select: **GitHub Actions**
5. Save

### Step 4: Push Changes

```bash
cd "/Users/savcurcio/Documents/Developer/VPS-AGENTS/Qoute Calculator"
git add .
git commit -m "Configure GitHub Pages deployment"
git push
```

### Step 5: Wait for Deployment

1. Go to the **Actions** tab in your repository
2. Watch the deployment workflow run (takes ~2-3 minutes)
3. Once complete, your site will be live!

### Step 6: Access Your Live Site

Your calculator will be available at:

**https://beef13.github.io/pallet-size-quote-calculator/**

---

## 🚀 Deployment Method 2: Manual Build & Deploy

If you prefer manual control:

### Step 1: Update Vite Config

Same as Method 1 - add `base: '/pallet-size-quote-calculator/'`

### Step 2: Install gh-pages Package

```bash
npm install --save-dev gh-pages
```

### Step 3: Update package.json

Add these scripts to `package.json`:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "deploy": "gh-pages -d dist"
}
```

### Step 4: Build and Deploy

```bash
npm run build
npm run deploy
```

### Step 5: Enable GitHub Pages

1. Go to repository Settings → Pages
2. Set Source to: **gh-pages branch**
3. Save

Your site will be live at: **https://beef13.github.io/pallet-size-quote-calculator/**

---

## 🎯 Quick Comparison

| Method | Pros | Cons |
|--------|------|------|
| **GitHub Actions** | Automatic, professional, CI/CD | Initial setup required |
| **Manual gh-pages** | Simple, quick | Manual deploy each time |

**Recommendation:** Use GitHub Actions for automatic deployments!

---

## 🔄 Updating Your Live Site

### With GitHub Actions (Method 1):
```bash
# Make your changes, then:
git add .
git commit -m "Your update message"
git push
# Site automatically rebuilds and deploys!
```

### With Manual Deploy (Method 2):
```bash
# Make your changes, then:
git add .
git commit -m "Your update message"
git push
npm run build
npm run deploy
```

---

## 🐛 Troubleshooting

### Issue: Page shows 404

**Solution:** 
- Verify `base` in `vite.config.js` matches your repo name exactly
- Check GitHub Pages settings (Settings → Pages)
- Wait 2-3 minutes after deployment

### Issue: Site loads but looks broken

**Solution:**
- Ensure `base` path is correct in `vite.config.js`
- Clear browser cache (Ctrl+F5 or Cmd+Shift+R)
- Check browser console for errors

### Issue: GitHub Actions fails

**Solution:**
- Check the Actions tab for error details
- Verify `.github/workflows/deploy.yml` is correct
- Ensure GitHub Pages is enabled in Settings

### Issue: CSS/Images not loading

**Solution:**
- Verify `base` path in `vite.config.js`
- All asset paths should be relative (Vite handles this automatically)

---

## 📱 Custom Domain (Optional)

Want to use your own domain? (e.g., `calculator.yourbusiness.com`)

1. Go to Settings → Pages
2. Add your custom domain
3. Update your DNS records (see GitHub docs)
4. Enable HTTPS

---

## 🔒 Security Notes

- GitHub Pages is **public** by default
- Anyone can access your calculator
- Prices are visible in the browser
- For private access, consider alternative hosting

---

## 💡 Pro Tips

### Faster Deployments
- GitHub Actions only deploys on push to `main`
- Test locally with `npm run dev` before pushing
- Use `git commit` for multiple changes at once

### Preview Before Deploy
```bash
npm run build
npm run preview
# Opens local preview of production build
```

### Check Build Size
```bash
npm run build
# Shows bundle size in terminal
# Keep it under 1MB for fast loading
```

---

## 🌐 Free Hosting Alternatives

If GitHub Pages doesn't work for you:

### Vercel (Recommended)
1. Go to https://vercel.com
2. Sign in with GitHub
3. Import repository
4. Deploy (automatic!)
5. Get custom domain: `your-app.vercel.app`

### Netlify
1. Go to https://netlify.com
2. Drag and drop your `dist` folder
3. Or connect GitHub repository
4. Get custom domain: `your-app.netlify.app`

### Cloudflare Pages
1. Go to https://pages.cloudflare.com
2. Connect GitHub repository
3. Deploy
4. Free, fast, global CDN

All options are **FREE** and include:
- Automatic HTTPS
- Global CDN
- Custom domains
- Auto-deployment from GitHub

---

## 📊 What Gets Deployed

When you deploy, these files are built and hosted:

```
dist/
├── index.html           (Main page)
├── assets/
│   ├── index-xxxxx.js   (JavaScript bundle)
│   ├── index-xxxxx.css  (Styles bundle)
│   └── ...              (Other assets)
└── vite.svg            (Favicon)
```

**Bundle size:** ~200-400 KB (fast loading!)

---

## ✅ Deployment Checklist

Before deploying, ensure:

- [x] All features tested locally
- [x] No console errors (F12 in browser)
- [x] Responsive design verified
- [ ] Update `vite.config.js` with `base` path
- [ ] Create `.github/workflows/deploy.yml`
- [ ] Enable GitHub Pages in repository settings
- [ ] Push changes to GitHub
- [ ] Wait for deployment (check Actions tab)
- [ ] Test live site

---

## 🎯 Expected Results

After deployment, you'll have:

- ✅ Live URL: `https://beef13.github.io/pallet-size-quote-calculator/`
- ✅ Accessible from any device
- ✅ No server costs
- ✅ Automatic HTTPS
- ✅ Fast loading (GitHub's CDN)
- ✅ 99.9% uptime

---

## 📞 Support Links

- **GitHub Pages Docs:** https://pages.github.com/
- **Vite Deployment Guide:** https://vitejs.dev/guide/static-deploy.html
- **GitHub Actions Docs:** https://docs.github.com/en/actions

---

## 🎊 Success!

Once deployed, share the link with your parents:

**https://beef13.github.io/pallet-size-quote-calculator/**

They can:
- Access it from any device
- Bookmark it on their phone/tablet
- Generate quotes instantly
- Update prices as needed
- See 3D pallet visualizations

**Your parents' business now has a professional online quote calculator!** 🚀

---

**Questions?** Check the troubleshooting section or refer to the documentation files in the repository.

