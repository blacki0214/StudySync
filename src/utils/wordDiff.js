/**
 * wordDiff.js — a word-level LCS diff so the version viewer can show changes
 * inline (Google-Docs style): unchanged text stays as-is, removed words are
 * struck through and replaced inline by the new words, all within the flowing
 * document instead of whole-line blocks.
 * Returns tokens: { type: 'same' | 'add' | 'del', text }.
 */
export function wordDiff(oldText, newText) {
  // Split into words AND the whitespace between them, so spacing/newlines survive.
  const tokenize = (s) => (s || '').split(/(\s+)/).filter((t) => t !== '')
  const a = tokenize(oldText)
  const b = tokenize(newText)
  const m = a.length
  const n = b.length

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const out = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (a[i] === b[j]) { out.push({ type: 'same', text: a[i] }); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ type: 'del', text: a[i] }); i++ }
    else { out.push({ type: 'add', text: b[j] }); j++ }
  }
  while (i < m) out.push({ type: 'del', text: a[i++] })
  while (j < n) out.push({ type: 'add', text: b[j++] })
  return out
}
