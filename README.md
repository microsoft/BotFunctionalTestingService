# Bot Functional Testing Service

A service to enable functional testing of a [Microsoft Bot Framework](https://dev.botframework.com/) bot. A call to this service programmatically simulates a user’s back-and-forth conversation with a bot, to test whether the bot behaves as expected. 

** TODO CTM INFO **

When calling the service, a _Test_ is given as input. A _Test_ is basically a “recording” of a user’s conversation with a bot. The _Test_ is run against a given bot to check whether the conversation occurs as expected.

The service exposes a RESTful API for running _Tests_. The HTTP response code of an API call indicates whether the conversation had occurred as expected or not. If not, the response body contains information regarding the _Test_ failure.

## Creating a Test

In order to create _Tests_, you should work with the [Bot Framework Emulator](https://docs.microsoft.com/en-us/azure/bot-service/bot-service-debug-emulator?view=azure-bot-service-4.0).

**Note:** After going through [installation basics](https://docs.microsoft.com/en-us/azure/bot-service/bot-service-debug-emulator?view=azure-bot-service-4.0#prerequisites), make sure you configure [ngrok](https://ngrok.com/) as detailed [here](https://docs.microsoft.com/en-us/azure/bot-service/bot-service-debug-emulator?view=azure-bot-service-4.0#configure-ngrok).

The simplest way to create a _Test_ is to have a conversation with your bot within the emulator, then save the _Transcript_ ([.transcript file](https://docs.microsoft.com/en-us/azure/bot-service/bot-builder-debug-transcript?view=azure-bot-service-4.0#the-bot-transcript-file)) as explained [here](https://docs.microsoft.com/en-us/azure/bot-service/bot-builder-debug-transcript?view=azure-bot-service-4.0#creatingstoring-a-bot-transcript-file). The _Transcript_ can be used by itself as a _Test_ for the service. The service will relate to the relevant information in the _Transcript_ (ignoring conversation-specific details like timestamps, for example) and attempt to conduct a similar conversation, sending the user utterances to the bot and expecting the same bot replies. 

## Deployment

The service is a [Node.js](https://nodejs.org) application. It can be installed using [npm](https://www.npmjs.com) (`npm install`). 

It can be easily deployed to Azure as an App Service:

[![Deploy to Azure](https://azuredeploy.net/deploybutton.png)](https://azuredeploy.net/)

### Environment Variables

The service communicates with a bot, therefore it needs to know the bot's [Web Chat](https://docs.microsoft.com/en-us/azure/bot-service/bot-service-channel-connect-webchat?view=azure-bot-service-4.0) [secret key](https://docs.microsoft.com/en-us/azure/bot-service/bot-service-channel-connect-webchat?view=azure-bot-service-4.0#step-1).

The service may communicate with multiple bots, so each bot should be identified by a logical name. All bots' secrets need to be defined in a single environment variable named `SECRETS`, which should include a string representing a JSON object. In this JSON object, each key (bot's name) is mapped to a value (bot's secret).

For example, let's assume we give the logical name '_samplebot_' to the bot we would like to test, and that its Web Chat secret is '_123_'. Then we should have an environment variable named `SECRETS` set to the following string:

{"samplebot" : "123"}

In case you would like to test a single bot most of the time, you can define an environment variable called `DefaultBot` to specify the logical name of your default bot.

**Note:** If you are deploying the code sample using the "Deploy to Azure" option, you should set the variables in the Application Settings of your App Service. 

## Running a Test

There are several options for calling the service to run a _Test_, using HTTP `GET` or `POST`. There are also several ways to pass _Test_ parameters to the service.

In all cases, the service needs to be aware of the bot to test. The target bot is identified by a logical name. This name can be passed as a 'bot' HTTP query parameter, e.g. '…?bot=_bot-logical-name_'. If no bot name is specified as a query parameter, the service uses the `DefaultBot` environment variable.

### Using HTTP `POST` with a _Transcript_

The simplest way to run a test is to `POST` an HTTP request to the `/test` route of the service. The request body should contain the contents of a _Transcript_ in JSON (application/json) format.

Assuming our target bot is named '_samplebot_' and our service was deployed to Azure as '_testing123_', the request query may look like:

`https://testing123.azurewebsites.net/test?bot=samplebot`

In case you have `DeafultBot` set to '_samplebot_', the request may look like:

`https://testing123.azurewebsites.net/test`

### Using HTTP `GET` with a _Transcript_ URL

Instead of `POST`-ing the _Transcript_ as the request body, you can store it somewhere and give its URL to the service as a 'url' HTTP query parameter in a `GET` HTTP request.

Let's assume that we have a Blob Storage account on Azure called '_samplestorageaccount_', and we uploaded a _Transcript_ file called '_Sample.transcript_' to a container called '_tests_'. The corresponding request query may look like:

`https://testing123.azurewebsites.net/test?bot=samplebot&url=https://samplestorageaccount.blob.core.windows.net/tests/Sample.transcript`



## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.microsoft.com.

When you submit a pull request, a CLA-bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., label, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
