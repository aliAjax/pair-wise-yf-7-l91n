// 纸样校验：集中定义三种纸样的尺寸与取值范围，并提供越界判定。
// 该脚本只做纯数据校验，不读写 DOM / localStorage。

const PAPER_SPECS = [
  { id: "postcard", label: "明信片", cols: 16, rows: 10, cell: 56 },
  { id: "bookmark", label: "书签", cols: 7, rows: 18, cell: 44 },
  { id: "square", label: "方形小笺", cols: 12, rows: 12, cell: 52 }
];

const PAPER_IDS = PAPER_SPECS.map((paper) => paper.id);

const GRID_GAP = { min: 4, max: 18, fallback: 8 };
const FLOW_MODES = ["horizontal", "vertical"];

function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0;
}

// 校验单条纸样配置：编号、名称齐全，行列数为正整数。
function validatePaperSpec(spec) {
  if (!spec || typeof spec !== "object") return false;
  if (typeof spec.id !== "string" || !spec.id) return false;
  if (typeof spec.label !== "string" || !spec.label) return false;
  return isPositiveInt(spec.cols) && isPositiveInt(spec.rows) && isPositiveInt(spec.cell);
}

// 启动时自检：三种纸样必须齐全、编号不重复、尺寸合法。
function validatePaperSpecs(specs) {
  if (!Array.isArray(specs) || specs.length === 0) {
    throw new Error("纸样配置缺失");
  }
  const seen = new Set();
  specs.forEach((spec) => {
    if (!validatePaperSpec(spec)) {
      throw new Error(`纸样配置不合法：${JSON.stringify(spec)}`);
    }
    if (seen.has(spec.id)) {
      throw new Error(`纸样编号重复：${spec.id}`);
    }
    seen.add(spec.id);
  });
  PAPER_IDS.forEach((id) => {
    if (!seen.has(id)) throw new Error(`缺少纸样：${id}`);
  });
}

function isValidPaperId(id) {
  return PAPER_IDS.includes(id);
}

function getPaperSpec(id) {
  const spec = PAPER_SPECS.find((item) => item.id === id);
  if (!spec) {
    console.warn(`未知纸样 "${id}"，回退到明信片`);
    return PAPER_SPECS[0];
  }
  return spec;
}

function clampGridGap(value) {
  if (!Number.isFinite(Number(value))) return GRID_GAP.fallback;
  const gap = Math.round(Number(value));
  return Math.min(GRID_GAP.max, Math.max(GRID_GAP.min, gap));
}

function normalizeFlowMode(value) {
  return FLOW_MODES.includes(value) ? value : "horizontal";
}

function isPlacementInBounds(paperId, row, col) {
  const { cols, rows } = getPaperSpec(paperId);
  return row >= 0 && row < rows && col >= 0 && col < cols;
}

function placementKey(row, col) {
  return `${row}:${col}`;
}

// 找出超出当前纸样格数的落字（书签格数最少，最容易触发）。
// 这些落字不会被删除，由界面列出冲突并继续保留在原数据中。
function listPlacementConflicts(paperId, placements) {
  return placements.filter(
    (placement) => !isPlacementInBounds(paperId, placement.row, placement.col)
  );
}

validatePaperSpecs(PAPER_SPECS);
