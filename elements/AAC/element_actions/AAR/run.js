function(instance, properties, context) {

/*  var xhr = new XMLHttpRequest();

  var body = 'filename=' + encodeURIComponent(instance.data.token);

  xhr.open("POST", 'https://bubble.finassessment.com/web/index.php', true)

  xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')

  xhr.send(body);*/
  
  instance.publishState("token",null);
  instance.publishState("stream",null);
  instance.publishState("orient",null);
}