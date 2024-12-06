import { SQSHandler } from "aws-lambda";
import {
  GetObjectCommand,
  GetObjectCommandInput,
  S3Client,
} from "@aws-sdk/client-s3";
import { DynamoDBClient, PutItemCommand, PutItemCommandInput } from "@aws-sdk/client-dynamodb";

const s3 = new S3Client();
const dynamodb = new DynamoDBClient();

const validExtensions = [".jpeg", ".png"];

export const handler: SQSHandler = async (event) => {
  console.log("Event ", JSON.stringify(event));

  for (const record of event.Records) {
    const recordBody = JSON.parse(record.body);
    const snsMessage = JSON.parse(recordBody.Message);

    if (snsMessage.Records) {
      for (const messageRecord of snsMessage.Records) {
        const s3e = messageRecord.s3;
        const srcBucket = s3e.bucket.name;
        const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));
        const extension = srcKey.split(".").pop()?.toLowerCase();

        // Reject unsupported file extensions
        if (!extension || !validExtensions.includes(`.${extension}`)) {
          console.error(`Unsupported file extension: ${extension}`);
          throw new Error(`Unsupported file extension: ${extension}`);
        }

        try {
          // Record valid image upload in DynamoDB
          const params: PutItemCommandInput = {
            TableName: process.env.DYNAMODB_TABLE,
            Item: {
              imageName: { S: srcKey },
            },
          };

          await dynamodb.send(new PutItemCommand(params));
          console.log(`Successfully added ${srcKey} to DynamoDB.`);
        } catch (error) {
          console.error("Error adding item to DynamoDB:", error);
          throw error;
        }

        try {
          // Retrieve the object from S3
          const getObjectParams: GetObjectCommandInput = {
            Bucket: srcBucket,
            Key: srcKey,
          };
          await s3.send(new GetObjectCommand(getObjectParams));
          console.log(`Successfully retrieved object: ${srcKey}`);
        } catch (error) {
          console.error("Error retrieving object from S3:", error);
          throw error;
        }
      }
    }
  }
};
