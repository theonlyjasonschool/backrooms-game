(function () {
  const state = {
    ready: false,
    door: null,
    enemy: null,
    batteryObjects: [],
    collected: 0,
    total: 0,
    overlay: null,
    objective: null,
    gameEnded: false,
    lastMessage: ''
  };

  function ensureHud() {
    if (document.getElementById('game-objective')) return;
    const objective = document.createElement('div');
    objective.id = 'game-objective';
    objective.textContent = 'Objective: gather power cells';
    document.body.appendChild(objective);
    state.objective = objective;

    if (!document.getElementById('game-status-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'game-status-overlay';
      overlay.innerHTML = `
        <div id="game-status-card">
          <h2 id="game-status-title">System Status</h2>
          <p id="game-status-text">Power cells required.</p>
          <button id="game-status-button">Continue</button>
        </div>
      `;
      document.body.appendChild(overlay);
      state.overlay = overlay;
      document.getElementById('game-status-button').addEventListener('click', () => {
        state.overlay.classList.remove('visible');
        if (!state.gameEnded) {
          if (document.pointerLockElement !== renderer.domElement) {
            requestPointerLock();
          }
        }
      });
    }
  }

  function setStatus(title, message, buttonText = 'Continue') {
    ensureHud();
    const titleEl = document.getElementById('game-status-title');
    const textEl = document.getElementById('game-status-text');
    const buttonEl = document.getElementById('game-status-button');
    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = message;
    if (buttonEl) buttonEl.textContent = buttonText;
    state.overlay.classList.add('visible');
  }

  function refreshObjective() {
    if (!state.objective) return;
    const remaining = Math.max(0, state.total - state.collected);
    if (remaining > 0) {
      state.objective.textContent = `Objective: gather power cells (${state.collected}/${state.total})`;
    } else {
      state.objective.textContent = 'Objective: reach the exit door';
    }
  }

  function createExitDoor() {
    if (!scene || state.door) return;
    const doorMaterial = new THREE.MeshStandardMaterial({
      color: 0xc7c1a2,
      emissive: 0x2a2a2a,
      metalness: 0.14,
      roughness: 0.72
    });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.8, 0.25), doorMaterial);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.5, 0.08), new THREE.MeshStandardMaterial({
      color: 0x7d9aa7,
      emissive: 0x3f5b7c,
      emissiveIntensity: 0.8
    }));
    eye.position.z = 0.14;

    const group = new THREE.Group();
    group.add(frame);
    group.add(eye);
    group.position.set(24 * UNIT_SIZE, 1.4, 24 * UNIT_SIZE);
    group.rotation.y = Math.PI / 2;
    scene.add(group);
    state.door = group;
  }

  function setupEnemy() {
    if (!scene || state.enemy) return;
    const enemy = createMinecraftModel(0x1a1a1a);
    enemy.scale.set(1.1, 1.5, 1.1);
    enemy.position.set(3 * UNIT_SIZE, 0.1, 3 * UNIT_SIZE);
    scene.add(enemy);
    state.enemy = enemy;
  }

  function setupGameSystems() {
    if (state.ready) return;
    state.ready = true;
    ensureHud();
    createExitDoor();
    setupEnemy();
    state.total = collectibleItems.length || 0;
    state.batteryObjects = collectibleItems || [];
    refreshObjective();
  }

  function updateBatteryCollection() {
    if (!state.ready || !collectibleItems) return;
    let collectedThisFrame = 0;
    collectibleItems.forEach((item) => {
      if (!item || item.userData.collected) return;
      item.rotation.y += 0.04;
      item.position.y = item.userData.baseY + Math.sin(performance.now() * 0.003 + item.id) * 0.08;
      if (player && player.pos.distanceTo(item.position) < 1.4) {
        item.userData.collected = true;
        item.visible = false;
        collectedThisFrame++;
      }
    });

    if (collectedThisFrame > 0) {
      state.collected = collectibleItems.filter((item) => item && item.userData.collected).length;
      collectedItemCount = state.collected;
      document.getElementById('item-counter').innerText = `BATTERIES: ${state.collected}/${state.total}`;
      refreshObjective();

      if (state.collected >= state.total) {
        if (state.door) {
          const glass = state.door.children[1];
          if (glass && glass.material && glass.material.emissive) {
            glass.material.emissive.setHex(0x2aeaa0);
            glass.material.emissiveIntensity = 1.8;
          }
        }
        state.lastMessage = 'The exit is open. Reach the door.';
      }
    }
  }

  function updateEnemy(dt) {
    if (!state.enemy || !player || state.gameEnded) return;

    const enemy = state.enemy;
    const target = player.pos.clone();
    const current = enemy.position.clone();

    if (state.collected < state.total) {
      const driftX = 13 + Math.sin(performance.now() * 0.0007) * 7;
      const driftZ = 13 + Math.cos(performance.now() * 0.0008) * 8;
      const wanderTarget = new THREE.Vector3(driftX * UNIT_SIZE, 0.2, driftZ * UNIT_SIZE);
      const dir = wanderTarget.sub(current);
      dir.y = 0;
      if (dir.lengthSq() > 0.05) {
        dir.normalize();
        enemy.position.addScaledVector(dir, dt * 2.2);
      }
    } else {
      const dir = target.clone().sub(current);
      dir.y = 0;
      if (dir.lengthSq() > 0.01) {
        dir.normalize();
        enemy.position.addScaledVector(dir, dt * 3.7);
      }
      if (player.pos.distanceTo(enemy.position) < 1.6) {
        state.gameEnded = true;
        setStatus('You were found', 'The backrooms closed around you. Try again and keep moving in the dark.', 'Retry');
        isPaused = true;
        gameActive = false;
      }
    }

    const lookTarget = new THREE.Vector3(player.pos.x, 0.8, player.pos.z);
    enemy.lookAt(lookTarget);
  }

  function checkExitDoor() {
    if (!state.door || state.collected < state.total || state.gameEnded) return;
    const doorPos = state.door.position.clone();
    const distance = player.pos.distanceTo(doorPos);
    if (distance < 2.0) {
      state.gameEnded = true;
      setStatus('You escaped', 'You found the exit and survived the maze long enough to leave it behind.', 'Play Again');
      isPaused = true;
      gameActive = false;
    }
  }

  function runEngineUpdate() {
    if (!scene || !gameActive || isPaused) return;
    if (!state.ready) setupGameSystems();
    if (state.ready) {
      updateBatteryCollection();
      updateEnemy(1 / 60);
      checkExitDoor();
    }
  }

  const oldAnimate = window.animate;
  if (typeof oldAnimate === 'function') {
    window.animate = function () {
      oldAnimate();
      runEngineUpdate();
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensureHud();
    const statusButton = document.getElementById('game-status-button');
    if (statusButton) {
      statusButton.addEventListener('click', () => {
        if (state.gameEnded) {
          window.location.reload();
        }
      });
    }
  });

  window.__backroomsGame = state;
})();
