function(instance, properties, context) {
	instance.data.videoBitrate = parseInt(properties.videoBitrate);	
  	instance.data.audioBitrate = instance.data.videoBitrate/10;    
    instance.data.videoFrameRate = 30;
}