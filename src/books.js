// ── Book catalog ──────────────────────────────────────────────
// Static list of books available to read together.
// To add a book: drop its .epub file in /public and add an entry here.
// The admin can then pick which one is the active ("main") book everyone reads.

export const BOOKS = [
  {
    id: 'great-gatsby',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    url: '/gatsby.epub',
  },{
    id: 'dracula',
    title: 'Dracula',
    author: 'Bram Stoker',
    url: '/bram-stoker_dracula.epub',
  },
  // Add more books by placing the .epub in /public and uncommenting / editing:
  // {
  //   id: 'pride-and-prejudice',
  //   title: 'Pride and Prejudice',
  //   author: 'Jane Austen',
  //   url: '/pride-and-prejudice.epub',
  // },
]

// The book shown until the admin's choice loads from Firestore.
export const DEFAULT_BOOK_ID = import.meta.env.VITE_BOOK_ID || BOOKS[0].id

export function getBook(id) {
  return BOOKS.find((b) => b.id === id) || BOOKS[0]
}
