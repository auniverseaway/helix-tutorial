const LIVE_DOMAIN = 'https://aem.wiki';
const { protocol, hostname, port, pathname } = window.location;

const config = {
    lazyMargin: '1200px 0px',
    blocks: {
        'a[href^="https://www.youtube.com"]': {
            lazy: true,
            location: '/blocks/embed/',
            styles: 'youtube.css',
            scripts: 'youtube.js',
        },
        'a[href^="https://gist.github.com"]': {
            lazy: true,
            location: '/blocks/embed/',
            scripts: 'gist.js',
        },
    },
    templates: {},
};

const getDomain = () => {
    const domain = `${protocol}//${hostname}`;
    return port ? `${domain}:${port}` : domain;
};
const currentDomain = getDomain();

const setDomain = (element) => {
    const anchors = element.getElementsByTagName('a');
    Array.from(anchors).forEach((anchor) => {
        const { href } = anchor;
        if (href.includes(LIVE_DOMAIN)) {
            anchor.href = href.replace(LIVE_DOMAIN, currentDomain);
        }
    });
};

const getMetadata = (name) => {
    const meta = document.head.querySelector(`meta[name="${name}"]`);
    return meta && meta.content;
};

const addStyle = (location, loadEvent) => {
    const duplicate = document.head.querySelector(`link[href^="${location}"]`);
    if (!duplicate) {
        const element = document.createElement('link');
        element.setAttribute('rel', 'stylesheet');
        element.setAttribute('href', location);
        if (loadEvent) {
            element.addEventListener('load', loadEvent);
        }
        document.querySelector('head').appendChild(element);
    } else {
        if (loadEvent) {
            loadEvent();
        }
    }
};

const loadTemplate = (config) => {
    const template = getMetadata('template');
    if (template) {
        const isLoaded = () => {
            document.body.classList.add('is-Loaded');
        };
        const templateConf = config.templates[template] || {};
        if (templateConf.class) {
            document.body.classList.add(templateConf.class);
        }
        if (templateConf.styles) {
            addStyle(`${templateConf.location}${templateConf.styles}`, isLoaded);
        } else {
            isLoaded();
        }
    }
};

function loadBlocks(config, suppliedEl) {
    const parentEl = suppliedEl || document;

    const initJs = async (element, block) => {
        // If the block scripts haven't been loaded, load them.
        if (block.scripts) {
            if (!block.module) {
                // eslint-disable-next-line no-param-reassign
                block.module = await import(`${block.location}${block.scripts}`);
            }
            // If this block type has scripts and they're already imported
            if (block.module) {
                block.module.default(element, { addStyle, setDomain });
            }
        }
        element.classList.add('is-Loaded');
        return true;
    };

    /**
     * Unlazy each type of block
     * @param {HTMLElement} element
     */
    const loadElement = async (element) => {
        const { blockSelect } = element.dataset;
        const block = config.blocks[blockSelect];

        if (!block.loaded && block.styles) {
            addStyle(`${block.location}${block.styles}`);
        }

        block.loaded = initJs(element, block);
    };

    /**
     * Iterate through all entries to determine if they are intersecting.
     * @param {IntersectionObserverEntry} entries
     * @param {IntersectionObserver} observer
     */
    const onIntersection = (entries, observer) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                observer.unobserve(entry.target);
                loadElement(entry.target);
            }
        });
    };

    /**
     * Clean up variant classes
     * Ex: marquee--small--contained- -> marquee small contained
     * @param {HTMLElement} parent
     */
    const cleanVariations = (parent) => {
        const variantBlocks = parent.querySelectorAll('[class$="-"]');
        variantBlocks.forEach((variant) => {
            const { className } = variant;
            const classNameClipped = className.slice(0, -1);
            variant.classList.remove(className);
            const classNames = classNameClipped.split('--');
            variant.classList.add(...classNames);
        });
    };

    /**
     * Load blocks
     * @param {HTMLElement} element
     */
    const init = (element) => {
        const isDoc = element instanceof Document;
        const parent = isDoc ? document.querySelector('body') : element;
        cleanVariations(parent);

        const options = { rootMargin: config.lazyMargin || '1000px 0px' };
        const observer = new IntersectionObserver(onIntersection, options);

        Object.keys(config.blocks).forEach((block) => {
            const elements = parent.querySelectorAll(block);
            elements.forEach((el) => {
                el.setAttribute('data-block-select', block);
                if (config.blocks[block].lazy) {
                    observer.observe(el);
                } else {
                    loadElement(el);
                }
            });
        });
    };

    const fetchFragment = async (path) => {
        const resp = await fetch(`${path}.plain.html`);
        if (resp.ok) {
            return resp.text();
        }
        return null;
    };

    const loadFragment = async (fragmentEl) => {
        const path = fragmentEl.querySelector('div > div').textContent;
        const html = await fetchFragment(path);
        if (html) {
            fragmentEl.insertAdjacentHTML('beforeend', html);
            fragmentEl.querySelector('div').remove();
            fragmentEl.classList.add('is-Visible');
            setDomain(fragmentEl);
            init(fragmentEl);
        }
    };

    /**
     * Add fragment to the list of blocks
     */
    // eslint-disable-next-line no-param-reassign
    config.blocks['.fragment'] = {
        loaded: true,
        scripts: {},
        module: {
            default: loadFragment,
        },
    };
    init(parentEl);
}

const postLCP = () => {
    addStyle('/fonts/fonts.css');
    loadBlocks(config);
};

function setLCPTrigger() {
    const lcpCandidate = document.querySelector('img');
    if (lcpCandidate) {
        if (lcpCandidate.complete) { postLCP(); } else {
            lcpCandidate.addEventListener('load', () => { postLCP(); });
            lcpCandidate.addEventListener('error', () => { postLCP(); });
        }
    } else {
        postLCP();
    }
}
setDomain(document);
loadTemplate(config);
setLCPTrigger();