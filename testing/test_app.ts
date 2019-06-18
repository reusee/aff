import { App, h, $, t, css, on, key } from './aff/index'
import { CommentNode } from './aff/nodes'
import { eq } from './utils'

// basic
new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    state.foo,
  ),
  {
    foo: 'FOO',
  }
)
eq(
  document.getElementById('test').innerHTML,
  'FOO',
)

// multiple step
let app = new App()
app.init(
  document.getElementById('test'),
)
app.init(
  (state) => h.div(
    $`#test`,
    state.foo,
  ),
)
app.init(
  {
    foo: 'BAR',
  }
)
eq(
  document.getElementById('test').innerHTML,
  'BAR',
)

// update
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    state.n,
  ),
  {
    n: 0,
  }
)
eq(
  document.getElementById('test').innerHTML,
  '0',
)
app.state.n = 1
eq(
  document.getElementById('test').innerHTML,
  '1',
)
app.state.n = 2
eq(
  document.getElementById('test').innerHTML,
  '2',
)

// thunk caching
let Foo = (state) => h.div(state.foo)
app = new App(
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return t(Foo, state.Foo)
      } else if (state.n == 1) {
        return null
      } else {
        return t(Foo, state.Foo)
      }
    },
  ),
  {
    n: 0,
    Foo: {
      foo: 'yes',
    },
  },
  document.getElementById('test'),
)
app.state.n++
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<div>yes</div>',
)

// comment node caching
Foo = (state) => null
app = new App(
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return t(Foo, state.Foo)
      } else if (state.n == 1) {
        return null
      } else {
        return t(Foo, state.Foo)
      }
    },
  ),
  {
    n: 0,
    Foo: {
      foo: 'yes',
    },
  },
  document.getElementById('test'),
)
app.state.n++
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<!-- none -->',
)

// text node caching
app = new App(
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return h.div(
          'foo', 'bar', 'baz',
        )
      } else if (state.n == 1) {
        return h.div(
          'foo',
        )
      } else {
        return h.div(
          'foo', 'bar', 'baz',
        )
      }
    },
  ),
  {
    n: 0,
  },
  document.getElementById('test'),
)
app.state.n++
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<div>foobarbaz</div>',
)

// thunk args not changed
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return t('Foo', (state) => h.div(), state.Foo)
      } else if (state.n == 1) {
        return t('Foo', (state) => h.div(), state.Foo)
      }
      return null
    }
  ),
  {
    n: 0,
    m: 0,
  },
)
app.state.n++
app.state.m++
eq(
  document.getElementById('test').innerHTML,
  '<div></div>',
)

// thunk number args changed
app = new App(
  document.getElementById('test'),
  (state) =>  h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return t('Foo', () => h.span('foo'), 1, 2, 3)
      } else {
        return t('Foo', () => h.span('foo'), 2, 3, 4)
      }
    },
  ),
  {
    n: 0,
  },
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<span>foo</span>',
)

// thunk object arg changed
app = new App(
  document.getElementById('test'),
  (state) =>  h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return t('Foo', (state) => h.span(state.foo), {
          'foo': 'FOO',
        })
      } else {
        return t('Foo', (state) => h.span(state.foo), {
          'foo': 'foo',
        })
      }
    },
  ),
  {
    n: 0,
  },
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<span>foo</span>',
)

// thunk object arg key changed
app = new App(
  document.getElementById('test'),
  (state) =>  h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return t('Foo', (state) => h.span(state.foo), {
          'foo': 'FOO',
          'bar': 'BAR',
        })
      } else {
        return t('Foo', (state) => h.span(state.foo), {
          'foo': 'foo',
        })
      }
    },
  ),
  {
    n: 0,
  },
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<span>foo</span>',
)

// thunk array arg length changed
app = new App(
  document.getElementById('test'),
  (state) =>  h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return t('Foo', (ary) => h.span(ary.length), [])
      } else {
        return t('Foo', (ary) => h.span(ary.length), [1,2,3])
      }
    },
  ),
  {
    n: 0,
  },
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<span>3</span>',
)

// thunk proxy arg changed
app = new App(
  document.getElementById('test'),
  (state) =>  h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return t('Foo', (state) => h.span(state.n), state.Foo)
      } else {
        return t('Foo', (state) => h.span(state.n), state.Foo)
      }
    },
  ),
  {
    n: 0,
    Foo: {
      n: 9,
    },
  },
)
app.state.n++
app.state.Foo.n++
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<span>10</span>',
)

// thunk arg kind changed
app = new App(
  document.getElementById('test'),
  (state) =>  h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return t('Foo', (a) => h.span(a), [])
      } else {
        return t('Foo', (a) => h.span(a), 1)
      }
    },
  ),
  {
    n: 0,
  },
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<span>1</span>',
)

// patch string style
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return h.div(css`
          color: red;
        `, 'FOO')
      } else {
        return h.div(css`
          color: blue;
        `, 'BAR')
      }
    }
  ),
  {
    n: 0,
  }
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<div style="color: blue;">BAR</div>',
)

// patch object style
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return h.div({
          style: {
            'color': 'red',
          }
        }, 'Foo')
      } else {
        return h.div({
          style: {
          }
        }, 'Bar')
      }
    }
  ),
  {
    n: 0,
  }
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<div style="">Bar</div>',
)

// patch object style 2
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return h.div({
          style: {
            'color': 'red',
          }
        }, 'Foo')
      } else {
        return h.div({
          style: {
            'color': 'blue',
          }
        }, 'Bar')
      }
    }
  ),
  {
    n: 0,
  }
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<div style="color: blue;">Bar</div>',
)

// patch different kind style
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return h.div({
          style: {
            'color': 'red',
          }
        }, 'Foo')
      } else {
        return h.div(css`
          color: blue;
        `, 'Bar')
      }
    }
  ),
  {
    n: 0,
  }
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<div style="color: blue;">Bar</div>',
)

// patch different kind style 2
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return h.div(css`
          color: blue;
        `, 'Bar')
      } else {
        return h.div({
          style: {
            'color': 'red',
          }
        }, 'Foo')
      }
    }
  ),
  {
    n: 0,
  }
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<div style="color: red;">Foo</div>',
)

// patch class
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return h.div($`.foo .bar`)
      } else {
        return h.div($`.foo`)
      }
    }
  ),
  {
    n: 0,
  }
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<div class="foo"></div>',
)

// patch class 2
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return h.div($`.foo .bar`)
      } else {
        return h.div()
      }
    }
  ),
  {
    n: 0,
  }
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<div class=""></div>',
)

// patch class 2
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return h.div($`.foo .bar`)
      } else {
        return h.div({
          classList: {
            foo: false,
            bar: false,
          }
        })
      }
    }
  ),
  {
    n: 0,
  }
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<div class=""></div>',
)

// patch class 3
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return h.div({
          classList: {
            foo: false,
            bar: false,
          }
        })
      } else {
        return h.div({
          classList: {
            foo: true,
            bar: true,
          }
        })
      }
    }
  ),
  {
    n: 0,
  }
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<div class="foo bar"></div>',
)

// patch class 4
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return h.div()
      } else {
        return h.div({
          classList: {
            foo: true,
            bar: true,
          }
        })
      }
    }
  ),
  {
    n: 0,
  }
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<div class="foo bar"></div>',
)

// patch id
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return h.div($`#foo`)
      } else {
        return h.div($`#bar`)
      }
    }
  ),
  {
    n: 0,
  }
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<div id="bar"></div>',
)

// patch event
let flag1 = false
let flag2 = false
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return h.div(on('click:1', () => {
          flag1 = true
        }))
      } else {
        return h.div($`#foo`, on('click:2', () => {
          flag2 = true
        }))
      }
    }
  ),
  {
    n: 0,
  }
)
app.state.n++
let ev = document.createEvent('Events')
ev.initEvent('click', true, false)
document.getElementById('foo').dispatchEvent(ev)
eq(
  flag1, false,
  flag2, true,
)

// patch attribute
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return h.div({
          foo: 'foo',
        })
      } else {
        return h.div({
          bar: 'BAR',
        })
      }
    }
  ),
  {
    n: 0,
  }
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<div bar="BAR"></div>',
)

// patch attribute 2
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return h.div({
          foo: 'foo',
        })
      } else {
        return h.div()
      }
    }
  ),
  {
    n: 0,
  }
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<div></div>',
)

// patch attribute 3
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return h.div({
          foo: 'foo',
        })
      } else {
        return h.div({
          foo: 'FOO',
        })
      }
    }
  ),
  {
    n: 0,
  }
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<div foo="FOO"></div>',
)

// patch attribute 4
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return h.div({
          foo: false,
        })
      } else {
        return h.div({
          foo: true,
        })
      }
    }
  ),
  {
    n: 0,
  }
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<div foo="foo"></div>',
)

// patch attribute 5
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n % 2 == 0) {
        return h.input({
          type: 'checkbox',
          checked: false,
        })
      } else {
        return h.input({
          type: 'checkbox',
          checked: true,
        })
      }
    }
  ),
  {
    n: 0,
  }
)
eq(
  (<any>document.querySelector('#test input')).checked, false,
)
app.state.n++
eq(
  (<any>document.querySelector('#test input')).checked, true,
)
app.state.n++
eq(
  (<any>document.querySelector('#test input')).checked, false,
)

// patch attribute 6
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return h.div({
          foo: 1,
        })
      } else {
        return h.div({
          foo: 2,
        })
      }
    }
  ),
  {
    n: 0,
  }
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<div foo="2"></div>',
)

// patch attribute 7
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      return h.input({
        type: 'checkbox',
        checked: true,
      })
    }
  ),
  {
    n: 0,
  }
)
eq(
  (<any>document.querySelector('#test input')).checked, true,
);
(<any>document.querySelector('#test input')).checked = false
app.state.n++
eq(
  (<any>document.querySelector('#test input')).checked, true,
);

// patch attribute 8
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return h.div()
      } else {
        return h.div({
          foo: 2,
        })
      }
    }
  ),
  {
    n: 0,
  }
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<div foo="2"></div>',
)

// patch inner html
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return h.div({
          innerHTML: 'foo',
        })
      } else {
        return h.div({
          innerHTML: 'bar',
        })
      }
    }
  ),
  {
    n: 0,
  }
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<div>bar</div>',
)

// patch keyed
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return [
          h.div(key`1`, '1'),
          h.div(key`2`, '2'),
          h.div(key`3`, '3'),
        ]
      } else {
        return [
          h.div(key`1`, '1'),
          h.div(key`2`, '2'),
          h.div(key`4`, '4'),
        ]
      }
    }
  ),
  {
    n: 0,
  }
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<div>1</div><div>2</div><div>4</div>',
)

// patch keyed 2
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return [
          h.div(key`1`, '1'),
          h.div(key`2`, '2'),
          h.div(key`3`, '3'),
        ]
      } else {
        return [
          h.div(key`2`, '2'),
          h.div(key`3`, '3'),
          h.div(key`4`, '4'),
        ]
      }
    }
  ),
  {
    n: 0,
  }
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<div>2</div><div>3</div><div>4</div>',
)

// patch text
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        const comment = new CommentNode()
        comment.text = 'foo'
        return comment
      } else {
        const comment = new CommentNode()
        comment.text = 'BAR'
        return comment
      }
    }
  ),
  {
    n: 0,
  }
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<!--BAR-->',
)

// not patchable
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        const comment = new CommentNode()
        comment.text = 'foo'
        return comment
      } else {
        return h.div('BAR')
      }
    }
  ),
  {
    n: 0,
  }
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<div>BAR</div>',
)

// not patchable 2
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return h.p('foo')
      } else {
        return h.div('BAR')
      }
    }
  ),
  {
    n: 0,
  }
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<div>BAR</div>',
)

// patch thunk
Foo = (state) => t(Bar, state)
let Bar = (state) => t(Baz, state)
let Baz = (state) => h.div('baz')
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return t(Baz, 5)
      } else {
        return t(Foo, 5)
      }
    }
  ),
  {
    n: 0,
  }
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<div>baz</div>',
)

// update loop
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n < 10) {
        state.n++
      }
      return state.n
    }
  ),
  {
    n: 0,
  }
)
eq(
  document.getElementById('test').innerHTML,
  '10',
)

// infinite loop
try {
  new App(
    document.getElementById('test'),
    (state) => h.div(
      $`#test`,
      () => {
        state.n++
        return state.n
      }
    ),
    {
      n: 0,
    }
  )
} catch (e) {
  eq(
    e instanceof Error, true,
    e.message, 'infinite loop in updating state',
  )
}

// no update
app = new App(
  document.getElementById('test'),
  {
    n: 0,
  }
)
app.state.n++

// no update 2
app = new App(
  {
    n: 0,
  }
)
app.state.n++

// object args not changed
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return t('Foo', (state) => h.div('foo'), {
          foo: 'foo',
        })
      } else {
        return t('Foo', (state) => h.div('foo'), {
          foo: 'foo',
        })
      }
    }
  ),
  {
    n: 0,
  }
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<div>foo</div>',
)

// onpatched hook
flag1 = false
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return t('Foo', (state) => h.div(state.foo), {
          foo: 'foo',
        })
      } else {
        return t('Foo', (state) => h.div(state.foo, {
          onpatched: () => {
            flag1 = true
          }
        }), {
          foo: 'bar',
        })
      }
    }
  ),
  {
    n: 0,
  }
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<div>bar</div>',
  flag1, true,
)

// style not changed
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return h.div(css`
          color: red;
        `)
      } else {
        return h.div(css`
          color: red;
        `)
      }
    }
  ),
  {
    n: 0,
  }
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<div style="color: red;"></div>',
)

// style not changed 2
app = new App(
  document.getElementById('test'),
  (state) => h.div(
    $`#test`,
    () => {
      if (state.n == 0) {
        return h.div({
          style: {
            color: 'red',
          }
        })
      } else {
        return h.div({
          style: {
            color: 'red',
          }
        })
      }
    }
  ),
  {
    n: 0,
  }
)
app.state.n++
eq(
  document.getElementById('test').innerHTML,
  '<div style="color: red;"></div>',
)
