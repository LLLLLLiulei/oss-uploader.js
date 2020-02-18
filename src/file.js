const utils = require('./utils')
const Chunk = require('./chunk')
// import utils from './utils'
// import Chunk from './chunk'

function File (uploader, file, parent) {
  utils.defineNonEnumerable(this, 'uploader', uploader)
  this.isRoot = this.isFolder = uploader === this
  utils.defineNonEnumerable(this, 'parent', parent || null)
  utils.defineNonEnumerable(this, 'files', [])
  utils.defineNonEnumerable(this, 'fileList', [])
  utils.defineNonEnumerable(this, 'chunks', [])
  utils.defineNonEnumerable(this, '_errorFiles', [])
  utils.defineNonEnumerable(this, 'file', null)
  this.id = utils.uid()

  if (this.isRoot || !file) {
    this.file = null
  } else {
    if (utils.isString(file)) {
      // folder
      this.isFolder = true
      this.file = null
      this.path = file
      if (this.parent.path) {
        file = file.substr(this.parent.path.length)
      }
      this.name =
        file.charAt(file.length - 1) === '/'
          ? file.substr(0, file.length - 1)
          : file
    } else {
      this.file = file
      this.fileType = this.file.type
      this.name = file.fileName || file.name
      this.size = file.size
      this.relativePath =
        file.relativePath || file.webkitRelativePath || this.name
      this._parseFile()
    }
  }

  this.paused = uploader.opts.initialPaused
  this.error = false
  this.allError = false
  this.aborted = false
  this.averageSpeed = 0
  this.currentSpeed = 0
  this._lastProgressCallback = Date.now()
  this._prevUploadedSize = 0
  this._prevProgress = 0

  // let {_encryptType,_authedUsers} = file
  file = file || {}
  if (typeof file === 'object') {
    this.lastModified = file.lastModified || Date.now()
    let keys = ['_encryptType', '_authedUsers', '_encryptFlag', '_encryptPath', '_kyesFilePath', '_opts', '__customOpts', '_ossParams', 'ossParams']
    keys.forEach(k => {
      if (k in file) {
        this[k] = file[k]
      }
    })
  }
  this.opts = this._opts || Object.assign({}, uploader.opts)
  if ('ossParams' in this) {
    this.ossParams = this.ossParams || this._ossParams
  }

  this.bootstrap()
}

function parsePaths (path) {
  let ret = []
  let paths = path.split('/')
  let len = paths.length
  let i = 1
  paths.splice(len - 1, 1)
  len--
  if (paths.length) {
    while (i <= len) {
      ret.push(paths.slice(0, i++).join('/') + '/')
    }
  }
  return ret
}

utils.extend(File.prototype, {
  _parseFile: function () {
    let ppaths = parsePaths(this.relativePath)
    if (ppaths.length) {
      let filePaths = this.uploader.filePaths
      utils.each(
        ppaths,
        function (path, i) {
          let folderFile = filePaths[path]
          if (!folderFile) {
            folderFile = new File(this.uploader, path, this.parent)
            filePaths[path] = folderFile
            this._updateParentFileList(folderFile)
          }
          this.parent = folderFile
          folderFile.files.push(this)
          if (!ppaths[i + 1]) {
            folderFile.fileList.push(this)
          }
        },
        this
      )
    } else {
      this._updateParentFileList()
    }
  },

  _updateParentFileList: function (file) {
    if (!file) {
      file = this
    }
    let p = this.parent
    if (p) {
      p.fileList.push(file)
    }
  },

  _eachAccess: function (eachFn, fileFn) {
    if (this.isFolder) {
      utils.each(
        this.files,
        function (f, i) {
          return eachFn.call(this, f, i)
        },
        this
      )
      return
    }
    fileFn.call(this, this)
  },

  bootstrap: function () {
    if (this.isFolder) return
    let { opts } = this.uploader
    if (utils.isFunction(opts.initFileFn)) {
      opts.initFileFn.call(this, this)
    }

    this.abort(true)
    this._resetError()
    // Rebuild stack of chunks from file
    this._prevProgress = 0
    let round = opts.forceChunkSize ? Math.ceil : Math.floor
    let chunks = Math.max(round(this.size / opts.chunkSize), 1)
    let oldChunks = []

    if (this.file.chunks && this.file.chunks.length) {
      chunks = this.file.chunks.length
      oldChunks = this.file.chunks.splice(0, this.file.chunks.length)
    }

    let chunkSize = this.uploader.opts.chunkSize
    if (oldChunks && oldChunks.length) {
      this.uploader.opts.chunkSize = oldChunks[0].id.split('-')[2] - 0
    }
    for (let offset = 0; offset < chunks; offset++) {
      let newChunk = new Chunk(this.uploader, this, offset)
      let oldChunk = oldChunks.find(i => i.id === newChunk.id)
      oldChunk && Object.assign(newChunk, oldChunk)
      newChunk.total = chunks === 1 ? this.file.size : opts.chunkSize
      this.chunks.push(newChunk)
    }
    this.uploader.opts.chunkSize = chunkSize
  },

  _measureSpeed: function (hard) {
    let averageSpeeds = 0
    let currentSpeeds = 0
    let num = 0
    this._eachAccess(
      function (file) {
        if (!file.paused && !file.error) {
          num += 1
          averageSpeeds += file.averageSpeed || 0
          currentSpeeds += file.currentSpeed || 0
        }
      },
      function () {
        let timeSpan = Date.now() - this._lastProgressCallback
        if (!timeSpan) {
          return
        }
        let smoothingFactor = this.uploader.opts.speedSmoothingFactor
        let uploaded = this.sizeUploaded()
        // Prevent negative upload speed after file upload resume
        this.currentSpeed = Math.max(
          ((uploaded - this._prevUploadedSize) / timeSpan) * 1000,
          0
        )
        this.averageSpeed =
          smoothingFactor * this.currentSpeed +
          (1 - smoothingFactor) * this.averageSpeed
        this._prevUploadedSize = uploaded
      }
    )
    if (this.isFolder) {
      if (num) {
        this.currentSpeed = currentSpeeds / num
        this.averageSpeed = averageSpeeds / num
      } else {
        this.currentSpeed = 0
        this.averageSpeed = 0
      }
    }
    if (this.parent && (hard || this.parent._checkProgress())) {
      this.parent._measureSpeed()
    }
  },

  _checkProgress: function (file) {
    return (
      Date.now() - this._lastProgressCallback >=
      this.uploader.opts.progressCallbacksInterval
    )
  },

  _chunkEvent: function (chunk, evt, message) {
    console.log('TCL: chunk, evt, message', chunk, evt, message)
    let uploader = this.uploader
    let STATUS = Chunk.STATUS
    let that = this
    let rootFile = this.getRoot()
    let triggerProgress = function (hard) {
      that._measureSpeed(hard)
      uploader._trigger('fileProgress', rootFile, that, chunk)
      that._lastProgressCallback = Date.now()
    }
    switch (evt) {
      case STATUS.PROGRESS:
        if (this._checkProgress()) {
          triggerProgress()
        }
        break
      case STATUS.ERROR:
        this._error()
        this.abort(true)
        uploader._trigger('fileError', rootFile, this, message, chunk)
        break
      case STATUS.SUCCESS:
        this._updateUploadedChunks(message, chunk)
        if (this.error) {
          return
        }
        clearTimeout(this._progeressId)
        this._progeressId = 0
        let timeDiff = Date.now() - this._lastProgressCallback
        if (timeDiff < uploader.opts.progressCallbacksInterval) {
          this._progeressId = setTimeout(
            triggerProgress,
            uploader.opts.progressCallbacksInterval - timeDiff
          )
        }
        if (this.isComplete()) {
          clearTimeout(this._progeressId)
          triggerProgress(true)
          this.currentSpeed = 0
          this.averageSpeed = 0
          uploader._trigger('fileSuccess', rootFile, this, message, chunk)
          let filter = i => i.uniqueIdentifier !== this.uniqueIdentifier
          if (rootFile.isComplete()) {
            uploader._trigger('fileComplete', rootFile, this)
            filter = i => ![this.uniqueIdentifier, rootFile.uniqueIdentifier].includes(i.uniqueIdentifier)
          }

          let filteredFileList = this.uploader.fileList.filter(filter) || []
          let filteredFiles = this.uploader.files.filter(filter) || []
          this.uploader._addLocalRecord.call(this.uploader, filteredFiles, filteredFileList)
          // const fs = require('fs')
          // if(this._resumeLog && fs.existsSync(this._resumeLog) ){
          //   fs.unlink(this._resumeLog)
          // }
        } else if (!this._progeressId) {
          triggerProgress()
        }
        break
      case STATUS.RETRY:
        uploader._trigger('fileRetry', rootFile, this, chunk)
        break
    }
  },

  _updateUploadedChunks: function (message, chunk) {
    let checkChunkUploaded = this.uploader.opts.checkChunkUploadedByResponse
    if (checkChunkUploaded) {
      let xhr = chunk.xhr
      utils.each(
        this.chunks,
        function (_chunk) {
          if (!_chunk.tested) {
            let uploaded = checkChunkUploaded.call(this, _chunk, message)
            if (_chunk === chunk && !uploaded) {
              // fix the first chunk xhr status
              // treated as success but checkChunkUploaded is false
              // so the current chunk should be uploaded again
              _chunk.xhr = null
            }
            if (uploaded) {
              // first success and other chunks are uploaded
              // then set xhr, so the uploaded chunks
              // will be treated as success too
              _chunk.xhr = xhr
            }
            _chunk.tested = true
          }
        },
        this
      )
      if (!this._firstResponse) {
        this._firstResponse = true
        this.uploader.upload(true)
      } else {
        this.uploader.uploadNextChunk()
      }
    } else {
      this.uploader.uploadNextChunk()
    }
  },

  _error: function () {
    this.error = this.allError = true
    let parent = this.parent
    while (parent && parent !== this.uploader) {
      parent._errorFiles.push(this)
      parent.error = true
      if (parent._errorFiles.length === parent.files.length) {
        parent.allError = true
      }
      parent = parent.parent
    }
  },

  _resetError: function () {
    this.error = this.allError = false
    let parent = this.parent
    let index = -1
    while (parent && parent !== this.uploader) {
      index = parent._errorFiles.indexOf(this)
      parent._errorFiles.splice(index, 1)
      parent.allError = false
      if (!parent._errorFiles.length) {
        parent.error = false
      }
      parent = parent.parent
    }
  },

  isComplete: function () {
    let outstanding = false
    this._eachAccess(
      function (file) {
        if (!file.isComplete()) {
          outstanding = true
          return false
        }
      },
      function () {
        let STATUS = Chunk.STATUS
        utils.each(this.chunks, function (chunk) {
          let status = chunk.status()
          if (
            status === STATUS.PENDING ||
            status === STATUS.UPLOADING ||
            status === STATUS.READING ||
            chunk.preprocessState === 1 ||
            chunk.readState === 1
          ) {
            outstanding = true
            return false
          }
        })
      }
    )
    return !outstanding
  },

  isUploading: function () {
    let uploading = false
    this._eachAccess(
      function (file) {
        if (file.isUploading()) {
          uploading = true
          return false
        }
      },
      function () {
        let uploadingStatus = [Chunk.STATUS.UPLOADING, Chunk.STATUS.READING]
        utils.each(this.chunks, function (chunk) {
          if (uploadingStatus.includes(chunk.status())) {
            uploading = true
            return false
          }
        })
      }
    )
    return uploading
  },

  resume: function () {
    this._eachAccess(
      function (f) {
        f.resume()
      },
      function () {
        this.paused = false
        this.aborted = false
        this.uploader.upload(undefined, this)
      }
    )
    this.paused = false
    this.aborted = false
  },

  pause: function () {
    console.log('TCL: pause')
    this._eachAccess(
      function (f) {
        f.pause()
      },
      function () {
        this.paused = true
        this.abort()
      }
    )
    this.paused = true
  },

  cancel: function () {
    this.uploader.removeFile(this)
  },

  retry: function (file) {
    let fileRetry = function (file) {
      if (file.error) {
        file.bootstrap()
      }
    }
    if (file) {
      file.bootstrap()
    } else {
      this._eachAccess(fileRetry, function () {
        this.bootstrap()
      })
    }
    this.uploader.upload()
  },

  abort: function (reset) {
    console.log('TCL: reset', reset)
    if (this.aborted) {
      return
    }
    this.currentSpeed = 0
    this.averageSpeed = 0
    this.aborted = !reset
    let chunks = this.chunks
    if (reset) {
      this.chunks = []
    }
    let uploadingStatus = Chunk.STATUS.UPLOADING
    utils.each(
      chunks,
      function (c) {
        if (c.status() === uploadingStatus) {
          c.abort()
          this.uploader.uploadNextChunk()
        }
      },
      this
    )
  },

  progress: function () {
    let totalDone = 0
    let totalSize = 0
    let ret = 0
    this._eachAccess(
      function (file, index) {
        totalDone += file.progress() * file.size
        totalSize += file.size
        if (index === this.files.length - 1) {
          ret =
            totalSize > 0 ? totalDone / totalSize : this.isComplete() ? 1 : 0
        }
      },
      function () {
        if (this.error) {
          ret = 1
          return
        }
        if (this.chunks.length === 1) {
          this._prevProgress = Math.max(
            this._prevProgress,
            this.chunks[0].progress()
          )
          ret = this._prevProgress
          return
        }
        // Sum up progress across everything
        let bytesLoaded = 0
        utils.each(this.chunks, function (c) {
          // get chunk progress relative to entire file
          bytesLoaded += c.progress() * (c.endByte - c.startByte)
        })
        let percent = bytesLoaded / this.size
        // We don't want to lose percentages when an upload is paused
        this._prevProgress = Math.max(
          this._prevProgress,
          percent > 0.9999 ? 1 : percent
        )
        ret = this._prevProgress
      }
    )
    return ret
  },

  getSize: function () {
    let size = 0
    this._eachAccess(
      function (file) {
        size += file.size
      },
      function () {
        size += this.size
      }
    )
    return size
  },

  getFormatSize: function () {
    let size = this.getSize()
    return utils.formatSize(size)
  },

  getRoot: function () {
    if (this.isRoot) {
      return this
    }
    let parent = this.parent
    while (parent) {
      if (parent.parent === this.uploader) {
        // find it
        return parent
      }
      parent = parent.parent
    }
    return this
  },

  sizeUploaded: function () {
    let size = 0
    this._eachAccess(
      function (file) {
        size += file.sizeUploaded()
      },
      function () {
        utils.each(this.chunks, function (chunk) {
          size += chunk.sizeUploaded()
        })
      }
    )
    return size
  },

  timeRemaining: function () {
    let ret = 0
    let sizeDelta = 0
    let averageSpeed = 0
    this._eachAccess(
      function (file, i) {
        if (!file.paused && !file.error) {
          sizeDelta += file.size - file.sizeUploaded()
          averageSpeed += file.averageSpeed
        }
        if (i === this.files.length - 1) {
          ret = calRet(sizeDelta, averageSpeed)
        }
      },
      function () {
        if (this.paused || this.error) {
          ret = 0
          return
        }
        let delta = this.size - this.sizeUploaded()
        ret = calRet(delta, this.averageSpeed)
      }
    )
    return ret
    function calRet (delta, averageSpeed) {
      if (delta && !averageSpeed) {
        return Number.POSITIVE_INFINITY
      }
      if (!delta && !averageSpeed) {
        return 0
      }
      return Math.floor(delta / averageSpeed)
    }
  },

  removeFile: function (file) {
    if (file.isFolder) {
      while (file.files.length) {
        let f = file.files[file.files.length - 1]
        this._removeFile(f)
      }
    }
    this._removeFile(file)
  },

  _delFilePath: function (file) {
    if (file.path && this.filePaths) {
      delete this.filePaths[file.path]
    }
    utils.each(
      file.fileList,
      function (file) {
        this._delFilePath(file)
      },
      this
    )
  },

  _removeFile: function (file) {
    if (!file.isFolder) {
      utils.each(
        this.files,
        function (f, i) {
          if (f === file) {
            this.files.splice(i, 1)
            return false
          }
        },
        this
      )
      file.abort()
      let parent = file.parent
      let newParent
      while (parent && parent !== this) {
        newParent = parent.parent
        parent._removeFile(file)
        parent = newParent
      }
    }
    file.parent === this &&
      utils.each(
        this.fileList,
        function (f, i) {
          if (f === file) {
            this.fileList.splice(i, 1)
            return false
          }
        },
        this
      )
    if (!this.isRoot && this.isFolder && !this.files.length) {
      this.parent._removeFile(this)
      this.uploader._delFilePath(this)
    }
    file.parent = null
  },

  getType: function () {
    if (this.isFolder) {
      return 'folder'
    }
    return this.file.type && this.file.type.split('/')[1]
  },

  getExtension: function () {
    if (this.isFolder) {
      return ''
    }
    return this.name
      .substr((~-this.name.lastIndexOf('.') >>> 0) + 2)
      .toLowerCase()
  }
})

module.exports = File
