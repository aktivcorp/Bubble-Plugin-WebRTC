function(instance, context) {
  console.log('Webrtc 0.3 init', context.keys);

  window.addEventListener("orientationchange", function() {
    if (instance.data.webrtc.peerConnection != null) {
      instance.data.webrtc.stop();
      instance.publishState("orient", "changed");
    }
  });

  navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia;
  window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
  window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
  window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;

  var video = $('<video></video>');
  video.attr('autoplay',true);
  video.width(instance.canvas[0].offsetWidth+'px');
  video.height(instance.canvas[0].offsetHeight+'px');
  instance.canvas.append(video);

  instance.data.webrtc = {
    wsURL: 'wss://'+context.keys.wowza_host+'/webrtc-session.json',
    userData: {},
    localVideo: video,
    localStream: null,
    newAPI: false,
    constraints: {
      video: {
        optional: [{minWidth: 640}]
      },
      audio: true,
    },
    streamInfo: {
      applicationName: 'live',
      streamName: 'bubbleStream1',
      sessionId: "[empty]"
    },
    peerConnectionConfig: {'iceServers': []},
    wsConnection: null,

    nameIt: function(userEmail) {
      if (!userEmail) userEmail = context.currentUser.get('email');
      if (!userEmail) return;

      instance.data.webrtc.streamInfo.streamName = 's_';
      for(var i=0;i<userEmail.length;i++) {
        instance.data.webrtc.streamInfo.streamName += ''+userEmail.charCodeAt(i).toString(16);
      }
      instance.data.webrtc.streamInfo.streamName = instance.data.webrtc.streamInfo.streamName+'_'+Date.now()

      console.log("start: wsURL:"+instance.data.webrtc.wsURL+" streamInfo:"+JSON.stringify(instance.data.webrtc.streamInfo));

      var token=context.keys.records_url;
      token+=instance.data.webrtc.streamInfo.streamName+'_aac.mp4';
      instance.publishState("token",token);
      instance.data.token = instance.data.webrtc.streamInfo.streamName+'_aac.mp4';
      instance.publishState("stream",instance.data.webrtc.streamInfo.streamName);
    },

    init: function() {
      if(navigator.mediaDevices.getUserMedia)
      {
        navigator.mediaDevices.getUserMedia(instance.data.webrtc.constraints)
          .then(instance.data.webrtc.getUserMediaSuccess)
          .catch(instance.data.webrtc.errorHandler);
        instance.data.webrtc.newAPI = false;
      }
      else if (navigator.getUserMedia)
      {
        navigator.getUserMedia(
          instance.data.webrtc.constraints,
          instance.data.webrtc.getUserMediaSuccess,
          instance.data.webrtc.errorHandler
        );
      }
      else
      {
        console.error('Your browser does not support getUserMedia API');
      }
      console.log('getUserMedia start');
    },
    getUserMediaSuccess : function(stream) {
      console.log("getUserMediaSuccess: "+stream);
      instance.data.webrtc.localStream = stream;
      window.stream1 = stream;
      instance.data.webrtc.localVideo[0].srcObject = stream;
      window.element1 = instance.data.webrtc.localVideo[0];
      instance.data.webrtc.localVideo[0].play();
      instance.data.webrtc.localVideo[0].muted = true;
      instance.data.webrtc.start();
    },
    errorHandler : function(e) {
      console.log("WebRTC error", e);
    },
    start: function() {
      instance.publishState("orient", null);
      instance.data.webrtc.wsConnect(instance.data.webrtc.wsURL);
    },
    stop: function() {
      if (instance.data.webrtc.peerConnection != null) {
        instance.data.webrtc.peerConnection.close();
        instance.data.webrtc.peerConnection = null;
      }
      if (instance.data.webrtc.wsConnection != null) {
        instance.data.webrtc.wsConnection.close();
        instance.data.webrtc.wsConnection = null;
      }
      if (instance.data.webrtc.localStream) {
        if (instance.data.webrtc.localStream.getTracks()[0]) instance.data.webrtc.localStream.getTracks()[0].stop();
        if (instance.data.webrtc.localStream.getTracks()[1]) instance.data.webrtc.localStream.getTracks()[1].stop();
      }
      if (instance.data.webrtc.localVideo) {
        instance.data.webrtc.localVideo[0].srcObject = null;
      }
    },
    wsConnect: function(url) {
      instance.data.webrtc.wsConnection = new WebSocket(url);
      instance.data.webrtc.wsConnection.binaryType = 'arraybuffer';
      instance.data.webrtc.repeaterRetryCount = 0;

      instance.data.webrtc.wsConnection.onopen = function()
      {
        console.log("wsConnection.onopen");
        instance.data.webrtc.peerConnection = new RTCPeerConnection(instance.data.webrtc.peerConnectionConfig);
        instance.data.webrtc.peerConnection.onicecandidate = instance.data.webrtc.gotIceCandidate;

        if (!instance.data.webrtc.client) {
          if (instance.data.webrtc.newAPI)
          {
            var localTracks = instance.data.webrtc.localStream.getTracks();
            for(localTrack in localTracks)
            {
              instance.data.webrtc.peerConnection.addTrack(localTracks[localTrack], instance.data.webrtc.localStream);
            }
          }
          else
          {
            instance.data.webrtc.peerConnection.addStream(instance.data.webrtc.localStream);
          }

          instance.data.webrtc.peerConnection.createOffer(instance.data.webrtc.gotDescription, instance.data.webrtc.errorHandler);
        } else {
          console.log('init handlers');
          if (instance.data.webrtc.newAPI)
          {
            instance.data.webrtc.peerConnection.ontrack = instance.data.webrtc.gotTrack;
            //instance.data.webrtc.localVideo.attr('src',window.URL.createObjectURL(event.streams[0]));
          }
          else
          {
            instance.data.webrtc.peerConnection.onaddstream = instance.data.webrtc.gotStream;
            //instance.data.webrtc.localVideo.attr('src',window.URL.createObjectURL(event.stream));
          }
          instance.data.webrtc.sendGetOffer();
        }
      };
      instance.data.webrtc.gotTrack = function() {
        console.log('gotRemoteTrack: kind:'+event.track.kind+' stream:'+event.streams[0]);
        instance.data.webrtc.localVideo.attr('src',window.URL.createObjectURL(event.streams[0]));
      };
      instance.data.webrtc.gotStream = function() {
        console.log('gotRemoteStream: '+event.stream);
        instance.data.webrtc.localVideo.attr('src',window.URL.createObjectURL(event.stream));
      };
      instance.data.webrtc.wsConnection.onmessage = function(evt)
      {
        console.log("wsConnection.onmessage: "+evt.data);
        var msgJSON = JSON.parse(evt.data);

        var msgStatus = Number(msgJSON['status']);
        var msgCommand = msgJSON['command'];

        if (instance.data.webrtc.client) {
          if (msgStatus == 514 || msgStatus == 504) // repeater stream not ready
          {
            instance.data.webrtc.repeaterRetryCount++;
            if (instance.data.webrtc.repeaterRetryCount < 10) {
              setTimeout(instance.data.webrtc.sendGetOffer, instance.data.webrtc.repeaterRetryCount*500);
            }
            else {
              //stopPlay();
            }
          }
          else if (msgStatus != 200) {
            //stopPlay();
          }
          else {
            var streamInfoResponse = msgJSON['streamInfo'];
            if (streamInfoResponse !== undefined) {
              instance.data.webrtc.streamInfo.sessionId = streamInfoResponse.sessionId;
            }

            var sdpData = msgJSON['sdp'];
            if (sdpData !== undefined) {
              console.log('sdp: ' + JSON.stringify(msgJSON['sdp']));

              instance.data.webrtc.peerConnection.setRemoteDescription(new RTCSessionDescription(msgJSON.sdp), function () {
                instance.data.webrtc.peerConnection.createAnswer(instance.data.webrtc.gotDescriptionPlay, instance.data.webrtc.errorHandler);
              }, instance.data.webrtc.errorHandler);
            }

            var iceCandidates = msgJSON['iceCandidates'];
            if (iceCandidates !== undefined) {
              for (var index in iceCandidates) {
                console.log('iceCandidates: ' + JSON.stringify(iceCandidates[index]));
                instance.data.webrtc.peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidates[index]));
              }
            }
          }

          if ('sendResponse'.localeCompare(msgCommand) == 0) {
            if (instance.data.webrtc.wsConnection != null)
              instance.data.webrtc.wsConnection.close();
            instance.data.webrtc.wsConnection = null;
          }
        } else {
          if (msgStatus != 200)
          {
            //stopPublisher();
          }
          else
          {
            var sdpData = msgJSON['sdp'];
            if (sdpData !== undefined)
            {
              console.log('sdp: '+msgJSON['sdp']);

              instance.data.webrtc.peerConnection.setRemoteDescription(new RTCSessionDescription(sdpData), function() {
                //peerConnection.createAnswer(gotDescription, errorHandler);
              }, instance.data.webrtc.errorHandler);
            }

            var iceCandidates = msgJSON['iceCandidates'];
            if (iceCandidates !== undefined)
            {
              for(var index in iceCandidates)
              {
                console.log('iceCandidates: '+iceCandidates[index]);

                instance.data.webrtc.peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidates[index]));
              }
            }
          }


          if (instance.data.webrtc.wsConnection != null)
            instance.data.webrtc.wsConnection.close();
          instance.data.webrtc.wsConnection = null;
        }
      };

      instance.data.webrtc.wsConnection.onclose = function()
      {
        console.log("wsConnection.onclose");
      };

      instance.data.webrtc.wsConnection.onerror = function(evt)
      {
        console.log("wsConnection.onerror: "+JSON.stringify(evt));
      };
    },
    sendGetOffer: function() {
      console.log("sendGetOffer: "+JSON.stringify(instance.data.webrtc.streamInfo));
      instance.data.webrtc.wsConnection.send('{"direction":"play", "command":"getOffer", "streamInfo":'+JSON.stringify(instance.data.webrtc.streamInfo)+', "userData":'+JSON.stringify(instance.data.webrtc.userData)+'}');
    },
    gotIceCandidate: function(event) {
      if(event.candidate != null)
      {
        console.log('gotIceCandidate: '+JSON.stringify({'ice': event.candidate}));
      }
    },
    gotDescriptionPlay: function(description)
    {
      console.log('gotDescription');
      instance.data.webrtc.peerConnection.setLocalDescription(description, function ()
      {
        console.log('sendAnswer');

        instance.data.webrtc.wsConnection.send('{"direction":"play", "command":"sendResponse", "streamInfo":'+JSON.stringify(instance.data.webrtc.streamInfo)+', "sdp":'+JSON.stringify(description)+', "userData":'+JSON.stringify(instance.data.webrtc.userData)+'}');

      }, function() {console.log('set description error')});
    },
    gotDescription: function(description) {
      var enhanceData = new Object();

      enhanceData.audioBitrate = instance.data.audioBitrate;
      enhanceData.videoBitrate = instance.data.videoBitrate;
      enhanceData.videoFrameRate = instance.data.videoFrameRate;

      description.sdp = instance.data.webrtc.enhanceSDP(description.sdp, enhanceData);

      console.log('gotDescription: '+JSON.stringify({'sdp': description}));

      instance.data.webrtc.peerConnection.setLocalDescription(description, function () {
        instance.data.webrtc.wsConnection.send('{"direction":"publish", "command":"sendOffer", "streamInfo":'+JSON.stringify(instance.data.webrtc.streamInfo)+', "sdp":'+JSON.stringify(description)+', "userData":'+JSON.stringify(instance.data.webrtc.userData)+'}');
      }, function() {console.log('set description error')});
    },
    enhanceSDP: function(sdpStr, enhanceData) {
      var sdpLines = sdpStr.split(/\r\n/);
      var sdpSection = 'header';
      var hitMID = false;
      var sdpStrRet = '';

      for(var sdpIndex in sdpLines)
      {
        var sdpLine = sdpLines[sdpIndex];

        if (sdpLine.length <= 0)
          continue;

        sdpStrRet += sdpLine;

        if (sdpLine.indexOf("m=audio") === 0)
        {
          sdpSection = 'audio';
          hitMID = false;
        }
        else if (sdpLine.indexOf("m=video") === 0)
        {
          sdpSection = 'video';
          hitMID = false;
        }
        else if (sdpLine.indexOf("a=rtpmap") == 0 )
        {
          sdpSection = 'bandwidth';
          hitMID = false;
        }

        if (sdpLine.indexOf("a=mid:") === 0 || sdpLine.indexOf("a=rtpmap") == 0 )
        {
          if (!hitMID)
          {
            if ('audio'.localeCompare(sdpSection) == 0)
            {
              if (enhanceData.audioBitrate !== undefined)
              {
                sdpStrRet += '\r\nb=CT:' + (enhanceData.audioBitrate);
                sdpStrRet += '\r\nb=AS:' + (enhanceData.audioBitrate);
              }
              hitMID = true;
            }
            else if ('video'.localeCompare(sdpSection) == 0)
            {
              if (enhanceData.videoBitrate !== undefined)
              {
                sdpStrRet += '\r\nb=CT:' + (enhanceData.videoBitrate);
                sdpStrRet += '\r\nb=AS:' + (enhanceData.videoBitrate);
                if ( enhanceData.videoFrameRate !== undefined )
                {
                  sdpStrRet += '\r\na=framerate:'+enhanceData.videoFrameRate;
                }
              }
              hitMID = true;
            }
            else if ('bandwidth'.localeCompare(sdpSection) == 0 )
            {
              var rtpmapID;
              var findid = new RegExp('a=rtpmap:(\\d+) (\\w+)/(\\d+)');
              var found = sdpLine.match(findid);
              rtpmapID = (found && found.length >= 3) ? found: null;
              if ( rtpmapID !== null  )
              {
                var match = rtpmapID[2].toLowerCase();
                if ( ('vp9'.localeCompare(match) == 0 ) ||  ('vp8'.localeCompare(match) == 0 ) || ('h264'.localeCompare(match) == 0 ) ||
                  ('red'.localeCompare(match) == 0 ) || ('ulpfec'.localeCompare(match) == 0 ) || ('rtx'.localeCompare(match) == 0 ) )
                {
                  if (enhanceData.videoBitrate !== undefined)
                  {
                    sdpStrRet+='\r\na=fmtp:'+rtpmapID[1]+' x-google-min-bitrate='+(enhanceData.videoBitrate)+';x-google-max-bitrate='+(enhanceData.videoBitrate);
                  }
                }

                if ( ('opus'.localeCompare(match) == 0 ) ||  ('isac'.localeCompare(match) == 0 ) || ('g722'.localeCompare(match) == 0 ) || ('pcmu'.localeCompare(match) == 0 ) ||
                  ('pcma'.localeCompare(match) == 0 ) || ('cn'.localeCompare(match) == 0 ))
                {
                  if (enhanceData.videoBitrate !== undefined)
                  {
                    sdpStrRet+='\r\na=fmtp:'+rtpmapID[1]+' x-google-min-bitrate='+(enhanceData.audioBitrate)+';x-google-max-bitrate='+(enhanceData.audioBitrate);
                  }
                }
              }
            }
          }
        }
        sdpStrRet += '\r\n';
      }
      return sdpStrRet;
    }
  };

}