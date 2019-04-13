import util from './utils'

const event = {
  _eventData: null,

  on (name, func) {
    if (!this._eventData) this._eventData = {}
    if (!this._eventData[name]) this._eventData[name] = []
    let listened = false
    util.each(this._eventData[name], function (fuc) {
      if (fuc === func) {
        listened = true
        return false
      }
    })
    if (!listened) {
      this._eventData[name].push(func)
    }
  },
  off (name, func) {
    if (!this._eventData) this._eventData = {}
    if (!this._eventData[name] || !this._eventData[name].length) return
    if (func) {
      util.each(
        this._eventData[name],
        function (fuc, i) {
          if (fuc === func) {
            this._eventData[name].splice(i, 1)
            return false
          }
        },
        this
      )
    } else {
      this._eventData[name] = []
    }
  },
  trigger (name) {
    if (!this._eventData) this._eventData = {}
    if (!this._eventData[name]) return true
    let args = this._eventData[name].slice.call(arguments, 1)
    let preventDefault = false
    util.each(
      this._eventData[name],
      function (fuc) {
        preventDefault = fuc.apply(this, args) === false || preventDefault
      },
      this
    )
    return !preventDefault
  }
}

export default event
