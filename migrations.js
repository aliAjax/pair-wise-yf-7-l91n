// 数据迁移：把旧版（单份 settings + placements）草稿/状态补齐为按纸样分别保存的结构。
// 纯数据函数，不依赖 papers.js 的运行时状态，但与 papers.js 的编号约定保持一致。

const LEGACY_PAPER_IDS = ["postcard", "bookmark", "square"];
const GRID_GAP_FALLBACK = 8;
const GRID_GAP_MIN = 4;
const GRID_GAP_MAX = 18;

function clampGridGapSafe(value) {
  const gap = Math.round(Number(value));
  if (!Number.isFinite(gap)) return GRID_GAP_FALLBACK;
  return Math.min(GRID_GAP_MAX, Math.max(GRID_GAP_MIN, gap));
}

function buildDefaultBlocks() {
  const blocks = {};
  LEGACY_PAPER_IDS.forEach((paperId) => {
    blocks[paperId] = {
      paperSize: paperId,
      settings: {
        paperSize: paperId,
        flowMode: "horizontal",
        gridGap: GRID_GAP_FALLBACK
      },
      placements: [],
      used: false
    };
  });
  return blocks;
}

function normalizeRowCol(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

// 旧落字里可能混有非法项，迁移时保留可识别部分；越界项原样保留（交由冲突列表展示）。
function sanitizePlacements(placements) {
  if (!Array.isArray(placements)) return [];
  return placements
    .filter((item) => item && typeof item.typeId === "string" && item.typeId)
    .map((item) => ({
      row: normalizeRowCol(item.row),
      col: normalizeRowCol(item.col),
      typeId: item.typeId
    }));
}

// 迁移一份旧草稿（或旧工作状态）：
// 原落字整体进入其所属纸样（并沿用该版的旧方向/间距），另外两张纸样补出独立的空白版；
// 落字超出该纸样格数时不删除，而是放进 conflicts 由界面列出。
function migrateLegacyDraft(legacy) {
  if (!legacy || typeof legacy !== "object") legacy = {};
  const legacySettings = legacy.settings || {};
  const paperSize = LEGACY_PAPER_IDS.includes(legacySettings.paperSize)
    ? legacySettings.paperSize
    : "postcard";
  const placements = sanitizePlacements(legacy.placements);
  const blocks = buildDefaultBlocks();

  blocks[paperSize].placements = placements;
  blocks[paperSize].used = placements.length > 0;
  blocks[paperSize].settings.flowMode =
    legacySettings.flowMode === "vertical" ? "vertical" : "horizontal";
  blocks[paperSize].settings.gridGap = clampGridGapSafe(legacySettings.gridGap);
  // 新建的空白版保持默认横排/默认间距，不与源版互相牵连。

  const conflicts = typeof listPlacementConflicts === "function"
    ? listPlacementConflicts(paperSize, placements)
    : [];

  return {
    blocks,
    conflicts,
    sourcePaperSize: paperSize
  };
}

// 把旧版顶层状态（含草稿列表）整体迁移为新版。
function migrateLegacyState(parsed) {
  if (!parsed || typeof parsed !== "object") parsed = {};
  const result = migrateLegacyDraft(parsed);
  const blocks = result.blocks;
  const currentPaperSize = LEGACY_PAPER_IDS.includes(parsed.settings?.paperSize)
    ? parsed.settings.paperSize
    : "postcard";

  // 当前视图所在纸样视为已用（默认明信片）。
  blocks[currentPaperSize].used = true;

  const drafts = Array.isArray(parsed.drafts)
    ? parsed.drafts
        .filter((draft) => draft && typeof draft === "object")
        .map((draft) => {
          // 已经是新版草稿（含 blocks）则只做防御性补齐。
          if (draft.blocks) {
            return {
              id: draft.id || crypto.randomUUID(),
              title: typeof draft.title === "string" ? draft.title : "",
              workTitle:
                typeof draft.workTitle === "string"
                  ? draft.workTitle
                  : typeof draft.title === "string"
                    ? draft.title
                    : "",
              blocks: normalizeBlocks(draft.blocks),
              savedAt: draft.savedAt || new Date().toISOString()
            };
          }
          const migrated = migrateLegacyDraft(draft);
          return {
            id: draft.id || crypto.randomUUID(),
            title: typeof draft.title === "string" ? draft.title : "",
            workTitle: typeof draft.title === "string" ? draft.title : "",
            blocks: migrated.blocks,
            savedAt: draft.savedAt || new Date().toISOString()
          };
        })
    : [];

  return {
    blocks,
    currentPaperSize,
    workTitle: typeof parsed.settings?.workTitle === "string" ? parsed.settings.workTitle : "",
    // 字模库与当前选择原样透传，避免旧落字的 typeId 失去对应字模。
    inventory: Array.isArray(parsed.inventory) ? parsed.inventory : [],
    selectedTypeId: parsed.selectedTypeId ?? null,
    drafts
  };
}

// 防御性补齐：保证三张纸样都在，且字段结构完整。
function normalizeBlocks(blocks) {
  const fallback = buildDefaultBlocks();
  if (!blocks || typeof blocks !== "object") return fallback;
  LEGACY_PAPER_IDS.forEach((paperId) => {
    const source = blocks[paperId];
    if (!source) return;
    fallback[paperId] = {
      paperSize: paperId,
      settings: {
        paperSize: paperId,
        flowMode: source.settings?.flowMode === "vertical" ? "vertical" : "horizontal",
        gridGap: clampGridGapSafe(source.settings?.gridGap)
      },
      placements: sanitizePlacements(source.placements),
      used: Boolean(source.used)
    };
  });
  return fallback;
}
