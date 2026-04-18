# Aegis Care — Startup Runbook

This guide is written for a fresh Windows PC. It includes the full setup and run commands needed to bring the project up from scratch.

## 0. One-time prerequisites

Install these tools first:

- Git
- Node.js 24 or newer
- Python 3.12
- pipx
- Poetry
- AlgoKit CLI
- Docker Desktop

Suggested Windows installs with Scoop:

```powershell
scoop bucket add versions
scoop install python312
```

Install Poetry and AlgoKit through pipx:

```powershell
pipx install poetry
pipx install algokit
pipx ensurepath
```

If `poetry` is not available after installation, close and reopen the terminal. If needed, add the pipx apps folder to the current session:

```powershell
$env:Path = "$HOME\.local\bin;" + $env:Path
```

You can verify the tools with:

```powershell
python --version
poetry --version
algokit --version
```

## 1. Clone the repository

```powershell
git clone <repo-url>
cd Aegis-Care
```

## 2. Point Poetry at Python 3.12

Go to the contracts project and point Poetry to your local Python 3.12 executable:

```powershell
cd projects/aegis-contracts
poetry env use "<absolute-path-to-python-3.12.exe>"
```

If you need help finding the executable path, use:

```powershell
py -0p
```

or:

```powershell
Get-Command python
```

Confirm Poetry is using the right interpreter:

```powershell
poetry run python --version
```

## 3. Bootstrap dependencies

Run this from the repository root to install all Python and npm dependencies for both projects:

```powershell
cd ..
algokit project bootstrap all
```

## 4. Start LocalNet

Start the local Algorand network and verify it is running:

```powershell
algokit localnet start
algokit localnet status
```

## 5. Build the contracts

Generate contract artifacts and TypeScript clients:

```powershell
cd projects/aegis-contracts
algokit project run build
```

## 6. Deploy contracts to LocalNet

Deploy the contracts to the local network:

```powershell
algokit project deploy localnet
```

After deployment, record the app IDs printed in the output and update these files if they change:

- [projects/aegis-frontend/.env](projects/aegis-frontend/.env)
- [projects/aegis-contracts/.env](projects/aegis-contracts/.env)

On a new PC or a reset LocalNet, the app IDs will be different from any other machine.

## 7. Run the frontend

Start the frontend dev server:

```powershell
cd ../aegis-frontend
npm run dev
```

Open the local URL printed by Vite. It will usually be `http://localhost:5173/`, but Vite may pick another free port if that port is already in use.

## 8. Full startup flow in order

If you want the complete copy-paste sequence, use this order:

```powershell
git clone <repo-url>
cd Aegis-Care
cd projects/aegis-contracts
poetry env use "<absolute-path-to-python-3.12.exe>"
poetry run python --version
cd ..
algokit project bootstrap all
algokit localnet start
algokit localnet status
cd projects/aegis-contracts
algokit project run build
algokit project deploy localnet
cd ../aegis-frontend
npm run dev
```

---

## Daily workflow

For normal development after the first setup:

```powershell
algokit localnet start
cd projects/aegis-frontend
npm run dev
```

Only rerun build and deploy when you change files under `projects/aegis-contracts/smart_contracts/*/contract.py`.

## Useful maintenance commands

```powershell
algokit localnet status
algokit localnet reset
algokit localnet stop
```

Use `reset` if LocalNet becomes inconsistent, then repeat the start, build, and deploy steps.

## Troubleshooting

- `poetry: command not found` → run `pipx ensurepath`, reopen the terminal, and make sure `C:\Users\<you>\.local\bin` is on PATH.
- `The currently activated Python version 3.11.x is not supported` → rerun the Poetry env selection step and point it to Python 3.12.
- `Cannot connect to Docker` → start Docker Desktop, then run `algokit localnet start` again.
- Frontend shows `APP_ID = 0` errors → redeploy contracts on that machine and update the `.env` files with the new app IDs.
- LocalNet state got weird → run `algokit localnet reset`, then repeat steps 4 through 7.
