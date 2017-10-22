'use strict';
var request = require('request');


var credentials = {
  username: '*',
  password: '*'
}

var portfolio;
var blackrockAPI = 'https://www.blackrock.com/tools/hackathon';

function getTicker(instrumentURL){
  request.get(instrumentURL, (err, res, body)=> {
    console.log(body.symbol);
  });
};

function executeOrder(stockName, ticker, quantity, intent, session, request){
  var RobinHood=require('robinhood')(credentials, ()=> {
    RobinHood.instruments(ticker, (err, res, body) => {
      if(err){
        console.log("ERROR");
        return;
      }
      var options = {
        type: 'market',
        quantity: quantity,
        bid_price: 1.00, //Ignored since market order
        instrument: {
          url:body.results[0].url,
          symbol:ticker
        }
      };
      RobinHood.place_buy_order(options, (err, res, body) => {
        console.log(body);
        // Get order executed at
        handleRequest(intent, "<speak>Buy order of " + quantity + " shares of " + stockName + " successfully executed</speak>", session, request);
      })
    })
  }) 
}

function buildPortfolio(intent, session, callback){
  var RobinHood = require('robinhood')(credentials, () => {
    RobinHood.positions((err, res, body)=>{
      if(err){
        console.log(err);
      }
      else{
        console.log("positions");
        console.log(body);

        //build out percentages

        var personalStocks = {
          'VOO': 2598.20,
          'BIDU': 1324.5,
          'INST': 1045.5,
          'BABA': 887.5,
          'MSFT': 788.1,
          'SHOP': 408.6,
          'VT': 1081.5
        };

        var total = 0;
        for (var val in personalStocks){
          total += personalStocks[val];
        }

        //BLK~25|AAPL~25|IXN~25|MALOX~24
        var positions = '';
        for (var val in personalStocks) {
          positions += val+'~'+100*personalStocks[val]/total+'|';
        }
        request.get(blackrockAPI+'/portfolio-analysis?positions='+positions+'&calculateExpectedReturns=true', {json: true}, (err, res, body) => {
          var portfolio = body.resultMap.PORTFOLIOS[0].portfolios;

          var yearReturn = body.resultMap.PORTFOLIOS[0].portfolios[0].returns.latestPerf.oneYear;
          handleRequest(intent,"<speak>Based on past data, your personal portfolio will increase from "+ total+ " to "+total*(1+yearReturn)+", netting a profit of "+total*yearReturn+" over the next year.</speak>", session, callback)
          console.log(body.resultMap.PORTFOLIOS[0].portfolios);
        });
        
      }
    })
  }) 
}

//Should I buy X pipeline
// Get appropriate stock ticker (passed from intent)
// risk variable 
function shouldIBuy(stockName, ticker, intent, session, callback){
  request.get(blackrockAPI+'/portfolio-analysis?positions='+ticker+'~100', {json: true}, (err, res, body)=>{
    if(err){
      console.log(err);
      return err;
    }
    var annualReturns = body.resultMap.PORTFOLIOS[0].portfolios[0].returns.latestPerf.oneYear;
    var threeMonthReturns = body.resultMap.PORTFOLIOS[0].portfolios[0].returns.latestPerf.threeMonth;
    var oneDayReturns = body.resultMap.PORTFOLIOS[0].portfolios[0].returns.latestPerf.oneDay;

    // greater than 8% return rate
    if(threeMonthReturns > .03 || annualReturns > .08){
      handleRequest(intent, "<speak>Buy. "+stockName+" is a suggested buy given that it's grown "+ threeMonthReturns*100 +" percent over the past three months</speak>", session, callback)
      return true;
    }
    else{
      console.log("bad buy");
      handleRequest(intent, "<speak>Do not buy. "+stockName+" has trended downwards and fell "+ threeMonthReturns*100 +" percent over the past three months</speak>", session, callback)
      return false;
    }
  })
}

// Route the incoming request based on type (LaunchRequest, IntentRequest,
// etc.) The JSON body of the request is provided in the event parameter.
exports.handler = function (event, context) {
  try {
      console.log("event.session.application.applicationId=" + event.session.application.applicationId);

      /**
       * Uncomment this if statement and populate with your skill's application ID to
       * prevent someone else from configuring a skill that sends requests to this function.
       */
   
//     if (event.session.application.applicationId !== "amzn1.echo-sdk-ams.app.05aecccb3-1461-48fb-a008-822ddrt6b516") {
//         context.fail("Invalid Application ID");
//      }

      if (event.session.new) {
          onSessionStarted({requestId: event.request.requestId}, event.session);
      }

      if (event.request.type === "LaunchRequest") {
          onLaunch(event.request,
              event.session,
              function callback(sessionAttributes, speechletResponse) {
                  context.succeed(buildResponse(sessionAttributes, speechletResponse));
              });
      } else if (event.request.type === "IntentRequest") {
          onIntent(event.request,
              event.session,
              function callback(sessionAttributes, speechletResponse) {
                  context.succeed(buildResponse(sessionAttributes, speechletResponse));
              });
      } else if (event.request.type === "SessionEndedRequest") {
          onSessionEnded(event.request, event.session);
          context.succeed();
      }
  } catch (e) {
      context.fail("Exception: " + e);
  }
};

/**
* Called when the session starts.
*/
function onSessionStarted(sessionStartedRequest, session) {
  console.log("onSessionStarted requestId=" + sessionStartedRequest.requestId
      + ", sessionId=" + session.sessionId);

  // add any session init logic here
}

/**
* Called when the user invokes the skill without specifying what they want.
*/
function onLaunch(launchRequest, session, callback) {
  console.log("onLaunch requestId=" + launchRequest.requestId
      + ", sessionId=" + session.sessionId);

  // Welcome
  var cardTitle = "Welcome"
  var speechOutput = "<speak>Welcome to Razzle</speak>"
  callback(session.attributes,
      buildSpeechletResponse(cardTitle, speechOutput, "", true));
}

var stock = {
  'vanguard': 'VOO',
  'baidu': 'BIDU',
  'instructure': 'INST',
  'alibaba' : 'BABA',
  'microsoft' : 'MSFT',
  'google' : 'GGL',
  'apple' : 'AAPL',
  'shopify': 'SHOP',
  'vanguard total world': 'VT',
  'blackRock': 'BLK',
  'snapchat': 'SNAP',
}

/**
* Called when the user specifies an intent for this skill.
*/
function onIntent(intentRequest, session, callback) {
  console.log("onIntent requestId=" + intentRequest.requestId
      + ", sessionId=" + session.sessionId);

  var intent = intentRequest.intent,
      intentName = intentRequest.intent.name;
  var src;
  var failed;
  var stockName;


  if (intentName == 'ShouldIBuy'){
    stockName = intent.slots.Stock.value;
    if(stock[stockName.toLowerCase()]){
      shouldIBuy(stockName,stock[stockName.toLowerCase()], intent, session, callback);
      return;
    }
  }
  else if (intentName == 'ExecuteBuy'){
    stockName = intent.slots.Stock.value;
    var stockQuantity = intent.slots.Quantity.value;
    if(stock[stockName.toLowerCase()] && stockQuantity != 0){
      executeOrder(stockName, stock[stockName.toLowerCase()], stockQuantity, intent, session, callback);
      return;
    }
  }
  else if (intentName == 'HowMuchWill'){
    buildPortfolio();
    return;
  }

  handleRequest(intent, "<speak>I don't have any advice on buying " +stockName+"</speak>", session, callback);
}

/**
* Called when the user ends the session.
* Is not called when the skill returns shouldEndSession=true.
*/
function onSessionEnded(sessionEndedRequest, session) {
  console.log("onSessionEnded requestId=" + sessionEndedRequest.requestId
      + ", sessionId=" + session.sessionId);

  // Add any cleanup logic here
}

function handleRequest(intent, output, session, callback) {
  callback(session.attributes,
      buildSpeechletResponseWithoutCard(output, "", "true"));
}


// ------- Helper functions to build responses -------

function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
  return {
      outputSpeech: {
          type: "ssml",
          ssml: output
      },
      card: {
          type: "Simple",
          title: title,
          content: output
      },
      reprompt: {
          outputSpeech: {
              type: "PlainText",
              text: repromptText
          }
      },
      shouldEndSession: shouldEndSession
  };
}

function buildSpeechletResponseWithoutCard(output,  repromptText, shouldEndSession) {
  return {
      outputSpeech: {
          type: "SSML",
          ssml: output
      },
      reprompt: {
          outputSpeech: {
              type: "PlainText",
              text: repromptText
          }
      },
      shouldEndSession: shouldEndSession
  };
}

function buildResponse(sessionAttributes, speechletResponse) {
  return {
      version: "1.0",
      sessionAttributes: sessionAttributes,
      response: speechletResponse
  };
}