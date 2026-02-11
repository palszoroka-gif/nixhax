// Kingdom Wars AI Bot - Node.js Implementation
// ---------------------------------------------
// Simple strategic bot with basic economy + survival logic
// Uses Express HTTP server

const express = require("express");

const app = express();
app.use(express.json());

// ==============================
// REQUIRED LOGGING (EVERY REQUEST)
// ==============================
app.use((req, res, next) => {
  console.log("[KW-BOT] Mega ogudor");
  next();
});

// ==============================
// CONSTANTS
// ==============================
const TEAM_NAME = "Mega ogudor";
const STRATEGY = "AI-trapped-strategy";
const VERSION = "1.0";

// ==============================
// HELPERS
// ==============================
function getUpgradeCost(level) {
  return Math.round(50 * Math.pow(1.75, level - 1));
}

function getResourcePerTurn(level) {
  return Math.round(20 * Math.pow(1.5, level - 1));
}

function sortEnemiesByThreat(enemies) {
  // prioritize high level + low hp (good kill opportunity)
  return [...enemies].sort((a, b) => {
    const scoreA = a.level * 2 - a.hp * 0.01;
    const scoreB = b.level * 2 - b.hp * 0.01;
    return scoreB - scoreA;
  });
}

function sortEnemiesByWeakness(enemies) {
  return [...enemies].sort((a, b) => a.hp + a.armor - (b.hp + b.armor));
}

function totalIncomingDamage(previousAttacks, myId) {
  let dmg = 0;
  for (const atk of previousAttacks || []) {
    if (atk.action?.targetId === myId) {
      dmg += atk.action.troopCount || 0;
    }
  }
  return dmg;
}

// ==============================
// HEALTH CHECK
// ==============================
app.get("/healthz", (req, res) => {
  res.json({ status: "OK" });
});

// ==============================
// BOT INFO
// ==============================
app.get("/info", (req, res) => {
  res.json({
    name: TEAM_NAME,
    strategy: STRATEGY,
    version: VERSION,
  });
});

// ==============================
// NEGOTIATION PHASE
// ==============================
app.post("/negotiate", (req, res) => {
  const body = req.body;
  const { playerTower, enemyTowers } = body;

  if (!enemyTowers || enemyTowers.length === 0) {
    return res.json([]);
  }

  // Prefer alliance with strongest enemy (reduce pressure)
  const strongest = [...enemyTowers].sort((a, b) => b.level - a.level)[0];

  // Attack weakest enemy
  const weakest = sortEnemiesByWeakness(enemyTowers)[0];

  if (!strongest) return res.json([]);

  const diplomacy = {
    allyId: strongest.playerId,
  };

  if (weakest && weakest.playerId !== strongest.playerId) {
    diplomacy.attackTargetId = weakest.playerId;
  }

  res.json([diplomacy]);
});

// ==============================
// COMBAT PHASE
// ==============================
app.post("/combat", (req, res) => {
  const body = req.body;
  const { playerTower, enemyTowers, previousAttacks, turn } = body;

  if (!playerTower) return res.json([]);

  const myId = playerTower.playerId;
  let resources = playerTower.resources;
  const actions = [];

  const incoming = totalIncomingDamage(previousAttacks, myId);

  // =====================================
  // 1. DEFENSE — build armor if threatened
  // =====================================
  if (incoming > 0) {
    const armorToBuild = Math.min(incoming, Math.floor(resources * 0.4));
    if (armorToBuild > 0) {
      actions.push({ type: "armor", amount: armorToBuild });
      resources -= armorToBuild;
    }
  }

  // =====================================
  // 2. ECONOMY — upgrade early game
  // =====================================
  const upgradeCost = getUpgradeCost(playerTower.level);

  const shouldUpgrade =
    playerTower.level < 5 &&
    resources >= upgradeCost &&
    (turn <= 20 || playerTower.level <= 2);

  if (shouldUpgrade) {
    actions.push({ type: "upgrade" });
    resources -= upgradeCost;
  }

  // =====================================
  // 3. OFFENSE — attack weakest or most dangerous
  // =====================================
  if (enemyTowers && enemyTowers.length > 0 && resources > 0) {
    const targets = sortEnemiesByWeakness(enemyTowers);

    for (const enemy of targets) {
      if (resources <= 0) break;

      const effectiveHp = enemy.hp + enemy.armor;

      // Try finishing blow
      if (resources >= effectiveHp && effectiveHp <= resources * 0.7) {
        actions.push({
          type: "attack",
          targetId: enemy.playerId,
          troopCount: effectiveHp,
        });
        resources -= effectiveHp;
      }
    }

    // If still resources left — pressure strongest
    if (resources > 10) {
      const threats = sortEnemiesByThreat(enemyTowers);
      const primary = threats[0];

      const strike = Math.floor(resources * 0.6);
      if (primary && strike > 0) {
        actions.push({
          type: "attack",
          targetId: primary.playerId,
          troopCount: strike,
        });
        resources -= strike;
      }
    }
  }

  res.json(actions);
});

// ==============================
// START SERVER
// ==============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Kingdom Wars bot running on port ${PORT}`);
});
