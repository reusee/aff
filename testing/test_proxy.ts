import { ref, makeProxy } from './aff/index'
import { eq } from './utils'

// test indirect updatae
let o = makeProxy({
  Index: {
    Ann: ref('/Ann'),
  },
  Ann: {
    foo: 'foo',
  },
  AnnSetup: {
    foo: ref('/Ann/foo'),
  },
})

let v = 'FOO'
let tick = o.$tick();
o.Index.Ann.foo = v
eq(
  o.Index.Ann.foo, v,
  o.Ann.foo, v,
  o.AnnSetup.foo, v,
  o.Index.Ann.$changed(tick), true,
  o.Ann.$changed(tick), true,
  o.AnnSetup.$changed(tick), true,
)

v = 'foo'
tick = o.$tick();
o.Ann.foo = v
eq(
  o.Index.Ann.foo, v,
  o.Ann.foo, v,
  o.AnnSetup.foo, v,
  o.Index.Ann.$changed(tick), true,
  o.Ann.$changed(tick), true,
  o.AnnSetup.$changed(tick), true,
)

v = 'FOO'
tick = o.$tick();
o.AnnSetup.foo = v
eq(
  o.Index.Ann.foo, v,
  o.Ann.foo, v,
  o.AnnSetup.foo, v,
  o.Index.Ann.$changed(tick), true,
  o.Ann.$changed(tick), true,
  o.AnnSetup.$changed(tick), true,
)
