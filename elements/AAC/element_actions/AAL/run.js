function(instance, properties, context) {
    if (properties.usersEmail) {
        instance.data.webrtc.nameIt(properties.usersEmail);
	}
	instance.data.webrtc.init();
}