# oss-uploader.js


oss-uploader.js  是一个文件上传插件，Fork [simple-uploader.js](https://github.com/simple-uploader/Uploader)，在simple-uploader.js的基础上，新增了文件上传至OSS的功能（目前仅支持七牛云和阿里云）。
git：https://github.com/LLLLLLiulei/oss-uploader.js.git

## 安装

```console
npm install oss-uploader.js
```

## 使用
###### 请参考[simple-uploader.js](https://github.com/simple-uploader/Uploader/blob/develop/README_zh-CN.md)

## API

###### 请参考[simple-uploader.js](https://github.com/simple-uploader/Uploader/blob/develop/README_zh-CN.md)
###### 在simple-uploader.js的基础上新增的配置如下：
#### Uploader
##### 支持的配置项：
* `oss` oss名称`（七牛云：qiniu，阿里云：aliyun）`，用于区分上传至哪个OSS,默认 null(使用默认上传方式)
* `ossParams` oss上传时的参数配置，可以是一个对象或者一个方法（会传入当前file对象，需返回对象包含配置参数）

- [x] 七牛云(qiniu)

```JavaScript
let opts={
    oss:'qiniu',
    ossParams:async function(file){
        let {name} = file
        let res = await axios.get(`http://localhost:3000/qiniuuptoken?fileName=${name}`)
        let {key,token,config,putExtra} = res.data
        return {
            key,
            token,
            config,
            putExtra
        }
    }
}

//或者：

opts={
    oss:'qiniu',
    ossParams: {
            key:'testFile',
            token:'DzyD0TQsBnSYEg3ncPROPP00XoFDUNsdaadTRDGV:ZhyEPw4mjCdX7PNCpaGNNRcQpGY=:eyJzY29wZSI6InNsaW1kb2MtdGVzdDpqaWFtaTIuemlwIiwiZGVhZGxpbmUiOjE1NTUxNDA4ODl9',
            config:{
                useCdnDomain: true,
                region: qiniu.region.z2
            },
            putExtra:{
                fname: "testFile.txt",
                params: {},
                mimeType: [] || null
            }
        }
}

const uploader = new Uploader(opts)
```

参数说明(摘自七牛云(https://developer.qiniu.com/kodo/sdk/1283/javascript))：
  * **key(必需)**: 文件资源名
  * **token(必需)**: 上传验证信息，前端通过接口请求后端获得
  * **config**: `object`

    ```JavaScript
    var config = {
      useCdnDomain: true,
      region: qiniu.region.z2
    };
    ```

    * config.useCdnDomain: 表示是否使用 cdn 加速域名，为布尔值，`true` 表示使用，默认为 `false`。
    * config.disableStatisticsReport: 是否禁用日志报告，为布尔值，默认为 `false`。
    * config.uphost: 上传 `host`，类型为 `string`， 如果设定该参数则优先使用该参数作为上传地址，默认为 `null`。
    * config.region: 选择上传域名区域；当为 `null` 或 `undefined` 时，自动分析上传域名区域。
    * config.retryCount: 上传自动重试次数（整体重试次数，而不是某个分片的重试次数）；默认 3 次（即上传失败后最多重试两次）；**目前仅在上传过程中产生 `599` 内部错误时生效**，**但是未来很可能会扩展为支持更多的情况**。
    * config.concurrentRequestLimit: 分片上传的并发请求量，`number`，默认为3；因为浏览器本身也会限制最大并发量，所以最大并发量与浏览器有关。
    * config.checkByMD5: 是否开启 MD5 校验，为布尔值；在断点续传时，开启 MD5 校验会将已上传的分片与当前分片进行 MD5 值比对，若不一致，则重传该分片，避免使用错误的分片。读取分片内容并计算 MD5 需要花费一定的时间，因此会稍微增加断点续传时的耗时，默认为 false，不开启。
    * config.forceDirect: 是否上传全部采用直传方式，为布尔值；为 `true` 时则上传方式全部为直传 form 方式，禁用断点续传，默认 `false`。

  * **putExtra**:

    ```JavaScript
    var putExtra = {
      fname: "",
      params: {},
      mimeType: [] || null
    };
    ```

    * fname: `string`，文件原文件名
    * params: `object`，用来放置自定义变量
    * mimeType: `null || array`，用来限制上传文件类型，为 `null` 时表示不对文件类型限制；限制类型放到数组里：
    `["image/png", "image/jpeg", "image/gif"]`



- [x] 阿里云(aliyun)
```JavaScript
let opts={
    oss:'aliyun',
    ossParams:async function(file){
        let {name}  = file
        let options = {}
        let res = await axios.get(`http://localhost:3000/aliuptoken?fileName=${name}`)
        let ossConfig = res.data.data
        return {
            ossConfig,
            name
            options
        }
    }
}

//或者：

opts={
    oss:'aliyun',
    ossParams: {
        ossConfig :{
            region: '<Your region>',
            accessKeyId: '<Your AccessKeyId>',
            accessKeySecret: '<Your AccessKeySecret>',
            bucket: '<Your bucket name>',
        },
        name:'testFile',
        options:{}
    }
}

const uploader = new Uploader(opts)
```
参数说明(摘自阿里云(https://help.aliyun.com/document_detail/64047.html?spm=a2c4g.11174283.6.1048.1a3a7da2LulhtJ#h2-url-2))：

-   ossConfig \{Object\} oss配置项
    -   \[accessKeyId\] \{String\}：通过阿里云控制台创建的access key。
    -   \[accessKeySecret\] \{String\}：通过阿里云控制台创建的access secret。
    -   \[stsToken\] \{String\}：使用临时授权方式，详情请参见[使用STS访问](cn.zh-CN/SDK 参考/Node.js/授权访问.md#)。
    -   \[bucket\] \{String\}：通过控制台创建的bucket。
    -   \[endpoint\] \{String\}：OSS域名。
    -   \[region\] \{String\}：bucket 所在的区域，默认 oss-cn-hangzhou。
    -   \[internal\] \{Boolean\}：是否使用阿里云内网访问，默认false。比如通过ECS访问OSS，则设置为true，采用internal的endpoint可节约费用。
    -   \[cname\] \{Boolean\}：是否支持上传自定义域名，默认false。如果cname为true，endpoint传入自定义域名时，自定义域名需要先同bucket进行绑定。
    -   \[isRequestPay\] \{Boolean\}：bucket是否开启请求者付费模式，默认false。具体可查看[请求者付费模式](../../../../../cn.zh-CN/开发指南/存储空间（Bucket）/请求者付费模式.md#)。
    -   \[secure\] \{Boolean\}： \(secure: true\) 则使用 HTTPS， \(secure: false\) 则使用 HTTP，详情请查看[常见问题](cn.zh-CN/SDK 参考/Node.js/常见问题.md#)。
    -   \[timeout\] \{String|Number\}：超时时间，默认 60s。
-   name \{String\} Object名称。
-   \[options\] \{Object\} 额外参数 。
    -   \[checkpoint\] \{Object\} 断点记录点。如果设置这个参数，上传会从断点开始；如果没有设置，则重新上传。
        -   file \{File\} 用户选取的文件对象，浏览器重启后需要用户手动触发进行设置。
        -   name \{String\} 上传的object key。
        -   fileSize \{Number\} 文件大小。
        -   partSize \{Number\} 分片大小。
        -   uploadId \{String\} 分片上传的ID。
        -   doneParts \{Array\} 已完成分片的数组，包含的对象结构如下：
            -   number \{Number\} 分片的number。
            -   etag \{String\} 分片的etag。
    -   \[parallel\] \{Number\} 并发上传的分片个数。
    -   \[partSize\] \{Number\} 分片大小。
    -   \[progress\] \{Function\} `function`、 `async` 、`promise` 形式，回调函数包含三个参数：
        -   percentage \{Number\} 进度百分比\(0-1之间小数\)。
        -   checkpoint \{Object\} 断点记录点。
        -   res \{Object\}\) 单次part成功返回的response。
    -   \[meta\] \{Object\} 用户自定义header meta信息，header前缀 `x-oss-meta-`。
    -   \[mime\] \{String\} 用户自定义`Content-Type header` 。
    -   \[headers\] \{Object\} http额外的头字段，详情请看 [RFC 2616](http://www.w3.org/Protocols/rfc2616/rfc2616.html) 。
        -   'Cache-Control' 通用消息头被用在http请求和响应中，通过指定指令来实现缓存机制， 例如`Cache-Control: public, no-cache`。
        -   'Content-Disposition' 指定回复的内容该以何种形式展示。是以内联的形式（即网页或者页面的一部分），还是以附件的形式下载并保存到本地，例如`Content-Disposition: somename`。
        -   'Content-Encoding' 用于对特定媒体类型的数据进行压缩， 例如`Content-Encoding: gzip`。
        -   'Expires' 过期时间，例如`Expires: 3600000`。
    -   \[callback\] \{Object\} callback回调设置。
        -   url \{String\} 和oss server交互的回调服务器地址，对应CallBack参数中的callbackUrl。
        -   body \{String\} 发起回调时请求body的值，对应CallBack参数中的callbackBody。body值为JSON格式。
        -   \[host\] \{String\} 发起回调请求时Host头的值，对应CallBack参数中的callbackHost。
        -   \[contentType\] \{String\} 发起回调请求的Content-Type，对应CallBack参数中的callbackBodyType。
        -   \[customValue\] \{Object\} 发起回调请求自定义参数，对应CallBack参数中的callback-var。


示列:


app.vue
```
<template>
  <div>
    <uploader
      :options="options"
      :file-status-text="statusText"
      class="uploader-example"
      ref="uploader"
      @file-complete="fileComplete"
      @complete="complete"
    ></uploader>
  </div>
</template>

<script>

const axios = require('axios')

const getQinniuOssparams = async function (file) {
  let token = await axios.get('http://localhost:3000/qiniuuptoken?fileName=' + file.name)
  token = token.data
  console.log('token', token)
  return {
    token,
    key: file.name
  }
}

const getAliOssparams = async function (file) {
  let data = await axios.get('http://localhost:3000/aliuptoken?fileName=' + file.name)
  let ossParams = {
    ossConfig: data.data,
    name: file.name
  }
  return ossParams
}

export default {
  data () {
    return {
      options: {
        target: '//localhost:3000/upload', // '//jsonplaceholder.typicode.com/posts/',
        testChunks: false,
        oss: 'aliyun',
        ossParams: getAliOssparams
      },
      attrs: {
        accept: 'image/*'
      },
      statusText: {
        success: '成功了',
        error: '出错了',
        uploading: '上传中',
        paused: '暂停中',
        waiting: '等待中'
      }
    }
  },
  methods: {
    complete () {
      console.log('complete', arguments)
    },
    fileComplete () {
      console.log('file complete', arguments)
    }
  },
  mounted () {
    this.$nextTick(() => {
      window.uploader = this.$refs.uploader.uploader
    })
  }
}
</script>
```
uploader.vue

```
<template>
  <div class="uploader">
    <slot :files="files" :file-list="fileList" :started="started">
      <uploader-unsupport></uploader-unsupport>
      <uploader-drop>
        <p>Drop files here to upload or</p>
        <uploader-btn>select files</uploader-btn>
        <uploader-btn :directory="true">select folder</uploader-btn>
      </uploader-drop>
      <uploader-list></uploader-list>
    </slot>
  </div>
</template>

<script>
  // import Uploader from 'simple-uploader.js'
  // import Uploader from '../uploader/uploader.js'
  import Uploader from 'oss-uploader.js'

  import { kebabCase } from '../common/utils'
  import UploaderBtn from './btn.vue'
  import UploaderDrop from './drop.vue'
  import UploaderUnsupport from './unsupport.vue'
  import UploaderList from './list.vue'
  import UploaderFiles from './files.vue'
  import UploaderFile from './file.vue'

  const COMPONENT_NAME = 'uploader'
  const FILE_ADDED_EVENT = 'fileAdded'
  const FILES_ADDED_EVENT = 'filesAdded'
  const UPLOAD_START_EVENT = 'uploadStart'

  export default {
    name: COMPONENT_NAME,
    provide () {
      return {
        uploader: this
      }
    },
    props: {
      options: {
        type: Object,
        default () {
          return {}
        }
      },
      autoStart: {
        type: Boolean,
        default: true
      },
      fileStatusText: {
        type: [Object, Function],
        default () {
          return {
            success: 'success',
            error: 'error',
            uploading: 'uploading',
            paused: 'paused',
            waiting: 'waiting'
          }
        }
      }
    },
    data () {
      return {
        started: false,
        files: [],
        fileList: []
      }
    },
    methods: {
      uploadStart () {
        this.started = true
      },
      fileAdded (file) {
        this.$emit(kebabCase(FILE_ADDED_EVENT), file)
        if (file.ignored) {
          // is ignored, filter it
          return false
        }
      },
      filesAdded (files, fileList) {
        this.$emit(kebabCase(FILES_ADDED_EVENT), files, fileList)
        if (files.ignored || fileList.ignored) {
          // is ignored, filter it
          return false
        }
      },
      fileRemoved (file) {
        this.files = this.uploader.files
        this.fileList = this.uploader.fileList
      },
      filesSubmitted (files, fileList) {
        this.files = this.uploader.files
        this.fileList = this.uploader.fileList
        if (this.autoStart) {
          this.uploader.upload()
        }
      },
      allEvent (...args) {
        const name = args[0]
        const EVENTSMAP = {
          [FILE_ADDED_EVENT]: true,
          [FILES_ADDED_EVENT]: true,
          [UPLOAD_START_EVENT]: 'uploadStart'
        }
        const handler = EVENTSMAP[name]
        if (handler) {
          if (handler === true) {
            return
          }
          this[handler].apply(this, args.slice(1))
        }
        args[0] = kebabCase(name)
        this.$emit.apply(this, args)
      }
    },
    created () {
      console.log(console)
      this.options.initialPaused = !this.autoStart
      const uploader = new Uploader(this.options)
      this.uploader = uploader
      console.log(uploader)
      this.uploader.fileStatusText = this.fileStatusText
      uploader.on('catchAll', this.allEvent)
      uploader.on(FILE_ADDED_EVENT, this.fileAdded)
      uploader.on(FILES_ADDED_EVENT, this.filesAdded)
      uploader.on('fileRemoved', this.fileRemoved)
      uploader.on('filesSubmitted', this.filesSubmitted)
    },
    destroyed () {
      const uploader = this.uploader
      uploader.off('catchAll', this.allEvent)
      uploader.off(FILE_ADDED_EVENT, this.fileAdded)
      uploader.off(FILES_ADDED_EVENT, this.filesAdded)
      uploader.off('fileRemoved', this.fileRemoved)
      uploader.off('filesSubmitted', this.filesSubmitted)
      this.uploader = null
    },
    components: {
      UploaderBtn,
      UploaderDrop,
      UploaderUnsupport,
      UploaderList,
      UploaderFiles,
      UploaderFile
    }
  }
</script>

<style>
  .uploader {
    position: relative;
  }
</style>

```


## 源
oss-uploader.js 是 FORK 的 https://github.com/simple-uploader/Uploader ，参考了 https://github.com/qiniu/js-sdk , https://github.com/ali-sdk/ali-oss
