#!/usr/bin/env node

/**
 * Create S3 buckets in LocalStack
 * This is a generic example - customize for your project's buckets
 */

import { S3Client, CreateBucketCommand, ListBucketsCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

// Load environment
const LOCALSTACK_PORT = process.env.LOCALSTACK_PORT || '4567';
const AWS_ENDPOINT = process.env.AWS_ENDPOINT_URL || `http://localhost:${LOCALSTACK_PORT}`;
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || 'local-tests-app-cache';

// Create S3 client
const s3 = new S3Client({
    endpoint: AWS_ENDPOINT,
    region: 'us-east-1',
    forcePathStyle: true, // Required for LocalStack
    credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test'
    }
});

/**
 * Bucket definitions - customize these for your project
 */
const BUCKETS = [
    {
        name: S3_BUCKET_NAME,
        description: 'Main cache bucket'
    }
];

/**
 * Check if bucket exists
 */
async function bucketExists(bucketName) {
    try {
        await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Create an S3 bucket
 */
async function createBucket(bucketConfig) {
    try {
        // Check if bucket already exists
        if (await bucketExists(bucketConfig.name)) {
            console.log(`⏭️  Already exists: ${bucketConfig.name}`);
            return true;
        }

        console.log(`Creating bucket: ${bucketConfig.name}...`);
        await s3.send(new CreateBucketCommand({
            Bucket: bucketConfig.name
        }));
        console.log(`✅ Created: ${bucketConfig.name}`);
        return true;
    } catch (error) {
        console.error(`❌ Error creating bucket ${bucketConfig.name}:`, error.message);
        return false;
    }
}

/**
 * Main execution
 */
async function main() {
    console.log('\n🪣  Creating S3 Buckets');
    console.log('━'.repeat(50));
    console.log(`Endpoint: ${AWS_ENDPOINT}`);
    console.log('');

    let successCount = 0;
    let failCount = 0;

    for (const bucket of BUCKETS) {
        const success = await createBucket(bucket);
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

    // List all buckets
    console.log('\n📋 All buckets:');
    try {
        const { Buckets } = await s3.send(new ListBucketsCommand({}));
        Buckets.forEach(bucket => console.log(`  - ${bucket.Name}`));
    } catch (error) {
        console.error('Could not list buckets:', error.message);
    }

    process.exit(failCount > 0 ? 1 : 0);
}

main();
