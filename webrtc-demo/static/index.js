let signalingChannel, key,
  haveLocalMedia = false,
  weWaited = false,
  myVideoStream, myVideo,
  yourVideoStream, yourVideo,
  doNothing = function () {
  },
  pc, dc, data = {},
  constraints = {
    mandatory: {
      // 用于控制是否要提供到远程对等的机会尝试发送音频。如果这个值是false,远程对等不会给发送音频数据,即使局部面将发送音频数据。
      // 如果这个值是true,远程对等将发送音频数据,即使局部面不会发送音频数据。默认行为是提供接收音频只有本地端发送音频。
      OfferToReceiveAudio: true,
      OfferToReceiveVideo: true
    }
  },
  // 当 ordered 设置为真后，就可以保证数据的有序到达；而 maxRetransmits 设置为 30，则保证在有丢包的情况下可以对丢包进行重传，并且最多尝试重传 30 次。
 options = {
  ordered: true,
  maxRetransmits : 30
};

const config = [{"urls": ["stun:stunserver.org"]}];




// 自动开始获取本地媒体
window.onload = function () {
  if (queryParams && queryParams['key']) {    // 加载空白脚本中预置的queryParams参数
    document.getElementById('key').value = queryParams['key'];
    connect();
  }

  myVideo = document.getElementById('myVideo');
  yourVideo = document.getElementById('yourVideo');
  getMedia();

  // 监听快捷键
  startRecording();
  exitRecordingByEsc();
  handleSendRecording();
};

// 连接服务器并建立信令通道
function connect() {
  let callbackFun, scHandlers, handleMsg;
  // 获取连接密钥
  key = document.getElementById('key').value;
  // 处理通过信令通道收到的所有消息
  handleMsg = function (msg) {

    console.log('msg===>', msg);

    let msgE = document.getElementById('inMessages');
    let msgString = JSON.stringify(msg).replace(/\\r\\n/g, '\n');
    msgE.value = msgString + '\n' + msgE.value;    // 将最新的消息放置在最上方
    if (msg.type === 'offer') {
      pc.setRemoteDescription(new RTCSessionDescription(msg))
      answer()
    } else if (msg.type === 'answer') {
      pc.setRemoteDescription(new RTCSessionDescription(msg))
    } else if (msg.type === 'candidate') {

      // 将本地获到的 Candidate 添加到远端的 RTCPeerConnection 对象中
      pc.addIceCandidate(new RTCIceCandidate({
        sdpMLineIndex: msg.mlineindex,
        candidate: msg.candidate
      }))
    }

    // // 获得连接的统计信息
    // pc.getStats().then(
    //   reports => {
    //     reports.forEach(report => {
    //       // console.log('report===>', report);
    //     });
    //
    //   }).catch(err => {
    //   console.error(err);
    // });
    //
    //
    // const senders = pc.getSenders();
    // console.log('senders===>pc', senders);
    //
    // const receivers = pc.getReceivers();
    // console.log('receivers===>pc', receivers);
  };


  scHandlers = {
    'onWaiting': function () {
      setStatus('Waiting');
      weWaited = true
    },
    'onConnected': function () {
      setStatus('Connected');
      // 已成功连接，开始建立对等连接
      createPC()
    },
    'onMessage': handleMsg
  };

  // 创建信令通道
  signalingChannel = createSignalingChannel(key, scHandlers);
  callbackFun = function (msg) {
  };

  // 进行连接
  signalingChannel.connect(callbackFun)

}


// 通过信道发送消息
function send(msg) {
  let handler = function (res) {};
  msg = msg || document.getElementById('message').value;   // 没有消息则获取信道消息

  msgE = document.getElementById('outMessages');
  let msgString = JSON.stringify(msg).replace(/\\r\\n/g, '\n');
  msgE.value = msgString + '\n' + msgE.value;
  // 通过信令通道发送出去
  signalingChannel.send(msg, handler);
}

// 获取本地媒体
function getMedia() {
  navigator.getUserMedia({
    audio: true,
    video: true
  }, gotUserMedia, didntGetUserMedia)
}

function didntGetUserMedia() {
  console.log('could not get user media')
}

function gotUserMedia(stream) {
  myVideoStream = stream;
  haveLocalMedia = true;
  // 向我显示我的本地视频
  myVideo.srcObject = myVideoStream;
  // 等待pc创建完毕
  attachMediaIfReady()
}

// 创建对等连接，即实例化peerConnection
function createPC() {

  pc = new RTCPeerConnection({
    iceServers: config
  });

  // 只要本地代理ICE 需要通过信令服务器传递信息给其他对等端时就会触发。
  // 这让本地代理与其他对等体相协商而浏览器本身在使用时无需知道任何详细的有关信令技术的细节，只需要简单地应用这种方法就可使用您选择的任何消息传递技术将ICE候选发送到远程对等方。
  pc.onicecandidate = onIceCandidate;
  // 当远程媒体流MediaStream 添加到连接后发送事件。
  // 当RTCPeerConnection.setRemoteDescription() 后此事件立即被调用而不需要等待SDP交换完成。
  pc.onaddstream = onRemoteStreamAdded;

  pc.onremovestream = onRemoteStreamRemoved;
  pc.ondatachannel = onDataChannelAdded;
  // 等待媒体就绪
  attachMediaIfReady();
}

// 检测到浏览器一端创建了数据通道后，则调用此程序：保存数据通道，设置处理程序
// https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel
function onDataChannelAdded(e) {
  dc = e.channel;
  setupDataHandlers();  // 设置数据通道处理程序
}

// 设置数据通道消息的处理程序
function setupDataHandlers() {
  data.send = function (msg) {
    msg = JSON.stringify(msg);
    dc.send(msg)
  }
  dc.onmessage = function (e) {
    let msg = JSON.parse(e.data),
      cb = document.getElementById('chatBox');
    if (msg.chat) {
      cb.innerHTML += '<p class="receive-msg-item"> ' + msg.chat + '</p>';
    } else if (msg.voice) {
      // 语音消息渲染成一个audio，这样直接播放比较方便
      cb.innerHTML += `<p class="receive-msg-item"><audio src="${msg.voice}" controls></audio></p>`;
    } else {
      console.log('received ' + msg + ' on data channel')
    }
  }
}


// 发送常规聊天文本
function sendChat(msg) {
  let cb = document.getElementById('chatBox'),
    c = document.getElementById('chat');

  // 在本地显示消息，发送消息并强制窗口滚动到最后一行
  msg = msg || c.value;
  cb.innerHTML += '<p class="send-msg-item">' + msg + '</p>';
  if (typeof data.send !== 'function') {
    console.log('未建立连接，不能发送消息');
    return;
  }
  data.send({
    chat: msg
  });
  c.value = '';
  cb.scrollTop = cb.scrollHeight;    // 滚动底部
}


// 如果当前浏览器有另一个候选项，将其发送给对等端
function onIceCandidate(e) {
  if (e.candidate) {
    send({
      type: 'candidate',
      mlineindex: e.candidate.sdpMLineIndex,
      candidate: e.candidate.candidate
    })
  }
}

// 如果我们浏览器检测到另一端加入了媒体流，则将其显示在屏幕上
function onRemoteStreamAdded(e) {
  yourVideoStream = e.stream;
  yourVideo.srcObject = yourVideoStream;
  setStatus('On call');
}

// 远端移除流，这里不做操作
function onRemoteStreamRemoved(e) {

}

function attachMediaIfReady() {
  if (pc && haveLocalMedia) attachMedia()
}

// 将本地流添加至对等连接
function attachMedia() {
  pc.addStream(myVideoStream);
  setStatus('Ready for call');
}

// 生成一个offer
function call() {
  dc = pc.createDataChannel('chat', options);
  setupDataHandlers();
  pc.createOffer(gotDescription, doNothing, constraints);
}

// 应答会话描述，生成answer
function answer() {
  pc.createAnswer(gotDescription, doNothing, constraints);
}

// 一旦获取到了会话描述，就将其作为本地描述，然后将其发送至另一端的浏览器
function gotDescription(localDesc) {
  console.log('localDesc', localDesc);

  pc.setLocalDescription(localDesc);
  send(localDesc)
}

// 进度操作
function setStatus(str) {
  let statusLineE = document.getElementById('statusLine'),
    statusE = document.getElementById('status'),
    sendE = document.getElementById('send'),
    connectE = document.getElementById('connect'),
    callE = document.getElementById('call'),
    scMessageE = document.getElementById('scMessage');
  switch (str) {
    case 'Waiting':
      statusLineE.style.display = 'inline';
      statusE.innerHTML = '等待对等连接...';
      sendE.style.display = 'none';
      connectE.style.display = 'none';
      break;
    case 'Connected':
      statusLineE.style.display = 'inline';
      statusE.innerHTML = '对等信道已连接，等待本地媒体....';
      sendE.style.display = 'inline';
      connectE.style.display = 'none';
      scMessageE.style.display = 'inline-block';
      break;
    case 'Ready for call':
      statusE.innerHTML = '准备呼叫...';
      callE.style.display = 'inline';
      break;
    case 'On call':
      statusE.innerHTML = 'On call';
      callE.style.display = 'none';
      break;
    default:
  }
}

let audioWrapEle = document.getElementById('recordWrap');
// 是否点击了录音按钮
let clickRecordBtnFlag = false;
// 是否开始录音
let startRecordingFlag = false;
// 是否录音结束
let endRecordingFlag = false;
// 当条录音是否已发送
let handleSendFlag = false;
// 录音容器
let recorder;

// 点击语音按钮
function openAudio() {
  console.log('点击语音按钮');
  clickRecordBtnFlag = true;
  startRecordingFlag = false;
  endRecordingFlag = false;
  // 获取麦克风授权

  getTheMicrophoneAuthorization(
    function () {
      // 渲染提示
      renderAudioStartStatus();
    }
  );
}

// 获取麦克风授权
function getTheMicrophoneAuthorization(successCallback) {
  HZRecorder.get(function (rec) {
    recorder = rec;
    successCallback && successCallback(rec);
  }, function (error) {
    console.log('error===>', error);
  });
}

// 渲染提示
function renderAudioStartStatus() {
  audioWrapEle.style.display = 'block';
  audioWrapEle.innerHTML = '<div class="audio-start-tip">按住快捷键（Alt+A）说话，Esc退出</div>';
}

// 渲染麦克风
function renderMicIcon() {
  audioWrapEle.style.display = 'block';
  audioWrapEle.innerHTML = '<div class="audio-pending-icon">录音中...</div>';
}

// 快捷键开始录音 alt+a（altKey，65）
function startRecording() {
  window.addEventListener('keydown', function (e) {
    if (e.altKey && e.keyCode === 65) {
      //  只有点过语音按钮，快捷键才生效
      if (!clickRecordBtnFlag) {
        return;
      }

      // 已经开始录音，忽略
      if (startRecordingFlag) {
        return;
      }
      // 开始录音
      handleRecording();
    }
  });
}

// 开始录音
function handleRecording() {

  if (!recorder) {
    return;
  }

  recorder.start();

  startRecordingFlag = true;
  handleSendFlag = false;
  endRecordingFlag = false;
  // 渲染麦克风gif
  renderMicIcon();
}

// 快捷键退出录音 esc keyCode 27，
function exitRecordingByEsc() {
  var self = this;
  //  只有点过语音按钮，esc才生效
  window.addEventListener('keydown', function (e) {
    if (!clickRecordBtnFlag) {
      return;
    }

    if (e.keyCode === 27) {
      clickRecordBtnFlag = false;
      rebackNormalIMInput();
    }
  });
}

// 恢复im区正常输入
function rebackNormalIMInput() {
  audioWrapEle.style.display = 'none';
}

// keyup发送录音
function handleSendRecording() {
  //  只有点过语音按钮，快捷键才生效
  window.addEventListener('keyup', function (e) {

    if (!clickRecordBtnFlag) {
      return;
    }
    if (e.altKey || e.keyCode === 65 || e.keyCode === 18 || (e.altKey && e.keyCode === 65)) {
      // 分开松键盘，会产生多次事件
      if (handleSendFlag) {
        return;
      }
      handleSendFlag = true;
      // 录音结束
      recorder && recorder.stop();
      // 获取录音
      let blob = recorder.getBlob();
      let blobURL = window.URL.createObjectURL(blob);
      // 发送语音
      handleSendVoice(blobURL);
      // 发送语音完，清空录音缓存
      recorder.reset();

      // 恢复默认
      endRecordingFlag = true;
      startRecordingFlag = false;

      renderAudioStartStatus();
    }
  });
}

// 发送语音数据
function handleSendVoice(msg) {
  let cb = document.getElementById('chatBox');

  console.log('handleSendVoice-> ', msg);

  cb.innerHTML += `<p class="send-msg-item"><audio src="${msg}" controls></audio></p>`;
  if (typeof data.send !== 'function') {
    console.log('未建立连接，不能发送消息');
    return;
  }
  data.send({
    voice: msg
  });
  cb.scrollTop = cb.scrollHeight;
}