/*
 * 纸样校验脚本
 * 负责三种纸样（明信片 / 书签 / 方形小笺）的网格规格、默认版面构造与越界校验。
 * 纯逻辑、无 DOM 依赖，浏览器与 Node 均可加载。
 */
(function (root, factory) {
  const api = factory();
  root.Papers = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const PAPER_SIZES = {
    postcard: { id: "postcard", label: "明信片", cols: 16, rows: 10 },
    bookmark: { id: "bookmark", label: "书签", cols: 7, rows: 18 },
    square: { id: "square", label: "方形小笺", cols: 12, rows: 12 }
  };
  const PAPER_ORDER = ["postcard", "bookmark", "square"];
  const FLOW_MODES = ["horizontal", "vertical"];
  const GAP_MIN = 4;
  const GAP_MAX = 18;
  const GAP_DEFAULT = 8;

  function isPaperId(id) {
    return Object.prototype.hasOwnProperty.call(PAPER_SIZES, id);
  }

  function getPaper(id) {
    return PAPER_SIZES[id] || PAPER_SIZES.postcard;
  }

  function normalizeFlow(value) {
    return value === "vertical" ? "vertical" : "horizontal";
  }

  function clampGap(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return GAP_DEFAULT;
    return Math.min(GAP_MAX, Math.max(GAP_MIN, Math.round(num)));
  }

  // 只校验落字的数据形状；越界落字不在此剔除，由 validateLayout 列出冲突并保留
  function isValidPlacement(item) {
    return (
      item &&
      Number.isInteger(item.row) &&
      Number.isInteger(item.col) &&
      typeof item.typeId === "string" &&
      item.typeId.length > 0
    );
  }

  function sanitizePlacements(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(isValidPlacement).map((item) => ({
      row: item.row,
      col: item.col,
      typeId: item.typeId
    }));
  }

  // 构造一个纸样版面：方向、网格间距独立；落字按页存放
  function createLayout(input) {
    const sourcePages = Array.isArray(input?.pages) && input.pages.length > 0 ? input.pages : [[]];
    return {
      flowMode: normalizeFlow(input?.flowMode),
      gridGap: clampGap(input?.gridGap),
      pageIndex: 0,
      pages: sourcePages.map((page) => sanitizePlacements(page))
    };
  }

  function createEmptyLayouts() {
    return Object.fromEntries(PAPER_ORDER.map((id) => [id, createLayout()]));
  }

  function inBounds(paperId, row, col) {
    const paper = getPaper(paperId);
    return row >= 0 && col >= 0 && row < paper.rows && col < paper.cols;
  }

  // 越界落字原样保留，只产出冲突清单（书签格数少时主要靠这里提示）
  function validatePlacements(paperId, list, pageIndex = 0) {
    const paper = getPaper(paperId);
    const conflicts = [];
    (Array.isArray(list) ? list : []).forEach((item, index) => {
      if (!isValidPlacement(item)) {
        conflicts.push({ page: pageIndex, index, row: null, col: null, kind: "invalid" });
        return;
      }
      if (item.row < 0 || item.col < 0 || item.row >= paper.rows || item.col >= paper.cols) {
        conflicts.push({ page: pageIndex, index, row: item.row, col: item.col, kind: "overflow" });
      }
    });
    return conflicts;
  }

  function validateLayout(paperId, layout) {
    const paper = getPaper(paperId);
    let conflicts = [];
    const pages = layout && Array.isArray(layout.pages) ? layout.pages : [];
    pages.forEach((page, pageIndex) => {
      conflicts = conflicts.concat(validatePlacements(paperId, page, pageIndex));
    });
    return { paper, valid: conflicts.length === 0, conflicts };
  }

  function describeConflict(conflict) {
    if (conflict.kind === "invalid") {
      return `第${conflict.page + 1}页存在无法识别的落字记录`;
    }
    return `第${conflict.page + 1}页 第${conflict.row + 1}行第${conflict.col + 1}列越出版面`;
  }

  return {
    PAPER_SIZES,
    PAPER_ORDER,
    FLOW_MODES,
    GAP_MIN,
    GAP_MAX,
    GAP_DEFAULT,
    isPaperId,
    getPaper,
    normalizeFlow,
    clampGap,
    isValidPlacement,
    sanitizePlacements,
    createLayout,
    createEmptyLayouts,
    inBounds,
    validatePlacements,
    validateLayout,
    describeConflict
  };
});
