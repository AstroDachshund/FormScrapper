const AWS = require('aws-sdk');
const splitArray = require("split-array");
const { v4: uuidv4 } = require('uuid');

const sqs = new AWS.SQS();
exports.handler = async (event) => {

  async function sendMessages(queueUrl, messages) {
    const spilttedArray = splitArray(messages, 1);
    for (const arr of spilttedArray) {
      var params = {
        QueueUrl: queueUrl,
        Entries: []
      };
      for (const message of arr) {
        params.Entries.push({
          Id: uuidv4(),
          MessageBody: message.url
        });
      }
      await sqs.sendMessageBatch(params).promise();
    }
  }
  const queueUrl = "https://sqs.eu-west-1.amazonaws.com/911108721777/test-hookforms";
  //get json file from s3
  const s3 = new AWS.S3();
  const params = {
    Bucket: 'test-edrone-hookforms',
    Key: 'testURL.json'
  };
  const data = await s3.getObject(params).promise();
  const json = JSON.parse(data.Body.toString('utf-8'));
  await sendMessages(queueUrl, json);
};
