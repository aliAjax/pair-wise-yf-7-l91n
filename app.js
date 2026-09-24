const storageKey = "zfl16-movable-type-workshop";

const starterInventory = [
  { id: crypto.randomUUID(), char: "山", style: "宋体旧字", size: 30, quantity: 4, wear: "微磨" },
  { id: crypto.randomUUID(), char: "月", style: "宋体旧字", size: 30, quantity: 3, wear: "旧痕" },
  { id: crypto.randomUUID(), char: "风", style: "楷体木刻", size: 28, quantity: 2, wear: "微磨" },
  { id: crypto.randomUUID(), char: "花", style: "楷体木刻", size: 28, quantity: 2, wear: "新" },
  { id: crypto.randomUUID(), char: "茶", style: "黑体铅字", size: 24, quantity: 3, wear: "旧痕" },
  { id: crypto.randomUUID(), char: "雨", style: "仿宋细字", size: 22, quantity: 4, wear: "新" }
];

function createDefaultState() {
  return {
    version: Migrate.SCHEMA_VERSION,
    inventory: structuredClone(starterInventory),
    selectedTypeId: starterInventory[0].id,
    workTitle: "晚风小笺",
    activePaper: "postcard",
    usedPapers: ["postcard"],
    layouts: Papers.createEmptyLayouts(),
    drafts: []
  };
}

let bootMigrated = false;
let state = loadState();

const els = {
  paperSize: document.querySelector("#paperSize"),
  flowMode: document.querySelector("#flowMode"),
  gridGap: document.querySelector("#gridGap"),
  workTitle: document.querySelector("#workTitle"),
  paperHint: document.querySelector("#paperHint"),
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
  usageList: document.querySelector("#usageList"),
  draftList: document.querySelector("#draftList"),
  placedCount: document.querySelector("#placedCount"),
  inventoryCount: document.querySelector("#inventoryCount"),
  conflictStrip: document.querySelector("#conflictStrip"),
  conflictList: document.querySelector("#conflictList"),
  pager: document.querySelector("#pager"),
  pageLabel: document.querySelector("#pageLabel"),
  prevPageBtn: document.querySelector("#prevPageBtn"),
  nextPageBtn: document.querySelector("#nextPageBtn"),
  addPageBtn: document.querySelector("#addPageBtn"),
  deletePageBtn: document.querySelector("#deletePageBtn"),
  saveNotice: document.querySelector("#saveNotice"),
  saveDraftBtn: document.querySelector("#saveDraftBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  clearBoardBtn: document.querySelector("#clearBoardBtn")
};

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return createDefaultState();
  let parsed;
  try {
    parsed = JSON.parse(saved);
  } catch {
    return createDefaultState();
  }
  const result = Migrate.migrateState(parsed, crypto.randomUUID.bind(crypto));
  bootMigrated = result.migrated;
  const migrated = result.state;
  // 迁移后补一遍默认值，保证新增字段齐全
  const defaults = createDefaultState();
  if (!Array.isArray(migrated.inventory) || migrated.inventory.length === 0) {
    migrated.inventory = defaults.inventory;
  }
  if (!migrated.selectedTypeId || !migrated.inventory.some((item) => item.id === migrated.selectedTypeId)) {
    migrated.selectedTypeId = migrated.inventory[0]?.id || null;
  }
  if (!migrated.usedPapers.includes(migrated.activePaper)) migrated.usedPapers.push(migrated.activePaper);
  Object.values(migrated.layouts).forEach((layout) => Paging.ensurePages(layout));
  return migrated;
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function getActiveLayout() {
  return state.layouts[state.activePaper];
}

function markPaperUsed(paperId = state.activePaper) {
  if (!state.usedPapers.includes(paperId)) state.usedPapers.push(paperId);
}

function getSelectedType() {
  return state.inventory.find((item) => item.id === state.selectedTypeId) || null;
}

// 用量按当前纸样的所有页合计（导出的是单纸样，超量判断也以单纸样为准）
function getUsage() {
  const layout = getActiveLayout();
  return layout.pages.flat().reduce((acc, placement) => {
    acc[placement.typeId] = (acc[placement.typeId] || 0) + 1;
    return acc;
  }, {});
}

function renderSettings() {
  const layout = getActiveLayout();
  els.paperSize.value = state.activePaper;
  els.flowMode.value = layout.flowMode;
  els.gridGap.value = layout.gridGap;
  els.workTitle.value = state.workTitle;
  els.paperHint.textContent = `已用纸样：${state.usedPapers.map((id) => Papers.getPaper(id).label).join("、")}`;
}

function renderStyleFilter() {
  const current = els.styleFilter.value || "all";
  const styles = [...new Set(state.inventory.map((item) => item.style))].sort((a, b) => a.localeCompare(b, "zh-CN"));
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
            <span>${item.size}px · ${escapeHtml(item.wear)} · 已用${used}/${item.quantity}</span>
          </div>
          <button class="mini-btn" title="删除字模" data-delete-type="${item.id}" type="button">×</button>
        </article>
      `;
    })
    .join("");
}

function renderStage() {
  const paper = Papers.getPaper(state.activePaper);
  const layout = getActiveLayout();
  const page = Paging.currentPage(layout);
  const map = new Map(page.map((item) => [`${item.row}:${item.col}`, item]));
  els.stage.className = `stage ${state.activePaper}`;
  els.stage.style.gridTemplateColumns = `repeat(${paper.cols}, minmax(0, 1fr))`;
  els.stage.style.gridTemplateRows = `repeat(${paper.rows}, minmax(0, 1fr))`;
  els.stage.style.gap = `${layout.gridGap}px`;
  const cells = [];
  for (let row = 0; row < paper.rows; row += 1) {
    for (let col = 0; col < paper.cols; col += 1) {
      const placement = map.get(`${row}:${col}`);
      const type = placement ? state.inventory.find((item) => item.id === placement.typeId) : null;
      const vertical = layout.flowMode === "vertical" ? "vertical" : "";
      cells.push(`
        <button class="cell ${type ? "used" : ""} ${vertical}" data-row="${row}" data-col="${col}" type="button" aria-label="第${row + 1}行第${col + 1}列">
          ${type ? escapeHtml(type.char) : ""}
        </button>
      `);
    }
  }
  els.stage.innerHTML = cells.join("");
}

function renderConflicts() {
  const result = Papers.validateLayout(state.activePaper, getActiveLayout());
  if (result.valid) {
    els.conflictStrip.hidden = true;
    els.conflictList.innerHTML = "";
    return;
  }
  els.conflictStrip.hidden = false;
  els.conflictList.innerHTML = result.conflicts
    .map((conflict) => {
      const placement =
        conflict.kind === "overflow"
          ? getActiveLayout().pages[conflict.page]?.[conflict.index]
          : null;
      const type = placement ? state.inventory.find((item) => item.id === placement.typeId) : null;
      const glyph = type ? `「${escapeHtml(type.char)}」` : "";
      return `<li>${glyph}${escapeHtml(Papers.describeConflict(conflict))}，已保留在原页</li>`;
    })
    .join("");
}

function renderPager() {
  const layout = getActiveLayout();
  Paging.ensurePages(layout);
  els.pageLabel.textContent = `第 ${layout.pageIndex + 1} / ${layout.pages.length} 页`;
  els.prevPageBtn.disabled = layout.pageIndex === 0;
  els.nextPageBtn.disabled = layout.pageIndex === layout.pages.length - 1;
  const page = Paging.currentPage(layout);
  els.deletePageBtn.disabled = layout.pages.length === 1 || page.length > 0;
  els.deletePageBtn.title = els.deletePageBtn.disabled && page.length > 0 ? "该页仍有落字" : "删除当前空页";
}

function renderUsage() {
  const usage = getUsage();
  const entries = state.inventory.filter((item) => usage[item.id]);
  const total = Paging.countAllPages(getActiveLayout());
  els.placedCount.textContent = `${total}个落字`;

  const shortages = entries.filter((item) => usage[item.id] > item.quantity);
  els.shortageBadge.textContent = shortages.length ? `${shortages.length}处超量` : "数量充足";
  els.shortageBadge.className = `badge ${shortages.length ? "warn" : "ok"}`;

  const selectedType = getSelectedType();
  els.selectedTypeLabel.textContent = selectedType ? `当前：${selectedType.char} · ${selectedType.style}` : "未选择字模";

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
      .join("") || `<p class="empty">还没有落字。</p>`;
}

function paperSummary(draft) {
  return Papers.PAPER_ORDER
    .filter((id) => {
      const layout = draft.layouts?.[id];
      return layout && Paging.countAllPages(layout) > 0;
    })
    .map((id) => `${Papers.getPaper(id).label}${Paging.countAllPages(draft.layouts[id])}字`)
    .join(" · ");
}

function renderDrafts() {
  els.draftList.innerHTML =
    state.drafts
      .map(
        (draft) => `
          <article class="draft-item">
            <strong>${escapeHtml(draft.title || "未命名作品")}</strong>
            <span>${escapeHtml(paperSummary(draft) || "无落字")} · ${new Date(draft.savedAt).toLocaleString("zh-CN")}</span>
            ${draft.migratedFromSingle ? `<span class="legacy-tag">旧单版已补齐纸样</span>` : ""}
            <div class="draft-actions">
              <button type="button" data-load-draft="${draft.id}">载入</button>
              <button type="button" data-delete-draft="${draft.id}">删除</button>
            </div>
          </article>
        `
      )
      .join("") || `<p class="empty">还没有保存草稿。</p>`;
}

function showNotice(message, kind = "warn") {
  els.saveNotice.textContent = message;
  els.saveNotice.className = `notice ${kind}`;
  els.saveNotice.hidden = false;
}

function renderAll() {
  saveState();
  renderSettings();
  renderStyleFilter();
  renderInventory();
  renderStage();
  renderConflicts();
  renderPager();
  renderUsage();
  renderDrafts();
}

function placeType(row, col, typeId = state.selectedTypeId) {
  if (!typeId) return;
  markPaperUsed();
  const page = Paging.currentPage(getActiveLayout());
  const existingIndex = page.findIndex((item) => item.row === row && item.col === col);
  if (existingIndex >= 0) {
    if (page[existingIndex].typeId === typeId) {
      page.splice(existingIndex, 1);
    } else {
      page[existingIndex].typeId = typeId;
    }
  } else {
    page.push({ row, col, typeId });
  }
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

// 保存前校验：作品名为空、已用纸样缺落字，都原地说明且整张草稿不动
function validateBeforeSave() {
  if (!state.workTitle.trim()) {
    return { ok: false, message: "作品名为空，请先填写作品名。" };
  }
  const emptyPapers = state.usedPapers.filter((id) => !Paging.hasAnyPlacement(state.layouts[id]));
  if (emptyPapers.length > 0) {
    const names = emptyPapers.map((id) => Papers.getPaper(id).label).join("、");
    return { ok: false, message: `以下纸样还没有落字：${names}。请补齐排版后再保存。` };
  }
  return { ok: true };
}

function snapshotLayouts() {
  return Object.fromEntries(
    Papers.PAPER_ORDER.map((id) => {
      const copy = structuredClone(state.layouts[id]);
      copy.pageIndex = 0;
      return [id, copy];
    })
  );
}

function saveDraft() {
  const check = validateBeforeSave();
  if (!check.ok) {
    showNotice(check.message, "warn");
    return;
  }
  state.drafts.unshift({
    version: Migrate.SCHEMA_VERSION,
    id: crypto.randomUUID(),
    title: state.workTitle.trim(),
    savedAt: new Date().toISOString(),
    activePaper: state.activePaper,
    usedPapers: [...state.usedPapers],
    layouts: snapshotLayouts()
  });
  state.drafts = state.drafts.slice(0, 8);
  showNotice("草稿已保存。", "ok");
  renderAll();
}

function exportPreview() {
  const paper = Papers.getPaper(state.activePaper);
  const layout = getActiveLayout();
  const page = Paging.currentPage(layout);
  const cell = state.activePaper === "bookmark" ? 44 : 56;
  const gap = layout.gridGap;
  const margin = 48;
  const width = paper.cols * cell + (paper.cols - 1) * gap + margin * 2;
  const height = paper.rows * cell + (paper.rows - 1) * gap + margin * 2 + 70;
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
  ctx.font = "bold 28px sans-serif";
  ctx.fillText(state.workTitle || "未命名作品", margin, 50);
  ctx.font = "bold 30px serif";
  page.forEach((placement) => {
    // 只导出当前纸样当前页内的落字；越界落字保留在数据里，不上图
    if (!Papers.inBounds(state.activePaper, placement.row, placement.col)) return;
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
  const safeTitle = (state.workTitle || "movable-type").replace(/[\\/:*?"<>|]/g, "_");
  const link = document.createElement("a");
  link.download = `${safeTitle}-${paper.label}-第${layout.pageIndex + 1}页.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// 切换纸样只改当前视图；各版的位置、网格和方向分别保存，越界落字原样保留
els.paperSize.addEventListener("change", () => {
  state.activePaper = els.paperSize.value;
  markPaperUsed();
  renderAll();
});

els.flowMode.addEventListener("change", () => {
  getActiveLayout().flowMode = Papers.normalizeFlow(els.flowMode.value);
  renderAll();
});

els.gridGap.addEventListener("input", () => {
  getActiveLayout().gridGap = Papers.clampGap(els.gridGap.value);
  saveState();
  renderSettings();
  renderStage();
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
els.clearBoardBtn.addEventListener("click", () => {
  getActiveLayout().pages = [[]];
  getActiveLayout().pageIndex = 0;
  showNotice("当前纸样已清空；其他纸样的落字仍保留。", "ok");
  renderAll();
});

els.prevPageBtn.addEventListener("click", () => {
  const layout = getActiveLayout();
  Paging.goToPage(layout, layout.pageIndex - 1);
  renderAll();
});

els.nextPageBtn.addEventListener("click", () => {
  const layout = getActiveLayout();
  Paging.goToPage(layout, layout.pageIndex + 1);
  renderAll();
});

els.addPageBtn.addEventListener("click", () => {
  markPaperUsed();
  Paging.addPage(getActiveLayout());
  renderAll();
});

els.deletePageBtn.addEventListener("click", () => {
  const result = Paging.removePage(getActiveLayout(), getActiveLayout().pageIndex);
  if (!result.removed) showNotice(result.reason, "warn");
  renderAll();
});

els.typeList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-type]");
  if (deleteButton) {
    const typeId = deleteButton.dataset.deleteType;
    state.inventory = state.inventory.filter((item) => item.id !== typeId);
    Object.values(state.layouts).forEach((layout) => {
      layout.pages = layout.pages.map((page) => page.filter((item) => item.typeId !== typeId));
    });
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
    const rawDraft = state.drafts.find((item) => item.id === loadButton.dataset.loadDraft);
    if (!rawDraft) return;
    const { draft, migrated } = Migrate.migrateDraft(rawDraft, crypto.randomUUID.bind(crypto));
    state.workTitle = draft.title;
    state.activePaper = draft.activePaper;
    state.usedPapers = draft.usedPapers.length ? [...draft.usedPapers] : [draft.activePaper];
    state.layouts = draft.layouts;
    // 载入旧草稿时，用补齐后的结构替换列表里的旧单版记录
    state.drafts = state.drafts.map((item) => (item.id === draft.id ? draft : item));
    Object.values(state.layouts).forEach((layout) => Paging.ensurePages(layout));
    showNotice(
      migrated ? "旧单版草稿已载入，并补齐明信片、书签、方形小笺三种纸样。" : "草稿已载入。",
      "ok"
    );
    renderAll();
  }
  if (deleteButton) {
    state.drafts = state.drafts.filter((item) => item.id !== deleteButton.dataset.deleteDraft);
    renderAll();
  }
});

renderAll();
if (bootMigrated) {
  showNotice("已检测到旧版单版数据，自动迁移并补齐明信片、书签、方形小笺三种纸样。", "ok");
}
