# oss-uploader.js  

 
oss-uploader.js  是一个文件上传插件，Fork [simple-uploader.js](https://github.com/simple-uploader/Uploader)，包含[simple-uploader.js](https://github.com/simple-uploader/Uploader)所有功能，新增了文件上传至OSS（目前仅支持七牛云，后续考虑支持阿里云，腾讯云等主流OSS）。
git地址：https://github.com/LLLLLLiulei/oss-uploader.js.git

## 安装
 
```console
npm install oss-uploader.js
```

## 使用
 
实例化的时候可以传入配置项：

```javascript
var r = new Uploader({ opt1: 'val', ...})
```

支持的配置项：
###### 请参考[simple-uploader.js](https://github.com/simple-uploader/Uploader)
###### 在[simple-uploader.js](https://github.com/simple-uploader/Uploader)的基础上新增的配置如下：
* `oss` oss名称，默认 `null（七牛云：qiniu）`，用于区分上传至哪个OSS。
* `ossParams` oss上传时的参数配置，可以是一个对象（包含字段token（必须），key（必须），putExtra，config，参考七牛云jssdk）或者一个方法（会传入当前file 需返回一个对象，包含字段token（必须），key（必须），putExtra，config参考七牛云jssdk）
* `beforeLastChunkUplod` 文件最后一分块上传前事件钩子
*  `beforeChunkUplod` 文件分块开始上传前钩子
 
 
## 源
oss-uploader.js 是 FORK 的 https://github.com/simple-uploader/Uploader 的，参考了 https://github.com/qiniu/js-sdk , https://github.com/ali-sdk/ali-oss
