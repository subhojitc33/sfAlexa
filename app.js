/* GLOBAL / PROCESS VARIABLES */
var port = process.env.PORT || 8080;
var clientId = process.env.SF_CLIENT_ID;
var clientSecret = process.env.SF_CLIENT_SECRET;
var redirectURI = process.env.SF_REDIRECT_URI;
var API = process.env.API || 'v32.0';
var oauth_timeout = process.env.oauth_timeout || 5400;
var DEBUG_ON = process.env.DEBUG_ON || true;
var username=process.env.SF_USER_NAME;
var password=process.env.SF_PASSWORD;
var initialCommand=process.env.ALEXA_INT_CMD;
var stage={"Name":"","description":"","casetype":"","casepriority":""};

/* REQUIRED PACKAGES */

//alexa response transform
var alexa = require('alexa-nodekit');

//express for routing
var express = require('express');
var app = express();
var bodyParser = require("body-parser");
app.use(bodyParser());


//convert OAuth requests to/from Salesforce to Amazon
var sfdc_amazon = require('sfdc-oauth-amazon-express');

//Salesforce REST wrapper
var nforce = require('nforce'),
    chatter =require('nforce-chatter')(nforce);

//Connected App credentials for OAUTH request
var org = nforce.createConnection({
  clientId: clientId,
  clientSecret: clientSecret,
  redirectUri: redirectURI,
  apiVersion: API, 
  mode: 'single',
  plugins: ['chatter']
});

/* SETUP ROUTES */

app.get('/', function (req, res) {
  res.jsonp({status: 'running'});
});

app.post('/echo', function (req, res) {
  if(req.body == null) {
        console.log("WARN: No Post Body Detected");
   }
  if(req.body.request.intent == null) {
    route_alexa_begin(req,res);
  } else {
    route_alexa_intent(req,res);
  }
});

sfdc_amazon.addRoutes(app,oauth_timeout,true);

/* List of identifiable intent / actions that the route will respond to */
var intent_functions = new Array();
intent_functions['PleaseWait'] = PleaseWait;
intent_functions['GetCurrentCase'] = GetCurrentCase;
intent_functions['GetLatestCases'] = GetLatestCases;
intent_functions['OpenCase'] = OpenCase;
intent_functions['UpdateCase'] = UpdateCase;
intent_functions['AddPost'] = AddPost;
intent_functions['PredictImage'] = PredictImage;
intent_functions['PredictImageWatson'] = PredictImageWatson;
intent_functions['CreateCase'] = createCase;
intent_functions['ProcessCaseInput'] = ProcessCaseInput;
intent_functions['AnalyseSentiment'] = AnalyseSentiment;
intent_functions['OCRImage'] = OCRImage;
function PleaseWait(req,res,intent) {
  send_alexa_response(res, 'Waiting', 'Salesforce', '...', 'Waiting', false);
}

function GetCurrentCase(req,res,intent) {
	org.authenticate({ username: username, password: password}, function(err2, resp){
	console.log(org.oauth.instance_url+'####'+org.oauth);
		var oauth=resp;
		org.oauth=resp;
	org.apexRest({oauth:oauth, uri:'EchoCaseControl'},
		function(err,result) {
			if(err) {
              console.log(err);
              send_alexa_error(res,'An error occured checking for recents cases: '+err);
            }
            else {
            	var speech = "Here is your currently opened case:";
	    	      speech += 'Subject ';
	              speech += '. .';
	              speech += result.Subject;
	              speech += '. .';
	              speech += 'Priority ';
	              speech += '. .';
	              speech += result.Priority;
	              speech += '. .';
	              speech += 'Status ';
	              speech += '. .';
	              speech += result.Status;
	              speech += '. .';
                 send_alexa_response(res, speech, 'Salesforce', 'Get Current Case', 'Success', false);
            }

		});
	});	
}


function GetLatestCases(req,res,intent) {
	org.authenticate({ username: username, password: password}, function(err2, resp){
	console.log(org.oauth.instance_url+'####'+org.oauth);
		var oauth=resp;
		org.oauth=resp;
	org.apexRest({oauth:oauth, uri:'EchoCaseSearch'},
		function(err,result) {
			if(err) {
              console.log(err);
              send_alexa_error(res,'An error occured checking for recents cases: '+err);
            }
            else {
            	var speech = "Here are your latest cases. ";
            	/*for(var i = 0; i < result.length; i++) {
                      speech += 'Case Number ';
                      speech += i+1;
                      speech += '. .';
                      speech += result[i].Subject__c;
                      speech += '. .';
                      if(i != result.length-1) {speech += 'Next case,'};
                    }*/
                    send_alexa_response(res, speech, 'Salesforce', 'Get Latest Cases', 'Success', false);
            }

		});
	});	
}

function UpdateCase(req,res,intent) {
	org.authenticate({ username: username, password: password}, function(err2, resp){
	console.log(org.oauth.instance_url+'####'+org.oauth);
		var oauth=resp;
		org.oauth=resp;
	var update = intent.slots.update.value;
    update = update.charAt(0).toUpperCase() + update.slice(1);
    console.log("UPDATE REQUEST>>>>> "+update);

    if(update == 'Hi') { update = 'High'; } //really, Alexa?
    if(update == 'Close') { update = 'Closed'; } //really, Alexa?

    if(update == 'Low' || update == 'Medium' || update == 'High') {
            org.apexRest({oauth:oauth, uri:'EchoCaseControl',method:'POST',body:'{"priority":"'+update+'"}'},
            	function(err,result) {
					if(err) {
		              console.log(err);
		              send_alexa_error(res,'An error occured updating this case: '+err);
		            }
		            else {
		            	var speech = 'Updated Case with a priority of '+update;
		            	send_alexa_response(res, speech, 'Salesforce', 'Updated Case', 'Success', false);
		            }

				});
	  
     }  

    else if(update == 'Closed' || update == 'New' || update == 'Working' || update == 'Escalated') {
              org.apexRest({oauth:oauth, uri:'EchoCaseControl',method:'POST',body:'{"status":"'+update+'"}'},
            	function(err,result) {
					if(err) {
		              console.log(err);
		              send_alexa_error(res,'An error occured updating this case: '+err);
		            }
		            else {
		            	var speech = 'Updated Case with a status of '+update;
		            	send_alexa_response(res, speech, 'Salesforce', 'Updated Case', 'Success', false);
		            }

				});
     } 

     else {

     	send_alexa_response(res, 'The update request did not hold a valid priority or update', 'Salesforce', 'Updated Case', 'Failed', false);

     }
		});
}

function OpenCase(req,res,intent) {
	org.authenticate({ username: username, password: password}, function(err2, resp){
	console.log(org.oauth.instance_url+'####'+org.oauth);
		var oauth=resp;
		org.oauth=resp;
	var number = intent.slots.number.value;
	number = number.toString();
	console.log("CASE IDENTIFIER>>>>>"+number);
    org.apexRest({oauth:oauth, uri:'EchoCaseSearch',method:'POST',body:'{"CaseIdentifier":"'+number+'"}'},
		function(err,result) {
			if(err) {
              console.log(err);
              send_alexa_error(res,'An error occured checking for recents cases: '+err);
            }
            else {
            	var speech = 'Opened Case '+result.Subject__c;
            	send_alexa_response(res, speech, 'Salesforce', 'Open Case', 'Success', false);
            }

		});
		});
}
function AnalyseSentiment(req,res,intent) {
	org.authenticate({ username: username, password: password}, function(err2, resp){
	console.log(org.oauth.instance_url+'####'+org.oauth);
		var oauth=resp;
		org.oauth=resp;
	var number = intent.slots.number.value;
	number = number.toString();
	console.log("CASE IDENTIFIER>>>>>"+number);
    org.apexRest({oauth:oauth, uri:'WatsonAnalysis',method:'POST',body:'{"CaseIdentifier":"'+number+'"}'},
		function(err,result) {
			if(err) {
              console.log(err);
              send_alexa_error(res,'An error occured checking for recents cases: '+err);
            }
            else {
            	var speech = 'Emotional Sentiment of the case is  '+result.emotionaltone;
            	send_alexa_response(res, speech, 'Salesforce', 'Open Case', 'Success', false);
            }

		});
		});
}



function AddPost(req,res,intent) {
	org.authenticate({ username: username, password: password}, function(err2, resp){
	console.log(org.oauth.instance_url+'####'+org.oauth);
		var oauth=resp;
		org.oauth=resp;
		var post = intent.slots.post.value;
    	console.log("CHATTER POST>>>>"+post);
    	org.apexRest({oauth:oauth, uri:'EchoCaseSearch',method:'POST',body:'{"CaseIdentifier":null}'},
		function(err,result) {
			if(err) {
              console.log(err);
              send_alexa_error(res,'An error occured checking for recents cases: '+err);
            }
            else {
          		  
          		  if(post == 'follow up') {
		            post = 'We need to follow up with the customer';
		          }

		          if(post == 'next' || post == 'next meeting') {
		            post = 'This needs to be prioritized at the next meeting';
		          }

		          if(post == 'cannot replicate') {
		            post = 'I cannot replicate this issue with the current information';
		          }

		          if(post == 'missing info') {
		            post = 'This case is incomplete, we need more information';
		          }

		          
		          org.chatter.postFeedItem({id: result.Case__c, text: post, oauth: intent.oauth}, function(err, resp) {
		              if(err) {
		                console.log(err);
		                send_alexa_error(res,'An error occured posting to Chatter: '+err);
		              } else {
		                send_alexa_response(res, 'Posted to Chatter', 'Salesforce', 'Post to Chatter', 'Posted to Chatter: '+post, false);
		              }
		          });


            }

		});  
	});
}


//setup actual server
var server = app.listen(port, function () {

  console.log('Salesforce Case Echo running on '+port);
  require('dns').lookup(require('os').hostname(), function (err, add, fam) {
    console.log('addr: '+add);
  });

});




/* UTILIY FUNCTIONS */
function send_alexa_error(res,message) {

	send_alexa_response(res, 'An error occured during that request.  Please see the app log.', 'Salesforce', 'Error', message, true);

}

function send_alexa_response(res, speech, title, subtitle, content, endSession) {
    alexa.response(speech, 
           {
            title: title,
            subtitle: subtitle,
            content: content
           }, endSession, function (error, response) {
           if(error) {
             console.log({message: error});
             return res.status(400).jsonp({message: error});
           }
           return res.jsonp(response);
         });
}


function route_alexa_begin(req, res) {
   
   alexa.launchRequest(req.body);
/*   if(req.body.session == null || req.body.session.user == null || req.body.session.user.accessToken == null) {
        send_alexa_response(res, 'Please log into Salesforce', 'Salesforce', 'Not Logged In', 'Error: Not Logged In', true);
   } else*/ {
   		send_alexa_response(res, initialCommand,  'Salesforce', 'Connection Attempt', 'Logged In (Single User)', false);
   }
   
   console.log('!----REQUEST SESSION--------!');
   console.log(req.body.session);
   

};


function route_alexa_intent(req, res) {

 /*  if(req.body.session == null || req.body.session.user == null || req.body.session.user.accessToken == null) {
        send_alexa_response(res, 'Please log into Salesforce', 'Salesforce', 'Not Logged In', 'Error: Not Logged In', true);
   } else*/ {
   	   intent = new alexa.intentRequest(req.body);
	   intent.oauth = sfdc_amazon.splitToken(req.body.session.user.accessToken);
	   console.log("INTENT>>>"+intent.intentName);
	   console.log("USERID>>>>"+req.body.session.user.userId);
           
	   intent_function = intent_functions[intent.intentName];
	  
	   intent_function(req,res,intent);
	  
   }
}
function createCase(req,res,intent){
		console.log('In Creae Case');
		var speech = "Lets Create a Case in smart way";
		speech+='. .';
		speech+='Please tell me the description of the case';
		stage.Name='ask_casedescription';
		send_alexa_response(res, speech, 'Salesforce', 'Create Case Stage 1', 'Success', false);
	console.log('Done In Creae Case');
	
}
function ProcessCaseInput(req,res,intent){
	console.log(stage);
	if(stage.Name=='ask_casedescription'){
		var speech = "Please tell me the case priority";
		
		stage.description=intent.slots.inputcasedetails.value;
		stage.Name='ask_casepriority';
		send_alexa_response(res, speech, 'Salesforce', 'Create Case Stage 2', 'Success', false);
	}
	else if(stage.Name=='ask_casepriority'){
		var speech = "Please tell me the case Type";
		
		stage.casepriority=intent.slots.inputcasedetails.value;
		stage.Name='ask_caseptype';
		send_alexa_response(res, speech, 'Salesforce', 'Create Case Stage 3', 'Success', false);
	}
	else if(stage.Name=='ask_caseptype'){
		var speech = "Do you want to create a case ?";
		
		stage.casetype=intent.slots.inputcasedetails.value;
		stage.Name='ask_caseconfirm';
		send_alexa_response(res, speech, 'Salesforce', 'Create Case Stage 4', 'Success', false);
	}
	else if(stage.Name=='ask_caseconfirm'){
		var responsevar=intent.slots.inputcasedetails.value;
		if(responsevar=='yes' || responsevar=='yup' || responsevar=='yeh'){
		 org.authenticate({ username: username, password: password}, function(err2, resp){
		console.log(org.oauth.instance_url+'####'+org.oauth);
			var oauth=resp;
			org.oauth=resp;
		
		var casevar = nforce.createSObject('Case');
		casevar.set('Status', 'New');
		casevar.set('Priority', stage.casepriority);
		casevar.set('Type', stage.casetype);	 
		casevar.set('Description', stage.description);	 
		org.insert({oauth:oauth, sobject:casevar},	function(err,result) {
		  if(err) {
		                console.log(err);
		                send_alexa_error(res,'Error Occored During case creation '+err);
		              } else {
				      console.log(result);
				     
							   send_alexa_response(res, 'Case Created', 'Salesforce', 'Case Created', 'Case Created  ', false);
						stage={"Name":"","description":"","casetype":"","casepriority":""};
						;
			     
		               
		              }	
			
		});
			     });
			
		}
		
	}
	}
function OCRImage(req,res,intent) {
	org.authenticate({ username: username, password: password}, function(err2, resp){
	console.log(org.oauth.instance_url+'####'+org.oauth);
		var oauth=resp;
		org.oauth=resp;
	org.apexRest({oauth:oauth, uri:'OCRImage'},
		function(err,result) {
			if(err) {
              console.log(err);
              send_alexa_error(res,'An error occured during Image Prediction: '+err);
            }
            else {
            	var speech = " Your OCR Text is ";
	    	      
	              speech += '. .';
	              speech += result.ocrtext;
	            
	           
                 send_alexa_response(res, speech, 'Salesforce', 'OCR Last Uploaded Image Type', 'Success', false);
            }

		});
	});	
}

function PredictImage(req,res,intent) {
	org.authenticate({ username: username, password: password}, function(err2, resp){
	console.log(org.oauth.instance_url+'####'+org.oauth);
		var oauth=resp;
		org.oauth=resp;
	org.apexRest({oauth:oauth, uri:'PredictImageType'},
		function(err,result) {
			if(err) {
              console.log(err);
              send_alexa_error(res,'An error occured during Image Prediction: '+err);
            }
            else {
            	var speech = "As per Einstine, Your Last Uploaded Image Is of Type";
	    	      
	              speech += '. .';
	              speech += result.ImageType;
	              speech += '. .';
	              speech += 'With Probability ';
	              speech += '. .';
	              speech += (result.prob*100);
	              
	              speech += 'Percent ';
	           
                 send_alexa_response(res, speech, 'Salesforce', 'Predict Last Uploaded Image Type', 'Success', false);
            }

		});
	});	
}

function PredictImageWatson(req,res,intent) {
	org.authenticate({ username: username, password: password}, function(err2, resp){
	console.log(org.oauth.instance_url+'####'+org.oauth);
		var oauth=resp;
		org.oauth=resp;
	org.apexRest({oauth:oauth, uri:'PredictImageTypeWatson'},
		function(err,result) {
			if(err) {
              console.log(err);
              send_alexa_error(res,'An error occured during Image Prediction: '+err);
            }
            else {
            	var speech = "As per Watson, Your Last Uploaded Image Is of Type";
	    	      
	              speech += '. .';
	              speech += result.ImageType;
	              speech += '. .';
	              speech += 'With Probability ';
	              speech += '. .';
	              speech += (result.prob*100);
	              
	              speech += 'Percent ';
	           
                 send_alexa_response(res, speech, 'Salesforce', 'Predict Last Uploaded Image Type', 'Success', false);
            }

		});
	});	
}


