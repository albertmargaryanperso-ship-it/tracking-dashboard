# 📊 Tracking — Albert

Tableau de bord personnel qui agrège **vault Obsidian**, **routine quotidienne** et **todos** avec sync bidirectionnelle Obsidian ↔ Web ↔ Mobile.

## Architecture

- **Frontend** : React 19 + Vite + TypeScript + Tailwind CSS → build single-file (310 KB)
- **Hébergement** : GitHub Pages
- **Backend** : GitHub Contents API — `data/state.json` comme source de vérité
- **Sync Obsidian** : `bilan_vault.py --cloud-push` / `--cloud-pull` via `gh api`
- **PWA** : installable sur iPhone (home screen) + offline cache

## Sources de données

Le fichier `data/state.json` contient :
- `sessions` — sessions de travail logguées dans le frontmatter des notes Obsidian
- `routine` — blocs de temps + habitudes (Sport, Cardio, Lecture, Bien-être)
- `todos` — tâches pro/finance/admin avec priorité

## Développement

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # → dist/index.html (single-file)
```

## Déploiement

`git push origin main` → GitHub Actions build et déploie automatiquement sur GitHub Pages.

## Configuration côté Web

Un **personal access token** GitHub (scope `contents:write` sur ce repo) est nécessaire pour écrire depuis le navigateur. Il est demandé à la première ouverture et stocké dans `localStorage`.

Généré depuis : https://github.com/settings/personal-access-tokens/new

## Intégration Obsidian

La note `📊 Tracking — Tableau de Bord` contient un `iframe` pointant vers l'URL GitHub Pages. Les modifications sont reflétées via auto-refresh toutes les 60 secondes.
