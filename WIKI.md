# CmdVault Wiki

## What is CmdVault?

CmdVault is a Chrome Extension sidepanel built to **optimize how support and engineering teams work with commands across cloud and on-prem environments**. It centralizes your team's command knowledge into a single, searchable library — accessible right inside the browser, exactly where the work happens.

Whether your team manages AWS infrastructure, on-prem Kubernetes clusters, Azure services, or hybrid environments, CmdVault eliminates the time spent searching through Slack threads, scattered text files, or outdated wikis. Store, organize, tag, and retrieve commands in seconds — then share them across the team.

**One click to copy. One shortcut to search. One source of truth for your team's operational commands.**

---

## Table of Contents

- [Getting Started](#getting-started)
- [The Interface](#the-interface)
- [Managing Commands](#managing-commands)
- [Folders & Organization](#folders--organization)
- [Search](#search)
- [Tags](#tags)
- [Chain Commands](#chain-commands)
- [Dynamic Variables](#dynamic-variables)
- [Favorites (Pinned Commands)](#favorites-pinned-commands)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Themes](#themes)
- [Cloud Sync (GitHub Gist)](#cloud-sync-github-gist)
- [Import & Export](#import--export)
- [Clipboard Auto-Clear](#clipboard-auto-clear)
- [Help Pages](#help-pages)
- [Secret Detection](#secret-detection)
- [Settings](#settings)

---

## Getting Started

Get up and running in under a minute:

1. Install the CmdVault extension in Chrome
2. Click the CmdVault icon in your toolbar (or pin it for quick access)
3. The sidepanel opens with an empty workspace
4. Click the **folder icon (+)** in the top bar to create your first folder
5. Select your folder, then click the **command icon (+)** to add your first command

Start building your command library from day one. As your team adopts CmdVault, use **Folder Merge** import to share command sets across team members — everyone benefits from shared operational knowledge without overwriting their own data.

---

## The Interface

CmdVault's sidepanel is split into three collapsible sections so you can focus on what matters:

| Section | Purpose |
|---------|---------|
| **⭐ Favorites** | Instant access to your top 10 pinned commands — no scrolling, no searching |
| **📜 Last Used** | Quick reference to the last 10 commands you copied |
| **📂 All Commands** | Your full command tree with folders and subfolders |

The **top bar** provides quick actions:
- **New Folder** — create a root-level folder
- **New Command** — add a command to the selected folder
- **Expand/Collapse All** — toggle all folders at once
- **Overflow Menu (⋮)** — Settings, Keyboard Shortcuts, Undock Panel

---

## Managing Commands

### Creating a Command

1. Select a folder (click on it)
2. Click the **command (+)** button in the top bar, or right-click the folder → **Add Command**
3. Fill in the inline editor:
   - **Name** — a short, descriptive label (e.g., "Restart nginx")
   - **Description** — optional context (e.g., "Run after config changes")
   - **Command** — the actual command text
   - **Tags** — comma-separated tags for filtering
4. Hit **Save**

### Copying a Command

**Click the command text** (the monospace block) — it copies to your clipboard instantly. A toast confirms the action, and a banner tracks your clipboard state.

You can also press **Enter** with a command selected.

### Editing a Command

Three ways to start editing:
- Press **F2** with a command selected
- **Double-click** the command name
- Right-click → **Edit**

The inline editor opens in place — make your changes and hit Save.

### Command Icons

Right-click any command to set its icon type. Each icon serves a specific workflow:

| Icon | Purpose |
|------|---------|
| `cmd` | Standard terminal command |
| `⚡` | Scripts and automation |
| `txt` | Text snippets and notes |
| `🔑` | Sensitive values — content is masked (dots) until clicked |
| `⛓️` | Chain commands — multi-step sequences |
| `🔗` | URLs — adds a direct "Open" button |
| 🟢🔴🔵🟣🟡⚪⚫ | Visual markers for priority or status |

### Duplicating & Deleting

- **Right-click → Duplicate** — creates a copy directly below the original
- **Right-click → Delete** or press **Delete** key — removes with confirmation
- **Multi-select + Delete** — batch delete multiple items at once

---

## Folders & Organization

### Folder Structure

CmdVault supports **nested folders**, allowing you to mirror your actual infrastructure — by platform, environment, team, or workflow:

```
📂 AWS Production
  📂 EC2 Instances
    💻 List all instances
    💻 Stop instance by ID
  📂 S3 Buckets
    💻 Sync local to S3
📂 On-Prem Kubernetes
  💻 Get all pods
  💻 Describe pod
📂 Azure Staging
  📂 App Services
    💻 Restart web app
    💻 View deployment logs
📂 Team Procedures
  📂 Incident Response
    ⛓️ Full diagnostics chain
```

This structure scales from a personal collection of 50 commands to a team-shared library of 700+.

### Creating Folders

- **Root folder:** Click the folder (+) button in the top bar
- **Subfolder:** Right-click a folder → **New Sub-Folder**

### Folder Colors

Right-click any folder to access the **color palette** — 8 colors to visually distinguish folder groups at a glance. Colors automatically adjust for contrast based on your current theme.

A consistent color system across your team (e.g., red for production, green for dev, blue for staging) adds a visual safety layer that helps prevent costly mistakes when switching between environments.

### Moving Items

Reorganize with **drag and drop** — grab the grip dots on the left side of any item:
- Drop **before/after** another item to reorder
- Drop **inside** a folder to move it there

Or use **Right-click → Cut** then **Right-click → Paste** on the target folder.

### Expand/Collapse

- **Click** a folder to toggle it
- **Arrow Right** to expand, **Arrow Left** to collapse
- **Expand/Collapse All** button in the top bar for bulk toggling

---

## Search

With hundreds of commands, fast retrieval is critical. Press **Ctrl+Space** to jump to the search bar from anywhere in the panel.

### Basic Search

Start typing — CmdVault searches across command names, command text, descriptions, and tags simultaneously. Matches are highlighted in real-time so you can scan results quickly.

### Advanced Filters

Click the search box to see filter hints, or type these prefixes directly:

| Prefix | Scope | Example |
|--------|-------|---------|
| `#` | Tags only | `#aws` — show all AWS-tagged commands |
| `c:` | Command text only | `c:kubectl` — find commands containing "kubectl" |
| `d:` | Descriptions only | `d:production` — find by description context |
| `f:` | Folder names only | `f:database` — locate specific folders |

### Examples

```
docker              → searches name, command, description, and tags
#precaution         → shows only commands tagged "precaution"
c:grep -r           → finds commands containing "grep -r"
f:kubernetes         → finds folders with "kubernetes" in the name
d:after deploy      → finds commands described with "after deploy"
```

---

## Tags

Tags enable fast categorization and one-click filtering across your entire command library. CmdVault includes **14 predefined tags** with dedicated colors — designed around real cloud and on-prem operational workflows:

### Cloud Providers
| Tag | Color |
|-----|-------|
| `aws` | Orange (with cloud icon) |
| `azure` | Blue (with cloud icon) |
| `gcp` | Green (with cloud icon) |
| `all clouds` | Gray (with cloud icon) |

### Operations
| Tag | Color |
|-----|-------|
| `precaution` | Red |
| `start service` | Green |
| `restart` | Yellow |
| `warning` | Orange |
| `stop service` | Red |
| `procedure` | Adaptive (white on dark, black on light) |
| `url` | Gray |
| `info` | Sky blue |
| `backup` | Violet |
| `script` | Teal |

### How to Use Tags

- Add tags when creating or editing a command (comma-separated)
- Tag suggestions appear as clickable chips while editing
- **Click any tag badge** on a command to instantly filter your entire library by that tag
- Create **custom tags** for your own categories — just type any name
- Limits: **5 tags** per command, **15 characters** per tag

---

## Chain Commands

Chain commands let you store **multi-step procedures as a single entry** — critical for incident response, deployment workflows, and diagnostic routines where steps must be executed in the correct order.

### Creating a Chain

1. Right-click a folder → **Add Chain**, or
2. Right-click an existing command → change its icon to **⛓️**

### The Chain Editor

The editor provides:
- **Connector selector** — define how steps are linked:
  - `&&` — run next only if previous succeeds
  - `||` — run next only if previous fails
  - `;` — run next regardless of result
  - `|` — pipe output to next command
- **Numbered step list** — one input per command
- **Reorder controls** — move steps up/down
- **Live preview** — see the final concatenated command before saving

### Example

A chain with `&&` connector and 3 steps:
```
cd /var/log && grep -r "ERROR" app.log && tail -50 app.log
```

### Efficiency Tips
- Press **Enter** in an empty step field to add a new step
- Press **Backspace** in an empty step to remove it (minimum 1 step)
- Converting a regular command to a chain automatically uses the existing command as the first step

---

## Dynamic Variables

Dynamic variables turn a single command into a **reusable template** — fill in values at copy time instead of editing the command every time a hostname, instance ID, or environment changes. This is especially powerful for teams managing multiple servers, clusters, or customer environments.

### Syntax

Use `${variableName}` in your command:

```
ssh ${username}@${hostname}
kubectl logs ${pod_name} -n ${namespace}
aws ec2 describe-instances --instance-ids ${instance_id}
```

### How It Works

1. Save a command with `${variables}`
2. When you click to copy, a modal appears with input fields for each variable
3. Fill in the values (e.g., `username` = "admin", `hostname` = "prod-server-01")
4. Click **Copy** — the resolved command goes to your clipboard:
   ```
   ssh admin@prod-server-01
   ```

One template, unlimited use cases. A single `ssh ${username}@${hostname}` entry replaces dozens of duplicated commands — one per server, per environment, per customer.

---

## Favorites (Pinned Commands)

Pin your highest-frequency commands to the **⭐ Favorites** section for immediate access without scrolling or searching.

- **Pin:** Right-click a command → **📌 Pin**
- **Unpin:** Right-click a pinned command → **⭐ Unpin**
- **Limit:** Up to 10 favorites
- Favorites display with numbered badges (1-10) for quick visual identification

---

## Keyboard Shortcuts

CmdVault supports full keyboard navigation. Open the reference anytime from the overflow menu → **Keyboard Shortcuts**.

### Navigation
| Shortcut | Action |
|----------|--------|
| `↑` / `↓` | Navigate between items |
| `→` | Expand folder / Enter children |
| `←` | Collapse folder / Go to parent |
| `Shift + ↑/↓` | Range select multiple items |

### Actions
| Shortcut | Action |
|----------|--------|
| `Enter` | Copy command / Toggle folder |
| `F2` | Edit / Rename selected item |
| `Delete` | Delete selected item(s) |
| `Esc` | Clear selection |

### General
| Shortcut | Action |
|----------|--------|
| `Ctrl + Space` | Focus search box |
| `Ctrl + A` | Select all items |
| `Ctrl + Z` | Undo |
| `Ctrl + Y` | Redo |

Keyboard-driven workflows significantly reduce the time between finding a command and using it.

---

## Themes

CmdVault includes **9 themes** to match your visual preference and reduce eye strain during long sessions. Change anytime from **Settings → Theme**.

| Theme | Style |
|-------|-------|
| ♾️ **Cosmic** | Dark GitHub-like (default) |
| 🌑 **Shadow** | Dark Material Design |
| ☀️ **Light** | Clean light mode |
| 👾 **Cyber** | Neon green terminal aesthetic |
| 🌊 **Ocean** | Blue and cyan palette |
| 🟠 **Teradata** | Orange-accented brand theme |
| 🌎 **Turquoise** | Teal/turquoise tones |
| 🌒 **Moonlight** | Catppuccin color scheme |
| ❄️ **Nord** | Arctic Nord palette |

Your selection persists across sessions automatically.

---

## Cloud Sync (GitHub Gist)

Keep your command library backed up and synchronized across machines using **GitHub Gist**. Whether you work from multiple workstations or need a reliable backup for your team's operational commands, cloud sync ensures your library is always available.

### Setup

1. Go to [GitHub Settings → Developer Settings → Personal Access Tokens](https://github.com/settings/tokens)
2. Create a token with the **`gist`** scope
3. Open CmdVault **Settings** → paste your token → **Save**

### Syncing

- **Push (⬆️)** — upload your local commands to GitHub Gist
- **Fetch (⬇️)** — download your cloud commands to local

### Conflict Resolution

When both local and cloud data have changed since the last sync, CmdVault detects the conflict and offers three resolution options:

| Option | Behavior |
|--------|----------|
| **Use Cloud Data** | Replaces local with the cloud version |
| **Use Local Data** | Pushes local version to cloud |
| **Smart Merge** (recommended) | Combines both datasets — local data takes precedence on conflicts |

### Version History

CmdVault automatically maintains the **last 3 versioned backups** in your Gist. Restore any previous version from the Settings panel if needed.

---

## Import & Export

### Local Backup (💾)

Exports your entire command tree as a `.json` file. CmdVault runs a **secret scan** before exporting and warns you if any API keys or tokens are detected in your data.

### Local Import (📂)

Import a previously exported `.json` file. This **replaces** your current data entirely — useful for restoring from backup or migrating to a new machine.

### Folder Merge (📥)

Import a `.json` file **without overwriting** existing data. The imported commands are wrapped in a new folder and added alongside your current library.

This is the **recommended workflow for team collaboration**: one team member exports their folder of AWS commands, another exports Kubernetes commands, and everyone merges them into their own CmdVault — building a shared operational knowledge base without losing individual data.

### Export Single Folder (💾)

Right-click any folder → **Export Folder** to export just that folder and its contents. This makes it easy to share platform-specific or project-specific command sets with teammates.

---

## Clipboard Auto-Clear

A security feature designed to **prevent accidental command execution** — automatically clears your clipboard after a configurable timeout so a previously copied command doesn't get pasted unintentionally.

### Setup

1. Open **Settings**
2. Enable **Clipboard Auto-Clear**
3. Set your timeout (10–300 seconds, default 60s)

### How It Works

- Copy a command → a banner appears at the top with a visual countdown bar
- When the timer expires, your clipboard is cleared automatically
- Works even when the sidepanel is not in focus (uses Chrome's Offscreen API)
- **Clear Now** button for immediate manual clearing
- **Dismiss** button hides the banner while the timer continues running

This is especially valuable when working across production and non-production environments where an accidental paste can have real consequences.

---

## Help Pages

Attach **runbook documentation, context, or instructions** directly to any command. Right-click a command → **📖 Help Page**.

### Features
- **View Mode** — read-only reference
- **Edit Mode** — toggle with the ✏️ button
- **Syntax Highlighting** — automatic coloring for Shell, Python, SQL, and Markdown
- **Zoom** — Ctrl++ / Ctrl+- to adjust text size
- **Copy All** — one-click to copy the entire help page content
- **Word Wrap** — toggle on/off for long lines

Help pages keep command context and documentation together — reducing context-switching between the command library and external wikis. New team members can read the attached notes to understand *why* a command exists, not just *what* it does.

---

## Secret Detection

Before exporting or syncing to the cloud, CmdVault automatically scans your commands for **potential secrets and credentials**. If anything is detected, a warning is displayed with the specific items found.

### Detected Patterns

- GitHub Personal Access Tokens (`ghp_`, `github_pat_`)
- AWS Access Keys
- OpenAI / Stripe API Keys (`sk-...`)
- Slack Tokens (`xox...`)
- Bearer Tokens
- RSA Private Keys
- Google API Keys
- Other common credential formats

The scan is a **warning, not a block** — you can still proceed after reviewing. It serves as a safeguard against accidentally sharing sensitive data.

---

## Settings

Access from the overflow menu (⋮) → **Settings**.

| Setting | Description |
|---------|-------------|
| **Username** | Display name shown in the title bar |
| **Theme** | Choose from 9 visual themes |
| **GitHub Token** | For cloud sync functionality |
| **Push / Fetch** | Cloud sync controls |
| **Clipboard Auto-Clear** | Toggle + timeout configuration |
| **Local Backup** | Export all commands to JSON |
| **Local Import** | Replace data from a JSON file |
| **Folder Merge** | Import without overwriting |
| **Check for Updates** | Check for new CmdVault versions |
| **Factory Reset** | Delete all data (requires double confirmation) |

---

## Productivity Tips

### For Individual Workflow
1. **Ctrl+Space → type → Enter** — this three-keystroke workflow finds and copies any command in seconds, regardless of library size
2. **Pin your top 10** daily-use commands to Favorites — zero scrolling, immediate access
3. **Use dynamic variables** (`${hostname}`) to turn frequently-used commands into reusable templates — one entry covers every server and environment
4. **Enable Clipboard Auto-Clear** when working in production — it prevents stale commands from being accidentally pasted in the wrong terminal

### For Team Collaboration
5. **Standardize folder structure** across the team (e.g., by platform → environment → service) so exported command sets merge cleanly
6. **Use Folder Merge import** to share command sets — one person exports their AWS folder, another exports Kubernetes, everyone merges without data loss
7. **Attach Help Pages** to complex commands — new team members onboard faster when they can read the context behind each command
8. **Tag commands consistently** (`#aws`, `#precaution`, `#procedure`) — the team benefits from shared filtering conventions

### For Safety & Operations
9. **Color-code folders by environment** — red for production, green for dev, blue for staging — to add a visual safety layer across cloud and on-prem systems
10. **Tag dangerous commands with `#precaution`** so they stand out with a red warning badge before anyone copies them
11. **Chain commands for incident response** — store the full diagnostic or recovery procedure as one entry so nothing gets skipped under pressure
12. **Use masked commands** (🔑 icon) for credentials and tokens — content stays hidden until explicitly revealed

---

*Built by Ivan Cedeno @ Teradata — 2026*
