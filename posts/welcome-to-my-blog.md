---
title: Welcome to my Blog
date: 2026-07-15
tags: important
---

# Welcome to my Blog

This is a minimalist blog engine build with nothing but **HTML**, **CSS**, and **vanilla JavaScript**.

Every post is a plain Markdown file sitting in the `posts/` folder. You write in Markdown and the engine parses it into HTM when the page loads.

## Writing a New Post

1. Create a new file in `posts/` e.g. `posts/my-new-post.md`
2. Add frontmatter at the top:

```markdown
---
title: My New Post
date: 2026-07-15
tags: tag1, tag2
---

Your content here...
```

3. Add an entry to `posts.json`:
```json
{"slug": "my-new-post", "title": "My New Post", "date": "2026-07-14", "tags": ["tag1", "tag2"]}
```