/*
 * 页面接续脚本
 * 负责同一纸样内的翻页、加页、删页与落字统计。
 * 版面排满后可以接续到新页；删页只允许删空页，避免落字丢失。
 * 纯逻辑、无 DOM 依赖。
 */
(function (root, factory) {
  const api = factory();
  root.Paging = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function ensurePages(layout) {
    if (!Array.isArray(layout.pages) || layout.pages.length === 0) layout.pages = [[]];
    if (!Number.isInteger(layout.pageIndex) || layout.pageIndex < 0 || layout.pageIndex >= layout.pages.length) {
      layout.pageIndex = 0;
    }
  }

  function addPage(layout) {
    ensurePages(layout);
    layout.pages.push([]);
    layout.pageIndex = layout.pages.length - 1;
    return layout.pageIndex;
  }

  function goToPage(layout, pageIndex) {
    ensurePages(layout);
    const next = Math.min(Math.max(0, pageIndex), layout.pages.length - 1);
    layout.pageIndex = next;
    return next;
  }

  // 只有空页可以删除；有落字的页一律保留
  function removePage(layout, pageIndex) {
    ensurePages(layout);
    if (layout.pages.length <= 1) return { removed: false, reason: "最后一页不能删除" };
    const page = layout.pages[pageIndex];
    if (!page || page.length > 0) return { removed: false, reason: "该页仍有落字，请先清空" };
    layout.pages.splice(pageIndex, 1);
    if (layout.pageIndex >= layout.pages.length) layout.pageIndex = layout.pages.length - 1;
    return { removed: true };
  }

  function currentPage(layout) {
    ensurePages(layout);
    return layout.pages[layout.pageIndex];
  }

  function countOnPage(list) {
    return Array.isArray(list) ? list.length : 0;
  }

  function countAllPages(layout) {
    return (layout.pages || []).reduce((sum, page) => sum + countOnPage(page), 0);
  }

  // 判断纸样是否已有任何落字（用于保存校验：每个已用纸样都需有落字）
  function hasAnyPlacement(layout) {
    return countAllPages(layout) > 0;
  }

  return {
    ensurePages,
    addPage,
    goToPage,
    removePage,
    currentPage,
    countOnPage,
    countAllPages,
    hasAnyPlacement
  };
});
