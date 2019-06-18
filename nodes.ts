import { elementSetEvent } from './event'
import { Selector, Css, Key } from './tagged'
import { Events } from './event'
import { App } from './app'
import { kind } from './utils'

export type NodeElement = HTMLElement | Comment | Text

export type PatchableNode =
  ElementNode
  | TextNode
  | CommentNode

export type Node =
  PatchableNode
  | Thunk

function isNode(o: any): boolean {
  return o instanceof ElementNode
  || o instanceof TextNode
  || o instanceof CommentNode
  || o instanceof Thunk
}

export type HookFn = (arg: Node | NodeElement) => void

export class ElementNode {
  element: NodeElement
  tag: string;
  id: string;
  style: string | {[key: string]: string};
  classList: {[key: string]: boolean};
  children: Node[] = [];
  attributes: {[key: string]: string};
  events: {[key: string]: {[key: string]: (arg: Node) => void}};
  innerHTML: string;
  hooks: {
    created: HookFn[],
    patched: HookFn[],
  } = {
    created: [],
    patched: [],
  }
  key: string;

  toElement(app: App) {
    let element: HTMLElement;
    // use cached element
    if (app && app.elementCache[this.tag] && app.elementCache[this.tag].length > 0) {
      if (app) {
        app.counters.nodeCacheHit++;
      }
      let result = app.elementCache[this.tag].shift();
      if (result === undefined) {
        throw new Error('bad cache')
      }
      let element = result[0];
      const lastNode = result[1];
      result = app.patchNode(element, this, lastNode, app.state.$tick);
      element = result[0];
      this.element = element;
      if (this.hooks && this.hooks.created) {
        this.hooks.created.forEach(fn => fn(element));
      }
      return element;
    }
    element = document.createElement(this.tag);
    if (app) {
      app.counters.nativeNodeCreate++;
    }
    if (this.innerHTML !== undefined) {
      element.innerHTML = this.innerHTML;
    }
    if (this.id !== undefined) {
      element.id = this.id;
    }
    if (this.style !== undefined) {
      if (kind(this.style) == 'object') {
        for (const key in (<{[key: string]: string}>this.style)) {
          element.style.setProperty(key, (<{[key: string]: string}>this.style)[key])
        }
      } else {
        element.style.cssText = <string>this.style
      }
    }
    if (this.classList !== undefined) {
      let className = '';
      for (let k in this.classList) {
        if (this.classList[k]) {
          className = className + k + ' ';
        }
      }
      element.className = className.trim();
    }
    if (this.children !== undefined) {
      const childFragment = document.createDocumentFragment();
      for (let i = 0, l = this.children.length; i < l; i++) {
        childFragment.appendChild(this.children[i].toElement(app));
      }
      element.appendChild(childFragment);
    }
    if (this.attributes !== undefined) {
      for (const key in this.attributes) {
        const value = this.attributes[key];
        const valueType = kind(value);
        let isStringOrNumber = false;
        if (valueType === 'string') {
          isStringOrNumber = true;
        } else if (valueType === 'number') {
          isStringOrNumber = true;
        }
        if (isStringOrNumber) {
          element.setAttribute(key, value);
        } else if (valueType == 'boolean') {
          if (value) {
            element.setAttribute(key, key);
          } else {
            element.removeAttribute(key);
          }
        }
      }
    }
    if (this.events !== undefined) {
      for (const key in this.events) {
        // set event callback, bind current Node to callback
        // constructor must not be arrow function to get proper 'this'
        elementSetEvent(element, key, this.events[key].bind(this));
      }
    }
    this.element = element;
    if (this.hooks && this.hooks.created) {
      this.hooks.created.forEach(fn => fn(element));
    }
    return element;
  }

  setSelector(selector: string) {
    const parts = selector.match(/[.#][A-Za-z][A-Za-z0-9_:-]*/g);
    if (parts) {
      for (let i = 0, l = parts.length; i < l; i++) {
        const part = parts[i];
        if (part.charAt(0) == '#') {
          this.id = part.substring(1);
        } else if (part.charAt(0) == '.') {
          if (!this.classList) {
            this.classList = {};
          }
          this.classList[part.substring(1)] = true;
        }
      }
    }
  }

  setProperties(properties: {[key: string]: any}) {
    for (const key in properties) {
      if (key === 'id') {
        this.id = properties[key]
      } else if (key === 'innerHTML') {
        this.innerHTML = properties[key]
      } else if (key == 'classList') {
        if (!this.classList) {
          this.classList = {};
        }
        const property = properties.classList;
        if (kind(property) == 'string') {
          const parts = property.match(/[A-Za-z][A-Za-z0-9_:-]*/g);
          if (parts) {
            for (let i = 0, l = parts.length; i < l; i++) {
              const part = parts[i];
              this.classList[part] = true;
            }
          }
        } else if (kind(property) == 'object') {
          for (const k in property) {
            this.classList[k] = property[k];
          }
        } else if (kind(property) == 'array') {
          for (let i = 0; i < property.length; i++) {
            this.classList[property[i]] = true;
          }
        } else {
          throw['bad class', property];
        }
      } else if (key == 'style') {
        // styles
        if (this.style === undefined) {
          this.style = properties.style;
        } else {
          const style = properties.style;
          const styleType = kind(style);
          const currentType = kind(this.style);
          if (styleType != currentType) {
            console.warn(style)
            console.warn(this.style)
            throw new Error('should not mix-use object-like style and string-like style')
          }
          if (styleType === 'string') {
            (<string>this.style) += style;
          } else if (styleType === 'object') {
            for (const key in style) {
              (<{[key: string]: string}>this.style)[key] = (<{[key: string]: string}>style)[key];
            }
          }
        }
      } else if (/^on/.test(key) && kind(properties[key]) === 'function') {
        if (key === 'oncreated') {
          this.hooks.created.push(properties[key]);
        } else if (key === 'onpatched') {
          this.hooks.patched.push(properties[key]);
        } else {
          // events
          if (!this.events) {
            this.events = {};
          }
          this.events[key] = properties[key];
        }
      } else {
        if (!this.attributes) {
          this.attributes = {};
        }
        this.attributes[key] = properties[key];
      }
    }
  }

  setChildren(children: any) {
    const type = kind(children);
    if (type === 'null') {
      return
    }
    let isText = false;
    if (type === 'boolean') {
      isText = true;
    } else if (type === 'number') {
      isText = true;
    } else if (type === 'string') {
      isText = true;
    } else if (type === 'symbol') {
      isText = true;
    }
    if (type === 'object' || type === 'array') {
      this.children.push(children);
    } else if (isText) {
      const child = new TextNode();
      child.text = children.toString();
      this.children.push(child);
    } else {
      console.warn(this)
      console.warn(children)
      throw new Error('bad child')
    }
  }

}

export class TextNode {
  element: NodeElement
  text: string;
  key: string;

  toElement(app: App): NodeElement {
    if (app && app.textNodeCache.length > 0) {
      if (app) {
        app.counters.nodeCacheHit++;
      }
      let result = app.textNodeCache.shift();
      if (result === undefined) {
        throw new Error('bad cache')
      }
      let element = result[0];
      const lastNode = result[1];
      result = app.patchNode(element, this, lastNode, app.state.$tick);
      element = result[0];
      this.element = element;
      return element;
    }
    if (app) {
      app.counters.nativeNodeCreate++;
    }
    return document.createTextNode(this.text);
  }
}

export class CommentNode {
  element: NodeElement
  text: string;
  key: string;

  toElement(app: App): NodeElement {
    if (app && app.commentNodeCache.length > 0) {
      if (app) {
        app.counters.nodeCacheHit++;
      }
      let result = app.commentNodeCache.shift();
      if (result === undefined) {
        throw new Error('bad cache')
      }
      let element = result[0];
      const lastNode = result[1];
      result = app.patchNode(element, this, lastNode, app.state.$tick);
      if (result === undefined) {
        throw new Error('bad patch')
      }
      element = result[0];
      this.element = element;
      return element;
    }
    if (app) {
      app.counters.nativeNodeCreate++;
    }
    return document.createComment(this.text);
  }
}

export class Thunk {
  element: NodeElement;
  children: Node[];
  func: any;
  args: any[];
  node: Node;
  name: string;
  key: string;
  tick: number;

  toElement(app: App): NodeElement {
    if (!this.element) {
      const node = this.getNode(app);
      if (isNode(node)) {
        this.element = node.toElement(app);
      } else {
        throw['thunk function must return a Node', this, node];
      }
    }
    return this.element;
  }

  getNode(app: App) {
    if (!this.node) {
      // 记录 tick
      for (let arg of this.args) {
        const argKind = kind(arg);
        if (argKind == 'proxy' || argKind == 'object' && arg.$$isProxy$$) {
          this.tick = arg.$tick();
        }
      }
      this.node = this.func.apply(this, this.args);
      if (app) {
        app.counters.thunkFuncCall++;
      }
      if (this.node === null) {
        this.node = new CommentNode();
        this.node.text = ' none ';
      }
      if (!this.node) {
        throw['constructor of ' + (this.name || 'anonymous') + ' returned undefined value', this];
      }
    }
    return this.node;
  }

}

// thunk helper
export function t(...args: any[]) {
  if (args.length == 0) {
    throw['no arguments to t()'];
  }
  const thunk = new Thunk();
  switch (kind(args[0])) {
  case 'string': // named thunk
    thunk.name = args[0];
    thunk.func = args[1];
    thunk.args = [];
    for (let i = 2; i < args.length; i++) {
      const arg = args[i];
      if (arg instanceof Key) {
        thunk.key = arg.str;
      } else {
        thunk.args.push(arg);
      }
    }
    break
  case 'function':
    thunk.func = args[0];
    thunk.name = thunk.func.name;
    thunk.args = [];
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (arg instanceof Key) {
        thunk.key = arg.str;
      } else {
        thunk.args.push(arg);
      }
    }
    break
  }
  if (!thunk.func) {
    throw['invalid thunk func', thunk.func];
  }
  return thunk
}

// element helper
export function e(tag: string, ...args: any[]) {
  const node = new ElementNode();
  node.tag = tag;
  _e(node, ...args);
  return node;
}

export const skip = { skipFollowingArguments: true };

function _e(node: ElementNode, ...args: any[]): ElementNode {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (isNode(arg)) {
      node.setChildren(arg);
    } else if (arg instanceof Selector) {
      node.setSelector(arg.str);
    } else if (arg instanceof Css) {
      node.setProperties({
        style: arg.str,
      });
    } else if (arg instanceof Events) {
      for (let idx = 0; idx < arg.events.length; idx++) {
        const ev = arg.events[idx];
        node.setProperties({
          ['on' + ev.type]: ev.fn,
        });
      }
    } else if (arg instanceof Key) {
      node.key = arg.str;
    } else if (arg === skip) {
      break
    } else if (kind(arg) === 'object') {
      node.setProperties(arg);
    } else if (kind(arg) === 'array') {
      // flatten
      _e(node, ...arg);
    } else if (arg === undefined) {
      // do nothing
    } else if (kind(arg) === 'function') {
      _e(node, arg());
    } else {
      node.setChildren(arg);
    }
  }
  return node;
}
