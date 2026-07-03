const MOVE_DEMO_BASIS_X = { x: 34, y: -16 };
const MOVE_DEMO_BASIS_Z = { x: 34, y: 16 };
const MOVE_DEMO_GRID_EXTENT = 5;
const MOVE_DEMO_SAMPLE_HALF = 0.5;
const MOVE_DEMO_DRAG_THRESHOLD_PX = 6;
const MOVE_DEMO_PICK_RADIUS_PX = 26;
const MOVE_DEMO_INITIAL_POINTS = [
  { x: -1.8, y: 0, z: -1.2 },
  { x: 0.6, y: 0, z: 0.8 },
  { x: 2.1, y: 0, z: -0.6 },
];

function drawGenericDemoSquare(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) { return; }
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#0f1b2d');
  bg.addColorStop(1, '#19314b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(132, 173, 232, 0.18)';
  ctx.lineWidth = 1;
  for (let x = 20; x < width; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 20; y < height; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const squareSize = Math.min(width, height) * 0.34;
  const x = (width - squareSize) / 2;
  const y = (height - squareSize) / 2;
  ctx.fillStyle = 'rgba(74, 146, 255, 0.24)';
  ctx.strokeStyle = '#8ff0c2';
  ctx.lineWidth = 3;
  ctx.fillRect(x, y, squareSize, squareSize);
  ctx.strokeRect(x, y, squareSize, squareSize);
}

function getCanvasOrigin(canvas) {
  return {
    x: canvas.width * 0.5,
    y: canvas.height * 0.54,
  };
}

function worldToScreen(canvas, point) {
  const origin = getCanvasOrigin(canvas);
  return {
    x: origin.x + (MOVE_DEMO_BASIS_X.x * point.x) + (MOVE_DEMO_BASIS_Z.x * point.z),
    y: origin.y + (MOVE_DEMO_BASIS_X.y * point.x) + (MOVE_DEMO_BASIS_Z.y * point.z) - (point.y * 28),
  };
}

function screenToWorldXZ(canvas, screen) {
  const origin = getCanvasOrigin(canvas);
  const dx = screen.x - origin.x;
  const dy = screen.y - origin.y;
  const det = (MOVE_DEMO_BASIS_X.x * MOVE_DEMO_BASIS_Z.y) - (MOVE_DEMO_BASIS_Z.x * MOVE_DEMO_BASIS_X.y);
  if (Math.abs(det) < 0.0001) {
    return { x: 0, z: 0 };
  }
  return {
    x: ((dx * MOVE_DEMO_BASIS_Z.y) - (MOVE_DEMO_BASIS_Z.x * dy)) / det,
    z: ((MOVE_DEMO_BASIS_X.x * dy) - (dx * MOVE_DEMO_BASIS_X.y)) / det,
  };
}

function clampMoveDemoPoint(point) {
  return {
    x: Math.max(-MOVE_DEMO_GRID_EXTENT, Math.min(MOVE_DEMO_GRID_EXTENT, Number(point.x) || 0)),
    y: Math.max(-2, Math.min(2, Number(point.y) || 0)),
    z: Math.max(-MOVE_DEMO_GRID_EXTENT, Math.min(MOVE_DEMO_GRID_EXTENT, Number(point.z) || 0)),
  };
}

function parseAxisApplyValue(rawValue, fallbackValue) {
  const raw = String(rawValue ?? '').trim();
  if (!raw) {
    return { mode: 'keep', value: fallbackValue };
  }
  if (raw.startsWith('+=')) {
    const delta = Number(raw.slice(2));
    if (Number.isFinite(delta)) {
      return { mode: 'add', value: delta };
    }
    return { mode: 'keep', value: fallbackValue };
  }
  const value = Number(raw);
  if (Number.isFinite(value)) {
    return { mode: 'set', value };
  }
  return { mode: 'keep', value: fallbackValue };
}

function drawMoveDemo(canvas, state) {
  const ctx = canvas.getContext('2d');
  if (!ctx) { return; }
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#0d1828');
  bg.addColorStop(1, '#172c47');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  for (let gx = -MOVE_DEMO_GRID_EXTENT; gx <= MOVE_DEMO_GRID_EXTENT; gx += 1) {
    const a = worldToScreen(canvas, { x: gx, y: 0, z: -MOVE_DEMO_GRID_EXTENT });
    const b = worldToScreen(canvas, { x: gx, y: 0, z: MOVE_DEMO_GRID_EXTENT });
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = gx === 0 ? 'rgba(116, 225, 189, 0.46)' : 'rgba(132, 173, 232, 0.22)';
    ctx.lineWidth = gx === 0 ? 1.6 : 1;
    ctx.stroke();
  }
  for (let gz = -MOVE_DEMO_GRID_EXTENT; gz <= MOVE_DEMO_GRID_EXTENT; gz += 1) {
    const a = worldToScreen(canvas, { x: -MOVE_DEMO_GRID_EXTENT, y: 0, z: gz });
    const b = worldToScreen(canvas, { x: MOVE_DEMO_GRID_EXTENT, y: 0, z: gz });
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = gz === 0 ? 'rgba(116, 225, 189, 0.46)' : 'rgba(132, 173, 232, 0.22)';
    ctx.lineWidth = gz === 0 ? 1.6 : 1;
    ctx.stroke();
  }

  state.points.forEach((point, index) => {
    const isSelected = state.selectedIndices.includes(index);
    const isActive = index === state.activeIndex;
    const corners = [
      { x: point.x - MOVE_DEMO_SAMPLE_HALF, y: point.y, z: point.z - MOVE_DEMO_SAMPLE_HALF },
      { x: point.x + MOVE_DEMO_SAMPLE_HALF, y: point.y, z: point.z - MOVE_DEMO_SAMPLE_HALF },
      { x: point.x + MOVE_DEMO_SAMPLE_HALF, y: point.y, z: point.z + MOVE_DEMO_SAMPLE_HALF },
      { x: point.x - MOVE_DEMO_SAMPLE_HALF, y: point.y, z: point.z + MOVE_DEMO_SAMPLE_HALF },
    ].map((cornerPoint) => worldToScreen(canvas, cornerPoint));

    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    corners.slice(1).forEach((corner) => ctx.lineTo(corner.x, corner.y));
    ctx.closePath();
    ctx.fillStyle = isActive
      ? 'rgba(255, 90, 90, 0.42)'
      : (isSelected ? 'rgba(255, 146, 90, 0.34)' : 'rgba(255, 90, 90, 0.22)');
    ctx.strokeStyle = isActive
      ? '#ff8585'
      : (isSelected ? '#ffb06e' : '#d85d5d');
    ctx.lineWidth = isActive ? 2.8 : (isSelected ? 2.3 : 1.8);
    ctx.fill();
    ctx.stroke();

    const center = worldToScreen(canvas, point);
    ctx.beginPath();
    ctx.arc(center.x, center.y, isActive ? 5 : 4, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? '#ffb1b1' : (isSelected ? '#ffd0a7' : '#ff8d8d');
    ctx.fill();

    ctx.fillStyle = '#dcecff';
    ctx.font = '11px sans-serif';
    ctx.fillText(String(index + 1), center.x + 8, center.y - 8);
  });

  const active = state.points[state.activeIndex];
  ctx.fillStyle = '#dcecff';
  ctx.font = '12px sans-serif';
  ctx.fillText(
    `active ${state.activeIndex + 1}: x ${active.x.toFixed(1)}  y ${active.y.toFixed(1)}  z ${active.z.toFixed(1)} / selected ${state.selectedIndices.length}`,
    16,
    22,
  );
}

function initializeMovePointDemo(area) {
  const card = area.closest('.card') || area.parentElement;
  const canvas = area.querySelector('canvas');
  const inputX = card?.querySelector('[data-move-demo-input="x"]');
  const inputY = card?.querySelector('[data-move-demo-input="y"]');
  const inputZ = card?.querySelector('[data-move-demo-input="z"]');
  const applyButton = card?.querySelector('[data-move-demo-apply]');
  const refNote = card?.querySelector('[data-move-demo-ref-note]');
  const helpText = card?.querySelector('[data-move-demo-help]');
  const pickButtons = {
    x: card?.querySelector('[data-move-demo-pick="x"]'),
    y: card?.querySelector('[data-move-demo-pick="y"]'),
    z: card?.querySelector('[data-move-demo-pick="z"]'),
  };
  const lockButtons = {
    x: card?.querySelector('[data-move-demo-lock="x"]'),
    y: card?.querySelector('[data-move-demo-lock="y"]'),
    z: card?.querySelector('[data-move-demo-lock="z"]'),
  };
  const unlinkButtons = {
    x: card?.querySelector('[data-move-demo-unlink="x"]'),
    y: card?.querySelector('[data-move-demo-unlink="y"]'),
    z: card?.querySelector('[data-move-demo-unlink="z"]'),
  };
  if (!canvas || !inputX || !inputY || !inputZ || !applyButton) { return; }

  const state = {
    points: MOVE_DEMO_INITIAL_POINTS.map((point) => ({ ...point })),
    pointAxisRefs: MOVE_DEMO_INITIAL_POINTS.map(() => ({ x: null, y: null, z: null })),
    activeIndex: 0,
    selectedIndices: [0],
    dragging: false,
    dragMoved: false,
    pointerDownScreen: null,
    dragStartWorld: null,
    dragStartPoints: [],
    pointerDownIndex: -1,
    pointerDownWasSelected: false,
    pickAxis: '',
    axisLocks: { x: false, y: false, z: false },
  };

  function getActivePoint() {
    return state.points[state.activeIndex];
  }

  function ensureActiveSelected() {
    if (state.selectedIndices.includes(state.activeIndex)) {
      return;
    }
    if (state.selectedIndices.length > 0) {
      state.activeIndex = state.selectedIndices[0];
      return;
    }
    state.selectedIndices = [state.activeIndex];
  }

  function sortUniqueIndices(indices) {
    return Array.from(new Set(indices)).sort((a, b) => a - b);
  }

  function syncInputs() {
    const active = getActivePoint();
    const isMulti = state.selectedIndices.length > 1;
    inputX.value = isMulti ? '' : String(active.x);
    inputY.value = isMulti ? '' : String(active.y);
    inputZ.value = isMulti ? '' : String(active.z);
    inputX.placeholder = isMulti ? 'each' : String(active.x);
    inputY.placeholder = isMulti ? 'each' : String(active.y);
    inputZ.placeholder = isMulti ? 'each' : String(active.z);
    inputX.disabled = state.axisLocks.x;
    inputY.disabled = state.axisLocks.y;
    inputZ.disabled = state.axisLocks.z;
  }

  function syncHelpText() {
    if (!helpText) { return; }
    const isMulti = state.selectedIndices.length > 1;
    helpText.innerHTML = isMulti
    ? '複数移動：クリックで複数選択し、ドラッグで選択中の四角をまとめて移動できます。複数選択時は入力値を全選択へ一括設定し、<code>+=1</code> のように入れると各四角に加算します。'
    : '単体移動：ドラッグで移動が可能です。入力欄で数値を入力しても移動できます。<br>スポイトボタンで軸毎に参照が可能です。<code>+=1</code> のように入れると加算された位置になります。<br>クリックで複数を選択し、まとめて移動することが可能です。';
  }

  function getAxisRefSummary(axis) {
    const selected = state.selectedIndices.length > 0 ? state.selectedIndices : [state.activeIndex];
    const labels = selected
      .map((index) => {
        const refIndex = state.pointAxisRefs[index]?.[axis];
        return Number.isInteger(refIndex) ? `${refIndex + 1}` : null;
      })
      .filter(Boolean);
    if (labels.length < 1) { return null; }
    const unique = Array.from(new Set(labels));
    return unique.length === 1 ? `P${unique[0]}` : 'mixed';
  }

  function syncAxisReferences() {
    const nextPoints = state.points.map((point) => ({ ...point }));
    let changed = false;
    ['x', 'y', 'z'].forEach((axis) => {
      state.points.forEach((point, index) => {
        const sourceIndex = state.pointAxisRefs[index]?.[axis];
        if (!Number.isInteger(sourceIndex)) { return; }
        const sourcePoint = state.points[sourceIndex];
        if (!sourcePoint) {
          state.pointAxisRefs[index][axis] = null;
          return;
        }
        if (state.axisLocks[axis]) { return; }
        const nextValue = sourcePoint[axis];
        if (Math.abs(nextPoints[index][axis] - nextValue) > 0.0001) {
          nextPoints[index][axis] = nextValue;
          changed = true;
        }
      });
    });
    if (!changed) { return; }
    state.points = nextPoints.map((point) => clampMoveDemoPoint(point));
  }

  function updateToolUi() {
    ['x', 'y', 'z'].forEach((axis) => {
      const pick = pickButtons[axis];
      const lock = lockButtons[axis];
      const unlink = unlinkButtons[axis];
      const hasLink = Boolean(getAxisRefSummary(axis));
      if (pick) {
        pick.classList.toggle('is-active', state.pickAxis === axis);
        pick.setAttribute('aria-pressed', state.pickAxis === axis ? 'true' : 'false');
      }
      if (lock) {
        lock.classList.toggle('is-locked', state.axisLocks[axis]);
        lock.textContent = state.axisLocks[axis] ? '🔒' : '🔓';
      }
      if (unlink) {
        unlink.style.display = hasLink ? 'inline-flex' : 'none';
      }
    });
    canvas.style.cursor = state.pickAxis ? 'crosshair' : (state.dragging ? 'grabbing' : 'grab');
    if (refNote) {
      const parts = ['x', 'y', 'z']
        .map((axis) => {
          const summary = getAxisRefSummary(axis);
          return summary ? `${axis.toUpperCase()}:${summary}` : null;
        })
        .filter(Boolean);
      const refText = parts.length > 0 ? `参照: ${parts.join(' / ')}` : '参照: なし';
      refNote.textContent = state.pickAxis
        ? `${refText} / ${state.pickAxis.toUpperCase()} の参照元を選択してください`
        : refText;
    }
  }

  function render() {
    drawMoveDemo(canvas, state);
  }

  function applyInputs() {
    const selected = state.selectedIndices.length > 0 ? state.selectedIndices : [state.activeIndex];
    const active = getActivePoint();
    const xParsed = parseAxisApplyValue(inputX.value, active.x);
    const yParsed = parseAxisApplyValue(inputY.value, active.y);
    const zParsed = parseAxisApplyValue(inputZ.value, active.z);
    selected.forEach((index) => {
      const point = state.points[index];
      const nextX = xParsed.mode === 'add' ? point.x + xParsed.value : (xParsed.mode === 'set' ? xParsed.value : point.x);
      const nextY = yParsed.mode === 'add' ? point.y + yParsed.value : (yParsed.mode === 'set' ? yParsed.value : point.y);
      const nextZ = zParsed.mode === 'add' ? point.z + zParsed.value : (zParsed.mode === 'set' ? zParsed.value : point.z);
      const moved = clampMoveDemoPoint({
        x: state.axisLocks.x ? point.x : nextX,
        y: state.axisLocks.y ? point.y : nextY,
        z: state.axisLocks.z ? point.z : nextZ,
      });
      point.x = moved.x;
      point.y = moved.y;
      point.z = moved.z;
    });
    syncAxisReferences();
    syncInputs();
    render();
  }

  function pickNearestPointIndex(world) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    state.points.forEach((point, index) => {
      const dx = point.x - world.x;
      const dz = point.z - world.z;
      const distance = (dx * dx) + (dz * dz);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    return nearestIndex;
  }

  function pickPointIndexFromScreen(screen) {
    let nearestIndex = -1;
    let nearestDistance = Infinity;
    state.points.forEach((point, index) => {
      const center = worldToScreen(canvas, point);
      const dx = center.x - screen.x;
      const dy = center.y - screen.y;
      const distance = Math.hypot(dx, dy);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    if (nearestDistance > MOVE_DEMO_PICK_RADIUS_PX) {
      return -1;
    }
    return nearestIndex;
  }

  function getWorldFromPointerEvent(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return screenToWorldXZ(canvas, {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    });
  }

  function moveActivePointFromWorld(world, activeIndex = state.activeIndex) {
    state.activeIndex = activeIndex;
    const active = getActivePoint();
    const next = clampMoveDemoPoint({
      x: Math.round(world.x * 10) / 10,
      y: active.y,
      z: Math.round(world.z * 10) / 10,
    });
    active.x = next.x;
    active.z = next.z;
    syncInputs();
    render();
  }

  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const screen = {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
    const nearestIndex = pickPointIndexFromScreen(screen);
    if (nearestIndex < 0) {
      state.dragging = false;
      state.dragMoved = false;
      state.pointerDownScreen = null;
      state.dragStartWorld = null;
      state.dragStartPoints = [];
      state.pointerDownIndex = -1;
      state.pointerDownWasSelected = false;
      updateToolUi();
      syncHelpText();
      render();
      return;
    }
    if (state.pickAxis) {
      const axis = state.pickAxis;
      const selected = state.selectedIndices.length > 0 ? state.selectedIndices : [state.activeIndex];
      if (selected.every((index) => index === nearestIndex)) {
        if (refNote) {
          refNote.textContent = `${axis.toUpperCase()} の参照先は別の四角を選択してください`;
        }
      } else {
        selected.forEach((index) => {
          state.pointAxisRefs[index][axis] = nearestIndex;
        });
        syncAxisReferences();
        const targetInput = axis === 'x' ? inputX : (axis === 'y' ? inputY : inputZ);
        if (targetInput && selected.length <= 1 && !state.axisLocks[axis]) {
          targetInput.value = String(state.points[state.activeIndex][axis]);
        }
      }
      state.pickAxis = '';
      syncInputs();
      updateToolUi();
      syncHelpText();
      render();
      return;
    }
    const world = screenToWorldXZ(canvas, screen);
    state.activeIndex = nearestIndex;
    state.dragging = true;
    state.dragMoved = false;
    state.pointerDownScreen = { x: event.clientX, y: event.clientY };
    state.dragStartWorld = world;
    state.dragStartPoints = state.points.map((point) => ({ ...point }));
    state.pointerDownIndex = nearestIndex;
    state.pointerDownWasSelected = state.selectedIndices.includes(nearestIndex);
    canvas.setPointerCapture?.(event.pointerId);
    syncInputs();
    syncHelpText();
    render();
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!state.dragging) { return; }
    if (!state.dragMoved) {
      const start = state.pointerDownScreen;
      const dx = event.clientX - (start?.x ?? event.clientX);
      const dy = event.clientY - (start?.y ?? event.clientY);
      const distance = Math.hypot(dx, dy);
      if (distance < MOVE_DEMO_DRAG_THRESHOLD_PX) {
        return;
      }
      if (!state.pointerDownWasSelected) {
        state.selectedIndices = state.selectedIndices.length > 1
          ? sortUniqueIndices(state.selectedIndices.concat(state.pointerDownIndex))
          : [state.pointerDownIndex];
      }
      ensureActiveSelected();
      state.dragMoved = true;
    }
    const world = getWorldFromPointerEvent(event);
    const startWorld = state.dragStartWorld || world;
    const dx = Math.round((world.x - startWorld.x) * 10) / 10;
    const dz = Math.round((world.z - startWorld.z) * 10) / 10;
    const selected = state.selectedIndices.length > 0 ? state.selectedIndices : [state.activeIndex];
    selected.forEach((index) => {
      const startPoint = state.dragStartPoints[index] || state.points[index];
      const moved = clampMoveDemoPoint({
        x: state.axisLocks.x ? startPoint.x : startPoint.x + dx,
        y: startPoint.y,
        z: state.axisLocks.z ? startPoint.z : startPoint.z + dz,
      });
      state.points[index].x = moved.x;
      state.points[index].z = moved.z;
    });
    syncAxisReferences();
    syncInputs();
    render();
  });

  function endDrag(event) {
    if (!state.dragging) { return; }
    if (!state.dragMoved && state.pointerDownIndex >= 0) {
      if (state.pointerDownWasSelected) {
        const nextSelected = state.selectedIndices.filter((index) => index !== state.pointerDownIndex);
        state.selectedIndices = nextSelected.length > 0 ? nextSelected : [state.pointerDownIndex];
      } else {
        state.selectedIndices = sortUniqueIndices(state.selectedIndices.concat(state.pointerDownIndex));
      }
      ensureActiveSelected();
      syncInputs();
      syncHelpText();
      render();
    }
    state.dragging = false;
    state.dragMoved = false;
    state.pointerDownScreen = null;
    state.dragStartWorld = null;
    state.dragStartPoints = [];
    state.pointerDownIndex = -1;
    state.pointerDownWasSelected = false;
    if (event?.pointerId != null) {
      canvas.releasePointerCapture?.(event.pointerId);
    }
  }

  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => {
    state.dragging = false;
    state.dragMoved = false;
    state.pointerDownScreen = null;
    state.dragStartWorld = null;
    state.dragStartPoints = [];
    state.pointerDownIndex = -1;
    state.pointerDownWasSelected = false;
  });

  applyButton.addEventListener('click', applyInputs);
  [inputX, inputY, inputZ].forEach((input) => {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        applyInputs();
      }
    });
  });

  ['x', 'y', 'z'].forEach((axis) => {
    pickButtons[axis]?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      state.pickAxis = state.pickAxis === axis ? '' : axis;
      updateToolUi();
    });
    lockButtons[axis]?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      state.axisLocks[axis] = !state.axisLocks[axis];
      syncInputs();
      updateToolUi();
    });
    unlinkButtons[axis]?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const selected = state.selectedIndices.length > 0 ? state.selectedIndices : [state.activeIndex];
      selected.forEach((index) => {
        state.pointAxisRefs[index][axis] = null;
      });
      if (state.pickAxis === axis) {
        state.pickAxis = '';
      }
      updateToolUi();
    });
  });

  syncInputs();
  updateToolUi();
  syncHelpText();
  render();
  area.dataset.demoInitialized = 'true';
}

function drawConstructionDemo(canvas, state) {
  const ctx = canvas.getContext('2d');
  if (!ctx) { return; }
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#0d1828');
  bg.addColorStop(1, '#172c47');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  for (let gx = -MOVE_DEMO_GRID_EXTENT; gx <= MOVE_DEMO_GRID_EXTENT; gx += 1) {
    const a = worldToScreen(canvas, { x: gx, y: 0, z: -MOVE_DEMO_GRID_EXTENT });
    const b = worldToScreen(canvas, { x: gx, y: 0, z: MOVE_DEMO_GRID_EXTENT });
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = gx === 0 ? 'rgba(116, 225, 189, 0.46)' : 'rgba(132, 173, 232, 0.22)';
    ctx.lineWidth = gx === 0 ? 1.6 : 1;
    ctx.stroke();
  }
  for (let gz = -MOVE_DEMO_GRID_EXTENT; gz <= MOVE_DEMO_GRID_EXTENT; gz += 1) {
    const a = worldToScreen(canvas, { x: -MOVE_DEMO_GRID_EXTENT, y: 0, z: gz });
    const b = worldToScreen(canvas, { x: MOVE_DEMO_GRID_EXTENT, y: 0, z: gz });
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = gz === 0 ? 'rgba(116, 225, 189, 0.46)' : 'rgba(132, 173, 232, 0.22)';
    ctx.lineWidth = gz === 0 ? 1.6 : 1;
    ctx.stroke();
  }

  if (state.previewSegments.length > 0) {
    state.previewSegments.forEach((segment) => {
      const a = worldToScreen(canvas, segment.a);
      const b = worldToScreen(canvas, segment.b);
      ctx.save();
      ctx.translate((a.x + b.x) * 0.5, (a.y + b.y) * 0.5);
      ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x));
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (segment.kind === 'round') {
        ctx.strokeStyle = '#d8e6ff';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-length * 0.5, 0);
        ctx.lineTo(length * 0.5, 0);
        ctx.stroke();
      } else if (segment.kind === 'tube') {
        ctx.strokeStyle = '#8aa9d4';
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-length * 0.5, 0);
        ctx.lineTo(length * 0.5, 0);
        ctx.stroke();
        ctx.strokeStyle = '#f4f8ff';
        ctx.lineWidth = 5;
        ctx.stroke();
      } else if (segment.kind === 'square') {
        ctx.fillStyle = '#a9bbd3';
        ctx.fillRect(-length * 0.5, -7, length, 14);
      } else if (segment.kind === 'h_beam') {
        ctx.fillStyle = '#a9bbd3';
        ctx.fillRect(-length * 0.5, -8, length, 4);
        ctx.fillRect(-length * 0.5, 4, length, 4);
        ctx.fillRect(-length * 0.06, -8, length * 0.12, 16);
      } else if (segment.kind === 't_beam') {
        ctx.fillStyle = '#a9bbd3';
        ctx.fillRect(-length * 0.5, -8, length, 4);
        ctx.fillRect(-length * 0.06, -8, length * 0.12, 16);
      } else if (segment.kind === 'l_beam') {
        ctx.fillStyle = '#a9bbd3';
        ctx.fillRect(-length * 0.5, 4, length, 4);
        ctx.fillRect(-length * 0.5, -8, 8, 16);
      }
      ctx.restore();
    });
  }

  state.points.forEach((point, index) => {
    const isSelected = state.selectedIndices.includes(index);
    const center = worldToScreen(canvas, point);
    ctx.beginPath();
    ctx.arc(center.x, center.y, isSelected ? 7 : 5, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? '#ffd57a' : '#ff8d8d';
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#fff1bd' : '#d85d5d';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#dcecff';
    ctx.font = '11px sans-serif';
    ctx.fillText(String(index + 1), center.x + 10, center.y - 8);
  });
}

function initializeConstructionDemo(area) {
  const card = area.closest('.card') || area.parentElement;
  const canvas = area.querySelector('canvas');
  const typeButtons = Array.from(card?.querySelectorAll('[data-construction-demo-type]') || []);
  const generateButton = card?.querySelector('[data-construction-demo-generate]');
  const status = card?.querySelector('[data-construction-demo-status]');
  if (!canvas || !generateButton || typeButtons.length < 1) { return; }

  const state = {
    points: MOVE_DEMO_INITIAL_POINTS.map((point) => ({ ...point })),
    selectedIndices: [0, 1],
    selectedType: typeButtons.find((button) => button.classList.contains('is-selected'))?.dataset.constructionDemoType || 'round',
    previewSegments: [],
  };

  function syncStatus() {
    if (!status) { return; }
    status.textContent = state.previewSegments.length > 0
      ? `${state.selectedType} を ${state.previewSegments.length} 本生成`
      : `カテゴリ: ${state.selectedType} / 選択点: ${state.selectedIndices.length}`;
  }

  function render() {
    drawConstructionDemo(canvas, state);
  }

  function rebuildSegments() {
    if (state.selectedIndices.length < 2) {
      state.previewSegments = [];
      syncStatus();
      render();
      return;
    }
    const ordered = [...state.selectedIndices].sort((a, b) => a - b);
    const segments = [];
    for (let index = 0; index < ordered.length - 1; index += 1) {
      segments.push({
        a: state.points[ordered[index]],
        b: state.points[ordered[index + 1]],
        kind: state.selectedType,
      });
    }
    state.previewSegments = segments;
    syncStatus();
    render();
  }

  function pickPointIndex(screen) {
    let nearestIndex = -1;
    let nearestDistance = Infinity;
    state.points.forEach((point, index) => {
      const center = worldToScreen(canvas, point);
      const distance = Math.hypot(center.x - screen.x, center.y - screen.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    return nearestDistance <= MOVE_DEMO_PICK_RADIUS_PX ? nearestIndex : -1;
  }

  typeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      typeButtons.forEach((entry) => entry.classList.toggle('is-selected', entry === button));
      state.selectedType = button.dataset.constructionDemoType || 'round';
      syncStatus();
      render();
    });
  });

  generateButton.addEventListener('click', rebuildSegments);

  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const screen = {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
    const pointIndex = pickPointIndex(screen);
    if (pointIndex < 0) { return; }
    if (state.selectedIndices.includes(pointIndex)) {
      const next = state.selectedIndices.filter((index) => index !== pointIndex);
      state.selectedIndices = next.length > 0 ? next : [pointIndex];
    } else {
      state.selectedIndices = Array.from(new Set(state.selectedIndices.concat(pointIndex))).sort((a, b) => a - b);
    }
    syncStatus();
    render();
  });

  syncStatus();
  render();
  area.dataset.demoInitialized = 'true';
}

function drawRailUtilityDemo(canvas, state) {
  const ctx = canvas.getContext('2d');
  if (!ctx) { return; }
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#0d1828');
  bg.addColorStop(1, '#172c47');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  state.rails.forEach((rail, railIndex) => {
    const points2d = rail.points.map((point) => worldToScreen(canvas, point));
    ctx.beginPath();
    ctx.moveTo(points2d[0].x, points2d[0].y);
    points2d.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.strokeStyle = railIndex === 0 ? '#88a6d9' : '#7cbf9f';
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(points2d[0].x, points2d[0].y + 6);
    points2d.slice(1).forEach((point) => ctx.lineTo(point.x, point.y + 6));
    ctx.strokeStyle = 'rgba(220, 234, 255, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  state.previewSegments.forEach((segment) => {
    const a = worldToScreen(canvas, segment.a);
    const b = worldToScreen(canvas, segment.b);
    ctx.save();
    ctx.translate((a.x + b.x) * 0.5, (a.y + b.y) * 0.5);
    ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x));
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (segment.kind === 'bridge') {
      ctx.strokeStyle = '#618ad1';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-length * 0.5, 0);
      ctx.lineTo(length * 0.5, 0);
      ctx.stroke();
      ctx.strokeStyle = '#4b6584';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-length * 0.35, 0);
      ctx.quadraticCurveTo(0, -18, length * 0.35, 0);
      ctx.stroke();
    } else if (segment.kind === 'elevated') {
      ctx.fillStyle = '#9bb3d1';
      ctx.fillRect(-length * 0.5, -6, length, 12);
      ctx.fillRect(-length * 0.36, 6, 10, 16);
      ctx.fillRect(length * 0.28, 6, 10, 16);
    } else if (segment.kind === 'wall') {
      ctx.fillStyle = '#8ca9c9';
      ctx.fillRect(-length * 0.5, -14, length, 28);
      ctx.strokeStyle = '#6783a7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-length * 0.5, -3);
      ctx.lineTo(length * 0.5, -3);
      ctx.moveTo(-length * 0.5, 8);
      ctx.lineTo(length * 0.5, 8);
      ctx.stroke();
    } else if (segment.kind === 'floor') {
      ctx.fillStyle = '#88a7cb';
      ctx.beginPath();
      ctx.moveTo(-length * 0.5, 6);
      ctx.lineTo(0, -8);
      ctx.lineTo(length * 0.5, 6);
      ctx.lineTo(0, 16);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  });

  state.pins.forEach((pin) => {
    const center = worldToScreen(canvas, pin.point);
    const isSelected = state.selectedPinIds.includes(pin.id);
    ctx.beginPath();
    ctx.arc(center.x, center.y, isSelected ? 7 : 5, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? '#ffd57a' : '#f4f8ff';
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#fff1bd' : '#7a98bf';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

function initializeRailUtilityDemo(area) {
  const card = area.closest('.card') || area.parentElement;
  const canvas = area.querySelector('canvas');
  const typeButtons = Array.from(card?.querySelectorAll('[data-rail-demo-type]') || []);
  const generateButton = card?.querySelector('[data-rail-demo-generate]');
  const status = card?.querySelector('[data-rail-demo-status]');
  if (!canvas || !generateButton || typeButtons.length < 1) { return; }

  const rails = [
    {
      id: 'rail_1',
      points: [
        { x: -4.2, y: 0, z: -1.6 },
        { x: -1.6, y: 0, z: -1.0 },
        { x: 1.1, y: 0, z: -0.5 },
        { x: 4.0, y: 0, z: -0.1 },
      ],
    },
    {
      id: 'rail_2',
      points: [
        { x: -3.8, y: 0, z: 1.4 },
        { x: -1.4, y: 0, z: 1.0 },
        { x: 1.4, y: 0, z: 0.6 },
        { x: 4.2, y: 0, z: 0.2 },
      ],
    },
  ];

  const state = {
    rails,
    pins: [],
    selectedPinIds: [],
    selectedType: typeButtons.find((button) => button.classList.contains('is-selected'))?.dataset.railDemoType || 'bridge',
    previewSegments: [],
    nextPinId: 1,
  };

  function syncStatus() {
    if (!status) { return; }
    status.textContent = state.previewSegments.length > 0
      ? `${state.selectedType} を ${state.previewSegments.length} 本生成 / ピン ${state.pins.length} 個`
      : `カテゴリ: ${state.selectedType} / ピン: ${state.pins.length} / 選択: ${state.selectedPinIds.length}`;
  }

  function render() {
    drawRailUtilityDemo(canvas, state);
  }

  function sampleNearestPointOnRail(rail, screen) {
    let best = null;
    for (let segmentIndex = 0; segmentIndex < rail.points.length - 1; segmentIndex += 1) {
      const a = rail.points[segmentIndex];
      const b = rail.points[segmentIndex + 1];
      for (let step = 0; step <= 20; step += 1) {
        const t = step / 20;
        const point = {
          x: a.x + ((b.x - a.x) * t),
          y: 0,
          z: a.z + ((b.z - a.z) * t),
        };
        const point2d = worldToScreen(canvas, point);
        const distance = Math.hypot(point2d.x - screen.x, point2d.y - screen.y);
        if (!best || distance < best.distance) {
          best = { railId: rail.id, point, distance, t: segmentIndex + t };
        }
      }
    }
    return best;
  }

  function rebuildSegments() {
    if (state.selectedPinIds.length < 2) {
      state.previewSegments = [];
      syncStatus();
      render();
      return;
    }
    const orderedPins = state.pins
      .filter((pin) => state.selectedPinIds.includes(pin.id))
      .sort((a, b) => a.order - b.order);
    state.previewSegments = orderedPins.slice(0, -1).map((pin, index) => ({
      a: pin.point,
      b: orderedPins[index + 1].point,
      kind: state.selectedType,
    }));
    syncStatus();
    render();
  }

  function pickExistingPin(screen) {
    let nearestPin = null;
    state.pins.forEach((pin) => {
      const center = worldToScreen(canvas, pin.point);
      const distance = Math.hypot(center.x - screen.x, center.y - screen.y);
      if (distance <= MOVE_DEMO_PICK_RADIUS_PX && (!nearestPin || distance < nearestPin.distance)) {
        nearestPin = { pin, distance };
      }
    });
    return nearestPin?.pin || null;
  }

  typeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      typeButtons.forEach((entry) => entry.classList.toggle('is-selected', entry === button));
      state.selectedType = button.dataset.railDemoType || 'bridge';
      syncStatus();
      render();
    });
  });

  generateButton.addEventListener('click', rebuildSegments);

  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const screen = {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };

    const existingPin = pickExistingPin(screen);
    if (existingPin) {
      if (state.selectedPinIds.includes(existingPin.id)) {
        const next = state.selectedPinIds.filter((id) => id !== existingPin.id);
        state.selectedPinIds = next;
      } else {
        state.selectedPinIds = state.selectedPinIds.concat(existingPin.id);
      }
      syncStatus();
      render();
      return;
    }

    const nearest = rails
      .map((rail) => sampleNearestPointOnRail(rail, screen))
      .filter(Boolean)
      .sort((a, b) => a.distance - b.distance)[0] || null;
    if (!nearest || nearest.distance > 18) {
      return;
    }
    const pin = {
      id: `pin_${state.nextPinId}`,
      railId: nearest.railId,
      point: nearest.point,
      order: nearest.t,
    };
    state.nextPinId += 1;
    state.pins.push(pin);
    state.selectedPinIds = state.selectedPinIds.concat(pin.id);
    syncStatus();
    render();
  });

  syncStatus();
  render();
  area.dataset.demoInitialized = 'true';
}

function openDemoArea(area) {
  const canvas = area.querySelector('canvas');
  area.hidden = false;
  if (area.id === 'move-point-demo' && area.dataset.demoInitialized !== 'true') {
    initializeMovePointDemo(area);
    return;
  }
  if (area.id === 'construction-demo' && area.dataset.demoInitialized !== 'true') {
    initializeConstructionDemo(area);
    return;
  }
  if (area.id === 'rail-difference-demo' && area.dataset.demoInitialized !== 'true') {
    initializeRailUtilityDemo(area);
    return;
  }
  if (canvas) {
    drawGenericDemoSquare(canvas);
  }
}

const MANUAL_VIDEO_GUIDES = {
  rail: {
    label: 'rail routine',
    scenes: [
      {
        id: 'new',
        title: 'rail / new',
        description: '路線を定義し、制御点を追加して最初のドラフトを作るシーンです。',
        src: './videos/rail_move/new.mp4',
      },
      {
        id: 'move',
        title: 'rail / move',
        description: '追加した制御点を動かし、平面形状と高さを調整するシーンです。',
        src: './videos/rail_move/move.mp4',
      },
      {
        id: 'structure',
        title: 'rail / structure',
        description: '配置ピンから bridge などの構造物を生成し、路線に付随する要素を仕上げるシーンです。',
        src: './videos/rail_move/structure.mp4',
      },
    ],
  },
  edit: {
    label: 'edit routine',
    scenes: [
      {
        id: 'add_point',
        title: 'edit / add_point',
        description: '新しい点を打って、部材生成の元になる点列を作るシーンです。',
        src: './videos/edit/add_point.mp4',
      },
      {
        id: 'move_point',
        title: 'edit / move_point',
        description: '既存の点を移動し、形状や高さを追い込むシーンです。',
        src: './videos/edit/move_point.mp4',
      },
      {
        id: 'construction',
        title: 'edit / construction',
        description: '点列から柱やチューブを生成し、部材として仕上げるシーンです。',
        src: './videos/edit/construction.mp4',
      },
    ],
  },
  'decoration-detail': {
    label: 'decoration detail demo',
    scenes: [
      {
        id: 'add_point',
        title: 'decoration / add_point',
        description: '新しい点を打って、装飾や部材の元になる点列を作るシーンです。',
        src: './videos/edit/decoration/add_point.mp4',
      },
      {
        id: 'construction',
        title: 'decoration / construction',
        description: '点列から部材を生成して仕上げるシーンです。',
        src: './videos/edit/decoration/construction.mp4',
      },
      {
        id: 'copy',
        title: 'decoration / copy',
        description: '選択対象を複製して配置するシーンです。',
        src: './videos/edit/decoration/copy.mp4',
      },
      {
        id: 'group',
        title: 'decoration / group',
        description: '複数の構造物をまとめてグループ化するシーンです。',
        src: './videos/edit/decoration/group.mp4',
      },
      {
        id: 'template',
        title: 'decoration / template',
        description: 'テンプレート形状から点列を起こすシーンです。',
        src: './videos/edit/decoration/template.mp4',
      },
      {
        id: 'guide',
        title: 'decoration / guide',
        description: 'ガイド面や補助面を使って作業面を整えるシーンです。',
        src: './videos/edit/decoration/guide.mp4',
      },
      {
        id: 'rotation',
        title: 'decoration / rotation',
        description: '選択点群をまとめて回転するシーンです。',
        src: './videos/edit/decoration/rotation.mp4',
      },
      {
        id: 'search',
        title: 'decoration / search',
        description: '点同士の距離や角度を測定するシーンです。',
        src: './videos/edit/decoration/search.mp4',
      },
      {
        id: 'move_point',
        title: 'decoration / move_point',
        description: '既存の点を移動し、形状や高さを追い込むシーンです。',
        src: './videos/edit/decoration/move_point.mp4',
      },
      {
        id: 'style',
        title: 'decoration / style',
        description: '鉄骨などの太さや見た目を調整するシーンです。',
        src: './videos/edit/decoration/style.mp4',
      },
      {
        id: 'delete',
        title: 'decoration / delete',
        description: '選択対象を削除するシーンです。',
        src: './videos/edit/decoration/delete.mp4',
      },
    ],
  },
};

MANUAL_VIDEO_GUIDES['rail-inline'] = {
  ...MANUAL_VIDEO_GUIDES.rail,
  label: 'rail quick demo',
};

MANUAL_VIDEO_GUIDES['edit-inline'] = {
  ...MANUAL_VIDEO_GUIDES.edit,
  label: 'edit quick demo',
};

function initializeManualVideoGuides() {
  document.querySelectorAll('[data-video-guide]').forEach((guide) => {
    const guideId = guide.dataset.videoGuide || '';
    const config = MANUAL_VIDEO_GUIDES[guideId];
    if (!config) { return; }

    const player = guide.querySelector('[data-video-player]');
    const placeholder = guide.querySelector('[data-video-placeholder]');
    const shell = guide.querySelector('.manual-video-shell');
    const label = guide.querySelector('[data-video-guide-label]');
    const title = guide.querySelector('[data-video-scene-title]');
    const description = guide.querySelector('[data-video-scene-description]');
    const status = guide.querySelector('[data-video-status]');
    const playAllButton = guide.querySelector('[data-video-play-all]');
    const replayButton = guide.querySelector('[data-video-replay-scene]');
    const sceneCards = guide.querySelectorAll('[data-scene-card]');
    if (!player || !placeholder || !shell || !title || !description || !status || !playAllButton || !replayButton) { return; }

    const state = {
      sceneIndex: 0,
      sequenceMode: false,
      autoSequencePreferred: true,
    };

    const sceneIndexById = new Map(config.scenes.map((scene, index) => [scene.id, index]));

    function currentScene() {
      return config.scenes[state.sceneIndex] || config.scenes[0];
    }

    function syncActiveState() {
      const scene = currentScene();
      sceneCards.forEach((card) => {
        card.classList.toggle('is-active', card.dataset.sceneCard === scene.id);
      });
      document.querySelectorAll(`[data-video-highlight^="${guideId}:"]`).forEach((card) => {
        const highlightTargets = (card.dataset.videoHighlight || '').split(/\s+/).filter(Boolean);
        card.classList.toggle('is-video-focus', highlightTargets.includes(`${guideId}:${scene.id}`));
      });
      if (typeof guide.syncSceneCardState === 'function') {
        guide.syncSceneCardState(scene.id);
      }
    }

    function syncText(message) {
      const scene = currentScene();
      if (label) {
        label.textContent = config.label;
      }
      title.textContent = scene.title;
      description.textContent = scene.description;
      status.textContent = message;
      syncActiveState();
    }

    function setIdleVisualState(isIdle) {
      shell.classList.toggle('is-idle', isIdle);
    }

    function tryPlayPlayer() {
      const playResult = player.play();
      if (playResult && typeof playResult.catch === 'function') {
        playResult.catch(() => {
          setIdleVisualState(true);
          syncText(`${currentScene().title} はユーザー操作後に再生されます。`);
        });
      }
    }

    function playCurrentScene({ autoplay = false, sequence = false, reload = true } = {}) {
      const scene = currentScene();
      state.sequenceMode = sequence;
      if (reload || player.dataset.sceneId !== scene.id || player.getAttribute('src') !== scene.src) {
        player.src = scene.src;
        player.dataset.sceneId = scene.id;
        player.load();
      }
      placeholder.hidden = !autoplay;
      setIdleVisualState(!autoplay);
      syncText(sequence ? `${scene.title} をシーケンス再生します。` : `${scene.title} を準備しています。`);
      if (!autoplay) { return; }
      tryPlayPlayer();
    }

    function setScene(sceneId, options = {}) {
      const nextIndex = sceneIndexById.get(sceneId);
      if (nextIndex == null) { return; }
      state.autoSequencePreferred = false;
      state.sceneIndex = nextIndex;
      playCurrentScene(options);
    }

    function playSequenceFromStart() {
      state.sceneIndex = 0;
      playCurrentScene({ autoplay: true, sequence: true });
    }

    player.addEventListener('loadeddata', () => {
      placeholder.hidden = true;
      if (state.sequenceMode) {
        const scene = currentScene();
        syncText(`${scene.title} を再生中です。終了後に次のシーンへ進みます。`);
        return;
      }
      updateViewportPlayback();
    });

    player.addEventListener('play', () => {
      placeholder.hidden = true;
      setIdleVisualState(false);
    });

    player.addEventListener('ended', () => {
      if (!state.sequenceMode) { return; }
      const nextIndex = state.sceneIndex + 1;
      if (nextIndex >= config.scenes.length) {
        state.sequenceMode = false;
        state.sceneIndex = 0;
        syncText('全シーンの再生が完了しました。先頭シーンに戻っています。');
        return;
      }
      state.sceneIndex = nextIndex;
      playCurrentScene({ autoplay: true, sequence: true });
    });

    player.addEventListener('error', () => {
      placeholder.hidden = false;
      setIdleVisualState(true);
      const scene = currentScene();
      syncText(`動画が見つかりません: ${scene.src}`);
    });

    playAllButton.addEventListener('click', playSequenceFromStart);
    replayButton.addEventListener('click', () => {
      state.autoSequencePreferred = false;
      playCurrentScene({ autoplay: true, sequence: false });
    });

    playCurrentScene({ autoplay: false, sequence: false });
    syncText('画面中央付近に来ると連続再生されます。');

    function updateViewportPlayback() {
      if (guide.hidden) {
        if (!player.paused) {
          player.pause();
        }
        setIdleVisualState(true);
        return;
      }

      const rect = guide.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const centerBandHalf = Math.max(80, Math.min(180, viewportHeight * 0.18));
      const bandTop = (viewportHeight / 2) - centerBandHalf;
      const bandBottom = (viewportHeight / 2) + centerBandHalf;
      const isCentered = rect.top < bandBottom && rect.bottom > bandTop;

      if (isCentered) {
        placeholder.hidden = true;
        setIdleVisualState(false);
        if (player.paused) {
          if (state.autoSequencePreferred) {
            if (!state.sequenceMode && (state.sceneIndex !== 0 || player.currentTime > 0.05)) {
              state.sceneIndex = 0;
            }
            playCurrentScene({
              autoplay: true,
              sequence: true,
              reload: !player.dataset.sceneId || state.sceneIndex === 0,
            });
          } else {
            syncText(`${currentScene().title} を再生中です。`);
            tryPlayPlayer();
          }
        }
        return;
      }

      if (!player.paused) {
        player.pause();
      }
      setIdleVisualState(true);
      syncText(state.autoSequencePreferred ? '画面中央付近に来ると連続再生されます。' : '画面中央付近に来ると再生されます。');
    }

    const centeredPlaybackObserver = new IntersectionObserver(() => {
      updateViewportPlayback();
    }, {
      threshold: 0,
      rootMargin: '-35% 0px -35% 0px',
    });

    centeredPlaybackObserver.observe(guide);
    guide.manualVideoSetScene = (sceneId, options = {}) => {
      setScene(sceneId, options);
    };
    guide.manualVideoViewportUpdate = updateViewportPlayback;
    window.addEventListener('scroll', updateViewportPlayback, { passive: true });
    window.addEventListener('resize', updateViewportPlayback);
  });

  function triggerManualVideoGuide(trigger) {
    const guideId = trigger.dataset.videoGuideTarget || '';
    const sceneId = trigger.dataset.videoScene || '';
    const guide = document.querySelector(`[data-video-guide="${guideId}"]`);
    if (!guide || !sceneId) { return; }
    if (guide.dataset.inlineAnchorGuide === 'true' && guide.hidden) {
      trigger.insertAdjacentElement('afterend', guide);
    }
    if (guide.hidden) {
      guide.hidden = false;
    }
    guide.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (typeof guide.manualVideoSetScene === 'function') {
      guide.manualVideoSetScene(sceneId, { autoplay: true, sequence: false });
    }
    window.requestAnimationFrame(() => {
      if (typeof guide.manualVideoViewportUpdate === 'function') {
        guide.manualVideoViewportUpdate();
      }
    });
  }

  document.querySelectorAll('.manual-video-jump[data-video-guide-target]').forEach((button) => {
    button.addEventListener('click', () => {
      triggerManualVideoGuide(button);
    });
  });

  document.querySelectorAll('[data-decoration-control][data-video-guide-target]').forEach((control) => {
    control.addEventListener('click', () => {
      triggerManualVideoGuide(control);
    });
    control.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') { return; }
      event.preventDefault();
      triggerManualVideoGuide(control);
    });
  });
}

initializeManualVideoGuides();

function initializeFeatureDetailBodies() {
  document.querySelectorAll('.feature-detail-body').forEach((body) => {
    if (body.querySelector(':scope > .feature-detail-body-inner')) { return; }
    const inner = document.createElement('div');
    inner.className = 'feature-detail-body-inner';
    while (body.firstChild) {
      inner.append(body.firstChild);
    }
    body.append(inner);
  });
}

initializeFeatureDetailBodies();

const FEATURE_DETAIL_TOGGLE_MS = 760;

function initializeFeatureHubAccordions() {
  document.querySelectorAll('.feature-hub').forEach((hub) => {
    const childrenContainer = hub.querySelector('.feature-hub-children');
    if (!(childrenContainer instanceof HTMLElement)) { return; }
    const detailsList = Array.from(childrenContainer.children).filter((element) => (
      element instanceof HTMLDetailsElement && element.classList.contains('feature-detail')
    ));
    if (!detailsList.length) { return; }

    function syncHubState() {
      const hasOpenDetail = detailsList.some((detail) => (
        detail.open && detail.dataset.closingIntent !== 'true'
      ));
      hub.classList.toggle('is-detail-open', hasOpenDetail);
    }

    detailsList.forEach((detail) => {
      const summary = detail.querySelector(':scope > summary');
      if (summary instanceof HTMLElement) {
        let closeTimer = 0;

        summary.addEventListener('click', (event) => {
          event.preventDefault();
          if (detail.dataset.animating === 'true') { return; }

          window.clearTimeout(closeTimer);
          detail.dataset.animating = 'true';

          if (detail.open) {
            detail.dataset.closingIntent = 'true';
            detail.classList.add('is-closing');
            syncHubState();
            closeTimer = window.setTimeout(() => {
              detail.open = false;
              detail.classList.remove('is-closing');
              delete detail.dataset.closingIntent;
              delete detail.dataset.animating;
              syncHubState();
            }, FEATURE_DETAIL_TOGGLE_MS);
            return;
          }

          delete detail.dataset.closingIntent;
          detail.classList.remove('is-closing');
          detail.open = true;
          syncHubState();
          window.setTimeout(() => {
            delete detail.dataset.animating;
          }, FEATURE_DETAIL_TOGGLE_MS);
        });
      }

      detail.addEventListener('toggle', syncHubState);
    });

    syncHubState();
  });

  document.querySelectorAll('[data-video-guide="decoration-detail"]').forEach((guide) => {
    const decorationRoot = guide.closest('.feature-detail-body');
    if (!decorationRoot) { return; }

    const controlButtons = Array.from(decorationRoot.querySelectorAll('[data-decoration-control][data-scene-card]'));
    const syncedDetails = Array.from(decorationRoot.querySelectorAll('.decoration-focus-pair .feature-detail[data-scene-card]'));
    const syncedCards = Array.from(decorationRoot.querySelectorAll('.feature-mini-list [data-scene-card]'));
    const allSceneCards = [...controlButtons, ...syncedDetails, ...syncedCards];

    function syncDecorationScene(sceneId) {
      syncedDetails.forEach((detail) => {
        const isActive = detail.dataset.sceneCard === sceneId;
        detail.open = isActive;
        detail.hidden = !isActive;
      });
      allSceneCards.forEach((card) => {
        card.classList.toggle('is-active', card.dataset.sceneCard === sceneId);
      });
    }

    guide.syncSceneCardState = syncDecorationScene;

    syncedDetails.forEach((detail) => {
      const summary = detail.querySelector(':scope > summary');
      if (!(summary instanceof HTMLElement)) { return; }

      summary.addEventListener('click', (event) => {
        event.preventDefault();
        const sceneId = detail.dataset.sceneCard || '';
        if (typeof guide.manualVideoSetScene === 'function') {
          guide.manualVideoSetScene(sceneId, { autoplay: true, sequence: false });
        }
      });
    });

    allSceneCards.forEach((card) => {
      card.classList.toggle('is-active', card.dataset.sceneCard === 'add_point');
    });
  });
}

initializeFeatureHubAccordions();

document.querySelectorAll('.manual-demo-toggle').forEach((button) => {
  button.addEventListener('click', () => {
    const targetId = button.dataset.demoTarget;
    const area = targetId ? document.getElementById(targetId) : null;
    if (!area) { return; }
    const willShow = area.hidden;
    area.hidden = !willShow;
    button.textContent = willShow ? '閉じる' : '試す';
    if (!willShow) { return; }
    openDemoArea(area);
  });
});
