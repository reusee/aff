export class Selector {
  str: string
  constructor(str: string) {
    this.str = str
  }
}

export class Css {
  str: string
  constructor(str: string) {
    this.str = str
  }
}

export class Key {
  str: string
  constructor(str: string) {
    this.str = str
  }
}

function makeTagger(constructor: any) {
  function tag(strings: string[] | TemplateStringsArray | string, ...values: any[]) {
    if (typeof(strings) == 'string') {
      return new constructor(strings)
    }
    let str = '';
    for (let i = 0; i < strings.length; i++) {
      str += strings[i];
      if (values[i] !== undefined) {
        str += values[i];
      }
    }
    return new constructor(str);
  }
  return tag;
}

export const $ = makeTagger(Selector);
export const css = makeTagger(Css);
export const key = makeTagger(Key);
