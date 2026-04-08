# Brief Antigravity — Polish visuel tracking-dashboard

## Contexte

App React live : https://albertmargaryanperso-ship-it.github.io/tracking-dashboard/

- Stack : Vite 8 + React 19 + TypeScript + Tailwind CSS 3 + `vite-plugin-singlefile`
- Repo : https://github.com/albertmargaryanperso-ship-it/tracking-dashboard
- Déploy : auto via GitHub Actions sur push vers `main`
- Sync : bidirectionnelle vault ↔ cloud ↔ mobile (via `bilan_vault.py --cloud-push/--cloud-pull`)

L'architecture et la data layer sont **figées** — ne pas toucher à :
- `src/hooks/useAppState.ts`
- `src/lib/github.ts`
- `src/lib/stats.ts`
- `src/types.ts`
- `data/state.json`
- `.github/workflows/deploy.yml`

## Ta mission

Polish **visuel** et **UX** uniquement. Les composants existent et fonctionnent — il faut les rendre "la crème de la crème".

### Priorités

1. **Dashboard hero** (`src/components/Dashboard.tsx`)
   - La section en haut (streak + heures aujourd'hui) est basique. À faire : animer les chiffres au mount (count-up), ajouter micro-interactions au hover.
   - Les 4 cards de stats manquent de hiérarchie visuelle — tester un layout asymétrique ou sparklines inline.

2. **Heatmaps** (`src/components/Heatmap.tsx`)
   - Actuellement une grille simple 7×N. Ajouter :
     - Tooltip au hover (date + heures + note)
     - Animation stagger à l'apparition
     - Transition fluide sur changement d'intensité

3. **Mobile-first** (tous composants)
   - La nav tabs (`Header.tsx`) : actuellement scroll horizontal brut. Essayer une bottom-nav iOS-like OU segmented control animé.
   - Le FAB `+` : ajouter haptic feedback (web vibration API) + animation ripple.

4. **Modales** (`QuickAddModal.tsx`, `TokenModal.tsx`)
   - Sur desktop : centrées classiques → tester bottom-sheet partout.
   - Transitions d'ouverture : scale+fade → spring physics (framer-motion si pas trop lourd).

5. **Routine blocs counter** (`RoutineView.tsx`)
   - Les boutons quick `0/2/4/6/8/12` sont plats. Tester un slider horizontal avec snap + vibration.

### Contraintes dures

- **Bundle size** : max 400 KB gzippé pour le single-file (actuel ~310 KB). Si tu ajoutes framer-motion ou lottie, vérifie l'impact.
- **Offline-first** : toutes les animations doivent fonctionner hors ligne.
- **Couleurs** : rester sur la palette violet-cyan existante (`from-violet-600 to-cyan-600`). Ne pas introduire d'autres hues.
- **Typo** : garder la typo système (sans-serif) — pas de Google Fonts externes.
- **Pas de dépendances API externes** (pas de lottiefiles.com, unsplash, etc.)

## Comment tester

```bash
cd /Users/malabagdo/.gemini/antigravity/scratch/tracking-dashboard
npm run dev       # http://localhost:5173
npm run build     # vérifier dist/index.html < 400 KB
```

Data mock disponible dans `data/state.json` — l'app la charge automatiquement si pas de token GitHub.

## Livraison

- Commit + push vers `main` → auto-deploy GitHub Pages en ~30 sec
- Mettre à jour `README.md` si nouvelles dépendances
- Laisser un résumé des changements dans ce fichier à la fin (section "## Changelog Antigravity")

---

## Changelog Antigravity

<!-- À remplir par Antigravity après le polish -->
