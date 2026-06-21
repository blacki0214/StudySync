/**
 * sampleCommunity.js
 * ----------------------------------------------------------------------------
 * Q&A posts, trending topics and top contributors for the Community page.
 */

export const communityPosts = [
  {
    id: 'p1',
    author_id: 'user-2',
    badge: 'RMIT · SWE',
    ago: '32m ago',
    subject: 'COS30049',
    votes: 248,
    title: "How does Ethereum's PBS architecture actually work?",
    excerpt:
      "Reading the original Flashbots paper but I'm confused about how the proposer commits to a block header before seeing the body. Anyone explain like I'm 5?",
    tags: ['#Blockchain', '#Help'],
    replies: 42,
    answered: false
  },
  {
    id: 'p2',
    author_id: 'user-3',
    badge: 'VNU · DS',
    ago: '1h ago',
    subject: 'MATH2001',
    votes: 412,
    title: 'Solved: Eigenvalues for tridiagonal matrices — Vietnamese explanation',
    excerpt:
      'Mình giải thích cách tìm trị riêng cho ma trận ba đường chéo bằng đa thức đặc trưng, kèm ví dụ cụ thể bằng tiếng Việt.',
    tags: ['#LinearAlgebra', '#Solved'],
    replies: 31,
    answered: true
  },
  {
    id: 'p3',
    author_id: 'user-4',
    badge: 'RMIT · IT',
    ago: '2h ago',
    subject: 'INF10025',
    votes: 176,
    title: 'When should I stop at 3NF instead of going to BCNF?',
    excerpt:
      'My lecturer said BCNF can sometimes break dependency preservation. How do I decide which trade-off is acceptable in a real schema?',
    tags: ['#Database', '#Discussion'],
    replies: 18,
    answered: false
  }
]

export const trendingTopics = [
  { tag: '#PBS & MEV', posts: 184 },
  { tag: '#Vietnamese eigenvalue', posts: 142 },
  { tag: '#React 19 hooks', posts: 98 },
  { tag: '#PoS finality', posts: 87 },
  { tag: '#BCNF decomposition', posts: 64 },
  { tag: '#TikTok D2C', posts: 52 }
]

export const topContributors = [
  { id: 'user-2', full_name: 'Linh Trần', rep: '12.4K' },
  { id: 'user-3', full_name: 'Tuấn Phạm', rep: '9.8K' },
  { id: 'user-4', full_name: 'Hà Vũ', rep: '7.1K' },
  { id: 'user-5', full_name: 'Bảo Lê', rep: '5.6K' }
]
