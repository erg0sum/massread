// Pure comment-moderation logic — no Firebase dependencies, so it's easy to
// unit test and reuse. Matches banned words case-insensitively on word
// boundaries and masks them with asterisks.

// Expand this list as needed.
const BANNED_WORDS = [
  'arse', 'ass', 'asshole', 'bastard', 'bitch', 'bollocks', 'bullshit',
  'crap', 'damn', 'dick', 'douche', 'goddamn', 'jerk', 'piss', 'prick',
  'shit', 'slut', 'twat', 'wanker', 'whore', 'fuck', 'fucking', 'motherfucker',
]

function buildPattern(words) {
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi')
}

const PATTERN = buildPattern(BANNED_WORDS)

// Returns the cleaned text and whether anything was masked.
function moderateText(text) {
  if (typeof text !== 'string') return { clean: text, moderated: false }
  let moderated = false
  const clean = text.replace(PATTERN, (match) => {
    moderated = true
    return '*'.repeat(match.length)
  })
  return { clean, moderated }
}

module.exports = { moderateText, BANNED_WORDS }
