import * as  opn from 'opn'
import * as  color from 'cli-color'
import * as  pathTool from 'path'
import * as  koa from 'koa'
import * as  staticCache from 'koa-static-cache'
import { devMiddleware, hotMiddleware } from 'koa2-webpack-middleware-plus'
import * as webpack from 'webpack'
import { httpProxy } from 'koa-http-proxy-middleware'
import { EventHelper } from 'event-helper'

export default (_options) => {
  const options = {
    //port will random for 7000~8000
    port: Math.floor(Math.random() * 1001) + 7000,
    //自动打开浏览器
    autoOpenBrowser: true,
    //webpack config
    webpackConfig: null,
    //devMiddleware
    devConfig: null,
    //hotMiddleware
    hotConfig: null,
    //koa-http-proxy-middleware
    proxy: null,
    //静态资源目录
    staticPath: pathTool.join(process.cwd(), 'static'),
    //koa-static-cache options
    staticOptions: null,
    ..._options
  }
  return {
    //加入事件支持
    ...EventHelper.create(),
    //readyPromise
    readyPromise: null,
    init(_options) {
      Object.assign(options, _options)
      this.runSteps()
      return {
        ready: this.readyPromise,
        close: () => {
          this.server.close()
        }
      }
    },
    getOptions() {
      return { ...options }
    },
    runSteps() {
      this.createApp()
        .initMiddleware()
        .mountMiddleware()
        .listenAndOpen()
    },
    //koa instance
    app: null,
    _devMiddleware: null,
    _hotMiddleware: null,
    //第一步 创建app compiler
    createApp() {
      this.app = new koa()
      this.compiler = webpack(options.webpackConfig)
      return this
    },
    //第二步 初始化中间件
    initMiddleware() {
      this._devMiddleware = devMiddleware(this.compiler, {
        publicPath: this.webpackConfig.output.publicPath,
        quiet: true,
        ...options.devConfig
      })
      this._hotMiddleware = hotMiddleware(this.compiler, {
        log: false,
        heartbeat: 2000,
        reload: true,
        ...options.hotConfig
      })
      // force page reload when html-webpack-plugin template changes
      // 模板改变时 浏览器强制刷新
      this.compiler.plugin('compilation', function (compilation) {
        compilation.plugin('html-webpack-plugin-after-emit', function (data, cb) {
          this.emit('template-change')
          this._hotMiddleware.origin.publish({ action: 'reload' })
          cb()
        })
      })
      // proxy api requests
      //代理初始化
      for (let proxyItem of options.proxy) {
        if (typeof proxyItem === 'string') {
          proxyItem = { target: proxyItem }
        }
        this.app.use(httpProxy(proxyItem.filter || context, proxyItem))
      }
      return this
    },
    //第三步 app 挂载中间件
    mountMiddleware() {
      // serve webpack bundle output
      this.app.use(this._devMiddleware)

      // enable hot-reload and state-preserving
      // compilation error display
      this.app.use(this._hotMiddleware)

      this.app.use(staticCache(options.staticPath, {
        maxAge: 365 * 24 * 60 * 60,
        ...options.staticOptions
      }))
      return this
    },
    //第四步监听端口 打开浏览吕
    //step4 listen port and open browser
    listenAndOpen() {
      const uri = `http://localhost:${options.port}`
      let _resolve
      //初始化readyPromise
      this.readyPromise = new Promise(resolve => { _resolve = resolve })

      console.log(color.yellow('> Starting dev server...'))
      this._devMiddleware.origin.waitUntilValid(() => {
        this.emit('waiting')
        console.log(color.bgWhite.greenBright('> Listening at ' + uri + '\n'))
        // when env is testing, don't need open it
        if (options.autoOpenBrowser && process.env.NODE_ENV !== 'test') {
          this.emit('open') !== false && opn(uri)
        }
        _resolve()
      })
      this.server = this.app.listen(options.port)
    }
  }
}
