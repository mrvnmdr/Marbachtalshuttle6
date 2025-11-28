# Vercel Deployment - Super Einfach

## 3 Schritte:

### 1. GitHub pushen
```bash
git add .
git commit -m "Deploy to Vercel"
git push
```

### 2. Vercel öffnen
- Gehe zu https://vercel.com
- Klick "Sign Up" (mit GitHub anmelden)
- Klick "Import Git Repository"
- Wähle: `Marbachtalshuttle5`
- Klick "Import"

### 3. Umgebungsvariablen setzen
- Unter "Environment Variables" hinzufügen:
  - `VITE_SUPABASE_URL` = dein Supabase URL
  - `VITE_SUPABASE_ANON_KEY` = dein Supabase Key
- Klick "Deploy"

**Fertig!** 🚀 App lädt automatisch auf `https://dein-domain.vercel.app`
