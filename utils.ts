import { Reference } from './proxy'

export function kind(o: any): string {
  const t = typeof o;
  if (t == 'object') {
    if (o === null) {
      return 'null'
    } else if (o instanceof Reference || o.hasOwnProperty('$$isRef$$')) {
      return 'ref'
    } else if (o instanceof Number) {
      return 'number'
    } else if (o instanceof Boolean) {
      return 'boolean'
    } else if (o instanceof String) {
      return 'string'
    } else if (Array.isArray(o)) {
      return 'array'
    }
    return 'object'
  }
  return t
}
