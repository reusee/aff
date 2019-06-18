import { kind } from './utils'
import { pathClean, pathJoin, pathIsAbs, pathDir } from './path'

type Proxy = ObjectProxy | ArrayProxy | String | Number | Boolean | Function

export class Reference {
  target: string;
  read: boolean;
  write: boolean;
  $$isRef$$: boolean = true;
  constructor(target: string, read: boolean, write: boolean) {
    this.target = target
    this.read = read
    this.write = write
  }
}

export function ref(target: string, mode?: string): Reference {
  if (mode === undefined) {
    mode = 'rw'
  }
  const read = mode.indexOf('r') >= 0
  const write = mode.indexOf('w') >= 0
  return new Reference(target, read, write)
}

type Change = {
  tick: number,
  path: string,
}

export function makeProxy(root: object, onChange?: any): any {

  const proxies: {[key: string]: Proxy} = {}
  const readRedirects: {[key: string]: string} = {}
  let tick = 0
  const changes: Change[] = [];

  function absPathToList(absPath: string): string[] {
    const ret = [];
    const parts = absPath.split('/')
    for (const part of parts) {
      if (part != '') {
        ret.push(part)
      }
    }
    return ret
  }

  function valueByPath(absPath: string): any {
    const pathList = absPathToList(absPath)
    return valueByPathList(pathList, root)
  }

  function valueByPathList(list: string[], obj: any): any {
    if (list.length == 0) {
      return obj
    }
    const first = list.shift()
    if (first === undefined) {
      throw new Error('undefined path')
    }
    return valueByPathList(list, obj[first])
  }

  function setValueByPath(value: any, absPath: string) {
    const pathList = absPathToList(absPath)
    setValueByPathList(pathList, root, value, [])
  }

  function setValueByPathList([head, ...tail]: string[], obj: any, value: any, pre: string[]) {
    // root
    if (head === undefined && obj === root) {
      throw new Error('cannot update root object')

    // sub
    } else if (head !== undefined && tail.length == 0) {
      if (kind(obj[head]) == 'ref') {
        // deref
        const absPath = pathClean('/' + pre.join('/') + '/' + head)
        let targetPath = obj[head].target
        if (!pathIsAbs(targetPath)) {
          targetPath = pathJoin(pathDir(absPath), targetPath)
        }
        targetPath = pathClean(targetPath)
        setValueByPath(value, targetPath)
        return
      }
      if (!compatibleValue(obj[head], value)) {
        console.log(obj[head], value)
        throw new Error("incompatible type")
      }
      if (obj[head] === value) {
        return // 不更新
      }
      obj[head] = value
      const absPath = pathClean('/' + pre.join('/') + '/' + head)
      pathChanged(absPath)

    // recursive
    } else {
      setValueByPathList(tail, obj[head], value, [...pre, head])
    }
  }

  function pathChanged(absPath: string) {
    tick++
    const changedPaths = logChange(absPath)
    // invalidate changed paths
    for (const changePath of changedPaths) {
      for (const key in proxies) {
        // 删除所有这个路径上的代理，下次 byPath 时会重建
        if (key.indexOf(changePath) == 0) {
          delete proxies[key]
          delete readRedirects[key]
        }
      }
    }
    if (onChange) {
      onChange()
    }
  }

  function logChange(absPath: string): string[] {
    changes.push({
      tick: tick,
      path: absPath,
    })
    const changedPaths = [];
    changedPaths.push(absPath)
    const refPaths: {[key: string]: boolean} = {}
    const paths = [absPath]
    while (paths.length > 0) {
      const path = paths.pop()
      if (path === undefined) {
        throw new Error('undefined path')
      }
      for (let from in readRedirects) {
        const to = readRedirects[from]
        if (path.indexOf(to) == 0) {
          // 指向的路径的父路径发生了变化，则这个引用也发生了变化
          if (!refPaths[from]) {
            refPaths[from] = true
            // 引用可能被其他引用指向，递归处理
            paths.push(from)
          }
        }
      }
    }
    for (let path in refPaths) {
      changes.push({
        tick: tick,
        path: path,
      })
      changedPaths.push(path)
    }
    if (changes.length > 2000) {
      changes.splice(0, 1000)
    }
    return changedPaths
  }

  function byPath(absPath: string): Proxy {
    if (absPath in proxies) {
      return proxies[absPath]
    }
    let proxy: Proxy;
    const obj = valueByPath(absPath)
    const objKind = kind(obj)

    if (objKind == 'ref') {
      let targetPath = obj.target
      if (!pathIsAbs(targetPath)) {
        targetPath = pathJoin(pathDir(absPath), targetPath)
      }
      targetPath = pathClean(targetPath)
      const target = byPath(targetPath)
      proxies[absPath] = target
      changes.push({
        tick: tick,
        path: absPath,
      })
      if (obj.read) {
        readRedirects[absPath] = targetPath
      }
      return target
    }

    let isPrimitive = false
    if (objKind == 'object') {
      proxy = new ObjectProxy()
      const properties: {[key: string]: any} = {}
      for (const key in obj) {
        const subAbsPath = pathClean(absPath + '/' + key)
        properties[key] = {
          configurable: false,
          enumerable: true,
          get: () => {
            return byPath(subAbsPath)
          },
          set: (v: any) => {
            (<any>proxy).$(key, v)
          }
        }
      }
      Object.defineProperties(proxy, properties)

    } else if (objKind == 'array') {
      proxy = new ArrayProxy(
        absPath,
        valueByPath,
        byPath,
        pathChanged,
      )
      const indexAccessors: {[key: number]: any} = {}
      for (let i = 0; i < obj.length * 2; i++) {
        const subAbsPath = pathClean(absPath + '/' + i)
        indexAccessors[i] = {
          configurable: false,
          enumerable: true,
          get: () => {
            return byPath(subAbsPath)
          },
          set: (v: any) => {
            (<any>proxy).$(subAbsPath, v)
          }
        }
      }
      Object.defineProperties(proxy, indexAccessors)

    } else if (
      objKind == 'string' ||
      objKind == 'number' ||
      objKind == 'boolean' ||
      objKind == 'null' ||
      objKind == 'undefined' ||
      objKind == 'function'
    ) {
      proxy = obj
      isPrimitive = true

    } else {
      throw new Error('not handle kind ' + objKind)
    }

    if (!isPrimitive) {
      Object.defineProperty(proxy, '$absPath', {
        configurable: false,
        enumerable: false,
        writable: false,
        value: absPath,
      })
      Object.defineProperty(proxy, '$root', {
        configurable: false,
        enumerable: false,
        writable: false,
        value: root,
      })
      Object.defineProperty(proxy, '$', {
        configurable: false,
        enumerable: false,
        writable: false,
        value: (...args: any[]) => {
          if (args.length == 0) {
            return valueByPath(absPath)
          }
          for (let i = 0; i < args.length; i += 2) {
            let path = args[i]
            const value = args[i+1]
            if (!pathIsAbs(path)) {
              path = pathJoin(absPath, path)
            }
            path = pathClean(path)
            if (path.indexOf(absPath) != 0) {
              throw new Error('outside scope')
            }
            setValueByPath(value, path)
          }
        },
      })
      Object.defineProperty(proxy, '$tick', {
        configurable: false,
        enumerable: false,
        writable: false,
        value: () => {
          return tick
        },
      })
      Object.defineProperty(proxy, '$changed', {
        configurable: false,
        enumerable: false,
        writable: false,
        value: (fromTick: number): boolean => {
          for (let i = changes.length - 1; i >= 0; i--) {
            const change = changes[i]
            if (change.tick > fromTick && change.path.indexOf(absPath) == 0) {
              // 子状态改变，父状态也认为改变了
              return true
            }
          }
          return false
        },
      })
      Object.defineProperty(proxy, '$$isProxy$$', {
        configurable: false,
        enumerable: false,
        writable: false,
        value: true,
      })
    }
    Object.seal(proxy)

    proxies[absPath] = proxy
    return proxy
  }

  return byPath("/")
}

function compatibleValue(a: any, b: any): boolean {
  const kindA = kind(a)
  const kindB = kind(b)
  // object 和 array 兼容 null
  if (kindA == 'object' && kindB == 'null') {
    return true
  } else if (kindA == 'null' && kindB == 'object') {
    return true
  } else if (kindA == 'array' && kindB == 'null') {
    return true
  } else if (kindA == 'null' && kindB == 'array') {
    return true
  }
  return kindA === kindB
}

function isProxy(o: any): boolean {
  return kind(o) == 'object' && o.hasOwnProperty('$$isProxy$$')
}

export class ObjectProxy {
}

export class ArrayProxy {
  absPath: string
  valueByPath: any
  byPath: any
  pathChanged: any

  constructor(absPath: any, valueByPath: any, byPath: any, pathChanged: any) {
    this.absPath = absPath
    this.valueByPath = valueByPath
    this.byPath = byPath
    this.pathChanged = pathChanged
  }

  get length() {
    return this.valueByPath(this.absPath).length
  }

  slice(...args: any[]) {
    for (let i = 0; i < args.length; i++) {
      if (isProxy(args[i])) {
        args[i] = args[i].$()
      }
    }
    return this.valueByPath(this.absPath).slice(...args)
  }

  map(
    fn: (elem: Proxy, i: number, array: Proxy) => any[],
  ) {
    return this.valueByPath(this.absPath).map((_: any, i: number) => fn(
      this.byPath(pathClean(this.absPath + '/' + i)),
      i,
      this,
    ))
  }

  includes(e: any): boolean {
    return this.valueByPath(this.absPath).includes(e)
  }

  reduce(
    fn: (acc: any, cur: Proxy, i: number, array: Proxy) => any,
    initial: any,
  ) {
    if (isProxy(initial)) {
      initial = initial.$()
    }
    return this.valueByPath(this.absPath).reduce((acc: any, cur: any, i: number, array: any) => fn(
      acc,
      this.byPath(pathClean(this.absPath + '/' + i)),
      i,
      this,
    ), initial)
  }

  splice(...args: any[]) {
    for (let i = 0; i < args.length; i++) {
      if (isProxy(args[i])) {
        args[i] = args[i].$()
      }
    }
    this.valueByPath(this.absPath).splice(...args)
    this.pathChanged(this.absPath)
  }

  push(...args: any[]) {
    for (let i = 0; i < args.length; i++) {
      if (isProxy(args[i])) {
        args[i] = args[i].$()
      }
    }
    (<any>this).$().push(...args)
    this.pathChanged(this.absPath)
  }

  pop() {
    (<any>this).$().pop()
    this.pathChanged(this.absPath)
  }

  unshift(...args: any[]) {
    for (let i = 0; i < args.length; i++) {
      if (isProxy(args[i])) {
        args[i] = args[i].$()
      }
    }
    (<any>this).$().unshift(...args)
    this.pathChanged(this.absPath)
  }

  shift() {
    (<any>this).$().shift()
    this.pathChanged(this.absPath)
  }

  //TODO more operations

}
