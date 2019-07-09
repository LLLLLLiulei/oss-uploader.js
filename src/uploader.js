import utils from './utils'
import event from './event'
import File from './file'
import Chunk from './chunk'
import LocalFile from './localFile'
import version from '../package.json'


let oss = ['qiniu', 'aliyun', 'tencent']

let isServer = typeof window === 'undefined'
// ie10+
let ie10plus = isServer ? false : window.navigator.msPointerEnabled
let support = (function () {
  if (isServer) {
    return false
  }
  let sliceName = 'slice'
  let _support =
    utils.isDefined(window.File) &&
    utils.isDefined(window.Blob) &&
    utils.isDefined(window.FileList)
  let bproto = null
  if (_support) {
    bproto = window.Blob.prototype
    utils.each(['slice', 'webkitSlice', 'mozSlice'], function (n) {
      if (bproto[n]) {
        sliceName = n
        return false
      }
    })
    _support = !!bproto[sliceName]
  }
  if (_support) Uploader.sliceName = sliceName
  bproto = null
  return _support
})()
let supportDirectory = (function () {
  if (isServer) {
    return false
  }
  let input = window.document.createElement('input')
  input.type = 'file'
  let sd = 'webkitdirectory' in input || 'directory' in input
  input = null
  return sd
})()
/**
 * Default read function using the webAPI
 *
 * @function webAPIFileRead(fileObj, fileType, startByte, endByte, chunk)
 *
 */
let webAPIFileRead = function (fileObj, fileType, startByte, endByte, chunk) {
  chunk.readFinished(
    fileObj.file[Uploader.sliceName](startByte, endByte, fileType)
  )
}

function Uploader (opts) {
  this.support = support
  /* istanbul ignore if */
  if (!this.support) {
    return
  }
  this.supportDirectory = supportDirectory
  utils.defineNonEnumerable(this, 'filePaths', {})
  this.opts = utils.extend({}, Uploader.defaults, opts || {})
  this.opts.chunkSize = oss.includes(this.opts.oss)
    ? Number.MAX_SAFE_INTEGER
    : this.opts.chunkSize

  this.preventEvent = utils.bind(this._preventEvent, this)

  File.call(this, this)
}

Uploader.defaults = {
  chunkSize: 1024 * 1024,
  forceChunkSize: false,
  simultaneousUploads: 3,
  singleFile: false,
  fileParameterName: 'file',
  progressCallbacksInterval: 500,
  speedSmoothingFactor: 0.1,
  query: {},
  headers: {},
  withCredentials: false,
  preprocess: null,
  method: 'multipart',
  testMethod: 'GET',
  uploadMethod: 'POST',
  prioritizeFirstAndLastChunk: false,
  allowDuplicateUploads: false,
  target: '/',
  testChunks: true,
  generateUniqueIdentifier: null,
  maxChunkRetries: 0,
  chunkRetryInterval: null,
  permanentErrors: [404, 415, 500, 501],
  successStatuses: [200, 201, 202],
  onDropStopPropagation: false,
  initFileFn: null,
  readFileFn: webAPIFileRead,
  checkChunkUploadedByResponse: null,
  initialPaused: false,
  processResponse: function (response, cb) {
    cb(null, response)
  },
  processParams: function (params) {
    return params
  },
  beforeFileUplod: null,
  beforeLastChunkUplod: null,
  ossParams: null,
  oss: null
}

Uploader.utils = utils
Uploader.event = event
Uploader.File = File
Uploader.Chunk = Chunk
Uploader.version = version

// inherit file
Uploader.prototype = utils.extend({}, File.prototype)
// inherit event
utils.extend(Uploader.prototype, event)
utils.extend(Uploader.prototype, {
  constructor: Uploader,

  _trigger: function (name) {
    let args = utils.toArray(arguments)
    let preventDefault = !this.trigger.apply(this, arguments)
    if (name !== 'catchAll') {
      args.unshift('catchAll')
      preventDefault = !this.trigger.apply(this, args) || preventDefault
    }
    return !preventDefault
  },

  _triggerAsync: function () {
    let args = arguments
    utils.nextTick(function () {
      this._trigger.apply(this, args)
    }, this)
  },

  addFiles: function (files, evt) {
    let _files = []
    let oldFileListLen = this.fileList.length
    utils.each(
      files,
      function (file) {
        // Uploading empty file IE10/IE11 hangs indefinitely
        // Directories have size `0` and name `.`
        // Ignore already added files if opts.allowDuplicateUploads is set to false
        if (
          (!ie10plus || (ie10plus && file.size > 0)) &&
          !(
            file.size % 4096 === 0 &&
            (file.name === '.' || file.fileName === '.')
          )
        ) {
          let uniqueIdentifier = this.generateUniqueIdentifier(file)
          if (
            this.opts.allowDuplicateUploads ||
            !this.getFromUniqueIdentifier(uniqueIdentifier)
          ) {
            let _file = new File(this, file, this)
            _file.uniqueIdentifier = uniqueIdentifier
            if (this._trigger('fileAdded', _file, evt)) {
              _files.push(_file)
            } else {
              File.prototype.removeFile.call(this, _file)
            }
          }
        }
      },
      this
    )
    // get new fileList
    let newFileList = this.fileList.slice(oldFileListLen)
    if (this._trigger('filesAdded', _files, newFileList, evt)) {
      utils.each(
        _files,
        function (file) {
          if (this.opts.singleFile && this.files.length > 0) {
            this.removeFile(this.files[0])
          }
          this.files.push(file)
        },
        this
      )
      this._trigger('filesSubmitted', _files, newFileList, evt)
    } else {
      utils.each(
        newFileList,
        function (file) {
          File.prototype.removeFile.call(this, file)
        },
        this
      )
    }
  },

  addFile: function (file, evt) {
    this.addFiles([file], evt)
  },

  addFilesByPath(paths) {
    if (!Array.isArray(paths)) {
      return
    }
    let files = []
    paths.forEach(p => {
      let file = new LocalFile(p)
      if (file.isDirectory()) {
        files.push(...file.listFiles())
      } else {
        files.push(file)
      }
    })
    if (!files.length) {
      return
    }
    this.addFiles(files, new Event('fileAdded'))
  },

  cancel: function () {
    for (let i = this.fileList.length - 1; i >= 0; i--) {
      this.fileList[i].cancel()
    }
  },

  removeFile: function (file) {
    File.prototype.removeFile.call(this, file)
    this._trigger('fileRemoved', file)
  },

  generateUniqueIdentifier: function (file) {
    let custom = this.opts.generateUniqueIdentifier
    if (utils.isFunction(custom)) {
      return custom(file)
    }
    /* istanbul ignore next */
    // Some confusion in different versions of Firefox
    let relativePath =
      file.relativePath || file.webkitRelativePath || file.fileName || file.name
    /* istanbul ignore next */
    return file.size + '-' + relativePath.replace(/[^0-9a-zA-Z_-]/gim, '')
  },

  getFromUniqueIdentifier: function (uniqueIdentifier) {
    let ret = false
    utils.each(this.files, function (file) {
      if (file.uniqueIdentifier === uniqueIdentifier) {
        ret = file
        return false
      }
    })
    return ret
  },

  async dealOssParams (file) {
    try {
      if (oss.includes(this.opts.oss)) {
        let {ossParams} = file
        if (!utils.isEmptyObject(ossParams)) {
          return true
        }
        if (typeof this.opts.ossParams === 'function') {
          ossParams = await this.opts.ossParams(file)
        } else if (typeof this.opts.ossParams === 'object') {
          ossParams = utils.extend({}, this.opts.ossParams)
        }
        file.ossParams = utils.extend({}, ossParams)
        return ossParams && ossParams.key
      }
    } catch (e) {
      console.error(e)
      return false
    }
    return true
  },

  uploadNextChunk: async function (preventEvents) {
    let $ = this
    let found = false
    let pendingStatus = Chunk.STATUS.PENDING
    let checkChunkUploaded = this.uploader.opts.checkChunkUploadedByResponse
    if (this.opts.prioritizeFirstAndLastChunk) {
      for (let file of this.files) {
        if (file.paused) {
          return
        }
        let ossParamsFlag = await this.dealOssParams(file)
        if (!ossParamsFlag) {
          this._triggerAsync('error', file)
          return
        }
        if (typeof $.opts.beforeChunkUplod === 'function') {
          this._trigger('beforeChunkUplod', file)
          await $.opts.beforeChunkUplod(file)
        }
        if (checkChunkUploaded && !file._firstResponse && file.isUploading()) {
          // waiting for current file's first chunk response
          return
        }
        if (file.chunks.length && file.chunks[0].status() === pendingStatus) {
          file.chunks[0].send()
          found = true
          return false
        }
        if (
          file.chunks.length > 1 &&
          file.chunks[file.chunks.length - 1].status() === pendingStatus
        ) {
          file.chunks[file.chunks.length - 1].send()
          found = true
          return false
        }
      }

      if (found) {
        return found
      }
    }

    for (let file of this.files) {
      if (!file.paused) {
        if (checkChunkUploaded && !file._firstResponse && file.isUploading()) {
          // waiting for current file's first chunk response
          return
        }
        let ossParamsFlag = await this.dealOssParams(file)
        if (!ossParamsFlag) {
          this._triggerAsync('error', file)
          return
        }
        if (typeof $.opts.beforeChunkUplod === 'function') {
          this._trigger('beforeChunkUplod', file)
          await $.opts.beforeChunkUplod(file)
        }
        utils.each(file.chunks, function (chunk) {
          if (chunk.status() === pendingStatus) {
            let chunkParams = chunk.getParams()
            let isLastChunk =
              chunkParams.chunkNumber === chunkParams.totalChunks
            if (isLastChunk) {
              typeof $.opts.beforeLastChunkUplod === 'function' &&
                $.opts.beforeLastChunkUplod(file, chunk)
            }
            chunk.send()
            found = true
            return false
          }
        })
      }
      if (found) {
        break
      }
    }

    if (found) {
      return true
    }

    // The are no more outstanding chunks to upload, check is everything is done
    let outstanding = false
    utils.each(this.files, function (file) {
      if (!file.isComplete()) {
        outstanding = true
        return false
      }
    })
    // should check files now
    // if now files in list
    // should not trigger complete event
    if (!outstanding && !preventEvents && this.files.length) {
      // All chunks have been uploaded, complete
      this._triggerAsync('complete')
    }
    return outstanding
  },

  upload: async function (preventEvents) {
    // Make sure we don't start too many uploads at once
    let ret = this._shouldUploadNext()
    if (ret === false) {
      return
    }
    !preventEvents && this._trigger('uploadStart')
    let started = false
    for (let num = 1; num <= this.opts.simultaneousUploads - ret; num++) {
      started = (await this.uploadNextChunk(!preventEvents)) || started
      if (!started && preventEvents) {
        // completed
        break
      }
    }
    if (!started && !preventEvents) {
      this._triggerAsync('complete')
    }
  },

  /**
   * should upload next chunk
   * @function
   * @returns {Boolean|Number}
   */
  _shouldUploadNext: function () {
    let num = 0
    let should = true
    let simultaneousUploads = this.opts.simultaneousUploads
    let uploadingStatus = Chunk.STATUS.UPLOADING
    utils.each(this.files, function (file) {
      utils.each(file.chunks, function (chunk) {
        if (chunk.status() === uploadingStatus) {
          num++
          if (num >= simultaneousUploads) {
            should = false
            return false
          }
        }
      })
      return should
    })
    // if should is true then return uploading chunks's length
    return should && num
  },

  /**
   * Assign a browse action to one or more DOM nodes.
   * @function
   * @param {Element|Array.<Element>} domNodes
   * @param {boolean} isDirectory Pass in true to allow directories to
   * @param {boolean} singleFile prevent multi file upload
   * @param {Object} attributes set custom attributes:
   *  http://www.w3.org/TR/html-markup/input.file.html#input.file-attributes
   *  eg: accept: 'image/*'
   * be selected (Chrome only).
   */
  assignBrowse: function (domNodes, isDirectory, singleFile, attributes) {
    if (typeof domNodes.length === 'undefined') {
      domNodes = [domNodes]
    }

    utils.each(
      domNodes,
      function (domNode) {
        let input
        if (domNode.tagName === 'INPUT' && domNode.type === 'file') {
          input = domNode
        } else {
          input = document.createElement('input')
          input.setAttribute('type', 'file')
          // display:none - not working in opera 12
          utils.extend(input.style, {
            visibility: 'hidden',
            position: 'absolute',
            width: '1px',
            height: '1px'
          })
          // for opera 12 browser, input must be assigned to a document
          domNode.appendChild(input)
          // https://developer.mozilla.org/en/using_files_from_web_applications)
          // event listener is executed two times
          // first one - original mouse click event
          // second - input.click(), input is inside domNode
          domNode.addEventListener(
            'click',
            function (e) {
              if (domNode.tagName.toLowerCase() === 'label') {
                return
              }
              input.click()
            },
            false
          )
        }
        if (!this.opts.singleFile && !singleFile) {
          input.setAttribute('multiple', 'multiple')
        }
        if (isDirectory) {
          input.setAttribute('webkitdirectory', 'webkitdirectory')
        }
        attributes &&
          utils.each(attributes, function (value, key) {
            input.setAttribute(key, value)
          })
        // When new files are added, simply append them to the overall list
        let that = this
        input.addEventListener(
          'change',
          function (e) {
            that._trigger(e.type, e)
            if (e.target.value) {
              that.addFiles(e.target.files, e)
              e.target.value = ''
            }
          },
          false
        )
      },
      this
    )
  },

  onDrop: function (evt) {
    this._trigger(evt.type, evt)
    if (this.opts.onDropStopPropagation) {
      evt.stopPropagation()
    }
    evt.preventDefault()
    this._parseDataTransfer(evt.dataTransfer, evt)
  },

  _parseDataTransfer: function (dataTransfer, evt) {
    if (
      dataTransfer.items &&
      dataTransfer.items[0] &&
      dataTransfer.items[0].webkitGetAsEntry
    ) {
      this.webkitReadDataTransfer(dataTransfer, evt)
    } else {
      this.addFiles(dataTransfer.files, evt)
    }
  },

  webkitReadDataTransfer: function (dataTransfer, evt) {
    let self = this
    let queue = dataTransfer.items.length
    let files = []
    utils.each(dataTransfer.items, function (item) {
      let entry = item.webkitGetAsEntry()
      if (!entry) {
        decrement()
        return
      }
      if (entry.isFile) {
        // due to a bug in Chrome's File System API impl - #149735
        fileReadSuccess(item.getAsFile(), entry.fullPath)
      } else {
        readDirectory(entry.createReader())
      }
    })
    function readDirectory (reader) {
      reader.readEntries(function (entries) {
        if (entries.length) {
          queue += entries.length
          utils.each(entries, function (entry) {
            if (entry.isFile) {
              let fullPath = entry.fullPath
              entry.file(function (file) {
                fileReadSuccess(file, fullPath)
              }, readError)
            } else if (entry.isDirectory) {
              readDirectory(entry.createReader())
            }
          })
          readDirectory(reader)
        } else {
          decrement()
        }
      }, readError)
    }
    function fileReadSuccess (file, fullPath) {
      // relative path should not start with "/"
      file.relativePath = fullPath.substring(1)
      files.push(file)
      decrement()
    }
    function readError (fileError) {
      throw fileError
    }
    function decrement () {
      if (--queue === 0) {
        self.addFiles(files, evt)
      }
    }
  },

  _assignHelper: function (domNodes, handles, remove) {
    if (typeof domNodes.length === 'undefined') {
      domNodes = [domNodes]
    }
    let evtMethod = remove ? 'removeEventListener' : 'addEventListener'
    utils.each(
      domNodes,
      function (domNode) {
        utils.each(
          handles,
          function (handler, name) {
            domNode[evtMethod](name, handler, false)
          },
          this
        )
      },
      this
    )
  },

  _preventEvent: function (e) {
    utils.preventEvent(e)
    this._trigger(e.type, e)
  },

  /**
   * Assign one or more DOM nodes as a drop target.
   * @function
   * @param {Element|Array.<Element>} domNodes
   */
  assignDrop: function (domNodes) {
    this._onDrop = utils.bind(this.onDrop, this)
    this._assignHelper(domNodes, {
      dragover: this.preventEvent,
      dragenter: this.preventEvent,
      dragleave: this.preventEvent,
      drop: this._onDrop
    })
  },

  /**
   * Un-assign drop event from DOM nodes
   * @function
   * @param domNodes
   */
  unAssignDrop: function (domNodes) {
    this._assignHelper(
      domNodes,
      {
        dragover: this.preventEvent,
        dragenter: this.preventEvent,
        dragleave: this.preventEvent,
        drop: this._onDrop
      },
      true
    )
    this._onDrop = null
  }
})

export default Uploader
