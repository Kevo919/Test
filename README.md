# Pixel Monsters

A small browser game inspired by classic Game Boy-era monster RPGs.

## Features
- Tile-based overworld exploration
- Random encounters in tall grass
- Turn-based battles with selectable moves
- Capture system with limited monster balls
- Party switching and automatic faint handling
- Gym leader boss fight and badge progression
- Healer NPC in town

---

## 1) Requirements
You only need:
- Python 3 (for a local static web server)
- A modern desktop browser (Chrome, Edge, Firefox, Safari)

Check Python:

```bash
python3 --version
```

---

## 2) Run the game locally (step by step)
From the repository root:

```bash
cd /workspace/Test
python3 -m http.server 8000
```

You should see output similar to:

```text
Serving HTTP on 0.0.0.0 port 8000 ...
```

Open the game in your browser:
- <http://localhost:8000>
- If that does not load, try <http://127.0.0.1:8000>

To stop the server, return to the terminal and press `Ctrl + C`.

---

## 3) Controls
### Overworld
- Move: Arrow keys or `W`, `A`, `S`, `D`
- Heal in town: `Space` while near the healer area (top-left town block)

### Battle
Use on-screen buttons:
- **ATTACK**: choose one of your monster's moves
- **THROW BALL**: attempt to capture wild monsters
- **SWITCH**: swap active monster in your party
- **RUN**: attempt escape from wild encounters

---

## 4) How to play (quick objective guide)
1. Start in town (upper-left section of map).
2. Walk into dark-green tall grass to trigger wild encounters.
3. Battle wild monsters to level up and/or capture them.
4. Build your party (up to 6 monsters).
5. Travel to the purple gym tile near the lower-right area.
6. Defeat the gym leader to earn the badge.
7. Return to town healer whenever your team is low HP.

---

## 5) Detailed test checklist (manual QA)
Use this exactly if you want to validate that gameplay is working end-to-end.

1. **Load check**
   - Start server with `python3 -m http.server 8000`.
   - Open `http://localhost:8000`.
   - Confirm you can see the HUD, map canvas, and controls text.

2. **Movement check**
   - Use arrow keys or WASD.
   - Confirm player cannot walk through water or border trees.

3. **Encounter check**
   - Walk repeatedly in tall grass.
   - Confirm battle panel appears with wild monster name/HP.

4. **Attack flow check**
   - Click `ATTACK`, then click a move.
   - Confirm enemy HP decreases or miss text is shown.
   - Confirm enemy takes a turn after your action.

5. **Capture flow check**
   - In a wild battle, click `THROW BALL`.
   - Confirm ball counter decreases.
   - Confirm either capture success dialog or break-free + enemy turn.

6. **Switch flow check**
   - Click `SWITCH`.
   - Select another healthy party monster.
   - Confirm active monster updates and enemy takes a turn.

7. **Gym flow check**
   - Walk to purple gym tile (lower-right area).
   - Confirm trainer battle starts.
   - Win the battle and confirm badge count increases.

8. **Healing flow check**
   - Return to town.
   - Press `Space` near healer area.
   - Confirm dialog appears and HP is restored.

---

## 6) Troubleshooting
### Page doesn't load
- Make sure the server is running in this repository directory.
- Confirm URL is exactly `http://localhost:8000`.
- Try `http://127.0.0.1:8000`.

### Keyboard input not responding
- Click once on the browser page/canvas to focus it.
- Disable any extension that captures keyboard shortcuts.

### Port 8000 is busy
Run on another port:

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080>.
