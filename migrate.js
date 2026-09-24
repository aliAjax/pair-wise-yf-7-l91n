/*
 * 数据迁移脚本
 * 负责把旧的单版草稿（全局 settings + 一维 placements）迁移成
 * v2 三纸样结构（layouts 分别保存位置、网格、方向）。
 * 旧落字原样留在原版纸样上，越界由纸样校验列出，不做删除。
 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./papers.js"));
  } else {
    root.Migrate = factory(root.Papers);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Papers) {
  const SCHEMA_VERSION = 2;
  const fallbackId = () => `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function isLegacyState(raw) {
    return !!raw && !raw.version && !!raw.settings && !raw.layouts;
  }

  function isLegacyDraft(draft) {
    return !!draft && !draft.version && Array.isArray(draft.placements);
  }

  function sanitizeLayouts(rawLayouts) {
    const layouts = Papers.createEmptyLayouts();
    Papers.PAPER_ORDER.forEach((id) => {
      if (rawLayouts && rawLayouts[id]) layouts[id] = Papers.createLayout(rawLayouts[id]);
    });
    return layouts;
  }

  function sanitizeUsedPapers(list) {
    return [...new Set(Array.isArray(list) ? list : [])].filter((id) => Papers.isPaperId(id));
  }

  // 迁移单个旧版草稿；v2 草稿则补齐缺失纸样后返回
  function migrateDraft(raw, newId = fallbackId) {
    if (isLegacyDraft(raw)) {
      const sourcePaper = Papers.isPaperId(raw.settings?.paperSize) ? raw.settings.paperSize : "postcard";
      const placements = Papers.sanitizePlacements(raw.placements);
      const layouts = Papers.createEmptyLayouts();
      layouts[sourcePaper] = Papers.createLayout({
        flowMode: raw.settings?.flowMode,
        gridGap: raw.settings?.gridGap,
        pages: [placements]
      });
      return {
        migrated: true,
        draft: {
          version: SCHEMA_VERSION,
          id: typeof raw.id === "string" ? raw.id : newId(),
          title: typeof raw.title === "string" ? raw.title : "",
          savedAt: raw.savedAt || new Date().toISOString(),
          activePaper: sourcePaper,
          usedPapers: placements.length > 0 ? [sourcePaper] : [],
          migratedFromSingle: true,
          layouts
        }
      };
    }

    const layouts = sanitizeLayouts(raw?.layouts);
    const usedPapers = sanitizeUsedPapers(raw?.usedPapers);
    return {
      migrated: false,
      draft: {
        version: SCHEMA_VERSION,
        id: typeof raw?.id === "string" ? raw.id : newId(),
        title: typeof raw?.title === "string" ? raw.title : "",
        savedAt: raw?.savedAt || new Date().toISOString(),
        activePaper: Papers.isPaperId(raw?.activePaper) ? raw.activePaper : "postcard",
        usedPapers,
        migratedFromSingle: !!raw?.migratedFromSingle,
        layouts
      }
    };
  }

  // 迁移整份本地状态，并顺手迁移已保存的旧草稿
  function migrateState(raw, newId = fallbackId) {
    const base = {
      inventory: Array.isArray(raw?.inventory) ? raw.inventory : [],
      selectedTypeId: typeof raw?.selectedTypeId === "string" ? raw.selectedTypeId : null
    };

    if (isLegacyState(raw)) {
      const sourcePaper = Papers.isPaperId(raw.settings?.paperSize) ? raw.settings.paperSize : "postcard";
      const placements = Papers.sanitizePlacements(raw.placements);
      const layouts = Papers.createEmptyLayouts();
      layouts[sourcePaper] = Papers.createLayout({
        flowMode: raw.settings?.flowMode,
        gridGap: raw.settings?.gridGap,
        pages: [placements]
      });
      const drafts = (Array.isArray(raw.drafts) ? raw.drafts : []).map((draft) => migrateDraft(draft, newId).draft);
      return {
        migrated: true,
        state: {
          ...base,
          version: SCHEMA_VERSION,
          workTitle: typeof raw.settings?.workTitle === "string" ? raw.settings.workTitle : "",
          activePaper: sourcePaper,
          usedPapers: placements.length > 0 ? [sourcePaper] : ["postcard"],
          layouts,
          drafts
        }
      };
    }

    const layouts = sanitizeLayouts(raw?.layouts);
    const drafts = (Array.isArray(raw?.drafts) ? raw.drafts : []).map((draft) => migrateDraft(draft, newId).draft);
    return {
      migrated: false,
      state: {
        ...base,
        version: SCHEMA_VERSION,
        workTitle: typeof raw?.workTitle === "string" ? raw.workTitle : "",
        activePaper: Papers.isPaperId(raw?.activePaper) ? raw.activePaper : "postcard",
        usedPapers: sanitizeUsedPapers(raw?.usedPapers),
        layouts,
        drafts
      }
    };
  }

  return {
    SCHEMA_VERSION,
    isLegacyState,
    isLegacyDraft,
    sanitizeLayouts,
    sanitizeUsedPapers,
    migrateDraft,
    migrateState
  };
});
