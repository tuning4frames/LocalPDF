export function diffLines(aLines, bLines) {
  const n = aLines.length, m = bLines.length;
  const table = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) for (let j = m - 1; j >= 0; j -= 1) {
    table[i][j] = aLines[i] === bLines[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  }
  const result = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (aLines[i] === bLines[j]) { result.push({ type: "same", text: aLines[i] }); i += 1; j += 1; }
    else if (table[i + 1][j] >= table[i][j + 1]) result.push({ type: "removed", text: aLines[i++] });
    else result.push({ type: "added", text: bLines[j++] });
  }
  while (i < n) result.push({ type: "removed", text: aLines[i++] });
  while (j < m) result.push({ type: "added", text: bLines[j++] });
  return result;
}
