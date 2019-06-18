import {
  Node, ElementNode, CommentNode, TextNode, PatchableNode,
  Thunk, NodeElement, HookFn,
} from './nodes'
import { elementSetEvent, AffEvent } from './event'
import { makeProxy } from './proxy'
import { kind } from './utils'

export class App {

  node: Node;
  nodeFunc: (state: any, app: App) => Node
  element: HTMLElement
  state: any;
  updatedTick: number = -1;
  updating: boolean = false;
  elementCache: {[key: string]: [NodeElement, PatchableNode][]} = {};
  textNodeCache: [NodeElement, PatchableNode][] = [];
  commentNodeCache: [NodeElement, PatchableNode][] = [];
  counters: {
    thunkFuncCall: number,
    nativeNodeCreate: number,
    nodeCacheHit: number,
  } = {
    thunkFuncCall: 0,
    nativeNodeCreate: 0,
    nodeCacheHit: 0,
  };

  constructor(...args: any[]) {
    this.init(...args);
  }

  init(...args: any[]) {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg instanceof HTMLElement) {
        this.element = arg;
      } else if (kind(arg) == 'function') {
        this.nodeFunc = arg;
      } else {
        this.state = makeProxy(arg, () => {
          this.update()
        })
      }
    }
    if (
      this.element !== undefined
      && this.nodeFunc !== undefined
      && this.state !== undefined
    ) {
      this.update()
    }
  }

  update() {
    // 不递归
    if (this.updating) {
      return
    }
    // 没有 element 不 patch
    if (!this.element) {
      return
    }
    // 没有根组件不 patch
    if (!this.nodeFunc) {
      return
    }

    // update 直到状态不更新
    this.updating = true
    let nLoops = 0;
    while (true) {
      if (nLoops > 256) {
        // 循环太多次
        throw new Error('infinite loop in updating state')
      }
      const tick = (<any>this.state).$tick()
      if (!this.node) {
        // 首次渲染
        this.node = this.nodeFunc(this.state, this);
        const elem = this.node.toElement(this);
        if (this.element.parentNode) {
          this.element.parentNode.insertBefore(elem, this.element);
          this.element.parentNode.removeChild(this.element);
        }
        this.element = <HTMLElement>elem;

      } else {
        // 非首次渲染
        const result = this.patch(
          this.element,
          this.nodeFunc(this.state, this),
          this.node,
          this.updatedTick,
        );
        this.element = <HTMLElement>result[0];
        this.node = result[1];
      }

      this.updatedTick = tick
      if ((<any>this.state).$tick() == this.updatedTick) {
        // 没有更新状态，就退出
        break
      }
      nLoops++
    }
    this.updating = false
  }

  // patch lastElement to represent node attributes, with diffing lastNode
  patch(
    lastElement: NodeElement,
    node: Node,
    lastNode: Node,
    now: number,
  ): [NodeElement, Node] {

    // thunk
    let lastThunk;
    if (lastNode instanceof Thunk) {
      lastThunk = lastNode;
      lastNode = lastThunk.node;
    }
    let thunk;
    if (node instanceof Thunk) {
      thunk = node;
    }

    if (thunk) {
      let shouldUpdate = false;
      if (!lastThunk) {
        shouldUpdate = true;
      } else if (thunk.name != lastThunk.name) {
        shouldUpdate = true;
      } else if (this.argsChanged(
        thunk.args,
        lastThunk.args,
        // 如果 last thunk 记录了 tick，优先使用
        (() => {
          if (lastThunk && lastThunk.tick > 0) {
            return lastThunk.tick;
          }
          return now
        })(),
      )) {
        shouldUpdate = true;
      }

      if (lastThunk && !shouldUpdate) {
        // reuse node
        thunk.node = lastThunk.node;
        // reuse element
        thunk.element = lastThunk.element;
      }
      node = thunk.getNode(this);
    }

    // Thunk.getNode may return another Thunk, patch recursively
    if (node instanceof Thunk) {
      return this.patch(lastElement, node, lastNode, now);
    }

    // no need to patch if two Nodes is the same object
    // if thunk's node is reuse, will return here
    if (node === lastNode) {
      return [lastElement, node];
    }

    // check if patchable
    let patchable = true;
    if (node === undefined || lastNode === undefined) {
      patchable = false;
    } else if (node.constructor != lastNode.constructor) {
      patchable = false;
    } else if (
      node instanceof ElementNode
      && lastNode instanceof ElementNode
      && (
        // 不同的标签
        node.tag != lastNode.tag
        // 不同的输入类型
        || (
          node.tag == 'INPUT' && node.attributes['type'] != lastNode.attributes['type']
        )
        // 包含了 innerHTML，因为子元素没有对应的 node，所以不能 patch
        || (
          node.innerHTML || lastNode.innerHTML
        )
      )
    ) {
      patchable = false;
    } else if (
      (lastElement instanceof HTMLElement && !(node instanceof ElementNode))
      || (lastElement instanceof Comment && !(node instanceof CommentNode))
      || (lastElement instanceof Text && !(node instanceof TextNode))
    ) {
      patchable = false
    }

    if (!patchable) {
      const element = node.toElement(this);
      // insert new then remove old
      if (lastElement.parentNode) {
        lastElement.parentNode.insertBefore(element, lastElement);
        lastElement.parentNode.removeChild(lastElement);
      }
      // cache lastElement
      this.cacheNode(<NodeElement>lastElement, lastNode);

      return [element, node];
    }

    // set element
    node.element = lastElement;
    if (thunk) {
      thunk.element = lastElement;
    }

    return this.patchNode(lastElement, node, <PatchableNode>lastNode, now);
  }

  patchNode(
    lastElement: NodeElement,
    node: PatchableNode,
    lastNode: PatchableNode,
    now: number
  ): [NodeElement, PatchableNode] {

    // text and comment node
    if (node instanceof TextNode) {
      lastNode = lastNode as TextNode
      if (node.text != lastNode.text) {
        lastElement.nodeValue = node.text;
      }
      return [lastElement, node];

    } else if (node instanceof CommentNode) {
      lastNode = lastNode as CommentNode
      if (node.text != lastNode.text) {
        lastElement.nodeValue = node.text;
      }
      return [lastElement, node];

    } else if (node instanceof ElementNode) {
      lastNode = lastNode as ElementNode
      lastElement = lastElement as HTMLElement
      return this.patchHTMLElementNode(lastElement, node, lastNode, now)
    }

  }

  patchHTMLElementNode(
    lastElement: HTMLElement,
    node: ElementNode,
    lastNode: ElementNode,
    now: number
  ): [NodeElement, ElementNode] {

    // children
    let childElements = lastElement.childNodes;
    const childLen = node.children ? node.children.length : 0;
    for (let i = 0; i < childLen; i++) {
      const child = node.children[i];
      if (
        child.key
        && lastNode.children
        && lastNode.children[i]
        && lastNode.children[i].key != child.key
      ) { // keyed
        // search for same key
        let found = false;
        // search forward on limited number
        for (let offset = 0; offset < 10; offset++) {
          if (lastNode.children[i + offset] && lastNode.children[i + offset].key == child.key) {
            found = true;
            // found same key, delete some
            for (let n = 0; n < offset; n++) {
              const elem = <NodeElement>lastElement.removeChild(childElements[i]);
              this.cacheNode(elem, lastNode.children[i]);
              lastNode.children.splice(i, 1);
            }
            childElements = lastElement.childNodes;
            // patch
            this.patch(
              <NodeElement>childElements[i],
              child,
              lastNode.children[i],
              now,
            );
            break
          }
        }
        if (!found) {
          // insert new
          const elem = child.toElement(this);
          lastElement.insertBefore(elem, childElements[i]);
          childElements = lastElement.childNodes;
          lastNode.children.splice(i, 0, placeHolderThunk)
        }
      } else {
        // not keyed
        if (!childElements[i]) {
          const elem = child.toElement(this);
          lastElement.appendChild(elem);
        } else {
          this.patch(
            <NodeElement>childElements[i],
            child,
            lastNode.children[i],
            now,
          );
        }
      }
    }
    const lastChildLen = lastNode.children ? lastNode.children.length : 0;
    for (let i = childLen; i < lastChildLen; i++) {
      const elem = lastElement.removeChild(lastElement.childNodes[childLen]);
      this.cacheNode(<NodeElement>elem, lastNode.children[i]);
    }

    // innerHTML
    if (node.innerHTML != lastNode.innerHTML) {
      lastElement.innerHTML = node.innerHTML;
    }

    // attributes
    for (const key in node.attributes) {
      let updateAttr = false;
      if (!lastNode.attributes) {
        updateAttr = true;
      } else if (node.attributes[key] != lastNode.attributes[key]) {
        updateAttr = true;
      } else if (
        node.tag == 'input'
        && node.attributes[key] != (<any>lastElement)[key]
      ) {
        updateAttr = true;
      }
      if (updateAttr) {
        const value = node.attributes[key];
        const valueType = kind(value);
        let isStringOrNumber = false;
        if (valueType === 'string') {
          isStringOrNumber = true;
        } else if (valueType === 'number') {
          isStringOrNumber = true;
        }
        if (isStringOrNumber) {
          lastElement.setAttribute(key, value);
          (<any>lastElement)[key] = value
        } else if (valueType == 'boolean') {
          if (value) {
            lastElement.setAttribute(key, key);
            (<any>lastElement)[key] = true;
          } else {
            lastElement.removeAttribute(key);
            (<any>lastElement)[key] = false;
          }
        }
      }
    }
    for (const key in lastNode.attributes) {
      let removeAttr = false;
      if (!node.attributes) {
        removeAttr = true;
      } else if (!(key in node.attributes)) {
        removeAttr = true;
      }
      if (removeAttr) {
        lastElement.removeAttribute(key);
        //lastElement[key] = undefined;
      }
    }

    // events
    const eventKeys: {[key: string]: boolean} = {};
    for (const key in node.events) {
      let k = elementSetEvent(lastElement, key, node.events[key].bind(node));
      eventKeys[k] = true;
    }
    const events = (<any>lastElement).__aff_events
    if (events) {
      for (const type in events) {
        for (const subtype in events[type]) {
          if (!(type + ':' + subtype in eventKeys)) {
            delete (<any>lastElement).__aff_events[type][subtype];
          }
        }
      }
    }

    // id
    if (node.id != lastNode.id) {
      lastElement.id = node.id;
    }

    // class
    for (const key in node.classList) {
      // should update
      let updateClass = false;
      if (!lastNode.classList) {
        updateClass = true;
      } else if (node.classList[key] != lastNode.classList[key]) {
        updateClass = true;
      }
      if (updateClass) {
        if (node.classList[key]) {
          lastElement.classList.add(key);
        } else {
          lastElement.classList.remove(key);
        }
      }
    }
    for (const key in lastNode.classList) {
      let deleteClass = false;
      if (!node.classList) {
        deleteClass = true;
      } else if (!(key in node.classList)) {
        deleteClass = true;
      }
      if (deleteClass) {
        lastElement.classList.remove(key);
      }
    }

    // styles
    const styleType = kind(node.style);
    const lastStyleType = kind(lastNode.style);
    // different type, no diff, patch directly
    if (styleType !== lastStyleType) {
      lastElement.style.cssText = ''
      if (styleType === 'string') {
        lastElement.style.cssText = <string>node.style;
      } else if (styleType === 'object') {
        const styles = <{[key: string]: string}>node.style
        for (const key in styles) {
          lastElement.style.setProperty(key, styles[key])
        }
      }
    }
    // diff object
    else if (styleType === 'object') {
      const styles = <{[key: string]: string}>node.style
      const lastStyles = <{[key: string]: string}>lastNode.style
      for (const key in styles) {
        let updateStyle = false;
        if (styles[key] != lastStyles[key]) {
          updateStyle = true;
        }
        if (updateStyle) {
          lastElement.style.setProperty(key, styles[key])
        }
      }
      for (const key in lastStyles) {
        let clearStyle = false;
        if (!(key in styles)) {
          clearStyle = true;
        }
        if (clearStyle) {
          lastElement.style.setProperty(key, '')
        }
      }
    }
    // string, compare
    else if (styleType === 'string') {
      if (node.style !== lastNode.style) {
        lastElement.style.cssText = <string>node.style;
      }
    }

    // hook
    node.hooks.patched.forEach((fn: HookFn) => fn(lastElement));

    return [lastElement, node];
  }

  argsChanged(arg: any, lastArg: any, tick: number): boolean {
    const argKind = kind(arg);

    // different kind
    if (argKind != kind(lastArg)) {
      return true;

    // state
    } else if (argKind == 'proxy' || argKind == 'object' && arg.$$isProxy$$) {
      if (arg.$changed(tick)) {
        return true;
      }

    // array
    } else if (argKind == 'array') {
      if (arg.length != lastArg.length) {
        return true
      }
      for (let i = 0; i < arg.length; i++) {
        if (this.argsChanged(arg[i], lastArg[i], tick)) {
          return true
        }
      }

    // object
    } else if (argKind == 'object') {
      // different keys length
      if (Object.keys(arg).length != Object.keys(lastArg).length) {
        return true;
      }
      for (const key in arg) {
        if (this.argsChanged(arg[key], lastArg[key], tick)) {
          return true
        }
      }

    // identity
    } else if (arg !== lastArg) {
      return true
    }

    return false
  }

  cacheNode(element: NodeElement, node: Node) {
    if (element === undefined || node === undefined) {
      return
    }

    if (
      (element instanceof HTMLElement && !(node instanceof ElementNode))
      || (element instanceof Comment && !(node instanceof CommentNode))
      || (element instanceof Text && !(node instanceof TextNode))
    ) {
      return
    }

    if (node instanceof TextNode) {
      this.textNodeCache.push([element, node]);
    } else if (node instanceof CommentNode) {
      this.commentNodeCache.push([element, node]);
    } else if (node instanceof ElementNode) {
      if (node.innerHTML) { // 不可用
        return
      }
      const tagName = (<Element>element).tagName.toLowerCase()
      this.elementCache[tagName] = this.elementCache[tagName] || []
      this.elementCache[tagName].push([element, node]);
    }

    // Thunk
    while (node instanceof Thunk) {
      node = node.getNode(this);
      this.cacheNode(element, node);
    }
  }

}

const placeHolderThunk = new Thunk()
