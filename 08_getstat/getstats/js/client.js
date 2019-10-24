'use strict';

// Define peer connections, streams and video elements.
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

let localStream;
let remoteStream;

let localPeerConnection;
let remotePeerConnection;

let bitrateGraph;
let bitrateSeries;

let packetGraph;
let packetSeries;

let lastResult;

//set constraints
const mediaStreamConstraints = {
  video: true,
};

// Set up to exchange only video.
const offerOptions = {
  offerToReceiveVideo: 1,
};

// Sets the MediaStream as the video element src.
function gotLocalMediaStream(mediaStream) {
  localVideo.srcObject = mediaStream;
  localStream = mediaStream;
  trace('Received local stream.');
  callButton.disabled = false;  // Enable call button.

	bitrateSeries = new TimelineDataSeries();
	bitrateGraph = new TimelineGraphView('bitrateGraph', 'bitrateCanvas');
	bitrateGraph.updateEndDate();

	packetSeries = new TimelineDataSeries();
	packetGraph = new TimelineGraphView('packetGraph', 'packetCanvas');
	packetGraph.updateEndDate();
}

// Handles error by logging a message to the console.
function handleLocalMediaStreamError(error) {
  trace(`navigator.getUserMedia error: ${error.toString()}.`);
}

// Handles remote MediaStream success by adding it as the remoteVideo src.
function gotRemoteMediaStream(event) {
  const mediaStream = event.stream;
  remoteVideo.srcObject = mediaStream;
  remoteStream = mediaStream;
  trace('Remote peer connection received remote stream.');
}

// Connects with new peer candidate.
function handleConnection(event) {
  const peerConnection = event.target;
  const iceCandidate = event.candidate;

  if (iceCandidate) {
    const newIceCandidate = new RTCIceCandidate(iceCandidate);
    const otherPeer = getOtherPeer(peerConnection);

    otherPeer.addIceCandidate(newIceCandidate)
      .then(() => {
        handleConnectionSuccess(peerConnection);
      }).catch((error) => {
        handleConnectionFailure(peerConnection, error);
      });

    trace(`${getPeerName(peerConnection)} ICE candidate:\n` +
          `${event.candidate.candidate}.`);
  }
}

// Logs that the connection succeeded.
function handleConnectionSuccess(peerConnection) {
  trace(`${getPeerName(peerConnection)} addIceCandidate success.`);
};

// Logs that the connection failed.
function handleConnectionFailure(peerConnection, error) {
  trace(`${getPeerName(peerConnection)} failed to add ICE Candidate:\n`+
        `${error.toString()}.`);
}

// Logs changes to the connection state.
function handleConnectionChange(event) {
  const peerConnection = event.target;
  console.log('ICE state change event: ', event);
  trace(`${getPeerName(peerConnection)} ICE state: ` +
        `${peerConnection.iceConnectionState}.`);
}

// Logs error when setting session description fails.
function setSessionDescriptionError(error) {
  trace(`Failed to create session description: ${error.toString()}.`);
}

// Logs success when setting session description.
function setDescriptionSuccess(peerConnection, functionName) {
  const peerName = getPeerName(peerConnection);
  trace(`${peerName} ${functionName} complete.`);
}

// Logs success when localDescription is set.
function setLocalDescriptionSuccess(peerConnection) {
  setDescriptionSuccess(peerConnection, 'setLocalDescription');
}

// Logs success when remoteDescription is set.
function setRemoteDescriptionSuccess(peerConnection) {
  setDescriptionSuccess(peerConnection, 'setRemoteDescription');
}

// Logs offer creation and sets peer connection session descriptions.
function createdOffer(description) {
  trace(`Offer from localPeerConnection:\n${description.sdp}`);

  trace('localPeerConnection setLocalDescription start.');
  localPeerConnection.setLocalDescription(description)
    .then(() => {
      setLocalDescriptionSuccess(localPeerConnection);
    }).catch(setSessionDescriptionError);

  trace('remotePeerConnection setRemoteDescription start.');
  remotePeerConnection.setRemoteDescription(description)
    .then(() => {
      setRemoteDescriptionSuccess(remotePeerConnection);
    }).catch(setSessionDescriptionError);

  trace('remotePeerConnection createAnswer start.');
  remotePeerConnection.createAnswer()
    .then(createdAnswer)
    .catch(setSessionDescriptionError);
}

// Logs answer to offer creation and sets peer connection session descriptions.
function createdAnswer(description) {
  trace(`Answer from remotePeerConnection:\n${description.sdp}.`);

  trace('remotePeerConnection setLocalDescription start.');
  remotePeerConnection.setLocalDescription(description)
    .then(() => {
      setLocalDescriptionSuccess(remotePeerConnection);
    }).catch(setSessionDescriptionError);

  trace('localPeerConnection setRemoteDescription start.');
  localPeerConnection.setRemoteDescription(description)
    .then(() => {
      setRemoteDescriptionSuccess(localPeerConnection);
    }).catch(setSessionDescriptionError);
}


// Define and add behavior to buttons.

// Define action buttons.
const startButton = document.getElementById('startButton');
const callButton = document.getElementById('callButton');
const hangupButton = document.getElementById('hangupButton');

// Set up initial action buttons status: disable call and hangup.
callButton.disabled = true;
hangupButton.disabled = true;


// Handles start button action: creates local MediaStream.
function startAction() {
  startButton.disabled = true;
  navigator.mediaDevices.getUserMedia(mediaStreamConstraints)
    .then(gotLocalMediaStream).catch(handleLocalMediaStreamError);
  trace('Requesting local stream.');
}

// Handles call button action: creates peer connection.
function callAction() {
  callButton.disabled = true;
  hangupButton.disabled = false;

  trace('Starting call.');

  // Get local media stream tracks.
  const videoTracks = localStream.getVideoTracks();
  const audioTracks = localStream.getAudioTracks();
  if (videoTracks.length > 0) {
    trace(`Using video device: ${videoTracks[0].label}.`);
  }
  if (audioTracks.length > 0) {
    trace(`Using audio device: ${audioTracks[0].label}.`);
  }

  const servers = null;  // Allows for RTC server configuration.

  // Create peer connections and add behavior.
  localPeerConnection = new RTCPeerConnection(servers);
  trace('Created local peer connection object localPeerConnection.');

  localPeerConnection.addEventListener('icecandidate', handleConnection);
  localPeerConnection.addEventListener(
    'iceconnectionstatechange', handleConnectionChange);

  remotePeerConnection = new RTCPeerConnection(servers);
  trace('Created remote peer connection object remotePeerConnection.');

  remotePeerConnection.addEventListener('icecandidate', handleConnection);
  remotePeerConnection.addEventListener(
    'iceconnectionstatechange', handleConnectionChange);
  remotePeerConnection.addEventListener('addstream', gotRemoteMediaStream);

  // Add local stream to connection and create offer to connect.
  localPeerConnection.addStream(localStream);
  trace('Added local stream to localPeerConnection.');

  trace('localPeerConnection createOffer start.');
  localPeerConnection.createOffer(offerOptions)
    .then(createdOffer).catch(setSessionDescriptionError);
}

// Handles hangup action: ends up call, closes connections and resets peers.
function hangupAction() {
  localPeerConnection.close();
  remotePeerConnection.close();
  localPeerConnection = null;
  remotePeerConnection = null;
  hangupButton.disabled = true;
  callButton.disabled = false;
  trace('Ending call.');
}

// Add click event handlers for buttons.
startButton.addEventListener('click', startAction);
callButton.addEventListener('click', callAction);
hangupButton.addEventListener('click', hangupAction);


// Define helper functions.

// Gets the "other" peer connection.
function getOtherPeer(peerConnection) {
  return (peerConnection === localPeerConnection) ?
      remotePeerConnection : localPeerConnection;
}

// Gets the name of a certain peer connection.
function getPeerName(peerConnection) {
  return (peerConnection === localPeerConnection) ?
      'localPeerConnection' : 'remotePeerConnection';
}

// Logs an action (text) and the time when it happened on the console.
function trace(text) {
  text = text.trim();
  const now = (window.performance.now() / 1000).toFixed(3);

  console.log(now, text);
}

window.setInterval( ()=>{

	if(!localPeerConnection){
		return;	
	}

	var sender = localPeerConnection.getSenders()[0];
	if(!sender){
		return;	
	}

	sender.getStats()
		.then(reports => {
			reports.forEach(report =>{
        console.log('report===>',report);

        // bytesReceived: 2230
        // bytesSent: 225484
        // dtlsState: "connected"
        // id: "RTCTransport_0_1"
        // localCertificateId: "RTCCertificate_43:77:E8:C3:11:DF:75:37:79:DA:4F:05:45:CF:26:11:85:23:D8:65:20:73:32:88:A0:22:C3:12:43:AC:6F:B3"
        // remoteCertificateId: "RTCCertificate_BF:23:45:4A:BF:09:1A:9B:1D:56:55:A7:55:FF:49:8E:C8:0C:70:28:39:78:A5:99:52:46:B8:EE:20:C4:7F:ED"
        // selectedCandidatePairId: "RTCIceCandidatePair_5DNO6uPe_e72hTo34"
        // timestamp: 1567145551605.261
        // type: "transport"

        // framesPerSecond: 30
        // height: 720
        // id: "RTCVideoSource_1"
        // kind: "video"
        // timestamp: 1567145551605.261
        // trackIdentifier: "ae18bdcd-3587-40d0-b7e5-e0005bb25f0f"
        // type: "media-source"
        // width: 1280

        // base64Certificate: "MIIBFzCBvaADAgECAgkA6zc3rSg9NC8wCgYIKoZIzj0EAwIwETEPMA0GA1UEAwwGV2ViUlRDMB4XDTE5MDgyOTA2MTIyOVoXDTE5MDkyOTA2MTIyOVowETEPMA0GA1UEAwwGV2ViUlRDMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEDeZbHZ4GhKJ8x+GiaptDay1qzbX1ZkOAouRryPh7H8nBpDAFJm/Gp41Fw+lPCfEBWjnITdn651HWqh/+EbrtazAKBggqhkjOPQQDAgNJADBGAiEA79IrIhhXfG+3wC180Y6IjpWv3dFaAutWBq9TFsI2j2ACIQDIGPx7NWl3AOPZidMUdEhVBy7cK2+Dt5leKMgYEug1Eg=="
        // fingerprint: "BF:23:45:4A:BF:09:1A:9B:1D:56:55:A7:55:FF:49:8E:C8:0C:70:28:39:78:A5:99:52:46:B8:EE:20:C4:7F:ED"
        // fingerprintAlgorithm: "sha-256"
        // id: "RTCCertificate_BF:23:45:4A:BF:09:1A:9B:1D:56:55:A7:55:FF:49:8E:C8:0C:70:28:39:78:A5:99:52:46:B8:EE:20:C4:7F:ED"
        // timestamp: 1567145552607.635
        // type: "certificate"

        // clockRate: 90000
        // id: "RTCCodec_0_Outbound_96"
        // mimeType: "video/VP8"
        // payloadType: 96
        // timestamp: 1567145552607.635
        // type: "codec"

        // availableOutgoingBitrate: 3123200
        // bytesReceived: 3274
        // bytesSent: 397684
        // consentRequestsSent: 4
        // currentRoundTripTime: 0.001
        // id: "RTCIceCandidatePair_5DNO6uPe_e72hTo34"
        // localCandidateId: "RTCIceCandidate_5DNO6uPe"
        // nominated: true
        // priority: 9115038255631187000
        // remoteCandidateId: "RTCIceCandidate_e72hTo34"
        // requestsReceived: 5
        // requestsSent: 1
        // responsesReceived: 5
        // responsesSent: 5
        // state: "succeeded"
        // timestamp: 1567145552607.635
        // totalRoundTripTime: 0.006
        // transportId: "RTCTransport_0_1"
        // type: "candidate-pair"
        // writable: true




				if(report.type === 'outbound-rtp'){
					if(report.isRemote){
						return;	
					}

					var curTs = report.timestamp;
					var bytes = report.bytesSent;
					var packets = report.packetsSent;

					if(lastResult && lastResult.has(report.id)){
            var lastBytes = lastResult.get(report.id).bytesSent;
            var lastTs = lastResult.get(report.id).timestamp;
						var bitrate = 8 * (bytes - lastBytes)/(curTs - lastTs)*1000;	
					
						bitrateSeries.addPoint(curTs, bitrate);
						bitrateGraph.setDataSeries([bitrateSeries]);
						bitrateGraph.updateEndDate();

						packetSeries.addPoint(curTs, packets - lastResult.get(report.id).packetsSent);
						packetGraph.setDataSeries([packetSeries]);
						packetGraph.updateEndDate();

					}
				
				}
			
			});
			lastResult = reports;
		
		})
		.catch(err=>{
			console.error(err);
		});

}, 1000);
