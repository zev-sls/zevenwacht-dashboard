# Zevenwacht Dashboard - Netlify Secure Copy

This folder is the Netlify-ready dashboard. The original single-file dashboard at `C:\Claude\Projects\Zevenwacht-dashboard\index.html` is unchanged.

## Data and secrets

- Public app shell: `public/index.html`
- Netlify Functions: `netlify/functions/*`
- Encrypted deploy data: `data/*.enc.json`
- Local plaintext inputs: `private/*.json` (ignored by Git)
- Local secrets: `.env.local` (ignored by Git)

Set `DATA_ENCRYPTION_KEY` and `SESSION_SECRET` in Netlify's environment variables. Keep their values out of tracked files and command output.

## Monthly sales update

Each workbook is a complete replacement of the sales history. From this folder, run:

```powershell
npm.cmd run update-sales -- "C:\path\to\salesdata.xlsx"
```

The command uses an `AppData` worksheet when present, otherwise the first worksheet. To choose a different worksheet, add its name after the path. It imports rows into the ignored `private/sales-data.json`, validates the dates and amounts, prints the latest month's totals, and encrypts only `data/sales-data.enc.json`. It reads `DATA_ENCRYPTION_KEY` from `.env.local` when the variable is not already set in the shell. An unchanged full export leaves the encrypted file untouched.

Review the printed month, row count, bottles, and revenue before committing. Zero-bottle rows with nonzero revenue are retained; rows with both values zero are excluded.

```powershell
npm.cmd run check:secrets
git status --short
git add data/sales-data.enc.json
git commit -m "Update sales data for September 2026"
```

Use the relevant month in the commit message. Do not add `private/*.json` or `.env.local` to Git.

The standalone importer remains available as `npm.cmd run import-sales-excel -- "C:\path\to\salesdata.xlsx" [SheetName]`, but it does not encrypt the result.

## User updates

Generate a PIN hash with `npm.cmd run hash-pin -- 123456`, then update `private/users.json`. Encrypt only the user file with:

```powershell
npm.cmd run encrypt -- users
```

`npm.cmd run encrypt` without an argument checks both private files and rewrites only files whose plaintext has changed.

To rotate the encryption key, first set a new `DATA_ENCRYPTION_KEY` in the ignored `.env.local`, then run `npm.cmd run encrypt -- --rotate` to re-encrypt both files. Update both `DATA_ENCRYPTION_KEY` and `SESSION_SECRET` in Netlify before deploying the rotated artifacts. Existing sessions will need to sign in again after the deployment.

## Local testing

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:8888/`.
