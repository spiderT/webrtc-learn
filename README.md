# WebRTC

- [WebRTC](#webrtc)
  - [1. WebRTC 基础知识](#1-webrtc-基础知识)
    - [1.1. 音视频采集](#11-音视频采集)
      - [1.1.1. 音视频采集基本概念](#111-音视频采集基本概念)
      - [1.1.2. 音视频采集](#112-音视频采集)
    - [1.2. 音视频设备基本原理](#12-音视频设备基本原理)
      - [1.2.1. 音频设备](#121-音频设备)
      - [1.2.2. 视频设备](#122-视频设备)
      - [1.2.3. WebRTC 设备管理的基本概念](#123-webrtc-设备管理的基本概念)
      - [1.2.4. 设备检测](#124-设备检测)
    - [1.3. 非编码帧和编码帧](#13-非编码帧和编码帧)
    - [1.4. 如何获取视频流](#14-如何获取视频流)
    - [1.5. ArrayBuffer和 Blob](#15-arraybuffer和-blob)
  - [2. 录音实现的两种方式](#2-录音实现的两种方式)
    - [2.1. MediaRecorder](#21-mediarecorder)
    - [2.2. getUserMedia结合AudioContext](#22-getusermedia结合audiocontext)
    - [2.3 录音的压缩](#23-录音的压缩)
  - [3. 音视频聊天](#3-音视频聊天)
    - [3.1. RTP和RTCP](#31-rtp和rtcp)
      - [3.1.1. RTP协议](#311-rtp协议)
      - [3.1.2. RTCP协议](#312-rtcp协议)
    - [3.2. SDP](#32-sdp)
      - [3.2.1 交换SDP信息](#321-交换sdp信息)
      - [3.2.2 标准SDP规范](#322-标准sdp规范)
      - [3.2.3  SDP格式](#323--sdp格式)
      - [3.2.4  SDP结构](#324--sdp结构)
    - [3.3. RTCPeerConnection](#33-rtcpeerconnection)
    - [3.4. 音视频聊天](#34-音视频聊天)

## 1. WebRTC 基础知识

### 1.1. 音视频采集

#### 1.1.1. 音视频采集基本概念

- **摄像头**。用于捕捉（采集）图像和视频。

- **帧率**。现在的摄像头功能已非常强大，一般情况下，一秒钟可以采集 30 张以上的图像，一些好的摄像头甚至可以采集 100 张以上。我们把摄像头一秒钟采集图像的次数称为帧率。帧率越高，视频就越平滑流畅。然而，在直播系统中一般不会设置太高的帧率，因为帧率越高，占的网络带宽就越多。

- **分辨率**。摄像头除了可以设置帧率之外，还可以调整分辨率。我们常见的分辨率有 2K、1080P、720P、420P 等。分辨率越高图像就越清晰，但同时也带来一个问题，即占用的带宽也就越多。所以，在直播系统中，分辨率的高低与网络带宽有紧密的联系。也就是说，分辨率会跟据你的网络带宽进行动态调整。

- **宽高比**。分辨率一般分为两种宽高比，即 16:9 或 4:3。4:3 的宽高比是从黑白电视而来，而 16:9 的宽高比是从显示器而来。现在一般情况下都采用 16:9 的比例。

- **麦克风**。用于采集音频数据，它与视频一样，可以指定一秒内采样的次数，称为采样率。每个采样用几个bit表示，称为采样位深或采样大小。

- **轨（Track）**。WebRTC 中的“轨”借鉴了多媒体的概念。火车轨道的特性你应该非常清楚，两条轨永远不会相交。“轨”在多媒体中表达的就是每条轨数据都是独立的，不会与其他轨相交，如 MP4 中的音频轨、视频轨，它们在 MP4 文件中是被分别存储的。

- **流（Stream）**。可以理解为容器。在 WebRTC 中，“流”可以分为媒体流（MediaStream）和数据流（DataStream）。其中，媒体流可以存放 0 个或多个音频轨或视频轨；数据流可以存 0 个或多个数据轨。

#### 1.1.2. 音视频采集

1. getUserMedia 方法

```js
var promise = navigator.mediaDevices.getUserMedia(constraints);

```

返回一个promise对象。

- 如果getUserMedia调用成功，则可以通过 Promise获得MediaStream对象，也就是说已经从音视频设备获得到音视频数据了。

```txt
MediaStream
active: true
id: "XUMY3LnvR7w5pPKVTZNGtdDEnCdp47dyxjmn"
onactive: null
onaddtrack: null
oninactive: null
onremovetrack: null
__proto__: MediaStream
```

- 如果调用失败，比如该用户拒绝该API访问媒体设备（音频设备，视频设备），或者要访问的媒体设备不可用，则返回的Promise会得到PermissionDeniedError或NotFoundError等错误对象。

### 1.2. 音视频设备基本原理

#### 1.2.1. 音频设备

音频有采样率和采样大小的概念，实际上这两个概念就与音频设备密不可分。

音频输入设备的主要工作是采集音频数据，而采集音频数据的本质就是模数转换（A/D），即将模似信号转换成数字信号。

模数转换使用的采集定理称为奈奎斯特定理：在进行模拟 / 数字信号的转换过程中，当采样率大于信号中最高频率的 2 倍时，采样之后的数字信号就完整地保留了原始信号中的信息。

人类听觉范围的频率是 20Hz～20kHz 之间。对于日常语音交流（像电话），8kHz 采样率就可以满足人们的需求。但为了追求高品质、高保真，你需要将音频输入设备的采样率设置在 40kHz 以上，这样才能完整地将原始信号保留下来。例如我们平时听的数字音乐，一般其采样率都是 44.1k、48k 等，以确保其音质的无损。

采集到的数据再经过量化、编码，最终形成数字信号，这就是音频设备所要完成的工作。在量化和编码的过程中，采样大小（保存每个采样的二进制位个数）决定了每个采样最大可以表示的范围。如果采样大小是 8 位，则它表示的最大值是就是 2^8 -1，即 255；如果是 16 位，则其表示的最大数值是 65535。

#### 1.2.2. 视频设备

至于视频设备，则与音频输入设备很类似。当实物光通过镜头进行到摄像机后，它会通过视频设备的模数转换（A/D）模块，即光学传感器， 将光转换成数字信号，即 RGB（Red、Green、Blue）数据。

获得 RGB 数据后，还要通过 DSP（Digital Signal Processer）进行优化处理，如自动增强、白平衡、色彩饱和等都属于这一阶段要做的事情。

通过 DSP 优化处理后，你就得到了 24 位的真彩色图片。因为每一种颜色由 8 位组成，而一个像素由 RGB 三种颜色构成，所以一个像素就需要用 24 位表示，故称之为24位真彩色。

另外，此时获得的 RGB 图像只是临时数据。因最终的图像数据还要进行压缩、传输，而编码器一般使用的输入格式为 YUV I420，所以在摄像头内部还有一个专门的模块用于将 RGB 图像转为 YUV 格式的图像。

那什么是 YUV 呢？YUV 也是一种色彩编码方法，主要用于电视系统以及模拟视频领域。它将亮度信息（Y）与色彩信息（UV）分离，即使没有 UV 信息一样可以显示完整的图像，只不过是黑白的，这样的设计很好地解决了彩色电视机与黑白电视的兼容问题。

#### 1.2.3. WebRTC 设备管理的基本概念

1. **MediaDevices**，该接口提供了访问（连接到计算机上的）媒体设备（如摄像头、麦克风）以及截取屏幕的方法。实际上，它允许你访问任何硬件媒体设备。而咱们要获取可用的音视频设备列表，就是通过该接口中的方法来实现的

2. **MediaDeviceInfo**，它表示的是每个输入 / 输出设备的信息。包含以下三个重要的属性：

- deviceId，设备的唯一标识。
- label，设备名称。
- kind，设备种类，可用于识别出是音频设备还是视频设备，是输入设备还是输出设备。

需要注意的是，出于安全原因，除非用户已被授予访问媒体设备的权限（要想授予权限需要使用 HTTPS 请求），否则 label 字段始终为空。

```js
// List cameras and microphones.
navigator.mediaDevices.enumerateDevices()
  .then(function(devices) {
    devices.forEach(function(device) {
      console.log(device.kind + ": " + device.label +
        " id = " + device.deviceId);

      // 有耳机
      // audioinput: 默认 - 外置麦克风 (Built-in) id = default
      // audioinput: 外置麦克风 (Built-in) id = 81f865d05becf5f91f48441a93b509720a850c4db86c1a396e51356a6514e99c
      // videoinput: FaceTime HD Camera id = 1200d31c81381c7ac7ac249e91b03ee58c644008205f29f237f1f3662530c57c
      // audiooutput: 默认 - 耳机 (Built-in) id = default
      // audiooutput: 耳机 (Built-in) id = 670525b524f5ac9070ac0de228ca26c7fd46b63e7a0690c9c676a4caeac12f0a


      // 无耳机
      // audioinput: 默认 - 内置麦克风 (Built-in) id = default
      // audioinput: 内置麦克风 (Built-in) id = 81f865d05becf5f91f48441a93b509720a850c4db86c1a396e51356a6514e99c
      // videoinput: FaceTime HD Camera id = 1200d31c81381c7ac7ac249e91b03ee58c644008205f29f237f1f3662530c57c
      // audiooutput: 默认 - 内置扬声器 (Built-in) id = default
      // audiooutput: 内置扬声器 (Built-in) id = 670525b524f5ac9070ac0de228ca26c7fd46b63e7a0690c9c676a4caeac12f0a

    });
  })
  .catch(function(err) {
    console.log(err.name + ": " + err.message);
  });
```

#### 1.2.4. 设备检测

在获取到电脑 / 手机上的所有设备信息后，我们就可以对设备的可用性做真正的检测了。在我们的设备列表中，可以通过MediaDeviceInfo结构中的kind字段，将设备分类为音频设备或视频设备。

如果再细分的话，还可以通过 kind 字段再将音视设备分为输入设备和输出设备。如我们平时使用的耳机，从大的方面说它是一个音频设备，但它同时兼有音频输入设备和音频输出设备的功能。

对于区分出的音频设备和视频设备，每种不同种类的设备还会设置各自的默认设备。还是以耳机这个音频设备为例，将耳机插入电脑后，耳机就变成了音频的默认设备；将耳机拔出后，默认设备又切换成了系统的音频设备。

### 1.3. 非编码帧和编码帧

1. **非编码帧**

当你要播放某个视频文件时，播放器会按照一定的时间间隔连续地播放从音视频文件中解码后的视频帧，这样视频就动起来了。同理，播放从摄像头获取的视频帧也是如此，只不过从摄像头获取的本来就是非编码视频帧。所以就不需要解码了。

- 播放的视频帧之间的时间间隔是非常小的。如按每秒钟 20 帧的帧率计算，每帧之间的间隔是 50ms。

- 播放器播的是非编码帧（解码后的帧），这些非编码帧就是一幅幅独立的图像。

从摄像头里采集的帧或通过解码器解码后的帧都是非编码帧。非编码帧的格式一般是 YUV 格式或是 RGB 格式。关于 YUV 与 RGB 的相关知识，我在

2. **编码帧**

通过编码器（如 H264/H265、VP8/VP9）压缩后的帧称为 编码帧。这里我们以H264为例，经过H264编码的帧包括以下三种类型。

I帧：关键帧。压缩率低，可以单独解码成一幅完整的图像。

P帧：参考帧。压缩率较高，解码时依赖于前面已解码的数据。

B帧：前后参考帧。压缩率最高，解码时不光依赖前面已经解码的帧，而且还依赖它后面的 P 帧。换句话说就是，B 帧后面的 P 帧要优先于它进行解码，然后才能将 B 帧解码

从播放器里获取的视频帧一定是非编码帧。也就是说，拍照的过程其实是从连续播放的一幅幅画面中抽取正在显示的那张画面

### 1.4. 如何获取视频流

在这段脚本中，我们调用了之前所讲的 getUserMedia 方法，该方法会打开摄像头，并通过它采集音视频流。然后再将采集到的视频流赋值给 HTML 中定义的 video标签的srcObject字段，
这样video标签就可以从摄像头源源不断地获得视频帧，并将它播放出来

```js
'use strict'

// 获取 HTML 页面中的 video 标签  
var videoplay = document.querySelector('video#player');

// 播放视频流
function gotMediaStream(stream){
        videoplay.srcObject = stream;
}

function handleError(err){
        console.log('getUserMedia error:', err);
}

// 对采集的数据做一些限制
var constraints = {
                        video : {
                                width: 1280,
                                height: 720,
                                frameRate:15,
                        },
                        audio : false
                   }

// 采集音视频数据流
navigator.mediaDevices.getUserMedia(constraints)
                        .then(gotMediaStream)
                        .catch(handleError);

```

### 1.5. ArrayBuffer和 Blob

在 JavaScript 中，有很多用于存储二进制数据的类型，这些类型包括：ArrayBuffer和 Blob。

WebRTC 录制音视频流之后，最终是通过 Blob 对象将数据保存成多媒体文件的。

1. ArrayBuffer

ArrayBuffer 对象表示通用的、固定长度的二进制数据缓冲区。因此，你可以直接使用它存储图片、视频等内容。

但你并不能直接对 ArrayBuffer 对象进行访问，类似于 Java 语言中的抽象类，在物理内存中并不存在这样一个对象，必须使用其封装类，进行实例化后才能进行访问。

也就是说， ArrayBuffer 只是描述有这样一块空间可以用来存放二进制数据，但在计算机的内存中并没有真正地为其分配空间。只有当具体类型化后，它才真正地存在于内存中。如下所示：

```js
let buffer = new ArrayBuffer(16); // 创建一个长度为 16 的 buffer
let view = new Uint32Array(buffer);
```

在上面的例子中，一开始生成的 buffer 是不能被直接访问的。只有将 buffer 做为参数生成一个具体的类型的新对象时（如 Uint32Array 或 DataView），这个新生成的对象才能被访问。

2. Blob

Blob（Binary Large Object）是 JavaScript 的大型二进制对象类型，WebRTC 最终就是使用它将录制好的音视频流保存成多媒体文件的。而它的底层是由上面所讲的 ArrayBuffer 对象的封装类实现的，即 Int8Array、Uint8Array 等类型。

Blob 对象的格式如下：

```js
let aBlob = new Blob( array, options );
```

其中，array 可以是ArrayBuffer、ArrayBufferView、Blob、DOMString等类型 ；option，用于指定存储成的媒体类型。

## 2. 录音实现的两种方式

### 2.1. MediaRecorder

WebRTC 为我们提供了一个非常方便的类，即 MediaRecorder。创建MediaRecorder对象 的格式如下：

```js
var mediaRecorder = new MediaRecorder(stream[, options]);
```

参数含义：

- stream，通过 getUserMedia 获取的本地视频流或通过 RTCPeerConnection获取的远程视频流。
- options，可选项，指定视频格式、编解码器、码率等相关信息。

MediaRecorder 对象还有一个特别重要的事件，即 ondataavailable事件。当MediaRecorder捕获到数据时就会触发该事件。通过它，我们才能将音视频数据录制下拉。

- **录音实现**

```js
navigator.mediaDevices.getUserMedia(constraints).then(
  stream => {
    console.log("stream===>", stream);
    console.log("授权成功！");

    // MediaRecorder到chrome49 才支持。
    mediaRecorder = new MediaRecorder(stream);

    startRecording = () => {
      // 开始记录媒体;这个方法可以通过一个时间片参数值以毫秒为单位。
      // 如果这是指定的,媒体将被捕获在单独的大块的时间,而不是默认的行为记录媒体在一大块。
      mediaRecorder.start(10);
      stateEle.innerHTML = "录音中...";
    };

    stopRecord = () => {
      if (mediaRecorder.state === "recording") {
        // 停止录制. 同时触发dataavailable事件,返回一个存储Blob内容的录制数据.之后不再记录
        mediaRecorder.stop();

        stateEle.innerHTML = "录音结束";
      }
      console.log("录音器状态：", mediaRecorder.state);
    };

    playRecord = () => {
      let blob = new Blob(chunks, {type: "audio/wav; codecs=opus"});
      let audioURL = window.URL.createObjectURL(blob);
      audio.src = audioURL;
    };


    let chunks = [];

    // 当有音视频数据来了之后，触发该事件
    mediaRecorder.ondataavailable = function (e) {
      console.log('e===>', e);
      console.log('e===>.data', e.data);
      chunks.push(e.data);
    };

  },
  () => {
    console.error("授权失败！");
  }
);
```

### 2.2. getUserMedia结合AudioContext

wav文件的组成

偏移地址|大小字节|数据块类型|内容
00H~03H|4|4字符|"RIFF"标志
04H~07H|4|长整数|文件长度
08H~0BH|4|4字符|"WAVE"标志（WAV文件标志）
0CH~0FH|4|4字符|"fmt"标志，波形格式标志（fmt ），最后一位空格
10H~13H|4|整数|过滤字节（一般为00000010H），若为00000012H则说明数据头携带附加信息
14H~15H|2|整数|格式种类（值为1时，表示数据为线性PCM编码）
16H~17H|2|整数|通道数，单声道为1，双声道为2
18H~1BH|4|长整数|采样频率（每秒样本数），表示每个通道的播放速度
1CH~1FH|4|长整数|波形音频数据传输速率（每秒平均字节数），通道数*每秒数据位数*每样本的数据位数/8
20H~21H|2|整数|数据块的调整数（按字节计算），通道数*每样本的数据位数/8
22H~23H|2|整数|每样本的数据位数，表示每个声道各个样本的数据位数。
24H~27H|4|长整型|数据标志符"data"
28H~31H|4|长整型|语音数据的长度

```js
//创建一个音频环境对象
let AudioContext = window.AudioContext || window.webkitAudioContext;
let context = new AudioContext();

// https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamSource
// 创建一个新的MediaStreamAudioSourceNode 对象, 需要传入一个媒体流对象(MediaStream对象)(可以从 navigator.getUserMedia 获得MediaStream对象实例), 然后来自MediaStream的音频就可以被播放和操作。
let audioInput = context.createMediaStreamSource(stream);

//设置音量节点
// https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createGain
// 创建一个GainNode,可用于控制的整体增益(或体积)音频图。
let volume = context.createGain();
audioInput.connect(volume);

//创建缓存，用来缓存声音
let bufferSize = 4096;

// 创建声音的缓存节点，createScriptProcessor方法的
// 第二个和第三个参数指的是输入和输出都是双声道。
// https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createScriptProcessor
// 创建一个ScriptProcessorNode用于直接音频处理。
let recorder = context.createScriptProcessor(bufferSize, 2, 2);

let audioData = {
  size: 0,         //录音文件长度
  buffer: [],    //录音缓存
  inputSampleRate: context.sampleRate,    //输入采样率
  inputSampleBits: 16,      //输入采样数位 8, 16
  outputSampleRate: config.sampleRate,   //输出采样率
  oututSampleBits: config.sampleBits,      //输出采样数位 8, 16
  input: function (data) {
    this.buffer.push(new Float32Array(data));
    this.size += data.length;
  },
```

### 2.3 录音的压缩

- wav文件为例

声道有单声道和立体声之分，采样频率一般有11025Hz（11kHz）、22050Hz（22kHz）和44100Hz（44kHz）三种。WAV文件所占容量=（采样频率×采样位数×声道）×时间/8（1字节=8bit）。

```js
function encodeWAV() {
  let sampleRate = Math.min(this.inputSampleRate, this.outputSampleRate);
  let sampleBits = Math.min(this.inputSampleBits, this.oututSampleBits);
  let bytes = this.compress();
  let dataLength = bytes.length * (sampleBits / 8);
  let buffer = new ArrayBuffer(44 + dataLength);
  let data = new DataView(buffer);

  let channelCount = 1;//单声道
  let offset = 0;

  let writeString = function (str) {
    for (let i = 0; i < str.length; i++) {
      data.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // 资源交换文件标识符
  writeString('RIFF');
  offset += 4;
  // 下个地址开始到文件尾总字节数,即文件大小-8
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
    for (let i = 0; i < bytes.length; i++, offset++) {
      let s = Math.max(-1, Math.min(1, bytes[i]));
      let val = s < 0 ? s * 0x8000 : s * 0x7FFF;
      val = parseInt(255 / (65535 / (val + 32768)));
      data.setInt8(offset, val, true);
    }
  } else {
    for (let i = 0; i < bytes.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, bytes[i]));
      data.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
  }

  return new Blob([data], {type: 'audio/wav'});
}
```

## 3. 音视频聊天

### 3.1. RTP和RTCP

一般情况下，在实时互动直播系统传输音视频数据流时，我们并不直接将音视频数据流交给 UDP 传输，而是先给音视频数据加个 RTP头，然后再交给 UDP 进行传输。

我们以视频帧为例，一个 I 帧的数据量是非常大的，最少也要几十 K。而以太网的最大传输单元是多少呢？ 1.5K，所以要传输一个 I 帧需要几十个包。并且这几十个包传到对端后，还要重新组装成 I 帧，这样才能进行解码还原出一幅幅的图像。如果是我们自己实现的话，要完成这样的过程，至少需要以下几个标识。

- **序号**：用于标识传输包的序号，这样就可以知道这个包是第几个分片了。
- **起始标记**：记录分帧的第一个 UDP 包。
- **结束标记**：记录分帧的最后一个 UDP 包。

#### 3.1.1. RTP协议

![RTP协议规范图](/Users/tangting006/tt/videodemo/images/RTP协议规范图.png)

- **sequence number**：序号，用于记录包的顺序。这与上面我们自己实现拆包、组包是同样的道理。

- **timestamp**：时间戳，同一个帧的不同分片的时间戳是相同的。不同帧的时间戳肯定不一样。

- **PT**：Payload Type，数据的负载类型。音频流的 PT 值与视频的 PT 值是不同的，通过它就可以知道这个包存放的是什么类型的数据。

#### 3.1.2. RTCP协议

在使用 RTP 包传输数据时，难免会发生丢包、乱序、抖动等问题，下面我们来看一下使用的网络一般都会在什么情况下出现问题：

- 网络线路质量问题引起丢包率高；
- 传输的数据超过了带宽的负载引起的丢包问题；
- 信号干扰（信号弱）引起的丢包问题；
- 跨运营商引入的丢包问题。

WebRTC 对这些问题在底层都有相应的处理策略，但在处理这些问题之前，它首先要让各端都知道它们自己的网络质量到底是怎样的，这就是RTCP的作用。

RTCP 有两个最重要的报文：RR（Reciever Report）和 SR(Sender Report)。通过这两个报文的交换，各端就知道自己的网络质量到底如何了。

![RTCP协议规范图](/Users/tangting006/tt/videodemo/images/RTCP协议规范图.png)

- V=2，指报文的版本。

- P，表示填充位，如果该位置 1，则在 RTCP 报文的最后会有填充字节（内容是按字节对齐的）。

- RC，全称 Report Count，指 RTCP 报文中接收报告的报文块个数。

- PT=200，Payload Type，也就是说 SR 的值为 200。

从上图中我们可以了解到，SR 报文分成三部分：Header、Sender info和report block，。在 NTP 时间戳之上的部分为 SR 报文的 header  部分，SSRC_1 字段之上到 Header 之间的部分为 sender info  部分，剩下的就是一个一个的 Report Block 了。

- Header 部分用于标识该报文的类型，比如是 SR 还是 RR。

- Sender info 部分用于指明作为发送方，到底发了多少包。

- Report block 部分指明发送方作为接收方时，它从各个 SSRC 接收包的情况。

SR报文并不仅是指发送方发了多少数据，它还报告了作为接收方，它接收到的数据的情况。当发送端收到对端的接收报告时，它就可以根据接收报告来评估它与对端之间的网络质量了，随后再根据网络质量做传输策略的调整。

比如，RTCP 类型为 206、子类型为 4 的 FIR 报文，其含义是 Full Intra Request (FIR) Command，即该报文也是一个特别关键的报文，我为什么这么说呢？试想一下，在一个房间里有 3 个人进行音视频聊天，然后又有一个人加入到房间里，这时如果不做任何处理的话，那么第四个人进入到房间后，在一段时间内很难直接看到其他三个人的视频画面了，这是为什么呢？

原因就在于解码器在解码时有一个上下文。在该上下文中，必须先拿到一个 IDR 帧之后才能将其后面的 P 帧、B 帧进行解码。也就是说，在没有 IDR 帧的情况下，对于收到的 P 帧、B 帧解码器只能干瞪眼了。

引出了 FIR 报文。当第四个人加入到房间后，它首先发送 FIR 报文，当其他端收到该报文后，便立即产生各自的 IDR 帧发送给新加入的人，这样当新加入的人拿到房间中其他的 IDR 帧后，它的解码器就会解码成功，于是其他人的画面也就一下子全部展示出来了。

### 3.2. SDP

SDP（Session Description Protocal）说直白点就是用文本描述的各端（PC 端、Mac 端、Android 端、iOS 端等）的能力。

```text
v=0
o=- 3409821183230872764 2 IN IP4 127.0.0.1
...
m=audio 9 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 110 112 113 126
...
a=rtpmap:111 opus/48000/2
a=rtpmap:103 ISAC/16000
a=rtpmap:104 ISAC/32000
...
```

如上面的 SDP 片段所示，该 SDP 中描述了一路音频流，即m=audio，该音频支持的 Payload ( 即数据负载 ) 类型包括 111、103、104 等等。

在该 SDP 片段中又进一步对 111、103、104 等 Payload 类型做了更详细的描述，如 a=rtpmap:111 opus/48000/2表示 Payload 类型为 111 的数据是 OPUS 编码的音频数据，并且它的采样率是 48000，使用双声道。以此类推，你也就可以知道 a=rtpmap:104 ISAC/32000 的含义是音频数据使用 ISAC 编码，采样频率是 32000，使用单声道。

#### 3.2.1 交换SDP信息

交换 SDP 的目的是为了让对方知道彼此具有哪些**能力**，然后根据双方各自的能力进行协商，协商出大家认可的音视频编解码器、编解码器相关的参数（如音频通道数，采样率等）、传输协议等信息。

举个例子，A 与 B 进行通讯，它们先各自在 SDP 中记录自己支持的音频参数、视频参数、传输协议等信息，然后再将自己的 SDP 信息通过信令服务器发送给对方。当一方收到对端传来的 SDP 信息后，它会将接收到的 SDP 与自己的 SDP 进行比较，并取出它们之间的交集，这个交集就是它们协商的结果，也就是它们最终使用的音视频参数及传输协议了。

#### 3.2.2 标准SDP规范

标准 SDP 规范主要包括SDP 描述格式和SDP 结构，而 SDP 结构由会话描述和媒体信息描述两个部分组成。

其中，媒体信息描述是整个 SDP 规范中最重要的知识，它又包括了：

- 媒体类型
- 媒体格式
- 传输协议
- 传输的ip和端口

#### 3.2.3  SDP格式

SDP 是由多个 <type>=<value>这样的表达式组成的。其中，<type>是一个字符，<value>是一个字符串。需要特别注意的是，“=” 两边是不能有空格的。如下所示：

```text
v=0
o=- 7017624586836067756 2 IN IP4 127.0.0.1
s=-
t=0 0
...
```

SDP 由一个会话级描述（session level description）和多个媒体级描述（media level description）组成。

- 会话级（session level）的作用域是整个会话，其位置是从 v= 行开始到第一个媒体描述为止。

- 媒体级（media level）是对单个的媒体流进行描述，其位置是从 m= 行开始到下一个媒体描述（即下一个 m=）为止。

```text
v=0
o=- 7017624586836067756 2 IN IP4 127.0.0.1
s=-
t=0 0

// 下面 m= 开头的两行，是两个媒体流：一个音频，一个视频。
m=audio 9 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 126
...
m=video 9 UDP/TLS/RTP/SAVPF 96 97 98 99 100 101 102 122 127 121 125 107 108 109 124 120 123 119 114 115 116
...
```

上面是一个特别简单的例子，每一行都是以一个字符开头，后面紧跟着等于号（=）,等于号后面是一串字符。

从“v=”开始一直到“m=audio”，这之间的描述是会话级的；而后面的两个“m=”为媒体级。从中可以看出，在该 SDP 描述中有两个媒体流，一个是音频流，另一个是视频流。

#### 3.2.4  SDP结构

由会话描述和媒体描述两部分组成。

**（1）会话描述**

会话描述的字段比较多，下面四个字段比较重要，我们来重点介绍一下。

- 第一个，v=（protocol version，必选）。例子：v=0 ，表示 SDP 的版本号，但不包括次版本号。

- 第二个，o=（owner/creator and session identifier，必选）。例子：o=<username><session id> <version> <network type> <address type> <address>，该例子是对一个会话发起者的描述。其中,

+ o= 表示的是对会话发起者的描述；

+ <username> ：用户名，当不关心用户名时，可以用 “－” 代替 ；

+ <session id> ：数字串，在整个会话中，必须是唯一的，建议使用 NTP 时间戳；

+ <version> ：版本号，每次会话数据修改后，该版本值会递增；

+ <network type> ：网络类型，一般为“IN”，表示“internet”；

+ <address type> ：地址类型，一般为 IP4；

+ <address> ：IP 地址。

- 第三个，session name，必选。例子：s=<session name>，该例子表示一个会话，在整个 SDP 中有且只有一个会话，也就是只有一个 s=。

- 第四个，t=（time the session is active，必选）。例子：t=<start time> <stop time>，该例子描述了会话的开始时间和结束时间。其中，<start time>和<stop time> 为 NTP 时间，单位是秒；当
<start time>和<stop time>均为零时，表示持久会话。

**（2）媒体描述**

媒体描述的字段也不少，下面我们也重点介绍四个。

- 第一个，m=（media name and transport address，可选），例子：m=<media> <port> <transport> <fmt list>，表示一个会话。在一个 SDP 中一般会有多个媒体描述。每个媒体描述以“m=”开始到下一个“m=”结束。其中，

+ <media>：媒体类型，比如 audio/video 等；

+ <port>：端口；

+ <transport>: 传输协议，有两种RTP/AVP和UDP；

+ <fmt list>: 媒体格式，即数据负载类型（payload type）列表。

- 第二个，a=*（zero or more media attribute lines，可选）。例子：a=<TYPE>或 a=<TYPE>:<VALUES>， 表示属性，用于进一步描述媒体信息；在例子中， 指属性的类型， a= 有两个特别的属性类型，即下面要介绍的 rtpmap 和 fmtp。

- 第三个，rtpmap（可选），例子：a=rtpmap:<payload type> <encoding name>/<clock rate>[/<encodingparameters>]

+ rtpmap 是 rtp 与 map 的结合，即 RTP 参数映射表。

+ <payload type> ：负载类型，对应 RTP 包中的音视频数据负载类型。

+ <encoding name> ：编码器名称，如 VP8、VP9、OPUS 等。

+ <sample rate> ：采样率，如音频的采样率频率 32000、48000 等。

+ <encodingparameters>：编码参数，如音频是否是双声道，默认为单声道。

- 第四个，fmtp。例子：a=fmtp:<payload type> <format specific parameters>

+ fmtp，格式参数，即 format  parameters；

+ <payload type> ，负载类型，同样对应 RTP 包中的音视频数据负载类型；

+ < format specific parameters>指具体参数。

以上就是 SDP 规范的基本内容，了解了上面这些内容后，下面我们来看一下具体的例子，你就会对它有更清楚的认知了。

```text
v=0
o=- 4007659306182774937 2 IN IP4 127.0.0.1
s=-
t=0 0 
// 以上表示会话描述
...
// 下面的媒体描述，在媒体描述部分包括音频和视频两路媒体
m=audio 9 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 110 112 113 126
...
a=rtpmap:111 opus/48000/2 // 对 RTP 数据的描述
a=fmtp:111 minptime=10;useinbandfec=1 // 对格式参数的描述
...
a=rtpmap:103 ISAC/16000
a=rtpmap:104 ISAC/32000
...
// 上面是音频媒体描述，下面是视频媒体描述
m=video 9 UDP/TLS/RTP/SAVPF 96 97 98 99 100 101 102 122 127 121 125 107 108 109 124 120 123 119 114 115 116
...
a=rtpmap:96 VP8/90000
...
```

### 3.3. RTCPeerConnection

通过offer和answer交换SDP描述符：

1. 甲和乙各自建立一个PC实例;

2. 甲通过PC所提供的createOffer()方法建立一个包含甲的SDP描述符的offer信令;

3. 甲通过PC所提供的setLocalDescription()方法，将甲的SDP描述符交给甲的PC实例;

4. 甲将offer信令通过服务器发送给乙;

5. 乙将甲的offer信令中所包含的的SDP描述符提取出来，通过PC所提供的setRemoteDescription()方法交给乙的PC实例;

6. 乙通过PC所提供的createAnswer()方法建立一个包含乙的SDP描述符answer信令;

7. 乙通过PC所提供的setLocalDescription()方法，将乙的SDP描述符交给乙的PC实例;

8. 乙将answer信令通过服务器发送给甲;

9. 甲接收到乙的answer信令后，将其中乙的SDP描述符提取出来，调用setRemoteDescripttion()方法交给甲自己的PC实例.

### 3.4. 音视频聊天

1. ClientA首先创建PeerConnection对象，然后打开本地音视频设备，将音视频数据封装成MediaStream添加到PeerConnection中。

2. ClientA调用PeerConnection的CreateOffer方法创建一个用于offer的SDP对象，SDP对象中保存当前音视频的相关参数。ClientA通过PeerConnection的SetLocalDescription方法将该SDP对象保存起来，并通过Signal服务器发送给ClientB。

3. ClientB接收到ClientA发送过的offer SDP对象，通过PeerConnection的SetRemoteDescription方法将其保存起来，并调用PeerConnection的CreateAnswer方法创建一个应答的SDP对象，通过PeerConnection的SetLocalDescription的方法保存该应答SDP对象并将它通过Signal服务器发送给ClientA。

4. ClientA接收到ClientB发送过来的应答SDP对象，将其通过PeerConnection的SetRemoteDescription方法保存起来。

5. 在SDP信息的offer/answer流程中，ClientA和ClientB已经根据SDP信息创建好相应的音频Channel和视频Channel并开启Candidate数据的收集，Candidate数据可以简单地理解成Client端的IP地址信息（本地IP地址、公网IP地址、Relay服务端分配的地址）。

6. 当ClientA收集到Candidate信息后，PeerConnection会通过OnIceCandidate接口给ClientA发送通知，ClientA将收到的Candidate信息通过Signal服务器发送给ClientB，ClientB通过PeerConnection的AddIceCandidate方法保存起来。同样的操作ClientB对ClientA再来一次。

7. 这样ClientA和ClientB就已经建立了音视频传输的P2P通道，ClientB接收到ClientA传送过来的音视频流，会通过PeerConnection的OnAddStream回调接口返回一个标识ClientA端音视频流的MediaStream对象，在ClientB端渲染出来即可。同样操作也适应ClientB到ClientA的音视频流的传输。
