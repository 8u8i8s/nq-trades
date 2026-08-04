# PULI LIFE — osobný dashboard

Financie, net worth, denné pravidlá, ciele, žurnál a fitness v jednom. PWA — dá sa nainštalovať na plochu mobilu aj PC. Dáta sa ukladajú do Supabase (cloud), takže sú dostupné z každého zariadenia a prežijú čokoľvek.

## Čo vie

| Sekcia | Obsah |
|---|---|
| **Prehľad** | Net worth + graf, dnešný P&L, mesačný cashflow, dnešné pravidlá, ciele |
| **Financie** | Net worth (účty + zostatky), cashflow (príjmy/výdavky, kategórie), denný trading P&L, finančné ciele |
| **Život** | Denné pravidlá/návyky so streakmi 🔥, prehľad 7 dní, dlhodobé ciele s krokmi |
| **Žurnál** | Denné hodnotenie dňa (1–5 ★) + zápis, história |
| **Fitness** | Váha + graf, tréningy, týždenná konzistencia |

## Sprevádzkovanie (raz, ~5 minút)

1. **Databáza** — v [Supabase Dashboarde](https://supabase.com/dashboard) otvor svoj projekt → *SQL Editor* → vlož obsah `supabase/migrations/20260804_puli_life_schema.sql` → **Run**. (Ak už tabuľky existujú, tento krok preskoč.)
2. **Kľúč** — *Project Settings → API Keys* → skopíruj **anon / publishable** kľúč a vlož ho do `config.js` (pole `key`). Tento kľúč je bezpečné zverejniť — dáta chráni prihlásenie + Row Level Security.
3. **GitHub Pages** — *Settings → Pages* → Deploy from branch → `main` → `/ (root)`.
4. Otvor stránku, klikni **Registrovať**, potvrď e-mail a prihlás sa.

## Na mobile

Otvor stránku v Safari/Chrome → *Pridať na plochu* — správa sa ako natívna appka.

## Štruktúra

- `index.html`, `styles.css`, `app.js` — aplikácia (vanilla JS, žiadny build)
- `config.js` — Supabase URL + kľúč
- `supabase/migrations/` — SQL schéma databázy
- `sw.js`, `manifest.json`, `icon-*.png` — PWA
- `puli-os/` — pôvodný PULI OS dashboard (ostáva dostupný na `/puli-os/`)
