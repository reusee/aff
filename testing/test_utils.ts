import { kind } from './aff/utils'
import { eq } from './utils'

eq(kind(null), 'null')
eq(kind(new Number(42)), 'number')
eq(kind(new Boolean(true)), 'boolean')
eq(kind(new String("foo")), 'string')

