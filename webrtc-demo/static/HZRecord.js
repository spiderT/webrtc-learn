(function (window) {
  'use strict';
  window.URL = window.URL || window.webkitURL;
  navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;


  var HZRecorder = function (stream, config) {
    config = config || {};
    config.sampleBits = config.sampleBits || 16;      //采样数位 8, 16
    config.sampleRate = config.sampleRate || (44100 / 6);   //采样率(1/6 44100)

    var context;
    if (context) {
      // 关闭一个音频环境, 释放任何正在使用系统资源的音频.
      context.close().then(function () {
        console.log('关闭一个音频环境, 释放任何正在使用系统资源的音频');
      });
    }

    //创建一个音频环境对象
    var AudioContext = window.AudioContext || window.webkitAudioContext;

    if(!context){
      context = new AudioContext();
    }


    //将声音输入这个对像
    var audioInput = context.createMediaStreamSource(stream);

    //设置音量节点
    var volume = context.createGain();
    audioInput.connect(volume);

    //创建缓存，用来缓存声音
    var bufferSize = 4096;

    // 创建声音的缓存节点，createScriptProcessor方法的
    // 第二个和第三个参数指的是输入和输出都是双声道。
    var recorder = context.createScriptProcessor(bufferSize, 2, 2);

    var audioData = {
      size: 0,         //录音文件长度
      buffer: [],    //录音缓存
      inputSampleRate: context.sampleRate,    //输入采样率
      inputSampleBits: 16,      //输入采样数位 8, 16
      outputSampleRate: config.sampleRate,   //输出采样率
      outputSampleBits: config.sampleBits,      //输出采样数位 8, 16
      input: function (data) {
        this.buffer.push(new Float32Array(data));
        this.size += data.length;
      },
      compress: function () { //合并压缩录音数据
        //合并
        var data = new Float32Array(this.size);
        var offset = 0;
        for (var i = 0; i < this.buffer.length; i++) {
          data.set(this.buffer[i], offset);
          offset += this.buffer[i].length;
        }
        //压缩
        var compression = parseInt(this.inputSampleRate / this.outputSampleRate);
        var length = data.length / compression;
        var result = new Float32Array(length);
        var index = 0, j = 0;
        while (index < length) {
          result[index] = data[j];
          j += compression;
          index++;
        }
        return result;
      },
      encodeWAV: function () {
        var sampleRate = Math.min(this.inputSampleRate, this.outputSampleRate);
        var sampleBits = Math.min(this.inputSampleBits, this.outputSampleBits);
        var bytes = this.compress();

        console.log('bytes', bytes);

        var dataLength = bytes.length * (sampleBits / 8);
        var buffer = new ArrayBuffer(44 + dataLength);
        var data = new DataView(buffer);

        var channelCount = 1;//单声道
        var offset = 0;

        var writeString = function (str) {
          for (var i = 0; i < str.length; i++) {
            data.setUint8(offset + i, str.charCodeAt(i));
          }
        };

        // 资源交换文件标识符
        writeString('RIFF');
        offset += 4;
        // 下个地址开始到文件尾总字节数,
        data.setUint32(offset, 36 + dataLength, true);
        offset += 4;
        // WAV文件标志
        writeString('WAVE');
        offset += 4;
        // 波形格式标志
        writeString('fmt ');
        offset += 4;
        // 过滤字节,一般为 0x10 = 16
        data.setUint32(offset, 16, true);
        offset += 4;
        // 格式类别 (PCM形式采样数据)
        data.setUint16(offset, 1, true);
        offset += 2;
        // 通道数
        data.setUint16(offset, channelCount, true);
        offset += 2;
        // 采样率,每秒样本数,表示每个通道的播放速度
        data.setUint32(offset, sampleRate, true);
        offset += 4;
        // 波形数据传输率 (每秒平均字节数) 单声道×每秒数据位数×每样本数据位/8
        data.setUint32(offset, channelCount * sampleRate * (sampleBits / 8), true);
        offset += 4;
        // 快数据调整数 采样一次占用字节数 单声道×每样本的数据位数/8
        data.setUint16(offset, channelCount * (sampleBits / 8), true);
        offset += 2;
        // 每样本数据位数
        data.setUint16(offset, sampleBits, true);
        offset += 2;
        // 数据标识符
        writeString('data');
        offset += 4;
        // 采样数据总数,即数据总大小-44
        data.setUint32(offset, dataLength, true);
        offset += 4;
        // 写入采样数据
        if (sampleBits === 8) {
          for (var i = 0; i < bytes.length; i++, offset++) {
            var s = Math.max(-1, Math.min(1, bytes[i]));
            var val = s < 0 ? s * 0x8000 : s * 0x7FFF;
            val = parseInt(255 / (65535 / (val + 32768)));
            data.setInt8(offset, val, true);
          }
        } else {
          for (var i = 0; i < bytes.length; i++, offset += 2) {
            var s = Math.max(-1, Math.min(1, bytes[i]));
            data.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
          }
        }

        return new Blob([data], {type: 'audio/wav'});
      }
    };

    //开始录音
    this.start = function () {
      audioInput.connect(recorder);
      recorder.connect(context.destination);
    };

    //停止
    this.stop = function () {
      recorder.disconnect();
    };

    //获取音频文件
    this.getBlob = function () {
      this.stop();
      return audioData.encodeWAV();
    };

    // 释放录音缓存
    this.reset = function () {
      audioData.size = 0;
      audioData.buffer = [];
    };

    //回放
    this.play = function (audio) {
      audio.src = window.URL.createObjectURL(this.getBlob());
    };

    //上传
    this.upload = function (url, callback) {
      var blob = this.getBlob();
      var fd = new FormData();
      fd.append('file', blob, 'hys.wav');

      var xhr = new XMLHttpRequest();
      if (callback) {
        xhr.upload.addEventListener('progress', function (e) {
          callback('uploading', e);
        }, false);
        xhr.addEventListener('load', function (e) {
          callback('ok', e);
        }, false);
        xhr.addEventListener('error', function (e) {
          callback('error', e);
        }, false);
        xhr.addEventListener('abort', function (e) {
          callback('cancel', e);
        }, false);
      }
      xhr.open('POST', url);
      xhr.send(fd);
    };

    //音频采集
    recorder.onaudioprocess = function (e) {
      audioData.input(e.inputBuffer.getChannelData(0));
    };

  };
  //抛出异常
  HZRecorder.throwError = function (message) {
    alert(message);
  };


  //是否支持录音
  HZRecorder.canRecording = (navigator.getUserMedia != null);
  //获取录音机
  HZRecorder.get = function (callback, errorCallback, config) {
    if (callback) {
      if (navigator.getUserMedia) {
        navigator.getUserMedia(
          {audio: true} //只启用音频
          , function (stream) {
            var rec = new HZRecorder(stream, config);
            callback(rec);
          }
          , function (error) {
            switch (error.code || error.name) {
              case 'PERMISSION_DENIED':
              case 'PermissionDeniedError':
                errorCallback && errorCallback(error);
                HZRecorder.throwError('无麦克风权限无法发语音，请点击浏览器的红色禁止弹框，允许系统访问麦克风。');
                break;
              case 'NOT_SUPPORTED_ERROR':
              case 'NotSupportedError':
                errorCallback && errorCallback(error);
                HZRecorder.throwError('当前浏览器不支持录音功能。');
                break;
              case 'MANDATORY_UNSATISFIED_ERROR':
              case 'MandatoryUnsatisfiedError':
                errorCallback && errorCallback(error);
                HZRecorder.throwError('无法发现指定的硬件设备。');
                break;
              default:
                errorCallback && errorCallback(error);
                HZRecorder.throwError('无麦克风权限无法发语音，请点击浏览器的红色禁止弹框，允许系统访问麦克风。');
                break;
            }
          });
      } else {
        errorCallback && errorCallback('当前浏览器不支持录音功能');
        HZRecorder.throwErr('当前浏览器不支持录音功能。');
        return;
      }
    }
  };

  // granted — 用户之前已授予对麦克风的访问权；
  // prompt — 用户尚未授予访问权，调用 getUserMedia 时将会收到提示；
  // denied — 系统或用户已显式屏蔽对麦克风的访问权，您将无法获得对其的访问权。
  // chrome 43 才支持！！！！！
  HZRecorder.checkMicrphonePermissions = function (callback) {
    navigator.permissions.query({name: 'microphone'}).then(function (result) {
      if (result.state === 'granted') {
        console.log('用户之前已授予对麦克风的访问权!!!!');
      } else if (result.state === 'prompt') {
        console.log('用户尚未授予访问权，调用 getUserMedia 时将会收到提示!!!!');
        callback && callback();
      } else if (result.state === 'denied') {
        alert('系统或用户已显式屏蔽对麦克风的访问权，您将无法获得对其的访问权!!!!');
      }
    });
  };
  window.HZRecorder = HZRecorder;

})(window);
