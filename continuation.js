// 页面接续：把一段文字按当前纸样的阅读顺序（横排先行后列、竖排先列后行）
// 依次接续到空格中。当前页面放满即停止，未放下的字原样返回，绝不丢弃。
// 纯数据函数，不读写 DOM。

function getReadOrder(cols, rows, flowMode) {
  const order = [];
  if (flowMode === "vertical") {
    // 竖排：从右到左成列，每列自上而下。
    for (let col = cols - 1; col >= 0; col -= 1) {
      for (let row = 0; row < rows; row += 1) {
        order.push({ row, col });
      }
    }
  } else {
    // 横排：自上而下成行，每行从左到右。
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        order.push({ row, col });
      }
    }
  }
  return order;
}

// inventory: 字模库；usage: { [typeId]: 已用数量 }。
// 优先取与字相符且库存充足的字模，其次退而取任意充足的；都不足则返回 null。
function pickTypeForChar(char, inventory, usage) {
  const matching = inventory.filter((item) => item.char === char);
  const candidates = matching.length ? matching : inventory;
  return (
    candidates.find((item) => (usage[item.id] || 0) < item.quantity) ||
    null
  );
}

// 将文本接续落入当前纸样。
// 参数：
//   text            待排文字（空白会被跳过）
//   block           当前纸样块 { settings, placements }
//   spec            纸样规格（cols/rows）
//   inventory       字模库
// 返回 { placements, placed, remaining, shortages }
//   placements 为新增的落字（调用方并入原数组）；remaining 为未放下的原文；
//   shortages 记录因库存不足而跳过的字符。
function flowTextOntoPage(text, block, spec, inventory) {
  const { cols, rows } = spec;
  const flowMode = block.settings.flowMode;
  const existing = Array.isArray(block.placements) ? block.placements : [];

  // 已占用格子（同一格只保留最早的落字，后续重复坐标忽略）。
  const occupied = new Set(existing.map((item) => placementKey(item.row, item.col)));
  const freeCells = getReadOrder(cols, rows, flowMode).filter(
    (cell) => !occupied.has(placementKey(cell.row, cell.col))
  );

  // 接续时把现有落字也计入用量，避免同一页里超用。
  const usage = existing.reduce((acc, item) => {
    acc[item.typeId] = (acc[item.typeId] || 0) + 1;
    return acc;
  }, {});

  const placements = [];
  const shortages = [];
  const chars = Array.from(String(text || "")).filter((char) => !/\s/.test(char));
  let cursor = 0;

  for (const char of chars) {
    if (cursor >= freeCells.length) break; // 页面已满，停止接续
    const type = pickTypeForChar(char, inventory, usage);
    if (!type) {
      shortages.push(char);
      continue; // 库存不足跳过该字，但继续尝试后面的字
    }
    const cell = freeCells[cursor];
    placements.push({ row: cell.row, col: cell.col, typeId: type.id });
    usage[type.id] = (usage[type.id] || 0) + 1;
    cursor += 1;
  }

  // 已成功放入的字数（按字符计，跳过库存不足的字也算“未放入”）。
  const placedCount = placements.length;
  const consumedCharCount = placedCount + shortages.length;
  const remaining = chars.slice(consumedCharCount).join("");

  return { placements, placed: placedCount, remaining, shortages };
}
