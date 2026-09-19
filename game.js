(function () {
  const monsterState = {
    model: null,
    vision: null,
    eyeLight: null,
    waypoints: [],
    waypointIndex: 0,
    path: [],
    pathIndex: 0,
    repathAt: 0,
    mode: 'stopped',
    running: false,
    gameOver: false,
    lastTime: performance.now()
  };

  function cellToWorld(x, z, y = 0.15) {
    return new THREE.Vector3(x * UNIT_SIZE, y, z * UNIT_SIZE);
  }

  function worldToCell(position) {
    return {
      x: Math.floor((position.x + UNIT_SIZE / 2) / UNIT_SIZE),
      z: Math.floor((position.z + UNIT_SIZE / 2) / UNIT_SIZE)
    };
  }

  function isWalkable(x, z) {
    return z >= 0 && z < map.length && x >= 0 && x < map[z].length && map[z][x] === 0;
  }

  function canMonsterOccupy(position) {
    const radius = 0.65;
    const offsets = [[-radius, -radius], [radius, -radius], [-radius, radius], [radius, radius]];
    return offsets.every(([x, z]) => isWalkable(...Object.values(worldToCell({ x: position.x + x, z: position.z + z }))));
  }

  function hasLineOfSight(from, to) {
    const distance = from.distanceTo(to);
    const steps = Math.ceil(distance / (UNIT_SIZE * 0.25));
    for (let step = 1; step < steps; step++) {
      const point = from.clone().lerp(to, step / steps);
      const cell = worldToCell(point);
      if (!isWalkable(cell.x, cell.z)) return false;
    }
    return true;
  }

  function findPath(start, goal) {
    const startCell = worldToCell(start);
    const goalCell = worldToCell(goal);
    if (!isWalkable(startCell.x, startCell.z) || !isWalkable(goalCell.x, goalCell.z)) return [];
    const queue = [startCell];
    const cameFrom = new Map();
    const key = (cell) => `${cell.x},${cell.z}`;
    cameFrom.set(key(startCell), null);
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    while (queue.length) {
      const current = queue.shift();
      if (current.x === goalCell.x && current.z === goalCell.z) break;
      directions.forEach(([dx, dz]) => {
        const next = { x: current.x + dx, z: current.z + dz };
        const nextKey = key(next);
        if (isWalkable(next.x, next.z) && !cameFrom.has(nextKey)) {
          cameFrom.set(nextKey, current);
          queue.push(next);
        }
      });
    }

    const path = [];
    let cursor = goalCell;
    while (cursor && cameFrom.has(key(cursor))) {
      path.unshift(cellToWorld(cursor.x, cursor.z));
      cursor = cameFrom.get(key(cursor));
    }
    return path;
  }

  function createVisionCone() {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(2.1, 5.5, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff2638, transparent: true, opacity: 0.11, depthWrite: false, side: THREE.DoubleSide })
    );
    cone.rotation.x = -Math.PI / 2;
    cone.position.set(0, 0.85, -2.2);
    return cone;
  }

  function createMonster() {
    if (monsterState.model || !scene) return;
    const model = createMinecraftModel(0x17151a);
    model.scale.set(1.2, 1.65, 1.2);
    model.position.copy(cellToWorld(24, 24));
    model.userData.animation.phase = 0;

    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff2038 });
    const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.03), eyeMaterial);
    const rightEye = leftEye.clone();
    leftEye.position.set(-0.09, 1.34, -0.205);
    rightEye.position.set(0.09, 1.34, -0.205);
    model.add(leftEye, rightEye);

    const vision = createVisionCone();
    model.add(vision);
    const eyeLight = new THREE.PointLight(0xff1835, 0.7, 5);
    eyeLight.position.set(0, 1.25, -0.35);
    model.add(eyeLight);

    monsterState.model = model;
    monsterState.vision = vision;
    monsterState.eyeLight = eyeLight;
    monsterState.waypoints = [[24, 24], [22, 20], [18, 22], [14, 24], [10, 22], [6, 18], [3, 14], [6, 10], [10, 6], [16, 8], [22, 12]]
      .filter(([x, z]) => isWalkable(x, z)).map(([x, z]) => cellToWorld(x, z));
    scene.add(model);
  }

  function moveMonsterToward(target, speed, delta) {
    const monster = monsterState.model;
    const direction = target.clone().sub(monster.position);
    direction.y = 0;
    if (direction.lengthSq() < 0.05) return true;
    direction.normalize();
    monster.rotation.y = Math.atan2(-direction.x, -direction.z);
    const step = direction.multiplyScalar(speed * delta);
    const nextX = monster.position.clone();
    nextX.x += step.x;
    if (canMonsterOccupy(nextX)) monster.position.x = nextX.x;
    const nextZ = monster.position.clone();
    nextZ.z += step.z;
    if (canMonsterOccupy(nextZ)) monster.position.z = nextZ.z;
    return false;
  }

  function updateMonsterAnimation(delta, moving, time) {
    const animation = monsterState.model.userData.animation;
    if (!animation) return;
    animation.phase += delta * (moving ? 8.5 : 1.5);
    const swing = moving ? Math.sin(animation.phase) * 0.85 : Math.sin(animation.phase) * 0.08;
    animation.leftArm.rotation.x = swing;
    animation.rightArm.rotation.x = -swing;
    animation.leftLeg.rotation.x = -swing * 0.7;
    animation.rightLeg.rotation.x = swing * 0.7;
    animation.leftArm.rotation.z = -0.12 + Math.sin(animation.phase * 0.5) * 0.08;
    animation.rightArm.rotation.z = 0.12 - Math.sin(animation.phase * 0.5) * 0.08;
    monsterState.model.position.y = 0.12 + Math.abs(Math.sin(animation.phase)) * (moving ? 0.05 : 0.015);
    monsterState.vision.material.opacity = 0.08 + Math.abs(Math.sin(time * 0.004)) * 0.05;
    monsterState.eyeLight.intensity = 0.55 + Math.abs(Math.sin(time * 0.006)) * 0.8;
  }

  function updateMonster(delta, time) {
    if (!monsterState.model || !monsterState.running || monsterState.gameOver) return;
    const monster = monsterState.model;
    const playerTarget = new THREE.Vector3(player.pos.x, 0.9, player.pos.z);
    const distance = monster.position.distanceTo(playerTarget);
    const facing = new THREE.Vector3(0, 0, -1).applyQuaternion(monster.quaternion);
    const toPlayer = playerTarget.clone().sub(monster.position).normalize();
    const seesPlayer = distance < UNIT_SIZE * 7 && facing.dot(toPlayer) > 0.2 && hasLineOfSight(monster.position, playerTarget);

    if (monsterState.mode === 'hunt' || seesPlayer) {
      if (time >= monsterState.repathAt) {
        monsterState.path = findPath(monster.position, player.pos);
        monsterState.pathIndex = 0;
        monsterState.repathAt = time + 600;
      }
    } else if (monsterState.mode === 'survive' || monsterState.mode === 'patrol' || monsterState.mode === 'escape' || monsterState.mode === 'blackout') {
      if (!monsterState.waypoints.length) return;
      if (time >= monsterState.repathAt || monsterState.pathIndex >= monsterState.path.length) {
        const waypoint = monsterState.waypoints[monsterState.waypointIndex % monsterState.waypoints.length];
        monsterState.path = findPath(monster.position, waypoint);
        monsterState.pathIndex = 0;
        monsterState.repathAt = time + 1000;
        if (!monsterState.path.length || monsterState.pathIndex >= monsterState.path.length) monsterState.waypointIndex++;
      }
    } else {
      updateMonsterAnimation(delta, false, time);
      return;
    }

    const nextPoint = monsterState.path[monsterState.pathIndex];
    if (nextPoint) {
      const arrived = moveMonsterToward(nextPoint, seesPlayer ? 4.2 : 2.0, delta);
      if (arrived) monsterState.pathIndex++;
    }
    updateMonsterAnimation(delta, true, time);

    if (distance < 1.7) {
      monsterState.gameOver = true;
      isPaused = true;
      gameActive = false;
      showMonsterStatus('CAUGHT', 'The watcher found you in the maze.', 'RESTART');
    }
  }

  function showMonsterStatus(title, text, buttonText) {
    let overlay = document.getElementById('monster-status-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'monster-status-overlay';
      overlay.innerHTML = '<div><h2></h2><p></p><button></button></div>';
      document.body.appendChild(overlay);
    }
    overlay.querySelector('h2').textContent = title;
    overlay.querySelector('p').textContent = text;
    const button = overlay.querySelector('button');
    button.textContent = buttonText;
    button.onclick = () => window.location.reload();
    overlay.classList.add('visible');
  }

  function setMinigameMode(mode) {
    if (!isAdmin) return;
    monsterState.mode = mode;
    monsterState.running = true;
    monsterState.gameOver = false;
    monsterState.repathAt = 0;
    if (socket) socket.emit('admin-minigame-state', { mode, running: true });
  }

  function stopMinigame() {
    if (!isAdmin) return;
    monsterState.running = false;
    monsterState.mode = 'stopped';
    monsterState.path = [];
    if (socket) socket.emit('admin-minigame-state', { mode: 'stopped', running: false });
  }

  function applyMinigameState(state) {
    monsterState.mode = state && state.mode ? state.mode : 'stopped';
    monsterState.running = !!(state && state.running);
    monsterState.gameOver = false;
    monsterState.repathAt = 0;
  }

  window.setMinigameMode = setMinigameMode;
  window.stopMinigame = stopMinigame;
  window.__monsterState = monsterState;

  const oldInit = window.init;
  if (typeof oldInit === 'function') {
    window.init = function () {
      oldInit();
      createMonster();
    };
  }

  const oldSocketInit = window.initMultiplayer;
  if (typeof oldSocketInit === 'function') {
    window.initMultiplayer = function () {
      oldSocketInit();
      if (socket) {
        socket.on('sync-minigame-state', applyMinigameState);
      }
    };
  }

  function frame() {
    const now = performance.now();
    const delta = Math.min((now - monsterState.lastTime) / 1000, 0.08);
    monsterState.lastTime = now;
    if (scene && !monsterState.model) createMonster();
    updateMonster(delta, now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
