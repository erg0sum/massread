const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const { initializeApp } = require('firebase-admin/app')
const { moderateText } = require('./moderation')

initializeApp()

// Automatic comment moderation. Fires when a comment is created, masks any
// banned words, and flags the comment. Runs with admin privileges, so it
// applies even if a client writes to Firestore directly (unbypassable).
exports.moderateComment = onDocumentCreated(
  'books/{bookId}/highlights/{highlightId}/comments/{commentId}',
  async (event) => {
    const snap = event.data
    if (!snap) return

    const { text } = snap.data() || {}
    const { clean, moderated } = moderateText(text)

    if (moderated) {
      await snap.ref.update({ text: clean, moderated: true })
    }
  }
)
