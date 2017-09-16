
import 'eventsource-polyfill'
const hotClient = require('webpack-hot-middleware/client?noInfo=true&reload=true')
//in browser ,linsten webpack-hot-middleware for force reload
hotClient.subscribe(function (event) {
  if (event.action === 'reload') {
    window.location.reload()
  }
})
