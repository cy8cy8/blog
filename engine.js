'use strict';

/**
 * Shorthand for `document.getElementById`.
 * @param {string} id - The element id to look up. 
 * @returns {HTMLElement|null} The element, or null if it does not exist.
 */
const $ = id => document.getElementById(id);

/** 
 * Escape a value for safe interpolation into an HTML string. Replaces the chars that could break out of text attribute content 
 * @param {*} s - Any value; coerced to string first.
 * @returns {string} the HTML-escaped string.
 */
const esc = s => String(s).replace(/[&<>"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
}[c]));

/** 
 * Normalise a post's tags into a clean array of at most 2 entries. Accepts either an array (from posts.json) or a comma-separated string (from Markdown frontmatter), so the same helper serves both call sites. 
 * @param {string[]|string|undefined} t - Raw tags value.
 * @returns {string[]} Trimmed, non-empty tags, capped at 2.
 */
const tagsOf = t => 
    (Array.isArray(t) ? t : String(t ?? '').split(','))
        .map(x => x.trim())
        .filter(Boolean)
        .slice(0, 2);

/** 
 * Split a raw Markdown file into its frontmatter metadata and body content. Frontmatter is an optional block delimited by `---` lines at the very top; each inner line is a `key: value` pair (values are treated as strings) 
 * @param {string} raw - the full text of a `.md` file.
 * @returns {{ meta: Object<string,string>, content: string }}
 * `meta` holds the parsed key/value pairs (empty if no frontmatter);
 * `content` is the remaining Markdown body.
 */
const parseFrontmatter = raw => {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) return { meta: {}, content: raw };
    const meta = {};
    for (const line of match[1].split('\n')) {
        const i = line.indexOf(':');
        if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    return { meta, content: match[2] };
}

let allPosts = [];

/**
 * Render a list of post records as linked rows into the given container. Shows a friendly message when the list is empty (e.g. no filter matches).
 * @param {HTMLElement} el - Target container (`#post-list`).
 * @param {Array<Object>} posts - Post records to render (already filtered/sorted).
 * @returns {void}
 */
const renderList = (el, posts) => {
    el.innerHTML = posts.length
        ? posts.map(p => {
            const tags = tagsOf(p.tags);
            return `
            <a href="post.html?slug=${encodeURIComponent(p.slug)}" class="post-item">
                <span class="post-item-date">${esc(p.date)}</span>
                <span class="post-item-title">${esc(p.title)}</span>
                ${tags.length ? `<span class="post-item-tags">${tags.map(esc).join(' ⋅ ')}</span>` : ''}
            </a>`;
        }).join('')
        : '<p class="loading">No matching posts.</p>';
};

/**
 * Read the current control values (search / year / tag / sort), derive the matching subset of `allPosts`, and re-render the list. Bound to the `input` event of every control, so it runs on each keystroke or selection change.
 * @returns {void}
 */
const applyFilters = () => {
    const query = $('search').value.trim().toLowerCase();
    const year = $('year').value;
    const tag = $('tag').value;
    const ascending = $('sort').value === 'asc';
    const posts = allPosts
        .filter(p => p.title.toLowerCase().includes(query))
        .filter(p => !year || String(p.date).startsWith(year))
        .filter(p => !tag || tagsOf(p.tags).includes(tag))
        .sort((a, b) => ascending ? new Date(a.date) - new Date(b.date) : new Date(b.date) - new Date(a.date));
    renderList($('post-list'), posts);
};

/**
 * Bootstrap the index page: fetch `posts.json`, populate the year and tag filter dropdowns from the data, wire up the controls, and render. No-ops when `#post-list` is absent (i.e. we're on the post page).
 * @returns {Promise<void>}
 */
const loadIndex = async () => {
    const el = $('post-list');
    if (!el) return;

    try {
        allPosts = await (await fetch('posts.json')).json();

        // Build the year dropdown from the distinct YYYY prefixes, newest first.
        const years = [...new Set(allPosts.map(p => String(p.date).slice(0, 4)))].sort().reverse();
        $('year').insertAdjacentHTML('beforeend', years.map(y => `<option value="${y}">${y}</option>`).join(''),);

        // Build the tag dropdown from every distinct (capped) tag, alphabetically.
        const tags = [...new Set(allPosts.flatMap(p => tagsOf(p.tags)))].sort();
        $('tag').insertAdjacentHTML('beforeend', tags.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join(''),);

        // Re-filter on any control change, then paint the initial (unfiltered) list.
        for (const id of ['search', 'year', 'tag', 'sort']) {
            $(id).addEventListener('input', applyFilters);
        }
        applyFilters();
    } catch (err) {
        el.innerHTML = '<p class="error">Could not load posts. Run a local server.</p>';
        console.error(err);
    }
};

/**
 * Bootstrap the post page: validate `?slug=`, fetch the Markdown file, then render its frontmatter header and Markdown body. No-ops when `#post-content` is absent (i.e. we're on the index page). The slug is checked against a strict pattern (lowercase alphanumerics and hyphens) BEFORE it touches `fetch()`, which blocks path-traversal attempts such as `?slugs=../secret`.
 * @returns {Promise<void>}
 */
const loadPost = async () => {
    const el = $('post-content');
    if (!el) return;
    const slug = new URLSearchParams(location.search).get('slug');
    if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
        el.innerHTML = '<p class="error">Invalid post. <a href="index.html">Go Home</a></p>';
        return;
    }

    try {
        const res = await fetch(`posts/${slug}.md`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { meta, content } = parseFrontmatter(await res.text());
        document.title = meta.title ? `${meta.title}` : "Untitled";
        el.innerHTML = `
            <header class="post-header">
                <div class="post-meta">
                    <time datetime="${esc(meta.date || '')}">${esc(meta.date || '')}</time>
                    ${tagsOf(meta.tags).map(t => `<span class="tag">${esc(t)}</span>`).join('')}
                </div>
                <h1 class="post-title">${esc(meta.title || slug)}</h1>
            </header>
            <div class="post-body">${marked.parse(content)}</div>`;
    } catch (error) {
        el.innerHTML = `<p class="error">Could not load post <strong>${esc(slug)}</strong>: ${esc(error.message)}</p>`;
        console.error(error);
    }
};

// Bootstrap
loadIndex();
loadPost();