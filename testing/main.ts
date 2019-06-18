// auto reload
fetch('/api/Wait').then(() => {
  window.location.reload()
})

// init
import { App, h } from './aff/index'
let app;

fetch('/api/Init').then((resp) => {
  return resp.json()
}).then((j) => {
  app = new App(

    // func
    (
      state: {
        Now: string,
      },
    ) => {
      return h.div(
        h.p(state.Now),
      )
    },

    // element
    document.getElementById('app'),

    // state
    j.Ret,

  )
})

import './test_app'
import './test_proxy'
import './test_utils'

setTimeout(() => {
  fetch('/api/Coverage', {
    method: 'post',
    body: JSON.stringify({
      J: JSON.stringify((<any>window).__coverage__),
    }),
  })
}, 0)

