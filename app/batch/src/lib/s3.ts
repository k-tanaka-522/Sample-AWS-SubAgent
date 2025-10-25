/**
 * S3 upload utilities
 */

import { S3 } from 'aws-sdk';

const s3 = new S3({ region: process.env.AWS_REGION || 'ap-northeast-1' });

export interface UploadOptions {
  bucket: string;
  key: string;
  body: string | Buffer;
  contentType?: string;
}

export async function uploadToS3(options: UploadOptions): Promise<string> {
  const { bucket, key, body, contentType = 'text/csv' } = options;

  try {
    const params: S3.PutObjectRequest = {
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ServerSideEncryption: 'AES256',
    };

    const result = await s3.putObject(params).promise();
    console.log(`Uploaded to S3: s3://${bucket}/${key}`);

    return `s3://${bucket}/${key}`;
  } catch (error) {
    console.error('Failed to upload to S3:', error);
    throw error;
  }
}
