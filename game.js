const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const tileSize = 32;
const mapCols = 20;
const mapRows = 15;

const tiles = {
  grass: "#3f9f4d",
  tallGrass: "#2b7d2e",
  path: "#d7b98f",
  water: "#3b82f6",
  town: "#9ca3af",
  gym: "#7c3aed",
  tree: "#14532d"
};

const dex = [
  {
    name: "Sproutle",
    color: "#10b981",
    maxHp: 22,
    attack: 7,
    moves: [
      { name: "Leaf Tap", power: 7, accuracy: 0.95 },
      { name: "Vine Snap", power: 10, accuracy: 0.85 }
    ]
  },
  {
    name: "Embercub",
    color: "#f97316",
    maxHp: 20,
    attack: 8,
    moves: [
      { name: "Spark Bite", power: 8, accuracy: 0.92 },
      { name: "Flare Dash", power: 11, accuracy: 0.8 }
    ]
  },
  {
    name: "Bubblit",
    color: "#38bdf8",
    maxHp: 23,
    attack: 6,
    moves: [
      { name: "Bubble Pop", power: 7, accuracy: 0.97 },
      { name: "Wave Crash", power: 9, accuracy: 0.88 }
    ]
  },
  {
    name: "Voltkit",
    color: "#fde047",
    maxHp: 19,
    attack: 9,
    moves: [
      { name: "Static Jab", power: 8, accuracy: 0.93 },
      { name: "Thunder Pounce", power: 12, accuracy: 0.78 }
    ]
  }
];

const map = buildMap();
const state = {
  mode: "overworld",
  player: {
    x: 2,
    y: 2,
    balls: 6,
    badges: 0,
    party: [spawnMonster("Sproutle", 5)],
    activeIdx: 0
  },
  battle: null,
  lockInput: false
};

const dom = {
  areaName: document.getElementById("areaName"),
  partyStatus: document.getElementById("partyStatus"),
  badges: document.getElementById("badges"),
  balls: document.getElementById("balls"),
  battlePanel: document.getElementById("battlePanel"),
  battleText: document.getElementById("battleText"),
  actions: document.getElementById("actions"),
  moves: document.getElementById("moves"),
  switchMenu: document.getElementById("switchMenu"),
  enemyName: document.getElementById("enemyName"),
  playerName: document.getElementById("playerName"),
  enemyHp: document.getElementById("enemyHp"),
  playerHp: document.getElementById("playerHp"),
  playerHpText: document.getElementById("playerHpText"),
  enemySprite: document.getElementById("enemySprite"),
  playerSprite: document.getElementById("playerSprite"),
  dialog: document.getElementById("dialog"),
  dialogText: document.getElementById("dialogText"),
  dialogBtn: document.getElementById("dialogBtn")
};

function buildMap() {
  const grid = Array.from({ length: mapRows }, () => Array.from({ length: mapCols }, () => "grass"));

  for (let y = 0; y < mapRows; y++) {
    for (let x = 0; x < mapCols; x++) {
      if (y === 0 || x === 0 || y === mapRows - 1 || x === mapCols - 1) grid[y][x] = "tree";
      if (y > 4 && y < 10 && x > 9 && x < 14) grid[y][x] = "water";
      if (y > 1 && y < 13 && x > 3 && x < 7) grid[y][x] = "tallGrass";
      if (x === 8 || y === 7) grid[y][x] = "path";
    }
  }

  grid[2][2] = "town";
  grid[2][3] = "town";
  grid[3][2] = "town";
  grid[3][3] = "town";
  grid[11][16] = "gym";
  grid[11][15] = "path";
  grid[10][16] = "path";

  return grid;
}

function spawnMonster(name, level) {
  const base = dex.find((m) => m.name === name);
  if (!base) {
    throw new Error(`Unknown monster: ${name}`);
  }

  const copyMoves = base.moves.map((move) => ({ ...move }));

  return {
    ...base,
    moves: copyMoves,
    level,
    hp: base.maxHp + (level - 1) * 2,
    maxHp: base.maxHp + (level - 1) * 2,
    attack: base.attack + Math.floor((level - 1) / 2),
    exp: 0
  };
}

function randomWild(levelFloor = 2, levelCeil = 6) {
  const base = dex[Math.floor(Math.random() * dex.length)];
  const lv = levelFloor + Math.floor(Math.random() * (levelCeil - levelFloor + 1));
  return spawnMonster(base.name, lv);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < mapRows; y++) {
    for (let x = 0; x < mapCols; x++) {
      ctx.fillStyle = tiles[map[y][x]];
      ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
    }
  }

  // NPC healer
  ctx.fillStyle = "#fca5a5";
  ctx.fillRect(3 * tileSize + 8, 3 * tileSize + 8, 16, 16);

  // Player
  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(state.player.x * tileSize + 6, state.player.y * tileSize + 6, 20, 20);

  // Gym leader icon
  ctx.fillStyle = "#f59e0b";
  ctx.fillRect(16 * tileSize + 8, 11 * tileSize + 8, 16, 16);
}

function updateHud() {
  const active = state.player.party[state.player.activeIdx];
  dom.partyStatus.textContent = `${active.name} Lv${active.level} HP ${active.hp}/${active.maxHp}`;
  dom.badges.textContent = String(state.player.badges);
  dom.balls.textContent = String(state.player.balls);

  const tile = map[state.player.y][state.player.x];
  dom.areaName.textContent = tile === "town" ? "Pallet Meadow Town" : tile === "gym" ? "Crystal Gym" : "Route 1";
}

function canMoveTo(x, y) {
  if (x < 0 || y < 0 || x >= mapCols || y >= mapRows) return false;
  const tile = map[y][x];
  return tile !== "water" && tile !== "tree";
}

function attemptMove(dx, dy) {
  if (state.mode !== "overworld" || state.lockInput) return;
  const nx = state.player.x + dx;
  const ny = state.player.y + dy;
  if (!canMoveTo(nx, ny)) return;

  state.player.x = nx;
  state.player.y = ny;
  draw();
  updateHud();

  const tile = map[ny][nx];
  if (tile === "tallGrass" && Math.random() < 0.22) {
    startWildBattle();
  }

  if (nx === 16 && ny === 11) {
    startGymBattle();
  }
}

function startWildBattle() {
  state.mode = "battle";
  state.battle = {
    enemy: randomWild(),
    wild: true
  };
  renderBattle("A wild monster appeared!");
}

function startGymBattle() {
  if (state.player.badges > 0) {
    showDialog("Gym Leader: You already won! Train more and return later.");
    return;
  }

  state.mode = "battle";
  state.battle = {
    enemy: spawnMonster("Voltkit", 8),
    wild: false
  };
  renderBattle("Gym Leader challenges you with VOLTKIT!");
}

function renderBattle(text) {
  const active = state.player.party[state.player.activeIdx];
  const enemy = state.battle.enemy;

  dom.battlePanel.classList.remove("hidden");
  dom.moves.classList.add("hidden");
  dom.switchMenu.classList.add("hidden");
  dom.actions.classList.remove("hidden");
  dom.battleText.textContent = text;

  dom.enemyName.textContent = `${state.battle.wild ? "Wild" : "Leader"} ${enemy.name} Lv${enemy.level}`;
  dom.playerName.textContent = `${active.name} Lv${active.level}`;
  dom.enemyHp.style.width = `${(enemy.hp / enemy.maxHp) * 100}%`;
  dom.playerHp.style.width = `${(active.hp / active.maxHp) * 100}%`;
  dom.playerHpText.textContent = `${active.hp}/${active.maxHp}`;
  dom.enemySprite.style.background = `linear-gradient(45deg, ${enemy.color}, #111827)`;
  dom.playerSprite.style.background = `linear-gradient(45deg, ${active.color}, #111827)`;
}

function gainExp(monster, amount) {
  monster.exp += amount;
  const needed = monster.level * 8;
  if (monster.exp >= needed) {
    monster.exp -= needed;
    monster.level += 1;
    monster.maxHp += 3;
    monster.attack += 1;
    monster.hp = monster.maxHp;
    dom.battleText.textContent = `${monster.name} grew to Lv${monster.level}!`;
  }
}

function damage(attacker, defender, move) {
  if (Math.random() > move.accuracy) return { hit: false, dmg: 0 };
  const variance = 0.85 + Math.random() * 0.3;
  const dmg = Math.max(1, Math.floor((attacker.attack + move.power / 2) * variance - defender.level / 2));
  defender.hp = Math.max(0, defender.hp - dmg);
  return { hit: true, dmg };
}

function enemyTurn() {
  if (state.mode !== "battle") return;
  const active = state.player.party[state.player.activeIdx];
  const enemy = state.battle.enemy;
  const move = enemy.moves[Math.floor(Math.random() * enemy.moves.length)];
  const res = damage(enemy, active, move);
  dom.battleText.textContent = res.hit
    ? `${enemy.name} used ${move.name}! ${res.dmg} damage.`
    : `${enemy.name}'s ${move.name} missed!`;

  if (active.hp <= 0) {
    const viable = state.player.party.findIndex((m) => m.hp > 0);
    if (viable === -1) {
      state.mode = "overworld";
      state.battle = null;
      dom.battlePanel.classList.add("hidden");
      showDialog("You blacked out! Returned to town and healed.");
      state.player.x = 2;
      state.player.y = 2;
      state.player.party.forEach((m) => (m.hp = m.maxHp));
    } else {
      state.player.activeIdx = viable;
      renderBattle(`${active.name} fainted! Go ${state.player.party[viable].name}!`);
      updateHud();
      return;
    }
  }

  renderBattle(dom.battleText.textContent);
  updateHud();
}

function winBattle() {
  const enemy = state.battle.enemy;
  const active = state.player.party[state.player.activeIdx];
  gainExp(active, enemy.level * 3);

  if (!state.battle.wild) {
    state.player.badges += 1;
    showDialog("You defeated the Gym Leader and earned the Spark Badge!");
  }

  state.mode = "overworld";
  state.battle = null;
  dom.battlePanel.classList.add("hidden");
  updateHud();
  draw();
}

function handleBattleAction(action) {
  if (state.mode !== "battle" || state.lockInput) return;
  const active = state.player.party[state.player.activeIdx];
  const enemy = state.battle.enemy;

  if (action === "attack") {
    dom.actions.classList.add("hidden");
    dom.moves.classList.remove("hidden");
    dom.moves.innerHTML = "";
    active.moves.forEach((move, idx) => {
      const btn = document.createElement("button");
      btn.textContent = `${move.name} (${Math.floor(move.accuracy * 100)}%)`;
      btn.onclick = () => {
        state.lockInput = true;
        const res = damage(active, enemy, move);
        dom.battleText.textContent = res.hit
          ? `${active.name} used ${move.name}! ${res.dmg} damage.`
          : `${active.name}'s ${move.name} missed!`;
        dom.moves.classList.add("hidden");
        dom.actions.classList.remove("hidden");

        if (enemy.hp <= 0) {
          dom.battleText.textContent = `${enemy.name} fainted!`;
          renderBattle(dom.battleText.textContent);
          setTimeout(() => {
            winBattle();
            state.lockInput = false;
          }, 650);
          return;
        }

        renderBattle(dom.battleText.textContent);
        setTimeout(() => {
          enemyTurn();
          state.lockInput = false;
        }, 650);
      };
      dom.moves.appendChild(btn);
    });

    const cancel = document.createElement("button");
    cancel.textContent = "BACK";
    cancel.onclick = () => {
      dom.moves.classList.add("hidden");
      dom.actions.classList.remove("hidden");
    };
    dom.moves.appendChild(cancel);
    return;
  }

  if (action === "item") {
    if (!state.battle.wild) {
      renderBattle("You cannot capture a trainer's monster!");
      return;
    }
    if (state.player.balls <= 0) {
      renderBattle("No balls left!");
      return;
    }

    state.player.balls -= 1;
    state.lockInput = true;
    const hpRatio = enemy.hp / enemy.maxHp;
    const chance = 0.2 + (1 - hpRatio) * 0.55;
    if (Math.random() < chance && state.player.party.length < 6) {
      state.player.party.push(enemy);
      state.mode = "overworld";
      state.battle = null;
      dom.battlePanel.classList.add("hidden");
      showDialog(`Gotcha! ${enemy.name} was captured!`);
      updateHud();
      return;
    }

    renderBattle("The monster broke free!");
    updateHud();
    setTimeout(() => {
      enemyTurn();
      state.lockInput = false;
    }, 650);
    return;
  }

  if (action === "switch") {
    dom.actions.classList.add("hidden");
    dom.switchMenu.classList.remove("hidden");
    dom.switchMenu.innerHTML = "";
    state.player.party.forEach((m, idx) => {
      const btn = document.createElement("button");
      btn.textContent = `${idx === state.player.activeIdx ? "★ " : ""}${m.name} Lv${m.level} HP ${m.hp}/${m.maxHp}`;
      btn.disabled = m.hp <= 0;
      btn.onclick = () => {
        state.lockInput = true;
        state.player.activeIdx = idx;
        dom.switchMenu.classList.add("hidden");
        dom.actions.classList.remove("hidden");
        renderBattle(`Go ${m.name}!`);
        updateHud();
        setTimeout(() => {
          enemyTurn();
          state.lockInput = false;
        }, 600);
      };
      dom.switchMenu.appendChild(btn);
    });
    const cancel = document.createElement("button");
    cancel.textContent = "BACK";
    cancel.onclick = () => {
      dom.switchMenu.classList.add("hidden");
      dom.actions.classList.remove("hidden");
    };
    dom.switchMenu.appendChild(cancel);
    return;
  }

  if (action === "run") {
    if (!state.battle.wild) {
      renderBattle("Can't run from a Gym battle!");
      return;
    }
    if (Math.random() < 0.85) {
      state.mode = "overworld";
      state.battle = null;
      dom.battlePanel.classList.add("hidden");
      updateHud();
      return;
    }
    state.lockInput = true;
    renderBattle("Couldn't escape!");
    setTimeout(() => {
      enemyTurn();
      state.lockInput = false;
    }, 650);
  }
}

function showDialog(text) {
  state.lockInput = true;
  dom.dialogText.textContent = text;
  dom.dialog.classList.remove("hidden");
}

dom.dialogBtn.onclick = () => {
  dom.dialog.classList.add("hidden");
  state.lockInput = false;
  draw();
  updateHud();
};

document.querySelectorAll("#actions button").forEach((btn) => {
  btn.addEventListener("click", () => handleBattleAction(btn.dataset.action));
});

window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (["arrowup", "w"].includes(key)) attemptMove(0, -1);
  if (["arrowdown", "s"].includes(key)) attemptMove(0, 1);
  if (["arrowleft", "a"].includes(key)) attemptMove(-1, 0);
  if (["arrowright", "d"].includes(key)) attemptMove(1, 0);

  if ((key === " " || key === "space" || key === "spacebar") && state.mode === "overworld") {
    if (state.player.x >= 2 && state.player.x <= 4 && state.player.y >= 2 && state.player.y <= 4) {
      state.player.party.forEach((m) => (m.hp = m.maxHp));
      showDialog("Town Healer restored your party!");
      updateHud();
    }
  }
});

draw();
updateHud();
