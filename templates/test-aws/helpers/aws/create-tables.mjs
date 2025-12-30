#!/usr/bin/env node

/**
 * Create DynamoDB tables in LocalStack
 * This is a generic example - customize for your project's tables
 */

import { DynamoDBClient, CreateTableCommand, ListTablesCommand } from '@aws-sdk/client-dynamodb';

// Load environment
const LOCALSTACK_PORT = process.env.LOCALSTACK_PORT || '4567';
const AWS_ENDPOINT = process.env.AWS_ENDPOINT_URL || `http://localhost:${LOCALSTACK_PORT}`;
const TABLE_PREFIX = process.env.TABLE_PREFIX || process.env.ENVIRONMENT || 'local-tests';

// Create DynamoDB client
const dynamodb = new DynamoDBClient({
    endpoint: AWS_ENDPOINT,
    region: 'us-east-1',
    credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test'
    }
});

/**
 * Table definitions - customize these for your project
 */
const TABLES = [
    {
        name: 'DEMO_ITEMS',
        schema: {
            TableName: `${TABLE_PREFIX}-DEMO_ITEMS`,
            BillingMode: 'PAY_PER_REQUEST',
            AttributeDefinitions: [
                { AttributeName: 'ITEM_ID', AttributeType: 'S' }
            ],
            KeySchema: [
                { AttributeName: 'ITEM_ID', KeyType: 'HASH' }
            ]
        }
    },
    {
        name: 'DEMO_USERS',
        schema: {
            TableName: `${TABLE_PREFIX}-DEMO_USERS`,
            BillingMode: 'PAY_PER_REQUEST',
            AttributeDefinitions: [
                { AttributeName: 'USER_ID', AttributeType: 'S' }
            ],
            KeySchema: [
                { AttributeName: 'USER_ID', KeyType: 'HASH' }
            ]
        }
    }
];

/**
 * Create a DynamoDB table
 */
async function createTable(tableConfig) {
    try {
        console.log(`Creating table: ${tableConfig.schema.TableName}...`);
        await dynamodb.send(new CreateTableCommand(tableConfig.schema));
        console.log(`✅ Created: ${tableConfig.schema.TableName}`);
        return true;
    } catch (error) {
        if (error.name === 'ResourceInUseException') {
            console.log(`⏭️  Already exists: ${tableConfig.schema.TableName}`);
            return true;
        }
        console.error(`❌ Error creating table ${tableConfig.schema.TableName}:`, error.message);
        return false;
    }
}

/**
 * Main execution
 */
async function main() {
    console.log('\n🗄️  Creating DynamoDB Tables');
    console.log('━'.repeat(50));
    console.log(`Endpoint: ${AWS_ENDPOINT}`);
    console.log(`Prefix:   ${TABLE_PREFIX}`);
    console.log('');

    let successCount = 0;
    let failCount = 0;

    for (const table of TABLES) {
        const success = await createTable(table);
        if (success) {
            successCount++;
        } else {
            failCount++;
        }
    }

    console.log('');
    console.log('━'.repeat(50));
    console.log(`✅ Success: ${successCount}`);
    if (failCount > 0) {
        console.log(`❌ Failed:  ${failCount}`);
    }

    // List all tables
    console.log('\n📋 All tables:');
    try {
        const { TableNames } = await dynamodb.send(new ListTablesCommand({}));
        const relevantTables = TableNames.filter(name => name.startsWith(TABLE_PREFIX));
        relevantTables.forEach(name => console.log(`  - ${name}`));
    } catch (error) {
        console.error('Could not list tables:', error.message);
    }

    process.exit(failCount > 0 ? 1 : 0);
}

main();
