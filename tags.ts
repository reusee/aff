import { e } from './nodes'
import { css } from './tagged'
import { CommentNode } from './nodes'

const allTags = [

  // html
  'a', 'abbr', 'acronym', 'address', 'applet', 'area', 'article', 'aside', 'audio',
  'b', 'base', 'basefont', 'bdi', 'bdo', 'bgsound', 'big', 'blink', 'blockquote', 'body', 'br', 'button',
  'canvas', 'caption', 'center', 'cite', 'code', 'col', 'colgroup', 'command', 'content',
  'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'dir', 'div', 'dl', 'dt',
  'element', 'em', 'embed',
  'fieldset', 'figcaption', 'figure', 'font', 'footer', 'form', 'frame', 'frameset',
  'head', 'header', 'hgroup', 'hr', 'html',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7',
  'i', 'iframe', 'image', 'img', 'input', 'ins', 'isindex',
  'kbd', 'keygen',
  'label', 'legend', 'li', 'link', 'listing',
  'main', 'map', 'mark', 'marquee', 'menu', 'menuitem', 'meta', 'meter', 'multicol',
  'nav', 'nobr', 'noembed', 'noframes', 'noscript',
  'object', 'ol', 'optgroup', 'option', 'output',
  'p', 'param', 'picture', 'plaintext', 'pre', 'progress',
  'q',
  'rp', 'rt', 'rtc', 'ruby',
  's', 'samp', 'script', 'section', 'select', 'shadow', 'small', 'source', 'spacer', 'span', 'strike', 'strong', 'style', 'sub', 'summary', 'sup',
  'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track', 'tt',
  'u', 'ul',
  'var', 'video',
  'wbr',
  'xmp',

  // svg
  'a', 'altGlyph', 'altGlyphDef', 'altGlyphItem', 'animate', 'animateColor', 'animateMotion', 'animateTransform', 'audio',
  'canvas', 'circle', 'clipPath', 'color-profile', 'cursor',
  'defs', 'desc', 'discard',
  'ellipse',
  'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feComposite', 'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap', 'feDistantLight',
  'feDropShadow', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR', 'feGaussianBlur', 'feImage', 'feMerge', 'feMergeNode', 'feMorphology',
  'feOffset', 'fePointLight', 'feSpecularLighting', 'feSpotLight', 'feTile', 'feTurbulence', 'filter',
  'font', 'font-face', 'font-face-format', 'font-face-name', 'font-face-src', 'font-face-uri', 'foreignObject',
  'g', 'glyph', 'glyphRef',
  'hatch', 'hatchpath', 'hkern',
  'iframe', 'image',
  'line', 'linearGradient',
  'marker', 'mask', 'mesh', 'meshgradient', 'meshpatch', 'meshrow', 'metadata', 'missing-glyph', 'mpath',
  'path', 'pattern', 'polygon', 'polyline',
  'radialGradient', 'rect',
  'script', 'set', 'solidcolor', 'stop', 'style', 'svg', 'switch', 'symbol',
  'text', 'textPath', 'title', 'tref', 'tspan',
  'unknown', 'use',
  'video', 'view', 'vkern',

];

type Helpers = {[key: string]: any}

let helpers: Helpers = allTags.reduce((helpers: Helpers, tag: string) => {
  helpers[tag] = function(...args: any[]) {
    return e(tag, ...args);
  };
  helpers[tag.charAt(0).toUpperCase() + tag.slice(1)] = helpers[tag];
  helpers[tag.toUpperCase()] = helpers[tag];
  return helpers;
}, {});

const checkbox = (...args: any[]) => e('input', {
  type: 'checkbox',
}, ...args);

const none = new CommentNode();
none.text = ' none ';

const clear = e('div', css`
  clear: both;
`);

helpers = {...helpers,
  none: none,
  None: none,
  NONE: none,

  clear: clear,
  Clear: clear,
  CLEAR: clear,

  checkbox: checkbox,
  Checkbox: checkbox,
  CHECKBOX: checkbox,
};

export let h = helpers;
