import fs from 'fs'
import path from 'path'
import mime from 'mime'

function defineNonEnumerable(target, key, value) {
  Object.defineProperty(target, key, {
    enumerable: false,
    configurable: true,
    writable: true,
    value: value
  })
}

function _listFilesPath(pPath) {
  const getFile = p => {
    let files = fs.readdirSync(p)
    files.forEach(function(item, index) {
      let fPath = path.join(p, item)
      let stat = fs.statSync(fPath)
      stat.isDirectory() && getFile(fPath)
      stat.isFile() && fileList.push(fPath)
    })
  }
  let fileList = []
  fs.statSync(pPath).isDirectory() && getFile(pPath)
  return fileList
}

function _listFiles(p) {
  let subFilesPath = _listFilesPath(p)
  let subFiles = subFilesPath.map(filePath => new LocalFile(filePath, p))
  return subFiles
}

class LocalFile {
  constructor(filePath, parentPath) {
    filePath = filePath ? path.normalize(filePath) : filePath
    parentPath = parentPath ? path.normalize(parentPath) : parentPath
    let stat
    try {
      stat = filePath ? fs.statSync(filePath) : stat
    } catch (error) {
      console.warn(error)
    }
    if (!stat) {
      throw new Error('no such file or directory')
    }
    defineNonEnumerable(this, '_stat', stat)

    this.path = filePath
    this.relativePath = parentPath
      ? path.relative(path.normalize(parentPath + '/..'), filePath)
      : path.basename(filePath)
    this.webkitRelativePath = this.relativePath
    this.name = path.basename(filePath)
    this.type = mime.getType(filePath)

    const { size, mtime } = stat
    this.size = size
    this.lastModifiedDate = mtime
    this.lastModified = mtime.getTime()
  }
  slice() {
    // TODO
    // fs.createReadStream()
  }
  isDirectory() {
    return this._stat.isDirectory()
  }
  isFile() {
    return this._stat.isFile()
  }
  listFiles() {
    return _listFiles(this.path)
  }
  listFilesPath() {
    return _listFilesPath(this.path)
  }
}

LocalFile.listFilesPath = _listFilesPath

export default LocalFile
