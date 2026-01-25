// Admin Dashboard Search and Navigation
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('dashboard-search');
    const clearBtn = document.getElementById('search-clear');
    const container = document.querySelector('.main-content') || document.querySelector('#admin-dashboard-section') || document.body;

    function escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    }

    function walkTextNodes(node, cb) {
        for (let child = node.firstChild; child; child = child.nextSibling) {
            if (child.nodeType === 3) cb(child);
            else if (child.nodeType === 1 && !['SCRIPT','STYLE','NOSCRIPT','IFRAME'].includes(child.tagName)) walkTextNodes(child, cb);
        }
    }

    function clearHighlights(root = container) {
        root.querySelectorAll('mark.search-mark').forEach(mark => {
            const txt = document.createTextNode(mark.textContent);
            mark.replaceWith(txt);
        });
    }

    function highlight(root, query) {
        if (!query) return;
        const re = new RegExp(escapeRegExp(query), 'gi');
        walkTextNodes(root, node => {
            const text = node.nodeValue;
            if (!text || !re.test(text)) return;
            const frag = document.createDocumentFragment();
            let last = 0;
            text.replace(re, (match, offset) => {
                const idx = arguments[arguments.length-2];
                if (idx > last) frag.appendChild(document.createTextNode(text.slice(last, idx)));
                const m = document.createElement('mark');
                m.className = 'search-mark';
                m.textContent = match;
                frag.appendChild(m);
                last = idx + match.length;
            });
            if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
            node.parentNode.replaceChild(frag, node);
        });
    }

    if (input) {
        let timer = null;
        input.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                clearHighlights();
                const q = input.value.trim();
                if (!q) return;
                highlight(container, q);
                const first = container.querySelector('mark.search-mark');
                if (first) {
                    first.classList.add('search-first');
                    first.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => first.classList.remove('search-first'), 1400);
                }
            }, 180);
        });

        clearBtn && clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            input.value = '';
            input.dispatchEvent(new Event('input'));
            input.focus();
        });
    }

    // Mobile sidebar toggle (preserve original behavior)
    const mobileToggle = document.getElementById('mobile-menu-toggle');
    function closeMobileSidebar() {
        document.body.classList.remove('sidebar-open');
        const ov = document.getElementById('mobile-sidebar-overlay');
        if (ov) ov.remove();
    }

    if (mobileToggle) {
        mobileToggle.style.display = '';
        mobileToggle.setAttribute('aria-expanded', 'false');
        mobileToggle.addEventListener('click', () => {
            // If narrow viewport -> open mobile off-canvas
            if (window.innerWidth <= 900) {
                const opened = document.body.classList.toggle('sidebar-open');
                mobileToggle.setAttribute('aria-expanded', opened ? 'true' : 'false');
                if (opened) {
                    let ov = document.getElementById('mobile-sidebar-overlay');
                    if (!ov) {
                        ov = document.createElement('div');
                        ov.id = 'mobile-sidebar-overlay';
                        ov.className = 'mobile-sidebar-overlay';
                        ov.addEventListener('click', closeMobileSidebar);
                        document.body.appendChild(ov);
                    }
                } else {
                    closeMobileSidebar();
                }
                return;
            }

            // Desktop: toggle collapsed state
            const collapsed = document.body.classList.toggle('sidebar-collapsed');
            mobileToggle.setAttribute('aria-expanded', collapsed ? 'true' : 'false');
        });

        // Close mobile sidebar when a sidebar link is clicked (mobile)
        document.querySelectorAll('.admin-sidebar .sidebar-link').forEach(a => {
            a.addEventListener('click', () => {
                if (window.innerWidth <= 900) closeMobileSidebar();
            });
        });
    }

    // Sidebar collapse button (non-invasive)
    const sidebarCollapseBtn = document.getElementById('sidebar-collapse-btn');
    if (sidebarCollapseBtn) {
        sidebarCollapseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const collapsed = document.body.classList.toggle('sidebar-collapsed');
            sidebarCollapseBtn.setAttribute('aria-expanded', collapsed ? 'true' : 'false');
            const icon = sidebarCollapseBtn.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-angle-left', !collapsed);
                icon.classList.toggle('fa-angle-right', collapsed);
            }
        });
        // initialize icon state
        const initIcon = sidebarCollapseBtn.querySelector('i');
        if (initIcon && document.body.classList.contains('sidebar-collapsed')) {
            initIcon.classList.remove('fa-angle-left');
            initIcon.classList.add('fa-angle-right');
        }
    }
});
