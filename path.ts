class lazybuf {
  s: string
  buf: string[]
  w: number = 0

  index(i: number): string {
    if (this.buf !== undefined) {
      return this.buf[i]
    }
    return this.s[i]
  }

  append(c: string) {
    if (this.buf === undefined) {
      if (this.w < this.s.length && this.s[this.w] == c) {
        this.w++
        return
      }
      this.buf = []
      for (let i = 0; i < this.w; i++) {
        this.buf.push(this.s[i])
      }
      while (this.buf.length < this.s.length) {
        this.buf.push('')
      }
    }
    this.buf[this.w] = c
    this.w++
  }

  string(): string {
    if (this.buf === undefined) {
      return this.s.slice(0, this.w)
    }
    return this.buf.slice(0, this.w).join('')
  }

}

export function pathClean(path: string): string {
  if (path == '') {
    return '.'
  }
  const rooted = path[0] == '/'
  const n = path.length
  const out = new lazybuf()
  out.s = path
  let r = 0
  let dotdot = 0
  if (rooted) {
    out.append('/')
    r = 1
    dotdot = 1
  }
  while (r < n) {
    if (path[r] == '/') {
      r++
    } else if (path[r] == '.' && (r+1 == n || path[r+1] == '/')) {
      r++
    } else if (path[r] == '.' && path[r+1] == '.' && (r+2 == n || path[r+2] == '/')) {
      r += 2
      if (out.w > dotdot) {
        out.w--
        while (out.w > dotdot && out.index(out.w) != '/') {
          out.w--
        }
      } else if (!rooted) {
        if (out.w > 0) {
          out.append('/')
        }
        out.append('.')
        out.append('.')
        dotdot = out.w
      }
    } else {
      if (rooted && out.w != 1 || !rooted && out.w != 0) {
        out.append('/')
      }
      for (; r < n && path[r] != '/'; r++) {
        out.append(path[r])
      }
    }
  }
  if (out.w == 0) {
    return '.'
  }
  return out.string()
}

export function pathJoin(...elem: string[]): string {
  for (let i = 0; i < elem.length; i++) {
    const e = elem[i]
    if (e != '') {
      return pathClean(elem.slice(i).join('/'))
    }
  }
  return ''
}

export function pathIsAbs(path: string): boolean {
  return path.length > 0 && path[0] == '/'
}

export function pathDir(path: string): string {
  const [dir, _] = pathSplit(path)
  return pathClean(dir)
}

export function pathSplit(path: string): [string, string] {
  const i = path.lastIndexOf('/')
  return [
    path.slice(0, i + 1),
    path.slice(i + 1),
  ]
}
