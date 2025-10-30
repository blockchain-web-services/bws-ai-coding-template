/**
 * Integration Test Example - DynamoDB
 *
 * Integration tests verify that different parts of the system work together
 * These tests use LocalStack to simulate AWS services
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { DynamoDBClient, PutItemCommand, GetItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';

// Create DynamoDB client pointing to LocalStack
const dynamodb = new DynamoDBClient({
    endpoint: process.env.AWS_ENDPOINT_URL,
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test'
    }
});

const TABLE_NAME = `${process.env.TABLE_PREFIX || 'local-tests'}-DEMO_ITEMS`;

describe('DynamoDB Integration Tests', () => {
    beforeAll(async () => {
        // Verify LocalStack is accessible
        console.log(`Testing against: ${process.env.AWS_ENDPOINT_URL}`);
        console.log(`Table: ${TABLE_NAME}`);
    });

    it('should write an item to DynamoDB', async () => {
        const testItem = {
            ITEM_ID: { S: 'test-item-1' },
            name: { S: 'Test Item' },
            value: { N: '42' },
            createdAt: { S: new Date().toISOString() }
        };

        const result = await dynamodb.send(new PutItemCommand({
            TableName: TABLE_NAME,
            Item: testItem
        }));

        expect(result.$metadata.httpStatusCode).toBe(200);
    });

    it('should read an item from DynamoDB', async () => {
        // First, write an item
        const itemId = 'test-item-2';
        await dynamodb.send(new PutItemCommand({
            TableName: TABLE_NAME,
            Item: {
                ITEM_ID: { S: itemId },
                name: { S: 'Read Test Item' },
                description: { S: 'This item is for testing reads' }
            }
        }));

        // Now read it back
        const result = await dynamodb.send(new GetItemCommand({
            TableName: TABLE_NAME,
            Key: {
                ITEM_ID: { S: itemId }
            }
        }));

        expect(result.Item).toBeDefined();
        expect(result.Item.ITEM_ID.S).toBe(itemId);
        expect(result.Item.name.S).toBe('Read Test Item');
    });

    it('should scan the table', async () => {
        const result = await dynamodb.send(new ScanCommand({
            TableName: TABLE_NAME,
            Limit: 10
        }));

        expect(result.Items).toBeDefined();
        expect(Array.isArray(result.Items)).toBe(true);
        // Should have at least the items we created in previous tests
        expect(result.Items.length).toBeGreaterThan(0);
    });

    it('should handle conditional writes', async () => {
        const itemId = 'test-item-3';

        // First write
        await dynamodb.send(new PutItemCommand({
            TableName: TABLE_NAME,
            Item: {
                ITEM_ID: { S: itemId },
                value: { N: '1' }
            }
        }));

        // Conditional write should succeed
        const result = await dynamodb.send(new PutItemCommand({
            TableName: TABLE_NAME,
            Item: {
                ITEM_ID: { S: itemId },
                value: { N: '2' }
            },
            ConditionExpression: 'attribute_exists(ITEM_ID)'
        }));

        expect(result.$metadata.httpStatusCode).toBe(200);

        // Verify the value was updated
        const getResult = await dynamodb.send(new GetItemCommand({
            TableName: TABLE_NAME,
            Key: { ITEM_ID: { S: itemId } }
        }));

        expect(getResult.Item.value.N).toBe('2');
    });
});
