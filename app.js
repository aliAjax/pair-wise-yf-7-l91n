const storageKey = "zfl16-movable-type-workshop";
const DATA_VERSION = 2;

const starterInventory = [
  { id: crypto.randomUUID(), char: "山", style: "宋体旧字", size: 30, quantity: 4, wear: "微磨" },
  { id: crypto.randomUUID(), char: "月", style: "宋体旧字", size: 30, quantity: 3, wear: "旧痕" },
  { id: crypto.randomUUID(), char: "风", style: "楷体木刻", size: 28, quantity: 2, wear: "微磨" },
  { id: crypto.randomUUID(), char: "花", style: "楷体木刻", size: 28, quantity: 2, wear: "新" },
  { id: crypto.randomUUID(), char: "茶", style: "黑体铅字", size: 24, quantity: 3, wear: "旧痕" },
  { id: crypto.randomUUID(), char: "雨", style: "仿宋细字", size: 22, quantity: 4, wear: "新" }
];

function buildDefaultBlocks() {
  const blocks = {};
  PAPER_IDS.forEach((paperId) => {
    blocks[paperId] = {
      paperSize: paperId,
      settings: { paperSize: paperId, flowMode: "horizontal", gridGap: GRID_GAP.fallback },
      placements: [],
      used: paperId === "postcard"
    };
  });
  return blocks;
}

function buildDefaultState() {
  return {
    version: DATA_VERSION,
    inventory: structuredClone(starterInventory),
    selectedTypeId: starterInventory[0].id,
    currentPaperSize: "postcard",
    workTitle: "晚风小笺",
    drafts: [],
    blocks: buildDefaultBlocks()
  };
}

let state = loadState();

const els = {
  paperSize: document.querySelector("#paperSize"),
  flowMode: document.querySelector("#flowMode"),
  gridGap: document.querySelector("#gridGap"),
  workTitle: document.querySelector("#workTitle"),
  stage: document.querySelector("#stage"),
  typeList: document.querySelector("#typeList"),
  typeForm: document.querySelector("#typeForm"),
  charInput: document.querySelector("#charInput"),
  styleInput: document.querySelector("#styleInput"),
  sizeInput: document.querySelector("#sizeInput"),
  quantityInput: document.querySelector("#quantityInput"),
  wearInput: document.querySelector("#wearInput"),
  inventorySearch: document.querySelector("#inventorySearch"),
  styleFilter: document.querySelector("#styleFilter"),
  selectedTypeLabel: document.querySelector("#selectedTypeLabel"),
  shortageBadge: document.querySelector("#shortageBadge"),
  paperChips: document.querySelector("#paperChips"),
  conflictBox: document.querySelector("#conflictBox"),
  continueForm: document.querySelector("#continueForm"),
  continueInput: document.querySelector("#continueInput"),
  continueMessage: document.querySelector("#continueMessage"),
  usageList: document.querySelector("#usageList"),
  draftList: document.querySelector("#draftList"),
  placedCount: document.querySelector("#placedCount"),
  inventoryCount: document.querySelector("#inventoryCount"),
  saveMessage: document.querySelector("#saveMessage"),
  saveDraftBtn: document.querySelector("#saveDraftBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  clearBoardBtn: document.querySelector("#clearBoardBtn")
};

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return buildDefaultState();
  try {
    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== "object") return buildDefaultState();

    // 新版数据：防御性补齐；旧版数据（单份 settings/placements）：迁移补齐三种纸样。
    const migrated =
      parsed.version === DATA_VERSION && parsed.blocks
        ? parsed
        : migrateLegacyState(parsed);

    const defaults = buildDefaultState();
    return {
      ...defaults,
      ...migrated,
      version: DATA_VERSION,
      inventory: Array.isArray(migrated.inventory) && migrated.inventory.length
        ? migrated.inventory
        : defaults.inventory,
      // 保留原选择；即便该字模暂时不在库中（旧数据/已删除），也不强行替换，
      // 落字仍按原 typeId 渲染为「字模已缺失」，不偷改用户数据。
      selectedTypeId: migrated.selectedTypeId ?? defaults.inventory[0].id,
      currentPaperSize: isValidPaperId(migrated.currentPaperSize)
        ? migrated.currentPaperSize
        : "postcard",
      workTitle: typeof migrated.workTitle === "string" ? migrated.workTitle : "",
      drafts: Array.isArray(migrated.drafts) ? migrated.drafts : [],
      blocks: normalizeBlocks(migrated.blocks)
    };
  } catch (error) {
    console.warn("草稿状态解析失败，已回退到初始状态", error);
    return buildDefaultState();
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function getCurrentBlock() {
  return state.blocks[state.currentPaperSize];
}

function getSelectedType() {
  return state.inventory.find((item) => item.id === state.selectedTypeId) || null;
}

function getUsage(placements = getCurrentBlock().placements) {
  return placements.reduce((acc, placement) => {
    acc[placement.typeId] = (acc[placement.typeId] || 0) + 1;
    return acc;
  }, {});
}

function renderSettings() {
  const block = getCurrentBlock();
  els.paperSize.value = state.currentPaperSize;
  els.flowMode.value = block.settings.flowMode;
  els.gridGap.value = block.settings.gridGap;
  els.workTitle.value = state.workTitle;
}

function renderPaperChips() {
  els.paperChips.innerHTML = PAPER_SPECS.map((spec) => {
    const block = state.blocks[spec.id];
    const active = spec.id === state.currentPaperSize ? "active" : "";
    const used = block.used ? "used" : "unused";
    return `
      <button type="button" role="tab" class="paper-chip ${active} ${used}" data-paper="${spec.id}">
        ${spec.label}
        <span>${block.placements.length}字${block.used ? " · 已用" : ""}</span>
      </button>
    `;
  }).join("");
}

function renderStyleFilter() {
  const current = els.styleFilter.value || "all";
  const styles = [...new Set(state.inventory.map((item) => item.style))].sort((a, b) =>
    a.localeCompare(b, "zh-CN")
  );
  els.styleFilter.innerHTML = `<option value="all">全部风格</option>${styles
    .map((style) => `<option value="${escapeHtml(style)}">${escapeHtml(style)}</option>`)
    .join("")}`;
  els.styleFilter.value = styles.includes(current) ? current : "all";
}

function renderInventory() {
  const keyword = els.inventorySearch.value.trim();
  const style = els.styleFilter.value;
  const usage = getUsage();
  const items = state.inventory.filter((item) => {
    const matchesKeyword = !keyword || `${item.char}${item.style}${item.wear}`.includes(keyword);
    const matchesStyle = style === "all" || item.style === style;
    return matchesKeyword && matchesStyle;
  });

  els.inventoryCount.textContent = `${state.inventory.length}枚字模`;
  els.typeList.innerHTML = items
    .map((item) => {
      const used = usage[item.id] || 0;
      const selected = item.id === state.selectedTypeId ? "selected" : "";
      return `
        <article class="type-card ${selected}" draggable="true" data-type-id="${item.id}">
          <div class="glyph" style="font-size:${Math.min(item.size, 36)}px">${escapeHtml(item.char)}</div>
          <div class="type-meta">
            <strong>${escapeHtml(item.char)} · ${escapeHtml(item.style)}</strong>
            <span>${item.size}px · ${escapeHtml(item.wear)} · 本版已用${used}/${item.quantity}</span>
          </div>
          <button class="mini-btn" title="删除字模" data-delete-type="${item.id}" type="button">×</button>
        </article>
      `;
    })
    .join("");
}

function renderStage() {
  const block = getCurrentBlock();
  const spec = getPaperSpec(state.currentPaperSize);
  const { cols, rows } = spec;
  // 越界落字仍然保留，只是不画在格子里；冲突区单独列出。
  const inBounds = block.placements.filter((item) =>
    isPlacementInBounds(state.currentPaperSize, item.row, item.col)
  );
  const map = new Map(inBounds.map((item) => [placementKey(item.row, item.col), item]));
  els.stage.className = `stage ${state.currentPaperSize}`;
  els.stage.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  els.stage.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
  els.stage.style.gap = `${block.settings.gridGap}px`;
  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const placement = map.get(placementKey(row, col));
      const type = placement ? state.inventory.find((item) => item.id === placement.typeId) : null;
      const vertical = block.settings.flowMode === "vertical" ? "vertical" : "";
      cells.push(`
        <button class="cell ${type ? "used" : ""} ${vertical}" data-row="${row}" data-col="${col}" type="button" aria-label="第${row + 1}行第${col + 1}列">
          ${type ? escapeHtml(type.char) : ""}
        </button>
      `);
    }
  }
  els.stage.innerHTML = cells.join("");
  renderConflicts();
}

function renderConflicts() {
  const conflicts = listPlacementConflicts(state.currentPaperSize, getCurrentBlock().placements);
  if (!conflicts.length) {
    els.conflictBox.hidden = true;
    els.conflictBox.innerHTML = "";
    return;
  }
  const spec = getPaperSpec(state.currentPaperSize);
  const lines = conflicts.map((placement) => {
    const type = state.inventory.find((item) => item.id === placement.typeId);
    const label = type ? `${escapeHtml(type.char)}（${escapeHtml(type.style)}）` : "字模已缺失";
    return `<li>第${placement.row + 1}行第${placement.col + 1}列：${label}</li>`;
  }).join("");
  els.conflictBox.hidden = false;
  els.conflictBox.innerHTML = `
    <strong>${spec.label}只有 ${spec.cols}×${spec.rows} 格，以下 ${conflicts.length} 个落字越界。已保留在原版，未做删除：</strong>
    <ul>${lines}</ul>
  `;
}

function renderUsage() {
  const block = getCurrentBlock();
  const usage = getUsage();
  const entries = state.inventory.filter((item) => usage[item.id]);
  els.placedCount.textContent = `${block.placements.length}个落字（本版）`;

  const shortages = entries.filter((item) => usage[item.id] > item.quantity);
  els.shortageBadge.textContent = shortages.length ? `${shortages.length}处超量` : "数量充足";
  els.shortageBadge.className = `badge ${shortages.length ? "warn" : "ok"}`;

  const selectedType = getSelectedType();
  els.selectedTypeLabel.textContent = selectedType
    ? `当前：${selectedType.char} · ${selectedType.style}`
    : "未选择字模";

  els.usageList.innerHTML =
    entries
      .map((item) => {
        const used = usage[item.id];
        const warn = used > item.quantity ? "warn" : "";
        return `
          <div class="usage-item ${warn}">
            <strong>${escapeHtml(item.char)} ${escapeHtml(item.style)}</strong>
            <span>${used}/${item.quantity}</span>
          </div>
        `;
      })
      .join("") || `<p class="empty">这一版还没有落字。</p>`;
}

function describeDraft(draft) {
  const usedPapers = PAPER_SPECS.filter((spec) => draft.blocks[spec.id]?.placements.length)
    .map((spec) => spec.label);
  const total = PAPER_SPECS.reduce(
    (sum, spec) => sum + (draft.blocks[spec.id]?.placements.length || 0),
    0
  );
  return `${total}个落字 · ${usedPapers.join("、") || "无"} · ${new Date(draft.savedAt).toLocaleString("zh-CN")}`;
}

function renderDrafts() {
  els.draftList.innerHTML =
    state.drafts
      .map(
        (draft) => `
          <article class="draft-item">
            <strong>${escapeHtml(draft.title || "未命名作品")}</strong>
            <span>${escapeHtml(describeDraft(draft))}</span>
            <div class="draft-actions">
              <button type="button" data-load-draft="${draft.id}">载入</button>
              <button type="button" data-delete-draft="${draft.id}">删除</button>
            </div>
          </article>
        `
      )
      .join("") || `<p class="empty">还没有保存草稿。</p>`;
}

function renderAll() {
  saveState();
  renderSettings();
  renderPaperChips();
  renderStyleFilter();
  renderInventory();
  renderStage();
  renderUsage();
  renderDrafts();
}

function showInlineMessage(element, text, kind = "error", timeout = 0) {
  element.textContent = text;
  element.className = `inline-msg ${kind}`;
  element.hidden = false;
  if (element._timer) clearTimeout(element._timer);
  if (timeout) {
    element._timer = setTimeout(() => {
      element.hidden = true;
    }, timeout);
  }
}

function placeType(row, col, typeId = state.selectedTypeId) {
  if (!typeId) return;
  const block = getCurrentBlock();
  // 越界格不允许直接落字；旧数据里的越界项不会被这里碰到。
  if (!isPlacementInBounds(state.currentPaperSize, row, col)) return;
  block.used = true;
  const existingIndex = block.placements.findIndex((item) => item.row === row && item.col === col);
  if (existingIndex >= 0) {
    if (block.placements[existingIndex].typeId === typeId) {
      block.placements.splice(existingIndex, 1);
    } else {
      block.placements[existingIndex].typeId = typeId;
    }
  } else {
    block.placements.push({ row, col, typeId });
  }
  renderAll();
}

function switchPaper(paperId) {
  if (!isValidPaperId(paperId) || paperId === state.currentPaperSize) return;
  // 切换只改当前视图；各版位置、网格、方向都存在自己的 block 里。
  state.currentPaperSize = paperId;
  state.blocks[paperId].used = true;
  hideContinueMessage();
  renderAll();
}

function addType(event) {
  event.preventDefault();
  const item = {
    id: crypto.randomUUID(),
    char: els.charInput.value.trim(),
    style: els.styleInput.value.trim(),
    size: Number(els.sizeInput.value),
    quantity: Number(els.quantityInput.value),
    wear: els.wearInput.value
  };
  if (!item.char || !item.style) return;
  state.inventory.unshift(item);
  state.selectedTypeId = item.id;
  els.typeForm.reset();
  els.sizeInput.value = 24;
  els.quantityInput.value = 3;
  renderAll();
}

// 保存前校验：作品名不能为空；每个「已用」纸样都必须有落字（漏排版要原地说明）。
// 校验不过时整张贴纸草稿不动，不新增也不覆盖。
function validateBeforeSave() {
  const title = state.workTitle.trim();
  const problems = [];
  if (!title) problems.push("作品名为空，请先填写作品名。");

  const missing = PAPER_SPECS.filter((spec) => {
    const block = state.blocks[spec.id];
    return block.used && block.placements.length === 0;
  });
  if (missing.length) {
    problems.push(`以下已用纸样还没有落字（漏排版）：${missing.map((s) => s.label).join("、")}。`);
  }
  return problems;
}

function saveDraft() {
  const problems = validateBeforeSave();
  if (problems.length) {
    showInlineMessage(els.saveMessage, problems.join(" "), "error");
    return; // 整张草稿不动
  }
  const title = state.workTitle.trim();
  state.drafts.unshift({
    id: crypto.randomUUID(),
    title,
    workTitle: title,
    blocks: structuredClone(state.blocks),
    savedAt: new Date().toISOString()
  });
  state.drafts = state.drafts.slice(0, 8);
  showInlineMessage(els.saveMessage, `已保存「${title}」，三张纸样的版面分别存档。`, "ok", 4000);
  renderAll();
}

function loadDraft(draft) {
  state.workTitle = draft.workTitle || draft.title || "";
  state.blocks = normalizeBlocks(structuredClone(draft.blocks));
  // 载入后定位到第一个有落字的纸样，没有则留在明信片。
  const firstUsed = PAPER_SPECS.find((spec) => state.blocks[spec.id].placements.length);
  state.currentPaperSize = firstUsed ? firstUsed.id : "postcard";
  els.inventorySearch.value = "";
  els.styleFilter.value = "all";
  els.continueInput.value = "";
  hideContinueMessage();
  showInlineMessage(els.saveMessage, `已载入草稿「${draft.title || "未命名作品"}」。`, "ok", 4000);
  renderAll();
}

function exportPreview() {
  const block = getCurrentBlock();
  const spec = getPaperSpec(state.currentPaperSize);
  const { cols, rows } = spec;
  const cell = spec.cell;
  const gap = block.settings.gridGap;
  const margin = 48;
  const width = cols * cell + (cols - 1) * gap + margin * 2;
  const height = rows * cell + (rows - 1) * gap + margin * 2 + 70;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fffaf1";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#2f2921";
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, width - 36, height - 36);
  ctx.fillStyle = "#22201c";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText(`${state.workTitle || "未命名作品"} · ${spec.label}`, margin, 50);
  ctx.font = "bold 30px serif";

  // 按当前纸样出图：只画界内落字，越界项不出现在导出图里（仍保留在数据中）。
  block.placements.forEach((placement) => {
    if (!isPlacementInBounds(state.currentPaperSize, placement.row, placement.col)) return;
    const type = state.inventory.find((item) => item.id === placement.typeId);
    if (!type) return;
    const x = margin + placement.col * (cell + gap);
    const y = margin + 45 + placement.row * (cell + gap);
    ctx.fillStyle = "#2f2921";
    ctx.fillRect(x, y, cell, cell);
    ctx.fillStyle = "#fff5df";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.min(type.size + 8, 42)}px serif`;
    ctx.fillText(type.char, x + cell / 2, y + cell / 2);
  });
  const link = document.createElement("a");
  const safeName = (state.workTitle || "movable-type").replace(/[\\/:*?"<>|]/g, "_");
  link.download = `${safeName}-${spec.label}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function hideContinueMessage() {
  els.continueMessage.hidden = true;
  els.continueMessage.textContent = "";
}

function handleContinue(event) {
  event.preventDefault();
  const text = els.continueInput.value;
  if (!text.trim()) {
    showInlineMessage(els.continueMessage, "请先粘贴要接续的文字。", "error");
    return;
  }
  const block = getCurrentBlock();
  const spec = getPaperSpec(state.currentPaperSize);
  const result = flowTextOntoPage(text, block, spec, state.inventory);
  block.placements.push(...result.placements);
  if (result.placements.length) block.used = true;

  const notes = [];
  notes.push(`本页接续落字 ${result.placed} 个。`);
  if (result.shortages.length) {
    notes.push(`「${result.shortages.join("")}」因字模库存不足跳过。`);
  }
  if (result.remaining) {
    // 页面放满：未放下的字原样交还到输入框，绝不丢弃。
    els.continueInput.value = result.remaining;
    notes.push(`本页已放满，余下 ${Array.from(result.remaining).length} 字保留在输入框，可换纸样或新建草稿后继续。`);
  } else {
    els.continueInput.value = "";
  }
  showInlineMessage(
    els.continueMessage,
    notes.join(" "),
    result.remaining || result.shortages.length ? "warn" : "ok"
  );
  renderAll();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

els.paperSize.addEventListener("change", () => switchPaper(els.paperSize.value));

els.flowMode.addEventListener("change", () => {
  getCurrentBlock().settings.flowMode = normalizeFlowMode(els.flowMode.value);
  renderAll();
});

els.gridGap.addEventListener("input", () => {
  getCurrentBlock().settings.gridGap = clampGridGap(els.gridGap.value);
  renderAll();
});

els.workTitle.addEventListener("input", () => {
  state.workTitle = els.workTitle.value;
  saveState();
});

els.typeForm.addEventListener("submit", addType);
els.inventorySearch.addEventListener("input", renderInventory);
els.styleFilter.addEventListener("change", renderInventory);
els.saveDraftBtn.addEventListener("click", saveDraft);
els.exportBtn.addEventListener("click", exportPreview);
els.continueForm.addEventListener("submit", handleContinue);

els.clearBoardBtn.addEventListener("click", () => {
  const block = getCurrentBlock();
  block.placements = [];
  // 清空落字不改变「该纸样已启用」这一事实：保存时仍会按漏排版校验，
  // 避免清空一张已用纸样后绕开「每个已用纸样都需有落字」的要求。
  hideContinueMessage();
  renderAll();
});

els.paperChips.addEventListener("click", (event) => {
  const chip = event.target.closest("[data-paper]");
  if (chip) switchPaper(chip.dataset.paper);
});

els.typeList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-type]");
  if (deleteButton) {
    const typeId = deleteButton.dataset.deleteType;
    state.inventory = state.inventory.filter((item) => item.id !== typeId);
    // 字模删除后，各版落字原样保留，冲突/核对区会显示「字模已缺失」，不偷偷删数据。
    if (state.selectedTypeId === typeId) state.selectedTypeId = state.inventory[0]?.id || null;
    renderAll();
    return;
  }
  const card = event.target.closest("[data-type-id]");
  if (!card) return;
  state.selectedTypeId = card.dataset.typeId;
  renderAll();
});

els.typeList.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-type-id]");
  if (!card) return;
  event.dataTransfer.setData("text/plain", card.dataset.typeId);
});

els.stage.addEventListener("dragover", (event) => {
  if (event.target.closest(".cell")) event.preventDefault();
});

els.stage.addEventListener("drop", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell) return;
  event.preventDefault();
  placeType(Number(cell.dataset.row), Number(cell.dataset.col), event.dataTransfer.getData("text/plain"));
});

els.stage.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell) return;
  placeType(Number(cell.dataset.row), Number(cell.dataset.col));
});

els.draftList.addEventListener("click", (event) => {
  const loadButton = event.target.closest("[data-load-draft]");
  const deleteButton = event.target.closest("[data-delete-draft]");
  if (loadButton) {
    const draft = state.drafts.find((item) => item.id === loadButton.dataset.loadDraft);
    if (draft) loadDraft(draft);
  }
  if (deleteButton) {
    state.drafts = state.drafts.filter((item) => item.id !== deleteButton.dataset.deleteDraft);
    renderAll();
  }
});

renderAll();
