/**
 * Stopword lists for keyword extraction.
 *
 * Stopwords are extremely common words that carry little topical meaning
 * ("the", "is", "và", "của"). Removing them before counting word frequency is
 * the single most important step that makes the manual keyword extractor return
 * meaningful terms instead of grammar glue.
 *
 * We ship BOTH English and Vietnamese lists because StudySync targets Vietnamese
 * university students who frequently mix the two languages in their notes.
 */

// Common English stopwords.
export const englishStopwords = [
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'can',
  'could', 'did', 'do', 'does', 'for', 'from', 'had', 'has', 'have', 'he',
  'her', 'here', 'him', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it',
  'its', 'just', 'may', 'me', 'might', 'more', 'most', 'must', 'my', 'no',
  'not', 'now', 'of', 'on', 'only', 'or', 'other', 'our', 'out', 'over',
  'own', 'said', 'same', 'she', 'should', 'so', 'some', 'such', 'than',
  'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they', 'this',
  'those', 'through', 'to', 'too', 'under', 'up', 'use', 'used', 'using',
  'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while',
  'who', 'why', 'will', 'with', 'would', 'you', 'your', 'about', 'after',
  'all', 'also', 'any', 'because', 'before', 'being', 'between', 'both',
  'each', 'few', 'during', 'further', 'once', 'because'
]

// Common Vietnamese stopwords (function words, pronouns, connectors).
export const vietnameseStopwords = [
  'và', 'của', 'là', 'có', 'cho', 'được', 'các', 'một', 'những', 'này',
  'đó', 'khi', 'với', 'để', 'trong', 'không', 'người', 'ra', 'như', 'đã',
  'sẽ', 'cũng', 'nên', 'nếu', 'thì', 'mà', 'hay', 'hoặc', 'vì', 'bởi',
  'tại', 'từ', 'đến', 'theo', 'về', 'ở', 'lúc', 'rằng', 'nhưng', 'còn',
  'rồi', 'lại', 'vẫn', 'đang', 'bị', 'phải', 'rất', 'quá', 'nhiều', 'ít',
  'tôi', 'bạn', 'chúng', 'họ', 'nó', 'ai', 'gì', 'nào', 'sao', 'đâu',
  'thế', 'vậy', 'ấy', 'kia', 'mỗi', 'mọi', 'cả', 'chỉ', 'cùng', 'hơn'
]

// Combined set used by the keyword extractor for fast O(1) lookups.
export const allStopwords = new Set([...englishStopwords, ...vietnameseStopwords])
