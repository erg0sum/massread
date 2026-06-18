# MassRead — Read Together

A real-time collaborative book reader. Select text to highlight it, and discuss it with your group in a Genius-style comment sidebar.

## Quick Start

### 1. Get the epub

Download *The Great Gatsby* (public domain):
```
https://www.gutenberg.org/ebooks/64317.epub.images
```
Rename the downloaded file to `gatsby.epub` and place it in the `public/` folder.

### 2. Set up Firebase

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a project.
2. Enable **Firestore Database** (start in test mode for development).
3. Enable **Authentication → Anonymous** sign-in.
4. Go to **Project Settings → Your apps → Web** and register a web app.
5. Copy your config values.

### 3. Configure environment

```bash
cp .env.example .env
# Fill in your Firebase values in .env
```

### 4. Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173` — share the URL with your reading group!

---

## Firestore Rules (before going live)

Replace the default test rules with something like:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /books/{bookId}/highlights/{hlId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow delete: if request.auth.uid == resource.data.authorUid;
    }
    match /books/{bookId}/highlights/{hlId}/comments/{cId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow delete: if request.auth.uid == resource.data.authorUid;
    }
  }
}
```

## Deploy

```bash
npm run build
# Deploy the dist/ folder to Vercel, Netlify, or Firebase Hosting
```

## Multiple books

Change `VITE_BOOK_ID` in your `.env` to create separate highlight sessions for different books. Put the epub in `public/` and update the `BOOK_URL` constant in `src/App.jsx`.

## Tech stack

- React + Vite
- [epub.js](https://github.com/futurepress/epub.js/) — epub rendering
- Firebase Firestore — real-time highlights & comments
- Firebase Auth — anonymous identity per reader
