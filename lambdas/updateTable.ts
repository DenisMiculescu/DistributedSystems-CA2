import { SNSEvent } from "aws-lambda";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const dynamodb = new DynamoDBClient();

export const handler = async (event: SNSEvent): Promise<void> => {
  console.log("Event: ", JSON.stringify(event));

  for (const record of event.Records) {
    const snsMessage = JSON.parse(record.Sns.Message);
    const metadataType = record.Sns.MessageAttributes?.metadata_type?.Value;

    if (!metadataType || !["Caption", "Date", "Photographer"].includes(metadataType)) {
      console.error("Invalid metadata type");
      continue;
    }

    const { id, value } = snsMessage;

    try {
      const params = {
        TableName: process.env.DYNAMODB_TABLE,
        Key: { imageName: { S: id } },
        UpdateExpression: `SET ${metadataType} = :value`,
        ExpressionAttributeValues: {
          ":value": { S: value },
        },
      };

      await dynamodb.send(new UpdateItemCommand(params));
      console.log(`Successfully updated metadata for ${id}`);
    } catch (error) {
      console.error("Error updating metadata:", error);
    }
  }
};
