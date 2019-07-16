// auto reload
fetch('/wait').then(() => {
  window.location.reload()
})

// init
import { App, h } from './aff/index'
let app;

fetch('/init').then((resp) => {
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
    j,

  )
})

import './test_app'
import './test_proxy'
import './test_utils'

setTimeout(() => {
  fetch('/coverage', {
    method: 'post',
    body: JSON.stringify((<any>window).__coverage__),
  })
  console.log('finish')
}, 0)

